/**
 * Podpisana sesja admina (HMAC-SHA256, WebCrypto). Moduł działa w runtime Edge (middleware) i Node.
 * Token: base64url(payload).base64url(podpis). Payload: {sub, exp}.
 */

export const SESSION_COOKIE = "katalog_session";
export const SESSION_TTL_SECONDS = 12 * 3600;

type Payload = { sub: string; exp: number };

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export function assertSecret(secret: string | undefined): string {
  if (!secret || secret.length < 32) {
    throw new Error("ADMIN_SESSION_SECRET musi mieć co najmniej 32 znaki.");
  }
  return secret;
}

export async function signSession(
  secret: string,
  subject: string,
  now: number = Date.now(),
  ttlSeconds: number = SESSION_TTL_SECONDS,
): Promise<string> {
  const payload: Payload = { sub: subject, exp: Math.floor(now / 1000) + ttlSeconds };
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), new TextEncoder().encode(body));
  return `${body}.${toBase64Url(new Uint8Array(signature))}`;
}

/** Zwraca podmiot sesji albo null, gdy token jest nieprawidłowy, zmieniony lub wygasły. */
export async function verifySession(
  token: string | undefined | null,
  secret: string,
  now: number = Date.now(),
): Promise<string | null> {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      fromBase64Url(signature),
      new TextEncoder().encode(body),
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as Payload;
    if (typeof payload.exp !== "number" || payload.exp * 1000 <= now) return null;
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
