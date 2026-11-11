import { describe, expect, it } from "vitest";

import { evaluateGate } from "@/lib/gate";
import { PARAMETERS, median, rankListings, scoreListing } from "@/lib/ranking";

const NOW = new Date("2026-11-10T12:00:00Z");

describe("scoreListing", () => {
  it("daje 100 przy pełnych danych", () => {
    const { score } = scoreListing(
      { startDate: "2005-01-01", hasPublicPrices: true, verificationScore: 100, servicesCount: 8, offersCount: 25 },
      NOW,
    );
    expect(score).toBe(100);
  });

  it("pomija brakujący parametr i renormalizuje wagi", () => {
    const { score, breakdown } = scoreListing(
      { startDate: null, hasPublicPrices: false, verificationScore: 80, servicesCount: 3 },
      NOW,
    );
    expect(breakdown.map((b) => b.key)).toEqual(["jawnosc_cennika", "spojnosc_danych", "zakres_uslug", "aktualne_oferty"]);
    // (0*15 + 0.8*10 + 0.5*10 + 0*15) / 50 * 100 = 26
    expect(score).toBe(26);
  });

  it("daje 0 bez żadnych danych i nie dzieli przez zero", () => {
    const result = scoreListing({ startDate: null, hasPublicPrices: false, verificationScore: null, servicesCount: 0 }, NOW);
    expect(result.score).toBe(0);
  });

  it("staż rośnie liniowo do 15 lat", () => {
    const base = { hasPublicPrices: true, verificationScore: 100, servicesCount: 6, offersCount: 20 };
    const young = scoreListing({ ...base, startDate: "2026-01-01" }, NOW).score;
    const mid = scoreListing({ ...base, startDate: "2019-01-01" }, NOW).score;
    const old = scoreListing({ ...base, startDate: "2000-01-01" }, NOW).score;
    expect(young).toBeLessThan(mid);
    expect(mid).toBeLessThan(old);
    expect(old).toBe(100);
  });

  it("aktualne oferty podnoszą wynik", () => {
    const base = { startDate: "2010-01-01", hasPublicPrices: false, verificationScore: 90, servicesCount: 4 };
    const without = scoreListing(base, NOW).score;
    const some = scoreListing({ ...base, offersCount: 8 }, NOW).score;
    const many = scoreListing({ ...base, offersCount: 40 }, NOW).score;
    expect(without).toBeLessThan(some);
    expect(some).toBeLessThan(many);
  });

  it("opinie Google liczą się tylko gdy są, ocena i liczba opinii podnoszą wynik", () => {
    const base = { startDate: "2010-01-01", hasPublicPrices: true, verificationScore: 90, servicesCount: 4, offersCount: 10 };
    const none = scoreListing(base, NOW);
    expect(none.breakdown.find((b) => b.key === "opinie_google")).toBeUndefined();
    const few = scoreListing({ ...base, googleRating: 4.8, googleCount: 5 }, NOW).score;
    const many = scoreListing({ ...base, googleRating: 4.8, googleCount: 60 }, NOW).score;
    const bad = scoreListing({ ...base, googleRating: 2.1, googleCount: 60 }, NOW).score;
    expect(few).toBeLessThan(many);
    expect(bad).toBeLessThan(many);
  });

  it("nieprawidłowa data nie psuje wyniku", () => {
    const { breakdown } = scoreListing(
      { startDate: "nie-data", hasPublicPrices: true, verificationScore: 50, servicesCount: 1 },
      NOW,
    );
    expect(breakdown.find((b) => b.key === "staz")).toBeUndefined();
  });

  it("wagi parametrów zgadzają się z opisem metodologii", () => {
    expect(PARAMETERS.map((p) => p.weight)).toEqual([20, 10, 15, 10, 10, 10, 15]);
  });
});

describe("rankListings", () => {
  it("sortuje po wyniku malejąco, remisy alfabetycznie, pozycje od 1", () => {
    const items = [
      { name: "Żeta", s: 50 },
      { name: "Alfa", s: 50 },
      { name: "Beta", s: 90 },
    ];
    const ranked = rankListings(
      items,
      (i) => ({ startDate: null, hasPublicPrices: true, verificationScore: i.s, servicesCount: 6 }),
      NOW,
    );
    expect(ranked.map((r) => [r.position, r.name])).toEqual([
      [1, "Beta"],
      [2, "Alfa"],
      [3, "Żeta"],
    ]);
  });
});

describe("median", () => {
  it("liczy medianę parzystej i nieparzystej liczby wartości", () => {
    expect(median([])).toBeNull();
    expect(median([3])).toBe(3);
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
});

describe("evaluateGate", () => {
  const ok = { domainVerified: true, hasValidatedDescription: true, factsCount: 6, minFacts: 6 };
  it("przepuszcza komplet warunków", () => {
    expect(evaluateGate(ok)).toEqual({ ok: true, reasons: [] });
  });
  it("wypisuje każdy niespełniony warunek", () => {
    const result = evaluateGate({ domainVerified: false, hasValidatedDescription: false, factsCount: 2, minFacts: 6 });
    expect(result.ok).toBe(false);
    expect(result.reasons).toHaveLength(3);
    expect(result.reasons.join(" ")).toContain("2 z wymaganych 6");
  });
  it("próg faktów jest włącznie", () => {
    expect(evaluateGate({ ...ok, factsCount: 5 }).ok).toBe(false);
    expect(evaluateGate({ ...ok, factsCount: 6 }).ok).toBe(true);
  });
});

describe("firma bez potwierdzenia w rejestrze", () => {
  it("ma niższy wynik niż taka sama firma potwierdzona", () => {
    const base = { startDate: null, hasPublicPrices: false, verificationScore: 40, servicesCount: 4, offersCount: 10 };
    const confirmed = scoreListing({ ...base, registryConfirmed: true }).score;
    const unconfirmed = scoreListing({ ...base, registryConfirmed: false }).score;
    expect(unconfirmed).toBeLessThan(confirmed);
  });
});
