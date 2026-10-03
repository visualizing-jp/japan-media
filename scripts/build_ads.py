#!/usr/bin/env python3
"""Build Dentsu ad-spend series from yearly HTML tables. No back-calculation."""

from __future__ import annotations

import json
import re
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "ads" / "raw"
OUT = ROOT / "data" / "ads" / "series.json"

EIGHT = ["mass", "newspaper", "magazine", "radio", "tvSeparate", "satelliteSeparate", "internet", "promotion"]
NINE = ["mass", "newspaper", "magazine", "radio", "tvMedia", "terrestrial", "satelliteInTv", "internet", "promotion"]


class TableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.skip = 0
        self.tables: list[list[list[str]]] = []
        self.cur: list[list[str]] | None = None
        self.row: list[str] | None = None
        self.cell: list[str] | None = None
        self.in_cell = False

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.skip += 1
        if self.skip:
            return
        if tag == "table":
            self.cur = []
        elif tag == "tr" and self.cur is not None:
            self.row = []
        elif tag in ("td", "th") and self.row is not None:
            self.cell = []
            self.in_cell = True
        elif tag == "br" and self.in_cell and self.cell is not None:
            self.cell.append(" ")

    def handle_endtag(self, tag):
        if tag in ("script", "style") and self.skip:
            self.skip -= 1
            return
        if self.skip:
            return
        if tag in ("td", "th") and self.in_cell and self.row is not None and self.cell is not None:
            self.row.append(re.sub(r"\s+", " ", "".join(self.cell)).strip())
            self.in_cell = False
        elif tag == "tr" and self.row is not None and self.cur is not None:
            if any(self.row):
                self.cur.append(self.row)
            self.row = None
        elif tag == "table" and self.cur is not None:
            if self.cur:
                self.tables.append(self.cur)
            self.cur = None

    def handle_data(self, data):
        if self.in_cell and not self.skip and self.cell is not None:
            self.cell.append(data)


def publication_year(name: str) -> int | None:
    match = re.search(r"(20\d{2})", name)
    return int(match.group(1)) if match else None


def parse_year(cell: str, anchor: int | None) -> int | None:
    full = re.search(r"(20\d{2}|19\d{2})年", cell)
    if full:
        return int(full.group(1))
    short = re.match(r"(\d{2})年", cell.strip())
    era = re.search(r"[（(]\s*(\d{1,2})年\s*[）)]", cell)
    if short and era:
        western = int(short.group(1))
        heisei = 1988 + int(era.group(1))
        reiwa = 2018 + int(era.group(1))
        if heisei % 100 == western and 1989 <= heisei <= 2019:
            return heisei
        if reiwa % 100 == western and reiwa >= 2019:
            return reiwa
    if short and anchor:
        year = (anchor // 100) * 100 + int(short.group(1))
        if year < anchor:
            year += 100
        if 1990 <= year <= 2026:
            return year
    return None


def money(cell: str) -> list[int]:
    if "年" in cell:
        return []
    return [int(token.replace(",", "")) for token in re.findall(r"[（(]\s*([0-9][0-9,]*)\s*[）)]", cell)]


def bare_money(cell: str) -> list[int]:
    stripped = re.sub(r"[（(]\s*[0-9,]+\s*[）)]", "", cell)
    return [int(token.replace(",", "")) for token in re.findall(r"[0-9]{1,3}(?:,[0-9]{3})+", stripped)]


def point(year: int, value: int, segment: str, source: str) -> dict:
    return {"year": year, "value": value, "segment": segment, "source": source}


def main() -> None:
    totals: dict[int, tuple[int, int]] = {}
    media: dict[int, list[int]] = {}
    for path in sorted(RAW.glob("*.html")):
        pub = publication_year(path.name)
        if pub is None or "media" in path.name:
            continue
        parser = TableParser()
        parser.feed(path.read_text("utf-8-sig"))
        for table in parser.tables:
            anchor = None
            for row in table:
                year = parse_year(row[0], anchor)
                if year is None:
                    continue
                anchor = year
                amounts: list[int] = []
                plain: list[int] = []
                for cell in row[1:]:
                    amounts += money(cell)
                    plain += [value for value in bare_money(cell) if value >= 1000]
                if plain:
                    previous = totals.get(year)
                    if previous is None or pub >= previous[1]:
                        totals[year] = (plain[0], pub)
                if amounts and year == pub:
                    media[year] = amounts

    for year in range(2010, 2026):
        if year not in media:
            raise SystemExit(f"missing media {year}")
        width = 8 if year <= 2013 else 9
        if len(media[year]) != width:
            raise SystemExit(f"{year} width {len(media[year])} {media[year]}")

    series: dict[str, list[dict]] = {}

    def add(key: str, year: int, value: int, segment: str, source: str) -> None:
        series.setdefault(key, []).append(point(year, value, segment, source))

    for year in range(2005, 2026):
        if year not in totals:
            raise SystemExit(f"missing total {year}")
        value, pub = totals[year]
        add("total", year, value, "from-2005", f"ad-{pub}")

    for year, amounts in sorted(media.items()):
        source = f"ad-{year}"
        if year <= 2013:
            named = dict(zip(EIGHT, amounts))
            if named["newspaper"] + named["magazine"] + named["radio"] + named["tvSeparate"] != named["mass"]:
                raise SystemExit(f"{year} mass {named}")
            parts = named["mass"] + named["satelliteSeparate"] + named["internet"] + named["promotion"]
            if parts != totals[year][0]:
                raise SystemExit(f"{year} total {parts} != {totals[year]}")
            add("newspaper", year, named["newspaper"], "stable", source)
            add("magazine", year, named["magazine"], "stable", source)
            add("radio", year, named["radio"], "stable", source)
            add("tvSeparate", year, named["tvSeparate"], "tv-without-satellite", source)
            add("satelliteSeparate", year, named["satelliteSeparate"], "satellite-separate", source)
            add("mass", year, named["mass"], "mass-without-satellite", source)
        else:
            named = dict(zip(NINE, amounts))
            if named["terrestrial"] + named["satelliteInTv"] != named["tvMedia"]:
                raise SystemExit(f"{year} tv {named}")
            if named["newspaper"] + named["magazine"] + named["radio"] + named["tvMedia"] != named["mass"]:
                raise SystemExit(f"{year} mass {named}")
            parts = named["mass"] + named["internet"] + named["promotion"]
            if parts != totals[year][0]:
                raise SystemExit(f"{year} total {parts} != {totals[year]}")
            add("newspaper", year, named["newspaper"], "stable", source)
            add("magazine", year, named["magazine"], "stable", source)
            add("radio", year, named["radio"], "stable", source)
            add("tvMedia", year, named["tvMedia"], "tv-media", source)
            add("terrestrial", year, named["terrestrial"], "terrestrial", source)
            add("satelliteInTv", year, named["satelliteInTv"], "satellite-in-tv", source)
            add("mass", year, named["mass"], "mass-with-satellite", source)
        net_segment = "net-before-2018" if year <= 2017 else "net-2018" if year == 2018 else "net-from-2019"
        promo_segment = "promo-before-2019" if year <= 2018 else "promo-from-2019"
        add("internet", year, named["internet"], net_segment, source)
        add("promotion", year, named["promotion"], promo_segment, source)

    payload = {
        "question": "広告費はどの媒体に流れてきたか",
        "unit": "億円",
        "totalYearStart": 2005,
        "totalYearEnd": 2025,
        "mediaYearStart": 2010,
        "mediaYearEnd": 2025,
        "series": series,
        "unconfirmed": [
            "2005–2009年の媒体別の億円。総広告費の列だけがある。",
            "2012年と2013年について、2014年の遡及後のテレビメディアの億円。その年のページの括弧は衛星を別掲にした金額で、後年の表は前年比だけ。",
            "1947–2004年。2000–2004年の総広告費は2012年ページにあるが、2007年の推定範囲の改定は2005年までなので同じ線に入れない。",
        ],
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("total", series["total"][0], series["total"][-1])
    print("internet", [(row["year"], row["value"], row["segment"]) for row in series["internet"]])
    print("wrote", OUT)


if __name__ == "__main__":
    main()
