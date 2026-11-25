import { describe, expect, it } from "vitest";

import {
  isSitemapFile,
  newestDate,
  sitemapIndexXml,
  sitemapPath,
  splitCatalogEntries,
  urlsetXml,
} from "@/lib/sitemap";

describe("mapa strony w trzech plikach", () => {
  it("dzieli wpisy katalogu na miasta i firmy, bez miast poniżej progu rankingu", () => {
    const d = new Date("2026-11-20T10:00:00Z");
    const { miasta, firmy } = splitCatalogEntries([
      { citySlug: "warszawa", firmSlug: null, lastModified: d, cityListings: 137 },
      { citySlug: "kielczow", firmSlug: null, lastModified: d, cityListings: 2 },
      { citySlug: "warszawa", firmSlug: "prodoma", lastModified: null, cityListings: 0 },
    ]);
    expect(miasta.map((u) => u.url)).toEqual(["https://rankingbiurnieruchomosci.pl/warszawa"]);
    expect(miasta[0].lastModified).toEqual(d);
    expect(firmy).toEqual([{ url: "https://rankingbiurnieruchomosci.pl/warszawa/prodoma", lastModified: undefined }]);
  });

  it("zna tylko trzy pliki map", () => {
    expect(isSitemapFile("firmy")).toBe(true);
    expect(isSitemapFile("miasta")).toBe(true);
    expect(isSitemapFile("strony")).toBe(true);
    expect(isSitemapFile("inne")).toBe(false);
    expect(sitemapPath("miasta")).toBe("/sitemaps/miasta.xml");
  });

  it("zapisuje poprawny XML: urlset z lastmod i escapowaniem, indeks map", () => {
    const xml = urlsetXml([
      { url: "https://x.pl/a?b=1&c=2", lastModified: new Date("2026-11-20T10:00:00Z") },
      { url: "https://x.pl/bez-daty" },
    ]);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain("<url><loc>https://x.pl/a?b=1&amp;c=2</loc><lastmod>2026-11-20T10:00:00.000Z</lastmod></url>");
    expect(xml).toContain("<url><loc>https://x.pl/bez-daty</loc></url>");
    const index = sitemapIndexXml([{ url: "https://x.pl/sitemaps/firmy.xml", lastModified: new Date("2026-11-21T00:00:00Z") }]);
    expect(index).toContain("<sitemapindex");
    expect(index).toContain("<sitemap><loc>https://x.pl/sitemaps/firmy.xml</loc><lastmod>2026-11-21T00:00:00.000Z</lastmod></sitemap>");
  });

  it("bierze najnowszą datę z listy, pomija brakujące", () => {
    const a = new Date("2026-11-01T00:00:00Z");
    const b = new Date("2026-11-05T00:00:00Z");
    expect(newestDate([a, undefined, b])).toEqual(b);
    expect(newestDate([undefined])).toBeUndefined();
  });
});
