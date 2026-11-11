import { query } from "./db";

export type AdminCity = {
  id: string;
  name: string;
  slug: string;
  searchEnabled: boolean;
  searchPriority: number | null;
  lastSearchedAt: Date | null;
  deep: boolean;
  deepRequestedAt: Date | null;
  published: number;
  preparing: number;
  found: number;
};

/** Miasta z postępem: firmy w katalogu, w przygotowaniu, znalezione strony i data ostatniego wyszukiwania. */
export async function listAdminCitiesWithProgress(): Promise<AdminCity[]> {
  return query<AdminCity>(
    `select c.id, c.name, c.slug, c.search_enabled as "searchEnabled", c.search_priority as "searchPriority",
            c.last_searched_at as "lastSearchedAt",
            (c.deep_search or coalesce(c.search_priority, 999) <= 12) as deep, c.deep_requested_at as "deepRequestedAt",
            (select count(*)::int from listings l where l.city_id = c.id and l.status = 'published') as published,
            (select count(*)::int from listings l where l.city_id = c.id
               and l.status in ('candidate', 'needs_review', 'verified')) as preparing,
            (select count(*)::int from domains d where lower(d.city_hint) = lower(c.name)) as found
     from cities c
     order by c.search_enabled desc, (c.deep_requested_at is null), (c.last_searched_at is not null), c.search_priority nulls last, c.name`,
  );
}
