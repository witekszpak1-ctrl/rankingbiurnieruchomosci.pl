/**
 * Statystyki wszystkich wejść liczone po stronie serwera (tabela page_views).
 *
 * Bez plików cookie i bez skryptu w przeglądarce: middleware zgłasza każde wejście, a tu zapisujemy tylko ścieżkę,
 * źródło (sama domena), parametry UTM, kraj i miasto z nagłówków Vercela oraz typ urządzenia, przeglądarkę i system
 * odczytane z nagłówka User-Agent. Adresu IP ani pełnego User-Agent nie zapisujemy. Unikalnych odwiedzających liczymy
 * po skrócie (IP + User-Agent + losowa sól dnia); sól starszą niż doba usuwamy, więc skrótów nie da się powiązać
 * między dniami ani odwrócić.
 */

import { createHash, randomBytes } from "node:crypto";

import { query } from "./db";
import { BOT_RE } from "./pulse-bots";

export type Hit = {
  path: string;
  kind: "page" | "nav";
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  country: string | null;
  city: string | null;
  ua: string;
  ip: string | null;
  host: string | null;
};

export type UaInfo = { device: "mobile" | "tablet" | "desktop" | "other"; browser: string; os: string };

export function parseUserAgent(ua: string): UaInfo {
  const s = ua || "";
  const tablet = /iPad|Tablet|Nexus (7|9|10)|SM-T\d|Kindle|Silk/i.test(s) || (/Android/i.test(s) && !/Mobile/i.test(s));
  const mobile = !tablet && /Mobi|iPhone|iPod|Android.*Mobile|Windows Phone|Opera Mini/i.test(s);
  const desktop = !tablet && !mobile && /Windows NT|Macintosh|X11|Linux x86_64|CrOS/i.test(s);
  const device = tablet ? "tablet" : mobile ? "mobile" : desktop ? "desktop" : "other";
  const browser =
    /Edg\//.test(s) ? "Edge"
    : /OPR\/|Opera/.test(s) ? "Opera"
    : /SamsungBrowser/.test(s) ? "Samsung Internet"
    : /Firefox\/|FxiOS/.test(s) ? "Firefox"
    : /Chrome\/|CriOS/.test(s) ? "Chrome"
    : /Safari\//.test(s) && /Version\//.test(s) ? "Safari"
    : "inna";
  const os =
    /Windows NT/.test(s) ? "Windows"
    : /iPhone|iPad|iPod/.test(s) ? "iOS"
    : /Android/.test(s) ? "Android"
    : /Mac OS X|Macintosh/.test(s) ? "macOS"
    : /CrOS/.test(s) ? "ChromeOS"
    : /Linux/.test(s) ? "Linux"
    : "inny";
  return { device, browser, os };
}

/** Nazwa robota z nagłówka User-Agent albo null dla przeglądarki człowieka. Pusty nagłówek traktujemy jak robota. */
export function botName(ua: string): string | null {
  if (!ua) return "bez User-Agent";
  const match = ua.match(BOT_RE);
  if (!match) return null;
  const token = ua.match(/([A-Za-z][\w.-]*(?:bot|crawler|spider|Bot|Crawler|Spider)[\w.-]*)/)?.[1];
  return (token ?? match[0]).slice(0, 60);
}

/** Zewnętrzna domena źródła (bez www) albo null dla wejścia bezpośredniego lub z własnego serwisu. */
export function referrerHost(referrer: string | null, ownHost: string | null): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
    const own = (ownHost ?? "").toLowerCase().replace(/^www\./, "").replace(/:\d+$/, "");
    if (!host || host === own || host.endsWith(".vercel.app")) return null;
    return host.slice(0, 200);
  } catch {
    return null;
  }
}

function clip(value: string | null, max: number): string | null {
  const v = value?.trim();
  return v ? v.slice(0, max) : null;
}

async function saltForToday(): Promise<string> {
  const rows = await query<{ salt: string }>(
    `with fresh as (
       insert into visit_salts (day, salt) values (current_date, $1) on conflict (day) do nothing returning salt
     )
     select salt from fresh union all select salt from visit_salts where day = current_date limit 1`,
    [randomBytes(16).toString("hex")],
  );
  await query("delete from visit_salts where day < current_date - 1");
  return rows[0]?.salt ?? "";
}

export async function recordHit(hit: Hit): Promise<void> {
  const bot = botName(hit.ua);
  const info = parseUserAgent(hit.ua);
  let visitor: string | null = null;
  if (!bot && hit.ip) {
    const salt = await saltForToday();
    visitor = createHash("sha256").update(`${salt}|${hit.ip}|${hit.ua}`).digest("hex").slice(0, 16);
  }
  await query(
    `insert into page_views (path, kind, is_bot, bot, visitor, referrer_host, utm_source, utm_medium, utm_campaign,
                             country, city, device, browser, os)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      hit.path.slice(0, 300),
      hit.kind,
      Boolean(bot),
      bot,
      visitor,
      referrerHost(hit.referrer, hit.host),
      clip(hit.utmSource, 100),
      clip(hit.utmMedium, 100),
      clip(hit.utmCampaign, 100),
      clip(hit.country, 2),
      clip(hit.city, 80),
      bot ? "other" : info.device,
      bot ? null : info.browser,
      bot ? null : info.os,
    ],
  );
}

// ----------------------------------------------------------------------------- raport w panelu

export type TrafficSummary = { views: number; visitors: number; entries: number; bots: number };
export type DayRow = { day: string; views: number; visitors: number; bots: number };
export type CountRow = { label: string; views: number; visitors: number };

const HUMAN = "not is_bot";
const SINCE = "created_at >= now() - make_interval(days => $1)";

export async function trafficSummary(days: number): Promise<TrafficSummary> {
  const rows = await query<TrafficSummary>(
    `select (count(*) filter (where ${HUMAN}))::int as views,
            (select coalesce(sum(n), 0)::int from (
               select count(distinct visitor) as n from page_views
               where ${SINCE} and ${HUMAN} group by (created_at at time zone 'Europe/Warsaw')::date) d) as visitors,
            (count(*) filter (where ${HUMAN} and (referrer_host is not null or utm_source is not null)))::int as entries,
            (count(*) filter (where is_bot))::int as bots
     from page_views where ${SINCE}`,
    [days],
  );
  return rows[0] ?? { views: 0, visitors: 0, entries: 0, bots: 0 };
}

export async function trafficByDay(days: number): Promise<DayRow[]> {
  return query<DayRow>(
    `select to_char(d, 'YYYY-MM-DD') as day,
            coalesce(v.views, 0)::int as views, coalesce(v.visitors, 0)::int as visitors, coalesce(v.bots, 0)::int as bots
     from generate_series((now() at time zone 'Europe/Warsaw')::date - ($1::int - 1), (now() at time zone 'Europe/Warsaw')::date, '1 day') d
     left join (
       select (created_at at time zone 'Europe/Warsaw')::date as day,
              count(*) filter (where ${HUMAN}) as views,
              count(distinct visitor) filter (where ${HUMAN}) as visitors,
              count(*) filter (where is_bot) as bots
       from page_views where ${SINCE} group by 1
     ) v on v.day = d
     order by d`,
    [days],
  );
}

const COLUMNS = {
  path: "path",
  referrer: "coalesce(referrer_host, '(wejście bezpośrednie)')",
  utm: "concat_ws(' / ', utm_source, utm_medium, utm_campaign)",
  country: "coalesce(country, '?')",
  city: "coalesce(city, '?')",
  device: "device",
  browser: "coalesce(browser, '?')",
  os: "coalesce(os, '?')",
} as const;

/** Najczęstsze wartości jednej kolumny wśród wejść ludzi (dla źródeł tylko pełne wejścia, bez przejść wewnętrznych). */
export async function topValues(column: keyof typeof COLUMNS, days: number, limit = 15): Promise<CountRow[]> {
  const extra = column === "referrer" ? "and kind = 'page'" : column === "utm" ? "and utm_source is not null" : "";
  return query<CountRow>(
    `select ${COLUMNS[column]} as label, count(*)::int as views, count(distinct visitor)::int as visitors
     from page_views where ${SINCE} and ${HUMAN} ${extra}
     group by 1 order by 2 desc, 1 limit $2`,
    [days, limit],
  );
}

export async function topBots(days: number, limit = 15): Promise<CountRow[]> {
  return query<CountRow>(
    `select coalesce(bot, '?') as label, count(*)::int as views, 0 as visitors
     from page_views where ${SINCE} and is_bot group by 1 order by 2 desc, 1 limit $2`,
    [days, limit],
  );
}
