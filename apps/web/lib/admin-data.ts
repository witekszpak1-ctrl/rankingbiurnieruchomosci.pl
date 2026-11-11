/** Zapytania panelu admina. Każda strona panelu woła requireAdmin() przed użyciem tych funkcji. */

import { query } from "./db";

type Counts = Record<string, number>;

async function group(sql: string): Promise<Counts> {
  const rows = await query<{ k: string; n: number }>(sql);
  return Object.fromEntries(rows.map((r) => [r.k, r.n]));
}

export type RunRow = {
  id: string;
  stage: string;
  status: string;
  counts: Record<string, number>;
  cost: number;
  startedAt: Date;
  finishedAt: Date | null;
};

export type YieldRow = { provider: string; queries: number; results: number; newDomains: number; cost: number };

export async function listRuns(limit = 50): Promise<RunRow[]> {
  return query<RunRow>(
    `select id, stage, status, counts, cost_usd::float8 as cost, started_at as "startedAt", finished_at as "finishedAt"
     from pipeline_runs order by started_at desc limit $1`,
    [limit],
  );
}

export async function searchYield(): Promise<YieldRow[]> {
  return query<YieldRow>(
    `select provider, count(*)::int as queries, coalesce(sum(results_count), 0)::int as results,
            coalesce(sum(new_domains), 0)::int as "newDomains", coalesce(sum(cost_usd), 0)::float8 as cost
     from search_queries group by provider order by provider`,
  );
}

export async function getDashboard() {
  const [domains, classification, listings, queue, descriptions, runs, yields, offers] = await Promise.all([
    group("select verification_status as k, count(*)::int as n from domains group by 1 order by 1"),
    group("select classification as k, count(*)::int as n from domains group by 1 order by 1"),
    group("select status as k, count(*)::int as n from listings group by 1 order by 1"),
    group("select type || ':' || status as k, count(*)::int as n from queue_items group by 1 order by 1"),
    group("select status as k, count(*)::int as n from descriptions group by 1 order by 1"),
    listRuns(8),
    searchYield(),
    group("select (case when price_amount is null then 'bez_ceny' else 'z_cena' end) as k, count(*)::int as n from offers where is_active group by 1"),
  ]);
  return { domains, classification, listings, queue, descriptions, runs, yields, offers };
}

export type FirmRow = {
  id: string;
  status: string;
  slug: string | null;
  name: string;
  city: string;
  citySlug: string;
  host: string | null;
  domainStatus: string | null;
  score: number | null;
  hasDescription: boolean;
  prices: number;
  createdAt: Date;
  updatedAt: Date | null;
};

export type FirmFilters = { status?: string; city?: string; q?: string; page?: number };
export const FIRMS_PAGE = 100;

export async function countFirms(filters: FirmFilters): Promise<number> {
  const rows = await query<{ n: number }>(
    `select count(*)::int as n from listings l join brands b on b.id = l.brand_id join cities c on c.id = l.city_id
     where ($1::text is null or l.status = $1) and ($2::text is null or c.slug = $2)
       and ($3::text is null or b.name ilike '%' || $3 || '%')`,
    [filters.status || null, filters.city || null, filters.q || null],
  );
  return rows[0]?.n ?? 0;
}

export async function listFirms(filters: FirmFilters): Promise<FirmRow[]> {
  return query<FirmRow>(
    `select l.id, l.status, l.slug, b.name, c.name as city, c.slug as "citySlug", d.host,
            d.verification_status as "domainStatus", d.verification_score as score,
            exists (select 1 from descriptions x where x.brand_id = b.id and x.status in ('validated', 'published')) as "hasDescription",
            (select count(*)::int from price_items p where p.brand_id = b.id and p.is_current) as prices,
            l.created_at as "createdAt",
            greatest(l.created_at, l.published_at, b.image_checked_at, d.last_checked_at, d.offers_checked_at,
                     (select max(x.created_at) from descriptions x where x.brand_id = b.id),
                     (select max(f.created_at) from facts f where f.brand_id = b.id)) as "updatedAt"
     from listings l
     join brands b on b.id = l.brand_id
     join cities c on c.id = l.city_id
     left join lateral (
       select host, verification_status, verification_score, last_checked_at, offers_checked_at from domains
       where brand_id = b.id order by verification_score desc nulls last limit 1
     ) d on true
     where ($1::text is null or l.status = $1)
       and ($2::text is null or c.slug = $2)
       and ($3::text is null or b.name ilike '%' || $3 || '%')
     order by l.created_at desc, b.name limit $4 offset $5`,
    [filters.status || null, filters.city || null, filters.q || null, FIRMS_PAGE, (filters.page ?? 0) * FIRMS_PAGE],
  );
}

export async function listAdminCities(): Promise<{ slug: string; name: string }[]> {
  return query<{ slug: string; name: string }>("select slug, name from cities order by name");
}

export type FactRow = {
  id: string;
  type: string;
  value: unknown;
  quote: string | null;
  sourceUrl: string | null;
  method: string;
  observedAt: Date;
};

export type FirmDetail = {
  listing: { id: string; status: string; slug: string | null; noindex: boolean; publishedAt: Date | null; brandId: string };
  brandName: string;
  imageUrl: string | null;
  city: { name: string; slug: string };
  entity: {
    nip: string;
    regon: string | null;
    krs: string | null;
    name: string;
    legalForm: string | null;
    entityKind: string | null;
    vatStatus: string | null;
    startDate: Date | null;
    pkdCodes: string[];
    registrySource: string | null;
  };
  domains: {
    id: string;
    host: string;
    canonicalUrl: string | null;
    classification: string;
    verificationStatus: string;
    verificationScore: number | null;
    verificationReasons: string[];
    classificationReasons: string[];
  }[];
  facts: FactRow[];
  prices: { id: string; service: string; unit: string | null; amountMin: number | null; amountMax: number | null; taxMode: string | null; quote: string | null; sourceUrl: string | null }[];
  description: { id: string; version: number; body: string; status: string; author: string; report: unknown } | null;
  gate: { domainVerified: boolean; hasValidatedDescription: boolean; factsCount: number; minFacts: number };
  contacts: { kind: string; value: string; sourceUrl: string | null }[];
  socials: { network: string; url: string }[];
  offers: { active: number; priced: number };
};

export async function getSetting(key: string, fallback: number): Promise<number> {
  const rows = await query<{ value: unknown }>("select value from settings where key = $1", [key]);
  const value = rows[0]?.value;
  return typeof value === "number" ? value : fallback;
}

export async function getFirm(listingId: string): Promise<FirmDetail | null> {
  const listings = await query<FirmDetail["listing"] & { brandName: string; imageUrl: string | null; cityName: string; citySlug: string; entityId: string }>(
    `select l.id, l.status, l.slug, l.noindex, l.published_at as "publishedAt", l.brand_id as "brandId",
            b.name as "brandName", coalesce(b.logo_url, b.image_url) as "imageUrl", c.name as "cityName", c.slug as "citySlug", b.legal_entity_id as "entityId"
     from listings l join brands b on b.id = l.brand_id join cities c on c.id = l.city_id where l.id = $1`,
    [listingId],
  );
  const base = listings[0];
  if (!base) return null;
  const [entities, domains, facts, prices, descriptions, minFacts, contacts, socials, offerCounts] = await Promise.all([
    query<FirmDetail["entity"]>(
      `select nip, regon, krs, name, legal_form as "legalForm", entity_kind as "entityKind", vat_status as "vatStatus",
              start_date as "startDate", pkd_codes as "pkdCodes", registry_source as "registrySource"
       from legal_entities where id = $1`,
      [base.entityId],
    ),
    query<FirmDetail["domains"][number]>(
      `select id, host, canonical_url as "canonicalUrl", classification, verification_status as "verificationStatus",
              verification_score as "verificationScore", verification_reasons as "verificationReasons",
              classification_reasons as "classificationReasons"
       from domains where brand_id = $1 order by verification_score desc nulls last`,
      [base.brandId],
    ),
    query<FactRow>(
      `select id, type, value, quote, source_url as "sourceUrl", method, observed_at as "observedAt"
       from facts where brand_id = $1 and is_current order by type, observed_at`,
      [base.brandId],
    ),
    query<FirmDetail["prices"][number]>(
      `select id, service, unit, amount_min::float8 as "amountMin", amount_max::float8 as "amountMax",
              tax_mode as "taxMode", quote, source_url as "sourceUrl"
       from price_items where brand_id = $1 and is_current order by service`,
      [base.brandId],
    ),
    query<NonNullable<FirmDetail["description"]>>(
      `select id, version, body, status, author, validator_report as report from descriptions
       where brand_id = $1 and status <> 'rejected' order by version desc limit 1`,
      [base.brandId],
    ),
    getSetting("publish_min_facts", 6),
    query<FirmDetail["contacts"][number]>(
      `select kind, value, source_url as "sourceUrl" from contacts where brand_id = $1 order by kind desc, created_at`,
      [base.brandId],
    ),
    query<FirmDetail["socials"][number]>(
      `select network, url from social_links where brand_id = $1 order by network`,
      [base.brandId],
    ),
    query<FirmDetail["offers"]>(
      `select count(*) filter (where is_active)::int as active,
              count(*) filter (where is_active and price_amount is not null)::int as priced
       from offers where brand_id = $1`,
      [base.brandId],
    ),
  ]);
  const description = descriptions[0] ?? null;
  return {
    listing: { id: base.id, status: base.status, slug: base.slug, noindex: base.noindex, publishedAt: base.publishedAt, brandId: base.brandId },
    brandName: base.brandName,
    imageUrl: base.imageUrl,
    city: { name: base.cityName, slug: base.citySlug },
    entity: entities[0],
    domains,
    facts,
    prices,
    description,
    contacts,
    socials,
    offers: offerCounts[0] ?? { active: 0, priced: 0 },
    gate: {
      domainVerified: domains.some((d) => d.verificationStatus === "verified" || d.verificationStatus === "needs_review"),
      hasValidatedDescription: !!description && ["validated", "published"].includes(description.status),
      factsCount: facts.length,
      minFacts,
    },
  };
}

export type ReviewRow = {
  id: string;
  host: string;
  canonicalUrl: string | null;
  classification: string;
  verificationStatus: string;
  verificationScore: number | null;
  verificationReasons: string[];
  classificationReasons: string[];
  entityName: string | null;
  nip: string | null;
  brandName: string | null;
  city: string | null;
  listingId: string | null;
};

export async function listReviewQueue(): Promise<ReviewRow[]> {
  return query<ReviewRow>(
    `select d.id, d.host, d.canonical_url as "canonicalUrl", d.classification,
            d.verification_status as "verificationStatus", d.verification_score as "verificationScore",
            d.verification_reasons as "verificationReasons", d.classification_reasons as "classificationReasons",
            le.name as "entityName", le.nip, b.name as "brandName", c.name as city, l.id as "listingId"
     from domains d
     left join legal_entities le on le.id = d.legal_entity_id
     left join brands b on b.id = d.brand_id
     left join listings l on l.brand_id = b.id
     left join cities c on c.id = l.city_id
     where d.verification_status in ('needs_review', 'probable')
     order by d.verification_score desc nulls last, d.host limit 100`,
  );
}

export async function listAuditLog(limit = 50) {
  return query<{ id: string; at: Date; actor: string; action: string; entityType: string | null; entityId: string | null }>(
    `select id::text, at, actor, action, entity_type as "entityType", entity_id as "entityId"
     from audit_log order by id desc limit $1`,
    [limit],
  );
}
