import { query } from "./db";

export type AdminOfferFirm = {
  domainId: string;
  host: string;
  brandName: string;
  listingId: string | null;
  citySlug: string | null;
  cityName: string | null;
  slug: string | null;
  offersUrl: string | null;
  checkedAt: Date | null;
  active: number;
  priced: number;
  lastSeenAt: Date | null;
};

export type AdminOffer = {
  domainId: string;
  title: string;
  url: string;
  priceAmount: number | null;
  priceCurrency: string | null;
  pricePeriod: string | null;
  isActive: boolean;
  firstSeenAt: Date;
  lastSeenAt: Date;
};

/** Domeny sprawdzane pod kątem ofert (zweryfikowane, z opublikowanym wpisem) albo mające jakiekolwiek oferty. */
export async function listOfferFirms(): Promise<AdminOfferFirm[]> {
  return query<AdminOfferFirm>(
    `select d.id as "domainId", d.host, b.name as "brandName", l.id as "listingId", c.slug as "citySlug",
            c.name as "cityName", l.slug, d.offers_url as "offersUrl", d.offers_checked_at as "checkedAt",
            count(o.id) filter (where o.is_active)::int as active,
            count(o.id) filter (where o.is_active and o.price_amount is not null)::int as priced,
            max(o.last_seen_at) as "lastSeenAt"
     from domains d
     join brands b on b.id = d.brand_id
     left join lateral (select id, city_id, slug from listings where brand_id = b.id
                        order by (status = 'published') desc, created_at desc limit 1) l on true
     left join cities c on c.id = l.city_id
     left join offers o on o.domain_id = d.id
     where (d.verification_status = 'verified'
            and exists (select 1 from listings x where x.brand_id = d.brand_id and x.status = 'published'))
        or exists (select 1 from offers y where y.domain_id = d.id)
     group by d.id, b.name, l.id, c.slug, c.name, l.slug
     order by active desc, b.name`,
  );
}

/** Wszystkie oferty (aktywne i nieaktywne), w kolejności ze strony firmy. */
export async function listAdminOffers(): Promise<AdminOffer[]> {
  return query<AdminOffer>(
    `select domain_id as "domainId", title, url, price_amount::float8 as "priceAmount", price_currency as "priceCurrency",
            price_period as "pricePeriod", is_active as "isActive", first_seen_at as "firstSeenAt",
            last_seen_at as "lastSeenAt"
     from offers order by domain_id, is_active desc, position, first_seen_at desc`,
  );
}
