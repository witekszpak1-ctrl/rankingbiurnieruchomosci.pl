import { cookies } from "next/headers";
import Link from "next/link";

import { registerCustomerAction } from "@/app/actions";
import { Notice, one, type SP } from "@/components/Notice";
import { REF_COOKIE, decodeRefCookie } from "@/lib/affiliate";

export const metadata = { title: "Załóż konto firmy" };

export default async function RegisterPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const ref = decodeRefCookie((await cookies()).get(REF_COOKIE)?.value);
  return (
    <div className="auth">
      <div className="card">
        <h1>Załóż konto firmy</h1>
        <p className="muted small">Konto jest bezpłatne. Pakiety płatne włączysz później w panelu.</p>
        <div style={{ marginTop: 14 }}>
          <Notice error={one(sp.error)} />
        </div>
        <form action={registerCustomerAction} className="stack">
          <label>Nazwa firmy<input id="company" name="company" type="text" required autoComplete="organization" /></label>
          <label>Adres strony<input id="domain" name="domain" type="text" placeholder="mojafirma.pl" /></label>
          <label>E-mail<input id="email" name="email" type="email" required autoComplete="email" /></label>
          <label>Hasło (min. 10 znaków)<input id="password" name="password" type="password" required minLength={10} autoComplete="new-password" /></label>
          <label>
            Kod polecający (jeśli masz)
            <input id="ref" name="ref" type="text" defaultValue={ref?.code ?? ""} pattern="[a-zA-Z0-9]{4,24}" />
          </label>
          <label className="check">
            <input id="terms" name="terms" type="checkbox" />
            <span className="small">Akceptuję regulamin i politykę prywatności (dokumenty w przygotowaniu przed startem sprzedaży).</span>
          </label>
          <button type="submit" className="btn lg block">Załóż konto</button>
        </form>
        <p className="small muted" style={{ marginTop: 16 }}>Masz konto? <Link href="/logowanie">Zaloguj się</Link>.</p>
      </div>
    </div>
  );
}
