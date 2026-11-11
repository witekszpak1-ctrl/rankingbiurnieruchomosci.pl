/**
 * Plan pracy automatu na dany dzień (czas polski) i dopasowanie faktycznych przebiegów z pipeline_runs do pozycji planu.
 * Harmonogramy muszą odpowiadać plikom .github/workflows/*.yml i zaplanowanemu zadaniu Claude.
 */

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
const OFFERS_STAGES = new Set(["offers", "contacts", "google_reviews"]);

const MIN = 60 * 1000;

function offsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Warsaw",
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

export function warsawDay(at: Date): string {
  return at.toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });
}

export function hhmm(at: Date): string {
  return at.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw" });
}

function utcSlotsOnWarsawDay(day: string, hours: number[], minute: number): Date[] {
  const [y, mo, d] = day.split("-").map(Number);
  const out: Date[] = [];
  for (const dayShift of [-1, 0]) {
    for (const h of hours) {
      const at = new Date(Date.UTC(y, mo - 1, d + dayShift, h, minute));
      if (warsawDay(at) === day) out.push(at);
    }
  }
  return out;
}

function kindOf(stage: string): SlotKind {
  if (CLAUDE_STAGES.has(stage)) return "claude";
  if (OFFERS_STAGES.has(stage)) return "offers";
  return "pipeline";
}

export function buildDayPlan(day: string, runs: Run[], now = new Date()): Slot[] {
  const slots: Slot[] = [
    ...SESSION_HOURS.map((h) => ({
      kind: "claude" as const,
      at: warsawAt(day, h, 41),
      title: "Sesja Claude",
      what: "pisze opisy czekających firm, potem szuka stron biur w 3 kolejnych miastach",
    })),
    ...utcSlotsOnWarsawDay(day, PIPELINE_UTC_HOURS, 17).map((at) => ({
      kind: "pipeline" as const,
      at,
      title: "Automat GitHub",
      what: "zapisuje opisy i publikuje firmy, otwiera nowo znalezione strony, sprawdza KRS i VAT, zbiera dane do opisów",
    })),
    ...utcSlotsOnWarsawDay(day, [OFFERS_UTC.h], OFFERS_UTC.m).map((at) => ({
      kind: "offers" as const,
      at,
      title: "Automat GitHub: dane firm",
      what: "pobiera oferty z cenami, telefony, e-maile, social media, logo i zdjęcia, oceny z Map Google",
    })),
  ]
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .map((s) => ({ ...s, state: "planned" as SlotState, runs: [] as Run[] }));

  // Każdy przebieg trafia do ostatniej pozycji planu tego samego rodzaju, która zaczęła się najpóźniej
  // 10 minut po nim (GitHub często startuje z opóźnieniem, sesja Claude czasem chwilę wcześniej).
  for (const run of runs) {
    const kind = kindOf(run.stage);
    const candidates = slots.filter((s) => s.kind === kind && s.at.getTime() <= run.startedAt.getTime() + 10 * MIN);
    const slot = candidates[candidates.length - 1];
    if (slot) slot.runs.push(run);
  }

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
    const parts = [`opisał ${num(c.described)} firm`];
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
  const found = sum(r, "discover", "new_domains");
  if (found) parts.push(`${found} nowych stron z wyszukiwania`);
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
