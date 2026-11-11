import type { RunRow } from "@/lib/admin-data";

const LABELS: Record<string, string> = {
  candidate: "znaleziona",
  needs_review: "w przygotowaniu",
  probable: "w przygotowaniu",
  verified: "potwierdzona",
  published: "opublikowana",
  rejected: "odrzucona",
  removed: "usunięta",
  validated: "zwalidowany",
  draft: "szkic",
  pending: "oczekuje",
  claimed: "w toku",
  done: "gotowe",
  failed: "błąd",
  ok: "ok",
  running: "w toku",
};

const TONE: Record<string, string> = {
  verified: "ok",
  published: "ok",
  validated: "ok",
  done: "ok",
  ok: "ok",
  needs_review: "warn",
  probable: "warn",
  pending: "warn",
  running: "warn",
  rejected: "bad",
  removed: "bad",
  failed: "bad",
};

/** Statusy wpisu firmy po ludzku (filtr na liście Firmy). */
export const FIRM_STATUS_LABELS: Record<string, string> = {
  published: "na stronie",
  verified: "potwierdzona, czeka na opis",
  needs_review: "bez potwierdzenia w rejestrze",
  candidate: "nowa, niesprawdzona",
  rejected: "odrzucona",
  removed: "usunięta",
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="badge">brak</span>;
  return <span className={`badge ${TONE[status] ?? ""}`}>{LABELS[status] ?? status}</span>;
}

type Params = Record<string, string | string[] | undefined>;

export function Flash({ params }: { params: Params }) {
  const ok = typeof params.ok === "string" ? params.ok : null;
  const error = typeof params.error === "string" ? params.error : null;
  return (
    <>
      {ok && <div className="alert ok">{ok}</div>}
      {error && <div className="alert bad">{error}</div>}
    </>
  );
}

export function Kpi({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="kpi">
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}

import { ADMIN_TZ } from "@/lib/tz";

export function when(value: Date | string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short", timeZone: ADMIN_TZ });
}

const STAGES: Record<string, { title: string; icon: string }> = {
  discover: { title: "Szukanie nowych biur w internecie", icon: "🔎" },
  search: { title: "Szukanie biur przez Serper (kolejne miasta)", icon: "🔎" },
  probe: { title: "Sprawdzanie znalezionych stron", icon: "🌐" },
  verify: { title: "Potwierdzanie firm w rejestrach (KRS, VAT)", icon: "✅" },
  crawl_deep: { title: "Zbieranie informacji ze stron firm", icon: "📄" },
  bundle: { title: "Przygotowanie danych do opisów", icon: "📦" },
  import: { title: "Zapisywanie nowych opisów", icon: "✍️" },
  publish: { title: "Dodawanie firm do katalogu", icon: "🚀" },
  offers: { title: "Pobieranie ofert ze stron biur", icon: "🏠" },
  contacts: { title: "Kontakty, logo i zdjęcia ze stron biur", icon: "📇" },
  google_reviews: { title: "Oceny z Map Google", icon: "⭐" },
  claude_session: { title: "Sesja Claude: opisy i szukanie biur", icon: "🤖" },
};

const COUNT_LABELS: Record<string, string> = {
  queries: "wyszukiwań",
  candidates: "wyników",
  new_domains: "nowych stron",
  blocked_results: "pominiętych portali",
  official: "to strony biur",
  media: "portale i media",
  marketplace: "serwisy ogłoszeniowe",
  uncertain: "niepewnych",
  fetch_error: "nie otworzyło się",
  robots_disallowed: "zablokowało roboty",
  verified: "potwierdzonych",
  needs_review: "bez potwierdzenia",
  rejected: "odrzuconych",
  published: "dodanych do katalogu",
  domains: "sprawdzonych stron",
  with_offers: "z ofertami",
  without_offers: "bez ofert",
  offers_new: "nowych ofert",
  offers_updated: "zaktualizowanych ofert",
  offers_deactivated: "zniknęło",
};
const HIDDEN_COUNTS = new Set(["mf_requests", "krs_requests", "cost", "tokens", "file", "city_list"]);

export function describeRun(run: RunRow): { title: string; icon: string; detail: string } {
  const stage = STAGES[run.stage] ?? { title: run.stage, icon: "⚙️" };
  const parts = Object.entries(run.counts)
    .filter(([key, value]) => value && !HIDDEN_COUNTS.has(key))
    .map(([key, value]) => `${value} ${COUNT_LABELS[key] ?? key.replace(/_/g, " ")}`);
  const detail = run.status === "failed" ? "nie udało się, spróbuje ponownie przy następnym przebiegu" : parts.join(" · ") || "nic nowego";
  return { ...stage, detail };
}

export function ActivityFeed({ runs }: { runs: RunRow[] }) {
  if (runs.length === 0) return <p className="note">Automat jeszcze nic nie zrobił.</p>;
  return (
    <ul className="feed">
      {runs.map((run) => {
        const d = describeRun(run);
        return (
          <li key={run.id} className={run.status === "failed" ? "bad" : ""}>
            <span className="feed-icon" aria-hidden="true">
              {d.icon}
            </span>
            <span className="feed-main">
              <b>{d.title}</b>
              <span>{d.detail}</span>
            </span>
            <span className="feed-when">{when(run.startedAt)}</span>
          </li>
        );
      })}
    </ul>
  );
}
