import { describe, expect, it } from "vitest";

import { fillDays } from "@/lib/admin-stats";
import { buildAudit, type AuditMeasurement } from "@/lib/audit";
import { arcPath, countAxis, formatInt, formatPct, niceMax, polar, rateAxis, shortDate, weekStartUtc } from "@/lib/chart";
import { buildExample } from "@/lib/landing";
import { attentionItems, hasPaidPlan, primaryAccount, setupSteps, type PanelAccount, type PanelFacts } from "@/lib/panel";
import { describeEntitlements, formatPlanPrice, toPlanView } from "@/lib/plans";
import { SCORE_BANDS, metricTone, scoreBand } from "@/lib/score";
import { parseEntitlements } from "@/lib/entitlements";

describe("scoreBand", () => {
  it("dzieli 0-100 na trzy pasma", () => {
    expect(SCORE_BANDS.map((b) => b.label)).toEqual(["Wymaga pracy", "Dobra", "Bardzo dobra"]);
    expect(scoreBand(0)?.key).toBe("low");
    expect(scoreBand(39)?.key).toBe("low");
    expect(scoreBand(40)?.key).toBe("mid");
    expect(scoreBand(69)?.key).toBe("mid");
    expect(scoreBand(70)?.key).toBe("high");
    expect(scoreBand(100)?.key).toBe("high");
    expect(scoreBand(39.6)?.key).toBe("mid"); // zaokrąglamy do całości
  });
  it("brak wyniku albo wartość spoza zakresu to null", () => {
    expect(scoreBand(null)).toBeNull();
    expect(scoreBand(undefined)).toBeNull();
    expect(scoreBand(101)).toBeNull();
    expect(scoreBand(-1)).toBeNull();
    expect(scoreBand(Number.NaN)).toBeNull();
  });
});

describe("metricTone", () => {
  it("więcej znaczy lepiej", () => {
    expect(metricTone(0.5, 0.5)).toBe("good");
    expect(metricTone(0.25, 0.5)).toBe("warn");
    expect(metricTone(0.24, 0.5)).toBe("bad");
    expect(metricTone(0, 0)).toBe("good");
  });
  it("mniej znaczy lepiej (pozycja)", () => {
    expect(metricTone(2, 2, false)).toBe("good");
    expect(metricTone(3, 2, false)).toBe("warn");
    expect(metricTone(3.1, 2, false)).toBe("bad");
  });
  it("brak wartości i brak celu", () => {
    expect(metricTone(null, 0.5)).toBe("bad");
    expect(metricTone(0.5, null)).toBe("neutral");
  });
});

describe("geometria wykresów", () => {
  it("polar: 0 stopni to góra, 90 to prawo", () => {
    const top = polar(100, 100, 50, 0);
    expect(top.x).toBeCloseTo(100);
    expect(top.y).toBeCloseTo(50);
    const right = polar(100, 100, 50, 90);
    expect(right.x).toBeCloseTo(150);
    expect(right.y).toBeCloseTo(100);
  });
  it("arcPath ustawia flagę dużego łuku powyżej 180 stopni", () => {
    expect(arcPath(100, 100, 80, -135, 0)).toMatch(/ 0 0 1 /);
    expect(arcPath(100, 100, 80, -135, 135)).toMatch(/ 0 1 1 /);
  });
  it("niceMax i osie", () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(7)).toBe(10);
    expect(niceMax(18)).toBe(20);
    expect(niceMax(21)).toBe(25);
    expect(niceMax(260)).toBe(500);
    expect(rateAxis(0.15)).toEqual({ max: 0.2, ticks: [0, 0.05, 0.1, 0.15, 0.2] });
    expect(rateAxis(0.45).max).toBe(0.5);
    expect(rateAxis(0.9).ticks).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(countAxis(7).ticks).toEqual([0, 2, 4, 6, 8, 10]);
    expect(countAxis(18)).toEqual({ max: 20, ticks: [0, 5, 10, 15, 20] });
    expect(countAxis(0).max).toBe(1);
    expect(countAxis(3).ticks.every(Number.isInteger)).toBe(true);
  });
  it("daty i liczby po polsku", () => {
    expect(shortDate("2026-11-23")).toBe("23 lis");
    expect(shortDate("2026-01-05T10:00:00Z")).toBe("5 sty");
    expect(shortDate("bzdura")).toBe("");
    expect(weekStartUtc(new Date(Date.UTC(2026, 10, 29)))).toBe("2026-11-23"); // niedziela
    expect(weekStartUtc(new Date(Date.UTC(2026, 10, 23)))).toBe("2026-11-23");
    expect(formatInt(12345)).toBe("12 345");
    expect(formatPct(0.254)).toBe("25%");
    expect(formatPct(0.254, 1)).toBe("25,4%");
  });
});

describe("fillDays", () => {
  it("uzupełnia brakujące dni zerami i kończy na podanym dniu", () => {
    const out = fillDays([{ day: "2026-11-27", count: 4 }, { day: "2026-11-25", count: 2 }], "2026-11-28", 5);
    expect(out.map((p) => p.day)).toEqual(["2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28"]);
    expect(out.map((p) => p.count)).toEqual([0, 2, 0, 4, 0]);
  });
  it("błędne wejście daje pustą listę", () => {
    expect(fillDays([], "nie-data", 5)).toEqual([]);
    expect(fillDays([], "2026-11-28", 0)).toEqual([]);
  });
});

describe("plany", () => {
  const e = parseEntitlements({ prompts: 50, platforms: ["chatgpt", "gemini"], frequency: "weekly", domains: 1, competitors: 10, reports: ["basic", "history", "sources"], alerts: true });
  it("opisuje uprawnienia po polsku, bez żargonu", () => {
    const f = describeEntitlements(e);
    expect(f).toContain("50 pytań o Twoją firmę w asystentach AI");
    expect(f).toContain("Platformy: ChatGPT, Gemini");
    expect(f).toContain("Pomiar co tydzień");
    expect(f).toContain("1 domena");
    expect(f).toContain("Powiadomienia o zmianach");
    expect(f.some((x) => x.startsWith("Raporty: historia zmian"))).toBe(true);
    expect(f).not.toContain("Rozszerzony profil w katalogu");
  });
  it("odmienia liczebniki", () => {
    expect(describeEntitlements(parseEntitlements({ prompts: 1, domains: 1 }))[0]).toMatch(/^1 pytanie/);
    expect(describeEntitlements(parseEntitlements({ prompts: 3, domains: 3 }))[0]).toMatch(/^3 pytania/);
    expect(describeEntitlements(parseEntitlements({ prompts: 12, domains: 12 }))[0]).toMatch(/^12 pytań/);
    expect(describeEntitlements(parseEntitlements({ domains: 10 })).some((x) => x === "10 domen")).toBe(true);
  });
  it("formatuje ceny: darmowy, całe złote, agencja od", () => {
    expect(formatPlanPrice(toPlanView({ id: "free", name: "Free", price: "0", entitlements: {} }))).toBe("0 zł");
    expect(formatPlanPrice(toPlanView({ id: "monitor", name: "Monitor", price: "9900", entitlements: {} }))).toBe("99 zł");
    expect(formatPlanPrice(toPlanView({ id: "agency", name: "Agency", price: "79000", entitlements: {} }))).toBe("od 790 zł");
    expect(formatPlanPrice(toPlanView({ id: "x", name: "X", price: "12950", entitlements: {} }))).toBe("129,50 zł");
    expect(toPlanView({ id: "growth", name: "Growth", price: "29900", entitlements: {} }).highlight).toBe(true);
  });
});

describe("pulpit klienta", () => {
  const acc = (over: Partial<PanelAccount> = {}): PanelAccount => ({ id: "1", name: "Firma", domain: "firma.pl", planId: null, planName: null, status: null, ...over });
  const facts = (over: Partial<PanelFacts> = {}): PanelFacts => ({ accounts: [acc()], hasAffiliate: false, affiliateClicks: 0, ...over });

  it("wybiera konto z domeną i rozpoznaje płatny pakiet", () => {
    expect(primaryAccount([acc({ id: "a", domain: null }), acc({ id: "b" })])?.id).toBe("b");
    expect(primaryAccount([])).toBeNull();
    expect(hasPaidPlan([acc({ planId: "free", status: "active" })])).toBe(false);
    expect(hasPaidPlan([acc({ planId: "monitor", status: "active" })])).toBe(true);
    expect(hasPaidPlan([acc({ planId: "monitor", status: "canceled" })])).toBe(false);
  });

  it("kroki startowe odzwierciedlają prawdziwy stan", () => {
    const none = setupSteps({ accounts: [], hasAffiliate: false, affiliateClicks: 0 }, null);
    expect(none.map((s) => s.done)).toEqual([false, false, false, false]);
    expect(none.map((s) => s.key)).toEqual(["domain", "audit", "partner", "plan"]);
    const audit = buildAudit({ domain: "firma.pl", firm: null, city: null, profileUrl: null, measurements: [] });
    const some = setupSteps(facts({ hasAffiliate: true, accounts: [acc({ planId: "growth", status: "active" })] }), { ...audit, status: "ok" });
    expect(some.map((s) => s.done)).toEqual([true, true, true, true]);
    const stepsNoAudit = setupSteps(facts(), audit);
    expect(stepsNoAudit.map((s) => s.done)).toEqual([true, false, false, false]);
    expect(stepsNoAudit[1].href).toBe("/audyt/firma.pl");
  });

  it("lista uwagi: brak firmy, brak domeny, domena spoza katalogu", () => {
    expect(attentionItems({ accounts: [], hasAffiliate: false, affiliateClicks: 0 }, null)[0].text).toMatch(/konta firmy/);
    expect(attentionItems(facts({ accounts: [acc({ domain: null })] }), null)[0].text).toMatch(/adresu strony/);
    const audit = buildAudit({ domain: "firma.pl", firm: null, city: null, profileUrl: null, measurements: [] });
    expect(attentionItems(facts(), audit)[0].text).toMatch(/nie ma w naszym katalogu/);
    const partnerNoClicks = attentionItems(facts({ hasAffiliate: true }), audit);
    expect(partnerNoClicks.some((i) => i.text.includes("link partnerski"))).toBe(true);
  });
});

describe("przykład na stronie głównej", () => {
  const ms: AuditMeasurement[] = Array.from({ length: 12 }, (_, i) => ({
    id: `m${i}`,
    platform: "gemini",
    measuredAt: new Date(Date.UTC(2026, 10, 20 + (i % 3), 8)),
    promptText: "pytanie",
    mentions: [
      { name: "Alfa", domain: "alfa.pl", brandId: "a", brandName: "Alfa", position: 1, recommended: i < 6 },
      ...(i % 2 === 0 ? [{ name: "Beta", domain: "beta.pl", brandId: "b", brandName: "Beta", position: 2, recommended: false }] : []),
    ],
    citations: [],
  }));
  const city = { name: "Wrocław", slug: "wroclaw" };

  it("zwraca trzech najczęściej wymienianych i wynik firmy z katalogu", () => {
    const ex = buildExample(city, ms, new Map([["a", "alfa.pl"], ["b", "beta.pl"]]));
    expect(ex).not.toBeNull();
    expect(ex!.city).toBe("Wrocław");
    expect(ex!.sample).toBe(12);
    expect(ex!.top.map((t) => t.name)).toEqual(["Alfa", "Beta"]);
    expect(ex!.measuredAt).toBe(new Date(Date.UTC(2026, 10, 22, 8)).toISOString());
    expect(ex!.firm?.name).toBe("Alfa");
    expect(typeof ex!.firm?.score).toBe("number");
  });

  it("przy próbie poniżej progu wynik jest pusty (za mało danych), a bez pomiarów nie ma przykładu", () => {
    const small = buildExample(city, ms.slice(0, 4), new Map([["a", "alfa.pl"]]));
    expect(small!.firm?.score).toBeNull();
    expect(buildExample(city, [], new Map())).toBeNull();
  });

  it("bez znanej domeny firmy z katalogu nie podaje wyniku firmy", () => {
    expect(buildExample(city, ms, new Map())!.firm).toBeNull();
  });
});
