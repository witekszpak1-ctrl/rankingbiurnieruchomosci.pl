import { awardPlace, badgeSvg } from "@/lib/awards";
import { getBadgeListing, listCityListings } from "@/lib/catalog";

// Miejsce w rankingu liczone przy każdym wejściu; odpowiedź trzyma CDN (s-maxage), więc baza nie jest pytana za każdym razem.
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Odznaka wyróżnienia dla strony biura: /odznaka/<id wpisu>.svg. Nieznany wpis dostaje odznakę neutralną (bez pustego obrazka). */
export async function GET(_req: Request, ctx: { params: Promise<{ file: string }> }): Promise<Response> {
  const { file } = await ctx.params;
  const id = file.replace(/\.svg$/i, "");
  let award: { place: number; cityName: string } | null = null;
  if (UUID_RE.test(id)) {
    try {
      const listing = await getBadgeListing(id);
      if (listing) {
        const place = awardPlace(id, await listCityListings(listing.citySlug));
        if (place) award = { place: place.place, cityName: listing.cityName };
      }
    } catch {
      award = null; // przy kłopocie z bazą lepsza neutralna odznaka niż zepsuty obrazek na stronie biura
    }
  }
  return new Response(badgeSvg(award), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
