import { recordHit, type Hit } from "@/lib/analytics";
import { hitToken } from "@/lib/hit-token";

// Zapis wejścia zgłoszonego przez middleware (lib/analytics.ts). Wywołuje go tylko nasz serwer, z podpisem.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function str(value: unknown, max: number): string | null {
  return typeof value === "string" && value ? value.slice(0, max) : null;
}

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || request.headers.get("x-hit-token") !== (await hitToken(secret))) {
    return new Response(null, { status: 403 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return new Response(null, { status: 400 });
  }
  const path = str(body.path, 300);
  if (!path || !path.startsWith("/")) return new Response(null, { status: 400 });
  const hit: Hit = {
    path,
    kind: body.kind === "nav" ? "nav" : "page",
    referrer: str(body.referrer, 500),
    utmSource: str(body.utmSource, 100),
    utmMedium: str(body.utmMedium, 100),
    utmCampaign: str(body.utmCampaign, 100),
    country: str(body.country, 2),
    city: str(body.city, 80),
    ua: str(body.ua, 500) ?? "",
    ip: str(body.ip, 64),
    host: str(body.host, 200),
  };
  try {
    await recordHit(hit);
  } catch {
    return new Response(null, { status: 500 });
  }
  return new Response(null, { status: 204 });
}
