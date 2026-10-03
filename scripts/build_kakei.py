#!/usr/bin/env python3
"""Build the household media-expenditure series from primary files.

Reads only files under data/kakei/raw. Does not invent values.
Writes data/kakei/series.json.
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

import xlrd

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "kakei" / "raw"
OUT = ROOT / "data" / "kakei" / "series.json"


def num(value):
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip().replace(",", "")
    if text in ("", "...", "-", "―", "－", "***", "X"):
        return None
    try:
        return float(text)
    except ValueError:
        return None


def chouki_rows(path: Path, sheet: str, header_row: int = 8):
    book = xlrd.open_workbook(path)
    sh = book.sheet_by_name(sheet)
    rows = []
    for r in range(header_row + 4, sh.nrows):
        year = sh.cell_value(r, 1)
        if isinstance(year, (int, float)):
            rows.append((int(year), r, sh))
    return rows


def cell(sh, r, c):
    return num(sh.cell_value(r, c))


def read_chouki_a():
    """1963?2007, two-or-more non-farm households. Annual yen."""
    path = RAW / "20-03-a.xls"
    out = {}
    for year, r, sh in chouki_rows(path, "801-913"):
        magazine = cell(sh, r, 78)
        if year < 1973:
            parts = [cell(sh, r, 76), cell(sh, r, 77)]
            magazine = None if any(v is None for v in parts) else parts[0] + parts[1]
            magazine_note = "sum-magazine-weekly"
        else:
            magazine_note = None
        out[year] = {
            "newspaper": cell(sh, r, 75),
            "magazine": magazine,
            "magazine_note": magazine_note,
            "books": cell(sh, r, 80),
            "broadcast": cell(sh, r, 99),
            "nhk": cell(sh, r, 100),
            "cable": cell(sh, r, 101),
            "other": cell(sh, r, 102),
            "universe": "nonfarm",
            "source": "chouki-20-03-a",
        }
    return out


def read_chouki_b():
    """2000?2010, two-or-more households. Annual yen."""
    path = RAW / "20-03-b.xls"
    out = {}
    for year, r, sh in chouki_rows(path, "801-913"):
        out[year] = {
            "newspaper": cell(sh, r, 54),
            "magazine": cell(sh, r, 55),
            "magazine_note": None,
            "books": cell(sh, r, 56),
            "broadcast": cell(sh, r, 73),
            "nhk": cell(sh, r, 74),
            "cable": cell(sh, r, 75),
            "other": cell(sh, r, 76),
            "universe": "twoplus",
            "source": "chouki-20-03-b",
        }
    return out


def read_yearbook(year: int):
    path = RAW / "nenpou" / f"4-1-{year}.xls"
    sh = xlrd.open_workbook(path).sheet_by_index(0)
    wanted = {
        "850": "newspaper",
        "851": "magazine",
        "854": "books",
        "88A": "nhk",
        "88B": "cable",
        "880": "other",
    }
    found = {}
    broadcast = None
    for r in range(sh.nrows):
        code = str(sh.cell_value(r, 7)).strip()
        name = str(sh.cell_value(r, 8)).strip()
        amount = cell(sh, r, 11)
        if code in wanted:
            found[wanted[code]] = amount
        if name == "放送受信料":
            broadcast = amount
    missing = [k for k in wanted.values() if k not in found]
    if missing or broadcast is None:
        raise SystemExit(f"{year} yearbook missing {missing} broadcast={broadcast}")
    return {
        "newspaper": found["newspaper"],
        "magazine": found["magazine"],
        "magazine_note": None,
        "books": found["books"],
        "broadcast": broadcast,
        "nhk": found["nhk"],
        "cable": found["cable"],
        "other": found["other"],
        "universe": "twoplus",
        "source": f"nenpou-{year}",
    }


def read_estat(path: Path, source: str):
    rows = list(csv.reader(path.read_text("cp932").splitlines()))
    year_cols = []
    for i, value in enumerate(rows[1]):
        if value.endswith("年") and value[:-1].isdigit():
            year_cols.append((i, int(value[:-1])))
    by_code = {
        "850": "newspaper",
        "851": "magazine",
        "854": "books",
        "88A": "nhk",
        "88B": "cable",
        "880": "other",
    }
    bucket = {year: {} for _, year in year_cols}
    for row in rows:
        if len(row) < 8:
            continue
        code = row[6].strip()
        name = row[7].strip()
        if code in by_code:
            key = by_code[code]
        elif name == "放送受信料":
            key = "broadcast"
        else:
            continue
        for i, year in year_cols:
            bucket[year][key] = num(row[i]) if i < len(row) else None
    out = {}
    for year, values in bucket.items():
        missing = [k for k in (*by_code.values(), "broadcast") if k not in values]
        if missing:
            raise SystemExit(f"{path.name} {year} missing {missing}")
        out[year] = {
            "newspaper": values["newspaper"],
            "magazine": values["magazine"],
            "magazine_note": None,
            "books": values["books"],
            "broadcast": values["broadcast"],
            "nhk": values["nhk"],
            "cable": values["cable"],
            "other": values["other"],
            "universe": "twoplus",
            "source": source,
        }
    return out


def near(a, b, tol=1.0):
    if a is None or b is None:
        return False
    return abs(a - b) <= tol


def main():
    a = read_chouki_a()
    b = read_chouki_b()
    # Magazine + weekly magazine equals the combined item, 1973?1994.
    for year, r, sh in chouki_rows(RAW / "20-03-a.xls", "801-913"):
        if 1973 <= year <= 1994:
            parts = cell(sh, r, 76) + cell(sh, r, 77)
            combined = cell(sh, r, 78)
            if not near(parts, combined, 0):
                raise SystemExit(f"magazine sum mismatch {year}: {parts} vs {combined}")

    series = {}
    for year in range(1963, 2000):
        if year not in a:
            raise SystemExit(f"missing chouki-a {year}")
        series[year] = a[year]
    for year in range(2000, 2011):
        if year not in b:
            raise SystemExit(f"missing chouki-b {year}")
        series[year] = b[year]
    for year in range(2011, 2015):
        series[year] = read_yearbook(year)
    series.update(read_estat(RAW / "hinmoku-all-annual-2015.csv", "estat-2015"))
    series.update(read_estat(RAW / "hinmoku-all-annual-2020.csv", "estat-2020"))
    series.update(read_estat(RAW / "hinmoku-all-annual-2025.csv", "estat-2025"))

    years = list(range(1963, 2026))
    if set(series) != set(years):
        raise SystemExit(f"year coverage {sorted(set(years) - set(series))}")

    for year, row in series.items():
        parts = [row["nhk"], row["cable"], row["other"]]
        known = [v for v in parts if v is not None]
        # Before cable is published, NHK + other equals the broadcast total
        # (cable still sits inside 他の受信料). After 2002, three parts sum.
        if year < 2000:
            if any(v is not None for v in parts):
                raise SystemExit(f"unexpected split before 2000: {year} {parts}")
            if row["broadcast"] is None:
                raise SystemExit(f"missing broadcast total {year}")
        elif year < 2002:
            if row["cable"] is not None:
                raise SystemExit(f"unexpected cable {year}")
            if not near((row["nhk"] or 0) + (row["other"] or 0), row["broadcast"], 1):
                raise SystemExit(f"broadcast parts {year}: {row}")
        else:
            if any(v is None for v in parts):
                raise SystemExit(f"missing broadcast part {year}: {row}")
            if not near(sum(parts), row["broadcast"], 1):
                raise SystemExit(
                    f"broadcast sum {year}: {sum(parts)} vs {row['broadcast']}"
                )
        for key in ("newspaper", "magazine", "books"):
            if row[key] is None:
                raise SystemExit(f"missing {key} {year}")

    def point(year, key, segment):
        row = series[year]
        value = row[key]
        if value is None:
            return None
        return {
            "year": year,
            "value": int(round(value)),
            "segment": segment,
            "universe": row["universe"],
            "source": row["source"],
        }

    def column(key, segment_for):
        points = []
        for year in years:
            segment = segment_for(year, series[year])
            item = point(year, key, segment) if segment else None
            points.append(item)
        return points

    # 他の受信料 in 2000?2001 still includes cable. Keep it off the later series.
    def other_segment(year, row):
        if year < 2002:
            return None
        return "twoplus"

    def other_incl_segment(year, row):
        if year in (2000, 2001):
            return "incl-cable"
        return None

    def cable_segment(year, row):
        if year < 2002 or row["cable"] is None:
            return None
        return "twoplus"

    def nhk_segment(year, row):
        if year < 2000 or row["nhk"] is None:
            return None
        return "twoplus"

    def broadcast_segment(year, row):
        if year >= 2000:
            return None
        return "nonfarm"

    def paper_segment(year, row):
        return "nonfarm" if year < 2000 else "twoplus"

    items = [
        {
            "id": "newspaper",
            "name": "新聞",
            "code": "850",
            "color": "#22211e",
            "stack": True,
            "points": column("newspaper", paper_segment),
        },
        {
            "id": "magazine",
            "name": "雑誌",
            "code": "851",
            "color": "#8d6a4a",
            "stack": True,
            "points": column("magazine", paper_segment),
        },
        {
            "id": "books",
            "name": "書籍",
            "code": "854",
            "color": "#b0392a",
            "stack": True,
            "points": column("books", paper_segment),
        },
        {
            "id": "broadcast",
            "name": "放送受信料",
            "code": "880・88A・88B",
            "color": "#5c564c",
            "stack": True,
            "points": column("broadcast", broadcast_segment),
            "note": "2000年より前は内訳が公表されていない。この帯だけを置く。",
        },
        {
            "id": "nhk",
            "name": "NHK放送受信料",
            "code": "88A",
            "color": "#1f4d3a",
            "stack": True,
            "points": column("nhk", nhk_segment),
        },
        {
            "id": "other-incl",
            "name": "他の受信料（ケーブルを含む）",
            "code": "880",
            "color": "#6e5a3c",
            "stack": True,
            "points": column("other", other_incl_segment),
            "note": "2000年と2001年だけ。ケーブルはまだ分かれていない。",
        },
        {
            "id": "cable",
            "name": "ケーブルテレビ放送受信料",
            "code": "88B",
            "color": "#2f527a",
            "stack": True,
            "points": column("cable", cable_segment),
        },
        {
            "id": "other",
            "name": "他の放送受信料",
            "code": "880",
            "color": "#8a8178",
            "stack": True,
            "points": column("other", other_segment),
        },
    ]

    # Drop explicit null placeholders: the client treats missing years as gaps.
    for item in items:
        item["points"] = [p for p in item["points"] if p is not None]

    overlap = {
        "year": 2000,
        "nonfarm": {k: int(round(a[2000][k])) for k in ("newspaper", "magazine", "books", "nhk", "other", "broadcast")},
        "twoplus": {k: int(round(b[2000][k])) for k in ("newspaper", "magazine", "books", "nhk", "other", "broadcast")},
    }
    payload = {
        "question": "世帯はメディアにいくら払ってきたか",
        "overlap2000": overlap,
        "stat": "家計調査",
        "unit": "円",
        "unitLabel": "1世帯あたり年間の支出金額（円）",
        "price": "名目",
        "yearStart": 1963,
        "yearEnd": 2025,
        "breaks": [2000],
        "items": items,
        "checks": {
            "magazineSumEqualsCombined": "1973?1994",
            "broadcastPartsEqualTotal": "2000?2025",
        },
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    def peak(item_id):
        item = next(i for i in items if i["id"] == item_id)
        best = max(item["points"], key=lambda p: p["value"])
        last = max(item["points"], key=lambda p: p["year"])
        return best, last

    print(f"wrote {OUT}")
    for item_id in ("newspaper", "magazine", "books", "nhk", "cable", "other", "broadcast"):
        best, last = peak(item_id)
        print(
            f"{item_id}: n={len(next(i for i in items if i['id']==item_id)['points'])} "
            f"peak {best['year']} {best['value']} ({best['universe']}) "
            f"last {last['year']} {last['value']}"
        )


if __name__ == "__main__":
    main()
