import { createHash } from "node:crypto";

/**
 * Pomiary widoczności w AI: klucz pamięci podręcznej i wskaźniki. Czyste funkcje, bez bazy i bez dostawców.
 *
 * Zasady:
 * - pytanie porównujemy dosłownie (po złączeniu wielokrotnych spacji); "biuro nieruchomości Katowice" i
 *   "biura nieruchomości w Katowicach" to dwa różne pytania,
 * - pomiar z pamięci podręcznej jest używany tylko wtedy, gdy zgadzają się wszystkie parametry i nie jest starszy
 *   niż limit; klient zawsze widzi datę pomiaru,
 * - każdy wskaźnik ma liczbę pomiarów i przedział niepewności; przy małej próbie mówimy, że danych jest za mało.
 */

export type Platform = "chatgpt" | "gemini" | "perplexity" | "claude" | "copilot" | "google_ai_overview" | "google_ai_mode";

export function normalizePromptText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function promptHash(text: string): string {
  return createHash("sha256").update(normalizePromptText(text)).digest("hex");
}

export type MeasureParams = {
  promptText: string;
  platform: Platform;
  model: string | null;
  mode: "ui" | "api";
  webSearch: boolean;
  location: string | null;
  language: string;
};

export function cacheKey(p: MeasureParams): string {
  const parts = [
    promptHash(p.promptText),
    p.platform,
    p.model ?? "",
    p.mode,
    p.webSearch ? "web" : "noweb",
    (p.location ?? "").toLowerCase(),
    p.language.toLowerCase(),
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

/** Czy zapisany pomiar nadaje się do ponownego użycia (świeżość w dniach zależy od zastosowania). */
export function isFresh(measuredAt: Date | null, maxAgeDays: number, now = new Date()): boolean {
  if (!measuredAt) return false;
  return now.getTime() - measuredAt.getTime() <= maxAgeDays * 24 * 3600 * 1000;
}

export type MeasurementResult = {
  measurementId: string;
  platform: Platform;
  measuredAt: Date;
  /** Pozycje (od 1) wymienionych firm; klucz to identyfikator firmy (brand_id albo domena). */
  mentions: { companyKey: string; position: number; recommended: boolean }[];
  citedDomains: string[];
};

export type Interval = { value: number; low: number; high: number };

/** Przedział Wilsona 95% dla odsetka (lepszy od prostego przy małych próbach i wynikach bliskich 0 lub 1). */
export function wilson(successes: number, n: number, z = 1.96): Interval {
  if (n <= 0) return { value: 0, low: 0, high: 0 };
  const p = successes / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return { value: p, low: Math.max(0, center - half), high: Math.min(1, center + half) };
}

export const MIN_SAMPLE = 10;

export type Visibility = {
  sample: number;
  enoughData: boolean;
  firstMeasuredAt: Date | null;
  lastMeasuredAt: Date | null;
  mentionRate: Interval;
  recommendationRate: Interval;
  citationRate: Interval;
  shareOfVoice: number;                // wzmianki firmy / wszystkie wzmianki firm w tych odpowiedziach
  averagePosition: number | null;      // tylko z odpowiedzi, w których firma występuje
  byPlatform: Record<string, { sample: number; mentionRate: number }>;
};

/**
 * Wskaźniki dla jednej firmy na zbiorze pomiarów. companyKey: identyfikator firmy w mentions,
 * companyDomains: domeny firmy (do liczenia cytowań).
 */
export function visibility(results: MeasurementResult[], companyKey: string, companyDomains: string[]): Visibility {
  const domains = new Set(companyDomains.map((d) => d.toLowerCase().replace(/^www\./, "")));
  let mentioned = 0;
  let recommended = 0;
  let cited = 0;
  let own = 0;
  let all = 0;
  const positions: number[] = [];
  const byPlatform: Record<string, { sample: number; hits: number }> = {};
  let first: Date | null = null;
  let last: Date | null = null;
  for (const r of results) {
    const mine = r.mentions.filter((m) => m.companyKey === companyKey);
    all += r.mentions.length;
    own += mine.length;
    if (mine.length) {
      mentioned++;
      positions.push(Math.min(...mine.map((m) => m.position)));
      if (mine.some((m) => m.recommended)) recommended++;
    }
    if (r.citedDomains.some((d) => domains.has(d.toLowerCase().replace(/^www\./, "")))) cited++;
    const bp = (byPlatform[r.platform] ??= { sample: 0, hits: 0 });
    bp.sample++;
    if (mine.length) bp.hits++;
    if (!first || r.measuredAt < first) first = r.measuredAt;
    if (!last || r.measuredAt > last) last = r.measuredAt;
  }
  const n = results.length;
  return {
    sample: n,
    enoughData: n >= MIN_SAMPLE,
    firstMeasuredAt: first,
    lastMeasuredAt: last,
    mentionRate: wilson(mentioned, n),
    recommendationRate: wilson(recommended, n),
    citationRate: wilson(cited, n),
    shareOfVoice: all ? own / all : 0,
    averagePosition: positions.length ? positions.reduce((a, b) => a + b, 0) / positions.length : null,
    byPlatform: Object.fromEntries(Object.entries(byPlatform).map(([k, v]) => [k, { sample: v.sample, mentionRate: v.sample ? v.hits / v.sample : 0 }])),
  };
}

/**
 * Wynik widoczności 0-100: średnia ważona wskaźników (wagi jawne, opisane w metodologii). To podsumowanie pomiarów,
 * nie obiektywna ocena; zawsze pokazujemy go razem z liczbą pomiarów i datami.
 */
export const SCORE_WEIGHTS = { mention: 0.4, recommendation: 0.3, citation: 0.2, position: 0.1 } as const;

export function visibilityScore(v: Visibility): number | null {
  if (!v.enoughData) return null;
  const pos = v.averagePosition === null ? 0 : Math.max(0, 1 - (v.averagePosition - 1) / 10);
  const s =
    SCORE_WEIGHTS.mention * v.mentionRate.value +
    SCORE_WEIGHTS.recommendation * v.recommendationRate.value +
    SCORE_WEIGHTS.citation * v.citationRate.value +
    SCORE_WEIGHTS.position * pos;
  return Math.round(s * 100);
}
