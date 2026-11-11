import type { MetadataRoute } from "next";

import { listPublishedPaths } from "@/lib/catalog";
import { absoluteUrl } from "@/lib/format";
import { CITY_RANKING_MIN } from "@/lib/ranking";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = await listPublishedPaths();
  const newest = entries.reduce<Date | undefined>((acc, e) => (e.lastModified && (!acc || e.lastModified > acc) ? e.lastModified : acc), undefined);
  // Strona główna zmienia się razem z katalogiem; strony informacyjne bez lastmod (nie znamy daty ich zmiany).
  const staticPages = [
    { url: absoluteUrl("/"), lastModified: newest },
    ...["/metodologia", "/dla-firm", "/reklama", "/bot"].map((path) => ({ url: absoluteUrl(path) })),
  ];
  const dynamicPages = entries
    // strony miast z mniejszą liczbą firm niż próg są noindex, więc nie trafiają do mapy strony
    .filter((e) => e.firmSlug !== null || e.cityListings >= CITY_RANKING_MIN)
    .map((e) => ({
      url: absoluteUrl(e.firmSlug ? `/${e.citySlug}/${e.firmSlug}` : `/${e.citySlug}`),
      lastModified: e.lastModified ?? undefined,
    }));
  return [...staticPages, ...dynamicPages];
}
