/** Zapytania publicznej części serwisu. Pokazujemy wyłącznie wpisy ze statusem published. */

import { query } from "./db";
import { addressText } from "./format";
import { isPlausible, priceKind } from "./prices";
import { median } from "./ranking";

export type CityRow = { slug: string; name: string; listings: number };

export type ListingCard = {
  listingId: string;
  brandId: string;
  slug: string;
  name: string;
  host: string | null;
  websiteUrl: string | null;
  startDate: Date | null;
  verificationScore: number | null;
  registryConfirmed: boolean;
  servicesCount: number;
  hasPublicPrices: boolean;
  offersCount: number;
  imageUrl: string | null;
  imageKind: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  googleRating: number | null;
  googleCount: number | null;
  description: string | null;
  publishedAt: Date | null;
};

export type GoogleReview = {
  author: string;
  author_url?: string | null;
  rating: number;
  text: string;
  relative_time?: string | null;
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
  nip: string | null;
  services: string[];
  prices: PriceRow[];
  offers: OfferRow[];
  offersSourceUrl: string | null;
  phone: string | null;
  address: string | null;
  socials: { network: string; url: string }[];
  google: { mapsUrl: string | null; reviews: GoogleReview[] } | null;
  updatedAt: Date;
  /** Wszystkie miasta, w których firma ma opublikowany wpis (pierwszy = główny, kanoniczny). */
  cities: { name: string; path: string }[];
};

const CARD_SQL = `
  select l.id as "listingId", b.id as "brandId", l.slug, b.name, d.host, d.canonical_url as "websiteUrl", b.image_url as "imageUrl", b.image_kind as "imageKind",
    coalesce(b.logo_url, case when b.image_kind <> 'og' then b.image_url end, b.image_url) as "logoUrl",
    b.cover_url as "coverUrl",
    (select g.rating::float8 from google_places g where g.brand_id = b.id and g.status = 'ok') as "googleRating",
    (select g.rating_count from google_places g where g.brand_id = b.id and g.status = 'ok') as "googleCount",
    le.start_date as "startDate", d.verification_score as "verificationScore",
    (b.legal_entity_id is not null) as "registryConfirmed",
    (select count(*)::int from facts f where f.brand_id = b.id and f.type = 'service' and f.is_current) as "servicesCount",
    exists (select 1 from price_items p where p.brand_id = b.id and p.is_current) as "hasPublicPrices",
    (select count(*)::int from offers o where o.brand_id = b.id and o.is_active
       and o.last_seen_at > now() - interval '14 days') as "offersCount",
    (select x.body from descriptions x where x.brand_id = b.id and x.status in ('validated', 'published')
       order by x.version desc limit 1) as description,
    l.published_at as "publishedAt"
  from listings l
  join brands b on b.id = l.brand_id
  left join legal_entities le on le.id = b.legal_entity_id
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

export async function getCity(slug: string): Promise<{ id: string; slug: string; name: string; editorial: string | null } | null> {
  const rows = await query<{ id: string; slug: string; name: string; editorial: string | null }>(
    "select id, slug, name, editorial from cities where slug = $1",
    [slug],
  );
  return rows[0] ?? null;
}

export async function listCityListings(citySlug: string): Promise<ListingCard[]> {
  return query<ListingCard>(`${CARD_SQL} where c.slug = $1 and l.status = 'published' order by b.name`, [citySlug]);
}

export async function getPublishedListing(citySlug: string, firmSlug: string): Promise<ListingDetail | null> {
  const cards = await query<ListingCard & { cityName: string; citySlug: string; legalForm: string | null; nip: string | null; brandId: string; verticalId: string }>(
    `select card.*, c.name as "cityName", c.slug as "citySlug", le.legal_form as "legalForm", le.nip, b.id as "brandId",
            l.vertical_id as "verticalId"
     from (${CARD_SQL} where c.slug = $1 and l.slug = $2 and l.status = 'published') card
     join listings l on l.id = card."listingId"
     join brands b on b.id = l.brand_id
     left join legal_entities le on le.id = b.legal_entity_id
     join cities c on c.id = l.city_id`,
    [citySlug, firmSlug],
  );
  const card = cards[0];
  if (!card) return null;
  const [prices, services, descriptionDates, offers, offerSources, phones, addresses, socials, google, cities] = await Promise.all([
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
    query<{ network: string; url: string }>(
      `select network, url from social_links where brand_id = $1 order by network`,
      [card.brandId],
    ),
    query<{ mapsUrl: string | null; reviews: GoogleReview[] }>(
      `select maps_url as "mapsUrl", reviews from google_places where brand_id = $1 and status = 'ok'`,
      [card.brandId],
    ).catch(() => []),
    query<{ name: string; path: string }>(
      `select c.name, '/' || c.slug || '/' || l.slug as path from listings l join cities c on c.id = l.city_id
       where l.brand_id = $1 and l.vertical_id = $2 and l.status = 'published' and l.slug is not null
       order by l.published_at nulls last, l.created_at`,
      [card.brandId, card.verticalId],
    ),
  ]);
  const dates = [card.publishedAt, descriptionDates[0]?.createdAt, ...prices.map((p) => p.observedAt)]
    .filter((d): d is Date => d instanceof Date)
    .map((d) => d.getTime());
  const { verticalId: _verticalId, ...rest } = card;
  void _verticalId;
  return {
    ...rest,
    services: services.map((s) => s.name),
    prices,
    offers,
    offersSourceUrl: offerSources[0]?.url ?? null,
    phone: phones[0]?.value ?? null,
    socials,
    google: google[0] ?? null,
    address: addresses[0] ? addressText(addresses[0].value) : null,
    updatedAt: new Date(Math.max(0, ...dates)),
    cities,
  };
}

export type CommissionStats = { n: number; median: number | null; observedAt: Date | null };

/**
 * Mediana jawnych prowizji procentowych od sprzedaży w mieście (jedna wartość na firmę: najniższa wiarygodna stawka).
 * Pomija stawki za najem i zarządzanie najmem oraz wartości spoza rozsądnego przedziału (isPlausible).
 */
export async function cityCommissionStats(citySlug: string): Promise<CommissionStats> {
  const rows = await query<{ brandId: string; service: string; unit: PriceRow["unit"]; amountMin: number | null; amountMax: number | null; observedAt: Date }>(
    `select b.id as "brandId", p.service, p.unit, p.amount_min::float8 as "amountMin", p.amount_max::float8 as "amountMax",
            p.observed_at as "observedAt"
     from price_items p
     join brands b on b.id = p.brand_id
     join listings l on l.brand_id = b.id and l.status = 'published'
     join cities c on c.id = l.city_id
     where c.slug = $1 and p.is_current and p.unit = 'percent' and p.amount_min is not null`,
    [citySlug],
  );
  const perBrand = new Map<string, { v: number; observedAt: Date }>();
  for (const r of rows) {
    if (priceKind(r.service) !== "sale" || !isPlausible(r) || r.amountMin == null) continue;
    const prev = perBrand.get(r.brandId);
    if (!prev || r.amountMin < prev.v) perBrand.set(r.brandId, { v: r.amountMin, observedAt: r.observedAt });
  }
  const values = [...perBrand.values()];
  const latest = values.reduce<Date | null>((acc, r) => (!acc || r.observedAt > acc ? r.observedAt : acc), null);
  return { n: values.length, median: median(values.map((r) => r.v)), observedAt: latest };
}

export type SitemapEntry = { citySlug: string; firmSlug: string | null; lastModified: Date | null; cityListings: number };

/**
 * Adresy do mapy strony. lastmod to data istotnej zmiany treści (publikacja, nowy opis, zmiana cennika),
 * a nie data wygenerowania mapy; codzienne odświeżanie ofert nie zmienia lastmod.
 */
export async function listPublishedPaths(): Promise<SitemapEntry[]> {
  const rows = await query<{ citySlug: string; firmSlug: string; lastModified: Date | null; isPrimary: boolean }>(
    `select c.slug as "citySlug", l.slug as "firmSlug",
            l.id = (select l2.id from listings l2 where l2.brand_id = l.brand_id and l2.vertical_id = l.vertical_id
                      and l2.status = 'published' and l2.slug is not null
                    order by l2.published_at nulls last, l2.created_at limit 1) as "isPrimary",
            greatest(l.published_at,
                     (select max(x.created_at) from descriptions x where x.brand_id = l.brand_id and x.status in ('validated', 'published')),
                     (select max(p.observed_at) from price_items p where p.brand_id = l.brand_id and p.is_current)) as "lastModified"
     from listings l join cities c on c.id = l.city_id
     where l.status = 'published' and not l.noindex and l.slug is not null`,
  );
  // Firma w kilku miastach: w mapie strony tylko główny wpis (pozostałe wskazują go jako kanoniczny),
  // ale do liczby firm w mieście liczą się wszystkie wpisy.
  const firms = rows.filter((r) => r.isPrimary).map(({ isPrimary: _p, ...f }) => f);
  const cities = new Map<string, { citySlug: string; lastModified: Date | null; cityListings: number }>();
  for (const f of rows) {
    const c = cities.get(f.citySlug) ?? { citySlug: f.citySlug, lastModified: null, cityListings: 0 };
    c.cityListings += 1;
    if (f.lastModified && (!c.lastModified || f.lastModified > c.lastModified)) c.lastModified = f.lastModified;
    cities.set(f.citySlug, c);
  }
  return [...[...cities.values()].map((c) => ({ ...c, firmSlug: null })), ...firms.map((f) => ({ ...f, cityListings: 0 }))];
}

export type TopListing = ListingCard & { cityName: string; citySlug: string };

/** Wszystkie firmy z katalogu, każda raz: z głównego (najwcześniej opublikowanego) wpisu. Ranking ogólnopolski. */
export async function listAllPublished(): Promise<TopListing[]> {
  return query<TopListing>(
    `select card.*, c.name as "cityName", c.slug as "citySlug"
     from (${CARD_SQL} where l.status = 'published' and l.id = (
       select l1.id from listings l1 where l1.brand_id = l.brand_id and l1.status = 'published' and l1.slug is not null
       order by l1.published_at nulls last, l1.created_at limit 1)) card
     join listings l on l.id = card."listingId" join cities c on c.id = l.city_id`,
  );
}

export type CompareCard = TopListing & { saleCommission: number | null; services: string[] };

/** Biura do porównania (/porownaj): najwyżej 3 opublikowane wpisy po identyfikatorach. */
export async function compareCards(ids: string[]): Promise<CompareCard[]> {
  if (ids.length === 0) return [];
  return query<CompareCard>(
    `select card.*, c.name as "cityName", c.slug as "citySlug",
            (select min(p.amount_min)::float8 from price_items p where p.brand_id = l.brand_id and p.is_current
               and p.unit = 'percent' and p.service ~* 'sprzeda|kupn' and p.amount_min between 0.5 and 10) as "saleCommission",
            coalesce((select array_agg(distinct f.value #>> '{}') from facts f
               where f.brand_id = l.brand_id and f.type = 'service' and f.is_current), '{}') as services
     from (${CARD_SQL} where l.status = 'published' and l.id = any($1::uuid[])) card
     join listings l on l.id = card."listingId" join cities c on c.id = l.city_id`,
    [ids],
  );
}

export type LatestOffer = {
  title: string;
  url: string;
  priceAmount: number | null;
  priceCurrency: string | null;
  pricePeriod: string | null;
  firmName: string;
  firmSlug: string;
  citySlug: string;
  cityName: string;
  imageUrl: string | null;
};

/** Najnowsze aktywne oferty z ceną z biur w katalogu, po jednej-dwóch z każdego biura. */
/**
 * Główny wpis firmy (najwcześniej opublikowany), ten sam co kanoniczny na stronie firmy i w mapie strony.
 * Oferty biorą z niego miasto, żeby firma z kilkoma miastami nie pokazywała tej samej oferty kilka razy.
 */
const PRIMARY_LISTING = `select l1.id, l1.slug, l1.city_id from listings l1
  where l1.brand_id = b.id and l1.status = 'published' and l1.slug is not null
  order by l1.published_at nulls last, l1.created_at limit 1`;

export async function listLatestOffers(limit = 6): Promise<LatestOffer[]> {
  return query<LatestOffer>(
    `select * from (
       select o.title, o.url, o.price_amount::float8 as "priceAmount", o.price_currency as "priceCurrency",
              o.price_period as "pricePeriod", b.name as "firmName", l.slug as "firmSlug", c.slug as "citySlug",
              c.name as "cityName", b.image_url as "imageUrl", o.first_seen_at,
              row_number() over (partition by o.brand_id order by o.position) as rn
       from offers o
       join brands b on b.id = o.brand_id
       join lateral (${PRIMARY_LISTING}) l on true
       join cities c on c.id = l.city_id
       where o.is_active and o.price_amount is not null and o.last_seen_at > now() - interval '14 days'
     ) x where rn <= 2 order by first_seen_at desc limit $1`,
    [limit],
  );
}

export async function homeStats(): Promise<{ firms: number; cities: number; offers: number; withPrices: number }> {
  const rows = await query<{ firms: number; cities: number; offers: number; withPrices: number }>(
    // Firma z wpisami w kilku miastach liczy się raz, a jej oferty nie są mnożone przez liczbę miast.
    `select (select count(distinct brand_id)::int from listings where status = 'published') as firms,
            (select count(distinct city_id)::int from listings where status = 'published') as cities,
            (select count(*)::int from offers o
              where o.is_active and o.last_seen_at > now() - interval '14 days'
                and exists (select 1 from listings l where l.brand_id = o.brand_id and l.status = 'published')) as offers,
            (select count(distinct p.brand_id)::int from price_items p
              join listings l on l.brand_id = p.brand_id and l.status = 'published' where p.is_current) as "withPrices"`,
  );
  return rows[0] ?? { firms: 0, cities: 0, offers: 0, withPrices: 0 };
}

/** Aktywne oferty z biur w katalogu (lista ofert), najnowsze najpierw, opcjonalnie z jednego miasta biura. */
export async function listOffersPage(opts: { citySlug?: string; page: number; perPage: number }): Promise<{ offers: LatestOffer[]; total: number }> {
  const params: unknown[] = [];
  let cond = "";
  if (opts.citySlug) {
    params.push(opts.citySlug);
    cond = `and c.slug = $${params.length}`;
  }
  const base = `from offers o
     join brands b on b.id = o.brand_id
     join lateral (${PRIMARY_LISTING}) l on true
     join cities c on c.id = l.city_id
     where o.is_active and o.last_seen_at > now() - interval '14 days' ${cond}`;
  const [offers, total] = await Promise.all([
    query<LatestOffer>(
      `select o.title, o.url, o.price_amount::float8 as "priceAmount", o.price_currency as "priceCurrency",
              o.price_period as "pricePeriod", b.name as "firmName", l.slug as "firmSlug", c.slug as "citySlug",
              c.name as "cityName", coalesce(b.logo_url, b.image_url) as "imageUrl"
       ${base}
       order by o.first_seen_at desc, o.position limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, opts.perPage, opts.page * opts.perPage],
    ),
    query<{ n: number }>(`select count(*)::int as n ${base}`, params),
  ]);
  return { offers, total: total[0]?.n ?? 0 };
}

/** Miasta biur, które mają aktywne oferty (filtr listy ofert). */
export async function offerCities(): Promise<{ slug: string; name: string; n: number }[]> {
  return query<{ slug: string; name: string; n: number }>(
    `select c.slug, c.name, count(*)::int as n
     from offers o join listings l on l.brand_id = o.brand_id and l.status = 'published' join cities c on c.id = l.city_id
     where o.is_active and o.last_seen_at > now() - interval '14 days'
     group by c.slug, c.name order by n desc, c.name`,
  );
}

export type CityPriceExample = {
  firmName: string;
  firmSlug: string;
  service: string;
  unit: PriceRow["unit"];
  amountMin: number | null;
  amountMax: number | null;
  taxMode: PriceRow["taxMode"];
  observedAt: Date;
};

/** Jawne ceny usług opublikowanych biur w mieście (do sekcji o prowizjach). */
export async function cityPriceExamples(citySlug: string): Promise<CityPriceExample[]> {
  return query<CityPriceExample>(
    `select b.name as "firmName", l.slug as "firmSlug", p.service, p.unit, p.amount_min::float8 as "amountMin",
            p.amount_max::float8 as "amountMax", p.tax_mode as "taxMode", p.observed_at as "observedAt"
     from price_items p
     join brands b on b.id = p.brand_id
     join listings l on l.brand_id = b.id and l.status = 'published'
     join cities c on c.id = l.city_id
     where c.slug = $1 and p.is_current
     order by b.name, p.service`,
    [citySlug],
  );
}

/** Usługi deklarowane przez biura w mieście (fakty typu service), po jednej liście na biuro. */
export async function cityServices(citySlug: string): Promise<{ brandId: string; service: string }[]> {
  return query<{ brandId: string; service: string }>(
    `select distinct f.brand_id as "brandId", f.value #>> '{}' as service
     from facts f
     join listings l on l.brand_id = f.brand_id and l.status = 'published'
     join cities c on c.id = l.city_id
     where c.slug = $1 and f.type = 'service' and f.is_current`,
    [citySlug],
  );
}
