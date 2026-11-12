import { after } from "next/server";

import { metaContext, sendMetaEvent } from "@/lib/meta-capi";
import { TRACK_NAMES, type TrackName } from "@/lib/track";

// Zdarzenia piksela Meta przekazywane z przeglądarki do Conversions API (tylko za zgodą, sprawdzaną z ciasteczka).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";


export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) return new Response(null, { status: 403 });
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return new Response(null, { status: 400 });
  }
  const name = String(body.name ?? "") as TrackName;
  const eventId = String(body.eventId ?? "");
  const url = String(body.url ?? "");
  if (!TRACK_NAMES.includes(name) || !/^[\w-]{8,64}$/.test(eventId) || !/^https?:\/\//.test(url)) {
    return new Response(null, { status: 400 });
  }
  const custom: Record<string, string | number> = {};
  if (body.params && typeof body.params === "object") {
    for (const [key, value] of Object.entries(body.params as Record<string, unknown>).slice(0, 10)) {
      if (/^[a-z_]{1,40}$/.test(key) && (typeof value === "string" || typeof value === "number")) {
        custom[key] = typeof value === "string" ? value.slice(0, 200) : value;
      }
    }
  }
  const context = await metaContext(url);
  if (!context.allowed) return new Response(null, { status: 204 });
  after(() => sendMetaEvent(context, { name, eventId, url: url.slice(0, 500), custom }));
  return new Response(null, { status: 204 });
}
