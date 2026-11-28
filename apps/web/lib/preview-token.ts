/**
 * Token podglądu profilu Premium (/podglad/<token>): "<identyfikator wpisu>.<HMAC-SHA256>", podpis kluczem
 * ADMIN_SESSION_SECRET. Token nie wygasa i jest stały dla wpisu, bo podgląd pokazuje tylko szkic, który firma
 * i tak ma zobaczyć. Podgląd ma noindex i no-store; unieważnienie to zmiana ADMIN_SESSION_SECRET.
 * Tylko Node (node:crypto); nie używać w middleware (runtime Edge).
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SIGNATURE = /^[0-9a-f]{64}$/;

function sign(listingId: string, secret: string): string {
  return createHmac("sha256", secret).update(`rbn-preview:${listingId}`).digest("hex");
}

export function previewToken(listingId: string, secret: string): string {
  if (!UUID.test(listingId)) throw new Error("Identyfikator wpisu musi być UUID.");
  if (!secret || secret.length < 32) throw new Error("ADMIN_SESSION_SECRET musi mieć co najmniej 32 znaki.");
  return `${listingId}.${sign(listingId, secret)}`;
}

/** Identyfikator wpisu z poprawnego tokenu albo null (zły format, zły podpis, brak sekretu). */
export function verifyPreviewToken(token: string | undefined | null, secret: string | undefined): string | null {
  if (!token || !secret || secret.length < 32) return null;
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const listingId = token.slice(0, dot).toLowerCase();
  const given = token.slice(dot + 1).toLowerCase();
  if (!UUID.test(listingId) || !SIGNATURE.test(given)) return null;
  const expected = Buffer.from(sign(listingId, secret), "hex");
  const actual = Buffer.from(given, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual) ? listingId : null;
}
