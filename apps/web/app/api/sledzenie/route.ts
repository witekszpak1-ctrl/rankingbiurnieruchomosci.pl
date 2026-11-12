import { getTracking, toPublic } from "@/lib/tracking";

// Konfiguracja narzędzi analitycznych dla przeglądarki (baner zgody i wczytywanie skryptów po zgodzie).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const config = toPublic(await getTracking());
  return Response.json(config, {
    headers: { "cache-control": "public, max-age=60, s-maxage=120, stale-while-revalidate=600" },
  });
}
