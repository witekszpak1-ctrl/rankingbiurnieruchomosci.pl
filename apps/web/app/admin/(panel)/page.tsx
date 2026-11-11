import Link from "next/link";

import { Flash, Kpi, RunsTable } from "@/components/admin";
import { getDashboard } from "@/lib/admin-data";
import { countNewRequests } from "@/lib/requests";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const n = (counts: Record<string, number>, key: string) => counts[key] ?? 0;
const sum = (counts: Record<string, number>) => Object.values(counts).reduce((a, b) => a + b, 0);

export default async function DashboardPage({ searchParams }: Props) {
  const params = await searchParams;
  const [d, newRequests] = await Promise.all([getDashboard(), countNewRequests()]);
  const toReview = n(d.listings, "needs_review") + n(d.domains, "probable");
  const toVerify = n(d.domains, "needs_review") + n(d.domains, "probable");
  const toPublish = n(d.listings, "verified");
  const waiting = n(d.queue, "describe:pending") + n(d.queue, "classify:pending");
  const rejected = n(d.queue, "describe:rejected") + n(d.queue, "classify:rejected");
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Przegląd</h1>
          <p className="page-sub">Stan katalogu i to, co czeka na Twoją decyzję.</p>
        </div>
        <div className="actions">
          <Link className="btn" href="/admin/requests">
            Zgłoszenia ({newRequests})
          </Link>
          <Link className="btn primary" href="/admin/review">
            Kolejka weryfikacji ({toReview})
          </Link>
        </div>
      </div>
      <Flash params={params} />

      <div className="stats">
        <div className="stat">
          <b>{n(d.listings, "published")}</b>
          <span>opublikowanych firm</span>
        </div>
        <div className="stat">
          <b>{sum(d.domains)}</b>
          <span>domen w bazie</span>
        </div>
        <div className="stat">
          <b>{n(d.domains, "verified")}</b>
          <span>zweryfikowanych</span>
        </div>
        <div className="stat">
          <b>{sum(d.descriptions)}</b>
          <span>opisów</span>
        </div>
        <div className="stat">
          <b>{newRequests}</b>
          <span>nowych zgłoszeń</span>
        </div>
      </div>

      <h2>Do zrobienia</h2>
      <div className="kpis">
        <Link className={`kpi${toVerify ? " hot" : ""}`} href="/admin/review">
          <b>{toVerify}</b>
          <span>domen do weryfikacji ręcznej</span>
        </Link>
        <Link className={`kpi${toPublish ? " hot" : ""}`} href="/admin/firms?status=verified">
          <b>{toPublish}</b>
          <span>wpisów zweryfikowanych, niepublikowanych</span>
        </Link>
        <Kpi value={waiting} label="paczek czeka na Claude Code" />
        <Kpi value={rejected} label="wyników odrzuconych przez walidator" />
        <Link className={`kpi${newRequests ? " hot" : ""}`} href="/admin/requests">
          <b>{newRequests}</b>
          <span>nowych zgłoszeń ze strony dla firm</span>
        </Link>
      </div>

      <h2>Lejek</h2>
      <div className="kpis">
        <Kpi value={sum(d.domains)} label="domen razem" />
        <Kpi value={n(d.domains, "verified")} label="zweryfikowanych" />
        <Kpi value={n(d.domains, "rejected")} label="odrzuconych" />
        <Kpi value={sum(d.listings)} label="wpisów (listings)" />
        <Kpi value={n(d.listings, "published")} label="opublikowanych" />
        <Kpi value={sum(d.descriptions)} label="opisów" />
      </div>

      <h2>Domeny według klasyfikacji</h2>
      <div className="kpis">
        {Object.entries(d.classification).map(([label, count]) => (
          <Kpi key={label} value={count} label={label} />
        ))}
      </div>

      <h2>Wydajność wyszukiwania</h2>
      {d.yields.length === 0 ? (
        <p className="note">Brak zapytań.</p>
      ) : (
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Dostawca</th>
                <th className="num">Zapytania</th>
                <th className="num">Wyniki</th>
                <th className="num">Nowe domeny</th>
                <th className="num">Koszt (USD)</th>
                <th className="num">Koszt / nowa domena</th>
              </tr>
            </thead>
            <tbody>
              {d.yields.map((y) => (
                <tr key={y.provider}>
                  <td>{y.provider}</td>
                  <td className="num">{y.queries}</td>
                  <td className="num">{y.results}</td>
                  <td className="num">{y.newDomains}</td>
                  <td className="num">{y.cost.toFixed(3)}</td>
                  <td className="num">{y.newDomains ? (y.cost / y.newDomains).toFixed(4) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>Ostatnie przebiegi</h2>
      <RunsTable runs={d.runs} />
      <p>
        <Link href="/admin/runs">Wszystkie przebiegi</Link>
      </p>
    </>
  );
}
