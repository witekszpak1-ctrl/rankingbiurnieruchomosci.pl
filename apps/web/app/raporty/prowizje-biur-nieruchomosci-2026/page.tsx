import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd, PublicShell } from "@/components/SiteChrome";
import { commissionReport } from "@/lib/catalog";
import { absoluteUrl, formatDate } from "@/lib/format";
import { nBiur, nBiurGen } from "@/lib/plural";
import { PRICE_STAT_MIN } from "@/lib/ranking";
import { articleLd, organizationLd, pageMetadata } from "@/lib/seo";

export const revalidate = 86400;

const PATH = "/raporty/prowizje-biur-nieruchomosci-2026";
const maxDate = (a: string, b: string) => (b > a ? b : a);
const pct = (v: number | null) => (v == null ? "-" : `${v.toLocaleString("pl-PL", { maximumFractionDigits: 2 })}%`);

export const metadata: Metadata = pageMetadata({
  title: "Prowizje biur nieruchomości 2026: raport z cenników biur według miast",
  description:
    "Ile biorą biura nieruchomości za sprzedaż w 2026 roku: mediana prowizji w Polsce i w miastach, udział biur z jawnym cennikiem, liczba biur w próbie i sposób liczenia.",
  path: PATH,
  type: "article",
});

export default async function CommissionReportPage() {
  const r = await commissionReport().catch(() => null);
  const cities = (r?.cities ?? []).filter((c) => c.n >= PRICE_STAT_MIN);
  const share = r && r.firms > 0 ? Math.round((100 * r.withPrices) / r.firms) : null;
  const dataDate = r?.observedAt ? formatDate(r.observedAt) : formatDate(new Date());
  return (
    <PublicShell>
      <JsonLd
        data={articleLd({
            headline: "Prowizje biur nieruchomości 2026",
            path: PATH,
            description: typeof metadata.description === "string" ? metadata.description : null,
            datePublished: "2026-11-14",
            dateModified: (r?.observedAt ?? new Date()).toISOString().slice(0, 10),
          })}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Dataset",
          name: "Prowizje biur nieruchomości za sprzedaż w miastach Polski (2026)",
          description:
            "Mediana najniższej procentowej prowizji za sprzedaż nieruchomości deklarowanej przez biura na ich stronach, według miast.",
          url: absoluteUrl(PATH),
          creator: organizationLd(),
          datePublished: "2026-11-14",
          dateModified: maxDate("2026-11-14", (r?.observedAt ?? new Date()).toISOString().slice(0, 10)),
          inLanguage: "pl-PL",
          isAccessibleForFree: true,
          keywords: ["prowizja biura nieruchomości", "cennik biura nieruchomości", "rynek nieruchomości", "Polska"],
          spatialCoverage: { "@type": "Country", name: "Polska" },
          temporalCoverage: "2026",
          variableMeasured: ["mediana prowizji za sprzedaż (%)", "liczba biur w próbie", "udział biur z jawnym cennikiem"],
        }}
      />
      <p className="crumbs">
        <Link href="/">Strona główna</Link> / Raporty / Prowizje biur nieruchomości 2026
      </p>
      <h1>Prowizje biur nieruchomości 2026</h1>
      {r && r.n > 0 ? (
        <div className="answer">
          <strong>W skrócie</strong>
          <p>
            Mediana prowizji za sprzedaż, którą biura nieruchomości podają na swoich stronach, wynosi {pct(r.median)}.
            Połowa stawek mieści się między {pct(r.p25)} a {pct(r.p75)}. Raport opiera się na stawkach{" "}
            {nBiurGen(r.n)}. Cennik na stronie publikuje {r.withPrices} z {nBiurGen(r.firms)} w katalogu
            {share != null ? ` (${share}%)` : ""}. Dane według stron biur z dnia {dataDate}.
          </p>
        </div>
      ) : (
        <p>Raport jest w przygotowaniu.</p>
      )}

      {cities.length > 0 && (
        <>
          <h2>Prowizja za sprzedaż według miast</h2>
          <p className="note">
            Miasta, w których mamy stawki co najmniej {nBiurGen(PRICE_STAT_MIN)}. Kliknij miasto, żeby zobaczyć ranking i
            cenniki biur.
          </p>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Miasto</th>
                  <th className="num">Mediana prowizji</th>
                  <th className="num">Biura w próbie</th>
                  <th className="num">Biura w katalogu</th>
                  <th className="num">Z jawnym cennikiem</th>
                </tr>
              </thead>
              <tbody>
                {cities.map((c) => (
                  <tr key={c.slug}>
                    <td>
                      <Link href={`/${c.slug}`}>{c.name}</Link>
                    </td>
                    <td className="num">{pct(c.median)}</td>
                    <td className="num">{c.n}</td>
                    <td className="num">{c.firms}</td>
                    <td className="num">{c.firms > 0 ? `${Math.round((100 * c.withPrices) / c.firms)}%` : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2>Jak liczymy</h2>
      <ul className="plain">
        <li>Źródło: cenniki na stronach internetowych biur, zapisane z cytatem i datą pobrania.</li>
        <li>
          Z każdego biura bierzemy jedną stawkę: najniższą procentową prowizję za sprzedaż lub kupno nieruchomości. Opłaty
          za najem i zarządzanie najmem nie wchodzą do raportu.
        </li>
        <li>Pomijamy stawki spoza przedziału 0,5-10%, bo zwykle są błędnym odczytem.</li>
        <li>Biuro działające w kilku miastach liczymy raz, w mieście jego głównego wpisu.</li>
        <li>
          Stawki to ceny deklarowane przez biura, nie ceny transakcyjne. Biura podają je netto albo brutto, tak jak na
          stronie. Ostateczna prowizja wynika z umowy pośrednictwa.
        </li>
        <li>Raport odświeża się automatycznie raz na dobę. W katalogu jest teraz {nBiur(r?.firms ?? 0)}.</li>
      </ul>
      <p>
        Więcej: <Link href="/poradnik/ile-bierze-biuro-nieruchomosci">ile bierze biuro nieruchomości</Link>,{" "}
        <Link href="/poradnik/biura-z-jawnym-cennikiem">biura z jawnym cennikiem</Link>,{" "}
        <Link href="/metodologia">metodologia rankingu</Link>.
      </p>
    </PublicShell>
  );
}
