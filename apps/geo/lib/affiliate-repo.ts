import { createHash } from "node:crypto";

import type { PoolClient } from "pg";

import {
  availableAt,
  balance,
  commissionGrosze,
  selfReferralReason,
  type Attribution,
  type Balance,
  type CommissionRow,
  type Terms,
} from "./affiliate";
import { query, type Db } from "./db";

type TermsRow = { version: string; rateBps: number; cookieDays: number; holdDays: number; minPayoutGrosze: string };

function toTerms(r: TermsRow): Terms {
  return { ...r, minPayoutGrosze: Number(r.minPayoutGrosze) };
}

const TERMS_SQL = `select version, rate_bps as "rateBps", cookie_days as "cookieDays", hold_days as "holdDays",
                          min_payout_grosze as "minPayoutGrosze" from geo.affiliate_terms`;

/** Aktualne warunki programu (najnowsze obowiązujące). */
export async function currentTerms(db?: Db): Promise<Terms> {
  const rows = await query<TermsRow>(`${TERMS_SQL} where valid_from <= now() order by valid_from desc limit 1`, [], db);
  if (!rows[0]) throw new Error("Brak warunków programu partnerskiego w geo.affiliate_terms.");
  return toTerms(rows[0]);
}

export async function termsVersion(version: string, db?: Db): Promise<Terms | null> {
  const rows = await query<TermsRow>(`${TERMS_SQL} where version = $1`, [version], db);
  return rows[0] ? toTerms(rows[0]) : null;
}

/** Skrót odwiedzającego bez zapisywania IP: zmienia się co dobę, nie da się go powiązać między dniami. */
export function visitorHash(ip: string | null, ua: string, day: string, secret: string): string {
  return createHash("sha256").update(`${ip ?? ""}|${ua}|${day}|${secret}`).digest("hex").slice(0, 32);
}

export type Affiliate = {
  id: string;
  userId: string;
  code: string;
  status: "active" | "suspended" | "banned";
  rateBps: number | null;
  termsVersion: string;
  payoutName: string | null;
  payoutIban: string | null;
  payoutIsCompany: boolean | null;
  payoutNip: string | null;
  createdAt: Date;
};

const AFF_SQL = `select id, user_id as "userId", code, status, rate_bps as "rateBps", terms_version as "termsVersion",
                        payout_name as "payoutName", payout_iban as "payoutIban", payout_is_company as "payoutIsCompany",
                        payout_nip as "payoutNip", created_at as "createdAt" from geo.affiliates`;

export async function affiliateByUser(userId: string, db?: Db): Promise<Affiliate | null> {
  return (await query<Affiliate>(`${AFF_SQL} where user_id = $1`, [userId], db))[0] ?? null;
}

export async function affiliateByCode(code: string, db?: Db): Promise<(Affiliate & { email: string }) | null> {
  const rows = await query<Affiliate & { email: string }>(
    `select a.*, u.email from (${AFF_SQL}) a join geo.users u on u.id = a."userId" where a.code = $1`,
    [code],
    db,
  );
  return rows[0] ?? null;
}

export async function codeTaken(code: string): Promise<boolean> {
  return (await query(`select 1 from geo.affiliates where code = $1`, [code])).length > 0;
}

export async function createAffiliate(userId: string, code: string, terms: Terms, db?: Db): Promise<void> {
  await query(
    `insert into geo.affiliates (user_id, code, terms_version, terms_accepted_at) values ($1, $2, $3, now())`,
    [userId, code, terms.version],
    db,
  );
}

/** Zapis kliknięcia. Zwraca id albo null, gdy kod nie istnieje lub partner jest zawieszony. */
export async function recordClick(input: {
  code: string;
  landingPath: string;
  campaign: string | null;
  referrerHost: string | null;
  visitor: string | null;
}): Promise<number | null> {
  const rows = await query<{ id: string }>(
    `insert into geo.affiliate_clicks (affiliate_id, landing_path, campaign, referrer_host, visitor)
     select id, $2, $3, $4, $5 from geo.affiliates where code = $1 and status = 'active'
     returning id`,
    [input.code, input.landingPath, input.campaign, input.referrerHost, input.visitor],
  );
  return rows[0] ? Number(rows[0].id) : null;
}

/**
 * Przypisanie nowego konta klienta do partnera (raz, na stałe). Wywoływane w transakcji zakładania konta.
 * Polecenie samego siebie zapisujemy jako odrzucone (z powodem), żeby było widać próbę w panelu.
 */
export async function attachReferral(
  client: PoolClient,
  input: { accountId: string; customerUserId: string; customerEmail: string; accountDomain: string | null; attribution: Attribution },
): Promise<"active" | "rejected" | "none"> {
  const aff = await affiliateByCode(input.attribution.code, client);
  if (!aff || aff.status !== "active") return "none";
  const reason = selfReferralReason({
    affiliateUserId: aff.userId,
    affiliateEmail: aff.email,
    customerUserId: input.customerUserId,
    customerEmail: input.customerEmail,
    customerDomain: input.accountDomain,
  });
  await client.query(
    `insert into geo.referrals (account_id, affiliate_id, click_id, campaign, status, rejected_reason)
     values ($1, $2, $3, $4, $5, $6) on conflict (account_id) do nothing`,
    [input.accountId, aff.id, input.attribution.clickId, input.attribution.campaign, reason ? "rejected" : "active", reason],
  );
  return reason ? "rejected" : "active";
}

export type PaymentInput = {
  accountId: string;
  providerPaymentId: string;
  kind: "payment" | "refund" | "chargeback";
  amountNetGrosze: number;
  amountGrossGrosze: number;
  occurredAt: Date;
  description?: string | null;
};

/**
 * Zapis płatności i prowizji w jednej transakcji. Idempotentne: ten sam identyfikator operatora zapisany drugi raz
 * nic nie zmienia. Prowizja powstaje, gdy konto ma aktywne polecenie i partner jest aktywny. Stawka: indywidualna
 * partnera albo z warunków, które partner zaakceptował (warunki dożywotnie).
 */
export async function recordPayment(client: PoolClient, p: PaymentInput): Promise<{ created: boolean; commissionGrosze: number | null }> {
  const sign = p.kind === "payment" ? 1 : -1;
  const net = sign * Math.abs(p.amountNetGrosze);
  const gross = sign * Math.abs(p.amountGrossGrosze);
  const ins = await client.query<{ id: string }>(
    `insert into geo.payments (account_id, provider_payment_id, kind, amount_net_grosze, amount_gross_grosze, description, occurred_at)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (provider, provider_payment_id, kind) do nothing returning id`,
    [p.accountId, p.providerPaymentId, p.kind, net, gross, p.description ?? null, p.occurredAt],
  );
  const paymentId = ins.rows[0]?.id;
  if (!paymentId) return { created: false, commissionGrosze: null };

  const ref = await client.query<{ affiliateId: string; rateBps: number | null; termsVersion: string }>(
    `select a.id as "affiliateId", a.rate_bps as "rateBps", a.terms_version as "termsVersion"
     from geo.referrals r join geo.affiliates a on a.id = r.affiliate_id
     where r.account_id = $1 and r.status = 'active' and a.status = 'active'`,
    [p.accountId],
  );
  const r = ref.rows[0];
  if (!r) return { created: true, commissionGrosze: null };
  const terms = await termsVersion(r.termsVersion, client);
  if (!terms) throw new Error(`Brak warunków ${r.termsVersion}`);
  const rate = r.rateBps ?? terms.rateBps;
  const amount = commissionGrosze(net, rate);
  if (amount === 0) return { created: true, commissionGrosze: 0 };
  await client.query(
    `insert into geo.commissions (affiliate_id, account_id, payment_id, base_net_grosze, rate_bps, amount_grosze, terms_version, available_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [r.affiliateId, p.accountId, paymentId, net, rate, amount, terms.version, availableAt(p.occurredAt, terms.holdDays)],
  );
  return { created: true, commissionGrosze: amount };
}

export type CommissionView = CommissionRow & {
  id: string;
  createdAt: Date;
  baseNetGrosze: number;
  rateBps: number;
  kind: string;
  accountLabel: string;
};

export type Dashboard = {
  clicks30: number;
  clicksAll: number;
  referrals: number;
  rejected: number;
  paying: number;
  balance: Balance;
  commissions: CommissionView[];
  campaigns: { campaign: string; clicks: number; referrals: number }[];
};

/** Etykieta klienta w panelu partnera: tylko domena z częściowym ukryciem (partner nie widzi danych klienta). */
export function maskDomain(domain: string | null): string {
  if (!domain) return "klient bez domeny";
  const [name, ...rest] = domain.split(".");
  const shown = name.length <= 3 ? name[0] + "**" : name.slice(0, 3) + "*".repeat(Math.min(5, name.length - 3));
  return [shown, ...rest].join(".");
}

export async function dashboard(affiliateId: string, now = new Date()): Promise<Dashboard> {
  const [clicks, refs, rows, camps] = await Promise.all([
    query<{ d30: number; all: number }>(
      `select count(*) filter (where created_at > now() - interval '30 days')::int as d30, count(*)::int as all
       from geo.affiliate_clicks where affiliate_id = $1`,
      [affiliateId],
    ),
    query<{ active: number; rejected: number; paying: number }>(
      `select count(*) filter (where r.status = 'active')::int as active,
              count(*) filter (where r.status = 'rejected')::int as rejected,
              count(*) filter (where r.status = 'active' and exists (
                select 1 from geo.subscriptions s where s.account_id = r.account_id and s.status in ('active', 'trialing')))::int as paying
       from geo.referrals r where r.affiliate_id = $1`,
      [affiliateId],
    ),
    query<{ id: string; amount: string; status: CommissionRow["status"]; availableAt: Date; createdAt: Date; base: string; rateBps: number; kind: string; domain: string | null }>(
      `select c.id, c.amount_grosze as amount, c.status, c.available_at as "availableAt", c.created_at as "createdAt",
              c.base_net_grosze as base, c.rate_bps as "rateBps", p.kind, a.primary_domain as domain
       from geo.commissions c join geo.payments p on p.id = c.payment_id join geo.accounts a on a.id = c.account_id
       where c.affiliate_id = $1 order by c.created_at desc`,
      [affiliateId],
    ),
    query<{ campaign: string; clicks: number; referrals: number }>(
      `select coalesce(k.campaign, '(bez kampanii)') as campaign, count(*)::int as clicks,
              count(distinct r.account_id)::int as referrals
       from geo.affiliate_clicks k left join geo.referrals r on r.click_id = k.id and r.status = 'active'
       where k.affiliate_id = $1 group by 1 order by 2 desc limit 20`,
      [affiliateId],
    ),
  ]);
  const commissions: CommissionView[] = rows.map((r) => ({
    id: r.id,
    amountGrosze: Number(r.amount),
    status: r.status,
    availableAt: r.availableAt,
    createdAt: r.createdAt,
    baseNetGrosze: Number(r.base),
    rateBps: r.rateBps,
    kind: r.kind,
    accountLabel: maskDomain(r.domain),
  }));
  return {
    clicks30: clicks[0]?.d30 ?? 0,
    clicksAll: clicks[0]?.all ?? 0,
    referrals: refs[0]?.active ?? 0,
    rejected: refs[0]?.rejected ?? 0,
    paying: refs[0]?.paying ?? 0,
    balance: balance(commissions, now),
    commissions: commissions.slice(0, 100),
    campaigns: camps,
  };
}

export type AdminAffiliateRow = {
  id: string;
  code: string;
  email: string;
  status: string;
  payoutName: string | null;
  payoutIban: string | null;
  payoutIsCompany: boolean | null;
  payoutNip: string | null;
  referrals: number;
  balance: Balance;
};

export async function adminAffiliates(now = new Date()): Promise<AdminAffiliateRow[]> {
  const affs = await query<Omit<AdminAffiliateRow, "balance">>(
    `select a.id, a.code, u.email, a.status, a.payout_name as "payoutName", a.payout_iban as "payoutIban",
            a.payout_is_company as "payoutIsCompany", a.payout_nip as "payoutNip",
            (select count(*)::int from geo.referrals r where r.affiliate_id = a.id and r.status = 'active') as referrals
     from geo.affiliates a join geo.users u on u.id = a.user_id order by a.created_at desc limit 500`,
  );
  const comm = await query<{ affiliateId: string; amount: string; status: CommissionRow["status"]; availableAt: Date }>(
    `select affiliate_id as "affiliateId", amount_grosze as amount, status, available_at as "availableAt"
     from geo.commissions where affiliate_id = any($1::uuid[])`,
    [affs.map((a) => a.id)],
  );
  return affs.map((a) => ({
    ...a,
    balance: balance(
      comm.filter((c) => c.affiliateId === a.id).map((c) => ({ amountGrosze: Number(c.amount), status: c.status, availableAt: c.availableAt })),
      now,
    ),
  }));
}

/**
 * Rozliczenie wypłaty po wykonaniu przelewu: wszystkie prowizje "do wypłaty" (po okresie na zwroty i ujemne)
 * dostają status "paid" i numer wypłaty. Kwota musi być dodatnia i co najmniej minimalna z warunków.
 */
export async function settlePayout(client: PoolClient, affiliateId: string, reference: string, minPayoutGrosze: number): Promise<number> {
  await client.query(`select id from geo.affiliates where id = $1 for update`, [affiliateId]);
  const sum = await client.query<{ total: string | null }>(
    `select sum(amount_grosze) as total from geo.commissions
     where affiliate_id = $1 and status in ('pending', 'approved') and (amount_grosze < 0 or available_at <= now())`,
    [affiliateId],
  );
  const total = Number(sum.rows[0]?.total ?? 0);
  if (total <= 0 || total < minPayoutGrosze) return 0;
  const payout = await client.query<{ id: string }>(
    `insert into geo.affiliate_payouts (affiliate_id, amount_grosze, status, paid_at, reference)
     values ($1, $2, 'paid', now(), $3) returning id`,
    [affiliateId, total, reference.slice(0, 200)],
  );
  await client.query(
    `update geo.commissions set status = 'paid', payout_id = $2
     where affiliate_id = $1 and status in ('pending', 'approved') and (amount_grosze < 0 or available_at <= now())`,
    [affiliateId, payout.rows[0].id],
  );
  return total;
}
