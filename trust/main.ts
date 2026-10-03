import "../shared/theme.css";
import series from "../data/trust/series.json";
import { mountChart, type Series } from "../shared/chart";
import { hosts, siteHref } from "../shared/hosts";
import { mountMarks } from "../shared/mark";
import { mountViews, parseOff, readYear, showView, spanYears, writeOff, writeYear } from "../shared/query";

type Point = { year: number; value: number; segment: string; source: string };
type Round = { round: number; year: number; fieldwork: string; released: string; pdf: string; file: string };

const data = series as {
  yearStart: number;
  yearEnd: number;
  index: string;
  scale: string;
  excluded: string;
  unconfirmed: string[];
  rounds: Round[];
  series: Record<string, Point[]>;
};

const bag = data.series;

function line(id: string, name: string, color: string): Series {
  return { id, name, short: name, color, points: bag[id] ?? [] };
}

const lines = [
  line("nhk", "NHKテレビ", "#22211e"),
  line("newspaper", "新聞", "#8d6a4a"),
  line("commercial", "民放テレビ", "#2f527a"),
  line("radio", "ラジオ", "#5c564c"),
  line("internet", "インターネット", "#b0392a"),
  line("magazine", "雑誌", "#8a8178"),
];

document.querySelectorAll<HTMLAnchorElement>("[data-home]").forEach((home) => {
  home.href = siteHref("index");
});
document.querySelectorAll("[data-domain]").forEach((domain) => {
  domain.textContent = hosts.trust;
});
mountMarks();

function at(id: string, year: number) {
  return bag[id]?.find((point) => point.year === year);
}
function point(value: number) {
  return `${value.toFixed(1)}点`;
}

const lede = document.querySelector("#lede");
if (lede) {
  const last = data.yearEnd;
  const first = data.yearStart;
  lede.textContent = `${last}年の実査ではNHKテレビが${point(at("nhk", last)?.value ?? 0)}、新聞が${point(at("newspaper", last)?.value ?? 0)}。${first}年はNHKテレビが${point(at("nhk", first)?.value ?? 0)}、新聞が${point(at("newspaper", first)?.value ?? 0)}、インターネットが${point(at("internet", first)?.value ?? 0)}。${data.scale}。`;
}

function render(year: number) {
  const box = document.querySelector("#readout");
  if (!box) return;
  box.replaceChildren();
  const yearEl = document.createElement("span");
  yearEl.className = "year";
  yearEl.textContent = `${year}年`;
  box.append(yearEl);
  const present = lines.filter((item) => at(item.id, year));
  if (!present.length) {
    const miss = document.createElement("span");
    miss.className = "miss";
    miss.textContent = "この年の総数の得点はない";
    box.append(miss);
    return;
  }
  for (const item of present) {
    const bit = document.createElement("span");
    bit.textContent = `${item.short} ${point(at(item.id, year)!.value)}`;
    box.append(bit);
  }
}

const trustYears = spanYears(data.yearStart, data.yearEnd);
const seriesIds = lines.map((series) => series.id);
const views = mountViews(document.querySelector("#views")!, [
  { id: "score", label: "信頼度", hint: "2008–2025" },
]);
showView(views.id);
const initialOff = parseOff(seriesIds);
if (initialOff === null) writeOff([]);
const hidden = initialOff ?? [];
const initialYear = readYear(trustYears);

mountChart(document.querySelector("#chart")!, {
  series: lines,
  yearStart: data.yearStart,
  yearEnd: data.yearEnd,
  mode: "line",
  unit: "point",
  year: initialYear,
  hidden,
  onYear(year) {
    render(year);
    writeYear(year, trustYears);
  },
  onHidden(ids) {
    writeOff(ids);
  },
});

const notes = [
  "対象は全国の18歳以上。層化二段無作為抽出で、調査票を配布して回収している。各回の総数の行だけを置いた。",
  "年は実施日の年。第1回は2008年12月、公表は2009年3月なので、グラフの年は2008年。",
  data.scale + "。この説明がどの年から変わったかは確認できない。確認できない年で線を切っていない。",
  data.excluded + "は、別の調査なので入れていない。",
  "媒体の並びが回によって入れ替わっても、見出しの名前に点数を対応させている。後年の図から過去の点を写していない。",
];
const list = document.querySelector("#notes");
if (list) {
  for (const text of notes) {
    const li = document.createElement("li");
    li.textContent = text;
    list.append(li);
  }
}

const source = document.querySelector("#source");
if (source) {
  const lead = document.createElement("div");
  lead.textContent = "出典：新聞通信調査会「メディアに関する全国世論調査」";
  const ul = document.createElement("ul");
  const index = document.createElement("li");
  const indexLink = document.createElement("a");
  indexLink.href = data.index;
  indexLink.textContent = "世論調査の一覧";
  index.append(indexLink);
  ul.append(index);
  for (const round of data.rounds) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = round.pdf;
    a.textContent = `第${round.round}回（実査${round.year}年、${round.fieldwork}）`;
    li.append(a);
    ul.append(li);
  }
  source.append(lead, ul);
}

const table = document.querySelector("#table");
if (table) {
  const head = document.createElement("thead");
  const hr = document.createElement("tr");
  hr.append(Object.assign(document.createElement("th"), { textContent: "年" }));
  for (const item of lines) hr.append(Object.assign(document.createElement("th"), { textContent: item.name }));
  head.append(hr);
  const body = document.createElement("tbody");
  for (let year = data.yearStart; year <= data.yearEnd; year++) {
    const tr = document.createElement("tr");
    tr.append(Object.assign(document.createElement("td"), { textContent: String(year) }));
    for (const item of lines) {
      const value = at(item.id, year);
      const td = document.createElement("td");
      if (value) td.textContent = value.value.toFixed(1);
      else {
        td.className = "gap";
        td.textContent = "—";
      }
      tr.append(td);
    }
    body.append(tr);
  }
  table.append(head, body);
}
