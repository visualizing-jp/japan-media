export function readQuery(key: string, fallback: string, valid: (value: string) => boolean): string {
  const raw = new URLSearchParams(location.search).get(key);
  return raw !== null && valid(raw) ? raw : fallback;
}

export function writeQuery(key: string, value: string, fallback: string) {
  const params = new URLSearchParams(location.search);
  if (value === fallback) params.delete(key);
  else params.set(key, value);
  const query = params.toString();
  const next = query === "" ? location.pathname : `?${query}`;
  const now = `${location.pathname}${location.search}`;
  if (next !== now) history.replaceState(null, "", next);
}

export type ViewSpec = { id: string; label: string; hint: string };

export function mountViews(nav: HTMLElement, views: ViewSpec[]) {
  const fallback = views[0]?.id ?? "";
  let current = readQuery("view", fallback, (value) => views.some((view) => view.id === value));
  writeQuery("view", current, fallback);
  const listeners: Array<(id: string) => void> = [];

  function paint() {
    nav.replaceChildren();
    for (const view of views) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "view";
      if (view.id === current) button.setAttribute("aria-current", "page");
      const hint = document.createElement("span");
      hint.className = "view-hint";
      hint.textContent = view.hint;
      button.append(document.createTextNode(view.label), hint);
      button.addEventListener("click", () => choose(view.id));
      nav.append(button);
    }
  }

  function choose(id: string) {
    if (id === current || !views.some((view) => view.id === id)) return;
    current = id;
    writeQuery("view", current, fallback);
    paint();
    for (const listener of listeners) listener(current);
  }

  paint();
  return {
    get id() {
      return current;
    },
    onChange(listener: (id: string) => void) {
      listeners.push(listener);
    },
  };
}

export function showView(id: string) {
  document.querySelectorAll<HTMLElement>("[data-view]").forEach((panel) => {
    panel.hidden = panel.dataset.view !== id;
  });
}

export function readYear(years: number[]): number {
  const fallback = String(years[years.length - 1]);
  const raw = readQuery("year", fallback, (value) => years.some((year) => String(year) === value));
  writeQuery("year", raw, fallback);
  return Number(raw);
}

export function writeYear(year: number, years: number[]) {
  writeQuery("year", String(year), String(years[years.length - 1]));
}

export function parseOff(ids: string[]): string[] | null {
  const raw = new URLSearchParams(location.search).get("off");
  if (raw === null || raw === "") return [];
  const parts = raw.split(",").filter((part) => part !== "");
  const known = new Set(ids);
  if (!parts.length || parts.some((part) => !known.has(part))) return null;
  return [...new Set(parts)].sort();
}

export function writeOff(ids: string[]) {
  writeQuery("off", [...new Set(ids)].sort().join(","), "");
}

export function spanYears(start: number, end: number): number[] {
  const years: number[] = [];
  for (let year = start; year <= end; year += 1) years.push(year);
  return years;
}
