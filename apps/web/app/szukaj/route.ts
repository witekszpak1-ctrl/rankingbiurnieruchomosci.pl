import { NextResponse, type NextRequest } from "next/server";

import { query } from "@/lib/db";
import { slugify } from "@/lib/slug";

/** Wyszukiwarka ze strony głównej: nazwa miasta -> strona miasta. Nieznane miasto wraca na stronę główną. */
export async function GET(request: NextRequest) {
  const raw = (request.nextUrl.searchParams.get("miasto") ?? "").trim().slice(0, 60);
  const slug = slugify(raw);
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
      return NextResponse.redirect(base);
    }
  }
  base.pathname = "/";
  base.searchParams.set("brak", raw);
  base.hash = "miasta";
  return NextResponse.redirect(base);
}
