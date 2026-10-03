export type Point = {
  year: number;
  value: number;
  segment: string;
  universe?: string;
  source?: string;
};

export type Series = {
  id: string;
  name: string;
  short?: string;
  color: string;
  points: Point[];
};

export type Annotation = { year: number; label: string };

export type ChartOptions = {
  series: Series[];
  yearStart: number;
  yearEnd: number;
  breaks?: number[];
  mode: "stack" | "line";
  unit?: "yen" | "minute" | "count" | "rate" | "oku" | "point";
  steps?: number[];
  year?: number;
  hidden?: string[];
  onYear?: (year: number) => void;
  onHidden?: (ids: string[]) => void;
  annotations?: Annotation[];
};

type Band = { year: number; y0: number; y1: number; value: number; segment: string };

const NS = "http://www.w3.org/2000/svg";

function el<K extends keyof SVGElementTagNameMap>(
  name: K,
  attrs: Record<string, string> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}


function text(parent: SVGElement, attrs: Record<string, string>, content: string) {
  const node = el("text", attrs);
  node.textContent = content;
  parent.append(node);
  return node;
}

function yenTick(value: number): string {
  if (value === 0) return "0";
  if (value % 10000 === 0) return `${value / 10000}万`;
  return value.toLocaleString("ja-JP");
}

function niceScale(maxValue: number, unit: "yen" | "minute" | "count" | "rate" | "oku" | "point"): { max: number; step: number } {
  const raw = Math.max(maxValue, 1);
  const padded = raw * 1.06;
  if (unit === "minute") {
    const step = padded > 120 ? 60 : padded > 40 ? 20 : padded > 10 ? 5 : 1;
    return { max: Math.ceil(padded / step) * step, step };
  }
  if (unit === "yen") {
    const step = padded > 60000 ? 20000 : padded > 30000 ? 10000 : padded > 10000 ? 5000 : 2000;
    return { max: Math.ceil(padded / step) * step, step };
  }
  if (unit === "point") return { max: 100, step: 20 };
  if (unit === "rate") {
    const step = padded > 40 ? 20 : padded > 8 ? 2 : padded > 2 ? 0.5 : 0.2;
    return { max: Math.ceil(padded / step - 1e-9) * step, step };
  }
  const rough = padded / 5;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const n = rough / pow;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
  return { max: Math.ceil(padded / step) * step, step };
}

function tickLabel(value: number, unit: "yen" | "minute" | "count" | "rate" | "oku" | "point"): string {
  const rounded = Math.round(value * 1000) / 1000;
  if (unit === "minute" || unit === "rate" || unit === "point") {
    return Number.isInteger(rounded) ? String(rounded) : String(rounded);
  }
  if (unit === "oku") {
    if (rounded === 0) return "0";
    if (rounded >= 10000 && rounded % 10000 === 0) return `${rounded / 10000}兆`;
    return rounded.toLocaleString("ja-JP");
  }
  if (unit === "count") {
    if (rounded === 0) return "0";
    if (rounded >= 10000 && rounded % 10000 === 0) return `${rounded / 10000}万`;
    return rounded.toLocaleString("ja-JP");
  }
  return yenTick(rounded);
}

function yearTicks(start: number, end: number): number[] {
  const span = end - start;
  const step = span > 40 ? 10 : 5;
  const ticks = new Set<number>([start, end]);
  const first = Math.ceil(start / step) * step;
  for (let y = first; y <= end; y += step) ticks.add(y);
  return [...ticks].sort((a, b) => a - b);
}

export function mountChart(host: HTMLElement, options: ChartOptions) {
  const hidden = new Set<string>();
  const unit = options.unit ?? "yen";
  const steps = options.steps?.length ? [...new Set(options.steps)].sort((a, b) => a - b) : null;
  let year = steps ? steps[steps.length - 1] : options.yearEnd;
  if (options.year != null) {
    const candidate = options.year;
    const allowed = steps ? steps.includes(candidate) : candidate >= options.yearStart && candidate <= options.yearEnd;
    if (allowed) year = candidate;
  }
  for (const id of options.hidden ?? []) {
    if (options.series.some((series) => series.id === id)) hidden.add(id);
  }
  let width = 800;
  let height = 480;

  host.replaceChildren();
  const svg = el("svg", {
    class: "chart-svg",
    role: "img",
    tabindex: "0",
    "aria-label": "年を左右の矢印で移動できるグラフ",
  });
  host.append(svg);

  const legend = document.createElement("div");
  legend.className = "legend";
  host.append(legend);

  const legendButtons = new Map<string, HTMLButtonElement>();
  for (const series of options.series) {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-pressed", hidden.has(series.id) ? "false" : "true");
    const swatch = document.createElement("i");
    swatch.style.background = series.color;
    button.append(swatch, document.createTextNode(series.name));
    button.addEventListener("click", () => {
      const on = button.getAttribute("aria-pressed") === "true";
      button.setAttribute("aria-pressed", on ? "false" : "true");
      if (on) hidden.add(series.id);
      else hidden.delete(series.id);
      draw();
      options.onHidden?.([...hidden].sort());
    });
    legendButtons.set(series.id, button);
    legend.append(button);
  }

  function visible() {
    return options.series.filter((series) => !hidden.has(series.id));
  }

  function lookup(series: Series) {
    return new Map(series.points.map((point) => [point.year, point]));
  }

  function geometry() {
    const narrow = width < 760;
    const margin = {
      top: options.annotations?.length ? 36 : 18,
      right: narrow ? 16 : 128,
      bottom: 32,
      left: unit === "count" || unit === "oku" ? 64 : 48,
    };
    const plotW = Math.max(10, width - margin.left - margin.right);
    const plotH = Math.max(10, height - margin.top - margin.bottom);
    const x = (value: number) =>
      margin.left + ((value - options.yearStart) / (options.yearEnd - options.yearStart)) * plotW;
    return { margin, plotW, plotH, x };
  }

  function stacked(series: Series[], scaleMax: number | null) {
    const maps = series.map((item) => ({ item, map: lookup(item) }));
    const bands = new Map<string, Band[]>();
    for (const item of series) bands.set(item.id, []);
    let max = 0;
    for (let y = options.yearStart; y <= options.yearEnd; y++) {
      let cursor = 0;
      for (const { item, map } of maps) {
        const point = map.get(y);
        if (!point) continue;
        const y0 = cursor;
        const y1 = cursor + point.value;
        cursor = y1;
        bands.get(item.id)?.push({ year: y, y0, y1, value: point.value, segment: point.segment });
      }
      if (cursor > max) max = cursor;
    }
    const scale = niceScale(scaleMax ?? max, unit);
    return { bands, scale };
  }

  function lineMax(series: Series[]) {
    let max = 0;
    for (const item of series) {
      for (const point of item.points) if (point.value > max) max = point.value;
    }
    return niceScale(max, unit);
  }

  function groups(rows: Band[]): Band[][] {
    const breaks = new Set(options.breaks ?? []);
    const out: Band[][] = [];
    let current: Band[] = [];
    for (const row of rows) {
      if (current.length) {
        const prev = current[current.length - 1];
        if (row.segment !== prev.segment || breaks.has(row.year)) {
          out.push(current);
          current = [];
        }
      }
      current.push(row);
    }
    if (current.length) out.push(current);
    return out;
  }

  function draw() {
    const series = visible();
    width = Math.max(320, host.clientWidth || 800);
    height = width < 640 ? 420 : 500;
    const { margin, plotH, x } = geometry();
    const stack = options.mode === "stack";
    const { bands, scale } = stack
      ? stacked(series, null)
      : { bands: new Map<string, Band[]>(), scale: lineMax(series) };
    if (!stack) {
      for (const item of series) {
        const rows = item.points
          .filter((point) => point.year >= options.yearStart && point.year <= options.yearEnd)
          .map((point) => ({ year: point.year, y0: 0, y1: point.value, value: point.value, segment: point.segment }));
        bands.set(item.id, rows);
      }
    }
    const y = (value: number) => margin.top + plotH - (value / scale.max) * plotH;

    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));
    svg.replaceChildren();
    svg.style.fontFamily = '"Hiragino Sans","Noto Sans JP",sans-serif';

    const tickCount = Math.round(scale.max / scale.step);
    for (let index = 0; index <= tickCount; index++) {
      const value = Math.round(index * scale.step * 1000) / 1000;
      const py = y(value);
      svg.append(
        el("line", {
          x1: String(margin.left),
          x2: String(width - margin.right),
          y1: py.toFixed(1),
          y2: py.toFixed(1),
          stroke: value === 0 ? "#22211e" : "#e4e0d8",
          "stroke-width": value === 0 ? "1" : "1",
        }),
      );
      text(svg, {
        x: String(margin.left - 8),
        y: String(py + 4),
        "text-anchor": "end",
        fill: "#6f6a61",
        "font-size": "12",
      }, tickLabel(value, unit));
    }

    const ticks = yearTicks(options.yearStart, options.yearEnd);
    for (const tick of ticks) {
      text(svg, {
        x: x(tick).toFixed(1),
        y: String(height - 10),
        "text-anchor": tick === options.yearEnd ? "end" : tick === options.yearStart ? "start" : "middle",
        fill: "#6f6a61",
        "font-size": "12",
      }, String(tick));
    }

    const data = el("g");
    svg.append(data);

    const labelRows: { y: number; text: string; color: string }[] = [];
    for (const item of series) {
      const rows = bands.get(item.id) ?? [];
      for (const group of groups(rows)) {
        if (options.mode === "line") {
          const d = group
            .map((row, index) => `${index === 0 ? "M" : "L"}${x(row.year).toFixed(1)} ${y(row.value).toFixed(1)}`)
            .join(" ");
          data.append(
            el("path", {
              d,
              fill: "none",
              stroke: item.color,
              "stroke-width": "1.75",
              "stroke-linejoin": "round",
              "stroke-linecap": "round",
            }),
          );
          for (const row of group) {
            data.append(
              el("circle", {
                cx: x(row.year).toFixed(1),
                cy: y(row.value).toFixed(1),
                r: "2.6",
                fill: item.color,
              }),
            );
          }
        } else if (group.length === 1) {
          const row = group[0];
          data.append(
            el("rect", {
              x: (x(row.year) - 1.5).toFixed(1),
              y: y(row.y1).toFixed(1),
              width: "3",
              height: Math.max(1, y(row.y0) - y(row.y1)).toFixed(1),
              fill: item.color,
              opacity: "0.88",
            }),
          );
        } else {
          const top = group.map((row, index) => `${index === 0 ? "M" : "L"}${x(row.year).toFixed(1)} ${y(row.y1).toFixed(1)}`);
          const bottom = [...group]
            .reverse()
            .map((row) => `L${x(row.year).toFixed(1)} ${y(row.y0).toFixed(1)}`);
          data.append(
            el("path", {
              d: `${top.join(" ")} ${bottom.join(" ")} Z`,
              fill: item.color,
              opacity: "0.86",
            }),
          );
          data.append(
            el("path", {
              d: top.join(" "),
              fill: "none",
              stroke: item.color,
              "stroke-width": "1.25",
              "stroke-linejoin": "round",
              "stroke-linecap": "round",
            }),
          );
        }
      }
      const last = rows[rows.length - 1];
      if (last && last.year === options.yearEnd && width >= 760) {
        const anchor = options.mode === "line" ? last.value : (last.y0 + last.y1) / 2;
        labelRows.push({ y: y(anchor), text: item.short ?? item.name, color: item.color });
      }
    }

    labelRows.sort((a, b) => a.y - b.y);
    for (let i = 1; i < labelRows.length; i++) {
      if (labelRows[i].y - labelRows[i - 1].y < 16) labelRows[i].y = labelRows[i - 1].y + 16;
    }
    const floor = height - 36;
    for (let i = labelRows.length - 1; i >= 0; i--) {
      if (labelRows[i].y > floor) labelRows[i].y = floor - (labelRows.length - 1 - i) * 16;
    }
    if (width >= 760) {
      for (const label of labelRows) {
        text(svg, {
          x: String(width - margin.right + 8),
          y: String(label.y + 4),
          fill: label.color,
          "font-size": "12",
        }, label.text);
      }
    }

    for (const note of options.annotations ?? []) {
      const px = x(note.year);
      svg.append(
        el("line", {
          x1: px.toFixed(1),
          x2: px.toFixed(1),
          y1: String(margin.top),
          y2: String(margin.top + plotH),
          stroke: "#a8a299",
          "stroke-dasharray": "2 3",
        }),
      );
      text(svg, {
        x: px.toFixed(1),
        y: "14",
        "text-anchor": "middle",
        fill: "#6f6a61",
        "font-size": "11",
      }, note.label);
    }

    const focus = el("g", { class: "focus" });
    svg.append(focus);
    placeFocus(focus, x, y, margin.top, plotH);
    options.onYear?.(year);
  }

  function placeFocus(
    focus: SVGGElement,
    x: (year: number) => number,
    y: (value: number) => number,
    top: number,
    plotH: number,
  ) {
    focus.replaceChildren();
    const px = x(year);
    focus.append(
      el("line", {
        x1: px.toFixed(1),
        x2: px.toFixed(1),
        y1: String(top),
        y2: String(top + plotH),
        stroke: "#b0392a",
        "stroke-width": "1",
      }),
    );
    void y;
  }

  function yearFromEvent(event: PointerEvent) {
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const matrix = svg.getScreenCTM();
    if (!matrix) return year;
    const local = point.matrixTransform(matrix.inverse());
    const { x } = geometry();
    let best = year;
    let bestDist = Infinity;
    const candidates = steps ?? Array.from({ length: options.yearEnd - options.yearStart + 1 }, (_, i) => options.yearStart + i);
    for (const candidate of candidates) {
      const dist = Math.abs(x(candidate) - local.x);
      if (dist < bestDist) {
        bestDist = dist;
        best = candidate;
      }
    }
    return best;
  }

  function move(next: number) {
    const clamped = steps
      ? steps.reduce((best, candidate) => (Math.abs(candidate - next) < Math.abs(best - next) ? candidate : best))
      : Math.min(options.yearEnd, Math.max(options.yearStart, next));
    if (clamped === year) return;
    year = clamped;
    draw();
  }

  function moveStep(delta: number) {
    if (!steps) {
      move(year + delta);
      return;
    }
    const index = steps.indexOf(year);
    const next = steps[Math.min(steps.length - 1, Math.max(0, index + delta))];
    if (next === year) return;
    year = next;
    draw();
  }

  const onPointer = (event: PointerEvent) => {
    move(yearFromEvent(event));
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "ArrowRight") moveStep(1);
    else if (event.key === "ArrowLeft") moveStep(-1);
    else if (event.key === "Home") move(steps ? steps[0] : options.yearStart);
    else if (event.key === "End") move(steps ? steps[steps.length - 1] : options.yearEnd);
    else return;
    event.preventDefault();
  };
  svg.addEventListener("pointermove", onPointer);
  svg.addEventListener("pointerdown", onPointer);
  svg.addEventListener("keydown", onKey);

  const observer = new ResizeObserver(() => draw());
  observer.observe(host);
  draw();

  return {
    destroy() {
      observer.disconnect();
      svg.removeEventListener("pointermove", onPointer);
      svg.removeEventListener("pointerdown", onPointer);
      svg.removeEventListener("keydown", onKey);
    },
    getYear: () => year,
    setYear: (next: number) => move(next),
    setHidden: (ids: string[]) => {
      hidden.clear();
      for (const id of ids) if (legendButtons.has(id)) hidden.add(id);
      legendButtons.forEach((button, id) => {
        button.setAttribute("aria-pressed", hidden.has(id) ? "false" : "true");
      });
      draw();
    },
  };
}

export function formatYen(value: number): string {
  return `${value.toLocaleString("ja-JP")}円`;
}

export function formatMinutes(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text}分`;
}

export function formatCount(value: number): string {
  return `${Math.round(value).toLocaleString("ja-JP")}部`;
}
