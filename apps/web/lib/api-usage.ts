/**
 * Liczniki płatnych API do panelu (/admin/koszty). Licznik LiteScrape prowadzi automat (apps/worker/katalog_worker/
 * api_usage.py) w settings.api_usage (suma i podział: litescrape:search, :maps, :reviews, :fetch); zapytania do
 * wyszukiwarek zapasowych (Serper, Brave) liczymy z tabeli search_queries. Miesiąc liczymy w UTC, tak jak automat.
 * Google Places API jest wyłączone (za drogie), jego dawny licznik nie jest już pokazywany.
 */
import { query } from "./db";

export const API_USAGE_KEY = "api_usage";
export const DEFAULT_LIMITS: Record<string, number> = {};

export type MonthUsage = { month: string; used: number };
export type ServiceUsage = {
  key: "litescrape" | "serper" | "brave";
  label: string;
  used: number;
  limit: number | null;
  /** Zużycie oszacowane z danych (automat nie prowadził jeszcze licznika w tym miesiącu). */
  estimated: boolean;
  history: MonthUsage[];
  /** Podział zużycia w bieżącym miesiącu (LiteScrape: wyszukiwanie, Mapy, opinie, strony). */
  breakdown?: { label: string; used: number }[];
};

export const LITESCRAPE_KINDS: [string, string][] = [
  ["search", "wyszukiwanie w Google"],
  ["maps", "miejsca w Mapach Google"],
  ["reviews", "opinie z Map Google"],
  ["fetch", "strony biur"],
];

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
  const searchRows = await query<{ provider: string; month: string; n: number }>(
    `select provider, to_char(created_at at time zone 'UTC', 'YYYY-MM') as month, count(*)::int as n
     from search_queries where provider in ('serper', 'brave') and created_at > now() - interval '13 months'
     group by 1, 2 order by 2 desc`,
  ).catch(() => []);
  const current = value.months?.[month] ?? {};
  const lsHistory = Object.entries(value.months ?? {})
    .filter(([, v]) => typeof v.litescrape === "number")
    .map(([m, v]) => ({ month: m, used: v.litescrape }))
    .sort((a, b) => b.month.localeCompare(a.month));
  const search = (provider: "serper" | "brave", label: string): ServiceUsage => {
    const history = searchRows.filter((r) => r.provider === provider).map((r) => ({ month: r.month, used: r.n }));
    return { key: provider, label, used: history.find((h) => h.month === month)?.used ?? 0, limit: limitOf(value, provider), estimated: false, history };
  };
  return [
    {
      key: "litescrape",
      label: "LiteScrape (Google, Mapy Google z opiniami, strony biur)",
      used: typeof current.litescrape === "number" ? current.litescrape : 0,
      limit: limitOf(value, "litescrape"),
      estimated: false,
      history: lsHistory,
      breakdown: LITESCRAPE_KINDS.map(([kind, label]) => ({ label, used: current[`litescrape:${kind}`] ?? 0 })),
    },
    search("serper", "Serper (zapasowa wyszukiwarka, gdy LiteScrape nie działa)"),
    search("brave", "Brave Search (zapasowa wyszukiwarka)"),
  ];
}
