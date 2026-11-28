import Link from "next/link";

import { one, type SP } from "@/components/Notice";
import { affiliateByUser } from "@/lib/affiliate-repo";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";

import { logoutAction } from "../actions";

export const metadata = { title: "Moje konto" };
export const dynamic = "force-dynamic";

export default async function PanelPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const user = await requireUser("/panel");
  const [accounts, aff] = await Promise.all([
    query<{ id: string; name: string; domain: string | null; plan: string; status: string }>(
      `select a.id, a.name, a.primary_domain as domain, p.name as plan, s.status
       from geo.accounts a
       left join lateral (select plan_id, status from geo.subscriptions where account_id = a.id order by created_at desc limit 1) s on true
       left join geo.plans p on p.id = s.plan_id
       where a.owner_user_id = $1 order by a.created_at`,
      [user.id],
    ),
    affiliateByUser(user.id),
  ]);
  return (
    <>
      <h1>Moje konto</h1>
      {one(sp.nowe) ? <p className="ok">Konto założone. Audyt widoczności uruchomimy dla Twojej strony, gdy będzie gotowy.</p> : null}
      <p className="muted">{user.email}</p>
      <h2>Firmy</h2>
      {accounts.length === 0 ? (
        <p>Nie masz jeszcze konta firmy. <Link href="/rejestracja">Dodaj firmę</Link>.</p>
      ) : (
        <div className="tw"><table>
          <thead><tr><th>Firma</th><th>Strona</th><th>Pakiet</th></tr></thead>
          <tbody>{accounts.map((a) => (
            <tr key={a.id}><td>{a.name}</td><td>{a.domain ?? "-"}</td><td>{a.plan ?? "-"} {a.status === "active" ? null : <span className="pill">{a.status}</span>}</td></tr>
          ))}</tbody>
        </table></div>
      )}
      <h2>Program partnerski</h2>
      {aff ? <p><Link href="/partner/panel">Przejdź do panelu partnera</Link></p> : <p><Link href="/partner/dolacz">Dołącz i polecaj za 20% dożywotnio</Link></p>}
      <form action={logoutAction}><button type="submit" className="btn ghost">Wyloguj</button></form>
    </>
  );
}
