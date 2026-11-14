import { NextResponse } from "next/server";

import { query } from "@/lib/db";
import { resolveRedirects } from "@/lib/redirects";

export const dynamic = "force-dynamic";

/**
 * Stare i usunięte adresy dla middleware: przekierowania stałe przeniesionych albo scalonych profili
 * (listing_redirects) oraz adresy, które mają odpowiadać kodem 410 (wycofane wpisy i miasta bez żadnej firmy).
 */
export async function GET() {
  const [redirects, goneFirms, goneCities] = await Promise.all([
    query<{ from: string; to: string; published: boolean }>(
      `select r.from_path as "from", '/' || c.slug || '/' || l.slug as "to", l.status = 'published' as published
       from listing_redirects r
       join listings l on l.id = r.listing_id and l.slug is not null
       join cities c on c.id = l.city_id`,
    ),
    query<{ path: string }>(
      `select distinct '/' || c.slug || '/' || l.slug as path
       from listings l join cities c on c.id = l.city_id
       where l.status = 'removed' and l.slug is not null
         and not exists (select 1 from listings p where p.city_id = l.city_id and p.slug = l.slug and p.status = 'published')`,
    ),
    query<{ path: string }>(
      `select '/' || c.slug as path from cities c
       where exists (select 1 from listings l where l.city_id = c.id and l.slug is not null)
         and not exists (select 1 from listings l where l.city_id = c.id and l.status = 'published')`,
    ),
  ]);
  const map = resolveRedirects(redirects);
  const gone = [...goneFirms, ...goneCities].map((r) => r.path).filter((p) => !(p in map));
  return NextResponse.json(
    { redirects: map, gone },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
  );
}

