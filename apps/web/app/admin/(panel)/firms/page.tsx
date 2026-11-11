import Link from "next/link";

import { FIRM_STATUS_LABELS, Flash, StatusBadge, when } from "@/components/admin";
import { countFirms, FIRMS_PAGE, listAdminCities, listFirms } from "@/lib/admin-data";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const STATUSES = Object.keys(FIRM_STATUS_LABELS);
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function FirmsPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(0, Number.parseInt(one(params.strona), 10) || 0);
  const filters = { status: one(params.status), city: one(params.city), q: one(params.q), page };
  const [firms, cities, total] = await Promise.all([listFirms(filters), listAdminCities(), countFirms(filters)]);
  const pages = Math.max(1, Math.ceil(total / FIRMS_PAGE));
  const link = (p: number) =>
    `/admin/firms?${new URLSearchParams({ ...(filters.status && { status: filters.status }), ...(filters.city && { city: filters.city }), ...(filters.q && { q: filters.q }), strona: String(p) })}`;
  return (
    <>
      <h1>Firmy</h1>
      <Flash params={params} />
      <form method="get" className="form-row">
        <div>
          <label htmlFor="status">Status firmy</label>
          <select id="status" name="status" defaultValue={filters.status}>
            <option value="">wszystkie</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {FIRM_STATUS_LABELS[s]}
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
      <p className="note">
        {total} firm, strona {page + 1} z {pages} (po {FIRMS_PAGE}). Wszystkie znalezione strony, także jeszcze niesprawdzone,
        są w zakładce <Link href="/admin/sites">Znalezione strony</Link>.
      </p>
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
              <th>Dodana</th>
              <th>Ostatnia aktualizacja</th>
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
                <td className="nowrap">{when(f.createdAt)}</td>
                <td className="nowrap">{when(f.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <p className="pager">
          {page > 0 && (
            <Link className="btn" href={link(page - 1)}>
              Poprzednia strona
            </Link>
          )}
          {page + 1 < pages && (
            <Link className="btn" href={link(page + 1)}>
              Następna strona
            </Link>
          )}
        </p>
      )}
    </>
  );
}
