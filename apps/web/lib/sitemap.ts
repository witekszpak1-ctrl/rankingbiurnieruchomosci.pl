/**
 * Mapa strony podzielona na trzy pliki: strony stałe i blog, strony miast, profile firm. Indeks /sitemap.xml
 * wskazuje wszystkie trzy, więc w Google Search Console i Bing Webmaster Tools widać indeksowanie każdej grupy
 * osobno. Ten sam indeks czyta robot (katalog indexnow), żeby zgłaszać Bingowi nowe i zmienione adresy.
 */

import { BLOG_PATH, BLOG_POSTS, blogModified, blogPath } from "./blog";
import { getBlogOverrides, isHidden, withOverride } from "./blog-overrides";
import { cityPairs, loadBlogData } from "./blog-stats";
import { listPublishedPaths, type SitemapEntry } from "./catalog";
import { absoluteUrl } from "./format";
import { CITY_RANKING_MIN, METHODOLOGY } from "./ranking";

export const SITEMAP_FILES = ["strony", "miasta", "firmy"] as const;
export type SitemapFile = (typeof SITEMAP_FILES)[number];

export type SitemapUrl = { url: string; lastModified?: Date };
export type SitemapGroups = Record<SitemapFile, SitemapUrl[]>;

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

export function isSitemapFile(name: string): name is SitemapFile {
  return (SITEMAP_FILES as readonly string[]).includes(name);
}

export function sitemapPath(name: SitemapFile): string {
  return `/sitemaps/${name}.xml`;
}

/** Miasta i firmy z wpisów katalogu. Miasta poniżej progu rankingu mają noindex, więc nie trafiają do mapy. */
export function splitCatalogEntries(entries: SitemapEntry[]): Pick<SitemapGroups, "miasta" | "firmy"> {
  const miasta: SitemapUrl[] = [];
  const firmy: SitemapUrl[] = [];
  for (const e of entries) {
    const lastModified = e.lastModified ?? undefined;
    if (e.firmSlug) firmy.push({ url: absoluteUrl(`/${e.citySlug}/${e.firmSlug}`), lastModified });
    else if (e.cityListings >= CITY_RANKING_MIN) miasta.push({ url: absoluteUrl(`/${e.citySlug}`), lastModified });
  }
  return { miasta, firmy };
}

export async function sitemapGroups(): Promise<SitemapGroups> {
  const [entries, blog, blogOverrides] = await Promise.all([listPublishedPaths(), loadBlogData().catch(() => null), getBlogOverrides()]);
  const newest = newestDate(entries.map((e) => e.lastModified ?? undefined));
  // Strona główna i lista miast zmieniają się razem z katalogiem; strony informacyjne mają datę zmiany treści.
  const strony: SitemapUrl[] = [
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
  return { strony, ...splitCatalogEntries(entries) };
}

export function newestDate(dates: (Date | undefined)[]): Date | undefined {
  return dates.reduce<Date | undefined>((acc, d) => (d && (!acc || d > acc) ? d : acc), undefined);
}

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function lastmod(date: Date | undefined): string {
  return date && !Number.isNaN(date.getTime()) ? `<lastmod>${date.toISOString()}</lastmod>` : "";
}

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8"?>\n';
const NS = 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"';

export function urlsetXml(urls: SitemapUrl[]): string {
  const body = urls.map((u) => `<url><loc>${escapeXml(u.url)}</loc>${lastmod(u.lastModified)}</url>`).join("\n");
  return `${XML_HEAD}<urlset ${NS}>\n${body}\n</urlset>\n`;
}

export function sitemapIndexXml(items: SitemapUrl[]): string {
  const body = items.map((s) => `<sitemap><loc>${escapeXml(s.url)}</loc>${lastmod(s.lastModified)}</sitemap>`).join("\n");
  return `${XML_HEAD}<sitemapindex ${NS}>\n${body}\n</sitemapindex>\n`;
}

export function xmlResponse(xml: string): Response {
  return new Response(xml, {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=600" },
  });
}
