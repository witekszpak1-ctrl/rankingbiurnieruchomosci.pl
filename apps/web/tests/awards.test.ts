import { describe, expect, it } from "vitest";

import { AWARD, awardPlace, badgeEmbedCode, badgeSvg, pickCityLeaders, type RankableCard } from "../lib/awards";
import { CITY_RANKING_MIN } from "../lib/ranking";

const now = new Date("2026-11-14T12:00:00Z");

function card(id: string, city: string, opts: Partial<RankableCard> = {}): RankableCard {
  return {
    listingId: id,
    name: `Biuro ${id}`,
    slug: `biuro-${id}`,
    cityName: city,
    citySlug: city.toLowerCase(),
    startDate: null,
    hasPublicPrices: false,
    verificationScore: null,
    registryConfirmed: false,
    servicesCount: 0,
    offersCount: 0,
    ...opts,
  };
}

// Wynik rośnie z liczbą usług i ofert, więc "a" > "b" > "c" > reszta.
const strong = { registryConfirmed: true, hasPublicPrices: true, servicesCount: 6, offersCount: 20 };
const medium = { registryConfirmed: true, hasPublicPrices: true, servicesCount: 3, offersCount: 10 };
const weak = { registryConfirmed: true, servicesCount: 1 };

describe("pickCityLeaders", () => {
  const krakow = [card("a", "Krakow", strong), card("b", "Krakow", medium), card("c", "Krakow", weak), card("d", "Krakow"), card("e", "Krakow")];
  const small = Array.from({ length: CITY_RANKING_MIN - 1 }, (_, i) => card(`s${i}`, "Male", strong));

  it("bierze pierwszą trójkę tylko w miastach z co najmniej CITY_RANKING_MIN biurami", () => {
    const result = pickCityLeaders([...krakow, ...small], now);
    expect(result).toHaveLength(1);
    expect(result[0].citySlug).toBe("krakow");
    expect(result[0].count).toBe(5);
    expect(result[0].leaders.map((l) => [l.listingId, l.position])).toEqual([
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ]);
  });

  it("wpis bez profilu zajmuje miejsce, ale nie jest laureatem (numeracja jak w profilu)", () => {
    const noSlug = [{ ...krakow[0], slug: null }, ...krakow.slice(1)];
    const [city] = pickCityLeaders(noSlug, now);
    expect(city.leaders.map((l) => [l.listingId, l.position])).toEqual([
      ["b", 2],
      ["c", 3],
    ]);
  });

  it("awardPlace zgadza się z pierwszą trójką", () => {
    expect(awardPlace("b", krakow, now)).toEqual({ place: 2, count: 5 });
    expect(awardPlace("d", krakow, now)).toBeNull();
    expect(awardPlace("s0", small, now)).toBeNull();
  });
});

describe("badgeSvg", () => {
  it("pokazuje miejsce, miasto i edycję, a nazwy z XML są bezpieczne", () => {
    const svg = badgeSvg({ place: 1, cityName: "Kędzierzyn-Koźle <&>" });
    expect(svg).toContain(`WYRÓŻNIENIE ${AWARD.edition}`);
    expect(svg).toContain("1. miejsce");
    expect(svg).toContain("Kędzierzyn-Koźle &lt;&amp;&gt;");
    expect(svg).not.toContain("<&>");
    expect(svg.startsWith("<svg")).toBe(true);
  });

  it("neutralna odznaka nie mówi nic o miejscu", () => {
    const svg = badgeSvg(null);
    expect(svg).not.toContain("miejsce");
    expect(svg).toContain("Ranking Biur");
  });

  it("bez długich myślników", () => {
    for (const svg of [badgeSvg(null), badgeSvg({ place: 3, cityName: "Gdańsk" })]) expect(svg).not.toMatch(/[\u2013\u2014]/);
  });
});

describe("badgeEmbedCode", () => {
  it("link do profilu, obrazek odznaki i tekst alternatywny z samą nazwą serwisu", () => {
    const code = badgeEmbedCode({ profileUrl: "https://example.pl/krakow/biuro-a", badgeUrl: "https://example.pl/odznaka/x.svg" });
    expect(code).toContain('href="https://example.pl/krakow/biuro-a"');
    expect(code).toContain('src="https://example.pl/odznaka/x.svg"');
    expect(code).toContain(`alt="Ranking Biur Nieruchomości ${AWARD.edition}"`);
    expect(code).not.toContain("nofollow");
  });
});
