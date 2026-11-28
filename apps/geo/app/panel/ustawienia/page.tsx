import Link from "next/link";

import { logoutAction } from "@/app/actions";
import { AppShell } from "@/components/shell/AppShell";
import { Icon } from "@/components/ui/Icon";
import { Card, DataTable, EmptyState, PageHeader, Pill } from "@/components/ui/ui";
import { requireUser } from "@/lib/auth";
import { loadPanelContext } from "@/lib/panel-repo";
import type { PanelAccount } from "@/lib/panel";

export const metadata = { title: "Ustawienia" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser("/panel/ustawienia");
  const ctx = await loadPanelContext(user.id);
  return (
    <AppShell user={user} current="/panel/ustawienia">
      <PageHeader eyebrow="Konto" title="Ustawienia" sub="Dane konta i firm. Edycja danych firmy pojawi się wraz z pakietami płatnymi." />
      <div className="g2">
        <Card title="Użytkownik">
          <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 16px", fontSize: 14 }}>
            <dt className="muted">E-mail</dt>
            <dd style={{ margin: 0, overflowWrap: "anywhere" }}>{user.email}</dd>
            <dt className="muted">Imię</dt>
            <dd style={{ margin: 0 }}>{user.name ?? "-"}</dd>
            <dt className="muted">Rola</dt>
            <dd style={{ margin: 0 }}>{user.isAdmin ? <Pill>Administrator</Pill> : "Użytkownik"}</dd>
            <dt className="muted">Partner</dt>
            <dd style={{ margin: 0 }}>{ctx.affiliateCode ? <>kod <b>{ctx.affiliateCode}</b>, <Link href="/partner/panel">panel partnera</Link></> : <Link href="/partner/dolacz">dołącz do programu</Link>}</dd>
          </dl>
          <form action={logoutAction} style={{ marginTop: 18 }}>
            <button type="submit" className="btn ghost sm"><Icon name="logout" size={14} /> Wyloguj</button>
          </form>
        </Card>
        <Card flush title="Firmy i pakiety">
          {ctx.facts.accounts.length ? (
            <DataTable<PanelAccount>
              columns={[
                { header: "Firma", cell: (a) => a.name },
                { header: "Strona", cell: (a) => a.domain ?? "-" },
                { header: "Pakiet", cell: (a) => a.planName ?? "Free" },
              ]}
              rows={ctx.facts.accounts}
              rowKey={(a) => a.id}
            />
          ) : (
            <div style={{ padding: "0 20px 20px" }}>
              <EmptyState icon="building" title="Brak firm" action={<Link href="/rejestracja" className="btn sm soft">Dodaj firmę</Link>}>
                Nie masz jeszcze konta firmy.
              </EmptyState>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
