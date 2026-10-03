import "../shared/theme.css";
import series from "../data/time/series.json";
import { formatMinutes, mountChart, type Series } from "../shared/chart";
import { hosts, siteHref } from "../shared/hosts";
import { mountMarks } from "../shared/mark";
import { mountViews, parseOff, readYear, showView, writeOff, writeYear } from "../shared/query";

type Point = { year: number; value: number; segment: string; source: string; sheet?: string };

const data = series as {
  nhk: Record<string, Point[]>;
  soumu: Record<string, Point[]>;
};

const nhkSpec = [
  ["tv", "テレビ", "テレビ", "#22211e"],
  ["radio", "ラジオ", "ラジオ", "#5c564c"],
  ["newspaper", "新聞", "新聞", "#8d6a4a"],
  ["magazineEarly", "雑誌・マンガ（1995–2000）", "雑誌・マンガ", "#b0392a"],
  ["magazineLater", "雑誌・マンガ・本（2005–）", "雑誌・本", "#c46a4a"],
  ["internet", "趣味・娯楽・教養のインターネット（2005–2015）", "ネット", "#2f527a"],
  ["internetExVideo", "同（動画除く、2020–）", "動画除く", "#6a8cae"],
  ["onlineVideo", "インターネット動画（2020–）", "動画", "#1f4d3a"],
  ["mediaContact", "マスメディア接触", "マスメディア接触", "#8a8178"],
] as const;

const soumuSpec = [
  ["tvLive", "テレビ（リアルタイム）", "テレビ", "#22211e"],
  ["tvRecorded", "録画したテレビ番組", "録画", "#8a8178"],
  ["internet", "インターネット（すべて）", "ネット", "#2f527a"],
  ["newspaper", "新聞", "新聞", "#8d6a4a"],
  ["radio", "ラジオ", "ラジオ", "#5c564c"],
  ["magazine", "雑誌（書籍・コミックを除く）", "雑誌", "#b0392a"],
] as const;

function toSeries(spec: readonly (readonly [string, string, string, string])[], bag: Record<string, Point[]>): Series[] {
  return spec.map(([id, name, short, color]) => ({
    id,
    name,
    short,
    color,
    points: bag[id] ?? [],
  }));
}

const nhkSeries = toSeries(nhkSpec, data.nhk);
const soumuSeries = toSeries(soumuSpec, data.soumu);
const nhkYears = [...new Set(data.nhk.tv.map((point) => point.year))].sort((a, b) => a - b);
const soumuYears = data.soumu.tvLive.map((point) => point.year);

document.querySelectorAll<HTMLAnchorElement>("[data-home]").forEach((home) => {
  home.href = siteHref("index");
});
document.querySelectorAll("[data-domain]").forEach((domain) => {
  domain.textContent = hosts.time;
});
mountMarks();

function at(bag: Record<string, Point[]>, id: string, year: number) {
  return bag[id]?.find((point) => point.year === year);
}

function peak(points: Point[]) {
  return points.reduce((best, point) => (point.value > best.value ? point : best));
}

const tvPeak = peak(data.nhk.tv);
const lede = document.querySelector("#lede");
if (lede) {
  const tv2025 = at(data.nhk, "tv", 2025)?.value;
  const net2012 = at(data.soumu, "internet", 2012)?.value;
  const net2025 = at(data.soumu, "internet", 2025)?.value;
  const live2012 = at(data.soumu, "tvLive", 2012)?.value;
  const live2025 = at(data.soumu, "tvLive", 2025)?.value;
  lede.textContent = `NHKの平日・国民全体では、テレビの全員平均が最も長かったのは${tvPeak.year}年の${formatMinutes(tvPeak.value)}。2025年は${formatMinutes(tv2025 ?? 0)}。総務省の13–69歳では、平日のインターネットが2012年の${formatMinutes(net2012 ?? 0)}から2025年の${formatMinutes(net2025 ?? 0)}になり、リアルタイムのテレビは${formatMinutes(live2012 ?? 0)}から${formatMinutes(live2025 ?? 0)}になった。二つの調査は別の数字で、つないでいない。`;
}

function renderReadout(hostId: string, year: number, spec: readonly (readonly [string, string, string, string])[], bag: Record<string, Point[]>) {
  const box = document.querySelector(`#${hostId}`);
  if (!box) return;
  box.replaceChildren();
  const yearEl = document.createElement("span");
  yearEl.className = "year";
  yearEl.textContent = `${year}年`;
  box.append(yearEl);
  const present = spec
    .map(([id, , short]) => ({ short, point: at(bag, id, year) }))
    .filter((row): row is { short: string; point: Point } => Boolean(row.point));
  if (!present.length) {
    const miss = document.createElement("span");
    miss.className = "miss";
    miss.textContent = "この年の調査はない";
    box.append(miss);
    return;
  }
  for (const row of present) {
    const bit = document.createElement("span");
    bit.textContent = `${row.short} ${formatMinutes(row.point.value)}`;
    box.append(bit);
  }
}

const views = mountViews(document.querySelector("#views")!, [
  { id: "nhk", label: "NHK", hint: "1995–2025" },
  { id: "soumu", label: "総務省", hint: "2012–2025" },
]);
showView(views.id);

function idsOf(id: string) {
  return (id === "nhk" ? nhkSeries : soumuSeries).map((series) => series.id);
}
function yearsOf(id: string) {
  return id === "nhk" ? nhkYears : soumuYears;
}

const initialIds = idsOf(views.id);
const initialOff = parseOff(initialIds);
if (initialOff === null) writeOff([]);
const hidden = initialOff ?? [];
const initialYear = readYear(yearsOf(views.id));

const nhkChart = mountChart(document.querySelector("#nhk")!, {
  series: nhkSeries,
  yearStart: nhkYears[0],
  yearEnd: nhkYears[nhkYears.length - 1],
  steps: nhkYears,
  mode: "line",
  unit: "minute",
  year: views.id === "nhk" ? initialYear : nhkYears[nhkYears.length - 1],
  hidden: views.id === "nhk" ? hidden : [],
  annotations: [
    { year: 2005, label: "ネットを分割" },
    { year: 2020, label: "動画を分割" },
  ],
  onYear(year) {
    renderReadout("nhk-readout", year, nhkSpec, data.nhk);
    if (views.id === "nhk") writeYear(year, nhkYears);
  },
  onHidden(ids) {
    if (views.id === "nhk") writeOff(ids);
  },
});

const soumuChart = mountChart(document.querySelector("#soumu")!, {
  series: soumuSeries,
  yearStart: soumuYears[0],
  yearEnd: soumuYears[soumuYears.length - 1],
  mode: "line",
  unit: "minute",
  year: views.id === "soumu" ? initialYear : soumuYears[soumuYears.length - 1],
  hidden: views.id === "soumu" ? hidden : [],
  annotations: [{ year: 2024, label: "参考表の13–69歳" }],
  onYear(year) {
    renderReadout("soumu-readout", year, soumuSpec, data.soumu);
    if (views.id === "soumu") writeYear(year, soumuYears);
  },
  onHidden(ids) {
    if (views.id === "soumu") writeOff(ids);
  },
});

views.onChange(() => {
  showView(views.id);
  const years = yearsOf(views.id);
  const ids = idsOf(views.id);
  const year = readYear(years);
  const off = parseOff(ids);
  const next = off ?? [];
  if (off === null) writeOff([]);
  const chart = views.id === "nhk" ? nhkChart : soumuChart;
  chart.setYear(year);
  chart.setHidden(next);
});

void nhkChart;
void soumuChart;

const notes = [
  "時間は分。NHKは「全員平均時間量（時間:分）」を分に直した整数。総務省は日記式集計の平均時間で、公表値の小数第一位のまま。",
  "NHKは平日・層「国民全体」だけ。CSVに国民全体の年齢の下限と上限は書いていないので、ここには書かない。土曜と日曜は載せていない。",
  "調査年は1995、2000、2005、2010、2015、2020、2025。間の年は補わない。",
  "2005年に「趣味・娯楽・教養のインターネット」が分かれた。1995年と2000年のCSVにこの行為はない。線は2005年から。",
  "2020年にインターネット動画が分かれ、残りは「趣味・娯楽・教養のインターネット（動画除く）」。2005–2015年のインターネットとはつなげない。二つを足して一本にも戻さない。",
  "雑誌は1995年と2000年が「雑誌・マンガ」、2005年以降が「雑誌・マンガ・本」。本が加わるので、線は切る。",
  "「マスメディア接触」は公表されている全員平均で、上の行為の合計ではない。ながら見があるので、内訳を足しても一致しない。",
  "総務省は「情報通信メディアの利用時間と情報行動に関する調査」の平日。つなぐのは13–69歳。2012–2023年は平日の主表（70代の表は混ぜない）。2024年と2025年の主表は全年代（13–79歳）なので、連続には「参考」の13–69歳・平日を使う。",
  "令和2–5年度の全年代は70代を入れて計算し直されており、それ以前の報告書と一致しないことがある。その全年代は線に入れていない。",
  "総務省の行為は、テレビ（リアルタイム）視聴、録画したテレビ番組を見る、ネット利用（全てのインターネット利用）、新聞閲読、ラジオ聴取、雑誌（書籍、コミックを除く）。汎テレビやテレビ受像器だけの行は使わない。",
  "社会生活基本調査は入れていない。NHKと総務省も、同じ年でも標本と定義が違うので一本にしない。",
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
  source.innerHTML = `
    <div>出典　NHK放送文化研究所「国民生活時間調査」、総務省「情報通信メディアの利用時間と情報行動に関する調査」</div>
    <ul>
      <li><a href="https://www.nhk.or.jp/bunken/yoron-jikan/">国民生活時間調査（1995年以降のCSV）</a></li>
      <li><a href="https://www.soumu.go.jp/iicp/research/results/media_usage-time.html">情報通信メディアの利用時間と情報行動に関する調査　結果一覧</a></li>
      <li><a href="https://www.soumu.go.jp/main_content/001079136.pdf">令和7年度　結果の概要</a>　<a href="https://www.soumu.go.jp/main_content/001079141.pdf">令和7年度　報告書</a></li>
    </ul>
  `;
}

function fillTable(
  table: HTMLTableElement,
  spec: readonly (readonly [string, string, string, string])[],
  bag: Record<string, Point[]>,
  years: number[],
) {
  const head = document.createElement("thead");
  const hr = document.createElement("tr");
  hr.append(Object.assign(document.createElement("th"), { textContent: "年" }));
  for (const [, , short] of spec) {
    hr.append(Object.assign(document.createElement("th"), { textContent: short }));
  }
  head.append(hr);
  const body = document.createElement("tbody");
  for (const year of years) {
    const tr = document.createElement("tr");
    tr.append(Object.assign(document.createElement("td"), { textContent: String(year) }));
    for (const [id] of spec) {
      const td = document.createElement("td");
      const point = at(bag, id, year);
      if (!point) {
        td.textContent = "";
        td.className = "gap";
      } else {
        td.textContent = formatMinutes(point.value).replace("分", "");
      }
      tr.append(td);
    }
    body.append(tr);
  }
  table.append(head, body);
}

const nhkTable = document.querySelector<HTMLTableElement>("#nhk-table");
const soumuTable = document.querySelector<HTMLTableElement>("#soumu-table");
if (nhkTable) fillTable(nhkTable, nhkSpec, data.nhk, nhkYears);
if (soumuTable) fillTable(soumuTable, soumuSpec, data.soumu, soumuYears);
