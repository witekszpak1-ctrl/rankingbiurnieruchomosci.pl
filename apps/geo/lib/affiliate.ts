/**
 * Program partnerski: czyste funkcje (bez bazy), żeby reguły dało się przetestować i zmienić w jednym miejscu.
 *
 * Zasady (warunki w wersji 2026-11, tabela geo.affiliate_terms):
 * - partner dostaje 20% od kwoty netto (bez VAT) każdej płatności poleconego klienta, dożywotnio,
 * - klient jest przypisany do partnera raz, przy założeniu konta: kod wpisany w formularzu ma pierwszeństwo,
 *   potem ostatni kliknięty link z ostatnich 90 dni,
 * - zwrot i obciążenie zwrotne tworzą ujemną prowizję,
 * - prowizja jest do wypłaty po 30 dniach od płatności (okres na zwroty), wypłata od 100 zł,
 * - nie ma prowizji od samego siebie (to samo konto, ten sam e-mail, ta sama firmowa domena e-mail co strona klienta).
 */

export const CODE_RE = /^[a-z0-9]{4,24}$/;
export const REF_COOKIE = "geo_ref";
export const DAY_MS = 24 * 3600 * 1000;

export type Terms = {
  version: string;
  rateBps: number;
  cookieDays: number;
  holdDays: number;
  minPayoutGrosze: number;
};

export function normalizeCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const code = raw.trim().toLowerCase();
  return CODE_RE.test(code) ? code : null;
}

const PL_MAP: Record<string, string> = { ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z" };

/** Propozycja kodu z imienia lub nazwy (bez polskich znaków), z losową końcówką, gdy jest za krótki lub zajęty. */
export function suggestCode(name: string, random: () => number = Math.random): string {
  const base = name
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (c) => PL_MAP[c] ?? c)
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 16);
  const suffix = Math.floor(random() * 9000 + 1000).toString();
  return base.length >= 4 ? base : `${base}${suffix}`.slice(0, 24);
}

/** Nazwa kampanii w linku (np. "facebook", "newsletter-luty"), tylko bezpieczne znaki. */
export function normalizeCampaign(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const c = raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 60);
  return c || null;
}

export type RefCookie = { code: string; clickId: number | null; at: number; campaign: string | null };

export function encodeRefCookie(value: RefCookie): string {
  return [value.code, value.clickId ?? "", value.at, value.campaign ?? ""].join(".");
}

export function decodeRefCookie(raw: string | null | undefined): RefCookie | null {
  if (!raw) return null;
  const [code, clickId, at, campaign] = raw.split(".");
  const c = normalizeCode(code);
  const t = Number(at);
  if (!c || !Number.isFinite(t) || t <= 0) return null;
  const id = clickId ? Number(clickId) : null;
  return { code: c, clickId: id !== null && Number.isSafeInteger(id) ? id : null, at: t, campaign: normalizeCampaign(campaign) };
}

export type Attribution = { code: string; clickId: number | null; campaign: string | null; source: "form" | "link" };

/** Który partner dostaje klienta przy zakładaniu konta. Kod wpisany ręcznie wygrywa z linkiem. */
export function chooseAttribution(input: {
  enteredCode?: string | null;
  cookie?: RefCookie | null;
  now: number;
  cookieDays: number;
}): Attribution | null {
  const entered = normalizeCode(input.enteredCode);
  const c = input.cookie;
  const cookieValid = !!c && input.now - c.at <= input.cookieDays * DAY_MS && c.at <= input.now + 60_000;
  // Formularz podpowiada kod z linku: ten sam kod to nadal polecenie z linku (z kampanią i kliknięciem).
  if (entered && !(cookieValid && c && c.code === entered)) return { code: entered, clickId: null, campaign: null, source: "form" };
  if (cookieValid && c) return { code: c.code, clickId: c.clickId, campaign: c.campaign, source: "link" };
  return null;
}

// Darmowe skrzynki: ta sama domena e-mail nie świadczy o tej samej firmie.
const FREE_MAIL = new Set([
  "gmail.com", "googlemail.com", "wp.pl", "o2.pl", "onet.pl", "op.pl", "interia.pl", "interia.eu", "poczta.fm",
  "outlook.com", "hotmail.com", "live.com", "icloud.com", "me.com", "yahoo.com", "proton.me", "protonmail.com",
  "tlen.pl", "gazeta.pl", "vp.pl", "int.pl", "aol.com", "gmx.com", "gmx.net",
]);

export function emailDomain(email: string): string | null {
  const at = email.trim().toLowerCase().lastIndexOf("@");
  return at > 0 ? email.trim().toLowerCase().slice(at + 1) || null : null;
}

function bareHost(domain: string | null | undefined): string | null {
  if (!domain) return null;
  return domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "") || null;
}

/** Powód odrzucenia polecenia albo null, gdy polecenie jest w porządku. */
export function selfReferralReason(input: {
  affiliateUserId: string;
  affiliateEmail: string;
  customerUserId: string;
  customerEmail: string;
  customerDomain?: string | null;
}): string | null {
  if (input.affiliateUserId === input.customerUserId) return "to samo konto";
  const a = input.affiliateEmail.trim().toLowerCase();
  const c = input.customerEmail.trim().toLowerCase();
  if (a === c) return "ten sam e-mail";
  const ad = emailDomain(a);
  if (ad && !FREE_MAIL.has(ad)) {
    if (ad === emailDomain(c)) return "ta sama firmowa domena e-mail";
    if (ad === bareHost(input.customerDomain)) return "domena e-mail partnera to strona klienta";
  }
  return null;
}

/** Prowizja w groszach: zaokrąglenie do grosza, połówki od zera (zwroty dają tę samą wartość z minusem). */
export function commissionGrosze(baseNetGrosze: number, rateBps: number): number {
  if (!Number.isSafeInteger(baseNetGrosze) || !Number.isInteger(rateBps) || rateBps < 0 || rateBps > 10000) {
    throw new Error("Nieprawidłowa podstawa lub stawka prowizji.");
  }
  const sign = baseNetGrosze < 0 ? -1 : 1;
  const value = Math.floor((Math.abs(baseNetGrosze) * rateBps + 5000) / 10000);
  return sign * value || 0;
}

export function availableAt(occurredAt: Date, holdDays: number): Date {
  return new Date(occurredAt.getTime() + holdDays * DAY_MS);
}

export type CommissionRow = {
  amountGrosze: number;
  status: "pending" | "approved" | "void" | "paid";
  availableAt: Date;
};

export type Balance = { pendingGrosze: number; availableGrosze: number; paidGrosze: number };

/**
 * Saldo partnera. "Do wypłaty" to prowizje po okresie na zwroty, jeszcze niewypłacone, łącznie z ujemnymi
 * (zwrot zmniejsza saldo, nawet jeśli płatność jest już po okresie). Saldo do wypłaty nie spada poniżej zera
 * w prezentacji, ale ujemna nadwyżka przechodzi na kolejne miesiące (liczy się suma).
 */
export function balance(rows: CommissionRow[], now: Date): Balance {
  let pending = 0;
  let available = 0;
  let paid = 0;
  for (const r of rows) {
    if (r.status === "void") continue;
    if (r.status === "paid") paid += r.amountGrosze;
    else if (r.amountGrosze < 0 || r.availableAt.getTime() <= now.getTime()) available += r.amountGrosze;
    else pending += r.amountGrosze;
  }
  return { pendingGrosze: pending, availableGrosze: available, paidGrosze: paid };
}

export function canRequestPayout(b: Balance, terms: Pick<Terms, "minPayoutGrosze">): boolean {
  return b.availableGrosze >= terms.minPayoutGrosze && b.availableGrosze > 0;
}

export function formatPln(grosze: number): string {
  const sign = grosze < 0 ? "-" : "";
  const abs = Math.abs(grosze);
  const zl = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${zl},${String(abs % 100).padStart(2, "0")} zł`;
}

/** Link partnera: /r/<kod>, z opcjonalną kampanią i ścieżką docelową na naszej stronie. */
export function affiliateLink(origin: string, code: string, opts: { campaign?: string | null; to?: string | null } = {}): string {
  const url = new URL(`/r/${code}`, origin);
  const c = normalizeCampaign(opts.campaign);
  if (c) url.searchParams.set("c", c);
  const to = safeRedirectPath(opts.to);
  if (to && to !== "/") url.searchParams.set("to", to);
  return url.toString();
}

/** Tylko ścieżki na naszej stronie (bez otwartego przekierowania na inne domeny). */
export function safeRedirectPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || raw.length > 300) return null;
  if (/[\u0000-\u001f]/.test(raw)) return null;
  return raw;
}
