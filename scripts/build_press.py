#!/usr/bin/env python3
"""Build newspaper circulation series from Japan Newspaper Association HTML tables."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "press" / "raw"
OUT = ROOT / "data" / "press" / "series.json"


def nums(html: str) -> list[float]:
    body = html.split('class="tblCol tblNum tableRight"', 1)[1]
    body = body.split("</table>", 1)[0]
    return [float(cell.replace(",", "")) for cell in re.findall(r"<td>\s*([0-9][0-9,\.]*)\s*</td>", body)]


def years(html: str) -> list[int]:
    left = html.split('class="tblCol tblNum tableLeft"', 1)[1].split("</table>", 1)[0]
    return [int(year) for year in re.findall(r"<th>(\d{4})年</th>", left)]


def rows(html: str, width: int) -> list[tuple[int, list[float]]]:
    found = years(html)
    values = nums(html)
    if len(values) != len(found) * width:
        raise SystemExit(f"shape {len(found)} x {width} != {len(values)}")
    return [(year, values[i * width : (i + 1) * width]) for i, year in enumerate(found)]


def point(year: int, value: float, segment: str, source: str) -> dict:
    out = {"year": year, "value": value, "segment": segment, "source": source}
    if float(value).is_integer():
        out["value"] = int(value)
    return out


def main() -> None:
    one = rows((RAW / "circulation01.html").read_text("utf-8-sig"), 8)
    spread = rows((RAW / "circulation05.html").read_text("utf-8-sig"), 3)
    delivery = rows((RAW / "circulation03.html").read_text("utf-8-sig"), 4)
    if [year for year, _ in one] != list(range(2025, 1964, -1)):
        raise SystemExit("circulation01 years")
    if [year for year, _ in spread] != list(range(2025, 1999, -1)):
        raise SystemExit("circulation05 years")
    if [year for year, _ in delivery] != list(range(2025, 1999, -1)):
        raise SystemExit("circulation03 years")

    keys = ["total", "general", "sports", "set", "morning", "evening", "perHousehold", "households"]
    series = {key: [] for key in keys}
    for year, row in reversed(one):
        total, general, sports, bundled, morning, evening, per, households = row
        if general + sports != total:
            raise SystemExit(f"{year} general+sports {general + sports} != {total}")
        if bundled + morning + evening != total:
            raise SystemExit(f"{year} forms {bundled + morning + evening} != {total}")
        ratio = total / households
        if abs(ratio - per) > 0.01:
            raise SystemExit(f"{year} per household {per} vs {ratio}")
        household_segment = "household-jan1" if year >= 2014 else "household-mar31"
        values = {
            "total": (total, "set-as-one"),
            "general": (general, "set-as-one"),
            "sports": (sports, "set-as-one"),
            "set": (bundled, "set-as-one"),
            "morning": (morning, "set-as-one"),
            "evening": (evening, "set-as-one"),
            "perHousehold": (per, household_segment),
            "households": (households, household_segment),
        }
        for key, (value, segment) in values.items():
            series[key].append(point(year, value, segment, "circulation01"))

    latest = one[0][1]
    exact_two = latest[0] + latest[3]
    if exact_two != 28244091:
        raise SystemExit(f"2025 set-as-two {exact_two}")

    spread_copies = []
    papers = []
    per_thousand = []
    for year, row in reversed(spread):
        thousands, people, titles = row
        spread_copies.append(point(year, thousands * 1000, "set-as-two", "circulation05"))
        per_thousand.append(point(year, people, "set-as-two", "circulation05"))
        papers.append(point(year, titles, "set-as-two", "circulation05"))
    if spread_copies[-1]["value"] != 28244000:
        raise SystemExit(spread_copies[-1])
    if abs(spread_copies[-1]["value"] - exact_two) >= 1000:
        raise SystemExit("thousands rounding")

    channels = {key: [] for key in ("home", "shop", "mail", "other")}
    for year, row in reversed(delivery):
        if abs(sum(row) - 100) > 0.06:
            raise SystemExit(f"{year} delivery {sum(row)}")
        for key, value in zip(channels, row):
            channels[key].append(point(year, value, "delivery", "circulation03"))

    pref = (RAW / "circulation02.html").read_text("utf-8-sig")
    national = re.search(r"<td>\s*24,868,122\s*</td>", pref)
    if not national:
        raise SystemExit("prefecture national total")

    payload = {
        "question": "日本人は新聞をどれだけ取ってきたか",
        "yearStart": 1965,
        "yearEnd": 2025,
        "setAsOne": series,
        "setAsTwo": {
            "copies": spread_copies,
            "perThousandPeople": per_thousand,
            "titles": papers,
            "exact2025": exact_two,
        },
        "delivery": channels,
        "prefecture": {"year": 2025, "nationalTotal": 24868122, "pastYears": None},
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    total = series["total"]
    peak = max(total, key=lambda row: row["value"])
    print("years", len(total), "peak", peak["year"], peak["value"], "2025", total[-1]["value"])
    print("wrote", OUT)


if __name__ == "__main__":
    main()
