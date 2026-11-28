import Link from "next/link";

import { AppShell } from "@/components/shell/AppShell";
import { Card, PageHeader } from "@/components/ui/ui";
import type { SP } from "@/components/Notice";
import { listCities, listMeasurements } from "@/lib/admin-repo";
import {
  PAGE_SIZE,
  PLATFORMS,
  PLATFORM_LABEL,
  STATUSES,
  STATUS_LABEL,
  buildQuery,
  formatDateTime,
  parseMeasurementFilters,
} from "@/lib/admin-stats";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Pomiary" };
export const dynamic = "force-dynamic";

export default async function AdminMeasurements({ searchParams }: { searchParams: SP }) {
  const me = await requireAdmin("/admin/pomiary");
  const f = parseMeasurementFilters(await searchParams);
  const [{ rows, total }, cities] = await Promise.all([listMeasurements(f), listCities()]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const link = (page: number) =>
    buildQuery("/admin/pomiary", { miasto: f.city, platforma: f.platform, status: f.status, od: f.from, do: f.to, strona: page > 1 ? page : undefined });
  return (
    <AppShell user={me} current="/admin/pomiary">
      <PageHeader eyebrow="Administracja" title="Pomiary" />
      <form method="get" action="/admin/pomiary" className="filters">
        <label>Miasto
          <select name="miasto" defaultValue={f.city}>
            <option value="">wszystkie</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label>Platforma
          <select name="platforma" defaultValue={f.platform}>
            <option value="">wszystkie</option>
            {PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_LABEL[p]}</option>)}
          </select>
        </label>
        <label>Status
          <select name="status" defaultValue={f.status}>
            <option value="">wszystkie</option>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </label>
        <label>Od<input type="date" name="od" defaultValue={f.from} /></label>
        <label>Do<input type="date" name="do" defaultValue={f.to} /></label>
        <button type="submit">Filtruj</button>
        <Link href="/admin/pomiary" className="btn ghost">Wyczyść</Link>
      </form>
      <p className="muted small">Pomiary: {total}. Strona {Math.min(f.page, pages)} z {pages}.</p>
      <Card flush className="mt-16"><div className="tw"><table>
        <thead><tr><th>Data</th><th>Miasto</th><th>Platforma</th><th>Status</th><th>Pytanie</th><th>Wzmianki</th><th>Źródła</th><th></th></tr></thead>
        <tbody>
          {rows.length ? rows.map((r) => (
            <tr key={r.id}>
              <td>{formatDateTime(r.at)}</td>
              <td>{r.city ?? "-"}</td>
              <td>{PLATFORM_LABEL[r.platform] ?? r.platform}</td>
              <td><span className={`pill${r.status === "failed" ? " bad" : r.status === "done" ? "" : " warn"}`}>{STATUS_LABEL[r.status] ?? r.status}</span></td>
              <td>{r.prompt}</td>
              <td>{r.mentions}</td>
              <td>{r.citations}</td>
              <td><Link href={`/admin/pomiary/${r.id}`}>Szczegóły</Link></td>
            </tr>
          )) : <tr><td colSpan={8} className="muted">Brak pomiarów dla tych filtrów.</td></tr>}
        </tbody>
      </table></div></Card>
      <div className="pager">
        {f.page > 1 ? <Link href={link(f.page - 1)}>Poprzednia</Link> : null}
        {f.page < pages ? <Link href={link(f.page + 1)}>Następna</Link> : null}
      </div>
    </AppShell>
  );
}
