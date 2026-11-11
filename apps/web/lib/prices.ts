import type { PriceRow } from "./catalog";

/** Rodzaj ceny usługi, rozpoznany z nazwy usługi zapisanej przy cytacie ze strony biura. */
export type PriceKind = "sale" | "rent_brokerage" | "management" | "other";

const TENANT_FEE = /znalezieni|pozyskani|wyszukani|najemc|pierwsz\w* czynsz/i;
const MANAGEMENT = /zarządza|zarzadza|administrow|obsług[ai] najmu|opieka nad najmem/i;
const RENT = /najem|najmu|wynaj|najemc/i;
const SALE = /sprzeda|kupn|kupi|zakup|transakc|pośrednictw[oa] w (sprzeda|zakup)/i;

export function priceKind(service: string): PriceKind {
  if (TENANT_FEE.test(service)) return "rent_brokerage";
  if (MANAGEMENT.test(service)) return "management";
  if (RENT.test(service)) return "rent_brokerage";
  if (SALE.test(service)) return "sale";
  return "other";
}

/**
 * Wiarygodne przedziały, poza którymi cena prawie na pewno jest błędnie odczytana (np. procent rabatu albo
 * statystyka zamiast prowizji). Takie ceny nie wchodzą do statystyk miasta.
 */
export function isPlausible(p: Pick<PriceRow, "unit" | "amountMin" | "amountMax" | "service">): boolean {
  const values = [p.amountMin, p.amountMax].filter((v): v is number => v != null);
  if (values.length === 0) return false;
  const kind = priceKind(p.service);
  if (p.unit === "percent") {
    if (values.some((v) => v <= 0 || v > 200)) return false;
    if (kind === "sale") return values.every((v) => v >= 0.5 && v <= 10);
    if (kind === "management") return values.every((v) => v >= 2 && v <= 40);
    return true;
  }
  if (p.unit === "pln" || p.unit === "pln_per_month") return values.every((v) => v > 0 && v < 1_000_000);
  return true;
}

/** Od czego liczona jest stawka procentowa, żeby "8%" nie wisiało w powietrzu. */
export function priceBasis(p: Pick<PriceRow, "unit" | "service">): string | null {
  if (p.unit !== "percent") return null;
  switch (priceKind(p.service)) {
    case "sale":
      return "od ceny transakcyjnej";
    case "management":
      return "od czynszu najmu, co miesiąc";
    case "rent_brokerage":
      return "od czynszu najmu";
    default:
      return null;
  }
}
