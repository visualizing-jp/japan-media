import { defineConfig } from "vite";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = __dirname;
const pages = ["spend", "time", "press", "ads", "trust"] as const;

const hostSite: Record<string, string> = {
  "japan-media.visualizing.jp": "index",
  "japan-media-spend.visualizing.jp": "spend",
  "japan-media-time.visualizing.jp": "time",
  "japan-media-press.visualizing.jp": "press",
  "japan-media-ads.visualizing.jp": "ads",
  "japan-media-trust.visualizing.jp": "trust",
};

function siteFromCname(): string | undefined {
  const file = resolve(root, "public", "CNAME");
  if (!existsSync(file)) return undefined;
  const host = readFileSync(file, "utf8").trim();
  if (!host) return undefined;
  const site = hostSite[host];
  if (!site) throw new Error(`public/CNAME is not a japan-media host: ${host}`);
  return site;
}

function allInputs() {
  const input: Record<string, string> = {};
  const index = resolve(root, "index.html");
  if (existsSync(index)) input.index = index;
  for (const page of pages) {
    const file = resolve(root, page, "index.html");
    if (existsSync(file)) input[page] = file;
  }
  return input;
}

function singleSite(site: string) {
  if (site !== "index" && !(pages as readonly string[]).includes(site)) {
    throw new Error(`Unknown SITE: ${site}`);
  }
  const siteRoot = site === "index" ? root : resolve(root, site);
  const publicDir = resolve(root, "public");
  return {
    root: siteRoot,
    base: "/",
    publicDir: existsSync(publicDir) ? publicDir : false,
    server: { allowedHosts: true },
    build: {
      outDir: resolve(root, "dist"),
      emptyOutDir: true,
    },
  };
}

export default defineConfig(() => {
  const fromEnv = process.env.SITE;
  const site = fromEnv && fromEnv !== "all" ? fromEnv : siteFromCname();
  if (site) return singleSite(site);
  return {
    root,
    base: "/",
    server: { allowedHosts: true },
    build: {
      outDir: resolve(root, "dist"),
      emptyOutDir: true,
      rollupOptions: { input: allInputs() },
    },
  };
});
