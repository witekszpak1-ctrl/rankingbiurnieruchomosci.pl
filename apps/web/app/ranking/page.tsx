import type { Metadata } from "next";
import Link from "next/link";

import { FirmImage } from "@/components/FirmImage";
import { JsonLd, PublicShell } from "@/components/SiteChrome";
import { listAllPublished, type TopListing } from "@/lib/catalog";
import { inCity } from "@/lib/cities";
import { SITE_NAME, absoluteUrl, formatDate } from "@/lib/format";
import { nBiur, plural } from "@/lib/plural";
import { rankListings, type RankingInput } from "@/lib/ranking";
import { breadcrumbLd, pageMetadata } from "@/lib/seo";

// Dane z bazy przy każdym wejściu (bez prerenderu w czasie budowania, kiedy baza jest niedostępna).
export const dynamic = "force-dynamic";

/** Minimalna liczba biur, przy której ogólnopolskie zestawienie ma sens i może być indeksowane. */
const MIN_FOR_INDEX = 10;
const TOP = 50;

const toInput = (l: TopListing): RankingInput => ({
  startDate: l.startDate,
  hasPublicPrices: l.hasPublicPrices,
  verificationScore: l.verificationScore,
  registryConfirmed: l.registryConfirmed,
  servicesCount: l.servicesCount,
  offersCount: l.offersCount,
  googleRating: l.googleRating,
  googleCount: l.googleCount,
});

const citiesLabel = (n: number) => `${n} ${n === 1 ? "miasta" : "miast"}`;

export async function generateMetadata(): Promise<Metadata> {
  const all = await listAllPublished().catch(() => []);
  const cities = new Set(all.map((l) => l.citySlug)).size;
  const year = new Date().getFullYear();
  return pageMetadata({
    title: `Najlepsze biura nieruchomości w Polsce ${year} | Ranking ogólnopolski`,
    description: `Ogólnopolskie zestawienie ${nBiur(all.length)} nieruchomości z ${citiesLabel(cities)}, ocenianych według jednej jawnej metodologii: rejestr, staż, cennik, zakres usług i oferty.`,
    path: "/ranking",
    noindex: all.length < MIN_FOR_INDEX,
  });
}

export default async function NationalRankingPage() {
  const all = await listAllPublished();
  const ranked = rankListings(all, toInput).slice(0, TOP);
  const cities = [...new Map(all.map((l) => [l.citySlug, l.cityName])).entries()].sort((a, b) => a[1].localeCompare(b[1], "pl"));
  const year = new Date().getFullYear();
  const updated = new Date(Math.max(0, ...all.map((l) => (l.publishedAt ? new Date(l.publishedAt).getTime() : 0))));
  const confirmed = all.filter((l) => l.registryConfirmed).length;
  const withPrices = all.filter((l) => l.hasPublicPrices).length;
  const top = ranked.slice(0, 3);

  return (
    <PublicShell>
      <p className="crumbs">
        <Link href="/">Strona główna</Link> / Ranking ogólnopolski
      </p>
      <h1>Najlepsze biura nieruchomości w Polsce {year}</h1>
      <p>
        Zestawienie obejmuje {nBiur(all.length)} nieruchomości z {citiesLabel(cities.length)}, ocenianych według tej samej{" "}
        <Link href="/metodologia">jawnej metodologii</Link>: potwierdzenie w rejestrze, staż, jawność cennika, zakres usług
        i aktualne oferty. {confirmed} z nich {plural(confirmed, "ma", "mają", "ma")} potwierdzenie w rejestrach publicznych, a {withPrices}{" "}
        {plural(withPrices, "publikuje", "publikują", "publikuje")} cennik.
        Pokazujemy {Math.min(TOP, ranked.length)} najwyżej ocenionych. Biuro wybiera się zwykle lokalnie, dlatego pełne
        porównanie znajdziesz na stronach miast. Dane zaktualizowaliśmy {formatDate(updated)}.
      </p>

      {top.length > 0 && (
        <div className="answer">
          <strong>W skrócie</strong>
          <p>
            Najwyższe wyniki w całym katalogu mają{" "}
            {top.map((f, i) => (
              <span key={f.listingId}>
                {i > 0 && (i === top.length - 1 ? " i " : ", ")}
                <Link href={`/${f.citySlug}/${f.slug}`}>{f.name}</Link> {inCity(f.cityName)} ({f.score}/100)
              </span>
            ))}
            . To ocena według metodologii katalogu, a nie opinia o jakości obsługi.
          </p>
        </div>
      )}

      <h2>Ranking biur nieruchomości w Polsce</h2>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th className="num">#</th>
              <th>Biuro</th>
              <th>Miasto</th>
              <th>Wynik</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((row) => (
              <tr key={row.listingId}>
                <td className="num">{row.position}</td>
                <td>
                  <Link href={`/${row.citySlug}/${row.slug}`} className="firm-cell">
                    <FirmImage src={row.logoUrl} kind="logo" name={row.name} size="sm" />
                    <span>{row.name}</span>
                  </Link>
                </td>
                <td>
                  <Link href={`/${row.citySlug}`}>{row.cityName}</Link>
                </td>
                <td>
                  <span className="bar-track" aria-hidden="true">
                    <span className="bar" style={{ width: `${row.score}%` }} />
                  </span>
                  {row.score}/100
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">
        Wynik liczymy według <Link href="/metodologia">publicznej metodologii</Link>. Płatność nie wpływa na pozycję.
      </p>

      <h2>Rankingi biur nieruchomości w miastach</h2>
      <ul className="plain">
        {cities.map(([slug, name]) => (
          <li key={slug}>
            <Link href={`/${slug}`}>Biura nieruchomości {inCity(name)}</Link>
          </li>
        ))}
      </ul>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          url: absoluteUrl("/ranking"),
          name: `Najlepsze biura nieruchomości w Polsce ${year}`,
          inLanguage: "pl-PL",
          dateModified: updated.toISOString(),
          isPartOf: { "@type": "WebSite", name: SITE_NAME, url: absoluteUrl("/") },
          mainEntity: {
            "@type": "ItemList",
            itemListOrder: "https://schema.org/ItemListOrderDescending",
            numberOfItems: ranked.length,
            itemListElement: ranked.map((r) => ({
              "@type": "ListItem",
              position: r.position,
              name: r.name,
              url: absoluteUrl(`/${r.citySlug}/${r.slug}`),
            })),
          },
        }}
      />
      <JsonLd data={breadcrumbLd([{ name: "Strona główna", path: "/" }, { name: "Ranking ogólnopolski", path: "/ranking" }])} />
    </PublicShell>
  );
}
