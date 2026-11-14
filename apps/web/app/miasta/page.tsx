import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd, PublicShell } from "@/components/SiteChrome";
import { listCities } from "@/lib/catalog";
import { inCity } from "@/lib/cities";
import { absoluteUrl } from "@/lib/format";
import { nBiur, nMiast } from "@/lib/plural";
import { pageMetadata, websiteRef } from "@/lib/seo";
import { groupByVoivodeship } from "@/lib/voivodeships";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const cities = await listCities().catch(() => []);
  return pageMetadata({
    title: "Biura nieruchomości w miastach Polski: lista miast według województw",
    description: `Wszystkie miasta w katalogu biur nieruchomości (${nMiast(cities.length)}), pogrupowane według województw, z liczbą biur w każdym mieście.`,
    path: "/miasta",
  });
}

export default async function CitiesPage() {
  const cities = await listCities().catch(() => []);
  const groups = groupByVoivodeship(cities);
  return (
    <PublicShell>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Biura nieruchomości w miastach Polski",
          url: absoluteUrl("/miasta"),
          inLanguage: "pl-PL",
          isPartOf: websiteRef(),
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: cities.length,
            itemListElement: cities.map((c, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: `Biura nieruchomości ${c.name}`,
              url: absoluteUrl(`/${c.slug}`),
            })),
          },
        }}
      />
      <p className="crumbs">
        <Link href="/">Strona główna</Link> / Miasta
      </p>
      <h1>Biura nieruchomości w miastach Polski</h1>
      <p className="lead-text">
        Katalog obejmuje {nMiast(cities.length)}. Wybierz miasto, żeby zobaczyć ranking biur, ceny usług i aktualne oferty.
      </p>
      {groups.map((g) => (
        <section key={g.voivodeship}>
          <h2>
            {g.voivodeship === "Pozostałe miejscowości" ? g.voivodeship : `Województwo ${g.voivodeship}`}
          </h2>
          <ul className="city-grid">
            {g.cities.map((c) => (
              <li key={c.slug}>
                <Link href={`/${c.slug}`} title={`Biura nieruchomości ${inCity(c.name)}`}>
                  <b>{c.name}</b>
                  <span>{nBiur(c.listings)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </PublicShell>
  );
}
