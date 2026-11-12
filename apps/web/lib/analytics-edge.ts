import type { NextFetchEvent, NextRequest } from "next/server";

import { hitToken } from "./hit-token";

/**
 * Zgłasza wczytanie strony publicznej do /api/analityka/hit (zapis w lib/analytics.ts), w tle (waitUntil).
 * Pomija żądania RSC (prefetch i przejścia w obrębie serwisu) oraz inne metody niż GET. Działa w middleware (edge).
 */
export function reportHit(req: NextRequest, event: NextFetchEvent): void {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || req.method !== "GET") return;
  const h = req.headers;
  if (h.get("next-router-prefetch") || h.get("next-router-segment-prefetch") || h.get("purpose") === "prefetch") return;
  if (h.get("sec-purpose")?.includes("prefetch")) return;
  // Żądania RSC (wstępne pobieranie linków i przejścia w obrębie serwisu) mają nagłówek next-url albo nie są dokumentem.
  // Next.js usuwa przed middleware nagłówki, które pozwoliłyby odróżnić jedno od drugiego, więc liczymy tylko pełne
  // wczytania stron: każde wejście z zewnątrz, wpisany adres i odświeżenie. Roboty nie wysyłają sec-fetch-dest.
  if (h.has("next-url")) return;
  const dest = h.get("sec-fetch-dest");
  if (dest && dest !== "document") return;
  const url = req.nextUrl;
  let city: string | null = h.get("x-vercel-ip-city");
  try {
    city = city ? decodeURIComponent(city) : null;
  } catch {
    /* zostaje surowa wartość */
  }
  const payload = {
    path: url.pathname,
    kind: "page",
    referrer: h.get("referer"),
    utmSource: url.searchParams.get("utm_source"),
    utmMedium: url.searchParams.get("utm_medium"),
    utmCampaign: url.searchParams.get("utm_campaign"),
    country: h.get("x-vercel-ip-country"),
    city,
    ua: h.get("user-agent") ?? "",
    ip: h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    host: h.get("host"),
  };
  event.waitUntil(
    hitToken(secret)
      .then((token) =>
        fetch(new URL("/api/analityka/hit", url.origin), {
          method: "POST",
          headers: { "content-type": "application/json", "x-hit-token": token },
          body: JSON.stringify(payload),
        }),
      )
      .catch(() => undefined),
  );
}
