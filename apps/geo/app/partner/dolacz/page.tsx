import Link from "next/link";
import { redirect } from "next/navigation";

import { Notice, one, type SP } from "@/components/Notice";
import { affiliateByUser } from "@/lib/affiliate-repo";
import { currentUser } from "@/lib/auth";

import { joinAffiliateAction } from "../../actions";

export const metadata = { title: "Dołącz do programu partnerskiego" };
export const dynamic = "force-dynamic";

export default async function JoinPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const user = await currentUser();
  if (user && (await affiliateByUser(user.id))) redirect("/partner/panel");
  return (
    <>
      <h1>Dołącz do programu partnerskiego</h1>
      <Notice error={one(sp.error)} />
      <form action={joinAffiliateAction} className="stack">
        {user ? (
          <p className="muted">Dołączasz jako {user.email}.</p>
        ) : (
          <>
            <label>Imię i nazwisko lub nazwa firmy<input id="name" name="name" type="text" autoComplete="name" /></label>
            <label>E-mail<input id="email" name="email" type="email" required autoComplete="email" /></label>
            <label>Hasło (min. 10 znaków)<input id="password" name="password" type="password" required minLength={10} autoComplete="new-password" /></label>
          </>
        )}
        <label>
          Twój kod do linku (4-24 małe litery lub cyfry)
          <input id="code" name="code" type="text" required pattern="[a-zA-Z0-9]{4,24}" placeholder="np. jankowalski" />
        </label>
        <label className="check">
          <input id="terms" name="terms" type="checkbox" />
          <span className="small">Akceptuję <Link href="/partner">zasady programu</Link>, w tym zakaz spamu i wysyłania e-maili bez zgody odbiorców.</span>
        </label>
        <button type="submit">Dołącz</button>
      </form>
      {user ? null : <p className="small muted">Masz już konto? <Link href="/logowanie?next=/partner/dolacz">Zaloguj się</Link>.</p>}
    </>
  );
}
