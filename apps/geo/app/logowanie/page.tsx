import Link from "next/link";

import { Notice, one, type SP } from "@/components/Notice";

import { loginAction } from "../actions";

export const metadata = { title: "Logowanie" };

export default async function LoginPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  return (
    <>
      <h1>Logowanie</h1>
      <Notice error={one(sp.error)} />
      <form action={loginAction} className="stack">
        <input type="hidden" name="next" value={one(sp.next) ?? "/panel"} />
        <label>E-mail<input id="email" name="email" type="email" required autoComplete="email" /></label>
        <label>Hasło<input id="password" name="password" type="password" required autoComplete="current-password" /></label>
        <button type="submit">Zaloguj</button>
      </form>
      <p className="small muted">
        Nie masz konta? <Link href="/rejestracja">Załóż konto firmy</Link> albo <Link href="/partner/dolacz">dołącz do programu partnerskiego</Link>.
      </p>
    </>
  );
}
