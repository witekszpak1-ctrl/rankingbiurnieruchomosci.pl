/**
 * Ranking v0: tylko parametry, na które są dane w bazie. Wagi to wartości startowe z docs/PLAN.md (sekcja 7),
 * parametry bez danych są pomijane, a wagi renormalizowane. Płatność nie ma wpływu na wynik.
 * Metodologia jest publicznie opisana na /metodologia i musi być zgodna z tym plikiem.
 */

export const CITY_RANKING_MIN = 5; // poniżej tej liczby firm pokazujemy listę, nie ranking
export const PRICE_STAT_MIN = 3; // minimalna próba do publikacji mediany prowizji

export const PARAMETERS = [
  { key: "staz", label: "Staż w rejestrze", weight: 10, description: "Lata od wpisu do rejestru (pełna punktacja od 15 lat)." },
  { key: "jawnosc_cennika", label: "Jawność cennika", weight: 15, description: "Firma publikuje ceny usług na swojej stronie." },
  { key: "spojnosc_danych", label: "Spójność danych", weight: 10, description: "Zgodność strony firmy z danymi rejestrów (NIP, nazwa, adres)." },
  { key: "zakres_uslug", label: "Zakres usług", weight: 10, description: "Liczba usług, które firma wprost wymienia (pełna punktacja od 6)." },
] as const;

export type RankingInput = {
  startDate: Date | string | null;
  hasPublicPrices: boolean;
  verificationScore: number | null;
  servicesCount: number;
};

export type BreakdownItem = { key: string; label: string; value: number; weight: number };
export type Scored = { score: number; breakdown: BreakdownItem[] };

const YEAR_MS = 365.25 * 24 * 3600 * 1000;

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

export function scoreListing(input: RankingInput, now: Date = new Date()): Scored {
  const values: Record<string, number | null> = {
    staz: null,
    jawnosc_cennika: input.hasPublicPrices ? 1 : 0,
    spojnosc_danych: input.verificationScore == null ? null : clamp01(input.verificationScore / 100),
    zakres_uslug: clamp01(input.servicesCount / 6),
  };
  if (input.startDate) {
    const start = new Date(input.startDate);
    if (!Number.isNaN(start.getTime())) {
      values.staz = clamp01((now.getTime() - start.getTime()) / YEAR_MS / 15);
    }
  }
  const breakdown: BreakdownItem[] = [];
  for (const p of PARAMETERS) {
    const value = values[p.key];
    if (value != null) breakdown.push({ key: p.key, label: p.label, value, weight: p.weight });
  }
  const totalWeight = breakdown.reduce((sum, b) => sum + b.weight, 0);
  if (totalWeight === 0) return { score: 0, breakdown };
  const weighted = breakdown.reduce((sum, b) => sum + b.value * b.weight, 0);
  return { score: Math.round((weighted / totalWeight) * 100), breakdown };
}

export type Ranked<T> = T & { position: number; score: number; breakdown: BreakdownItem[] };

/** Sortuje malejąco po wyniku, remisy alfabetycznie po nazwie. Pozycje od 1. */
export function rankListings<T extends { name: string }>(
  items: T[],
  toInput: (item: T) => RankingInput,
  now: Date = new Date(),
): Ranked<T>[] {
  return items
    .map((item) => ({ item, scored: scoreListing(toInput(item), now) }))
    .sort((a, b) => b.scored.score - a.scored.score || a.item.name.localeCompare(b.item.name, "pl"))
    .map(({ item, scored }, index) => ({ ...item, position: index + 1, ...scored }));
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
