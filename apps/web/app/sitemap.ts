import type { MetadataRoute } from "next";

import { BLOG_PATH, BLOG_POSTS, blogModified, blogPath } from "@/lib/blog";
import { getBlogOverrides, isHidden, withOverride } from "@/lib/blog-overrides";
import { cityPairs, loadBlogData } from "@/lib/blog-stats";
import { listPublishedPaths } from "@/lib/catalog";
import { absoluteUrl } from "@/lib/format";
import { CITY_RANKING_MIN, METHODOLOGY } from "@/lib/ranking";

// Data ostatniej zmiany treści stron informacyjnych. Przy edycji strony zmień datę tutaj.
const INFO_PAGES_MODIFIED: Record<string, string> = {
  "/poradnik/ile-bierze-biuro-nieruchomosci": "2026-11-14",
  "/poradnik/jak-sprawdzic-biuro-nieruchomosci": "2026-11-14",
  "/poradnik/biura-z-jawnym-cennikiem": "2026-11-14",
  "/o-nas": "2026-11-14",
  "/kontakt": "2026-11-14",
  "/dla-firm": "2026-11-14",
  "/reklama": "2026-11-11",
  "/bot": "2026-11-11",
};

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [entries, blog, blogOverrides] = await Promise.all([listPublishedPaths(), loadBlogData().catch(() => null), getBlogOverrides()]);
  const newest = entries.reduce<Date | undefined>((acc, e) => (e.lastModified && (!acc || e.lastModified > acc) ? e.lastModified : acc), undefined);
  // Strona główna i lista miast zmieniają się razem z katalogiem; strony informacyjne mają datę zmiany treści.
  const staticPages = [
    { url: absoluteUrl("/"), lastModified: newest },
    // Ranking ogólnopolski jest indeksowany od 10 biur (app/ranking/page.tsx); lista ofert ma noindex.
    ...(entries.filter((e) => e.firmSlug).length >= 10 ? [{ url: absoluteUrl("/ranking"), lastModified: newest }] : []),
    { url: absoluteUrl("/miasta"), lastModified: newest },
    { url: absoluteUrl("/wyroznienia-2026"), lastModified: newest },
    { url: absoluteUrl("/raporty/prowizje-biur-nieruchomosci-2026"), lastModified: newest },
    { url: absoluteUrl("/metodologia"), lastModified: new Date(METHODOLOGY.modified) },
    ...Object.entries(INFO_PAGES_MODIFIED).map(([path, date]) => ({ url: absoluteUrl(path), lastModified: new Date(date) })),
    // Blog: data zmiany tekstu z lib/blog.ts (liczby odświeżają się codziennie, ale to nie zmiana treści).
    { url: absoluteUrl(BLOG_PATH), lastModified: new Date(blogModified()) },
    ...BLOG_POSTS.filter((p) => !isHidden(p.slug, blogOverrides))
      .map((p) => withOverride(p, blogOverrides))
      .map((p) => ({ url: absoluteUrl(blogPath(p.slug)), lastModified: new Date(p.modified) })),
    ...(blog ? cityPairs(blog.cities) : [])
      .filter((p) => !isHidden(`porownanie-${p.slug}`, blogOverrides))
      .map((p) => ({ url: absoluteUrl(blogPath(`porownanie/${p.slug}`)), lastModified: new Date(blogModified()) })),
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
