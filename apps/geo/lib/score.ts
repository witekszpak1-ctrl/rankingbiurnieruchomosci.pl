/**
 * Pasma wyniku widoczności i ocena pojedynczych metryk względem celu. Czyste funkcje (bez bazy), używane przez
 * raport audytu i panel. Progi pasm są stałe i jawne na stronie.
 */

export type Tone = "good" | "warn" | "bad" | "neutral";

export type ScoreBand = { key: "low" | "mid" | "high"; label: string; from: number; to: number; tone: Tone };

export const SCORE_BANDS: readonly ScoreBand[] = [
  { key: "low", label: "Wymaga pracy", from: 0, to: 39, tone: "bad" },
  { key: "mid", label: "Dobra", from: 40, to: 69, tone: "warn" },
  { key: "high", label: "Bardzo dobra", from: 70, to: 100, tone: "good" },
];

/** Pasmo wyniku 0-100 (zaokrąglonego); null i wartości spoza zakresu dają null. */
export function scoreBand(score: number | null | undefined): ScoreBand | null {
  if (score === null || score === undefined || !Number.isFinite(score)) return null;
  const s = Math.round(score);
  if (s < 0 || s > 100) return null;
  return SCORE_BANDS.find((b) => s >= b.from && s <= b.to) ?? null;
}

/**
 * Ocena metryki względem celu. Dla wskaźników, w których więcej znaczy lepiej: od celu w górę "good", od połowy celu
 * "warn", poniżej "bad". Dla pozycji (mniej znaczy lepiej): do celu "good", do 1,5 celu "warn", dalej "bad".
 * Brak wartości (np. firma nigdy się nie pojawiła) to "bad", brak celu to "neutral".
 */
export function metricTone(value: number | null, target: number | null, higherIsBetter = true): Tone {
  if (target === null) return "neutral";
  if (value === null) return "bad";
  if (higherIsBetter) {
    if (value >= target) return "good";
    return value >= target / 2 ? "warn" : "bad";
  }
  if (value <= target) return "good";
  return value <= target * 1.5 ? "warn" : "bad";
}
