import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd, PublicShell } from "@/components/SiteChrome";
import { listCities } from "@/lib/catalog";
import { inCity } from "@/lib/cities";
import { absoluteUrl } from "@/lib/format";
import { nFirmUnits, nMiast } from "@/lib/plural";
import { capitalize, firmPhrase, currentPortal } from "@/lib/portal";
import { unitForms } from "@/lib/unit";
import { pageMetadata, websiteRef } from "@/lib/seo";
import { groupByVoivodeship } from "@/lib/voivodeships";

export const revalidate = 3600;

const u = unitForms();

export async function generateMetadata(): Promise<Metadata> {
  const cities = await listCities().catch(() => []);
  return pageMetadata({
    title: `${capitalize(firmPhrase("few"))} w miastach Polski: lista miast według województw`,
    description: `Wszystkie miasta w katalogu ${firmPhrase("many")} (${nMiast(cities.length)}), pogrupowane według województw, z liczbą ${u.pl.gen} w każdym mieście.`,
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
          name: `${capitalize(firmPhrase("few"))} w miastach Polski`,
          url: absoluteUrl("/miasta"),
          inLanguage: "pl-PL",
          isPartOf: websiteRef(),
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: cities.length,
            itemListElement: cities.map((c, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: `${capitalize(firmPhrase("few"))} ${c.name}`,
              url: absoluteUrl(`/${c.slug}`),
            })),
          },
        }}
      />
      <p className="crumbs">
        <Link href="/">Strona główna</Link> / Miasta
      </p>
      <h1>{`${capitalize(firmPhrase("few"))} w miastach Polski`}</h1>
      <p className="lead-text">
        Katalog obejmuje {nMiast(cities.length)}{`. Wybierz miasto, żeby zobaczyć ranking ${u.pl.gen}, ceny usług`}{currentPortal().features.offers ? " i aktualne oferty" : ""}.
      </p>
      {groups.map((g) => (
        <section key={g.voivodeship}>
          <h2>
            {g.voivodeship === "Pozostałe miejscowości" ? g.voivodeship : `Województwo ${g.voivodeship}`}
          </h2>
          <ul className="city-grid">
            {g.cities.map((c) => (
              <li key={c.slug}>
                <Link href={`/${c.slug}`} title={`${capitalize(firmPhrase("few"))} ${inCity(c.name)}`}>
                  <b>{c.name}</b>
                  <span>{nFirmUnits(c.listings)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </PublicShell>
  );
}
