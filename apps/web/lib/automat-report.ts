import { query } from "./db";

/** Jedna pozycja raportu dziennego: klucz, nazwa po ludzku i zapytanie liczące dla dnia $1 (data w czasie polskim). */
export const METRICS = [
  { key: "searches", label: "Wyszukiwań w Google", sql: "select count(*) from search_queries where (created_at at time zone 'Europe/Warsaw')::date = d.day" },
  { key: "found", label: "Znalezionych stron www", sql: "select count(*) from domains where (first_seen_at at time zone 'Europe/Warsaw')::date = d.day" },
  { key: "agencies", label: "W tym stron biur nieruchomości", sql: "select count(*) from domains where classification = 'official' and (first_seen_at at time zone 'Europe/Warsaw')::date = d.day" },
  { key: "pages", label: "Pobranych podstron (o nas, oferty, kontakt)", sql: "select count(*) from crawl_pages where (fetched_at at time zone 'Europe/Warsaw')::date = d.day" },
  { key: "registry", label: "Firm sprawdzonych w KRS i wykazie VAT", sql: "select count(*) from legal_entities where (registry_synced_at at time zone 'Europe/Warsaw')::date = d.day" },
  { key: "facts", label: "Zebranych informacji do opisów", sql: "select count(*) from facts where (created_at at time zone 'Europe/Warsaw')::date = d.day" },
  { key: "descriptions", label: "Napisanych własnych opisów", sql: "select count(*) from descriptions where (created_at at time zone 'Europe/Warsaw')::date = d.day" },
  { key: "published", label: "Firm dodanych do katalogu", sql: "select count(*) from listings where (published_at at time zone 'Europe/Warsaw')::date = d.day" },
  { key: "offers", label: "Nowych ofert nieruchomości", sql: "select count(*) from offers where (first_seen_at at time zone 'Europe/Warsaw')::date = d.day" },
  { key: "contacts", label: "Nowych telefonów i e-maili", sql: "select count(*) from contacts where (created_at at time zone 'Europe/Warsaw')::date = d.day" },
  { key: "images", label: "Firm ze sprawdzonym logo i zdjęciem", sql: "select count(*) from brands where (image_checked_at at time zone 'Europe/Warsaw')::date = d.day" },
  { key: "google", label: "Firm z oceną z Map Google", sql: "select count(*) from google_places where status = 'ok' and (fetched_at at time zone 'Europe/Warsaw')::date = d.day" },
  { key: "leads", label: "Wiadomości od klientów", sql: "select count(*) from leads where (created_at at time zone 'Europe/Warsaw')::date = d.day" },
  { key: "claims", label: "Zgłoszeń właścicieli", sql: "select count(*) from owner_claims where (created_at at time zone 'Europe/Warsaw')::date = d.day" },
] as const;

export type MetricKey = (typeof METRICS)[number]["key"];
export type DayRow = { day: string } & Record<MetricKey, number>;

export function warsawToday(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 24 * 3600 * 1000);
  return d.toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });
}

export function isDay(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

/** Liczby dla każdego dnia od `from` do `to` (włącznie), od najnowszego. */
export async function dailyTotals(from: string, to: string): Promise<DayRow[]> {
  const cols = METRICS.map((m) => `coalesce((${m.sql}), 0)::int as "${m.key}"`).join(",\n");
  return query<DayRow>(
    `select to_char(d.day, 'YYYY-MM-DD') as day, ${cols}
     from (select generate_series($1::date, $2::date, interval '1 day')::date as day) d
     order by d.day desc`,
    [from, to],
  ).catch(() => []);
}

export type DayDetail = {
  cities: { city: string; found: number; agencies: number }[];
  published: { listingId: string; name: string; city: string }[];
  rejected: number;
};

export async function dayDetail(day: string): Promise<DayDetail> {
  const [cities, published, rejected] = await Promise.all([
    query<{ city: string; found: number; agencies: number }>(
      `select coalesce(city_hint, 'bez miasta') as city, count(*)::int as found,
              count(*) filter (where classification = 'official')::int as agencies
       from domains where (first_seen_at at time zone 'Europe/Warsaw')::date = $1::date
       group by 1 order by found desc, city`,
      [day],
    ).catch(() => []),
    query<{ listingId: string; name: string; city: string }>(
      `select l.id as "listingId", b.name, c.name as city
       from listings l join brands b on b.id = l.brand_id join cities c on c.id = l.city_id
       where (l.published_at at time zone 'Europe/Warsaw')::date = $1::date
       order by l.published_at desc limit 300`,
      [day],
    ).catch(() => []),
    query<{ n: number }>(
      `select count(*)::int as n from domains
       where verification_status = 'rejected' and (last_checked_at at time zone 'Europe/Warsaw')::date = $1::date`,
      [day],
    ).catch(() => [{ n: 0 }]),
  ]);
  return { cities, published, rejected: rejected[0]?.n ?? 0 };
}

export async function runsOfDay(day: string) {
  return query<{
    id: string;
    stage: string;
    status: string;
    counts: Record<string, unknown>;
    cost: number | null;
    startedAt: Date;
    finishedAt: Date | null;
  }>(
    `select id, stage, status, counts, cost_usd::float8 as cost, started_at as "startedAt", finished_at as "finishedAt"
     from pipeline_runs where (started_at at time zone 'Europe/Warsaw')::date = $1::date
     order by started_at desc limit 200`,
    [day],
  ).catch(() => []);
}
