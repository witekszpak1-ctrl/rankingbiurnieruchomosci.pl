import type { Metadata } from "next";
import Link from "next/link";

import { PublicShell } from "@/components/SiteChrome";
import { listOffersPage, offerCities } from "@/lib/catalog";
import { inCity } from "@/lib/cities";
import { formatOfferPrice } from "@/lib/format";
import { nBiurGen, nOfert } from "@/lib/plural";
import { pageMetadata } from "@/lib/seo";

const PER_PAGE = 48;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

// Lista to zbiór ogłoszeń z cudzych stron (tytuł, cena, link do biura), więc nie jest samodzielną treścią do indeksu:
// noindex, ale follow, żeby roboty doszły do profili biur.
export const metadata: Metadata = pageMetadata({
  title: "Aktualne oferty biur nieruchomości | Ranking biur nieruchomości",
  description:
    "Najnowsze oferty nieruchomości ze stron biur z naszego katalogu: tytuł, cena i link do ogłoszenia na stronie biura. Sprawdzane codziennie.",
  path: "/oferty",
  noindex: true,
});

export default async function OffersPage({ searchParams }: Props) {
  const params = await searchParams;
  const citySlug = one(params.miasto);
  const page = Math.max(0, Number.parseInt(one(params.strona), 10) || 0);
  const [{ offers, total }, cities] = await Promise.all([
    listOffersPage({ citySlug: citySlug || undefined, page, perPage: PER_PAGE }),
    offerCities().catch(() => []),
  ]);
  const city = cities.find((c) => c.slug === citySlug);
  const firms = new Set(offers.map((o) => o.firmSlug)).size;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const link = (p: number) => `/oferty?${new URLSearchParams({ ...(citySlug && { miasto: citySlug }), ...(p > 0 && { strona: String(p) }) })}`;

  return (
    <PublicShell>
      <p className="crumbs">
        <Link href="/">Strona główna</Link> / Aktualne oferty
      </p>
      <h1>Aktualne oferty biur nieruchomości{city ? ` ${inCity(city.name)}` : ""}</h1>
      <p>
        {total > 0
          ? `${nOfert(total)} pobranych w ostatnich dwóch tygodniach ze stron biur z naszego katalogu${city ? ` (biura ${inCity(city.name)})` : ""}.`
          : "Nie mamy jeszcze aktualnych ofert dla tego wyboru."}{" "}
        Robot sprawdza strony biur codziennie i pobiera najwyżej 20 najnowszych ogłoszeń z każdej, więc to próbka, a nie
        pełna oferta biur. Miasto przy ofercie to siedziba biura, nie lokalizacja nieruchomości. Cenę i dostępność potwierdź
        na stronie biura.
      </p>

      {cities.length > 1 && (
        <p className="chips-inline">
          <b>Biura z miasta: </b>
          {citySlug ? <Link href="/oferty">wszystkie</Link> : <b>wszystkie</b>}
          {cities.map((c) => (
            <span key={c.slug}>
              {" · "}
              {c.slug === citySlug ? <b>{c.name}</b> : <Link href={`/oferty?miasto=${c.slug}`}>{c.name}</Link>} ({c.n})
            </span>
          ))}
        </p>
      )}

      {offers.length > 0 && (
        <ul className="offer-tiles">
          {offers.map((o) => {
            const price = formatOfferPrice(o.priceAmount, o.priceCurrency, o.pricePeriod);
            return (
              <li key={o.url}>
                <a href={o.url} target="_blank" rel="noopener nofollow" className="offer-tile">
                  <span className="offer-tile-price">{price ?? "cena na stronie biura"}</span>
                  <span className="offer-tile-title">{o.title}</span>
                  <span className="offer-tile-firm">
                    oferta biura {o.firmName} ({o.cityName})
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
      {offers.length > 0 && (
        <p className="note">
          Na tej stronie: oferty z {nBiurGen(firms)}. Profile biur:{" "}
          {[...new Map(offers.map((o) => [o.firmSlug, o])).values()].slice(0, 8).map((o, i) => (
            <span key={o.firmSlug}>
              {i > 0 && ", "}
              <Link href={`/${o.citySlug}/${o.firmSlug}`}>{o.firmName}</Link>
            </span>
          ))}
          .
        </p>
      )}

      {pages > 1 && (
        <p className="pager">
          {page > 0 && (
            <Link className="btn-outline" href={link(page - 1)}>
              Nowsze oferty
            </Link>
          )}{" "}
          <span className="note">
            strona {page + 1} z {pages}
          </span>{" "}
          {page + 1 < pages && (
            <Link className="btn-outline" href={link(page + 1)}>
              Starsze oferty
            </Link>
          )}
        </p>
      )}
    </PublicShell>
  );
}
