import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { nieruchomosci } from "../portals/nieruchomosci";
import { rachunkowe } from "../portals/rachunkowe";
import { PARAMETERS, buildParameters, scoreListing, type RankingInput } from "@/lib/ranking";
import golden from "./fixtures/ranking-golden.json";

const NOW = new Date("2026-11-10T12:00:00Z");

// Wejścia i wyniki zebrane z kodu sprzed przeniesienia wag do konfiguracji portalu (stałe w lib/ranking.ts).
const FIXTURES: RankingInput[] = [
  { startDate: "2005-01-01", hasPublicPrices: true, verificationScore: 100, registryConfirmed: true, servicesCount: 8, offersCount: 25, googleRating: 4.8, googleCount: 50 },
  { startDate: null, hasPublicPrices: false, verificationScore: 80, servicesCount: 3 },
  { startDate: "2019-06-01", hasPublicPrices: true, verificationScore: 55, registryConfirmed: false, servicesCount: 2, offersCount: 7, googleRating: 3.9, googleCount: 12 },
  { startDate: "2024-02-01", hasPublicPrices: false, verificationScore: null, registryConfirmed: true, servicesCount: 0, offersCount: 0, googleRating: null, googleCount: null },
  { startDate: "2000-01-01", hasPublicPrices: true, verificationScore: 90, registryConfirmed: true, servicesCount: 6, offersCount: 20, googleRating: 5, googleCount: 30 },
  { startDate: null, hasPublicPrices: false, verificationScore: null, servicesCount: 0 },
];

describe("wagi rankingu z konfiguracji portalu", () => {
  it("portal nieruchomości daje dokładnie te same wyniki i rozbicia co dawne stałe", () => {
    FIXTURES.forEach((input, i) => {
      expect(scoreListing(input, NOW)).toEqual(golden[i]);
      expect(scoreListing(input, NOW, buildParameters(nieruchomosci.ranking.weights))).toEqual(golden[i]);
    });
  });

  it("wagi nieruchomości: te same parametry, kolejność i wartości co dotąd, suma 90", () => {
    const params = buildParameters(nieruchomosci.ranking.weights);
    expect(params.map((p) => [p.key, p.weight])).toEqual([
      ["rejestr", 20],
      ["staz", 10],
      ["jawnosc_cennika", 15],
      ["spojnosc_danych", 10],
      ["zakres_uslug", 10],
      ["opinie_google", 10],
      ["aktualne_oferty", 15],
    ]);
    expect(params.reduce((sum, p) => sum + p.weight, 0)).toBe(90);
    // PARAMETERS to wynik dla portalu ze zmiennej PORTAL (domyślnie nieruchomości).
    expect(PARAMETERS.map((p) => p.key)).toEqual(params.map((p) => p.key));
  });

  it("portal bez ofert nie ma parametru ofert, a pozostałe wagi są te same", () => {
    const params = buildParameters(rachunkowe.ranking.weights);
    expect(params.map((p) => p.key)).not.toContain("aktualne_oferty");
    expect(params.map((p) => [p.key, p.weight])).toEqual(buildParameters(nieruchomosci.ranking.weights).filter((p) => p.key !== "aktualne_oferty").map((p) => [p.key, p.weight]));
  });

  it("parametr bez wagi albo z wagą 0 jest pomijany, nieznany klucz ignorowany", () => {
    expect(buildParameters({ rejestr: 10, staz: 0, nieznany: 50 }).map((p) => p.key)).toEqual(["rejestr"]);
  });
});

describe("Premium nie wpływa na wynik", () => {
  const src = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

  it("wejście punktacji nie ma pól Premium i dodatkowe pola nic nie zmieniają", () => {
    const base = FIXTURES[0];
    const withPremium = {
      ...base,
      premium: true,
      premiumStatus: "published",
      longDescription: "x".repeat(4000),
      faq: [{ q: "a", a: "b" }],
      gallery: [{ url: "https://example.pl/a.jpg", alt: "" }],
    } as RankingInput;
    expect(scoreListing(withPremium, NOW)).toEqual(scoreListing(base, NOW));
    // Parametry rankingu to tylko dane zweryfikowane: żaden klucz nie dotyczy Premium ani płatności.
    for (const p of PARAMETERS) expect(p.key).not.toMatch(/premium|platn|plan|pakiet|faq|galeri/i);
  });

  it("kod punktacji i zapytania katalogu nie czytają listing_premium ani lib/premium", () => {
    for (const file of ["../lib/ranking.ts", "../lib/catalog.ts", "../lib/city-content.ts", "../lib/awards.ts"]) {
      const text = src(file);
      expect(text, file).not.toMatch(/listing_premium/);
      expect(text, file).not.toMatch(/from "\.\/premium"|from "@\/lib\/premium"/);
    }
    // Strona miasta (lista, pozycje, wyniki) też nie dotyka warstwy Premium.
    expect(src("../components/CityView.tsx")).not.toMatch(/premium/i);
  });

  it("RankingInput nie ma pól Premium w definicji typu", () => {
    const text = src("../lib/ranking.ts");
    const block = text.slice(text.indexOf("export type RankingInput"), text.indexOf("export type BreakdownItem"));
    expect(block).not.toMatch(/premium/i);
  });
});
