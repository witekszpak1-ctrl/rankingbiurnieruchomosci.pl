import type { Metadata } from "next";
import Link from "next/link";

import { logoutAction } from "../actions";
import { requireAdmin } from "@/lib/admin-auth";

export const metadata: Metadata = { title: "Panel administratora", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="admin-shell">
      <nav className="admin-nav" aria-label="Panel">
        <strong style={{ display: "block", margin: "0 10px 10px" }}>Panel</strong>
        <Link href="/admin">Przegląd</Link>
        <Link href="/admin/firms">Firmy</Link>
        <Link href="/admin/review">Kolejka weryfikacji</Link>
        <Link href="/admin/runs">Przebiegi</Link>
        <Link href="/admin/audit">Audyt</Link>
        <Link href="/">Strona publiczna</Link>
        <div className="who">{admin}</div>
        <form action={logoutAction} style={{ margin: "0 10px" }}>
          <button type="submit">Wyloguj</button>
        </form>
      </nav>
      <div className="admin-main">{children}</div>
    </div>
  );
}
