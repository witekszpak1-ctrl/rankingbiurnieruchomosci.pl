import { describe, expect, it } from "vitest";

import { nBiur, nMiast, nOfert, offersLabel, plural } from "@/lib/plural";
import { isPlausible, priceBasis, priceKind } from "@/lib/prices";

describe("odmiana liczebników", () => {
  it("1, 2-4, 5+, 12-14, 22-24", () => {
    expect([1, 2, 4, 5, 12, 14, 21, 22, 25, 112, 122].map((n) => plural(n, "oferta", "oferty", "ofert"))).toEqual([
      "oferta", "oferty", "oferty", "ofert", "ofert", "ofert", "ofert", "oferty", "ofert", "ofert", "oferty",
    ]);
    expect(nMiast(2)).toBe("2 miasta");
    expect(nOfert(4)).toBe("4 oferty");
    expect(nBiur(26)).toBe("26 biur");
    expect(nBiur(1)).toBe("1 biuro");
  });
  it("pełna próbka ofert to 'co najmniej'", () => {
    expect(offersLabel(7)).toBe("7 ofert na stronie");
    expect(offersLabel(3)).toBe("3 oferty na stronie");
    expect(offersLabel(20)).toBe("co najmniej 20 ofert na stronie");
  });
});

describe("ceny usług", () => {
  const p = (service: string, unit: "percent" | "pln", amountMin: number, amountMax: number | null = null) => ({ service, unit, amountMin, amountMax });
  it("rozpoznaje rodzaj ceny", () => {
    expect(priceKind("Sprzedaż mieszkania")).toBe("sale");
    expect(priceKind("zarządzanie najmem - pakiety")).toBe("management");
    expect(priceKind("znalezienie i weryfikacja najemcy")).toBe("rent_brokerage");
  });
  it("odrzuca nierealne stawki", () => {
    expect(isPlausible(p("sprzedaż mieszkania", "percent", 2.5))).toBe(true);
    expect(isPlausible(p("sprzedaż mieszkania", "percent", 92))).toBe(false);
    expect(isPlausible(p("zarządzanie najmem", "percent", 8, 16))).toBe(true);
    expect(isPlausible(p("wycena", "pln", 2_000_000))).toBe(false);
  });
  it("podaje podstawę stawki procentowej", () => {
    expect(priceBasis(p("sprzedaż domu", "percent", 4))).toBe("od ceny transakcyjnej");
    expect(priceBasis(p("zarządzanie najmem", "percent", 10))).toBe("od czynszu najmu, co miesiąc");
    expect(priceBasis(p("analiza dokumentów", "pln", 1000))).toBeNull();
  });
});
