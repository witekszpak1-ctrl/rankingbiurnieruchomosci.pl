import { currentPortal, nounForm } from "./portal";

/**
 * Polska odmiana rzeczowników po liczebnikach: 1 oferta, 2-4 oferty (poza 12-14), 5+ ofert.
 * Liczby ułamkowe i duże liczby obsługujemy według ostatnich cyfr, tak jak w mowie.
 */
export function plural(n: number, one: string, few: string, many: string): string {
  return nounForm(n, { one, few, many });
}

/** Liczba z odmienionym rzeczownikiem, np. "3 biura", "5 biur". */
export function count(n: number, one: string, few: string, many: string): string {
  return `${n.toLocaleString("pl-PL")} ${plural(n, one, few, many)}`;
}

/** Jednostka katalogu z konfiguracji portalu: "3 biura", "5 biur" (inna branża: "3 kancelarie"). */
export const nFirmUnits = (n: number) => {
  const { one, few, many } = currentPortal().terms.firm;
  return count(n, one, few, many);
};
/** Dopełniacz jednostki katalogu po liczebniku: "1 biura", "4 biur". */
export const nFirmUnitsGen = (n: number) => {
  const { genOne, many } = currentPortal().terms.firm;
  return `${n.toLocaleString("pl-PL")} ${n === 1 ? genOne : many}`;
};
/** Aliasy używane w dotychczasowym kodzie (branża nieruchomości): to samo co nFirmUnits i nFirmUnitsGen. */
export const nBiur = nFirmUnits;
export const nMiast = (n: number) => count(n, "miasto", "miasta", "miast");
export const nOfert = (n: number) => count(n, "oferta", "oferty", "ofert");
export const nOpinii = (n: number) => count(n, "opinia", "opinie", "opinii");
export const nLat = (n: number) => count(n, "rok", "lata", "lat");
/** Dopełniacz po "na podstawie", "z": 1 biura, 4 biur, 5 biur. */
export const nBiurGen = nFirmUnitsGen;
export const nFirm = (n: number) => {
  const { one, few, many } = currentPortal().terms.company;
  return count(n, one, few, many);
};
/** Narzędnik po "z" w znaczeniu "mające": "z 1 opinią", "z 10 opiniami". */
export const nOpiniami = (n: number) => `${n.toLocaleString("pl-PL")} ${n === 1 ? "opinią" : "opiniami"}`;
/** Miejscownik po "przy": "przy 1 opinii", "przy 10 opiniach". */
export const nOpiniach = (n: number) => `${n.toLocaleString("pl-PL")} ${n === 1 ? "opinii" : "opiniach"}`;
/** Dopełniacz po "od": "od 1 roku", "od 33 lat". */
export const nLatGen = (n: number) => `${n.toLocaleString("pl-PL")} ${n === 1 ? "roku" : "lat"}`;

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
