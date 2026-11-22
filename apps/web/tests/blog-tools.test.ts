import { describe, expect, it } from "vitest";

import { cleanOverrides, isHidden, withOverride } from "@/lib/blog-overrides";
import { cityBlogLinks, firmBlogLinks, latestBlogLinks, type PairLink } from "@/lib/blog-links";
import { analyzeBlogHtml, countWords } from "@/lib/blog-seo";
import { cityStats, type Firm } from "@/lib/blog-stats";
import { cityPortrait, pairAdvice, pairFaq, pick, pricesComparison, ratingsComparison, seedOf, tenureComparison } from "@/lib/pair-content";

const NOW = new Date("2026-11-22T12:00:00Z");
let seq = 0;
const firm = (city: string, extra: Partial<Firm> = {}): Firm => {
  seq += 1;
  return {
    brandId: `b${seq}`, name: `Biuro ${seq}`, slug: `biuro-${seq}`, citySlug: city.toLowerCase(), cityName: city,
    googleRating: 4.8, googleCount: 30, startDate: new Date("2012-01-01"), hasPublicPrices: seq % 3 === 0, offersCount: 1, ...extra,
  };
};

describe("ustawienia wpisów z panelu", () => {
  it("odrzuca błędne wpisy i nadpisuje datę", () => {
    const o = cleanOverrides({ "a-b": { published: "2026-12-01", hidden: true }, "zly slug": { hidden: true }, c: { published: "1.12.2026" } });
    expect(o).toEqual({ "a-b": { published: "2026-12-01", hidden: true } });
    expect(isHidden("a-b", o)).toBe(true);
    const post = withOverride({ slug: "a-b", published: "2026-11-21", modified: "2026-11-21" }, o);
    expect(post.published).toBe("2026-12-01");
    expect(post.modified).toBe("2026-12-01");
  });
});

describe("ocena SEO z HTML", () => {
  const html = (body: string, extra = "") => `<html><head><title>Ile bierze biuro nieruchomości za sprzedaż w 2026</title>
    <meta name="description" content="Ile bierze biuro nieruchomości za sprzedaż mieszkania: stawki z cenników biur, przykłady w złotych i lista kontrolna."/>
    <meta property="og:image" content="https://x.pl/blog/okladka/test.png"/>
    <link rel="canonical" href="https://x.pl/blog/test"/>
    <script type="application/ld+json">{"@type":"Article"}</script><script type="application/ld+json">{"@type":"FAQPage"}</script>${extra}
    </head><body><h1>T</h1><article class="blog-article"><div class="answer"><p>Ile bierze biuro nieruchomości? Zwykle procent.</p></div>${body}</article></body></html>`;

  it("liczy słowa tylko z artykułu i punktuje kryteria", () => {
    const body = `${"<h2>S</h2>".repeat(6)}<p>${"słowo ".repeat(1800)}</p>${["/a", "/b", "/c", "/d", "/e", "/f"].map((h) => `<a href="${h}">x</a>`).join("")}<figure class="viz"></figure><figure class="viz"></figure>`;
    const r = analyzeBlogHtml(html(body), { keyword: "ile bierze biuro nieruchomości", category: "Poradnik", path: "/blog/test" });
    expect(r.words).toBeGreaterThan(1800);
    expect(r.score).toBe(100);
  });

  it("wykrywa braki: krótki tekst, długi myślnik, brak wykresów", () => {
    const r = analyzeBlogHtml(html("<h2>A</h2><p>Krótko — za krótko.</p>"), { keyword: "ile bierze biuro nieruchomości", category: "Poradnik", path: "/blog/test" });
    const failed = r.checks.filter((c) => !c.ok).map((c) => c.key);
    expect(failed).toEqual(expect.arrayContaining(["words", "h2", "links", "charts", "dash"]));
    expect(r.score).toBeLessThan(70);
  });

  it("liczy liczby z przecinkiem jako jedno słowo", () => {
    expect(countWords("Mediana to 2,46% ceny, a 4,8 to ocena.")).toBe(8);
  });
});

describe("teksty porównań miast", () => {
  const stats = cityStats(
    [
      ...Array.from({ length: 30 }, (_, i) => firm("Kraków", { googleRating: i % 2 ? 4.9 : 4.6, startDate: new Date(i % 2 ? "2005-01-01" : "2020-01-01") })),
      ...Array.from({ length: 22 }, () => firm("Gdańsk", { googleRating: 4.5 })),
    ],
    new Map([["kraków", 35]]),
    new Map(),
    NOW,
  );
  const [a, b] = stats;
  const extra = { services: [{ label: "wynajem", share: 60 }, { label: "zarządzanie najmem", share: 20 }], top: [{ name: "Alfa", slug: "alfa", citySlug: "kraków", score: 88, rating: 4.9, reviews: 120 }], editorial: null };
  const extraB = { services: [{ label: "wynajem", share: 40 }], top: [], editorial: null };

  it("wybór wariantu jest stały dla pary", () => {
    expect(seedOf("krakow-czy-gdansk")).toBe(seedOf("krakow-czy-gdansk"));
    expect(pick(["a", "b", "c"], 7, "x")).toBe(pick(["a", "b", "c"], 7, "x"));
  });

  it("opis miasta zawiera liczby z danych i nie ma długich myślników", () => {
    const text = cityPortrait(a, extra, seedOf("p")).join(" ");
    expect(text).toContain("30 biur");
    expect(text).toContain("35 wpisów");
    expect(text).toContain("Alfa (88/100)");
    expect(text).not.toMatch(/[–—]/);
  });

  it("porównania mówią wprost o braku danych i podają zwycięzcę z progami", () => {
    const ratings = ratingsComparison(a, b, 1);
    expect(ratings).toMatch(/Wyżej oceniane są biura w Krakowie|lepiej wypada Kraków/);
    expect(ratings).toContain("4,75");
    expect(pricesComparison(a, b)).toContain("Mediany prowizji nie porównujemy");
    expect(tenureComparison(a, { ...b, withYears: 3 }, 1)).toContain("Stażu nie porównujemy");
  });

  it("wskazówki i FAQ odnoszą się do obu miast", () => {
    const advice = pairAdvice(a, b, extra, extraB);
    expect(advice[0]).toContain("w Krakowie (30)");
    expect(advice.some((t) => t.includes("zarządzania najmem"))).toBe(true);
    const faq = pairFaq(a, b, extra, extraB);
    expect(faq.map((f) => f.q)).toContain("Jakie są najlepsze biura nieruchomości w Krakowie?");
    expect(faq.every((f) => !/[–—]/.test(f.a))).toBe(true);
  });
});

describe("linki do bloga w serwisie", () => {
  const pairs: PairLink[] = [
    { slug: "warszawa-czy-krakow", a: { slug: "warszawa", name: "Warszawa" }, b: { slug: "krakow", name: "Kraków" } },
    { slug: "krakow-czy-gdansk", a: { slug: "krakow", name: "Kraków" }, b: { slug: "gdansk", name: "Gdańsk" } },
  ];
  const base = { slug: "alfa", citySlug: "krakow", hasPublicPrices: true, services: ["wynajem mieszkań"], googleRating: 5, googleCount: 4, registryYears: 20, citiesCount: 1 };

  it("profil: najpierw artykuły pasujące do biura, plus porównanie jego miasta", () => {
    const items = firmBlogLinks(base, pairs, new Set());
    expect(items).toHaveLength(4);
    expect(items[0].href).toBe("/blog/sprzedaz-mieszkania-z-biurem-czy-samemu");
    expect(items[1].href).toBe("/blog/prowizja-za-wynajem-mieszkania");
    expect(items[3].href).toMatch(/^\/blog\/porownanie\/.*krakow/);
    expect(firmBlogLinks(base, pairs, new Set())).toEqual(items);
  });

  it("pomija ukryte wpisy i porównania", () => {
    const items = firmBlogLinks(base, pairs, new Set(["sprzedaz-mieszkania-z-biurem-czy-samemu", "porownanie-warszawa-czy-krakow", "porownanie-krakow-czy-gdansk"]));
    expect(items.some((i) => i.href.includes("sprzedaz-mieszkania"))).toBe(false);
    expect(items.some((i) => i.href.includes("porownanie"))).toBe(false);
  });

  it("miasto: porównania z tym miastem i artykuły o miastach", () => {
    const items = cityBlogLinks("krakow", pairs, new Set());
    expect(items.filter((i) => i.href.includes("porownanie"))).toHaveLength(2);
    expect(items.some((i) => i.href === "/blog/oceny-biur-nieruchomosci-w-miastach")).toBe(true);
    expect(cityBlogLinks("szczecin", pairs, new Set()).some((i) => i.href.includes("porownanie"))).toBe(false);
  });

  it("strona główna: najnowsze wpisy według daty z panelu", () => {
    const items = latestBlogLinks(new Set(), 3, (p) => (p.slug === "najdluzej-dzialajace-biura-nieruchomosci" ? "2027-01-01" : p.published));
    expect(items[0].href).toBe("/blog/najdluzej-dzialajace-biura-nieruchomosci");
    expect(items).toHaveLength(3);
  });
});
