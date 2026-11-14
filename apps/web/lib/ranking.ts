/**
 * Ranking: tylko parametry, na które są dane w bazie. Parametry bez danych są pomijane, a wagi pozostałych
 * przeliczane proporcjonalnie. Płatność nie ma wpływu na wynik.
 * Metodologia jest publicznie opisana na /metodologia i musi być zgodna z tym plikiem.
 */

export const CITY_RANKING_MIN = 5; // poniżej tej liczby firm pokazujemy listę, nie ranking
export const PRICE_STAT_MIN = 3; // minimalna próba do publikacji mediany prowizji

export const PARAMETERS = [
  { key: "rejestr", label: "Potwierdzenie w rejestrze", weight: 20, whenMissing: "0 punktów: brak potwierdzenia to wynik sprawdzenia", description: "Firma potwierdzona w KRS albo w wykazie podatników VAT (NIP ze strony zgodny z rejestrem). Firmy bez potwierdzenia są w katalogu, ale niżej w rankingu." },
  { key: "staz", label: "Staż w rejestrze", weight: 10, whenMissing: "pomijany (brak daty wpisu do rejestru)", description: "Lata od wpisu do rejestru (pełna punktacja od 15 lat)." },
  { key: "jawnosc_cennika", label: "Jawność cennika", weight: 15, whenMissing: "0 punktów: strona nie podaje cen", description: "Firma publikuje ceny usług na swojej stronie." },
  { key: "spojnosc_danych", label: "Spójność danych", weight: 10, whenMissing: "pomijany (brak wyniku weryfikacji)", description: "Zgodność strony firmy z danymi rejestrów (NIP, nazwa, adres)." },
  { key: "zakres_uslug", label: "Zakres usług", weight: 10, whenMissing: "0 punktów: strona nie wymienia usług", description: "Liczba usług, które firma wprost wymienia (pełna punktacja od 6)." },
  { key: "opinie_google", label: "Opinie w Google", weight: 10, whenMissing: "pomijany (biuro bez profilu w Google nie traci punktów)", description: "Średnia ocena w Google, z wagą rosnącą do 30 opinii." },
  { key: "aktualne_oferty", label: "Aktualne oferty", weight: 15, whenMissing: "0 punktów: brak ofert na stronie", description: "Oferty nieruchomości widoczne na stronie firmy, sprawdzane zwykle co 1-2 dni. Robot pobiera najwyżej 20 najnowszych ogłoszeń, więc parametr mierzy, czy biuro publikuje aktualne oferty (pełna punktacja od 20), a nie całkowitą liczbę jego ofert." },
] as const;

/** Wersja metodologii i historia zmian (strona /metodologia). Każda zmiana wag lub parametrów dostaje wpis. */
export const METHODOLOGY = {
  version: "1.1",
  published: "2026-11-10",
  modified: "2026-11-14",
  changes: [
    { version: "1.1", date: "2026-11-14", text: "Wagi pokazane jako udział w 100 punktach (bez zmiany wyników), opis parametrów pomijanych i ocenianych na 0, przykład wyliczenia dla prawdziwego biura, opinie z Google na profilach." },
    { version: "1.0", date: "2026-11-10", text: "Pierwsza wersja: potwierdzenie w rejestrze, staż, jawność cennika, spójność danych, zakres usług, opinie w Google, aktualne oferty." },
  ],
} as const;

const TOTAL_WEIGHT = PARAMETERS.reduce((sum, p) => sum + p.weight, 0);

/** Udział parametru w wyniku w punktach na 100 (waga / suma wag). Wynik liczony z wag i z udziałów jest ten sam. */
export function weightShare(weight: number): number {
  return (weight / TOTAL_WEIGHT) * 100;
}

export type RankingInput = {
  startDate: Date | string | null;
  hasPublicPrices: boolean;
  verificationScore: number | null;
  registryConfirmed?: boolean;
  servicesCount: number;
  offersCount?: number;
  googleRating?: number | null;
  googleCount?: number | null;
};

export type BreakdownItem = { key: string; label: string; value: number; weight: number };
export type Scored = { score: number; breakdown: BreakdownItem[] };

const YEAR_MS = 365.25 * 24 * 3600 * 1000;

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

export function scoreListing(input: RankingInput, now: Date = new Date()): Scored {
  const values: Record<string, number | null> = {
    rejestr: input.registryConfirmed === undefined ? null : input.registryConfirmed ? 1 : 0,
    staz: null,
    jawnosc_cennika: input.hasPublicPrices ? 1 : 0,
    spojnosc_danych: input.verificationScore == null ? null : clamp01(input.verificationScore / 100),
    zakres_uslug: clamp01(input.servicesCount / 6),
    aktualne_oferty: clamp01((input.offersCount ?? 0) / 20),
    opinie_google:
      input.googleRating && input.googleCount
        ? clamp01((input.googleRating - 1) / 4) * clamp01(input.googleCount / 30)
        : null,
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
