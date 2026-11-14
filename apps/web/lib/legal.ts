/**
 * Dane operatora serwisu i stałe dokumentów prawnych (polityka prywatności, regulamin, zgoda na cookies).
 *
 * Dane operatora pochodzą ze zmiennych środowiska w Vercelu, żeby można je było uzupełnić bez zmiany kodu:
 *   OPERATOR_NAME     pełna nazwa (firma albo imię i nazwisko z nazwą działalności)
 *   OPERATOR_ADDRESS  adres siedziby lub miejsca wykonywania działalności
 *   OPERATOR_NIP      NIP (nieobowiązkowo), OPERATOR_REGON (nieobowiązkowo), OPERATOR_KRS (nieobowiązkowo)
 *   NEXT_PUBLIC_CONTACT_EMAIL  adres e-mail do kontaktu (także w sprawach danych osobowych)
 */

import { CONTACT_EMAIL, SITE_URL } from "./format";

export const LEGAL_EFFECTIVE_DATE = "12 listopada 2026 r.";

/** Okresy przechowywania danych z formularzy. Te same liczby stosuje automatyczne usuwanie (katalog purge). */
export const RETENTION_MONTHS = { leads: 12, requests: 24, claims: 24, visits: 24 } as const;

export { CONSENT_COOKIE, CONSENT_MAX_AGE_DAYS, CONSENT_VERSION } from "./consent";

export type Operator = {
  name: string | null;
  address: string | null;
  nip: string | null;
  regon: string | null;
  krs: string | null;
  email: string | null;
};

function env(key: string): string | null {
  const value = process.env[key]?.trim();
  return value ? value : null;
}

/** Domyślne dane administratora serwisu, gdy w Vercelu nie ustawiono zmiennych OPERATOR_*. */
export const DEFAULT_OPERATOR_NAME = "Luk Chok";
export const DEFAULT_CONTACT_EMAIL = "info@rankingbiurnieruchomosci.pl";

export function operator(): Operator {
  return {
    name: env("OPERATOR_NAME") ?? DEFAULT_OPERATOR_NAME,
    address: env("OPERATOR_ADDRESS"),
    nip: env("OPERATOR_NIP"),
    regon: env("OPERATOR_REGON"),
    krs: env("OPERATOR_KRS"),
    email: CONTACT_EMAIL || DEFAULT_CONTACT_EMAIL,
  };
}

export const SERVICE_HOST = SITE_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");
