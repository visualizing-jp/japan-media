import "./shared/theme.css";
import spend from "./data/kakei/series.json";
import time from "./data/time/series.json";
import press from "./data/press/series.json";
import ads from "./data/ads/series.json";
import trust from "./data/trust/series.json";
import { siteHref, type SiteSlug } from "./shared/hosts";
import { mountMarks } from "./shared/mark";

type Point = { year: number };

function span(points: Point[]) {
  const years = points.map((point) => point.year);
  return `${Math.min(...years)}–${Math.max(...years)}`;
}

const nhkYears = span(time.nhk.tv);
const micYears = span(time.soumu.newspaper);

mountMarks();

const icons: Record<SiteSlug, { name: string; body: string }> = {
  spend: {
    name: "japanese-yen",
    body: `<path d="M12 9.5V21m0-11.5L6 3m6 6.5L18 3"/><path d="M6 15h12"/><path d="M6 11h12"/>`,
  },
  time: {
    name: "clock",
    body: `<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>`,
  },
  press: {
    name: "newspaper",
    body: `<path d="M15 18h-5"/><path d="M18 14h-8"/><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0v-9a2 2 0 0 1 2-2h2"/><rect width="8" height="4" x="10" y="6" rx="1"/>`,
  },
  ads: {
    name: "megaphone",
    body: `<path d="M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/><path d="M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14"/><path d="M8 6v8"/>`,
  },
  trust: {
    name: "shield-check",
    body: `<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>`,
  },
};

function cardIcon(slug: SiteSlug) {
  const spec = icons[slug];
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "card-icon");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("aria-hidden", "true");
  svg.dataset.icon = spec.name;
  svg.innerHTML = spec.body;
  return svg;
}

const items: { slug: SiteSlug; question: string; meta: string }[] = [
  { slug: "spend", question: spend.question, meta: `${spend.stat}　${spend.yearStart}–${spend.yearEnd}` },
  {
    slug: "time",
    question: time.question,
    meta: `NHK国民生活時間調査　${nhkYears}（5年ごと）　総務省　${micYears}`,
  },
  { slug: "press", question: press.question, meta: `日本新聞協会　${press.yearStart}–${press.yearEnd}` },
  {
    slug: "ads",
    question: ads.question,
    meta: `電通「日本の広告費」　総広告費 ${ads.totalYearStart}–${ads.totalYearEnd}　媒体別 ${ads.mediaYearStart}–${ads.mediaYearEnd}`,
  },
  { slug: "trust", question: trust.question, meta: `${trust.stat}　${trust.yearStart}–${trust.yearEnd}` },
];

const list = document.querySelector("#list");
if (list) {
  for (const item of items) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.className = "card";
    a.href = siteHref(item.slug);
    const art = document.createElement("div");
    art.className = "card-art";
    art.append(cardIcon(item.slug));
    const q = document.createElement("p");
    q.className = "card-title";
    q.textContent = item.question;
    const meta = document.createElement("p");
    meta.className = "card-meta";
    for (const part of item.meta.split("　")) {
      const bit = document.createElement("span");
      bit.textContent = part;
      if (/\d/.test(part)) bit.className = "tnum";
      meta.append(bit);
    }
    a.append(art, q, meta);
    li.append(a);
    list.append(li);
  }
}
