import { cookies } from "next/headers";
import Link from "next/link";

import { Notice, one, type SP } from "@/components/Notice";
import { REF_COOKIE, decodeRefCookie } from "@/lib/affiliate";

import { registerCustomerAction } from "../actions";

export const metadata = { title: "Załóż konto firmy" };

export default async function RegisterPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const ref = decodeRefCookie((await cookies()).get(REF_COOKIE)?.value);
  return (
    <>
      <h1>Załóż konto firmy</h1>
      <p className="muted">Konto jest bezpłatne. Pakiety płatne włączysz później w panelu.</p>
      <Notice error={one(sp.error)} />
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
        <button type="submit">Załóż konto</button>
      </form>
      <p className="small muted">Masz konto? <Link href="/logowanie">Zaloguj się</Link>.</p>
    </>
  );
}
