import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd, PublicShell } from "@/components/SiteChrome";
import { commissionReport } from "@/lib/catalog";
import { inCity } from "@/lib/cities";
import { absoluteUrl, SITE_NAME } from "@/lib/format";
import { nBiurGen } from "@/lib/plural";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 86400;

const PATH = "/poradnik/biura-z-jawnym-cennikiem";

export const metadata: Metadata = pageMetadata({
  title: "Biura nieruchomości z jawnym cennikiem: gdzie sprawdzisz prowizję przed rozmową",
  description:
    "Ile biur nieruchomości podaje ceny usług na swojej stronie, w których miastach jest ich najwięcej i jak znaleźć biuro z jawnym cennikiem w swoim mieście.",
  path: PATH,
  type: "article",
});

export default async function PublicPricesGuide() {
  const r = await commissionReport().catch(() => null);
  const top = (r?.cities ?? []).filter((c) => c.withPrices > 0).sort((a, b) => b.withPrices - a.withPrices).slice(0, 15);
  const share = r && r.firms > 0 ? Math.round((100 * r.withPrices) / r.firms) : null;
  return (
    <PublicShell>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "Biura nieruchomości z jawnym cennikiem",
          url: absoluteUrl(PATH),
          datePublished: "2026-11-14",
          dateModified: "2026-11-14",
          inLanguage: "pl",
          publisher: { "@type": "Organization", name: SITE_NAME, url: absoluteUrl("/") },
        }}
      />
      <p className="crumbs">
        <Link href="/">Strona główna</Link> / Poradnik
      </p>
      <h1>Biura nieruchomości z jawnym cennikiem</h1>
      <div className="answer">
        <strong>W skrócie</strong>
        <p>
          {r
            ? `Ceny usług na swojej stronie podaje ${r.withPrices} z ${nBiurGen(r.firms)} w naszym katalogu${share != null ? ` (${share}%)` : ""}. `
            : ""}
          Przy pozostałych stawkę poznasz dopiero w rozmowie. Jawny cennik to jeden z parametrów naszego rankingu.
        </p>
      </div>

      <h2>Dlaczego jawny cennik pomaga</h2>
      <p>
        Gdy biuro podaje stawki na stronie, możesz porównać kilka ofert przed pierwszym telefonem i od razu wiesz, czy cena
        jest netto czy brutto. Mniej jest też niespodzianek przy podpisywaniu umowy. Pamiętaj, że cennik na stronie to oferta
        wyjściowa, a wiążąca jest kwota w umowie pośrednictwa.
      </p>

      <h2>Jak znaleźć biuro z cennikiem w swoim mieście</h2>
      <p>
        Na stronie miasta włącz filtr „Jawny cennik”. Lista pokaże tylko biura, które podają ceny na swojej stronie, z ich
        pozycją w rankingu miasta. Na profilu biura zobaczysz stawki z datą odczytu i linkiem do źródła.
      </p>
      {top.length > 0 && (
        <>
          <h2>Miasta z największą liczbą biur z cennikiem</h2>
          <ul className="plain">
            {top.map((c) => (
              <li key={c.slug}>
                <Link href={`/${c.slug}?filtr=cennik#lista`}>Biura nieruchomości {inCity(c.name)} z jawnym cennikiem</Link>:{" "}
                {c.withPrices} z {nBiurGen(c.firms)}
              </li>
            ))}
          </ul>
        </>
      )}
      <p>
        Średnie stawki w miastach: raport <Link href="/raporty/prowizje-biur-nieruchomosci-2026">Prowizje biur nieruchomości 2026</Link>.
        Jak czytać prowizję: <Link href="/poradnik/ile-bierze-biuro-nieruchomosci">ile bierze biuro nieruchomości</Link>.
      </p>
    </PublicShell>
  );
}
