import { AppShell } from "@/components/shell/AppShell";
import { Card, PageHeader } from "@/components/ui/ui";
import { Notice, one, type SP } from "@/components/Notice";
import { listUsers } from "@/lib/admin-repo";
import { formatDate, formatDateTime } from "@/lib/admin-stats";
import { requireAdmin } from "@/lib/auth";

import { toggleAdminAction } from "../actions";

export const metadata = { title: "Użytkownicy i konta" };
export const dynamic = "force-dynamic";

export default async function AdminUsers({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const me = await requireAdmin("/admin/uzytkownicy");
  const { users, accounts } = await listUsers();
  const done = one(sp.ok);
  return (
    <AppShell user={me} current="/admin/uzytkownicy">
      <PageHeader eyebrow="Administracja" title="Użytkownicy i konta" />
      <Notice
        error={one(sp.error)}
        ok={done === "nadano" ? "Nadano uprawnienia administratora." : done === "odebrano" ? "Odebrano uprawnienia administratora." : null}
      />
      <Card flush className="mt-16" title={<>Użytkownicy ({users.length})</>}>
      <div className="tw"><table>
        <thead><tr><th>E-mail</th><th>Imię</th><th>Utworzony</th><th>Ostatnie logowanie</th><th>Konta</th><th>Partner</th><th>Administrator</th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.email} {u.disabled ? <span className="pill bad">wyłączony</span> : null}</td>
              <td>{u.name ?? "-"}</td>
              <td>{formatDate(u.createdAt)}</td>
              <td>{formatDateTime(u.lastLoginAt)}</td>
              <td>{u.accounts}</td>
              <td>{u.affiliateCode ?? "-"}</td>
              <td>
                {u.isAdmin ? <span className="pill">tak</span> : "nie"}{" "}
                {u.id === me.id ? (
                  <span className="muted small">(to Ty)</span>
                ) : (
                  <form action={toggleAdminAction} style={{ display: "inline" }}>
                    <input type="hidden" name="userId" value={u.id} />
                    <input type="hidden" name="makeAdmin" value={u.isAdmin ? "0" : "1"} />
                    <button type="submit" className="linkbtn">{u.isAdmin ? "odbierz" : "nadaj"}</button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>
      </Card>

      <Card flush className="mt-16" title={<>Konta firm ({accounts.length})</>}>
      <div className="tw"><table>
        <thead><tr><th>Firma</th><th>Domena</th><th>Właściciel</th><th>Pakiet</th><th>Status abonamentu</th><th>Utworzone</th></tr></thead>
        <tbody>
          {accounts.length ? accounts.map((a) => (
            <tr key={a.id}>
              <td>{a.name}</td>
              <td>{a.domain ?? "-"}</td>
              <td>{a.ownerEmail}</td>
              <td>{a.plan ?? "brak"}</td>
              <td>{a.subscriptionStatus ?? "-"}</td>
              <td>{formatDate(a.createdAt)}</td>
            </tr>
          )) : <tr><td colSpan={6} className="muted">Brak kont firm.</td></tr>}
        </tbody>
      </table></div>
      </Card>
    </AppShell>
  );
}
