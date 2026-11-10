import type { Metadata } from "next";

import { loginAction } from "./actions";

export const metadata: Metadata = { title: "Logowanie do panelu", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const configured =
    !!process.env.ADMIN_EMAIL && !!process.env.ADMIN_PASSWORD_HASH && (process.env.ADMIN_SESSION_SECRET ?? "").length >= 32;
  return (
    <main className="wrap" style={{ maxWidth: 420, paddingTop: 80 }}>
      <h1>Panel administratora</h1>
      {!configured && (
        <div className="alert warn">
          Panel nie jest skonfigurowany. Ustaw ADMIN_EMAIL, ADMIN_PASSWORD_HASH (npm run hash-password) i
          ADMIN_SESSION_SECRET (min. 32 znaki).
        </div>
      )}
      {params.error && <div className="alert bad">Nieprawidłowy e-mail lub hasło.</div>}
      <form action={loginAction}>
        <div className="form-row" style={{ display: "block" }}>
          <label htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" autoComplete="username" required style={{ width: "100%" }} />
        </div>
        <div className="form-row" style={{ display: "block" }}>
          <label htmlFor="password">Hasło</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required style={{ width: "100%" }} />
        </div>
        <button className="primary" type="submit">
          Zaloguj
        </button>
      </form>
    </main>
  );
}
