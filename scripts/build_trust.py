#!/usr/bin/env python3
"""全国世論調査の信頼度得点を、各回PDFの総数の行から組み立てる。"""

from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "trust" / "raw"
OUT = ROOT / "data" / "trust" / "series.json"
INDEX = "https://www.chosakai.gr.jp/project/notification/"

KEYS = [
    ("nhk", ["NHKテレビ"]),
    ("newspaper", ["新聞"]),
    ("commercial", ["民放テレビ"]),
    ("radio", ["ラジオ"]),
    ("internet", ["インターネット"]),
    ("magazine", ["雑誌"]),
]


def compact(text: str) -> str:
    text = re.sub(r"\s+", "", text)
    return text.replace("ＮＨＫ", "NHK").replace("ｲﾝﾀｰﾈｯﾄ", "インターネット")


def label_order(line: str) -> list[str] | None:
    folded = compact(line)
    if any(token in folded for token in ("男性", "女性", "歳")) or re.search(r"\d+代", folded):
        return None
    if len(folded) > 40 and not folded.startswith("総数"):
        return None
    found: list[tuple[int, str]] = []
    for key, names in KEYS:
        positions = [folded.find(name) for name in names if folded.find(name) >= 0]
        if not positions:
            return None
        found.append((min(positions), key))
    found.sort()
    keys = [key for _, key in found]
    if len(set(keys)) != 6:
        return None
    return keys


def is_total(line: str) -> bool:
    folded = compact(line)
    if any(token in folded for token in ("男性", "女性", "歳")) or re.search(r"\d+代", folded):
        return False
    return folded == "総数" or folded.startswith("総数")


def six_numbers(line: str) -> list[float] | None:
    found = re.findall(r"(?<!\d)\d+\.\d+(?!\d)", line)
    if len(found) != 6:
        return None
    return [float(item) for item in found]


def blocked(line: str) -> bool:
    folded = compact(line)
    return any(token in folded for token in ("男性", "女性")) or bool(re.search(r"\d+代", folded))


def totals(text: str) -> list[dict[str, float]]:
    lines = text.splitlines()
    rows: list[dict[str, float]] = []
    for index, line in enumerate(lines):
        if not is_total(line):
            continue
        header = label_order(line)
        if header is None:
            for earlier in range(index - 1, max(-1, index - 8), -1):
                if blocked(lines[earlier]):
                    break
                header = label_order(lines[earlier])
                if header:
                    break
        numbers = None
        for later in range(index, min(len(lines), index + 8)):
            if later > index and (is_total(lines[later]) or blocked(lines[later])):
                break
            numbers = six_numbers(lines[later])
            if numbers:
                break
        window = "\n".join(lines[max(0, index - 40) : index + 3])
        if not header or not numbers or "信頼" not in window:
            continue
        rows.append(dict(zip(header, numbers)))
    unique: list[dict[str, float]] = []
    for row in rows:
        if row not in unique:
            unique.append(row)
    if len(unique) != 1:
        raise SystemExit(f"総数の行が一意でない: {unique!r}")
    return unique


def prose_scores(text: str) -> dict[str, float]:
    folded = compact(text)
    found: dict[str, float] = {}
    for key, names in KEYS:
        for name in names:
            for match in re.finditer(re.escape(name) + r".{0,16}?(\d+\.\d+)点", folded):
                value = float(match.group(1))
                if value >= 30:
                    found.setdefault(key, value)
                    break
    return found


def pdftotext(path: Path) -> str:
    done = subprocess.run(
        ["pdftotext", "-layout", str(path), "-"],
        check=True,
        capture_output=True,
    )
    return done.stdout.decode("utf-8", errors="replace")


def national_html() -> str:
    html = (RAW / "index.html").read_text(encoding="utf-8")
    start = html.find("<h2>メディアに関する全国世論調査</h2>")
    end = html.find("<h2>諸外国における対日メディア世論調査</h2>")
    if start < 0 or end < 0 or end <= start:
        raise SystemExit("全国調査の節が見つからない")
    return html[start:end]


def rounds_from_html(html: str) -> list[dict]:
    parts = re.split(r'<p class="title01">第(\d+)回調査</p>', html)
    found: dict[int, dict] = {}
    for number, body in zip(parts[1::2], parts[2::2]):
        round_no = int(number)
        fieldwork = re.search(r"実施日：</dt>\s*<dd>(.*?)</dd>", body, re.S)
        released = re.search(r"公表日：</dt>\s*<dd>(.*?)</dd>", body, re.S)
        if not fieldwork or not released:
            raise SystemExit(f"第{round_no}回の実施日か公表日がない")
        field = re.sub(r"\s+", "", fieldwork.group(1))
        release = re.sub(r"\s+", "", released.group(1))
        year = int(field[:4])
        main = body.split('class="list04"', 1)[0]
        links = re.findall(r'href="(https://[^"]+\.pdf)"', main)
        if not links:
            raise SystemExit(f"第{round_no}回のPDFリンクがない")
        found[round_no] = {
            "round": round_no,
            "year": year,
            "fieldwork": field,
            "released": release,
            "pdfs": links,
        }
    if sorted(found) != list(range(1, 19)):
        raise SystemExit(f"回が揃っていない: {sorted(found)}")
    return [found[number] for number in range(1, 19)]


def main() -> None:
    catalog = rounds_from_html(national_html())
    series: dict[str, list[dict]] = {key: [] for key, _ in KEYS}
    used = []
    for item in catalog:
        if item["year"] != 2007 + item["round"]:
            raise SystemExit(f"実施年が想定と違う: {item}")
        slot = 0 if item["round"] <= 10 else 1
        if slot >= len(item["pdfs"]):
            raise SystemExit(f"第{item['round']}回のPDFが足りない")
        pdf_url = item["pdfs"][slot]
        local = RAW / f"r{item['round']:02d}-{slot}.pdf"
        if not local.exists():
            raise SystemExit(f"ない: {local}")
        text = pdftotext(local)
        scores = totals(text)[0]
        spoken = prose_scores(text)
        for key, value in spoken.items():
            if abs(scores[key] - value) > 0.05:
                raise SystemExit(f"第{item['round']}回 {key} 表{scores[key]} 本文{value}")
        for key, value in scores.items():
            if not 0 <= value <= 100:
                raise SystemExit(f"範囲外 {item['round']} {key} {value}")
        source = local.name
        for key, _ in KEYS:
            series[key].append(
                {
                    "year": item["year"],
                    "value": scores[key],
                    "segment": "score",
                    "source": source,
                }
            )
        used.append(
            {
                "round": item["round"],
                "year": item["year"],
                "fieldwork": item["fieldwork"],
                "released": item["released"],
                "pdf": pdf_url,
                "file": source,
            }
        )
    for key, points in series.items():
        years = [point["year"] for point in points]
        if years != list(range(2008, 2026)):
            raise SystemExit(f"{key} の年が連続していない: {years}")
    payload = {
        "question": "日本人はどのメディアを信じてきたか",
        "stat": "新聞通信調査会「メディアに関する全国世論調査」",
        "unit": "点",
        "scale": "全面的に信頼している場合を100点、普通を50点、全く信頼していない場合を0点とした平均点",
        "yearStart": 2008,
        "yearEnd": 2025,
        "index": INDEX,
        "excluded": "諸外国における対日メディア世論調査",
        "unconfirmed": [
            "100点・50点・0点の得点の作り方が変わった年。各回の本文には同じ説明があるが、変わった年は確認できないので線は切っていない。"
        ],
        "rounds": used,
        "series": series,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUT} rounds={len(used)}")


if __name__ == "__main__":
    main()
