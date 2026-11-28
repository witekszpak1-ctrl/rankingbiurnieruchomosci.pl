/**
 * Czyste funkcje panelu administratora (bez dostępu do bazy): filtry z parametrów adresu, udziały z progiem próby,
 * agregacja wzmianek o firmach i eksport CSV. Zapytania SQL są w admin-repo.ts.
 */

/** Poniżej tylu odpowiedzi nie podajemy udziału procentowego (jak w audycie, lib/audit.ts; za mała próba = piszemy, że danych za mało). */
export const MIN_SAMPLE = 10;

export const PLATFORMS = ["chatgpt", "gemini", "perplexity", "claude", "copilot", "google_ai_overview", "google_ai_mode"] as const;
export const STATUSES = ["queued", "running", "done", "failed"] as const;

export const PLATFORM_LABEL: Record<string, string> = {
  chatgpt: "ChatGPT",
  gemini: "Gemini",
  perplexity: "Perplexity",
  claude: "Claude",
  copilot: "Copilot",
  google_ai_overview: "Google AI Overview",
  google_ai_mode: "Google AI Mode",
};

export const STATUS_LABEL: Record<string, string> = {
  queued: "w kolejce",
  running: "w toku",
  done: "gotowy",
  failed: "błąd",
};

export const PAGE_SIZE = 100;

type Raw = Record<string, string | string[] | undefined>;

function str(v: string | string[] | undefined, max = 80): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function isDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type MeasurementFilters = {
  city: string;
  platform: string;
  status: string;
  from: string;
  to: string;
  page: number;
};

/** Filtry pomiarów z parametrów adresu. Nieznane wartości są odrzucane (puste), nic nie trafia do SQL w surowej postaci. */
export function parseMeasurementFilters(sp: Raw): MeasurementFilters {
  const platform = str(sp.platforma, 40);
  const status = str(sp.status, 20);
  const from = str(sp.od, 10);
  const to = str(sp.do, 10);
  const pageNum = Number.parseInt(str(sp.strona, 6), 10);
  return {
    city: str(sp.miasto, 80),
    platform: (PLATFORMS as readonly string[]).includes(platform) ? platform : "",
    status: (STATUSES as readonly string[]).includes(status) ? status : "",
    from: isDate(from) ? from : "",
    to: isDate(to) ? to : "",
    page: Number.isFinite(pageNum) && pageNum >= 1 && pageNum <= 10000 ? pageNum : 1,
  };
}

/** Adres z parametrami (puste pomijamy), do linków paginacji i filtrów. */
export function buildQuery(path: string, params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "" || v === 0) continue;
    q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

/** Udział w procentach (jedno miejsce po przecinku) albo null, gdy próba jest za mała. */
export function sharePct(count: number, total: number, minSample = MIN_SAMPLE): number | null {
  if (total < minSample || total <= 0) return null;
  return Math.round((count / total) * 1000) / 10;
}

export function formatShare(count: number, total: number, minSample = MIN_SAMPLE): string {
  const p = sharePct(count, total, minSample);
  if (p === null) return `za mało danych (${total})`;
  return `${p.toString().replace(".", ",")}% (${count} z ${total})`;
}

// ===== Firmy: agregacja wzmianek =====

export type FirmCityRow = {
  key: string; // brand:<uuid> albo name:<nazwa znormalizowana>
  label: string;
  matched: boolean;
  domain: string | null;
  city: string;
  answers: number; // odpowiedzi z wzmianką o firmie w tym mieście
  recommended: number; // z nich wprost poleconych
};

export type FirmSummary = {
  key: string;
  label: string;
  matched: boolean;
  domain: string | null;
  answers: number;
  recommended: number;
  cities: number;
  topCity: string;
  topCityAnswers: number;
  topCityTotal: number;
  topCityShare: number | null;
};

/** Klucz grupowania niedopasowanej firmy: małe litery, pojedyncze spacje, bez znaków na brzegach. */
export function normalizeFirmName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").replace(/^[\s.,;:"'()-]+|[\s.,;:"'()-]+$/g, "");
}

/**
 * Zbiera wiersze (firma x miasto) w ranking firm. cityTotals: liczba gotowych odpowiedzi w mieście (mianownik udziału).
 * Sortowanie: liczba odpowiedzi malejąco, potem polecenia, potem nazwa.
 */
export function aggregateFirms(rows: FirmCityRow[], cityTotals: Map<string, number>, minSample = MIN_SAMPLE): FirmSummary[] {
  const byKey = new Map<string, FirmCityRow[]>();
  for (const r of rows) {
    const list = byKey.get(r.key);
    if (list) list.push(r);
    else byKey.set(r.key, [r]);
  }
  const out: FirmSummary[] = [];
  for (const [key, list] of byKey) {
    const top = [...list].sort((a, b) => b.answers - a.answers || a.city.localeCompare(b.city, "pl"))[0];
    const total = cityTotals.get(top.city) ?? 0;
    out.push({
      key,
      label: list[0].label,
      matched: list[0].matched,
      domain: list.find((r) => r.domain)?.domain ?? null,
      answers: list.reduce((s, r) => s + r.answers, 0),
      recommended: list.reduce((s, r) => s + r.recommended, 0),
      cities: new Set(list.map((r) => r.city)).size,
      topCity: top.city,
      topCityAnswers: top.answers,
      topCityTotal: total,
      topCityShare: sharePct(top.answers, total, minSample),
    });
  }
  return out.sort((a, b) => b.answers - a.answers || b.recommended - a.recommended || a.label.localeCompare(b.label, "pl"));
}

// ===== Eksport CSV =====

/** Komórka CSV: cudzysłowy, a przed formułami arkusza (= + - @ tab CR) dopisujemy apostrof (ochrona przed wstrzyknięciem formuły). */
export function csvCell(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined) return "";
  let s = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: (string | number | Date | null | undefined)[][]): string {
  const lines = [header.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))];
  // BOM, żeby Excel poprawnie czytał polskie znaki.
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** Data i godzina w czasie polskim. */
export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "-";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pl-PL", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Warsaw" }).format(date);
}

// ===== Szeregi czasowe do wykresów =====

export type DayPoint = { day: string; count: number };

/** Uzupełnia brakujące dni zerami: `days` kolejnych dni (UTC) kończących się na `end` (RRRR-MM-DD), rosnąco. */
export function fillDays(rows: DayPoint[], end: string, days: number): DayPoint[] {
  const by = new Map(rows.map((r) => [r.day, r.count]));
  const endMs = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(endMs) || days < 1) return [];
  return Array.from({ length: days }, (_, i) => {
    const day = new Date(endMs - (days - 1 - i) * 86400000).toISOString().slice(0, 10);
    return { day, count: by.get(day) ?? 0 };
  });
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "-";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pl-PL", { dateStyle: "short", timeZone: "Europe/Warsaw" }).format(date);
}
