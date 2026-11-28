import { describe, expect, it } from "vitest";

import {
  BENCHMARK_LABEL,
  buildAudit,
  buildMetrics,
  computeBenchmark,
  topMentioned,
  weeklyHistory,
  type AuditInput,
  type AuditMeasurement,
  type AuditMention,
  type CompStat,
} from "@/lib/audit";

const FIRM = { brandId: "own", name: "Gamma Dom" };
const CITY = { name: "Wrocław", slug: "wroclaw" };

function mention(name: string, brandId: string | null, position: number, extra: Partial<AuditMention> = {}): AuditMention {
  return { name, domain: null, brandId, brandName: brandId ? name : null, position, recommended: false, ...extra };
}

function measure(i: number, mentions: AuditMention[], date: Date, cited: string[] = []): AuditMeasurement {
  return {
    id: `m${i}`,
    platform: ["gemini", "google_ai_mode", "google_ai_overview"][i % 3],
    measuredAt: date,
    promptText: `pytanie ${i % 3}`,
    mentions,
    citations: cited.map((domain) => ({ domain, isOwnPortal: false })),
  };
}

const day = (d: number) => new Date(Date.UTC(2026, 10, d, 9, 0, 0));

function input(measurements: AuditMeasurement[], history?: AuditMeasurement[]): AuditInput {
  return { domain: "gamma.pl", firm: FIRM, city: CITY, profileUrl: null, measurements, history };
}

describe("computeBenchmark", () => {
  const stat = (answers: number, recommended: number, mentionCount: number, cited: number, positions: number[], hasDomain = true): CompStat => ({
    answers,
    recommended,
    mentionCount,
    citedAnswers: cited,
    positions,
    hasDomain,
  });

  it("uśrednia 3 najczęściej wymieniane firmy i podpisuje cel", () => {
    const b = computeBenchmark([stat(10, 5, 10, 4, [1, 1]), stat(8, 2, 8, 2, [2, 4]), stat(6, 1, 6, 0, [3]), stat(1, 0, 1, 0, [9])], 20, 40);
    expect(b).not.toBeNull();
    expect(b!.firms).toBe(3);
    expect(b!.label).toBe(BENCHMARK_LABEL);
    expect(b!.mention).toBeCloseTo((10 / 20 + 8 / 20 + 6 / 20) / 3, 10);
    expect(b!.recommendation).toBeCloseTo((5 / 20 + 2 / 20 + 1 / 20) / 3, 10);
    expect(b!.citation).toBeCloseTo((4 / 20 + 2 / 20 + 0) / 3, 10);
    expect(b!.shareOfVoice).toBeCloseTo(8 / 40, 10);
    expect(b!.averagePosition).toBeCloseTo((1 + 3 + 3) / 3, 10);
  });

  it("przy mniej niż 3 firmach mówi, ile firm uśredniono", () => {
    const b = computeBenchmark([stat(5, 1, 5, 0, [2])], 10, 10);
    expect(b!.firms).toBe(1);
    expect(b!.label).toContain("1 najczęściej");
  });

  it("pomija cytowania firm bez znanej domeny", () => {
    const b = computeBenchmark([stat(5, 1, 5, 0, [2], false), stat(4, 1, 4, 2, [2], true)], 10, 10);
    expect(b!.citation).toBeCloseTo(0.2, 10);
    const none = computeBenchmark([stat(5, 1, 5, 0, [2], false)], 10, 10);
    expect(none!.citation).toBeNull();
  });

  it("zwraca null bez konkurentów albo bez próby", () => {
    expect(computeBenchmark([], 10, 0)).toBeNull();
    expect(computeBenchmark([stat(1, 0, 1, 0, [1])], 0, 0)).toBeNull();
  });
});

describe("buildMetrics", () => {
  const bench = { firms: 3, label: BENCHMARK_LABEL, mention: 0.4, recommendation: 0.2, citation: 0.1, shareOfVoice: 0.25, averagePosition: 2 };

  it("ocenia metryki względem celu (kolory)", () => {
    const rows = buildMetrics({ mention: 0.45, recommendation: 0.12, citation: 0.02, shareOfVoice: 0.25, averagePosition: 2.5 }, bench);
    const by = Object.fromEntries(rows.map((r) => [r.key, r]));
    expect(rows.map((r) => r.key)).toEqual(["mention", "recommendation", "citation", "shareOfVoice", "position"]);
    expect(by.mention.tone).toBe("good");
    expect(by.recommendation.tone).toBe("warn"); // 0,12 >= połowa 0,2
    expect(by.citation.tone).toBe("bad"); // 0,02 < połowa 0,1
    expect(by.shareOfVoice.tone).toBe("good"); // równo z celem
    expect(by.position.tone).toBe("warn"); // 2,5 <= 1,5 x 2
    expect(by.position.target).toBe(2);
  });

  it("brak pozycji firmy to ocena zła, brak benchmarku to brak oceny", () => {
    const rows = buildMetrics({ mention: 0, recommendation: 0, citation: 0, shareOfVoice: 0, averagePosition: null }, bench);
    expect(rows.find((r) => r.key === "position")!.tone).toBe("bad");
    const noBench = buildMetrics({ mention: 0.3, recommendation: 0, citation: 0, shareOfVoice: 0, averagePosition: 3 }, null);
    expect(noBench.every((r) => r.tone === "neutral" && r.target === null)).toBe(true);
  });
});

describe("weeklyHistory", () => {
  const own = (m: AuditMention) => m.brandId === "own";
  it("grupuje po tygodniach (poniedziałek UTC) i liczy odsetek wzmianek", () => {
    // 2026-11-23 to poniedziałek.
    const ms = [
      measure(0, [mention("Gamma Dom", "own", 1)], day(23)),
      measure(1, [mention("Alfa", "a", 1)], day(25)),
      measure(2, [mention("Gamma Dom", "own", 2)], day(29)), // niedziela, ten sam tydzień
      measure(3, [mention("Alfa", "a", 1)], day(30)), // następny poniedziałek
      measure(4, [], day(16)),
    ];
    const h = weeklyHistory(ms, own);
    expect(h.map((p) => p.weekStart)).toEqual(["2026-11-16", "2026-11-23", "2026-11-30"]);
    expect(h[1]).toMatchObject({ sample: 3, mentioned: 2, lowSample: true });
    expect(h[1].rate).toBeCloseTo(2 / 3, 10);
    expect(h[0]).toMatchObject({ sample: 1, mentioned: 0, rate: 0 });
    expect(h[2]).toMatchObject({ sample: 1, mentioned: 0 });
  });

  it("tydzień z co najmniej 10 odpowiedziami nie jest oznaczony jako mała próba", () => {
    const ms = Array.from({ length: 10 }, (_, i) => measure(i, [mention("Gamma Dom", "own", 1)], day(23 + (i % 3))));
    expect(weeklyHistory(ms, own)[0]).toMatchObject({ sample: 10, lowSample: false, rate: 1 });
  });

  it("pusta lista daje pustą historię", () => {
    expect(weeklyHistory([], own)).toEqual([]);
  });
});

describe("topMentioned", () => {
  it("liczy firmy raz na odpowiedź i sortuje malejąco", () => {
    const ms = [
      measure(0, [mention("Alfa", "a", 1), mention("Alfa", "a", 3), mention("Beta", "b", 2)], day(23)),
      measure(1, [mention("Beta", "b", 1)], day(23)),
      measure(2, [mention("Beta", "b", 1), mention("Nowa firma", null, 2)], day(23)),
    ];
    const top = topMentioned(ms, 2);
    expect(top.map((t) => [t.name, t.answers])).toEqual([["Beta", 3], ["Alfa", 1]]);
    expect(top[0].share).toBe(1);
    expect(topMentioned(ms, 10)).toHaveLength(3);
  });
});

describe("buildAudit: benchmark, rozbicie i historia", () => {
  // 12 odpowiedzi w dwóch tygodniach; Alfa w 10, Beta w 6, Gamma (firma) w 3.
  const ms: AuditMeasurement[] = Array.from({ length: 12 }, (_, i) => {
    const mentions: AuditMention[] = [];
    if (i < 10) mentions.push(mention("Alfa", "a", 1, { recommended: i < 4, domain: "alfa.pl" }));
    if (i % 2 === 0) mentions.push(mention("Beta", "b", 2, { domain: "beta.pl" }));
    if (i < 3) mentions.push(mention("Gamma Dom", "own", 3, { domain: "gamma.pl" }));
    return measure(i, mentions, i < 6 ? day(18 + (i % 3)) : day(25 + (i % 3)), i % 4 === 0 ? ["alfa.pl"] : []);
  });

  it("buduje benchmark z konkurentów i tabelę metryk", () => {
    const a = buildAudit(input(ms));
    expect(a.enoughData).toBe(true);
    expect(a.benchmark).not.toBeNull();
    expect(a.benchmark!.firms).toBe(2); // tylko dwóch konkurentów
    expect(a.benchmark!.mention).toBeCloseTo((10 / 12 + 6 / 12) / 2, 10);
    expect(a.metrics).toHaveLength(5);
    const mention_ = a.metrics.find((m) => m.key === "mention")!;
    expect(mention_.value).toBeCloseTo(3 / 12, 10);
    expect(mention_.tone).toBe("bad"); // 0,25 < połowa 0,67
    expect(a.shareOfVoice).toBeCloseTo(3 / (10 + 6 + 3), 10);
    expect(a.averagePosition).toBe(3);
  });

  it("buduje historię z osobnego zbioru, gdy jest podany, inaczej z pomiarów audytu", () => {
    const withMeasurements = buildAudit(input(ms));
    expect(withMeasurements.history.enough).toBe(true);
    expect(withMeasurements.history.points.map((p) => p.weekStart)).toEqual(["2026-11-16", "2026-11-23"]);
    const oneWeek = buildAudit(input(ms, ms.slice(0, 6)));
    expect(oneWeek.history.enough).toBe(false);
    expect(oneWeek.history.points).toHaveLength(1);
  });

  it("przy próbie poniżej progu nie podaje benchmarku, metryk ani udziału", () => {
    const a = buildAudit(input(ms.slice(0, 5)));
    expect(a.enoughData).toBe(false);
    expect(a.benchmark).toBeNull();
    expect(a.metrics).toEqual([]);
    expect(a.shareOfVoice).toBeNull();
    expect(a.averagePosition).toBeNull();
  });

  it("wnioski mają stan i odnośnik do sekcji z danymi", () => {
    const a = buildAudit(input(ms));
    expect(a.recommendations.some((r) => r.anchor === "konkurencja")).toBe(true);
    expect(a.recommendations.some((r) => r.anchor === "zrodla")).toBe(true);
    const own = a.recommendations.find((r) => r.text.startsWith("Twoja firma pojawia się"));
    expect(own?.done).toBe(false); // wzmianki są, ale brak poleceń
  });
});
