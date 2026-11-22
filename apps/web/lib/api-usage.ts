/**
 * Liczniki płatnych API do panelu (/admin/koszty). Licznik Google Places prowadzi automat (apps/worker/katalog_worker/
 * api_usage.py) w settings.api_usage; zapytania do wyszukiwarek (Serper, Brave) liczymy z tabeli search_queries.
 * Miesiąc liczymy w UTC, tak jak automat.
 */
import { query } from "./db";

export const API_USAGE_KEY = "api_usage";
export const DEFAULT_LIMITS: Record<string, number> = { google_places: 950 };

export type MonthUsage = { month: string; used: number };
export type ServiceUsage = {
  key: "google_places" | "serper" | "brave";
  label: string;
  used: number;
  limit: number | null;
  /** Zużycie oszacowane z danych (automat nie prowadził jeszcze licznika w tym miesiącu). */
  estimated: boolean;
  history: MonthUsage[];
};

type Value = { months?: Record<string, Record<string, number>>; limits?: Record<string, number> };

export const monthKey = (d = new Date()) => d.toISOString().slice(0, 7);

export function limitOf(value: Value, key: string): number | null {
  const raw = value.limits?.[key] ?? DEFAULT_LIMITS[key];
  return typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : null;
}

export async function getApiUsageValue(): Promise<Value> {
  const rows = await query<{ value: Value }>("select value from settings where key = $1", [API_USAGE_KEY]).catch(() => []);
  return rows[0]?.value ?? {};
}

const MONTH_START = "date_trunc('month', now() at time zone 'UTC') at time zone 'UTC'";

export async function getApiUsage(): Promise<ServiceUsage[]> {
  const value = await getApiUsageValue();
  const month = monthKey();
  const [placesSeed, searchRows] = await Promise.all([
    query<{ n: number }>(`select count(*)::int as n from google_places where fetched_at >= ${MONTH_START}`).catch(() => [{ n: 0 }]),
    query<{ provider: string; month: string; n: number }>(
      `select provider, to_char(created_at at time zone 'UTC', 'YYYY-MM') as month, count(*)::int as n
       from search_queries where provider in ('serper', 'brave') and created_at > now() - interval '13 months'
       group by 1, 2 order by 2 desc`,
    ).catch(() => []),
  ]);
  const counted = value.months?.[month]?.google_places;
  const placesHistory = Object.entries(value.months ?? {})
    .filter(([, v]) => typeof v.google_places === "number")
    .map(([m, v]) => ({ month: m, used: v.google_places }))
    .sort((a, b) => b.month.localeCompare(a.month));
  const search = (provider: "serper" | "brave", label: string): ServiceUsage => {
    const history = searchRows.filter((r) => r.provider === provider).map((r) => ({ month: r.month, used: r.n }));
    return { key: provider, label, used: history.find((h) => h.month === month)?.used ?? 0, limit: limitOf(value, provider), estimated: false, history };
  };
  return [
    {
      key: "google_places",
      label: "Google Places (oceny i opinie z Map Google)",
      used: typeof counted === "number" ? counted : placesSeed[0]?.n ?? 0,
      limit: limitOf(value, "google_places"),
      estimated: typeof counted !== "number",
      history: placesHistory,
    },
    search("serper", "Serper (wyszukiwanie nowych biur w Google)"),
    search("brave", "Brave Search (zapasowa wyszukiwarka)"),
  ];
}
