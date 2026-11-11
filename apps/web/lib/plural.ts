/**
 * Polska odmiana rzeczowników po liczebnikach: 1 oferta, 2-4 oferty (poza 12-14), 5+ ofert.
 * Liczby ułamkowe i duże liczby obsługujemy według ostatnich cyfr, tak jak w mowie.
 */
export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(Math.trunc(n));
  if (abs === 1) return one;
  const last = abs % 10;
  const lastTwo = abs % 100;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return few;
  return many;
}

/** Liczba z odmienionym rzeczownikiem, np. "3 biura", "5 biur". */
export function count(n: number, one: string, few: string, many: string): string {
  return `${n.toLocaleString("pl-PL")} ${plural(n, one, few, many)}`;
}

export const nBiur = (n: number) => count(n, "biuro", "biura", "biur");
export const nMiast = (n: number) => count(n, "miasto", "miasta", "miast");
export const nOfert = (n: number) => count(n, "oferta", "oferty", "ofert");
export const nOpinii = (n: number) => count(n, "opinia", "opinie", "opinii");
export const nLat = (n: number) => count(n, "rok", "lata", "lat");
export const nFirm = (n: number) => count(n, "firma", "firmy", "firm");

/** Robot pobiera najwyżej tyle najnowszych ofert z jednej strony biura (apps/worker offers.MAX_OFFERS). */
export const OFFERS_SAMPLE_MAX = 20;

/**
 * Opis liczby ofert pobranych ze strony biura. Robot czyta tylko próbkę najnowszych ogłoszeń, więc przy pełnej
 * próbce nie znamy całkowitej liczby ofert biura i piszemy "co najmniej".
 */
export function offersLabel(n: number): string {
  if (n >= OFFERS_SAMPLE_MAX) return `co najmniej ${nOfert(OFFERS_SAMPLE_MAX)} na stronie`;
  return `${nOfert(n)} na stronie`;
}
