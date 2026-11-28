/**
 * Czyste funkcje Master Dashboardu (bez dostępu do bazy): koszty API, boty AI, wiek przebiegów robota i alerty
 * "Wymaga uwagi". Zapytania SQL są w master-repo.ts. Liczby pochodzą wyłącznie z danych, nic nie jest szacowane
 * poza kosztem LiteScrape (stała cena za 1000 zapytań, patrz docs/ops/TASKS.md).
 */

/** Cena zapytań LiteScrape: ok. 0,15 USD za 1000 (jedna odpowiedź = jedno zapytanie z salda). */
export const LITESCRAPE_USD_PER_1000 = 0.15;

/** Etapy robota nieuruchomione dłużej niż tyle godzin dostają alert (robot działa co godzinę, zadania dzienne raz na dobę). */
export const STAGE_MAX_AGE_HOURS = 26;
/** Etap, który nie ruszył od ponad tylu dni, uznajemy za uruchamiany ręcznie i nie alarmujemy. */
export const STAGE_INACTIVE_DAYS = 7;
/** Pomiar AI starszy niż tyle dni dostaje alert (monitoring tygodniowy + zapas). */
export const MEASUREMENT_MAX_AGE_DAYS = 8;

export type Tone = "good" | "warn" | "bad" | "neutral";

// ===== Koszty =====

export function litescrapeCostUsd(count: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  return (count / 1000) * LITESCRAPE_USD_PER_1000;
}

/** Kwota w USD z przecinkiem dziesiętnym; małe kwoty z 4 miejscami, żeby nie pokazać "0,00" przy realnym koszcie. */
export function formatUsd(n: number): string {
  const abs = Math.abs(n);
  const digits = abs > 0 && abs < 0.01 ? 4 : 2;
  return `${n.toFixed(digits).replace(".", ",")} USD`;
}

export type UsageRow = { month: string; service: string; count: number | null };
export type MonthUsage = { month: string; services: Record<string, number> };

/** Grupuje wiersze (miesiąc, usługa, liczba) w miesiące od najnowszego. Wartości puste i ujemne pomijamy. */
export function groupUsage(rows: UsageRow[]): MonthUsage[] {
  const by = new Map<string, Record<string, number>>();
  for (const r of rows) {
    if (typeof r.count !== "number" || !Number.isFinite(r.count) || r.count < 0) continue;
    const m = by.get(r.month) ?? {};
    m[r.service] = r.count;
    by.set(r.month, m);
  }
  return [...by.entries()].map(([month, services]) => ({ month, services })).sort((a, b) => b.month.localeCompare(a.month));
}

export type UsageSplit = {
  /** Wszystkie zapytania LiteScrape w miesiącu (licznik "litescrape", a gdy go brak, suma podliczników). */
  litescrape: number;
  /** Podliczniki LiteScrape według rodzaju (np. fetch, search, maps), bez prefiksu. */
  litescrapeKinds: { kind: string; count: number }[];
  /** Pozostali dostawcy (serper, brave, google_places...): liczba zapytań. */
  others: { service: string; count: number }[];
};

export function splitUsage(services: Record<string, number>): UsageSplit {
  const kinds: { kind: string; count: number }[] = [];
  const others: { service: string; count: number }[] = [];
  let total: number | null = null;
  for (const [service, count] of Object.entries(services)) {
    if (service === "litescrape") total = count;
    else if (service.startsWith("litescrape:")) kinds.push({ kind: service.slice("litescrape:".length), count });
    else others.push({ service, count });
  }
  kinds.sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind));
  others.sort((a, b) => b.count - a.count || a.service.localeCompare(b.service));
  return { litescrape: total ?? kinds.reduce((s, k) => s + k.count, 0), litescrapeKinds: kinds, others };
}

export const SERVICE_LABEL: Record<string, string> = {
  litescrape: "LiteScrape",
  serper: "Serper",
  brave: "Brave",
  google_places: "Google Places (wyłączone, historia)",
};

export const KIND_LABEL: Record<string, string> = {
  fetch: "pobieranie stron",
  search: "wyszukiwanie Google",
  maps: "Mapy Google",
  ai: "pomiary AI",
};

// ===== Boty =====

export type AiBotGroup = "OpenAI" | "Claude" | "Perplexity";

/** Rodzina bota AI po nazwie z page_views.bot (OAI-SearchBot, ChatGPT-User, GPTBot, Claude*, Perplexity*) albo null. */
export function aiBotGroup(bot: string | null | undefined): AiBotGroup | null {
  if (!bot) return null;
  const b = bot.toLowerCase();
  if (b.includes("oai-searchbot") || b.includes("chatgpt") || b.includes("gptbot")) return "OpenAI";
  if (b.includes("claude") || b.includes("anthropic")) return "Claude";
  if (b.includes("perplexity")) return "Perplexity";
  return null;
}

// ===== Wiek =====

export function ageHours(from: Date | string | null | undefined, now: Date = new Date()): number | null {
  if (!from) return null;
  const t = (from instanceof Date ? from : new Date(from)).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, (now.getTime() - t) / 3_600_000);
}

/** "5 min temu", "3 godz. temu", "2 dni temu", albo "brak". */
export function formatAge(hours: number | null): string {
  if (hours === null) return "brak";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min temu`;
  if (hours < 48) return `${Math.round(hours)} godz. temu`;
  return `${Math.round(hours / 24)} dni temu`;
}

// ===== Alerty =====

export type StageLast = { stage: string; status: string; startedAt: Date | string };
export type PortalFact = { slug: string; name: string; status: "live" | "private" | "planned"; domain: string | null; published: number; domains: number };

export type AlertInput = {
  now?: Date;
  /** Najnowszy przebieg każdego etapu robota. */
  lastRuns: StageLast[];
  /** Nieudane przebiegi z ostatnich 24 godzin (etap + liczba). */
  failedRuns24h: { stage: string; count: number }[];
  /** Nieudane pomiary AI z ostatnich 48 godzin, w tym z kodem 503 w treści błędu. */
  failedMeasurements48h: { failed: number; http503: number };
  lastMeasuredAt: Date | string | null;
  portals: PortalFact[];
};

export type Alert = { key: string; tone: "bad" | "warn" | "neutral"; title: string; detail: string; href: string };

const TONE_ORDER = { bad: 0, warn: 1, neutral: 2 } as const;

/** Alerty "Wymaga uwagi" wyliczane z danych: od najpoważniejszych. Brak alertów = pusta lista. */
export function buildAlerts(input: AlertInput): Alert[] {
  const now = input.now ?? new Date();
  const out: Alert[] = [];

  const failedTotal = input.failedRuns24h.reduce((s, r) => s + r.count, 0);
  if (failedTotal > 0) {
    const stages = input.failedRuns24h.map((r) => `${r.stage} (${r.count})`).join(", ");
    out.push({ key: "runs-failed", tone: "bad", title: `Nieudane przebiegi robota w ostatniej dobie: ${failedTotal}`, detail: stages, href: "/admin/robot?status=failed" });
  }

  for (const r of input.lastRuns) {
    const h = ageHours(r.startedAt, now);
    if (h === null) continue;
    if (h > STAGE_MAX_AGE_HOURS && h <= STAGE_INACTIVE_DAYS * 24) {
      out.push({
        key: `stage-stale-${r.stage}`,
        tone: "warn",
        title: `Etap "${r.stage}" nie był uruchomiony od ${formatAge(h).replace(" temu", "")}`,
        detail: `Ostatni przebieg ${formatAge(h)}, oczekiwany co najwyżej co ${STAGE_MAX_AGE_HOURS} godz.`,
        href: `/admin/robot?etap=${encodeURIComponent(r.stage)}`,
      });
    }
  }

  const m = input.failedMeasurements48h;
  if (m.failed > 0) {
    out.push({
      key: "measure-failed",
      tone: m.http503 > 0 ? "bad" : "warn",
      title: `Nieudane pomiary AI w ostatnich 48 godzinach: ${m.failed}`,
      detail: m.http503 > 0 ? `w tym z kodem 503 (usługa niedostępna): ${m.http503}` : "Szczegóły błędów w tabeli pomiarów.",
      href: "/admin/pomiary?status=failed",
    });
  }

  const mh = ageHours(input.lastMeasuredAt, now);
  if (mh === null) {
    out.push({ key: "measure-none", tone: "warn", title: "Brak pomiarów widoczności w AI", detail: "Monitoring tygodniowy jeszcze nie zapisał żadnego pomiaru.", href: "/admin/pomiary" });
  } else if (mh > MEASUREMENT_MAX_AGE_DAYS * 24) {
    out.push({ key: "measure-old", tone: "warn", title: `Ostatni pomiar AI sprzed ${Math.round(mh / 24)} dni`, detail: `Monitoring tygodniowy powinien odświeżać pomiary co najwyżej co ${MEASUREMENT_MAX_AGE_DAYS} dni.`, href: "/admin/pomiary" });
  }

  const live = input.portals.filter((p) => p.status !== "planned");
  const empty = live.filter((p) => p.published === 0 && p.domains === 0);
  if (empty.length) {
    out.push({
      key: "portals-empty",
      tone: "neutral",
      title: `Portale bez danych: ${empty.length}`,
      detail: `${empty.map((p) => p.name).join(", ")}. Brak domen i opublikowanych profili; zbieranie firm wymaga zgody na budżet.`,
      href: "/admin/portale",
    });
  }
  const noDomain = live.filter((p) => p.status === "private" && !p.domain);
  if (noDomain.length) {
    out.push({
      key: "portals-nodomain",
      tone: "neutral",
      title: `Portale prywatne bez domeny: ${noDomain.length}`,
      detail: `${noDomain.map((p) => p.name).join(", ")}. Domenę kupuje właściciel, potem uzupełnij ją w rejestrze portali.`,
      href: "/admin/portale",
    });
  }

  return out.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
}

/** Pigułka stanu przebiegu: ok / failed / running -> ton. */
export function runTone(status: string): Tone {
  if (status === "ok") return "good";
  if (status === "failed") return "bad";
  if (status === "running") return "warn";
  return "neutral";
}

export const RUN_STATUS_LABEL: Record<string, string> = { ok: "ok", failed: "błąd", running: "w toku" };

export const PORTAL_STATUS_LABEL: Record<string, string> = { live: "działa", private: "prywatny", planned: "planowany" };

export function portalTone(status: string): Tone | "brand" {
  if (status === "live") return "good";
  if (status === "private") return "warn";
  return "neutral";
}

/** Adres projektu Vercel (zespół witek1). */
export function vercelProjectUrl(project: string | null | undefined): string | null {
  return project ? `https://vercel.com/witek1/${encodeURIComponent(project)}` : null;
}

const DOMAIN_RE = /^(?=.{4,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/;

/** Walidacja pól formularza edycji portalu. Zwraca wartości do zapisu albo komunikat błędu. */
export function parsePortalForm(raw: { domain: string; status: string; notes: string }): { ok: true; domain: string | null; status: "live" | "private" | "planned"; notes: string | null } | { ok: false; error: string } {
  const status = raw.status;
  if (status !== "live" && status !== "private" && status !== "planned") return { ok: false, error: "Niepoprawny status portalu." };
  const domain = raw.domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (domain && !DOMAIN_RE.test(domain)) return { ok: false, error: "Niepoprawna domena (np. przyklad.pl)." };
  const notes = raw.notes.trim().slice(0, 1000);
  return { ok: true, domain: domain || null, status, notes: notes || null };
}

// ===== Ruch =====

export type TrafficPoint = { day: string; isBot: boolean; bot: string | null; views: number; visitors: number };

/** Dzień UTC (RRRR-MM-DD) przesunięty o `offset` dni względem `now`. */
export function dayKey(now: Date, offset = 0): string {
  return new Date(now.getTime() + offset * 86_400_000).toISOString().slice(0, 10);
}

export type TrafficSummary = {
  humanViews30: number;
  botViews30: number;
  /** Suma dziennych liczb unikalnych odwiedzających (sól jest losowa co dobę, więc między dniami się nie łączą). */
  humanVisitors30: number;
  aiBots7: { total: number; groups: Record<AiBotGroup, number> };
};

/** Ludzie i boty z 30 dni oraz boty AI z 7 dni (dzisiejszy dzień i 6 poprzednich). */
export function summarizeTraffic(rows: TrafficPoint[], now: Date = new Date()): TrafficSummary {
  const from30 = dayKey(now, -29);
  const from7 = dayKey(now, -6);
  const out: TrafficSummary = { humanViews30: 0, botViews30: 0, humanVisitors30: 0, aiBots7: { total: 0, groups: { OpenAI: 0, Claude: 0, Perplexity: 0 } } };
  for (const r of rows) {
    if (r.day >= from30) {
      if (r.isBot) out.botViews30 += r.views;
      else {
        out.humanViews30 += r.views;
        out.humanVisitors30 += r.visitors;
      }
    }
    if (r.day >= from7 && r.isBot) {
      const g = aiBotGroup(r.bot);
      if (g) {
        out.aiBots7.groups[g] += r.views;
        out.aiBots7.total += r.views;
      }
    }
  }
  return out;
}

/** Najczęstsze boty z ostatnich `days` dni (od najliczniejszego); wpisy bez nazwy łączymy jako "(bez nazwy)". */
export function topBots(rows: TrafficPoint[], now: Date, days: number, limit = 10): { bot: string; views: number; ai: AiBotGroup | null }[] {
  const from = dayKey(now, -(days - 1));
  const by = new Map<string, number>();
  for (const r of rows) {
    if (!r.isBot || r.day < from) continue;
    const name = r.bot?.trim() || "(bez nazwy)";
    by.set(name, (by.get(name) ?? 0) + r.views);
  }
  return [...by.entries()]
    .map(([bot, views]) => ({ bot, views, ai: aiBotGroup(bot) }))
    .sort((a, b) => b.views - a.views || a.bot.localeCompare(b.bot))
    .slice(0, limit);
}

/** Szereg dzienny ludzie/boty dla `days` dni kończących się na dziś (brakujące dni = 0). */
export function trafficSeries(rows: TrafficPoint[], now: Date, days: number): { day: string; human: number; bot: number }[] {
  const out = new Map<string, { day: string; human: number; bot: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const day = dayKey(now, -i);
    out.set(day, { day, human: 0, bot: 0 });
  }
  for (const r of rows) {
    const p = out.get(r.day);
    if (!p) continue;
    if (r.isBot) p.bot += r.views;
    else p.human += r.views;
  }
  return [...out.values()];
}

// ===== Przebiegi robota =====

/** Czas trwania przebiegu: "45 s", "12 min", "2 godz. 5 min"; null gdy przebieg trwa albo brak dat. */
export function formatDuration(start: Date | string, end: Date | string | null): string {
  if (!end) return "-";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "-";
  const s = Math.round(ms / 1000);
  if (s < 90) return `${s} s`;
  const min = Math.round(s / 60);
  if (min < 120) return `${min} min`;
  return `${Math.floor(min / 60)} godz. ${min % 60} min`;
}

/** Skrót liczników przebiegu ("klucz: liczba", tylko liczby, do `max` pozycji) albo "-". */
export function formatCounts(counts: Record<string, unknown> | null | undefined, max = 4): string {
  const parts = Object.entries(counts ?? {})
    .filter(([, v]) => typeof v === "number" && Number.isFinite(v))
    .slice(0, max)
    .map(([k, v]) => `${k}: ${v}`);
  return parts.length ? parts.join(", ") : "-";
}

const RUN_STATUSES = ["ok", "failed", "running"];

/** Filtry listy przebiegów z parametrów adresu; nieznane wartości są odrzucane. */
export function parseRunFilters(sp: Record<string, string | string[] | undefined>): { stage: string; status: string; vertical: string } {
  const s = (v: string | string[] | undefined, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const stage = s(sp.etap, 40);
  const status = s(sp.status, 20);
  const vertical = s(sp.branza, 40);
  return {
    stage: /^[a-z0-9_-]*$/.test(stage) ? stage : "",
    status: RUN_STATUSES.includes(status) ? status : "",
    vertical: /^[a-z0-9-]*$/.test(vertical) ? vertical : "",
  };
}

/** Szereg dzienny z wierszy (dzień, wartość) dla `days` dni kończących się na dziś; brakujące dni = 0. */
export function dailySeries(rows: { day: string; value: number }[], now: Date, days: number): { day: string; value: number }[] {
  const by = new Map<string, number>();
  for (const r of rows) by.set(r.day, (by.get(r.day) ?? 0) + r.value);
  return Array.from({ length: days }, (_, i) => {
    const day = dayKey(now, -(days - 1 - i));
    return { day, value: by.get(day) ?? 0 };
  });
}
