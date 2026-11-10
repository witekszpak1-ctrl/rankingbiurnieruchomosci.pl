import type { RunRow } from "@/lib/admin-data";

const LABELS: Record<string, string> = {
  candidate: "kandydat",
  needs_review: "do weryfikacji",
  probable: "prawdopodobna",
  verified: "zweryfikowana",
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

export function when(value: Date | string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Warsaw" });
}

export function RunsTable({ runs }: { runs: RunRow[] }) {
  if (runs.length === 0) return <p className="note">Brak przebiegów.</p>;
  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            <th>Etap</th>
            <th>Status</th>
            <th>Start</th>
            <th>Wyniki</th>
            <th className="num">Koszt (USD)</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id}>
              <td>{run.stage}</td>
              <td>
                <StatusBadge status={run.status} />
              </td>
              <td>{when(run.startedAt)}</td>
              <td className="mono">{Object.entries(run.counts).map(([k, v]) => `${k}: ${v}`).join(", ") || "-"}</td>
              <td className="num">{run.cost.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
