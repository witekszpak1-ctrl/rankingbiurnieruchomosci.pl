import Link from "next/link";

import { ActivityFeed, Flash } from "@/components/admin";
import { getDashboard, listFirms, type FirmRow } from "@/lib/admin-data";
import { countNewRequests } from "@/lib/requests";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const n = (counts: Record<string, number>, key: string) => counts[key] ?? 0;
const sum = (counts: Record<string, number>) => Object.values(counts).reduce((a, b) => a + b, 0);

type Column = { key: string; title: string; hint: string; firms: FirmRow[]; href: string };

function Board({ columns }: { columns: Column[] }) {
  return (
    <div className="board">
      {columns.map((col) => (
        <section key={col.key} className={`board-col ${col.key}`}>
          <header>
            <b>{col.title}</b>
            <span className="board-count">{col.firms.length}</span>
            <span className="board-auto">automatycznie</span>
          </header>
          <p className="board-hint">{col.hint}</p>
          {col.firms.length === 0 ? (
            <p className="board-empty">Pusto</p>
          ) : (
            <>
              {col.firms.slice(0, 6).map((f) => (
                <Link key={f.id} href={`/admin/firms/${f.id}`} className="board-card">
                  <b>{f.name}</b>
                  <span>
                    {f.city}
                    {f.host ? ` · ${f.host}` : ""}
                  </span>
                  <span className={`chip ${f.hasDescription ? "ok" : "warn"}`}>
                    {f.hasDescription ? "opis gotowy" : "opis w przygotowaniu"}
                  </span>
                </Link>
              ))}
              {col.firms.length > 6 && (
                <Link className="board-more" href={col.href}>
                  i {col.firms.length - 6} więcej
                </Link>
              )}
            </>
          )}
        </section>
      ))}
    </div>
  );
}

export default async function DashboardPage({ searchParams }: Props) {
  const params = await searchParams;
  const [d, newRequests, firms] = await Promise.all([getDashboard(), countNewRequests(), listFirms({})]);
  const published = firms.filter((f) => f.status === "published");
  const preparing = firms.filter((f) => ["candidate", "needs_review", "verified"].includes(f.status));
  const removed = firms.filter((f) => ["rejected", "removed"].includes(f.status));
  const offers = sum(d.offers);
  const withDescription = firms.filter((f) => f.hasDescription).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Przegląd</h1>
          <p className="page-sub">Katalog rośnie sam. Tu widzisz, ile firm już jest i co system robi.</p>
        </div>
        <div className="actions">
          <Link className="btn" href="/admin/offers">
            Oferty
          </Link>
          <Link className="btn primary" href="/" target="_blank">
            Zobacz stronę
          </Link>
        </div>
      </div>
      <Flash params={params} />

      <div className="stats">
        <div className="stat">
          <b>{published.length}</b>
          <span>firm w katalogu</span>
        </div>
        <div className="stat">
          <b>{preparing.length}</b>
          <span>w przygotowaniu</span>
        </div>
        <div className="stat">
          <b>{withDescription}</b>
          <span>firm z opisem</span>
        </div>
        <div className="stat">
          <b>{offers}</b>
          <span>aktualnych ofert</span>
        </div>
        <div className="stat">
          <b>{newRequests}</b>
          <span>nowych wiadomości od firm</span>
        </div>
      </div>

      <h2>Droga firmy do katalogu</h2>
      <Board
        columns={[
          {
            key: "prep",
            title: "W przygotowaniu",
            hint: "Znalezione biura. System sprawdza dane w rejestrach i pisze opis.",
            firms: preparing,
            href: "/admin/firms?status=verified",
          },
          {
            key: "live",
            title: "W katalogu",
            hint: "Widoczne na stronie, z opisem i ofertami.",
            firms: published,
            href: "/admin/firms?status=published",
          },
          {
            key: "out",
            title: "Odrzucone",
            hint: "Nie są biurami nieruchomości albo zostały usunięte.",
            firms: removed,
            href: "/admin/firms?status=rejected",
          },
        ]}
      />

      <h2>Co ostatnio zrobił automat</h2>
      <ActivityFeed runs={d.runs} />
      <p>
        <Link href="/admin/runs">Cała historia automatu</Link>
      </p>

      {newRequests > 0 && (
        <div className="alert warn">
          Masz {newRequests} nowych wiadomości od firm (poprawki lub prośby o usunięcie).{" "}
          <Link href="/admin/requests">Zobacz</Link>
        </div>
      )}
      <p className="note">Znalezione strony w bazie: {sum(d.domains)}.</p>
    </>
  );
}
