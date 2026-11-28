import Link from "next/link";

import { loginAction } from "@/app/actions";
import { Notice, one, type SP } from "@/components/Notice";

export const metadata = { title: "Logowanie" };

export default async function LoginPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  return (
    <div className="auth">
      <div className="card">
        <h1>Logowanie</h1>
        <p className="muted small">Wejdź do pulpitu swojej firmy.</p>
        <div style={{ marginTop: 14 }}>
          <Notice error={one(sp.error)} />
        </div>
        <form action={loginAction} className="stack">
          <input type="hidden" name="next" value={one(sp.next) ?? "/panel"} />
          <label>E-mail<input id="email" name="email" type="email" required autoComplete="email" /></label>
          <label>Hasło<input id="password" name="password" type="password" required autoComplete="current-password" /></label>
          <button type="submit" className="btn lg block">Zaloguj</button>
        </form>
        <p className="small muted" style={{ marginTop: 16 }}>
          Nie masz konta? <Link href="/rejestracja">Załóż konto firmy</Link> albo <Link href="/partner/dolacz">dołącz do programu partnerskiego</Link>.
        </p>
      </div>
    </div>
  );
}
