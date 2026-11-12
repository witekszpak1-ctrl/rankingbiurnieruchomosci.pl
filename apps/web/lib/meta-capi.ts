/**
 * Meta Conversions API: te same zdarzenia co piksel, wysyłane z serwera (dochodzą także przy blokerach reklam).
 * Tylko za zgodą na kategorię marketingową (albo w trybie testowym zalogowanego administratora). Deduplikacja z
 * pikselem po event_id. Dane kontaktowe (e-mail, telefon, imię) wysyłamy wyłącznie jako skróty SHA-256.
 */

import { createHash } from "node:crypto";

import { cookies, headers } from "next/headers";

import { currentAdmin } from "./admin-auth";
import { CONSENT_COOKIE, CONSENT_VERSION } from "./consent";
import { getTracking } from "./tracking";

const GRAPH = "https://graph.facebook.com/v23.0";

export type MetaContext = {
  allowed: boolean;
  ip: string | null;
  ua: string | null;
  fbp: string | null;
  fbc: string | null;
};

export type MetaEvent = {
  name: string;
  eventId: string;
  url: string;
  custom?: Record<string, string | number>;
  user?: { email?: string | null; phone?: string | null; firstName?: string | null };
};

function sha(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Telefon w formacie E.164 bez plusa (Meta): same cyfry, numer 9-cyfrowy dostaje kierunkowy 48. */
export function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "").replace(/^00/, "");
  if (digits.length === 9) digits = `48${digits}`;
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

export function hashedUser(user: MetaEvent["user"]): Record<string, string[]> {
  const out: Record<string, string[]> = { country: [sha("pl")] };
  const email = user?.email?.trim().toLowerCase();
  if (email) out.em = [sha(email)];
  const phone = user?.phone ? normalizePhone(user.phone) : null;
  if (phone) out.ph = [sha(phone)];
  const first = user?.firstName?.trim().split(/\s+/)[0]?.toLowerCase();
  if (first) out.fn = [sha(first)];
  return out;
}

/** Zbiera dane żądania potrzebne do wysyłki (wywołać przed after(): wewnątrz after() nagłówki nie są dostępne). */
export async function metaContext(url: string, testHeader = false): Promise<MetaContext> {
  const h = await headers();
  const c = await cookies();
  let allowed = false;
  const raw = c.get(CONSENT_COOKIE)?.value;
  if (raw) {
    const params = new URLSearchParams(decodeURIComponent(raw));
    allowed = Number(params.get("v")) === CONSENT_VERSION && params.get("m") === "1";
  }
  if (!allowed && (testHeader || h.get("x-rbn-test") === "1")) allowed = Boolean(await currentAdmin());
  let fbc = c.get("_fbc")?.value ?? null;
  if (!fbc) {
    try {
      const fbclid = new URL(url).searchParams.get("fbclid");
      if (fbclid) fbc = `fb.1.${Date.now()}.${fbclid}`;
    } catch {
      /* adres bez fbclid */
    }
  }
  return {
    allowed,
    ip: h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    ua: h.get("user-agent"),
    fbp: c.get("_fbp")?.value ?? null,
    fbc,
  };
}

export async function sendMetaEvent(context: MetaContext, event: MetaEvent): Promise<boolean> {
  if (!context.allowed) return false;
  const tracking = await getTracking();
  const pixel = tracking.ids.metaPixel;
  if (!pixel || !tracking.metaCapiToken) return false;
  const userData: Record<string, unknown> = { ...hashedUser(event.user) };
  if (context.ip) userData.client_ip_address = context.ip;
  if (context.ua) userData.client_user_agent = context.ua;
  if (context.fbp) userData.fbp = context.fbp;
  if (context.fbc) userData.fbc = context.fbc;
  const body: Record<string, unknown> = {
    data: [
      {
        event_name: event.name,
        event_time: Math.floor(Date.now() / 1000),
        event_id: event.eventId,
        action_source: "website",
        event_source_url: event.url,
        user_data: userData,
        custom_data: event.custom ?? {},
      },
    ],
  };
  if (tracking.metaTestCode) body.test_event_code = tracking.metaTestCode;
  try {
    const response = await fetch(`${GRAPH}/${pixel}/events?access_token=${encodeURIComponent(tracking.metaCapiToken)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) console.error("Meta Conversions API:", response.status, (await response.text()).slice(0, 300));
    return response.ok;
  } catch (error) {
    console.error("Meta Conversions API: brak odpowiedzi", error instanceof Error ? error.message : error);
    return false;
  }
}
