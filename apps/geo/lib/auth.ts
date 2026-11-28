import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { query } from "./db";
import { hashPassword, verifyPassword } from "./password";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, assertSecret, signSession, verifySession } from "./session";

export type User = { id: string; email: string; name: string | null; isAdmin: boolean };

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function secret(): string {
  return assertSecret(process.env.GEO_SESSION_SECRET);
}

export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const sub = await verifySession(token, secret());
  if (!sub) return null;
  const rows = await query<User>(
    `select id, email, name, is_admin as "isAdmin" from geo.users where id = $1 and disabled_at is null`,
    [sub],
  );
  return rows[0] ?? null;
}

export async function requireUser(next = "/panel"): Promise<User> {
  const user = await currentUser();
  if (!user) redirect(`/logowanie?next=${encodeURIComponent(next)}`);
  return user;
}

export async function requireAdmin(next = "/admin"): Promise<User> {
  const user = await requireUser(next);
  if (!user.isAdmin) redirect("/");
  return user;
}

export async function startSession(userId: string): Promise<void> {
  const token = await signSession(secret(), userId);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  await query(`update geo.users set last_login_at = now() where id = $1`, [userId]);
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Sprawdza e-mail i hasło. Ten sam komunikat dla złego e-maila i złego hasła. */
export async function checkLogin(email: string, password: string): Promise<string | null> {
  const rows = await query<{ id: string; hash: string }>(
    `select id, password_hash as hash from geo.users where email_norm = lower(trim($1)) and disabled_at is null`,
    [email],
  );
  // Gdy konta nie ma, i tak liczymy hash, żeby czas odpowiedzi nie zdradzał, które e-maile istnieją.
  const ok = verifyPassword(password, rows[0]?.hash ?? "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");
  return ok && rows[0] ? rows[0].id : null;
}

export function validatePassword(password: string): string | null {
  if (password.length < 10) return "Hasło musi mieć co najmniej 10 znaków.";
  if (password.length > 200) return "Hasło jest za długie.";
  return null;
}

export { hashPassword };
