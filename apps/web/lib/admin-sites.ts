import { query } from "./db";

export type SiteRow = {
  id: string;
  host: string;
  url: string | null;
  city: string | null;
  firstSeenAt: Date;
  checkedAt: Date | null;
  classification: string;
  verification: string;
  score: number | null;
  listingId: string | null;
  firmName: string | null;
  listingStatus: string | null;
  query: string | null;
  reasons: string[] | null;
};

export const SITE_STATES: Record<string, { label: string; where: string }> = {
  czeka: { label: "czeka na sprawdzenie", where: "d.verification_status = 'candidate' and d.classification <> 'official'" },
  biuro: { label: "biuro, czeka na rejestry", where: "d.classification = 'official' and d.verification_status = 'candidate'" },
  potwierdzona: { label: "firma potwierdzona", where: "d.verification_status in ('verified', 'probable')" },
  bez_potwierdzenia: { label: "biuro bez potwierdzenia w rejestrze", where: "d.verification_status = 'needs_review'" },
  odrzucona: { label: "odrzucona", where: "d.verification_status = 'rejected'" },
};

export function siteState(row: Pick<SiteRow, "verification" | "classification">): string {
  if (row.verification === "verified" || row.verification === "probable") return "potwierdzona";
  if (row.verification === "needs_review") return "bez_potwierdzenia";
  if (row.verification === "rejected") return "odrzucona";
  if (row.classification === "official") return "biuro";
  return "czeka";
}

export async function listSites(filters: { state: string; city: string; q: string; page: number }) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (SITE_STATES[filters.state]) where.push(SITE_STATES[filters.state].where);
  if (filters.city) {
    params.push(filters.city);
    where.push(`lower(d.city_hint) = lower($${params.length})`);
  }
  if (filters.q) {
    params.push(`%${filters.q}%`);
    where.push(`(d.host ilike $${params.length} or b.name ilike $${params.length})`);
  }
  const cond = where.length ? `where ${where.join(" and ")}` : "";
  params.push(100, filters.page * 100);
  const rows = await query<SiteRow>(
    `select d.id, d.host, d.canonical_url as url, d.city_hint as city, d.first_seen_at as "firstSeenAt",
            d.last_checked_at as "checkedAt", d.classification, d.verification_status as verification,
            d.verification_score as score,
            (case when jsonb_typeof(d.verification_reasons) = 'array' and jsonb_array_length(d.verification_reasons) > 0
                  then d.verification_reasons else d.classification_reasons end) as reasons,
            l.id as "listingId", b.name as "firmName", l.status as "listingStatus",
            (select sq.query from search_results sr join search_queries sq on sq.id = sr.query_id
              where sr.host = d.host order by sq.created_at limit 1) as query
     from domains d
     left join brands b on b.id = d.brand_id
     left join lateral (select id, status from listings where brand_id = d.brand_id order by created_at limit 1) l on true
     ${cond}
     order by d.first_seen_at desc, d.host
     limit $${params.length - 1} offset $${params.length}`,
    params,
  ).catch(() => []);
  const counts = await query<Record<string, number>>(
    `select ${Object.entries(SITE_STATES)
      .map(([k, v]) => `count(*) filter (where ${v.where})::int as "${k}"`)
      .join(", ")}, count(*)::int as "all" from domains d`,
  ).catch(() => []);
  return { rows, counts: counts[0] ?? {} };
}

export async function siteCities(): Promise<{ city: string; n: number }[]> {
  return query<{ city: string; n: number }>(
    `select city_hint as city, count(*)::int as n from domains where city_hint is not null group by 1 order by 2 desc, 1`,
  ).catch(() => []);
}

export type SearchRow = {
  id: string;
  provider: string;
  query: string;
  results: number;
  newDomains: number;
  createdAt: Date;
};

export async function listSearches(q: string, page: number): Promise<{ rows: SearchRow[]; total: number; today: number }> {
  const params: unknown[] = [];
  let cond = "";
  if (q) {
    params.push(`%${q}%`);
    cond = "where query ilike $1";
  }
  params.push(200, page * 200);
  const [rows, totals] = await Promise.all([
    query<SearchRow>(
      `select id, provider, query, results_count as results, new_domains as "newDomains", created_at as "createdAt"
       from search_queries ${cond} order by created_at desc, id limit $${params.length - 1} offset $${params.length}`,
      params,
    ).catch(() => []),
    query<{ total: number; today: number }>(
      `select count(*)::int as total,
              count(*) filter (where created_at > now() - interval '24 hours')::int as today
       from search_queries where provider = 'serper'`,
    ).catch(() => []),
  ]);
  return { rows, total: totals[0]?.total ?? 0, today: totals[0]?.today ?? 0 };
}
