import { AdminNav } from "@/components/AdminNav";
import { listWaitlist } from "@/lib/admin-repo";
import { formatDateTime } from "@/lib/admin-stats";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Lista oczekujących" };
export const dynamic = "force-dynamic";

export default async function AdminWaitlist() {
  await requireAdmin("/admin/lista");
  const { rows, total } = await listWaitlist();
  return (
    <>
      <h1>Lista oczekujących</h1>
      <AdminNav current="/admin/lista" />
      <p>
        Zapisanych: <b>{total}</b>{" "}
        <a className="btn ghost" href="/admin/lista/export" download>Pobierz CSV</a>
      </p>
      <div className="tw"><table>
        <thead><tr><th>E-mail</th><th>Domena</th><th>Kod partnera</th><th>Data zapisu</th></tr></thead>
        <tbody>
          {rows.length ? rows.map((r) => (
            <tr key={r.email}>
              <td>{r.email}</td>
              <td>{r.domain ?? "-"}</td>
              <td>{r.affiliateCode ?? "-"}</td>
              <td>{formatDateTime(r.createdAt)}</td>
            </tr>
          )) : <tr><td colSpan={4} className="muted">Nikt jeszcze się nie zapisał.</td></tr>}
        </tbody>
      </table></div>
      {total > rows.length ? <p className="muted small">Pokazano {rows.length} najnowszych, pełna lista w pliku CSV.</p> : null}
    </>
  );
}
