/**
 * Plan pracy automatu na dany dzień (w strefie panelu, harmonogramy w czasie polskim) i dopasowanie faktycznych przebiegów z pipeline_runs do pozycji planu.
 * Harmonogramy muszą odpowiadać plikom .github/workflows/*.yml i zaplanowanemu zadaniu Claude.
 */

import { ADMIN_TZ } from "./tz";

export type Run = {
  id: string;
  stage: string;
  status: string;
  counts: Record<string, unknown>;
  startedAt: Date;
  finishedAt: Date | null;
};

export type SlotKind = "claude" | "pipeline" | "offers";

export type SlotState = "planned" | "queued" | "running" | "plan_running" | "done" | "failed" | "waiting_report" | "missed";

export type Slot = {
  kind: SlotKind;
  at: Date;
  title: string;
  system: string;
  what: string;
  state: SlotState;
  runs: Run[];
};

/** Sesje Claude: co 2 godziny od 6:41 do 22:41 czasu polskiego. */
export const SESSION_HOURS = [6, 8, 10, 12, 14, 16, 18, 20, 22];
/** pipeline.yml: minuta 17 co 3 godziny UTC. */
const PIPELINE_UTC_HOURS = [0, 3, 6, 9, 12, 15, 18, 21];
/** offers.yml: 5:07 UTC. */
const OFFERS_UTC = { h: 5, m: 7 };

const CLAUDE_STAGES = new Set(["claude_session"]);
// Kroki tylko z workflow "dane firm" (contacts działa też w każdym przebiegu pipeline).
const OFFERS_STAGES = new Set(["offers", "google_reviews"]);

const MIN = 60 * 1000;

function offsetMinutes(at: Date, tz = "Europe/Warsaw"): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return Math.round((asUtc - Math.floor(at.getTime() / MIN) * MIN) / MIN);
}

/** Chwila odpowiadająca godzinie h:m czasu polskiego w dniu `day` (RRRR-MM-DD). */
export function warsawAt(day: string, h: number, m: number): Date {
  const [y, mo, d] = day.split("-").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, m);
  return new Date(guess - offsetMinutes(new Date(guess)) * MIN);
}

/** Dzień (RRRR-MM-DD) w strefie panelu. */
export function dayIn(at: Date, tz = ADMIN_TZ): string {
  return at.toLocaleDateString("sv-SE", { timeZone: tz });
}

export function hhmm(at: Date, tz = ADMIN_TZ): string {
  return at.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", timeZone: tz });
}

function shift(day: string, days: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Godziny z harmonogramu UTC, które w strefie panelu wypadają w dniu `day`. */
function utcSlotsOnDay(day: string, hours: number[], minute: number, tz: string): Date[] {
  const [y, mo, d] = day.split("-").map(Number);
  const out: Date[] = [];
  for (const dayShift of [-1, 0, 1]) {
    for (const h of hours) {
      const at = new Date(Date.UTC(y, mo - 1, d + dayShift, h, minute));
      if (dayIn(at, tz) === day) out.push(at);
    }
  }
  return out;
}

/** Sesje Claude (czas polski), które w strefie panelu wypadają w dniu `day`. */
function sessionSlotsOnDay(day: string, tz: string): Date[] {
  const out: Date[] = [];
  for (const dayShift of [-1, 0, 1]) {
    for (const h of SESSION_HOURS) {
      const at = warsawAt(shift(day, dayShift), h, 41);
      if (dayIn(at, tz) === day) out.push(at);
    }
  }
  return out;
}

function kindOf(stage: string): SlotKind {
  if (CLAUDE_STAGES.has(stage)) return "claude";
  if (OFFERS_STAGES.has(stage)) return "offers";
  return "pipeline";
}

export function buildDayPlan(day: string, runs: Run[], now = new Date(), tz = ADMIN_TZ): Slot[] {
  const slots: Slot[] = [
    ...sessionSlotsOnDay(day, tz).map((at) => ({
      kind: "claude" as const,
      at,
      title: "Sesja Claude",
      system: "Claude (chmura Anthropic, zaplanowane zadanie)",
      what: "pisze własne opisy firm, które czekają (do 150 naraz)",
    })),
    ...utcSlotsOnDay(day, PIPELINE_UTC_HOURS, 17, tz).map((at) => ({
      kind: "pipeline" as const,
      at,
      title: "Automat GitHub",
      system: "GitHub Actions + Serper + rejestry KRS i VAT",
      what: "zapisuje opisy i publikuje firmy, szuka biur w Google (Serper) w 15 kolejnych miastach, otwiera znalezione strony, sprawdza KRS i VAT, zbiera dane do opisów, pobiera kontakty nowych firm",
    })),
    ...utcSlotsOnDay(day, [OFFERS_UTC.h], OFFERS_UTC.m, tz).map((at) => ({
      kind: "offers" as const,
      at,
      title: "Automat GitHub: dane firm",
      system: "GitHub Actions + Google Places",
      what: "pobiera oferty z cenami, telefony, e-maile, social media, logo i zdjęcia, oceny z Map Google",
    })),
  ]
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .map((s) => ({ ...s, state: "planned" as SlotState, runs: [] as Run[] }));

  // Sesja Claude: raport trafia do ostatniej sesji z planu, która zaczęła się najpóźniej 10 minut po nim.
  for (const run of runs.filter((r) => kindOf(r.stage) === "claude")) {
    const candidates = slots.filter((s) => s.kind === "claude" && s.at.getTime() <= run.startedAt.getTime() + 10 * MIN);
    const slot = candidates[candidates.length - 1];
    if (slot) slot.runs.push(run);
  }

  // GitHub: kroki jednego przebiegu idą jeden po drugim, więc łączymy je w grupy (przerwa najwyżej 30 minut).
  // Grupa trafia do najbliższej wcześniejszej pozycji planu bez wykonania (GitHub potrafi ruszyć z opóźnieniem,
  // także gdy czeka na poprzedni przebieg). Grupa bez pasującej pozycji to przebieg uruchomiony ręcznie.
  const extra: Slot[] = [];
  {
    // Workflowy GitHub nie nakładają się (wspólna grupa concurrency), więc grupujemy wszystkie kroki razem.
    const list = runs.filter((r) => kindOf(r.stage) !== "claude").sort((x, y) => x.startedAt.getTime() - y.startedAt.getTime());
    const groups: Run[][] = [];
    for (const run of list) {
      const last = groups[groups.length - 1]?.at(-1);
      const lastEnd = last ? (last.finishedAt ?? last.startedAt).getTime() : 0;
      // import i offers to pierwsze kroki workflowów: zaczynają nowy przebieg, nawet gdy ruszył zaraz po poprzednim
      const firstStep = run.stage === "import" || run.stage === "offers";
      if (!last || firstStep || run.startedAt.getTime() - lastEnd > 30 * MIN) groups.push([run]);
      else groups[groups.length - 1].push(run);
    }
    for (const group of groups) {
      const kind: SlotKind = group.some((r) => OFFERS_STAGES.has(r.stage)) ? "offers" : "pipeline";
      const start = group[0].startedAt.getTime();
      const free = slots.filter(
        (s) => s.kind === kind && s.runs.length === 0 && s.at.getTime() <= start + 10 * MIN && start - s.at.getTime() < 150 * MIN,
      );
      const slot = free[free.length - 1];
      if (slot) {
        slot.runs.push(...group);
        continue;
      }
      const onlyImport = group.every((r) => r.stage === "import" || r.stage === "publish");
      const previous = slots.filter((s) => s.kind === kind && s.at.getTime() <= start).at(-1);
      if (onlyImport && previous) {
        // osobny workflow import.yml (zapis opisów i publikacja co 3 godziny): doliczamy do poprzedniego przebiegu
        previous.runs.push(...group);
        continue;
      }
      extra.push({
        kind,
        at: new Date(start),
        title: kind === "offers" ? "Automat GitHub: dane firm (uruchomiony ręcznie)" : "Automat GitHub (uruchomiony ręcznie)",
        system: kind === "offers" ? "GitHub Actions + Google Places" : "GitHub Actions + Serper + rejestry KRS i VAT",
        what: "przebieg spoza harmonogramu",
        state: "planned",
        runs: group,
      });
    }
  }
  slots.push(...extra);
  slots.sort((x, y) => x.at.getTime() - y.at.getTime());

  for (const s of slots) {
    const t = now.getTime() - s.at.getTime();
    if (s.runs.length > 0) {
      if (s.runs.some((r) => r.status === "running" && now.getTime() - r.startedAt.getTime() < 3 * 3600 * 1000)) s.state = "running";
      else if (s.runs.some((r) => r.status === "failed")) s.state = "failed";
      else s.state = "done";
      s.runs.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
      continue;
    }
    if (t < 0) s.state = "planned";
    else if (s.kind === "claude") s.state = t < 60 * MIN ? "plan_running" : t < 5 * 3600 * 1000 ? "waiting_report" : "missed";
    else s.state = t < 45 * MIN ? "queued" : "missed";
  }
  return slots;
}

export const STATE_LABEL: Record<SlotState, string> = {
  planned: "zaplanowane",
  queued: "czeka na start",
  running: "trwa teraz",
  plan_running: "trwa (według planu)",
  done: "zrobione",
  failed: "błąd",
  waiting_report: "raport dotrze z najbliższym przebiegiem GitHub",
  missed: "nie odbyło się",
};

function num(v: unknown): number {
  return typeof v === "number" ? v : 0;
}

function sum(runs: Run[], stage: string, key: string): number {
  return runs.filter((r) => r.stage === stage).reduce((acc, r) => acc + num(r.counts[key]), 0);
}

/** Wynik pozycji planu jednym zdaniem. */
export function slotSummary(slot: Slot): string {
  const r = slot.runs;
  if (r.length === 0) return "";
  if (slot.kind === "claude") {
    const c = r[0].counts;
    const parts = [`napisał ${num(c.described)} opisów`];
    if (num(c.skipped)) parts.push(`pominął ${num(c.skipped)} spoza branży`);
    if (c.city_list) parts.push(`szukał w: ${String(c.city_list)} (${num(c.new_domains)} stron)`);
    return parts.join(", ");
  }
  if (slot.kind === "offers") {
    const parts = [];
    const offersNew = sum(r, "offers", "offers_new");
    if (offersNew) parts.push(`${offersNew} nowych ofert`);
    const domains = sum(r, "offers", "domains");
    if (domains) parts.push(`sprawdzone strony ${domains} biur`);
    const contacts = sum(r, "contacts", "domains");
    if (contacts) parts.push(`kontakty i zdjęcia u ${contacts} biur`);
    const google = sum(r, "google_reviews", "ok");
    if (google) parts.push(`${google} ocen z Google`);
    return parts.join(", ") || "nic nowego";
  }
  const parts = [];
  const described = sum(r, "import", "done");
  if (described) parts.push(`zapisał ${described} opisów`);
  const published = sum(r, "publish", "published");
  if (published) parts.push(`dodał ${published} firm do katalogu`);
  const searchedCities = r.filter((x) => x.stage === "discover").length;
  const found = sum(r, "discover", "new_domains");
  if (searchedCities) parts.push(`szukał w ${searchedCities} miastach: ${found} nowych stron`);
  const official = sum(r, "probe", "official");
  if (official) parts.push(`${official} stron biur`);
  const verified = sum(r, "verify", "verified") + sum(r, "verify", "probable");
  if (verified) parts.push(`${verified} firm potwierdzonych w rejestrach`);
  const rejected =
    sum(r, "probe", "irrelevant") + sum(r, "probe", "marketplace") + sum(r, "probe", "media") + sum(r, "probe", "directory") + sum(r, "verify", "rejected");
  if (rejected) parts.push(`${rejected} odrzuconych`);
  return parts.join(", ") || "nic nowego do zrobienia";
}

export function runDuration(slot: Slot): string {
  if (slot.runs.length === 0) return "";
  const start = slot.runs[0].startedAt;
  const ends = slot.runs.map((r) => r.finishedAt).filter((x): x is Date => x !== null);
  if (slot.state === "running" || ends.length === 0) return `od ${hhmm(start)}`;
  const end = new Date(Math.max(...ends.map((e) => e.getTime())));
  return `${hhmm(start)}-${hhmm(end)}`;
}
