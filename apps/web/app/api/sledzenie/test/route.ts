import { currentAdmin } from "@/lib/admin-auth";

// Tryb testowy narzędzi analitycznych: tylko dla zalogowanego administratora (ciasteczko sesji panelu).
// Odpowiedź nie może trafić do pamięci podręcznej, bo zależy od osoby.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const admin = await currentAdmin();
  return Response.json({ test: Boolean(admin) }, { status: admin ? 200 : 403, headers: { "cache-control": "private, no-store" } });
}
