import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Weryfikacja podpisu webhooka Stripe (nagłówek Stripe-Signature: t=<czas>,v1=<podpis>[,v1=...]).
 * Podpis to HMAC-SHA256 z "<t>.<surowe body>" kluczem whsec_... Bez SDK, żeby nie dokładać zależności.
 */
export function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
  toleranceSeconds = 300,
): boolean {
  if (!header || !secret) return false;
  let t: number | null = null;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [k, v] = part.split("=", 2).map((s) => s?.trim());
    if (k === "t" && v) t = Number(v);
    if (k === "v1" && v) signatures.push(v);
  }
  if (t === null || !Number.isFinite(t) || signatures.length === 0) return false;
  if (Math.abs(nowSeconds - t) > toleranceSeconds) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest();
  return signatures.some((sig) => {
    if (!/^[0-9a-f]{64}$/.test(sig)) return false;
    const got = Buffer.from(sig, "hex");
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

export function signStripePayload(payload: string, secret: string, t: number): string {
  const sig = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  return `t=${t},v1=${sig}`;
}
