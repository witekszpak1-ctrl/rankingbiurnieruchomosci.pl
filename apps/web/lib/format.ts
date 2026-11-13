import type { PriceRow } from "./catalog";

export const SITE_URL = (process.env.SITE_URL ?? "https://rankingbiurnieruchomosci.pl").replace(/\/+$/, "");
export const SITE_NAME = "Ranking biur nieruchomości";
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "";

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "brak danych";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "brak danych";
  return date.toLocaleDateString("pl-PL", { year: "numeric", month: "long", day: "numeric", timeZone: "Europe/Warsaw" });
}

export function formatYear(value: Date | string | null | undefined): string {
  if (!value) return "brak danych";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "brak danych" : String(date.getFullYear());
}

const nf = (n: number) => n.toLocaleString("pl-PL", { maximumFractionDigits: 2 });

const TAX_LABEL: Record<string, string> = { net: "netto", gross: "brutto", plus_vat: "+ VAT" };

export function formatPrice(price: Pick<PriceRow, "unit" | "amountMin" | "amountMax" | "taxMode">): string {
  const { unit, amountMin, amountMax, taxMode } = price;
  const suffix = unit === "percent" ? "%" : unit === "pln_per_month" ? " zł / mies." : unit === "pln" ? " zł" : "";
  let amount: string;
  if (amountMin === 0 && (amountMax == null || amountMax === 0)) {
    amount = `0${suffix}`; // "od 0%" brzmi dziwnie; zero to po prostu brak opłaty
  } else if (amountMin != null && amountMax != null && amountMin !== amountMax) {
    amount = `${nf(amountMin)}${suffix} - ${nf(amountMax)}${suffix}`;
  } else if (amountMin != null) {
    amount = `od ${nf(amountMin)}${suffix}`;
  } else if (amountMax != null) {
    amount = `do ${nf(amountMax)}${suffix}`;
  } else {
    amount = "brak kwoty";
  }
  const tax = taxMode && TAX_LABEL[taxMode] ? ` ${TAX_LABEL[taxMode]}` : "";
  return amount + tax;
}

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Cena oferty nieruchomości, np. "599 000 zł" albo "3 200 zł/mies.". */
export function formatOfferPrice(amount: number | null, currency: string | null, period: string | null): string | null {
  if (!amount || !currency) return null;
  const unit = currency === "PLN" ? "zł" : currency;
  const value = Math.round(amount).toLocaleString("pl-PL").replace(/\s/g, " ");
  return `${value} ${unit}${period === "month" ? "/mies." : ""}`;
}

/** Telefon w zapisie E.164 w czytelnej formie, np. "+48 600 100 200". */
export function formatPhone(e164: string): string {
  const m = /^\+48(\d{9})$/.exec(e164);
  if (m) return `+48 ${m[1].slice(0, 3)} ${m[1].slice(3, 6)} ${m[1].slice(6)}`;
  return e164;
}

/** Adres z faktu (tekst albo obiekt z JSON-LD). */
export function addressText(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    const parts = [v.street, [v.postcode, v.city].filter(Boolean).join(" ")].filter((x) => typeof x === "string" && x);
    return parts.length ? parts.join(", ") : null;
  }
  return null;
}
