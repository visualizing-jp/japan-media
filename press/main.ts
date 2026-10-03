import "../shared/theme.css";
import series from "../data/press/series.json";
import { formatCount, mountChart, type Series } from "../shared/chart";
import { hosts, siteHref } from "../shared/hosts";
import { mountMarks } from "../shared/mark";
import { mountViews, parseOff, readYear, showView, spanYears, writeOff, writeYear } from "../shared/query";

type Point = { year: number; value: number; segment: string; source: string };

const data = series as {
  yearStart: number;
  yearEnd: number;
  setAsOne: Record<string, Point[]>;
  setAsTwo: {
    copies: Point[];
    perThousandPeople: Point[];
    titles: Point[];
    exact2025: number;
  };
  delivery: Record<string, Point[]>;
  prefecture: { year: number; nationalTotal: number; pastYears: null };
};

const one = data.setAsOne;

function line(id: string, name: string, short: string, color: string, points: Point[]): Series {
  return { id, name, short, color, points };
}

const stackSeries = [
  line("general", "一般紙", "一般紙", "#22211e", one.general),
  line("sports", "スポーツ紙", "スポーツ紙", "#b0392a", one.sports),
];
const formSeries = [
  line("set", "セット", "セット", "#8d6a4a", one.set),
  line("morning", "朝刊単独", "朝刊単独", "#22211e", one.morning),
  line("evening", "夕刊単独", "夕刊単独", "#2f527a", one.evening),
];
const perSeries = [line("per", "1世帯あたり部数", "1世帯あたり", "#22211e", one.perHousehold)];
const twoSeries = [line("two", "セットを2部とした発行部数", "2部計算", "#5c564c", data.setAsTwo.copies)];
const deliverySeries = [
  line("home", "戸別配達", "戸別", "#22211e", data.delivery.home),
  line("shop", "即売", "即売", "#b0392a", data.delivery.shop),
  line("mail", "郵送", "郵送", "#2f527a", data.delivery.mail),
  line("other", "その他", "その他", "#8a8178", data.delivery.other),
];

document.querySelectorAll<HTMLAnchorElement>("[data-home]").forEach((home) => {
  home.href = siteHref("index");
});
document.querySelectorAll("[data-domain]").forEach((domain) => {
  domain.textContent = hosts.press;
});
mountMarks();

function at(points: Point[], year: number) {
  return points.find((point) => point.year === year);
}

const peak = one.total.reduce((best, point) => (point.value > best.value ? point : best));
const lede = document.querySelector("#lede");
if (lede) {
  const now = at(one.total, 2025);
  const per = at(one.perHousehold, 2025);
  lede.textContent = `セットを1部とすると、発行部数が最も多かったのは${peak.year}年の${formatCount(peak.value)}。2025年10月は${formatCount(now?.value ?? 0)}で、1世帯あたり${per?.value ?? ""}部。`;
}

function renderReadout(year: number) {
  const box = document.querySelector("#readout");
  if (!box) return;
  box.replaceChildren();
  const yearEl = document.createElement("span");
  yearEl.className = "year";
  yearEl.textContent = `${year}年`;
  const total = document.createElement("span");
  total.innerHTML = `<b>合計 ${formatCount(at(one.total, year)?.value ?? 0)}</b>`;
  box.append(yearEl, total);
  for (const [id, label] of [
    ["general", "一般紙"],
    ["sports", "スポーツ紙"],
  ] as const) {
    const bit = document.createElement("span");
    bit.textContent = `${label} ${formatCount(at(one[id], year)?.value ?? 0)}`;
    box.append(bit);
  }
}

const pressViews = [
  { id: "copies", label: "部数", hint: "1965–2025", series: stackSeries, host: "#stack", mode: "stack" as const, unit: "count" as const, start: data.yearStart, end: data.yearEnd, steps: undefined as number[] | undefined, notes: [] as { year: number; label: string }[] },
  { id: "form", label: "セット", hint: "1965–2025", series: formSeries, host: "#forms", mode: "line" as const, unit: "count" as const, start: data.yearStart, end: data.yearEnd, steps: undefined, notes: [] },
  { id: "household", label: "世帯", hint: "1965–2025", series: perSeries, host: "#per", mode: "line" as const, unit: "rate" as const, start: data.yearStart, end: data.yearEnd, steps: undefined, notes: [{ year: 2014, label: "世帯数の時点" }] },
  { id: "double", label: "2部", hint: "2000–2025", series: twoSeries, host: "#two", mode: "line" as const, unit: "count" as const, start: 2000, end: 2025, steps: undefined, notes: [] },
  { id: "delivery", label: "届け方", hint: "2000–2025", series: deliverySeries, host: "#delivery", mode: "line" as const, unit: "rate" as const, start: 2000, end: 2025, steps: undefined, notes: [] },
];
const views = mountViews(document.querySelector("#views")!, pressViews.map(({ id, label, hint }) => ({ id, label, hint })));
showView(views.id);

function specOf(id: string) {
  return pressViews.find((view) => view.id === id) ?? pressViews[0];
}
function yearsOf(id: string) {
  const spec = specOf(id);
  return spanYears(spec.start, spec.end);
}

const initial = specOf(views.id);
const initialOff = parseOff(initial.series.map((series) => series.id));
if (initialOff === null) writeOff([]);
const hidden = initialOff ?? [];
const initialYear = readYear(yearsOf(views.id));

const charts = new Map<string, { setYear: (year: number) => void; setHidden: (ids: string[]) => void }>();
for (const spec of pressViews) {
  const active = spec.id === views.id;
  const chart = mountChart(document.querySelector(spec.host)!, {
    series: spec.series,
    yearStart: spec.start,
    yearEnd: spec.end,
    mode: spec.mode,
    unit: spec.unit,
    year: active ? initialYear : spec.end,
    hidden: active ? hidden : [],
    annotations: spec.notes,
    onYear(year) {
      if (spec.id === "copies") renderReadout(year);
      if (views.id === spec.id) writeYear(year, yearsOf(spec.id));
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
  const year = readYear(yearsOf(views.id));
  const off = parseOff(spec.series.map((series) => series.id));
  const next = off ?? [];
  if (off === null) writeOff([]);
  const chart = charts.get(views.id);
  chart?.setYear(year);
  chart?.setHidden(next);
});

const notes = [
  "部数は各年10月、日本新聞協会経営業務部調べ。最初の図と「セット、朝刊、夕刊」は、朝夕刊セットを1部として数える。",
  "一般紙とスポーツ紙の和は、合計と一致する。セット、朝刊単独、夕刊単独の和も合計と一致する。",
  `セットを朝刊と夕刊に分けて数えると、2025年10月は${formatCount(data.setAsTwo.exact2025)}。これはセット部数を合計にもう一度足した数と一致する。普及度の表は同じ数え方で、単位が千部。2025年は${((data.setAsTwo.copies.find((point) => point.year === 2025)?.value ?? 0) / 1000).toLocaleString("ja-JP")}千部。上の図とはつなげない。`,
  "1世帯あたり部数は、合計を世帯数で割った公表値。世帯数は2014年から1月1日、2013年までは3月31日の住民基本台帳。線はその年で切る。部数そのものは切らない。",
  "戸別配達、即売、郵送、その他は2000–2025年の全国計で、割合の単位は％。四つを足すと100になる。",
  "都道府県別は2025年10月の表だけがある。全国計はセットを1部とした発行部数と同じ。都道府県の過去年は、このページにはない。",
  "普及度の表は2000–2025年が同じ注記で、途中から数え方が変わった年は確認できていない。切れ目の年は置かない。",
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
  lead.textContent = "出典　日本新聞協会「調査データ」";
  const reprint = document.createElement("p");
  reprint.textContent = "転載は日本新聞協会への連絡が必要。";
  const ul = document.createElement("ul");
  const links: [string, string][] = [
    ["https://pressnet.or.jp/data/circulation/circulation01.php", "発行部数と世帯数（1965–2025年、セットは1部）"],
    ["https://pressnet.or.jp/data/circulation/circulation05.php", "発行部数と普及度（2000–2025年、セットは2部）"],
    ["https://pressnet.or.jp/data/circulation/circulation03.php", "戸別配達率（2000–2025年）"],
    ["https://www.pressnet.or.jp/data/circulation/circulation02.html", "都道府県別発行部数（2025年10月）"],
  ];
  for (const [href, label] of links) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = href;
    a.textContent = label;
    li.append(a);
    ul.append(li);
  }
  source.append(lead, reprint, ul);
}

const columns = [
  ["total", "合計"],
  ["general", "一般紙"],
  ["sports", "スポーツ紙"],
  ["set", "セット"],
  ["morning", "朝刊単独"],
  ["evening", "夕刊単独"],
  ["perHousehold", "1世帯あたり"],
  ["households", "世帯数"],
] as const;

const table = document.querySelector("#table");
if (table) {
  const head = document.createElement("thead");
  const hr = document.createElement("tr");
  hr.append(Object.assign(document.createElement("th"), { textContent: "年" }));
  for (const [, label] of columns) hr.append(Object.assign(document.createElement("th"), { textContent: label }));
  head.append(hr);
  const body = document.createElement("tbody");
  for (let year = data.yearStart; year <= data.yearEnd; year++) {
    const tr = document.createElement("tr");
    tr.append(Object.assign(document.createElement("td"), { textContent: String(year) }));
    for (const [id] of columns) {
      const td = document.createElement("td");
      const point = at(one[id], year);
      td.textContent = point
        ? id === "perHousehold"
          ? String(point.value)
          : point.value.toLocaleString("ja-JP")
        : "";
      if (!point) td.className = "gap";
      tr.append(td);
    }
    body.append(tr);
  }
  table.append(head, body);
}
