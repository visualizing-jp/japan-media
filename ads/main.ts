import "../shared/theme.css";
import series from "../data/ads/series.json";
import { mountChart, type Series } from "../shared/chart";
import { hosts, siteHref } from "../shared/hosts";
import { mountMarks } from "../shared/mark";
import { mountViews, parseOff, readYear, showView, spanYears, writeOff, writeYear } from "../shared/query";

type Point = { year: number; value: number; segment: string; source: string };

const data = series as {
  totalYearStart: number;
  totalYearEnd: number;
  mediaYearStart: number;
  mediaYearEnd: number;
  series: Record<string, Point[]>;
};

const bag = data.series;

function line(id: string, name: string, short: string, color: string): Series {
  return { id, name, short, color, points: bag[id] ?? [] };
}

const stackSeries = [
  line("newspaper", "新聞", "新聞", "#22211e"),
  line("magazine", "雑誌", "雑誌", "#8d6a4a"),
  line("radio", "ラジオ", "ラジオ", "#5c564c"),
  line("tvSeparate", "テレビ（衛星は別掲、2010–2013）", "テレビ", "#2f527a"),
  line("satelliteSeparate", "衛星メディア関連（2010–2013）", "衛星", "#6a8cae"),
  line("tvMedia", "テレビメディア（2014–）", "テレビメディア", "#1f4d3a"),
  line("internet", "インターネット", "ネット", "#b0392a"),
  line("promotion", "プロモーションメディア", "プロモーション", "#8a8178"),
];
const tvSeries = [
  line("terrestrial", "地上波テレビ", "地上波", "#22211e"),
  line("satelliteInTv", "衛星メディア関連", "衛星", "#2f527a"),
];
const totalSeries = [line("total", "総広告費", "総広告費", "#22211e")];

document.querySelectorAll<HTMLAnchorElement>("[data-home]").forEach((home) => {
  home.href = siteHref("index");
});
document.querySelectorAll("[data-domain]").forEach((domain) => {
  domain.textContent = hosts.ads;
});
mountMarks();

function at(id: string, year: number) {
  return bag[id]?.find((point) => point.year === year);
}
function oku(value: number) {
  return `${value.toLocaleString("ja-JP")}億円`;
}

const peak = bag.total.reduce((best, point) => (point.value > best.value ? point : best));
const lede = document.querySelector("#lede");
if (lede) {
  lede.textContent = `総広告費が最も大きかったのは${peak.year}年の${oku(peak.value)}。2025年は${oku(at("total", 2025)?.value ?? 0)}で、インターネットは${oku(at("internet", 2025)?.value ?? 0)}、新聞は${oku(at("newspaper", 2025)?.value ?? 0)}。単位は億円。`;
}

function render(hostId: string, year: number, ids: string[]) {
  const box = document.querySelector(`#${hostId}`);
  if (!box) return;
  box.replaceChildren();
  const yearEl = document.createElement("span");
  yearEl.className = "year";
  yearEl.textContent = `${year}年`;
  box.append(yearEl);
  const present = ids
    .map((id) => ({ id, point: at(id, year) }))
    .filter((row): row is { id: string; point: Point } => Boolean(row.point));
  if (!present.length) {
    const miss = document.createElement("span");
    miss.className = "miss";
    miss.textContent = "この年の媒体別の億円はない";
    box.append(miss);
    return;
  }
  for (const row of present) {
    const spec = stackSeries.find((item) => item.id === row.id) ?? totalSeries[0];
    const bit = document.createElement("span");
    bit.textContent = `${spec.short ?? spec.name} ${oku(row.point.value)}`;
    box.append(bit);
  }
}

const partIds = stackSeries.map((item) => item.id);
const adsViews = [
  { id: "total", label: "総額", hint: "2005–2025", series: totalSeries, host: "#total", start: data.totalYearStart, end: data.totalYearEnd, readout: ["total"], annotations: [] as { year: number; label: string }[] },
  { id: "media", label: "媒体", hint: "2010–2025", series: stackSeries, host: "#stack", start: data.mediaYearStart, end: data.mediaYearEnd, readout: partIds, annotations: [{ year: 2014, label: "テレビ" }, { year: 2018, label: "ネット" }, { year: 2019, label: "ECとイベント" }] },
  { id: "lines", label: "推移", hint: "2010–2025", series: stackSeries, host: "#lines", start: data.mediaYearStart, end: data.mediaYearEnd, readout: [] as string[], annotations: [] },
  { id: "tv", label: "テレビ", hint: "2014–2025", series: tvSeries, host: "#tv", start: 2014, end: 2025, readout: [] as string[], annotations: [] },
];
const views = mountViews(document.querySelector("#views")!, adsViews.map(({ id, label, hint }) => ({ id, label, hint })));
showView(views.id);

function specOf(id: string) {
  return adsViews.find((view) => view.id === id) ?? adsViews[0];
}

const initial = specOf(views.id);
const initialOff = parseOff(initial.series.map((series) => series.id));
if (initialOff === null) writeOff([]);
const hidden = initialOff ?? [];
const initialYear = readYear(spanYears(initial.start, initial.end));

const charts = new Map<string, { setYear: (year: number) => void; setHidden: (ids: string[]) => void }>();
for (const spec of adsViews) {
  const active = spec.id === views.id;
  const years = spanYears(spec.start, spec.end);
  const chart = mountChart(document.querySelector(spec.host)!, {
    series: spec.series,
    yearStart: spec.start,
    yearEnd: spec.end,
    mode: spec.id === "media" ? "stack" : "line",
    unit: "oku",
    year: active ? initialYear : spec.end,
    hidden: active ? hidden : [],
    annotations: spec.annotations,
    onYear(year) {
      if (spec.readout.length) render(spec.id === "media" ? "media-readout" : "total-readout", year, spec.readout);
      if (views.id === spec.id) writeYear(year, years);
    },
    onHidden(ids) {
      if (views.id === spec.id) writeOff(ids);
    },
  });
  charts.set(spec.id, chart);
}

views.onChange(() => {
  showView(views.id);
  const spec = specOf(views.id);
  const years = spanYears(spec.start, spec.end);
  const year = readYear(years);
  const off = parseOff(spec.series.map((series) => series.id));
  const next = off ?? [];
  if (off === null) writeOff([]);
  const chart = charts.get(views.id);
  chart?.setYear(year);
  chart?.setHidden(next);
});

const notes = [
  "金額は名目の億円。電通の推定。前年比からは逆算していない。括弧で億円が書いてある年だけを媒体別にした。",
  "総広告費は2005–2025年。2007年の推定範囲の改定は2005年まで遡る、と各年の注にある。2000–2004年の総広告費は2012年のページにもあるが、その改定の外なので線に入れていない。1947年からの一続きのファイルは、このサイトのHTMLにはなかった。",
  "2005–2009年の年次ページは取得できず、残っている表にも媒体別の億円の括弧がない。総広告費だけを置いた。",
  "2010–2013年のテレビは、衛星メディア関連を含まない。四つを足すとマスコミ四媒体になり、さらに衛星、インターネット、プロモーションを足すと総広告費になる。",
  "2014年からテレビはテレビメディア（地上波＋衛星）で、マスコミ四媒体に入る。注は2012年まで遡及したと書く。2012年と2013年の遡及後の億円は、後年の表では前年比だけで、括弧の金額はない。ここは空欄のまま。",
  "2018年のインターネットは、その年に初めて入れたマスコミ四媒体由来のデジタル広告費を含む。前年は仮推定で非開示、と2018年のページが書く。線は2017年と2018年のあいだで切る。",
  "2019年から、物販系ECプラットフォーム広告費をインターネットに、イベントをプロモーション側の展示・映像ほかに加えた。遡及はない。2018年の物販系ECは参考値で、2018年の広告費には含まれない。インターネットとプロモーションの線は2019年で切る。",
  "2025年の総広告費は、新聞・雑誌・ラジオ・テレビメディア・インターネット・プロモーションの和と一致する。テレビメディアは地上波と衛星の和と一致する。",
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
  lead.textContent = "出典：電通「日本の広告費」";
  const ul = document.createElement("ul");
  const links: [string, string][] = [
    ["https://www.dentsu.co.jp/knowledge/ad_cost/index.html", "日本の広告費の一覧"],
    ["https://www.dentsu.co.jp/knowledge/ad_cost/2025/index.html", "2025年 日本の広告費"],
    ["https://www.dentsu.co.jp/knowledge/ad_cost/2019/index.html", "2019年（物販系ECとイベントの追加）"],
    ["https://www.dentsu.co.jp/knowledge/ad_cost/2018/index.html", "2018年（マスコミ四媒体由来のデジタル広告費）"],
    ["https://www.dentsu.co.jp/knowledge/ad_cost/2014/index.html", "2014年（テレビメディア）"],
    ["https://www.dentsu.co.jp/knowledge/ad_cost/2010/index.html", "2010年（媒体別の億円が残る最初のページ）"],
  ];
  for (const [href, label] of links) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = href;
    a.textContent = label;
    li.append(a);
    ul.append(li);
  }
  source.append(lead, ul);
}

const columns = [
  ["total", "総広告費"],
  ["newspaper", "新聞"],
  ["magazine", "雑誌"],
  ["radio", "ラジオ"],
  ["tvSeparate", "テレビ（衛星別）"],
  ["satelliteSeparate", "衛星（別掲）"],
  ["tvMedia", "テレビメディア"],
  ["terrestrial", "地上波"],
  ["satelliteInTv", "衛星（内）"],
  ["internet", "インターネット"],
  ["promotion", "プロモーション"],
] as const;
const table = document.querySelector("#table");
if (table) {
  const head = document.createElement("thead");
  const hr = document.createElement("tr");
  hr.append(Object.assign(document.createElement("th"), { textContent: "年" }));
  for (const [, label] of columns) hr.append(Object.assign(document.createElement("th"), { textContent: label }));
  head.append(hr);
  const body = document.createElement("tbody");
  for (let year = data.totalYearStart; year <= data.totalYearEnd; year++) {
    const tr = document.createElement("tr");
    tr.append(Object.assign(document.createElement("td"), { textContent: String(year) }));
    for (const [id] of columns) {
      const td = document.createElement("td");
      const point = at(id, year);
      if (!point) {
        td.textContent = "";
        td.className = "gap";
      } else td.textContent = point.value.toLocaleString("ja-JP");
      tr.append(td);
    }
    body.append(tr);
  }
  table.append(head, body);
}
