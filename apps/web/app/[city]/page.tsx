import type { Metadata } from "next";
import Link from "next/link";

import { FirmImage } from "@/components/FirmImage";
import { notFound } from "next/navigation";

import { JsonLd, PublicShell } from "@/components/SiteChrome";
import { cityCommissionStats, cityPriceExamples, cityServices, getCity, listCities, listCityListings, type ListingCard } from "@/lib/catalog";
import { inCity } from "@/lib/cities";
import { choosingGuide, cityFaq, cityH1, cityIntro, commissionSection, topThree, type CityData } from "@/lib/city-content";
import { SITE_NAME, absoluteUrl, formatDate, formatYear } from "@/lib/format";
import { nBiur, nBiurGen, plural } from "@/lib/plural";
import { cityMeta } from "@/lib/meta-texts";
import { breadcrumbLd, pageMetadata } from "@/lib/seo";
import { CITY_RANKING_MIN, PRICE_STAT_MIN, rankListings, type RankingInput } from "@/lib/ranking";

export const revalidate = 300;

type Props = { params: Promise<{ city: string }> };

const toInput = (l: ListingCard): RankingInput => ({
  startDate: l.startDate,
  hasPublicPrices: l.hasPublicPrices,
  verificationScore: l.verificationScore,
  registryConfirmed: l.registryConfirmed,
  servicesCount: l.servicesCount,
  offersCount: l.offersCount,
  googleRating: l.googleRating,
  googleCount: l.googleCount,
});

async function load(slug: string) {
  const city = await getCity(slug);
  if (!city) return null;
  const listings = await listCityListings(slug);
  if (listings.length === 0) return null;
  const [stats, prices, services, cities] = await Promise.all([
    cityCommissionStats(slug),
    cityPriceExamples(slug),
    cityServices(slug),
    listCities().catch(() => []),
  ]);
  const ranked = listings.length >= CITY_RANKING_MIN ? rankListings(listings, toInput) : null;
  const updatedAt = new Date(Math.max(0, ...listings.map((l) => (l.publishedAt ? new Date(l.publishedAt).getTime() : 0))));
  return { city, listings, stats, ranked, updatedAt, prices, services, cities };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city: slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Nie znaleziono", robots: { index: false } };
  const year = new Date().getFullYear();
  const withPrices = data.listings.filter((l) => l.hasPublicPrices).length;
  const meta = cityMeta(data.city.name, year, data.listings.length, Boolean(data.ranked), withPrices);
  // Miasto poniżej progu rankingu to krótka lista: widoczna dla ludzi, ale bez indeksowania (cienka treść).
  return pageMetadata({ ...meta, path: `/${data.city.slug}`, noindex: !data.ranked });
}

export default async function CityPage({ params }: Props) {
  const { city: slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { city, listings, stats, ranked, updatedAt, prices, services, cities } = data;
  const withPrices = listings.filter((l) => l.hasPublicPrices).length;
  const rows = ranked ?? listings.map((l, i) => ({ ...l, position: i + 1, score: 0, breakdown: [] }));
  const year = new Date().getFullYear();
  const where = inCity(city.name);
  const content: CityData = {
    cityName: city.name,
    firms: rows.map((r) => ({
      name: r.name,
      slug: r.slug,
      score: r.score,
      position: r.position,
      registryConfirmed: r.registryConfirmed,
      hasPublicPrices: r.hasPublicPrices,
      offersCount: r.offersCount,
    })),
    ranked: Boolean(ranked),
    updatedAt,
    median: stats.median,
    medianN: stats.n,
    medianObservedAt: stats.observedAt,
    prices,
    services,
  };
  const medianText =
    stats.n >= PRICE_STAT_MIN && stats.median != null
      ? ` Mediana jawnej prowizji od sprzedaży wynosi ${stats.median.toLocaleString("pl-PL")}% (na podstawie ${nBiurGen(stats.n)}, ceny deklarowane przez firmy, wg ich stron z dnia ${formatDate(stats.observedAt)}).`
      : "";
  const confirmed = listings.filter((l) => l.registryConfirmed).length;
  const confirmedText =
    confirmed === listings.length ? "Wszystkie są potwierdzone w rejestrach publicznych." : `${confirmed} z nich ${plural(confirmed, "jest potwierdzone", "są potwierdzone", "jest potwierdzonych")} w rejestrach publicznych.`;
  const summary = `Katalog zawiera ${nBiur(listings.length)} nieruchomości ${where}. ${confirmedText} ${withPrices} z nich ${plural(withPrices, "publikuje", "publikują", "publikuje")} na swojej stronie ceny usług.${medianText}`;
  const top = topThree(content);
  const commission = commissionSection(content);
  const guide = choosingGuide(content);
  const faq = cityFaq(content);
  const otherCities = cities.filter((c) => c.slug !== city.slug).slice(0, 8);

  return (
    <PublicShell>
      <p className="crumbs">
        <Link href="/">Strona główna</Link> / {city.name}
      </p>
      <h1>{cityH1(city.name, Boolean(ranked), year)}</h1>
      <p className="lead-text">{cityIntro(content)}</p>

      <div className="answer">
        <strong>W skrócie</strong>
        <p>{summary}</p>
      </div>

      {city.editorial &&
        city.editorial
          .split(/\n\s*\n/)
          .map((para, i) => <p key={i}>{para.trim()}</p>)}

      {top.length > 0 && (
        <>
          <h2>Najlepsze biura nieruchomości {where}</h2>
          <p>
            Najwyższe wyniki w rankingu {where} mają{" "}
            {top.map((f, i) => (
              <span key={f.slug ?? f.name}>
                {i > 0 && (i === top.length - 1 ? " i " : ", ")}
                {f.slug ? <Link href={`/${city.slug}/${f.slug}`}>{f.name}</Link> : f.name} ({f.score}/100)
              </span>
            ))}
            . To wynik według <Link href="/metodologia">jawnej metodologii katalogu</Link>, opartej m.in. na
            potwierdzeniu w rejestrze, stażu, jawności cennika, zakresie usług i aktualnych ofertach, a nie ocena jakości
            obsługi.
          </p>
        </>
      )}

      <h2>{ranked ? `Porównanie biur nieruchomości ${where}` : `Lista biur nieruchomości ${where} (alfabetycznie)`}</h2>
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
                    <FirmImage src={row.logoUrl} kind="logo" name={row.name} size="sm" />
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
                <td>{row.registryConfirmed ? formatYear(row.startDate) : <span className="note">bez potwierdzenia</span>}</td>
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

      <h2>Ile wynosi prowizja biura nieruchomości {where}?</h2>
      <p>{commission.summary}</p>
      {commission.examples.length > 0 && (
        <ul className="plain">
          {commission.examples.map((e) => (
            <li key={e.firmSlug}>
              <Link href={`/${city.slug}/${e.firmSlug}`}>{e.firmName}</Link>: {e.service}, {e.value}
            </li>
          ))}
        </ul>
      )}
      <p className="note">{commission.note}</p>

      <h2>Jak wybrać biuro nieruchomości {where}?</h2>
      {guide.map((para, i) => (
        <p key={i}>{para}</p>
      ))}

      <h2>Najczęściej zadawane pytania</h2>
      <div className="faq">
        {faq.map((f) => (
          <details key={f.q}>
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>

      {otherCities.length > 0 && (
        <>
          <h2>Biura nieruchomości w innych miastach</h2>
          <ul className="plain">
            {otherCities.map((c) => (
              <li key={c.slug}>
                <Link href={`/${c.slug}`}>Biura nieruchomości {inCity(c.name)}</Link> ({nBiur(c.listings)})
              </li>
            ))}
          </ul>
        </>
      )}

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
        }}
      />

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          "@id": `${absoluteUrl(`/${city.slug}`)}#strona`,
          url: absoluteUrl(`/${city.slug}`),
          name: `Biura nieruchomości ${city.name}`,
          inLanguage: "pl-PL",
          dateModified: updatedAt.toISOString(),
          isPartOf: { "@type": "WebSite", name: SITE_NAME, url: absoluteUrl("/") },
          mainEntity: {
            "@type": "ItemList",
            name: ranked ? `Ranking biur nieruchomości ${city.name}` : `Biura nieruchomości ${city.name}`,
            itemListOrder: ranked ? "https://schema.org/ItemListOrderDescending" : "https://schema.org/ItemListOrderAscending",
            numberOfItems: listings.length,
            itemListElement: rows.map((row) => ({
              "@type": "ListItem",
              position: row.position,
              name: row.name,
              url: absoluteUrl(`/${city.slug}/${row.slug}`),
            })),
          },
        }}
      />
      <JsonLd data={breadcrumbLd([{ name: "Strona główna", path: "/" }, { name: `Biura nieruchomości ${city.name}`, path: `/${city.slug}` }])} />
    </PublicShell>
  );
}
