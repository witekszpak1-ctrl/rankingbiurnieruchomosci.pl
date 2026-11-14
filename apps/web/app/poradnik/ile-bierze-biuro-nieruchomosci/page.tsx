import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd, PublicShell } from "@/components/SiteChrome";
import { commissionReport } from "@/lib/catalog";
import { formatDate } from "@/lib/format";
import { nBiurGen } from "@/lib/plural";
import { articleLd, pageMetadata } from "@/lib/seo";

export const revalidate = 86400;

const PATH = "/poradnik/ile-bierze-biuro-nieruchomosci";
const pct = (v: number | null) => (v == null ? "-" : `${v.toLocaleString("pl-PL", { maximumFractionDigits: 2 })}%`);

export const metadata: Metadata = pageMetadata({
  title: "Ile bierze biuro nieruchomości za sprzedaż mieszkania? Prowizja w 2026",
  description:
    "Ile wynosi prowizja biura nieruchomości za sprzedaż mieszkania, kto ją płaci, kiedy jest należna i na co uważać w umowie pośrednictwa. Liczby z cenników biur.",
  path: PATH,
  type: "article",
});

export default async function HowMuchGuide() {
  const r = await commissionReport().catch(() => null);
  const example = 600000;
  const fee = r?.median != null ? Math.round((example * r.median) / 100) : null;
  return (
    <PublicShell>
      <JsonLd
        data={articleLd({
            headline: "Ile bierze biuro nieruchomości za sprzedaż mieszkania",
            path: PATH,
            description: typeof metadata.description === "string" ? metadata.description : null,
            datePublished: "2026-11-14",
            dateModified: "2026-11-14",
          })}
      />
      <p className="crumbs">
        <Link href="/">Strona główna</Link> / Poradnik
      </p>
      <h1>Ile bierze biuro nieruchomości za sprzedaż mieszkania?</h1>
      <div className="answer">
        <strong>W skrócie</strong>
        <p>
          Biura najczęściej liczą prowizję jako procent ceny sprzedaży.
          {r && r.n > 0
            ? ` Według cenników ${nBiurGen(r.n)} z naszego katalogu mediana wynosi ${pct(r.median)}, a połowa stawek mieści się między ${pct(r.p25)} a ${pct(r.p75)} (stan na ${r.observedAt ? formatDate(r.observedAt) : "dziś"}).`
            : ""}{" "}
          Do stawki może dojść VAT, a ostateczna kwota wynika z umowy pośrednictwa.
        </p>
      </div>

      <h2>Jak liczy się prowizję</h2>
      <p>
        Prowizja to zwykle procent ceny, za którą nieruchomość zostanie sprzedana. Część biur ma kwotę minimalną, a część
        podaje stałą opłatę zamiast procentu.
        {fee != null
          ? ` Przy mieszkaniu za ${example.toLocaleString("pl-PL")} zł i stawce ${pct(r?.median ?? null)} prowizja wyniesie około ${fee.toLocaleString("pl-PL")} zł, a jeśli biuro jest płatnikiem VAT i podało stawkę netto, do tej kwoty dochodzi 23% VAT.`
          : ""}
      </p>

      <h2>Kto płaci prowizję</h2>
      <p>
        Płaci strona, która podpisała umowę pośrednictwa. Przy sprzedaży zwykle jest to sprzedający, ale biuro może mieć
        umowę także z kupującym i wtedy pobiera prowizję od obu stron. Zapytaj o to przed podpisaniem umowy i sprawdź, czy
        w ogłoszeniu jest informacja „bez prowizji dla kupującego”.
      </p>

      <h2>Kiedy prowizja jest należna</h2>
      <p>
        Moment zapłaty określa umowa. Najczęściej jest to dzień podpisania umowy sprzedaży u notariusza, czasem już umowy
        przedwstępnej. Sprawdź też, co dzieje się, gdy sprzedasz mieszkanie samodzielnie w czasie trwania umowy: przy
        umowie na wyłączność prowizja zwykle należy się wtedy biuru.
      </p>

      <h2>Na co uważać w umowie pośrednictwa</h2>
      <ul className="plain">
        <li>Czy stawka jest netto czy brutto i od jakiej kwoty się ją liczy.</li>
        <li>Czy umowa jest na wyłączność i na jak długo, jak ją wypowiedzieć.</li>
        <li>Kiedy prowizja jest należna i czy obowiązuje po wygaśnięciu umowy (dla klientów przedstawionych przez biuro).</li>
        <li>Co biuro robi w ramach prowizji: zdjęcia, ogłoszenia, prezentacje, pomoc w dokumentach.</li>
        <li>
          Umowa pośrednictwa musi mieć formę pisemną albo elektroniczną, a pośrednik musi mieć ubezpieczenie OC. Więcej:{" "}
          <Link href="/poradnik/jak-sprawdzic-biuro-nieruchomosci">jak sprawdzić biuro nieruchomości</Link>.
        </li>
      </ul>

      <h2>Gdzie porównać stawki</h2>
      <p>
        Mediany prowizji w poszczególnych miastach są w raporcie{" "}
        <Link href="/raporty/prowizje-biur-nieruchomosci-2026">Prowizje biur nieruchomości 2026</Link>. Biura, które podają
        ceny na stronie, znajdziesz w poradniku <Link href="/poradnik/biura-z-jawnym-cennikiem">biura z jawnym cennikiem</Link>.
        Na stronie każdego miasta możesz też włączyć filtr „Jawny cennik”.
      </p>
    </PublicShell>
  );
}
