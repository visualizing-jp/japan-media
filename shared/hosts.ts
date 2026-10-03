export const hosts = {
  index: "japan-media.visualizing.jp",
  spend: "japan-media-spend.visualizing.jp",
  time: "japan-media-time.visualizing.jp",
  press: "japan-media-press.visualizing.jp",
  ads: "japan-media-ads.visualizing.jp",
  trust: "japan-media-trust.visualizing.jp",
} as const;

export type SiteSlug = keyof typeof hosts;

export function siteHref(slug: SiteSlug): string {
  const host = location.hostname;
  const onProduction = (Object.values(hosts) as string[]).includes(host);
  if (onProduction) return `https://${hosts[slug]}/`;
  return slug === "index" ? "/" : `/${slug}/`;
}
