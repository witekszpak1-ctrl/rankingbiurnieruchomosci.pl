import { describe, expect, it } from "vitest";

import { cacheKey, isFresh, promptHash, visibility, visibilityScore, wilson, type MeasurementResult } from "@/lib/measure";

const base = { promptText: "Jakie biuro nieruchomości polecacie w Katowicach?", platform: "chatgpt" as const, model: null, mode: "ui" as const, webSearch: true, location: "Poland", language: "pl" };

describe("klucz pamięci podręcznej", () => {
  it("spacje nie zmieniają pytania, ale inne słowa tak", () => {
    expect(promptHash("a  b ")).toBe(promptHash("a b"));
    expect(cacheKey(base)).toBe(cacheKey({ ...base, promptText: "Jakie  biuro nieruchomości polecacie w Katowicach? " }));
    expect(cacheKey(base)).not.toBe(cacheKey({ ...base, promptText: "Jakie biuro nieruchomości polecacie w Katowicach" }));
  });
  it("każdy parametr zmienia klucz", () => {
    const k = cacheKey(base);
    expect(cacheKey({ ...base, platform: "gemini" })).not.toBe(k);
    expect(cacheKey({ ...base, mode: "api" })).not.toBe(k);
    expect(cacheKey({ ...base, webSearch: false })).not.toBe(k);
    expect(cacheKey({ ...base, location: "Germany" })).not.toBe(k);
    expect(cacheKey({ ...base, language: "en" })).not.toBe(k);
    expect(cacheKey({ ...base, model: "gpt-5" })).not.toBe(k);
  });
  it("świeżość", () => {
    const now = new Date("2026-12-10T00:00:00Z");
    expect(isFresh(new Date("2026-12-04T00:00:00Z"), 7, now)).toBe(true);
    expect(isFresh(new Date("2026-12-02T00:00:00Z"), 7, now)).toBe(false);
    expect(isFresh(null, 7, now)).toBe(false);
  });
});

describe("wskaźniki", () => {
  const at = new Date("2026-12-01T00:00:00Z");
  const r = (platform: "chatgpt" | "gemini", mentions: [string, number, boolean][], cited: string[] = []): MeasurementResult => ({
    measurementId: Math.random().toString(), platform, measuredAt: at,
    mentions: mentions.map(([companyKey, position, recommended]) => ({ companyKey, position, recommended })), citedDomains: cited,
  });
  const results = [
    r("chatgpt", [["a", 1, true], ["b", 2, false]], ["www.firma-a.pl"]),
    r("chatgpt", [["b", 1, true]]),
    r("gemini", [["a", 3, false], ["c", 1, true]]),
    r("gemini", []),
  ];
  it("liczy odsetki, udział i pozycję", () => {
    const v = visibility(results, "a", ["firma-a.pl"]);
    expect(v.sample).toBe(4);
    expect(v.mentionRate.value).toBe(0.5);
    expect(v.recommendationRate.value).toBe(0.25);
    expect(v.citationRate.value).toBe(0.25);
    expect(v.shareOfVoice).toBeCloseTo(2 / 5);
    expect(v.averagePosition).toBe(2);
    expect(v.byPlatform).toEqual({ chatgpt: { sample: 2, mentionRate: 0.5 }, gemini: { sample: 2, mentionRate: 0.5 } });
    expect(v.enoughData).toBe(false);
    expect(visibilityScore(v)).toBeNull(); // za mało pomiarów
  });
  it("przedział Wilsona jest szeroki przy małej próbie", () => {
    const small = wilson(1, 2);
    const big = wilson(50, 100);
    expect(small.high - small.low).toBeGreaterThan(big.high - big.low);
    expect(wilson(0, 0)).toEqual({ value: 0, low: 0, high: 0 });
  });
  it("wynik 0-100 przy wystarczającej próbie", () => {
    const many = Array.from({ length: 10 }, () => r("chatgpt", [["a", 1, true]], ["firma-a.pl"]));
    expect(visibilityScore(visibility(many, "a", ["firma-a.pl"]))).toBe(100);
    const none = Array.from({ length: 10 }, () => r("chatgpt", [["b", 1, true]]));
    expect(visibilityScore(visibility(none, "a", []))).toBe(0);
  });
});
