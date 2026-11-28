import { listWaitlist } from "@/lib/admin-repo";
import { toCsv } from "@/lib/admin-stats";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

/** Eksport listy oczekujących do CSV. Tylko administrator; bez sesji i dla zwykłego konta odpowiedź jest pusta (404). */
export async function GET(): Promise<Response> {
  const user = await currentUser();
  if (!user?.isAdmin) return new Response("Nie znaleziono.", { status: 404, headers: HEADERS });
  const { rows } = await listWaitlist(50000);
  const csv = toCsv(["email", "domena", "kod_partnera", "data_zapisu"], rows.map((r) => [r.email, r.domain, r.affiliateCode, r.createdAt]));
  const day = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      ...HEADERS,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="lista-oczekujacych-${day}.csv"`,
    },
  });
}
