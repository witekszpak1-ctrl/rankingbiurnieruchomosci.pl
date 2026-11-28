import { describe, expect, it } from "vitest";

import {
  aiBotGroup, ageHours, buildAlerts, dailySeries, formatAge, formatCounts, formatDuration, formatUsd, groupUsage, litescrapeCostUsd, parsePortalForm, parseRunFilters,
  splitUsage, summarizeTraffic, topBots, trafficSeries, vercelProjectUrl, type AlertInput,
} from "@/lib/master";

const NOW = new Date("2026-11-28T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

function base(over: Partial<AlertInput> = {}): AlertInput {
  return {
    now: NOW,
    lastRuns: [{ stage: "search", status: "ok", startedAt: hoursAgo(1) }],
    failedRuns24h: [],
    failedMeasurements48h: { failed: 0, http503: 0 },
    lastMeasuredAt: hoursAgo(24),
    portals: [{ slug: "nieruchomosci", name: "Biura", status: "live", domain: "x.pl", published: 10, domains: 20 }],
    ...over,
  };
}

describe("koszty API", () => {
  it("liczy koszt LiteScrape 0,15 USD za 1000", () => {
    expect(litescrapeCostUsd(1000)).toBeCloseTo(0.15, 10);
    expect(litescrapeCostUsd(812)).toBeCloseTo(0.1218, 10);
    expect(litescrapeCostUsd(0)).toBe(0);
    expect(litescrapeCostUsd(-5)).toBe(0);
    expect(litescrapeCostUsd(Number.NaN)).toBe(0);
  });
  it("formatuje USD z przecinkiem i małymi kwotami z 4 miejscami", () => {
    expect(formatUsd(0.1218)).toBe("0,12 USD");
    expect(formatUsd(0.0015)).toBe("0,0015 USD");
    expect(formatUsd(0)).toBe("0,00 USD");
    expect(formatUsd(12.5)).toBe("12,50 USD");
  });
  it("grupuje miesiące od najnowszego i pomija puste wartości", () => {
    const g = groupUsage([
      { month: "2026-10", service: "litescrape", count: 5 },
      { month: "2026-11", service: "litescrape", count: 10 },
      { month: "2026-11", service: "serper", count: null },
      { month: "2026-11", service: "brave", count: -1 },
    ]);
    expect(g.map((m) => m.month)).toEqual(["2026-11", "2026-10"]);
    expect(g[0].services).toEqual({ litescrape: 10 });
  });
  it("rozdziela licznik główny, podliczniki i innych dostawców", () => {
    const s = splitUsage({ litescrape: 812, "litescrape:fetch": 600, "litescrape:search": 90, serper: 40, google_places: 3 });
    expect(s.litescrape).toBe(812);
    expect(s.litescrapeKinds).toEqual([{ kind: "fetch", count: 600 }, { kind: "search", count: 90 }]);
    expect(s.others).toEqual([{ service: "serper", count: 40 }, { service: "google_places", count: 3 }]);
  });
  it("bez licznika głównego sumuje podliczniki", () => {
    expect(splitUsage({ "litescrape:fetch": 5, "litescrape:search": 7 }).litescrape).toBe(12);
    expect(splitUsage({}).litescrape).toBe(0);
  });
});

describe("wiek i czas", () => {
  it("liczy wiek w godzinach i formatuje", () => {
    expect(ageHours(hoursAgo(3), NOW)).toBeCloseTo(3, 5);
    expect(ageHours(null, NOW)).toBeNull();
    expect(ageHours("nie-data", NOW)).toBeNull();
    expect(formatAge(0.2)).toBe("12 min temu");
    expect(formatAge(5)).toBe("5 godz. temu");
    expect(formatAge(72)).toBe("3 dni temu");
    expect(formatAge(null)).toBe("brak");
  });
  it("formatuje czas trwania przebiegu", () => {
    expect(formatDuration("2026-11-28T10:00:00Z", "2026-11-28T10:00:45Z")).toBe("45 s");
    expect(formatDuration("2026-11-28T10:00:00Z", "2026-11-28T10:12:00Z")).toBe("12 min");
    expect(formatDuration("2026-11-28T10:00:00Z", "2026-11-28T12:05:00Z")).toBe("2 godz. 5 min");
    expect(formatDuration("2026-11-28T10:00:00Z", null)).toBe("-");
  });
  it("skraca liczniki tylko do liczb", () => {
    expect(formatCounts({ a: 1, b: "x", c: 3, d: 4, e: 5, f: 6 })).toBe("a: 1, c: 3, d: 4, e: 5");
    expect(formatCounts({})).toBe("-");
    expect(formatCounts(null)).toBe("-");
  });
});

describe("alerty Wymaga uwagi", () => {
  it("zdrowy stan nie daje alertów", () => {
    expect(buildAlerts(base())).toEqual([]);
  });
  it("nieudane przebiegi z 24 godzin", () => {
    const a = buildAlerts(base({ failedRuns24h: [{ stage: "search", count: 2 }, { stage: "probe", count: 1 }] }));
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ key: "runs-failed", tone: "bad" });
    expect(a[0].title).toContain("3");
    expect(a[0].detail).toBe("search (2), probe (1)");
  });
  it("etap nieuruchomiony ponad 26 godzin, ale nie ręczny (starszy niż 7 dni)", () => {
    const a = buildAlerts(base({
      lastRuns: [
        { stage: "search", status: "ok", startedAt: hoursAgo(25) },
        { stage: "publish", status: "ok", startedAt: hoursAgo(30) },
        { stage: "crawl_deep", status: "ok", startedAt: hoursAgo(24 * 20) },
      ],
    }));
    expect(a.map((x) => x.key)).toEqual(["stage-stale-publish"]);
    expect(a[0].tone).toBe("warn");
  });
  it("nieudane pomiary: 503 podnosi ważność", () => {
    expect(buildAlerts(base({ failedMeasurements48h: { failed: 4, http503: 0 } }))[0]).toMatchObject({ key: "measure-failed", tone: "warn" });
    expect(buildAlerts(base({ failedMeasurements48h: { failed: 4, http503: 3 } }))[0]).toMatchObject({ key: "measure-failed", tone: "bad" });
  });
  it("pomiar starszy niż 8 dni i brak pomiarów", () => {
    expect(buildAlerts(base({ lastMeasuredAt: hoursAgo(24 * 9) }))[0].key).toBe("measure-old");
    expect(buildAlerts(base({ lastMeasuredAt: hoursAgo(24 * 8 - 1) }))).toEqual([]);
    expect(buildAlerts(base({ lastMeasuredAt: null }))[0].key).toBe("measure-none");
  });
  it("portale bez danych i prywatne bez domeny, planowane pomijane", () => {
    const a = buildAlerts(base({
      portals: [
        { slug: "rachunkowe", name: "Rachunkowe", status: "private", domain: null, published: 0, domains: 0 },
        { slug: "oze", name: "OZE", status: "private", domain: null, published: 0, domains: 12 },
        { slug: "architekci", name: "Architekci", status: "planned", domain: null, published: 0, domains: 0 },
        { slug: "nieruchomosci", name: "Biura", status: "live", domain: "x.pl", published: 3, domains: 5 },
      ],
    }));
    expect(a.map((x) => x.key).sort()).toEqual(["portals-empty", "portals-nodomain"]);
    expect(a.find((x) => x.key === "portals-empty")?.detail).toContain("Rachunkowe");
    expect(a.find((x) => x.key === "portals-empty")?.detail).not.toContain("OZE");
    expect(a.find((x) => x.key === "portals-nodomain")?.title).toContain("2");
  });
  it("sortuje od najpoważniejszych", () => {
    const a = buildAlerts(base({
      portals: [{ slug: "p", name: "P", status: "private", domain: null, published: 0, domains: 0 }],
      lastMeasuredAt: hoursAgo(24 * 10),
      failedRuns24h: [{ stage: "search", count: 1 }],
    }));
    expect(a.map((x) => x.tone)).toEqual(["bad", "warn", "neutral", "neutral"]);
  });
});

describe("boty i ruch", () => {
  it("rozpoznaje boty AI", () => {
    expect(aiBotGroup("OAI-SearchBot")).toBe("OpenAI");
    expect(aiBotGroup("ChatGPT-User")).toBe("OpenAI");
    expect(aiBotGroup("GPTBot")).toBe("OpenAI");
    expect(aiBotGroup("ClaudeBot")).toBe("Claude");
    expect(aiBotGroup("PerplexityBot")).toBe("Perplexity");
    expect(aiBotGroup("Googlebot")).toBeNull();
    expect(aiBotGroup(null)).toBeNull();
  });
  const rows = [
    { day: "2026-11-28", isBot: false, bot: null, views: 100, visitors: 40 },
    { day: "2026-11-20", isBot: false, bot: null, views: 50, visitors: 20 },
    { day: "2026-10-01", isBot: false, bot: null, views: 999, visitors: 99 }, // poza 30 dniami
    { day: "2026-11-27", isBot: true, bot: "GPTBot", views: 7, visitors: 1 },
    { day: "2026-11-10", isBot: true, bot: "ClaudeBot", views: 9, visitors: 1 }, // 30 dni, ale poza 7
    { day: "2026-11-26", isBot: true, bot: "Googlebot", views: 20, visitors: 1 },
    { day: "2026-11-25", isBot: true, bot: null, views: 3, visitors: 1 },
  ];
  it("podsumowuje 30 dni i boty AI z 7 dni", () => {
    const s = summarizeTraffic(rows, NOW);
    expect(s.humanViews30).toBe(150);
    expect(s.humanVisitors30).toBe(60);
    expect(s.botViews30).toBe(39);
    expect(s.aiBots7.total).toBe(7);
    expect(s.aiBots7.groups).toEqual({ OpenAI: 7, Claude: 0, Perplexity: 0 });
  });
  it("top botów z 7 dni i nazwa zastępcza", () => {
    const t = topBots(rows, NOW, 7);
    expect(t.map((b) => b.bot)).toEqual(["Googlebot", "GPTBot", "(bez nazwy)"]);
    expect(t[1].ai).toBe("OpenAI");
  });
  it("szereg dzienny uzupełnia zerami", () => {
    const s = trafficSeries(rows, NOW, 30);
    expect(s).toHaveLength(30);
    expect(s[29]).toEqual({ day: "2026-11-28", human: 100, bot: 0 });
    expect(s[0].day).toBe("2026-10-30");
    const d = dailySeries([{ day: "2026-11-28", value: 2 }, { day: "2026-11-28", value: 3 }], NOW, 3);
    expect(d).toEqual([{ day: "2026-11-26", value: 0 }, { day: "2026-11-27", value: 0 }, { day: "2026-11-28", value: 5 }]);
  });
});

describe("formularze i filtry", () => {
  it("waliduje edycję portalu", () => {
    expect(parsePortalForm({ domain: " HTTPS://Przyklad.PL/abc ", status: "live", notes: " ok " })).toEqual({ ok: true, domain: "przyklad.pl", status: "live", notes: "ok" });
    expect(parsePortalForm({ domain: "", status: "planned", notes: "" })).toEqual({ ok: true, domain: null, status: "planned", notes: null });
    expect(parsePortalForm({ domain: "zla domena", status: "live", notes: "" }).ok).toBe(false);
    expect(parsePortalForm({ domain: "a.pl", status: "x", notes: "" }).ok).toBe(false);
  });
  it("filtry przebiegów odrzucają nieznane wartości", () => {
    expect(parseRunFilters({ etap: "search", status: "failed", branza: "rachunkowe" })).toEqual({ stage: "search", status: "failed", vertical: "rachunkowe" });
    expect(parseRunFilters({ etap: "x'; drop", status: "zly", branza: ["a"] })).toEqual({ stage: "", status: "", vertical: "" });
  });
  it("adres projektu Vercel", () => {
    expect(vercelProjectUrl("portal-oze")).toBe("https://vercel.com/witek1/portal-oze");
    expect(vercelProjectUrl(null)).toBeNull();
  });
});
