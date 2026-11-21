import type { Metadata } from "next";
import Link from "next/link";

import { BlogArticle, Faq, ShortAnswer, faqLd } from "@/components/BlogArticle";
import { CommissionCalculator } from "@/components/CommissionCalculator";
import { blogPath, fmtPln, fmtRate, fmtShare, getPost } from "@/lib/blog";
import { loadRates, saleVatStats } from "@/lib/blog-stats";
import { commissionReport } from "@/lib/catalog";
import { nBiurGen } from "@/lib/plural";
import { PRICE_STAT_MIN } from "@/lib/ranking";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 86400;

const post = getPost("sprzedaz-mieszkania-z-biurem-czy-samemu");
const EXAMPLE = 600000;

export const metadata: Metadata = pageMetadata({ title: post.title, description: post.description, path: blogPath(post.slug), type: "article" });

export default async function SellWithAgentPost() {
  const [report, rates] = await Promise.all([commissionReport().catch(() => null), loadRates().catch(() => [])]);
  const has = report != null && report.n >= PRICE_STAT_MIN && report.median != null;
  const vat = saleVatStats(rates);
  const fee = has ? (EXAMPLE * (report.median as number)) / 100 : null;
  const faq = [
    {
      q: "Ile kosztuje pośrednik przy sprzedaży mieszkania?",
      a: has
        ? `Według cenników ${nBiurGen(report.n)} z naszego katalogu typowa prowizja za sprzedaż to ${fmtRate(report.median)} ceny, a połowa biur bierze od ${fmtRate(report.p25)} do ${fmtRate(report.p75)}. Przy mieszkaniu za ${fmtPln(EXAMPLE)} to około ${fmtPln(fee)} plus ewentualny VAT.`
        : "Biura zwykle biorą procent ceny sprzedaży. Dokładna stawka wynika z umowy pośrednictwa.",
    },
    {
      q: "Czy prowizję pośrednika można negocjować?",
      a: "Tak. Stawka z cennika to punkt wyjścia. Łatwiej o niższą stawkę przy umowie na wyłączność, droższym mieszkaniu albo gdy biuro nie musi robić sesji zdjęciowej i reklam od zera.",
    },
    {
      q: "Kiedy płaci się prowizję biuru nieruchomości?",
      a: "Moment zapłaty określa umowa pośrednictwa. Najczęściej jest to dzień umowy sprzedaży u notariusza, czasem umowy przedwstępnej.",
    },
    {
      q: "Czy prowizja biura obniża podatek od sprzedaży mieszkania?",
      a: "Jeśli sprzedajesz mieszkanie przed upływem pięciu lat od końca roku zakupu, prowizja pośrednika jest kosztem odpłatnego zbycia i zmniejsza dochód do opodatkowania. Zachowaj fakturę lub rachunek od biura.",
    },
  ];
  return (
    <BlogArticle post={post} extraLd={[faqLd(faq)]}>
      <ShortAnswer>
        Z biurem płacisz prowizję, ale oszczędzasz czas i ryzyko błędów w dokumentach.
        {has
          ? ` Typowe biuro z naszego katalogu bierze ${fmtRate(report.median)} ceny sprzedaży (połowa biur: ${fmtRate(report.p25)}-${fmtRate(report.p75)}), czyli przy mieszkaniu za ${fmtPln(EXAMPLE)} około ${fmtPln(fee)} bez VAT.`
          : ""}{" "}
        Samemu warto sprzedawać, gdy masz kupca z polecenia, czas na prezentacje i komplet dokumentów. Policz swój koszt w
        kalkulatorze poniżej.
      </ShortAnswer>

      <h2>Kalkulator prowizji pośrednika</h2>
      <p>
        Wpisz cenę, za którą chcesz sprzedać mieszkanie. Stawki w tabeli pochodzą z cenników biur na ich stronach
        {has ? ` (${nBiurGen(report.n)} z katalogu)` : ""}. Jeśli masz już ofertę od biura, wpisz jego stawkę.
      </p>
      <CommissionCalculator median={report?.median ?? null} p25={report?.p25 ?? null} p75={report?.p75 ?? null} defaultPrice={EXAMPLE} />
      {vat.n >= PRICE_STAT_MIN && (
        <p className="note">
          Netto czy brutto? {fmtShare((100 * vat.plusVat) / vat.n)} biur z cennikiem podaje stawkę netto albo z
          dopiskiem „+ VAT”, {fmtShare((100 * vat.gross) / vat.n)} brutto, a {fmtShare((100 * vat.unknown) / vat.n)} nie
          pisze tego wprost. Zapytaj o to przed podpisaniem umowy: 23% VAT to przy {fmtPln(EXAMPLE)} i stawce{" "}
          {has ? fmtRate(report.median) : "2%"} kilka tysięcy złotych różnicy.
        </p>
      )}

      <h2>Co robi biuro w ramach prowizji</h2>
      <ul className="plain">
        <li>Wycena i ustalenie ceny ofertowej na podstawie transakcji z okolicy.</li>
        <li>Zdjęcia, opis, czasem film lub wirtualny spacer, publikacja na portalach i w bazie biura.</li>
        <li>Odbieranie telefonów, selekcja zainteresowanych i prezentacje mieszkania.</li>
        <li>Negocjacje ceny i warunków z kupującym.</li>
        <li>Skompletowanie dokumentów (zaświadczenia ze spółdzielni lub wspólnoty, księga wieczysta, brak zameldowań).</li>
        <li>Przygotowanie umowy przedwstępnej i umówienie notariusza, pomoc przy kredycie kupującego.</li>
      </ul>

      <h2>Kiedy sprzedać samemu, a kiedy z biurem</h2>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Samodzielnie ma sens, gdy</th>
              <th>Biuro ma sens, gdy</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Masz kupca z polecenia albo z rodziny.</td>
              <td>Nie masz czasu na telefony i prezentacje.</td>
            </tr>
            <tr>
              <td>Mieszkanie jest typowe i łatwo je wycenić.</td>
              <td>Nieruchomość jest nietypowa (dom, działka, lokal z najemcą, spadek).</td>
            </tr>
            <tr>
              <td>Masz komplet dokumentów i stan prawny jest prosty.</td>
              <td>Są komplikacje: hipoteka, współwłaściciele, brak księgi wieczystej.</td>
            </tr>
            <tr>
              <td>Mieszkasz blisko i możesz pokazywać mieszkanie.</td>
              <td>Sprzedajesz z innego miasta albo z zagranicy.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Jak wybrać biuro do sprzedaży</h2>
      <ol>
        <li>
          Porównaj stawki co najmniej trzech biur. W katalogu włącz filtr „Jawny cennik” albo zajrzyj do listy{" "}
          <Link href="/poradnik/biura-z-jawnym-cennikiem">biur z jawnym cennikiem</Link>.
        </li>
        <li>
          Sprawdź opinie: liczbę i treść, nie tylko gwiazdki. Dlaczego, piszemy w artykule{" "}
          <Link href={blogPath("ocena-5-w-google-biuro-nieruchomosci")}>o ocenie 5,0 w Google</Link>.
        </li>
        <li>
          Sprawdź biuro w rejestrze i polisę OC pośrednika:{" "}
          <Link href="/poradnik/jak-sprawdzic-biuro-nieruchomosci">jak sprawdzić biuro nieruchomości</Link>.
        </li>
        <li>Przeczytaj umowę: wyłączność, okres obowiązywania, kiedy prowizja jest należna, kary umowne.</li>
      </ol>
      <p>
        Mediany prowizji w poszczególnych miastach są w raporcie{" "}
        <Link href="/raporty/prowizje-biur-nieruchomosci-2026">prowizje biur nieruchomości 2026</Link>. Jak liczy się
        prowizję krok po kroku, opisujemy w poradniku{" "}
        <Link href="/poradnik/ile-bierze-biuro-nieruchomosci">ile bierze biuro nieruchomości</Link>.
      </p>

      <Faq items={faq} />
    </BlogArticle>
  );
}
