"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  REF_COOKIE,
  chooseAttribution,
  decodeRefCookie,
  normalizeCode,
  safeRedirectPath,
  suggestCode,
} from "@/lib/affiliate";
import {
  affiliateByUser,
  attachReferral,
  codeTaken,
  createAffiliate,
  currentTerms,
  settlePayout,
} from "@/lib/affiliate-repo";
import {
  EMAIL_RE,
  checkLogin,
  currentUser,
  endSession,
  hashPassword,
  requireAdmin,
  requireUser,
  startSession,
  validatePassword,
} from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";

function field(form: FormData, name: string, max = 300): string {
  const v = form.get(name);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function back(path: string, error: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}error=${encodeURIComponent(error)}`);
}

function normalizeDomain(raw: string): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) ? host : null;
  } catch {
    return null;
  }
}

async function refCookie() {
  return decodeRefCookie((await cookies()).get(REF_COOKIE)?.value);
}

/** Wspólne tworzenie użytkownika (e-mail unikalny). Zwraca id albo komunikat błędu. */
async function createUser(
  client: { query: (q: string, p: unknown[]) => Promise<{ rows: { id: string }[] }> },
  email: string,
  password: string,
  name: string | null,
): Promise<string | { error: string }> {
  const exists = await client.query(`select id from geo.users where email_norm = lower(trim($1))`, [email]);
  if (exists.rows[0]) return { error: "Konto z tym adresem e-mail już istnieje. Zaloguj się." };
  const ins = await client.query(
    `insert into geo.users (email, password_hash, name) values ($1, $2, $3) returning id`,
    [email, hashPassword(password), name],
  );
  return ins.rows[0].id;
}

export async function loginAction(form: FormData): Promise<void> {
  const email = field(form, "email", 254);
  const password = field(form, "password", 200);
  const next = safeRedirectPath(field(form, "next")) ?? "/panel";
  const userId = await checkLogin(email, password);
  if (!userId) back(`/logowanie?next=${encodeURIComponent(next)}`, "Nieprawidłowy e-mail lub hasło.");
  await startSession(userId);
  redirect(next);
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect("/");
}

/** Założenie konta firmy (klienta). Tu następuje przypisanie do partnera, raz i na stałe. */
export async function registerCustomerAction(form: FormData): Promise<void> {
  const email = field(form, "email", 254);
  const password = field(form, "password", 200);
  const company = field(form, "company", 200);
  const domain = normalizeDomain(field(form, "domain", 253));
  const entered = field(form, "ref", 24);
  if (!EMAIL_RE.test(email)) back("/rejestracja", "Podaj poprawny adres e-mail.");
  const pwError = validatePassword(password);
  if (pwError) back("/rejestracja", pwError);
  if (!company) back("/rejestracja", "Podaj nazwę firmy.");
  if (field(form, "domain") && !domain) back("/rejestracja", "Adres strony wygląda na niepoprawny, np. mojafirma.pl.");
  if (entered && !normalizeCode(entered)) back("/rejestracja", "Kod polecający ma 4-24 małe litery lub cyfry.");
  if (form.get("terms") !== "on") back("/rejestracja", "Zaakceptuj regulamin, żeby założyć konto.");

  const terms = await currentTerms();
  const attribution = chooseAttribution({ enteredCode: entered, cookie: await refCookie(), now: Date.now(), cookieDays: terms.cookieDays });
  const result = await withTransaction(async (client) => {
    const userId = await createUser(client, email, password, null);
    if (typeof userId !== "string") return userId;
    const acc = await client.query<{ id: string }>(
      `insert into geo.accounts (owner_user_id, name, primary_domain) values ($1, $2, $3) returning id`,
      [userId, company, domain],
    );
    await client.query(
      `insert into geo.subscriptions (account_id, plan_id, status, provider) values ($1, 'free', 'active', 'internal')`,
      [acc.rows[0].id],
    );
    if (attribution) {
      await attachReferral(client, { accountId: acc.rows[0].id, customerUserId: userId, customerEmail: email, accountDomain: domain, attribution });
    }
    return { userId };
  });
  if ("error" in result) back("/rejestracja", result.error);
  await startSession(result.userId);
  redirect("/panel?nowe=1");
}

/** Dołączenie do programu partnerskiego: nowy użytkownik albo zalogowany (klient też może polecać). */
export async function joinAffiliateAction(form: FormData): Promise<void> {
  const user = await currentUser();
  const code = normalizeCode(field(form, "code", 24));
  if (!code) back("/partner/dolacz", "Kod ma 4-24 małe litery lub cyfry, bez spacji i polskich znaków.");
  if (form.get("terms") !== "on") back("/partner/dolacz", "Zaakceptuj warunki programu.");
  if (await codeTaken(code)) back("/partner/dolacz", `Kod "${code}" jest zajęty. Wybierz inny, np. ${suggestCode(code)}.`);
  const terms = await currentTerms();

  if (user) {
    if (await affiliateByUser(user.id)) redirect("/partner/panel");
    await createAffiliate(user.id, code, terms);
    redirect("/partner/panel?nowy=1");
  }

  const email = field(form, "email", 254);
  const password = field(form, "password", 200);
  const name = field(form, "name", 120) || null;
  if (!EMAIL_RE.test(email)) back("/partner/dolacz", "Podaj poprawny adres e-mail.");
  const pwError = validatePassword(password);
  if (pwError) back("/partner/dolacz", pwError);
  const result = await withTransaction(async (client) => {
    const userId = await createUser(client, email, password, name);
    if (typeof userId !== "string") return userId;
    await createAffiliate(userId, code, terms, client);
    return { userId };
  });
  if ("error" in result) back("/partner/dolacz", result.error);
  await startSession(result.userId);
  redirect("/partner/panel?nowy=1");
}

const IBAN_RE = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/;

export async function savePayoutAction(form: FormData): Promise<void> {
  const user = await requireUser("/partner/panel");
  const aff = await affiliateByUser(user.id);
  if (!aff) redirect("/partner/dolacz");
  const name = field(form, "payoutName", 200);
  const iban = field(form, "payoutIban", 40).replace(/\s+/g, "").toUpperCase();
  const isCompany = form.get("payoutIsCompany") === "on";
  const nip = field(form, "payoutNip", 13).replace(/[^0-9]/g, "");
  const fullIban = /^[0-9]{26}$/.test(iban) ? `PL${iban}` : iban;
  if (!name) back("/partner/panel", "Podaj imię i nazwisko albo nazwę firmy do przelewu.");
  if (!IBAN_RE.test(fullIban)) back("/partner/panel", "Numer konta wygląda na niepoprawny (26 cyfr, opcjonalnie z PL).");
  if (isCompany && !/^[0-9]{10}$/.test(nip)) back("/partner/panel", "Firma potrzebuje 10-cyfrowego NIP-u.");
  await query(
    `update geo.affiliates set payout_name = $2, payout_iban = $3, payout_is_company = $4, payout_nip = $5 where id = $1`,
    [aff.id, name, fullIban, isCompany, isCompany ? nip : null],
  );
  redirect("/partner/panel?zapisano=1");
}

export async function joinWaitlistAction(form: FormData): Promise<void> {
  const email = field(form, "email", 254);
  const domain = normalizeDomain(field(form, "domain", 253));
  if (!EMAIL_RE.test(email)) back("/", "Podaj poprawny adres e-mail.");
  if (form.get("consent") !== "on") back("/", "Zaznacz zgodę na jedną wiadomość o starcie audytu.");
  const ref = await refCookie();
  await query(
    `insert into geo.waitlist (email, domain, affiliate_code) values ($1, $2, $3) on conflict (lower(email)) do nothing`,
    [email, domain, ref?.code ?? null],
  );
  redirect("/?zapisano=1");
}

export async function settlePayoutAction(form: FormData): Promise<void> {
  await requireAdmin();
  const affiliateId = field(form, "affiliateId", 40);
  const reference = field(form, "reference", 200);
  if (!reference) back("/admin/partnerzy", "Wpisz tytuł lub numer przelewu.");
  const terms = await currentTerms();
  const paid = await withTransaction((client) => settlePayout(client, affiliateId, reference, terms.minPayoutGrosze));
  if (!paid) back("/admin/partnerzy", "Brak kwoty do wypłaty albo jest poniżej minimum.");
  redirect(`/admin/partnerzy?wyplacono=${paid}`);
}
