import Link from "next/link";

import { Flash, StatusBadge } from "@/components/admin";
import { listAdminCities, listFirms } from "@/lib/admin-data";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const STATUSES = ["candidate", "needs_review", "verified", "published", "rejected", "removed"];
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function FirmsPage({ searchParams }: Props) {
  const params = await searchParams;
  const filters = { status: one(params.status), city: one(params.city), q: one(params.q) };
  const [firms, cities] = await Promise.all([listFirms(filters), listAdminCities()]);
  return (
    <>
      <h1>Firmy</h1>
      <Flash params={params} />
      <form method="get" className="form-row">
        <div>
          <label htmlFor="status">Status wpisu</label>
          <select id="status" name="status" defaultValue={filters.status}>
            <option value="">wszystkie</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="city">Miasto</label>
          <select id="city" name="city" defaultValue={filters.city}>
            <option value="">wszystkie</option>
            {cities.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="q">Nazwa zawiera</label>
          <input id="q" name="q" defaultValue={filters.q} />
        </div>
        <button type="submit">Filtruj</button>
      </form>
      <p className="note">{firms.length} wpisów (maks. 300).</p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Firma</th>
              <th>Miasto</th>
              <th>Wpis</th>
              <th>Domena</th>
              <th className="num">Wynik weryfikacji</th>
              <th>Opis</th>
              <th className="num">Ceny</th>
            </tr>
          </thead>
          <tbody>
            {firms.map((f) => (
              <tr key={f.id}>
                <td>
                  <Link href={`/admin/firms/${f.id}`}>{f.name}</Link>
                  <div className="note mono">{f.host ?? ""}</div>
                </td>
                <td>{f.city}</td>
                <td>
                  <StatusBadge status={f.status} />
                </td>
                <td>
                  <StatusBadge status={f.domainStatus} />
                </td>
                <td className="num">{f.score ?? "-"}</td>
                <td>{f.hasDescription ? <span className="badge ok">jest</span> : <span className="badge warn">brak</span>}</td>
                <td className="num">{f.prices}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
