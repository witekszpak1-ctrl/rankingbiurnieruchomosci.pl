/**
 * Odmiana rzeczownika po liczebniku. Osobny plik bez importów, żeby konfiguracje portali (portals/*.ts) mogły z niego
 * korzystać bez cyklu z lib/portal.ts.
 */

/** Rzeczownik odmieniany przez liczebnik: 1 biuro, 2-4 biura, 5+ biur. */
export type Noun3 = { one: string; few: string; many: string };

/** Wybór formy rzeczownika po liczebniku (jedna reguła w jednym miejscu). */
export function nounForm(n: number, noun: Noun3): string {
  const abs = Math.abs(Math.trunc(n));
  if (abs === 1) return noun.one;
  const last = abs % 10;
  const lastTwo = abs % 100;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return noun.few;
  return noun.many;
}

/** Siedem przypadków bez wołacza (zwykle potrzebne są tylko te sześć): mianownik, dopełniacz, celownik, biernik, narzędnik, miejscownik. */
export type Case6 = { nom: string; gen: string; dat: string; acc: string; ins: string; loc: string };

/**
 * Pełna odmiana jednostki katalogu (biuro, firma, warsztat, klinika) w liczbie pojedynczej i mnogiej oraz jej rodzaj
 * gramatyczny. Teksty serwisu składamy z tych form (lib/unit.ts), więc każdy portal dostaje poprawną odmianę i zgodność
 * z przymiotnikiem i zaimkiem ("to biuro", "ta firma", "ten warsztat") bez osobnej wersji każdego zdania.
 */
export type UnitForms = { gender: "m" | "f" | "n"; sg: Case6; pl: Case6 };
