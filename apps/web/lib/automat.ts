import { query } from "./db";

export type AutomatStatus = {
  citiesTotal: number;
  citiesSearched: number;
  citiesQueued: number;
  nextCities: string[];
  lastSearched: { name: string; at: Date } | null;
  bundlesWaiting: number;
  foundLast7: number;
  publishedLast7: number;
  published: number;
  preparing: number;
  funnel: { toCheck: number; agencies: number; confirmed: number; unconfirmed: number; rejected: number };
};

export async function getAutomatStatus(): Promise<AutomatStatus> {
  const [cities, next, last, other, funnel] = await Promise.all([
    query<{ total: number; searched: number; queued: number }>(
      `select count(*)::int as total, count(last_searched_at)::int as searched,
              count(*) filter (where search_enabled and last_searched_at is null)::int as queued from cities`,
    ).catch(() => [{ total: 0, searched: 0, queued: 0 }]),
    query<{ name: string }>(
      `select name from cities where search_enabled and last_searched_at is null
       order by search_priority nulls last, name limit 5`,
    ).catch(() => []),
    query<{ name: string; at: Date }>(
      `select name, last_searched_at as at from cities where last_searched_at is not null
       order by last_searched_at desc limit 1`,
    ).catch(() => []),
    query<{ bundles: number; found7: number; pub7: number; published: number; preparing: number }>(
      `select (select count(*)::int from queue_items where type = 'describe' and status = 'pending') as bundles,
              (select count(*)::int from domains where first_seen_at > now() - interval '7 days') as found7,
              (select count(*)::int from listings where status = 'published' and published_at > now() - interval '7 days') as pub7,
              (select count(*)::int from listings where status = 'published') as published,
              (select count(*)::int from listings where status in ('candidate', 'needs_review', 'verified')) as preparing`,
    ),
    query<{ toCheck: number; agencies: number; confirmed: number; unconfirmed: number; rejected: number }>(
      `select count(*) filter (where verification_status = 'candidate')::int as "toCheck",
              count(*) filter (where classification = 'official')::int as agencies,
              count(*) filter (where verification_status in ('verified', 'probable'))::int as confirmed,
              count(*) filter (where verification_status = 'needs_review')::int as unconfirmed,
              count(*) filter (where verification_status = 'rejected')::int as rejected
       from domains`,
    ).catch(() => []),
  ]);
  const c = cities[0] ?? { total: 0, searched: 0, queued: 0 };
  const o = other[0];
  return {
    citiesTotal: c.total,
    citiesSearched: c.searched,
    citiesQueued: c.queued,
    nextCities: next.map((n) => n.name),
    lastSearched: last[0] ?? null,
    bundlesWaiting: o?.bundles ?? 0,
    foundLast7: o?.found7 ?? 0,
    publishedLast7: o?.pub7 ?? 0,
    published: o?.published ?? 0,
    preparing: o?.preparing ?? 0,
    funnel: funnel[0] ?? { toCheck: 0, agencies: 0, confirmed: 0, unconfirmed: 0, rejected: 0 },
  };
}

/** Godzina z harmonogramu GitHub Actions (UTC) w czasie polskim, dla dzisiejszej daty (zimą +1, latem +2). */
export function warsawTime(hourUtc: number, minute: number): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hourUtc, minute));
  return d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw" });
}
