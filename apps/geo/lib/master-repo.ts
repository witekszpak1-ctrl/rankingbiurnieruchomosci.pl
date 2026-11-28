import { query } from "./db";
import type { StageLast, UsageRow } from "./master";

/**
 * Zapytania Master Dashboardu (/admin). Dane katalogu, robota, ruchu i kosztów czytamy WYŁĄCZNIE z widoków geo.v_*
 * (db/geo/0005_master_dashboard.sql), które wykonują się z prawami właściciela bazy: geo_app nie ma dostępu do
 * public.settings (klucz LiteScrape), page_views ani leads. Jedyny zapis: edycja rejestru portali (geo.portals).
 * Żadnych płatnych zapytań, żadnych danych osobowych.
 */

export type PortalStatus = "live" | "private" | "planned";

export type PortalRow = {
  slug: string;
  name: string;
  url: string | null;
  domain: string | null;
  vercelProject: string | null;
  status: PortalStatus;
  notes: string | null;
  sortOrder: number;
  hasStats: boolean;
  brands: number;
  published: number;
  publishedCities: number;
  domainsTotal: number;
  lastPublishedAt: Date | null;
  lastDomainAt: Date | null;
  lastDataAt: Date | null;
};

type PortalSql = {
  slug: string; name: string; url: string | null; domain: string | null; vercel_project: string | null; status: PortalStatus; notes: string | null; sort_order: number;
  stats_slug: string | null; brands: number | null; published: number | null; published_cities: number | null; domains_total: number | null;
  last_published_at: Date | null; domains_last_seen_at: Date | null; domains_last_checked_at: Date | null;
};

function maxDate(...ds: (Date | null)[]): Date | null {
  const v = ds.filter((d): d is Date => d instanceof Date);
  return v.length ? new Date(Math.max(...v.map((d) => d.getTime()))) : null;
}

function mapPortal(r: PortalSql): PortalRow {
  return {
    slug: r.slug, name: r.name, url: r.url, domain: r.domain, vercelProject: r.vercel_project, status: r.status, notes: r.notes, sortOrder: r.sort_order,
    hasStats: r.stats_slug !== null,
    brands: r.brands ?? 0, published: r.published ?? 0, publishedCities: r.published_cities ?? 0, domainsTotal: r.domains_total ?? 0,
    lastPublishedAt: r.last_published_at, lastDomainAt: r.domains_last_seen_at,
    lastDataAt: maxDate(r.last_published_at, r.domains_last_seen_at, r.domains_last_checked_at),
  };
}

const PORTAL_SELECT = `
  select p.slug, p.name, p.url, p.domain, p.vercel_project, p.status, p.notes, p.sort_order,
         s.slug as stats_slug, s.brands, s.listings_published as published, s.published_cities, s.domains_total,
         s.last_published_at, s.domains_last_seen_at, s.domains_last_checked_at
    from geo.portals p left join geo.v_portal_stats s on s.slug = p.slug`;

export async function listPortals(): Promise<PortalRow[]> {
  return (await query<PortalSql>(`${PORTAL_SELECT} order by p.sort_order, p.slug`)).map(mapPortal);
}

export async function getPortal(slug: string): Promise<PortalRow | null> {
  const rows = await query<PortalSql>(`${PORTAL_SELECT} where p.slug = $1`, [slug]);
  return rows[0] ? mapPortal(rows[0]) : null;
}

/** Krótka lista portali do paska bocznego (tylko działające i prywatne). */
export async function listPortalNav(): Promise<{ slug: string; name: string }[]> {
  return query<{ slug: string; name: string }>(`select slug, name from geo.portals where status <> 'planned' order by sort_order, slug`);
}

export async function updatePortal(slug: string, v: { domain: string | null; status: PortalStatus; notes: string | null }): Promise<boolean> {
  const rows = await query<{ slug: string }>(
    `update geo.portals set domain = $2, status = $3, notes = $4, updated_at = now() where slug = $1 returning slug`,
    [slug, v.domain, v.status, v.notes],
  );
  return rows.length > 0;
}

// ===== Statystyki katalogu =====

export type CatalogTotals = {
  brands: number;
  published: number;
  domainsTotal: number;
  domainsByStatus: { status: string; count: number }[];
  queueProbe: number;
  queueVerify: number;
};

export async function loadCatalogTotals(): Promise<CatalogTotals> {
  const [r] = await query<Record<string, number>>(
    `select coalesce(sum(brands),0)::int as brands, coalesce(sum(listings_published),0)::int as published, coalesce(sum(domains_total),0)::int as domains,
            coalesce(sum(domains_candidate),0)::int as candidate, coalesce(sum(domains_verified),0)::int as verified, coalesce(sum(domains_probable),0)::int as probable,
            coalesce(sum(domains_needs_review),0)::int as needs_review, coalesce(sum(domains_rejected),0)::int as rejected,
            coalesce(sum(domains_queue_probe),0)::int as queue_probe, coalesce(sum(domains_queue_verify),0)::int as queue_verify
       from geo.v_portal_stats`,
  );
  return {
    brands: r.brands, published: r.published, domainsTotal: r.domains,
    domainsByStatus: [
      { status: "candidate", count: r.candidate }, { status: "verified", count: r.verified }, { status: "probable", count: r.probable },
      { status: "needs_review", count: r.needs_review }, { status: "rejected", count: r.rejected },
    ],
    queueProbe: r.queue_probe, queueVerify: r.queue_verify,
  };
}

export const DOMAIN_STATUS_LABEL: Record<string, string> = {
  candidate: "kandydat", verified: "zweryfikowana", probable: "prawdopodobna", needs_review: "do przeglądu", rejected: "odrzucona",
};

// ===== Robot =====

export type RunRow = {
  id: string; stage: string; vertical: string | null; status: string; startedAt: Date; finishedAt: Date | null;
  counts: Record<string, unknown>; costUsd: number; error: string | null;
};

type RunSql = { id: string; stage: string; vertical: string | null; status: string; started_at: Date; finished_at: Date | null; counts: Record<string, unknown>; cost_usd: string; error: string | null };

function mapRun(r: RunSql): RunRow {
  return { id: r.id, stage: r.stage, vertical: r.vertical, status: r.status, startedAt: r.started_at, finishedAt: r.finished_at, counts: r.counts ?? {}, costUsd: Number(r.cost_usd ?? 0), error: r.error };
}

/** Najnowszy przebieg każdego etapu (dowolna branża). */
export async function loadLastRunPerStage(): Promise<(StageLast & { vertical: string | null; finishedAt: Date | null })[]> {
  const rows = await query<RunSql>(`select distinct on (stage) * from geo.v_pipeline_runs order by stage, started_at desc`);
  return rows
    .map(mapRun)
    .map((r) => ({ stage: r.stage, status: r.status, startedAt: r.startedAt, vertical: r.vertical, finishedAt: r.finishedAt }))
    .sort((a, b) => a.stage.localeCompare(b.stage));
}

export async function loadFailedRuns24h(): Promise<{ stage: string; count: number }[]> {
  return query<{ stage: string; count: number }>(
    `select stage, count(*)::int as count from geo.v_pipeline_runs where status = 'failed' and started_at > now() - interval '24 hours' group by stage order by 2 desc, 1`,
  );
}

export async function loadFailedMeasurements48h(): Promise<{ failed: number; http503: number }> {
  const [r] = await query<{ failed: number; http503: number }>(
    `select count(*)::int as failed, count(*) filter (where error ~ '503')::int as http503
       from geo.measurements where status = 'failed' and requested_at > now() - interval '48 hours'`,
  );
  return r ?? { failed: 0, http503: 0 };
}

export type RunFilters = { stage: string; status: string; vertical: string };

export async function loadRuns(f: RunFilters, days = 7, limit = 300): Promise<RunRow[]> {
  const where: string[] = [`started_at > now() - ($1 || ' days')::interval`];
  const params: unknown[] = [String(days)];
  if (f.stage) { params.push(f.stage); where.push(`stage = $${params.length}`); }
  if (f.status) { params.push(f.status); where.push(`status = $${params.length}`); }
  if (f.vertical) { params.push(f.vertical); where.push(`vertical = $${params.length}`); }
  params.push(limit);
  const rows = await query<RunSql>(`select * from geo.v_pipeline_runs where ${where.join(" and ")} order by started_at desc limit $${params.length}`, params);
  return rows.map(mapRun);
}

export async function loadRunFilterOptions(): Promise<{ stages: string[]; verticals: string[] }> {
  const [s, v] = await Promise.all([
    query<{ stage: string }>(`select distinct stage from geo.v_pipeline_runs where started_at > now() - interval '30 days' order by 1`),
    query<{ vertical: string }>(`select distinct vertical from geo.v_pipeline_runs where vertical is not null and started_at > now() - interval '30 days' order by 1`),
  ]);
  return { stages: s.map((x) => x.stage), verticals: v.map((x) => x.vertical) };
}

export type SearchDayRow = { day: string; vertical: string; provider: string; queries: number; results: number; newDomains: number };

export async function loadSearchDaily(days = 30): Promise<SearchDayRow[]> {
  const rows = await query<{ day: string; vertical: string; provider: string; queries: number; results: number; new_domains: number }>(
    `select day::text as day, vertical, provider, queries, results, new_domains from geo.v_search_daily where day > (now() at time zone 'UTC')::date - $1::int order by day`,
    [days],
  );
  return rows.map((r) => ({ day: r.day, vertical: r.vertical, provider: r.provider, queries: r.queries, results: r.results, newDomains: r.new_domains }));
}

export type QueueRow = { slug: string; name: string; probe: number; verify: number; review: number; candidate: number };

export async function loadQueues(): Promise<QueueRow[]> {
  const rows = await query<{ slug: string; name: string; probe: number; verify: number; review: number; candidate: number }>(
    `select s.slug, coalesce(p.name, s.vertical_name) as name, s.domains_queue_probe as probe, s.domains_queue_verify as verify,
            s.domains_needs_review as review, s.domains_candidate as candidate
       from geo.v_portal_stats s left join geo.portals p on p.slug = s.slug
      order by coalesce(p.sort_order, 999), s.slug`,
  );
  return rows;
}

// ===== Koszty =====

export async function loadApiUsage(): Promise<{ rows: UsageRow[]; limits: { service: string; limit: number | null }[] }> {
  const [rows, limits] = await Promise.all([
    query<{ month: string; service: string; count: string | null }>(`select month, service, count::text as count from geo.v_api_usage order by month desc, service`),
    query<{ service: string; monthly_limit: string | null }>(`select service, monthly_limit::text as monthly_limit from geo.v_api_limits order by service`),
  ]);
  return {
    rows: rows.map((r) => ({ month: r.month, service: r.service, count: r.count === null ? null : Number(r.count) })),
    limits: limits.map((l) => ({ service: l.service, limit: l.monthly_limit === null ? null : Number(l.monthly_limit) })),
  };
}

// ===== Ruch =====

export type TrafficRow = { day: string; isBot: boolean; bot: string | null; views: number; visitors: number };

export async function loadTraffic(days = 30): Promise<TrafficRow[]> {
  const rows = await query<{ day: string; is_bot: boolean; bot: string | null; views: number; visitors: number }>(
    `select day::text as day, is_bot, bot, views, visitors from geo.v_traffic_daily where day > (now() at time zone 'UTC')::date - $1::int order by day`,
    [days],
  );
  return rows.map((r) => ({ day: r.day, isBot: r.is_bot, bot: r.bot, views: r.views, visitors: r.visitors }));
}

export async function loadReferrers(limit = 15): Promise<{ host: string; views: number; visitors: number }[]> {
  const rows = await query<{ referrer_host: string; views: number; visitors: number }>(
    `select referrer_host, views, visitors from geo.v_referrers_30d order by views desc, referrer_host limit $1`,
    [limit],
  );
  return rows.map((r) => ({ host: r.referrer_host, views: r.views, visitors: r.visitors }));
}

export async function loadLeadsAndRequests(): Promise<{ leads30d: number; requestsNew: number; requestsTotal: number; claimsNew: number; claimsTotal: number }> {
  const [l, rq, c] = await Promise.all([
    query<{ n: number }>(`select coalesce(sum(count),0)::int as n from geo.v_leads_daily where day > (now() at time zone 'UTC')::date - 30`),
    query<{ total: number; new: number }>(`select total, new from geo.v_requests_count`),
    query<{ total: number; new: number }>(`select total, new from geo.v_claims_count`),
  ]);
  return { leads30d: l[0]?.n ?? 0, requestsNew: rq[0]?.new ?? 0, requestsTotal: rq[0]?.total ?? 0, claimsNew: c[0]?.new ?? 0, claimsTotal: c[0]?.total ?? 0 };
}

// ===== Szczegóły portalu =====

export type PortalDetail = {
  cities: { city: string; published: number }[];
  statusCounts: { status: string; count: number }[];
  domainsDaily: { day: string; count: number }[];
  stats: Record<string, number | string | Date | null> | null;
  ai: { answers: number; failed: number; lastMeasuredAt: Date | null; ownCitations: number; answersWithCitations: number; topFirms: { name: string; answers: number; recommended: number; inCatalog: boolean }[] };
};

export async function loadPortalDetail(slug: string): Promise<PortalDetail> {
  const [cities, stats, daily, ai, own, top] = await Promise.all([
    query<{ city: string; published: number }>(`select city, published from geo.v_portal_cities where slug = $1 order by published desc, city limit 15`, [slug]),
    query<Record<string, number | string | Date | null>>(`select * from geo.v_portal_stats where slug = $1`, [slug]),
    query<{ day: string; count: number }>(`select day::text as day, new_domains as count from geo.v_domains_daily where slug = $1 and day > (now() at time zone 'UTC')::date - 30 order by day`, [slug]),
    query<{ answers: number; failed: number; last: Date | null }>(
      `select count(*) filter (where m.status = 'done')::int as answers, count(*) filter (where m.status = 'failed')::int as failed, max(m.measured_at) as last
         from geo.measurements m join geo.prompts p on p.id = m.prompt_id where p.industry = $1`, [slug]),
    query<{ own: number; answers: number }>(
      `select count(distinct c.measurement_id) filter (where c.is_own_portal)::int as own, count(distinct c.measurement_id)::int as answers
         from geo.citations c join geo.measurements m on m.id = c.measurement_id join geo.prompts p on p.id = m.prompt_id
        where p.industry = $1 and m.status = 'done'`, [slug]),
    query<{ name: string; answers: number; recommended: number; in_catalog: boolean }>(
      `select min(mn.name) as name, count(distinct mn.measurement_id)::int as answers,
              count(distinct mn.measurement_id) filter (where mn.recommended)::int as recommended, bool_or(mn.brand_id is not null) as in_catalog
         from geo.mentions mn join geo.measurements m on m.id = mn.measurement_id join geo.prompts p on p.id = m.prompt_id
        where p.industry = $1 and m.status = 'done'
        group by coalesce(mn.brand_id::text, lower(trim(mn.name)))
        order by 2 desc, 3 desc, 1 limit 10`, [slug]),
  ]);
  const s = stats[0] ?? null;
  const statusCounts = s
    ? [
        { status: "candidate", count: Number(s.domains_candidate) }, { status: "verified", count: Number(s.domains_verified) }, { status: "probable", count: Number(s.domains_probable) },
        { status: "needs_review", count: Number(s.domains_needs_review) }, { status: "rejected", count: Number(s.domains_rejected) },
      ]
    : [];
  return {
    cities, statusCounts, stats: s,
    domainsDaily: daily,
    ai: {
      answers: ai[0]?.answers ?? 0, failed: ai[0]?.failed ?? 0, lastMeasuredAt: ai[0]?.last ?? null,
      ownCitations: own[0]?.own ?? 0, answersWithCitations: own[0]?.answers ?? 0,
      topFirms: top.map((t) => ({ name: t.name, answers: t.answers, recommended: t.recommended, inCatalog: t.in_catalog })),
    },
  };
}

/** Odczyt, który nie wywraca strony, gdy widoki z migracji 0005 jeszcze nie istnieją na bazie. */
export async function safely<T>(fn: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false }> {
  try {
    return { ok: true, value: await fn() };
  } catch {
    return { ok: false };
  }
}

export const MIGRATION_HINT = "Widoki Master Dashboardu nie są dostępne. Właściciel bazy musi zastosować db/geo/0005_master_dashboard.sql (npm run migrate w apps/geo z GEO_MIGRATE_URL).";
