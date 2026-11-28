import Link from "next/link";

import { AdminNav } from "@/components/AdminNav";
import { one, type SP } from "@/components/Notice";
import { listCities, loadSources } from "@/lib/admin-repo";
import { formatShare } from "@/lib/admin-stats";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Źródła cytowane przez AI" };
export const dynamic = "force-dynamic";

export default async function AdminSources({ searchParams }: { searchParams: SP }) {
  await requireAdmin("/admin/zrodla");
  const city = (one((await searchParams).miasto) ?? "").trim().slice(0, 80);
  const [s, cities] = await Promise.all([loadSources(city), listCities()]);
  return (
    <>
      <h1>Źródła cytowane przez AI</h1>
      <AdminNav current="/admin/zrodla" />
      <form method="get" action="/admin/zrodla" className="filters">
        <label>Miasto
          <select name="miasto" defaultValue={city}>
            <option value="">wszystkie</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <button type="submit">Pokaż</button>
        {city ? <Link href="/admin/zrodla" className="btn ghost">Wyczyść</Link> : null}
      </form>
      <p className="muted small">
        {city ? `${city}: ` : "Wszystkie miasta: "}
        gotowych odpowiedzi {s.totalAnswers}, w tym ze źródłami {s.answersWithCitations}.
        Odpowiedzi cytujące nasz portal: {formatShare(s.answersCitingOwn, s.answersWithCitations)}.
      </p>

      <h2 className="sec">Najczęściej cytowane domeny</h2>
      <div className="tw"><table>
        <thead><tr><th>Domena</th><th>Odpowiedzi</th><th>Udział w odpowiedziach ze źródłami</th><th>Cytowania</th><th>Miasta</th></tr></thead>
        <tbody>
          {s.top.length ? s.top.map((r) => (
            <tr key={r.domain} className={r.own ? "own" : undefined}>
              <td>{r.domain} {r.own ? <span className="pill own">nasz portal</span> : null}</td>
              <td>{r.answers}</td>
              <td>{formatShare(r.answers, s.answersWithCitations)}</td>
              <td>{r.citations}</td>
              <td>{r.cities}</td>
            </tr>
          )) : <tr><td colSpan={5} className="muted">Brak cytowań.</td></tr>}
        </tbody>
      </table></div>

      <h2 className="sec">Źródła w podziale na miasta</h2>
      <div className="tw"><table>
        <thead><tr><th>Miasto</th><th>Odpowiedzi</th><th>Ze źródłami</th><th>Cytują nasz portal</th><th>Najczęstsza domena</th></tr></thead>
        <tbody>
          {s.perCity.length ? s.perCity.map((r) => (
            <tr key={r.city}>
              <td><Link href={`/admin/zrodla?miasto=${encodeURIComponent(r.city)}`}>{r.city}</Link></td>
              <td>{r.answers}</td>
              <td>{r.withCitations}</td>
              <td>{formatShare(r.citingOwn, r.withCitations)}</td>
              <td>{r.topDomain ? `${r.topDomain} (${r.topDomainAnswers})` : "-"}</td>
            </tr>
          )) : <tr><td colSpan={5} className="muted">Brak pomiarów.</td></tr>}
        </tbody>
      </table></div>
    </>
  );
}
