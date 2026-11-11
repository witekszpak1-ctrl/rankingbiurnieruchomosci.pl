/** Zapytania publicznej części serwisu. Pokazujemy wyłącznie wpisy ze statusem published. */

import { query } from "./db";
import { addressText } from "./format";
import { median } from "./ranking";

export type CityRow = { slug: string; name: string; listings: number };

export type ListingCard = {
  listingId: string;
  slug: string;
  name: string;
  host: string | null;
  websiteUrl: string | null;
  startDate: Date | null;
  verificationScore: number | null;
  servicesCount: number;
  hasPublicPrices: boolean;
  offersCount: number;
  imageUrl: string | null;
  description: string | null;
  publishedAt: Date | null;
};

export type PriceRow = {
  service: string;
  unit: "percent" | "pln" | "pln_per_month" | "other" | null;
  amountMin: number | null;
  amountMax: number | null;
  taxMode: "net" | "gross" | "plus_vat" | "unknown" | null;
  quote: string | null;
  sourceUrl: string | null;
  observedAt: Date;
};

export type OfferRow = {
  title: string;
  url: string;
  lastSeenAt: Date;
  priceAmount: number | null;
  priceCurrency: string | null;
  pricePeriod: string | null;
};

/** Oferty niewidziane na stronie firmy dłużej niż tyle dni nie są pokazywane (strona ofert mogła przestać działać). */
export const OFFERS_MAX_AGE_DAYS = 14;
export const OFFERS_LIMIT = 20;

export type ListingDetail = ListingCard & {
  cityName: string;
  citySlug: string;
  legalForm: string | null;
  services: string[];
  prices: PriceRow[];
  offers: OfferRow[];
  offersSourceUrl: string | null;
  phone: string | null;
  address: string | null;
  updatedAt: Date;
};

const CARD_SQL = `
  select l.id as "listingId", l.slug, b.name, d.host, d.canonical_url as "websiteUrl", b.image_url as "imageUrl",
    le.start_date as "startDate", d.verification_score as "verificationScore",
    (select count(*)::int from facts f where f.brand_id = b.id and f.type = 'service' and f.is_current) as "servicesCount",
    exists (select 1 from price_items p where p.brand_id = b.id and p.is_current) as "hasPublicPrices",
    (select count(*)::int from offers o where o.brand_id = b.id and o.is_active
       and o.last_seen_at > now() - interval '14 days') as "offersCount",
    (select x.body from descriptions x where x.brand_id = b.id and x.status in ('validated', 'published')
       order by x.version desc limit 1) as description,
    l.published_at as "publishedAt"
  from listings l
  join brands b on b.id = l.brand_id
  join legal_entities le on le.id = b.legal_entity_id
  join cities c on c.id = l.city_id
  left join lateral (
    select host, canonical_url, verification_score from domains
    where brand_id = b.id order by verification_score desc nulls last limit 1
  ) d on true`;

export async function listCities(): Promise<CityRow[]> {
  return query<CityRow>(
    `select c.slug, c.name, count(*)::int as listings
     from cities c join listings l on l.city_id = c.id and l.status = 'published'
     group by c.id order by listings desc, c.name`,
  );
}

export async function getCity(slug: string): Promise<{ id: string; slug: string; name: string } | null> {
  const rows = await query<{ id: string; slug: string; name: string }>(
    "select id, slug, name from cities where slug = $1",
    [slug],
  );
  return rows[0] ?? null;
}

export async function listCityListings(citySlug: string): Promise<ListingCard[]> {
  return query<ListingCard>(`${CARD_SQL} where c.slug = $1 and l.status = 'published' order by b.name`, [citySlug]);
}

export async function getPublishedListing(citySlug: string, firmSlug: string): Promise<ListingDetail | null> {
  const cards = await query<ListingCard & { cityName: string; citySlug: string; legalForm: string | null; brandId: string }>(
    `select card.*, c.name as "cityName", c.slug as "citySlug", le.legal_form as "legalForm", b.id as "brandId"
     from (${CARD_SQL} where c.slug = $1 and l.slug = $2 and l.status = 'published') card
     join listings l on l.id = card."listingId"
     join brands b on b.id = l.brand_id
     join legal_entities le on le.id = b.legal_entity_id
     join cities c on c.id = l.city_id`,
    [citySlug, firmSlug],
  );
  const card = cards[0];
  if (!card) return null;
  const [prices, services, descriptionDates, offers, offerSources, phones, addresses] = await Promise.all([
    query<PriceRow>(
      `select service, unit, amount_min::float8 as "amountMin", amount_max::float8 as "amountMax",
              tax_mode as "taxMode", quote, source_url as "sourceUrl", observed_at as "observedAt"
       from price_items where brand_id = $1 and is_current order by service`,
      [card.brandId],
    ),
    query<{ name: string }>(
      `select distinct value #>> '{}' as name from facts where brand_id = $1 and type = 'service' and is_current order by 1`,
      [card.brandId],
    ),
    query<{ createdAt: Date }>(
      `select created_at as "createdAt" from descriptions where brand_id = $1 and status in ('validated', 'published')
       order by version desc limit 1`,
      [card.brandId],
    ),
    query<OfferRow>(
      `select title, url, last_seen_at as "lastSeenAt", price_amount::float8 as "priceAmount",
              price_currency as "priceCurrency", price_period as "pricePeriod" from offers
       where brand_id = $1 and is_active and last_seen_at > now() - make_interval(days => $2)
       order by position, first_seen_at desc limit $3`,
      [card.brandId, OFFERS_MAX_AGE_DAYS, OFFERS_LIMIT],
    ),
    query<{ url: string }>(
      `select offers_url as url from domains where brand_id = $1 and verification_status = 'verified'
       and offers_url is not null order by offers_checked_at desc nulls last limit 1`,
      [card.brandId],
    ),
    query<{ value: string }>(
      `select value from contacts where brand_id = $1 and kind = 'phone' order by created_at limit 1`,
      [card.brandId],
    ),
    query<{ value: unknown; type: string }>(
      `select value, type from facts where brand_id = $1 and is_current and type in ('address', 'address_hint')
       order by (type = 'address') desc, observed_at desc limit 1`,
      [card.brandId],
    ),
  ]);
  const dates = [card.publishedAt, descriptionDates[0]?.createdAt, ...prices.map((p) => p.observedAt)]
    .filter((d): d is Date => d instanceof Date)
    .map((d) => d.getTime());
  const { brandId: _brandId, ...rest } = card;
  void _brandId;
  return {
    ...rest,
    services: services.map((s) => s.name),
    prices,
    offers,
    offersSourceUrl: offerSources[0]?.url ?? null,
    phone: phones[0]?.value ?? null,
    address: addresses[0] ? addressText(addresses[0].value) : null,
    updatedAt: new Date(Math.max(0, ...dates)),
  };
}

export type CommissionStats = { n: number; median: number | null; observedAt: Date | null };

/** Mediana jawnych prowizji procentowych od sprzedaży w mieście (jedna wartość na firmę). */
export async function cityCommissionStats(citySlug: string): Promise<CommissionStats> {
  const rows = await query<{ v: number; observedAt: Date }>(
    `select distinct on (b.id) p.amount_min::float8 as v, p.observed_at as "observedAt"
     from price_items p
     join brands b on b.id = p.brand_id
     join listings l on l.brand_id = b.id and l.status = 'published'
     join cities c on c.id = l.city_id
     where c.slug = $1 and p.is_current and p.unit = 'percent' and p.service ilike '%sprzeda%'
       and p.amount_min is not null
     order by b.id, p.amount_min`,
    [citySlug],
  );
  const latest = rows.reduce<Date | null>((acc, r) => (!acc || r.observedAt > acc ? r.observedAt : acc), null);
  return { n: rows.length, median: median(rows.map((r) => r.v)), observedAt: latest };
}

export type SitemapEntry = { citySlug: string; firmSlug: string | null; lastModified: Date | null; cityListings: number };

export async function listPublishedPaths(): Promise<SitemapEntry[]> {
  const cities = await query<{ citySlug: string; lastModified: Date | null; cityListings: number }>(
    `select c.slug as "citySlug", max(l.published_at) as "lastModified", count(*)::int as "cityListings"
     from cities c join listings l on l.city_id = c.id and l.status = 'published' and not l.noindex
     group by c.id`,
  );
  const firms = await query<{ citySlug: string; firmSlug: string; lastModified: Date | null }>(
    `select c.slug as "citySlug", l.slug as "firmSlug", l.published_at as "lastModified"
     from listings l join cities c on c.id = l.city_id
     where l.status = 'published' and not l.noindex and l.slug is not null`,
  );
  return [
    ...cities.map((c) => ({ ...c, firmSlug: null })),
    ...firms.map((f) => ({ ...f, cityListings: 0 })),
  ];
}
