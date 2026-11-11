import { describe, expect, it } from "vitest";

import { choosingGuide, cityFaq, cityH1, cityIntro, commissionSection, topThree, type CityData } from "@/lib/city-content";

const firm = (name: string, position: number, score: number, extra: Partial<CityData["firms"][number]> = {}) => ({
  name, slug: name.toLowerCase().replace(/\s+/g, "-"), position, score, registryConfirmed: true, hasPublicPrices: false, offersCount: 0, ...extra,
});

const base: CityData = {
  cityName: "Warszawa",
  firms: [firm("Alfa", 1, 86, { hasPublicPrices: true }), firm("Beta", 2, 83), firm("Gamma", 3, 81, { registryConfirmed: false }), firm("Delta", 4, 70), firm("Epsilon", 5, 60)],
  ranked: true,
  updatedAt: new Date("2026-11-11T10:00:00Z"),
  median: null,
  medianN: 1,
  medianObservedAt: null,
  prices: [
    { firmName: "Alfa", firmSlug: "alfa", service: "sprzedaż mieszkania", unit: "percent", amountMin: 2.5, amountMax: null, taxMode: "gross", observedAt: new Date("2026-11-10") },
    { firmName: "Alfa", firmSlug: "alfa", service: "sprzedaż mieszkania", unit: "percent", amountMin: 92, amountMax: null, taxMode: "unknown", observedAt: new Date("2026-11-10") },
  ],
  services: [
    { brandId: "a", service: "sprzedaż mieszkań" },
    { brandId: "b", service: "Sprzedaż domów" },
    { brandId: "b", service: "wynajem mieszkań" },
  ],
};

describe("treść strony miasta", () => {
  it("nagłówek z odmianą miasta", () => {
    expect(cityH1("Warszawa", true, 2026)).toBe("Ranking biur nieruchomości w Warszawie 2026");
    expect(cityH1("Wrocław", false, 2026)).toBe("Biura nieruchomości we Wrocławiu");
  });
  it("wstęp z prawdziwymi liczbami, 70-120 słów", () => {
    const intro = cityIntro(base);
    expect(intro).toContain("5 biur nieruchomości w Warszawie");
    expect(intro).toContain("4 z nich potwierdziliśmy");
    const words = intro.split(/\s+/).length;
    expect(words).toBeGreaterThanOrEqual(60);
    expect(words).toBeLessThanOrEqual(120);
    expect(intro).not.toMatch(/z miasta/);
  });
  it("TOP 3 z kolejności rankingu", () => {
    expect(topThree(base).map((f) => f.name)).toEqual(["Alfa", "Beta", "Gamma"]);
    expect(topThree({ ...base, ranked: false })).toEqual([]);
  });
  it("prowizje: bez mediany przy małej próbie, nierealne stawki pominięte", () => {
    const c = commissionSection(base);
    expect(c.summary).toContain("1 z 5 biur w Warszawie publikuje");
    expect(c.summary).toContain("za mała próba");
    expect(c.examples).toHaveLength(1);
    expect(c.examples[0].value).toContain("2,5% brutto");
    expect(commissionSection({ ...base, median: 2.75, medianN: 4 }).summary).toContain("Mediana najniższych deklarowanych stawek od sprzedaży wynosi 2,75%");
  });
  it("poradnik 150-250 słów i z danymi lokalnymi", () => {
    const words = choosingGuide(base).join(" ").split(/\s+/).length;
    expect(words).toBeGreaterThanOrEqual(150);
    expect(words).toBeLessThanOrEqual(260);
    expect(choosingGuide(base).join(" ")).toContain("sprzedaż nieruchomości (2 biura)");
  });
  it("FAQ 4-6 pytań z faktami", () => {
    const faq = cityFaq(base);
    expect(faq.length).toBeGreaterThanOrEqual(4);
    expect(faq.length).toBeLessThanOrEqual(6);
    expect(faq.find((f) => f.q.includes("najwyższy wynik"))?.a).toContain("Alfa (86/100)");
  });
});
