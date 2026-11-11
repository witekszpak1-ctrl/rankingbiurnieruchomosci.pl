import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { JsonLd, PublicShell } from "@/components/SiteChrome";
import { getPublishedListing } from "@/lib/catalog";
import { absoluteUrl, formatDate, formatPrice, formatYear } from "@/lib/format";
import { scoreListing } from "@/lib/ranking";

export const revalidate = 300;

type Props = { params: Promise<{ city: string; firm: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city, firm } = await params;
  const listing = await getPublishedListing(city, firm);
  if (!listing) return { title: "Nie znaleziono", robots: { index: false } };
  return {
    title: `${listing.name} - biuro nieruchomości ${listing.cityName}`,
    description: listing.description ?? `Biuro nieruchomości ${listing.name} z miasta ${listing.cityName}.`,
    alternates: { canonical: `/${city}/${firm}` },
  };
}

function newest(dates: Date[]): Date {
  return new Date(Math.max(...dates.map((d) => new Date(d).getTime())));
}

export default async function FirmPage({ params }: Props) {
  const { city, firm } = await params;
  const listing = await getPublishedListing(city, firm);
  if (!listing) notFound();
  const { breakdown, score } = scoreListing({
    startDate: listing.startDate,
    hasPublicPrices: listing.hasPublicPrices,
    verificationScore: listing.verificationScore,
    servicesCount: listing.servicesCount,
  });

  return (
    <PublicShell>
      <p className="crumbs">
        <Link href="/">Strona główna</Link> / <Link href={`/${listing.citySlug}`}>{listing.cityName}</Link> / {listing.name}
      </p>
      <h1>{listing.name}</h1>
      <p className="note">Biuro nieruchomości, {listing.cityName}</p>

      {listing.description && (
        <div className="answer">
          <strong>W skrócie</strong>
          <p>{listing.description}</p>
          <p className="note">Opis przygotowano na podstawie faktów ze stron firmy i rejestrów publicznych.</p>
        </div>
      )}

      <h2>Podstawowe informacje</h2>
      <div className="tablewrap">
        <table>
          <tbody>
            <tr>
              <th>W rejestrze od</th>
              <td>{formatYear(listing.startDate)}</td>
            </tr>
            {listing.legalForm && (
              <tr>
                <th>Forma prawna</th>
                <td>{listing.legalForm}</td>
              </tr>
            )}
            {listing.websiteUrl && (
              <tr>
                <th>Strona firmy</th>
                <td>
                  <a href={listing.websiteUrl} rel="noopener nofollow" target="_blank">
                    {listing.host}
                  </a>
                </td>
              </tr>
            )}
            <tr>
              <th>Weryfikacja</th>
              <td>
                <span className="badge ok">dane zgodne z rejestrami</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {listing.services.length > 0 && (
        <>
          <h2>Usługi</h2>
          <ul className="plain">
            {listing.services.map((service) => (
              <li key={service}>{service}</li>
            ))}
          </ul>
        </>
      )}

      {listing.offers.length > 0 && (
        <>
          <h2>Aktualne oferty</h2>
          <ul className="offers">
            {listing.offers.map((offer) => (
              <li key={offer.url}>
                <a href={offer.url} rel="noopener nofollow" target="_blank">
                  {offer.title}
                </a>
              </li>
            ))}
          </ul>
          <p className="note">
            Najnowsze oferty ze strony firmy
            {listing.offersSourceUrl && (
              <>
                {" "}
                (
                <a href={listing.offersSourceUrl} rel="noopener nofollow" target="_blank">
                  wszystkie oferty biura
                </a>
                )
              </>
            )}
            , sprawdzone {formatDate(newest(listing.offers.map((o) => o.lastSeenAt)))}. Cenę i dostępność potwierdź na
            stronie biura.
          </p>
        </>
      )}

      <h2>Ceny usług</h2>
      {listing.prices.length > 0 ? (
        <>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Usługa</th>
                  <th>Cena</th>
                  <th>Źródło</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {listing.prices.map((price) => (
                  <tr key={`${price.service}-${price.sourceUrl}`}>
                    <td>{price.service}</td>
                    <td>{formatPrice(price)}</td>
                    <td>
                      {price.sourceUrl ? (
                        <a href={price.sourceUrl} rel="noopener nofollow" target="_blank">
                          strona firmy
                        </a>
                      ) : (
                        "brak"
                      )}
                    </td>
                    <td>{formatDate(price.observedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note">Ceny deklarowane przez firmę, według jej strony internetowej w podanym dniu. Mogły się zmienić.</p>
        </>
      ) : (
        <p>Firma nie publikuje cen na swojej stronie. Cennik ustala indywidualnie.</p>
      )}

      <h2>Wynik w rankingu: {score}/100</h2>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Parametr</th>
              <th>Punkty</th>
              <th className="num">Waga</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map((item) => (
              <tr key={item.key}>
                <td>{item.label}</td>
                <td>
                  <span className="bar-track" aria-hidden="true">
                    <span className="bar" style={{ width: `${Math.round(item.value * 100)}%` }} />
                  </span>
                  {Math.round(item.value * 100)}%
                </td>
                <td className="num">{item.weight}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">
        Szczegóły w <Link href="/metodologia">metodologii</Link>. Dane aktualne na dzień {formatDate(listing.updatedAt)}.{" "}
        Widzisz błąd? <Link href="/dla-firm">Zgłoś korektę lub usunięcie wpisu</Link>.
      </p>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "RealEstateAgent",
          name: listing.name,
          url: listing.websiteUrl ?? absoluteUrl(`/${listing.citySlug}/${listing.slug}`),
          description: listing.description ?? undefined,
          address: { "@type": "PostalAddress", addressLocality: listing.cityName, addressCountry: "PL" },
          areaServed: listing.cityName,
        }}
      />
    </PublicShell>
  );
}
