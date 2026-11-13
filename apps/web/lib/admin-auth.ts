import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { verifyPassword } from "./password";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, assertSecret, signSession, verifySession } from "./session";

/** Zalogowany admin (e-mail) albo null. */
export async function currentAdmin(): Promise<string | null> {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value, secret);
}

/** Wywołaj na początku każdej strony panelu i każdej akcji serwerowej. */
export async function requireAdmin(): Promise<string> {
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

/** Sprawdza dane logowania z konfiguracji środowiska. Zwraca true i ustawia ciasteczko sesji. */
export async function login(email: string, password: string): Promise<boolean> {
  const expectedEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const secret = assertSecret(process.env.ADMIN_SESSION_SECRET);
  const emailOk = !!expectedEmail && email.trim().toLowerCase() === expectedEmail;
  // verifyPassword wykonujemy zawsze, żeby czas odpowiedzi nie zdradzał, czy e-mail jest poprawny
  const passwordOk = verifyPassword(password, process.env.ADMIN_PASSWORD_HASH);
  if (!emailOk || !passwordOk) {
    // Diagnostyka nieudanego logowania: same wartości logiczne, bez loginu i hasła.
    const hash = process.env.ADMIN_PASSWORD_HASH ?? "";
    console.warn(
      `[admin-login] nieudane: emailOk=${emailOk} passwordOk=${passwordOk} hashParts=${hash.split("$").length} hashLen=${hash.length} emailSet=${!!expectedEmail}`,
    );
    return false;
  }
  const token = await signSession(secret, expectedEmail);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return true;
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
