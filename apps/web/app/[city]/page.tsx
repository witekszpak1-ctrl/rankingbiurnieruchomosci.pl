import type { Metadata } from "next";
import Link from "next/link";

import { FirmImage } from "@/components/FirmImage";
import { notFound } from "next/navigation";

import { JsonLd, PublicShell } from "@/components/SiteChrome";
import { cityCommissionStats, getCity, listCityListings, type ListingCard } from "@/lib/catalog";
import { absoluteUrl, formatDate, formatYear } from "@/lib/format";
import { CITY_RANKING_MIN, PRICE_STAT_MIN, rankListings, type RankingInput } from "@/lib/ranking";

export const revalidate = 300;

type Props = { params: Promise<{ city: string }> };

const toInput = (l: ListingCard): RankingInput => ({
  startDate: l.startDate,
  hasPublicPrices: l.hasPublicPrices,
  verificationScore: l.verificationScore,
  servicesCount: l.servicesCount,
  offersCount: l.offersCount,
});

async function load(slug: string) {
  const city = await getCity(slug);
  if (!city) return null;
  const listings = await listCityListings(slug);
  if (listings.length === 0) return null;
  const stats = await cityCommissionStats(slug);
  const ranked = listings.length >= CITY_RANKING_MIN ? rankListings(listings, toInput) : null;
  const updatedAt = new Date(Math.max(0, ...listings.map((l) => (l.publishedAt ? new Date(l.publishedAt).getTime() : 0))));
  return { city, listings, stats, ranked, updatedAt };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city: slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Nie znaleziono", robots: { index: false } };
  const year = new Date().getFullYear();
  const ranking = data.ranked ? ` - ranking ${year}` : "";
  return {
    title: `Biura nieruchomości ${data.city.name}${ranking}`,
    description: `Zweryfikowane biura nieruchomości z miasta ${data.city.name}: ${data.listings.length} wpisów, jawne ceny prowizji i metodologia rankingu.`,
    alternates: { canonical: `/${slug}` },
    robots: data.ranked ? undefined : { index: false, follow: true },
  };
}

export default async function CityPage({ params }: Props) {
  const { city: slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { city, listings, stats, ranked, updatedAt } = data;
  const withPrices = listings.filter((l) => l.hasPublicPrices).length;
  const rows = ranked ?? listings.map((l, i) => ({ ...l, position: i + 1, score: 0, breakdown: [] }));
  const year = new Date().getFullYear();
  const medianText =
    stats.n >= PRICE_STAT_MIN && stats.median != null
      ? ` Mediana jawnej prowizji od sprzedaży wynosi ${stats.median.toLocaleString("pl-PL")}% (na podstawie ${stats.n} biur, ceny deklarowane przez firmy, wg ich stron z dnia ${formatDate(stats.observedAt)}).`
      : "";
  const summary = `Katalog zawiera ${listings.length} zweryfikowanych biur nieruchomości z miasta ${city.name}. ${withPrices} z nich publikuje na swojej stronie ceny usług.${medianText}`;

  return (
    <PublicShell>
      <p className="crumbs">
        <Link href="/">Strona główna</Link> / {city.name}
      </p>
      <h1>{`Biura nieruchomości ${city.name}${ranked ? ` - ranking ${year}` : ""}`}</h1>

      <div className="answer">
        <strong>W skrócie</strong>
        <p>{summary}</p>
      </div>

      <h2>{ranked ? "Ranking biur" : "Lista biur (alfabetycznie)"}</h2>
      {!ranked && (
        <p className="note">
          Ranking publikujemy od {CITY_RANKING_MIN} biur w mieście, żeby pozycje miały sens. Do tego czasu pokazujemy listę.
        </p>
      )}
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              {ranked && <th className="num">#</th>}
              <th>Biuro</th>
              {ranked && <th>Wynik</th>}
              <th>Cennik</th>
              <th>W rejestrze od</th>
              <th className="num">Usługi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.listingId}>
                {ranked && <td className="num">{row.position}</td>}
                <td>
                  <Link href={`/${city.slug}/${row.slug}`} className="firm-cell">
                    <FirmImage src={row.imageUrl} name={row.name} size="sm" />
                    <span>{row.name}</span>
                  </Link>
                </td>
                {ranked && (
                  <td>
                    <span className="bar-track" aria-hidden="true">
                      <span className="bar" style={{ width: `${row.score}%` }} />
                    </span>
                    {row.score}/100
                  </td>
                )}
                <td>{row.hasPublicPrices ? <span className="badge ok">jawny</span> : <span className="badge">brak</span>}</td>
                <td>{formatYear(row.startDate)}</td>
                <td className="num">{row.servicesCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">
        Wynik liczymy według <Link href="/metodologia">publicznej metodologii</Link>. Płatność nie wpływa na pozycję.
        Dane aktualne na dzień {formatDate(updatedAt)}.
      </p>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `Biura nieruchomości ${city.name}`,
          numberOfItems: listings.length,
          itemListElement: rows.map((row) => ({
            "@type": "ListItem",
            position: row.position,
            name: row.name,
            url: absoluteUrl(`/${city.slug}/${row.slug}`),
          })),
        }}
      />
    </PublicShell>
  );
}
