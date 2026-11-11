import type { Metadata } from "next";
import Link from "next/link";

import "../admin.css";
import { logoutAction } from "../actions";
import { AdminNavLink } from "@/components/AdminNav";
import { requireAdmin } from "@/lib/admin-auth";
import { countNewClaims } from "@/lib/claims";
import { countNewLeads } from "@/lib/leads";
import { countNewRequests } from "@/lib/requests";

export const metadata: Metadata = { title: "Panel administratora", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const [newRequests, newLeads, newClaims] = await Promise.all([
    countNewRequests().catch(() => 0),
    countNewLeads(),
    countNewClaims(),
  ]);
  return (
    <div className="adm">
      <div className="admin-shell">
        <nav className="admin-nav" aria-label="Panel">
          <Link href="/admin" className="side-brand">
            <span className="side-logo">RB</span>
            <span>Ranking biur</span>
          </Link>
          <div className="side-group">Katalog</div>
          <AdminNavLink href="/admin" label="Przegląd" icon="home" />
          <AdminNavLink href="/admin/firms" label="Firmy" icon="firms" />
          <AdminNavLink href="/admin/offers" label="Oferty" icon="offers" />
          <AdminNavLink href="/admin/cities" label="Miasta" icon="cities" />
          <AdminNavLink href="/admin/leads" label="Zapytania klientów" icon="leads" count={newLeads} />
          <AdminNavLink href="/admin/claims" label="Zgłoszenia właścicieli" icon="claims" count={newClaims} />
          <AdminNavLink href="/admin/requests" label="Wiadomości od firm" icon="inbox" count={newRequests} />
          <div className="side-group">System</div>
          <AdminNavLink href="/admin/runs" label="Automat" icon="runs" />
          <AdminNavLink href="/admin/audit" label="Historia zmian" icon="audit" />
          <AdminNavLink href="/" label="Strona publiczna" icon="site" />
          <div className="side-foot">
            <div className="who">
              <span className="avatar">{admin.slice(0, 1).toUpperCase()}</span>
              <span>{admin}</span>
            </div>
            <form action={logoutAction}>
              <button type="submit">Wyloguj</button>
            </form>
          </div>
        </nav>
        <div className="admin-main">{children}</div>
      </div>
    </div>
  );
}
