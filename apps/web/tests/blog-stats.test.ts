import { describe, expect, it } from "vitest";

import { BLOG_POSTS, fmtRate, fmtRating, fmtShare, fmtYears, relatedPosts } from "@/lib/blog";
import { nLatGen, nOpiniach, nOpiniami } from "@/lib/plural";
import {
  CITY_COMPARE_MIN,
  buyerStats,
  cityPairs,
  cityStats,
  managementStats,
  pairPoints,
  ratingLeague,
  ratingOverview,
  reachStats,
  rentBrokerageStats,
  saleVatStats,
  tenureStats,
  yearsSince,
  type Firm,
  type RateRow,
} from "@/lib/blog-stats";

const NOW = new Date("2026-11-21T12:00:00Z");
let seq = 0;
const firm = (city: string, extra: Partial<Firm> = {}): Firm => {
  seq += 1;
  return {
    brandId: `b${seq}`,
    name: `Biuro ${seq}`,
    slug: `biuro-${seq}`,
    citySlug: city.toLowerCase(),
    cityName: city,
    googleRating: null,
    googleCount: null,
    startDate: null,
    hasPublicPrices: false,
    offersCount: 0,
    ...extra,
  };
};
const rated = (city: string, rating: number, count = 20, extra: Partial<Firm> = {}) => firm(city, { googleRating: rating, googleCount: count, ...extra });

describe("yearsSince", () => {
  it("liczy lata i odrzuca daty z przyszłości", () => {
    expect(Math.floor(yearsSince(new Date("2016-11-20"), NOW) as number)).toBe(10);
    expect(yearsSince(new Date("2030-01-01"), NOW)).toBeNull();
    expect(yearsSince(null, NOW)).toBeNull();
  });
});

describe("cityStats", () => {
  it("liczy oceny tylko z biur z co najmniej 10 opiniami", () => {
    const firms = [rated("Kraków", 4.6), rated("Kraków", 5.0, 3), rated("Kraków", 4.9), firm("Kraków", { hasPublicPrices: true })];
    const [c] = cityStats(firms, new Map([["kraków", 6]]), new Map(), NOW);
    expect(c.firms).toBe(4);
    expect(c.listings).toBe(6);
    expect(c.rated).toBe(2);
    expect(c.avgRating).toBeCloseTo(4.75);
    expect(c.share48).toBe(50);
    expect(c.reviews).toBe(43);
    expect(c.ratedReviews).toBe(40);
    expect(c.sharePrices).toBe(25);
  });

  it("pokazuje medianę prowizji dopiero od progu próby", () => {
    const firms = [rated("Łódź", 4.5), rated("Gdańsk", 4.5)];
    const commission = new Map([
      ["łódź", { n: 2, median: 2 }],
      ["gdańsk", { n: 5, median: 2.5 }],
    ]);
    const stats = cityStats(firms, new Map(), commission, NOW);
    expect(stats.find((c) => c.slug === "łódź")?.commission).toBeNull();
    expect(stats.find((c) => c.slug === "gdańsk")?.commission).toBe(2.5);
  });
});

describe("ratingLeague", () => {
  it("pomija miasta z za małą próbą i sortuje od najwyższej średniej", () => {
    const firms = [
      ...Array.from({ length: CITY_COMPARE_MIN }, () => rated("Olsztyn", 4.9)),
      ...Array.from({ length: CITY_COMPARE_MIN }, () => rated("Radom", 4.5)),
      ...Array.from({ length: CITY_COMPARE_MIN - 1 }, () => rated("Ełk", 5.0)),
    ];
    const league = ratingLeague(cityStats(firms, new Map(), new Map(), NOW));
    expect(league.map((c) => c.name)).toEqual(["Olsztyn", "Radom"]);
  });
});

describe("ratingOverview", () => {
  it("rozdziela oceny 5,0 na biura z małą i dużą liczbą opinii", () => {
    const o = ratingOverview([rated("A", 5.0, 3), rated("A", 5.0, 4), rated("A", 4.8, 100), rated("A", 3.5, 2), firm("A")]);
    expect(o.rated).toBe(4);
    expect(o.share5).toBe(50);
    expect(o.share5Few).toBeCloseTo(66.67, 1);
    expect(o.share5Many).toBe(0);
    expect(o.buckets.find((b) => b.label === "5,0")?.firms).toBe(2);
    expect(o.buckets.find((b) => b.label === "4,8-4,9")?.firms).toBe(1);
    expect(o.buckets.reduce((s, b) => s + b.firms, 0)).toBe(4);
    expect(o.weightedRating).toBeCloseTo((5 * 3 + 5 * 4 + 4.8 * 100 + 3.5 * 2) / 109);
    expect(o.avgRatingSolid).toBe(4.8);
    expect(o.solid).toBe(1);
  });
});

describe("reachStats", () => {
  it("dzieli firmy na lokalne i obecne w kilku miastach", () => {
    const local = rated("A", 4.9);
    const multi = rated("B", 4.5, 50);
    const s = reachStats([local, multi], new Map([[multi.brandId, 6]]), NOW);
    expect(s.groups[0].firms).toBe(1);
    expect(s.groups[1].firms).toBe(1);
    expect(s.groups[2].firms).toBe(1);
    expect(s.wide[0].brandId).toBe(multi.brandId);
    expect(s.wide[0].cities).toBe(6);
    expect(s.multiShare).toBe(50);
  });
});

describe("tenureStats", () => {
  it("liczy firmy z tą samą najwcześniejszą datą", () => {
    const d = new Date("1993-07-05");
    const t = tenureStats([firm("A", { startDate: d }), firm("A", { startDate: d }), firm("A", { startDate: new Date("2001-01-01") })], NOW);
    expect(t.oldestTied).toBe(2);
  });

  it("sortuje od najstarszej firmy i liczy udziały", () => {
    const t = tenureStats(
      [firm("A", { startDate: new Date("1995-03-01") }), firm("A", { startDate: new Date("2025-01-01") }), firm("A", { startDate: new Date("2010-06-01") }), firm("A")],
      NOW,
    );
    expect(t.withYears).toBe(3);
    expect(t.oldest[0].startDate?.getFullYear()).toBe(1995);
    expect(t.share10y).toBeCloseTo(66.67, 1);
    expect(t.share20y).toBeCloseTo(33.33, 1);
    expect(t.shareUnder3y).toBeCloseTo(33.33, 1);
  });
});

const rate = (brandId: string, service: string, amountMin: number, extra: Partial<RateRow> = {}): RateRow => ({
  brandId, service, unit: "percent", amountMin, amountMax: null, taxMode: "unknown", ...extra,
});

describe("stawki z cenników", () => {
  it("prowizja za najem: najniższa stawka na biuro, bez wartości spoza przedziału", () => {
    const s = rentBrokerageStats([
      rate("a", "wynajem mieszkania", 100),
      rate("a", "wynajem mieszkania", 50),
      rate("b", "pośrednictwo w najmie mieszkania (wynajem)", 100),
      rate("c", "wynajem", 5),
      rate("d", "sprzedaż", 2.5),
    ]);
    expect(s.n).toBe(2);
    expect(s.median).toBe(75);
    expect(s.min).toBe(50);
  });

  it("zarządzanie najmem i VAT przy sprzedaży", () => {
    expect(managementStats([rate("a", "zarządzanie najmem", 10), rate("b", "zarządzanie nieruchomością", 15)]).median).toBe(12.5);
    const vat = saleVatStats([
      rate("a", "sprzedaż mieszkania", 2, { taxMode: "plus_vat" }),
      rate("b", "sprzedaż mieszkania", 3, { taxMode: "gross" }),
      rate("c", "sprzedaż domu", 2.5),
    ]);
    expect(vat).toEqual({ n: 3, plusVat: 1, gross: 1, unknown: 1 });
  });

  it("kupujący: 0% liczy się jako bez prowizji, nie wchodzi do mediany", () => {
    const b = buyerStats([
      rate("a", "prowizja od kupującego", 0),
      rate("b", "prowizja od kupującego", 2),
      rate("c", "zakup nieruchomości", 1.5),
      rate("d", "sprzedaż mieszkania", 3),
      rate("e", "pośrednictwo w sprzedaży i zakupie", 2.5),
    ]);
    expect(b.free).toBe(1);
    expect(b.brands).toBe(3);
    expect(b.paid.n).toBe(2);
    expect(b.paid.median).toBe(1.75);
  });
});

describe("pary miast", () => {
  const big = (name: string, n: number, rating: number) => Array.from({ length: n }, () => rated(name, rating));
  const stats = cityStats([...big("Warszawa", 30, 4.6), ...big("Kraków", 25, 4.8), ...big("Kielce", 10, 4.9)], new Map(), new Map(), NOW);

  it("tworzy pary tylko dla dużych miast, większe miasto pierwsze", () => {
    const pairs = cityPairs(stats);
    expect(pairs.map((p) => p.slug)).toEqual(["warszawa-czy-kraków"]);
  });

  it("wskazuje lepsze miasto i remis przy małej różnicy", () => {
    const [w, k] = stats;
    const points = Object.fromEntries(pairPoints(w, k).map((p) => [p.key, p.winner]));
    expect(points.firms).toBe("a");
    expect(points.rating).toBe("b");
    expect(points.commission).toBeNull();
    const same = { ...k, avgRating: (w.avgRating as number) + 0.01 };
    expect(pairPoints(w, same).find((p) => p.key === "rating")?.winner).toBe("tie");
  });
});

describe("lista artykułów", () => {
  it("ma unikalne adresy i poprawne daty", () => {
    const slugs = BLOG_POSTS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const p of BLOG_POSTS) {
      expect(p.slug).toMatch(/^[a-z0-9-]+$/);
      expect(p.modified >= p.published).toBe(true);
      expect(p.description.length).toBeLessThanOrEqual(160);
      expect(p.title.length).toBeLessThanOrEqual(80);
    }
  });

  it("linki 'Czytaj też' nie wskazują na ten sam artykuł", () => {
    for (const p of BLOG_POSTS) expect(relatedPosts(p.slug).some((r) => r.slug === p.slug)).toBe(false);
  });

  it("formatuje liczby po polsku", () => {
    expect(fmtRating(4.784)).toBe("4,78");
    expect(fmtRate(2.5)).toBe("2,5%");
    expect(fmtShare(63.4)).toBe("63%");
    expect(fmtYears(12.9)).toBe("12 lat");
    expect(fmtYears(3.2)).toBe("3 lata");
  });

  it("odmienia liczebniki w przypadkach zależnych", () => {
    expect(nOpiniami(10)).toBe("10 opiniami");
    expect(nOpiniami(1)).toBe("1 opinią");
    expect(nOpiniach(10)).toBe("10 opiniach");
    expect(nLatGen(33)).toBe("33 lat");
    expect(nLatGen(1)).toBe("1 roku");
  });
});
