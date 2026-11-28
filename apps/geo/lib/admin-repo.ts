import { query } from "./db";
import { PAGE_SIZE, aggregateFirms, type FirmCityRow, type FirmSummary, type MeasurementFilters } from "./admin-stats";

/**
 * Zapytania panelu administratora (/admin). Tylko odczyt z geo.* i z katalogu (public.brands: SELECT dla geo_app,
 * migracja 0004). Wyjątek: zmiana uprawnień administratora (setUserAdmin). Żadnych zapytań do dostawców AI.
 * Odpowiedzi z logów i adresów e-mail nie trafiają do logów aplikacji (nic tu nie loguje).
 */

const NO_CITY = "(bez miasta)";

// ===== Przegląd =====

export type Overview = {
  users: { total: number; admins: number; disabled: number };
  accountsByPlan: { plan: string; count: number }[];
  affiliates: { total: number; active: number };
  clicks30d: number;
  referrals: number;
  commissions: { pendingGrosze: number; availableGrosze: number; paidGrosze: number };
  waitlist: number;
  measurementsByPlatform: { platform: string; done: number; failed: number; other: number; last: Date | null }[];
  lastMeasuredAt: Date | null;
  prompts: number;
  citiesMeasured: number;
  mentions: { matched: number; unmatched: number };
  citations: { total: number; ownPortal: number; answersWithCitations: number; answersCitingOwn: number };
};

export async function loadOverview(): Promise<Overview> {
  const [users, plans, aff, clicks, refs, comm, wait, byPlatform, prompts, cities, mentions, cit] = await Promise.all([
    query<{ total: number; admins: number; disabled: number }>(
      `select count(*)::int as total, count(*) filter (where is_admin)::int as admins, count(*) filter (where disabled_at is not null)::int as disabled from geo.users`,
    ),
    query<{ plan: string; count: number }>(
      `select coalesce(s.plan_id, 'brak abonamentu') as plan, count(*)::int as count
         from geo.accounts a
         left join lateral (select plan_id from geo.subscriptions where account_id = a.id order by created_at desc limit 1) s on true
        group by 1 order by 2 desc, 1`,
    ),
    query<{ total: number; active: number }>(
      `select count(*)::int as total, count(*) filter (where status = 'active')::int as active from geo.affiliates`,
    ),
    query<{ n: number }>(`select count(*)::int as n from geo.affiliate_clicks where created_at > now() - interval '30 days'`),
    query<{ n: number }>(`select count(*)::int as n from geo.referrals where status = 'active'`),
    // Te same reguły co saldo partnera (lib/affiliate.ts): ujemne pozycje i po okresie na zwroty to "do wypłaty".
    query<{ pending: string; available: string; paid: string }>(
      `select coalesce(sum(amount_grosze) filter (where status in ('pending','approved') and amount_grosze >= 0 and available_at > now()), 0)::text as pending,
              coalesce(sum(amount_grosze) filter (where status in ('pending','approved') and (amount_grosze < 0 or available_at <= now())), 0)::text as available,
              coalesce(sum(amount_grosze) filter (where status = 'paid'), 0)::text as paid
         from geo.commissions`,
    ),
    query<{ n: number }>(`select count(*)::int as n from geo.waitlist`),
    query<{ platform: string; done: number; failed: number; other: number; last: Date | null }>(
      `select platform, count(*) filter (where status = 'done')::int as done, count(*) filter (where status = 'failed')::int as failed,
              count(*) filter (where status not in ('done', 'failed'))::int as other, max(measured_at) as last
         from geo.measurements group by platform order by platform`,
    ),
    query<{ n: number }>(`select count(*)::int as n from geo.prompts`),
    query<{ n: number }>(
      `select count(distinct lower(p.city))::int as n from geo.measurements m join geo.prompts p on p.id = m.prompt_id where m.status = 'done' and p.city is not null`,
    ),
    query<{ matched: number; unmatched: number }>(
      `select count(*) filter (where brand_id is not null)::int as matched, count(*) filter (where brand_id is null)::int as unmatched from geo.mentions`,
    ),
    query<{ total: number; own: number; answers: number; answers_own: number }>(
      `select count(*)::int as total, count(*) filter (where is_own_portal)::int as own,
              count(distinct measurement_id)::int as answers, count(distinct measurement_id) filter (where is_own_portal)::int as answers_own
         from geo.citations`,
    ),
  ]);
  const last = byPlatform.reduce<Date | null>((acc, r) => (r.last && (!acc || r.last > acc) ? r.last : acc), null);
  return {
    users: users[0],
    accountsByPlan: plans,
    affiliates: aff[0],
    clicks30d: clicks[0].n,
    referrals: refs[0].n,
    commissions: { pendingGrosze: Number(comm[0].pending), availableGrosze: Number(comm[0].available), paidGrosze: Number(comm[0].paid) },
    waitlist: wait[0].n,
    measurementsByPlatform: byPlatform,
    lastMeasuredAt: last,
    prompts: prompts[0].n,
    citiesMeasured: cities[0].n,
    mentions: mentions[0],
    citations: { total: cit[0].total, ownPortal: cit[0].own, answersWithCitations: cit[0].answers, answersCitingOwn: cit[0].answers_own },
  };
}

// ===== Pomiary =====

export type MeasurementRow = {
  id: string;
  prompt: string;
  city: string | null;
  platform: string;
  status: string;
  at: Date;
  mentions: number;
  citations: number;
};

export async function listMeasurements(f: MeasurementFilters): Promise<{ rows: MeasurementRow[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, value: unknown) => {
    params.push(value);
    where.push(sql.replace("$#", `$${params.length}`));
  };
  if (f.city) add(`lower(p.city) = lower($#)`, f.city);
  if (f.platform) add(`m.platform = $#`, f.platform);
  if (f.status) add(`m.status = $#`, f.status);
  if (f.from) add(`coalesce(m.measured_at, m.requested_at) >= $#::date`, f.from);
  if (f.to) add(`coalesce(m.measured_at, m.requested_at) < ($#::date + 1)`, f.to);
  params.push(PAGE_SIZE, (f.page - 1) * PAGE_SIZE);
  const rows = await query<MeasurementRow & { total: number }>(
    `select m.id, p.text as prompt, p.city, m.platform, m.status, coalesce(m.measured_at, m.requested_at) as at,
            (select count(*) from geo.mentions x where x.measurement_id = m.id)::int as mentions,
            (select count(*) from geo.citations x where x.measurement_id = m.id)::int as citations,
            count(*) over ()::int as total
       from geo.measurements m join geo.prompts p on p.id = m.prompt_id
      ${where.length ? `where ${where.join(" and ")}` : ""}
      order by coalesce(m.measured_at, m.requested_at) desc, m.id
      limit $${params.length - 1} offset $${params.length}`,
    params,
  );
  return { rows, total: rows[0]?.total ?? 0 };
}

/** Miasta, dla których istnieją pytania (lista rozwijana filtrów). */
export async function listCities(): Promise<string[]> {
  const rows = await query<{ city: string }>(`select distinct city from geo.prompts where city is not null order by city`);
  return rows.map((r) => r.city);
}

export type MeasurementDetail = {
  id: string;
  prompt: string;
  city: string | null;
  industry: string | null;
  platform: string;
  model: string | null;
  provider: string;
  status: string;
  error: string | null;
  excerpt: string | null;
  requestedAt: Date;
  measuredAt: Date | null;
  mentions: { position: number; name: string; domain: string | null; brandName: string | null; recommended: boolean }[];
  citations: { position: number; url: string; domain: string; title: string | null; isOwnPortal: boolean }[];
};

export async function loadMeasurement(id: string): Promise<MeasurementDetail | null> {
  const head = await query<Omit<MeasurementDetail, "mentions" | "citations">>(
    `select m.id, p.text as prompt, p.city, p.industry, m.platform, m.model, m.provider, m.status, m.error,
            m.answer_excerpt as excerpt, m.requested_at as "requestedAt", m.measured_at as "measuredAt"
       from geo.measurements m join geo.prompts p on p.id = m.prompt_id where m.id = $1`,
    [id],
  );
  if (!head[0]) return null;
  const [mentions, citations] = await Promise.all([
    query<MeasurementDetail["mentions"][number]>(
      `select mt.position, mt.name, mt.domain, b.name as "brandName", mt.recommended
         from geo.mentions mt left join public.brands b on b.id = mt.brand_id
        where mt.measurement_id = $1 order by mt.position`,
      [id],
    ),
    query<MeasurementDetail["citations"][number]>(
      `select position, url, domain, title, is_own_portal as "isOwnPortal" from geo.citations where measurement_id = $1 order by position`,
      [id],
    ),
  ]);
  return { ...head[0], mentions, citations };
}

// ===== Źródła =====

export type SourceRow = { domain: string; answers: number; citations: number; cities: number; own: boolean };
export type CitySourceRow = {
  city: string;
  answers: number;
  withCitations: number;
  citingOwn: number;
  topDomain: string | null;
  topDomainAnswers: number;
};

export async function loadSources(city: string): Promise<{
  totalAnswers: number;
  answersWithCitations: number;
  answersCitingOwn: number;
  top: SourceRow[];
  perCity: CitySourceRow[];
}> {
  const cityCond = city ? `and lower(coalesce(p.city, '${NO_CITY}')) = lower($1)` : "";
  const params = city ? [city] : [];
  const [tot, top, perCity] = await Promise.all([
    query<{ answers: number; with_cit: number; own: number }>(
      `select count(distinct m.id)::int as answers,
              count(distinct m.id) filter (where exists (select 1 from geo.citations c where c.measurement_id = m.id))::int as with_cit,
              count(distinct m.id) filter (where exists (select 1 from geo.citations c where c.measurement_id = m.id and c.is_own_portal))::int as own
         from geo.measurements m join geo.prompts p on p.id = m.prompt_id
        where m.status = 'done' ${cityCond}`,
      params,
    ),
    query<SourceRow>(
      `select c.domain, count(distinct c.measurement_id)::int as answers, count(*)::int as citations,
              count(distinct coalesce(p.city, '${NO_CITY}'))::int as cities, bool_or(c.is_own_portal) as own
         from geo.citations c join geo.measurements m on m.id = c.measurement_id and m.status = 'done'
         join geo.prompts p on p.id = m.prompt_id
        where true ${cityCond}
        group by c.domain order by answers desc, citations desc, c.domain limit 50`,
      params,
    ),
    query<CitySourceRow>(
      `with base as (
         select m.id, coalesce(p.city, '${NO_CITY}') as city,
                exists (select 1 from geo.citations c where c.measurement_id = m.id) as has_cit,
                exists (select 1 from geo.citations c where c.measurement_id = m.id and c.is_own_portal) as has_own
           from geo.measurements m join geo.prompts p on p.id = m.prompt_id where m.status = 'done'
       ), cd as (
         select coalesce(p.city, '${NO_CITY}') as city, c.domain, count(distinct c.measurement_id)::int as n
           from geo.citations c join geo.measurements m on m.id = c.measurement_id and m.status = 'done'
           join geo.prompts p on p.id = m.prompt_id group by 1, 2
       ), topd as (select distinct on (city) city, domain, n from cd order by city, n desc, domain)
       select b.city, count(*)::int as answers, count(*) filter (where b.has_cit)::int as "withCitations",
              count(*) filter (where b.has_own)::int as "citingOwn", t.domain as "topDomain", coalesce(t.n, 0)::int as "topDomainAnswers"
         from base b left join topd t on t.city = b.city
        group by b.city, t.domain, t.n order by answers desc, b.city`,
    ),
  ]);
  return { totalAnswers: tot[0].answers, answersWithCitations: tot[0].with_cit, answersCitingOwn: tot[0].own, top, perCity };
}

// ===== Firmy =====

export type FirmFilter = { city: string; kind: "all" | "matched" | "unmatched" };

export async function loadFirms(filter: FirmFilter): Promise<{ firms: FirmSummary[]; cityTotals: Map<string, number> }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.city) {
    params.push(filter.city);
    where.push(`lower(coalesce(p.city, '${NO_CITY}')) = lower($${params.length})`);
  }
  if (filter.kind === "matched") where.push(`mt.brand_id is not null`);
  if (filter.kind === "unmatched") where.push(`mt.brand_id is null`);
  const [rows, totals] = await Promise.all([
    query<FirmCityRow>(
      `select case when mt.brand_id is not null then 'brand:' || mt.brand_id::text
                   else 'name:' || lower(regexp_replace(btrim(mt.name), '\\s+', ' ', 'g')) end as key,
              coalesce(max(b.name), min(mt.name)) as label,
              (mt.brand_id is not null) as matched,
              max(mt.domain) as domain,
              coalesce(p.city, '${NO_CITY}') as city,
              count(distinct m.id)::int as answers,
              (count(distinct m.id) filter (where mt.recommended))::int as recommended
         from geo.mentions mt
         join geo.measurements m on m.id = mt.measurement_id and m.status = 'done'
         join geo.prompts p on p.id = m.prompt_id
         left join public.brands b on b.id = mt.brand_id
        ${where.length ? `where ${where.join(" and ")}` : ""}
        group by 1, 3, 5`,
      params,
    ),
    query<{ city: string; n: number }>(
      `select coalesce(p.city, '${NO_CITY}') as city, count(*)::int as n
         from geo.measurements m join geo.prompts p on p.id = m.prompt_id where m.status = 'done' group by 1`,
    ),
  ]);
  const cityTotals = new Map(totals.map((t) => [t.city, t.n]));
  return { firms: aggregateFirms(rows, cityTotals).slice(0, 200), cityTotals };
}

// ===== Lista oczekujących =====

export type WaitlistRow = { email: string; domain: string | null; affiliateCode: string | null; createdAt: Date };

export async function listWaitlist(limit = 1000): Promise<{ rows: WaitlistRow[]; total: number }> {
  const [rows, total] = await Promise.all([
    query<WaitlistRow>(
      `select email, domain, affiliate_code as "affiliateCode", created_at as "createdAt" from geo.waitlist order by created_at desc, email limit $1`,
      [limit],
    ),
    query<{ n: number }>(`select count(*)::int as n from geo.waitlist`),
  ]);
  return { rows, total: total[0].n };
}

// ===== Użytkownicy i konta =====

export type UserRow = {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  lastLoginAt: Date | null;
  isAdmin: boolean;
  disabled: boolean;
  affiliateCode: string | null;
  accounts: number;
};

export type AccountRow = {
  id: string;
  name: string;
  domain: string | null;
  ownerEmail: string;
  plan: string | null;
  subscriptionStatus: string | null;
  createdAt: Date;
};

export async function listUsers(): Promise<{ users: UserRow[]; accounts: AccountRow[] }> {
  const [users, accounts] = await Promise.all([
    query<UserRow>(
      `select u.id, u.email, u.name, u.created_at as "createdAt", u.last_login_at as "lastLoginAt", u.is_admin as "isAdmin",
              (u.disabled_at is not null) as disabled, (select code from geo.affiliates where user_id = u.id) as "affiliateCode",
              (select count(*) from geo.accounts where owner_user_id = u.id)::int as accounts
         from geo.users u order by u.created_at desc, u.email limit 500`,
    ),
    query<AccountRow>(
      `select a.id, a.name, a.primary_domain as domain, u.email as "ownerEmail", s.plan_id as plan, s.status as "subscriptionStatus", a.created_at as "createdAt"
         from geo.accounts a join geo.users u on u.id = a.owner_user_id
         left join lateral (select plan_id, status from geo.subscriptions where account_id = a.id order by created_at desc limit 1) s on true
        order by a.created_at desc limit 500`,
    ),
  ]);
  return { users, accounts };
}

/** Ustawia uprawnienia administratora. Reguły (tylko admin, nie własne konto) sprawdza wywołujący. */
export async function setUserAdmin(userId: string, isAdmin: boolean): Promise<boolean> {
  const rows = await query<{ id: string }>(`update geo.users set is_admin = $2 where id = $1 returning id`, [userId, isAdmin]);
  return rows.length > 0;
}
