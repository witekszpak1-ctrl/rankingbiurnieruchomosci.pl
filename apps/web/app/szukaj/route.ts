import { NextResponse, type NextRequest } from "next/server";

import { GOALS, type Goal } from "@/lib/city-view";
import { query } from "@/lib/db";
import { slugify } from "@/lib/slug";

/**
 * Wyszukiwarka ze strony głównej: nazwa miasta -> strona miasta. Nieznane miasto wraca na stronę główną.
 * Wybrany cel (?cel=sprzedaz|kupno|wynajem) przechodzi do strony miasta jako gotowy filtr listy.
 */
export async function GET(request: NextRequest) {
  const raw = (request.nextUrl.searchParams.get("miasto") ?? "").trim().slice(0, 60);
  const slug = slugify(raw);
  const cel = request.nextUrl.searchParams.get("cel");
  const goal = (Object.keys(GOALS) as Goal[]).find((g) => g === cel) ?? null;
  const base = request.nextUrl.clone();
  base.search = "";
  if (slug) {
    const rows = await query<{ slug: string }>(
      `select c.slug from cities c where c.slug = $1
         and exists (select 1 from listings l where l.city_id = c.id and l.status = 'published')`,
      [slug],
    );
    if (rows[0]) {
      base.pathname = `/${rows[0].slug}`;
      if (goal) {
        base.searchParams.set("cel", goal);
        base.hash = "lista";
      }
      return NextResponse.redirect(base);
    }
  }
  base.pathname = "/";
  base.searchParams.set("brak", raw);
  base.hash = "miasta";
  return NextResponse.redirect(base);
}
