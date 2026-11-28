import Link from "next/link";

import { AdminNav } from "@/components/AdminNav";
import { one, type SP } from "@/components/Notice";
import { listCities, loadFirms, type FirmFilter } from "@/lib/admin-repo";
import { MIN_SAMPLE, formatShare } from "@/lib/admin-stats";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Firmy wymieniane przez AI" };
export const dynamic = "force-dynamic";

export default async function AdminFirms({ searchParams }: { searchParams: SP }) {
  await requireAdmin("/admin/firmy");
  const sp = await searchParams;
  const city = (one(sp.miasto) ?? "").trim().slice(0, 80);
  const typ = one(sp.typ);
  const kind: FirmFilter["kind"] = typ === "matched" || typ === "unmatched" ? typ : "all";
  const [{ firms, cityTotals }, cities] = await Promise.all([loadFirms({ city, kind }), listCities()]);
  return (
    <>
      <h1>Firmy wymieniane przez AI</h1>
      <AdminNav current="/admin/firmy" />
      <p className="muted">
        Firmy bez dopasowania do katalogu to kandydaci: ktoś, kogo AI poleca, a kogo nie mamy w katalogu. Udział to część gotowych
        odpowiedzi w mieście, w których firma się pojawia (poniżej {MIN_SAMPLE} odpowiedzi nie liczymy procentu).
      </p>
      <form method="get" action="/admin/firmy" className="filters">
        <label>Miasto
          <select name="miasto" defaultValue={city}>
            <option value="">wszystkie</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label>Firmy
          <select name="typ" defaultValue={kind}>
            <option value="all">wszystkie</option>
            <option value="matched">z katalogu</option>
            <option value="unmatched">kandydaci (bez dopasowania)</option>
          </select>
        </label>
        <button type="submit">Pokaż</button>
        <Link href="/admin/firmy" className="btn ghost">Wyczyść</Link>
      </form>
      <p className="muted small">Pozycje: {firms.length} (najwyżej 200).</p>
      <div className="tw"><table>
        <thead><tr><th>Firma</th><th>Status</th><th>Domena</th><th>Odpowiedzi</th><th>Polecona</th><th>Miasta</th><th>{city ? "Udział w mieście" : "Najczęstsze miasto i udział"}</th></tr></thead>
        <tbody>
          {firms.length ? firms.map((f) => (
            <tr key={f.key}>
              <td>{f.label}</td>
              <td>{f.matched ? <span className="pill">katalog</span> : <span className="pill warn">kandydat</span>}</td>
              <td>{f.domain ?? "-"}</td>
              <td>{f.answers}</td>
              <td>{f.recommended}</td>
              <td>{f.cities}</td>
              <td>{f.topCity}: {formatShare(f.topCityAnswers, cityTotals.get(f.topCity) ?? 0)}</td>
            </tr>
          )) : <tr><td colSpan={7} className="muted">Brak wzmianek.</td></tr>}
        </tbody>
      </table></div>
    </>
  );
}
