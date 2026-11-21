import type { Metadata } from "next";
import Link from "next/link";

import { BlogArticle, Faq, ShortAnswer, faqLd } from "@/components/BlogArticle";
import { blogPath, fmtPln, fmtRate, getPost } from "@/lib/blog";
import { buyerStats, loadRates } from "@/lib/blog-stats";
import { commissionReport } from "@/lib/catalog";
import { nBiur, nBiurGen, plural } from "@/lib/plural";
import { PRICE_STAT_MIN } from "@/lib/ranking";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 86400;

const post = getPost("czy-kupujacy-placi-prowizje-biuru-nieruchomosci");
const EXAMPLE = 500000;

export const metadata: Metadata = pageMetadata({ title: post.title, description: post.description, path: blogPath(post.slug), type: "article" });

export default async function BuyerFeePost() {
  const [rates, report] = await Promise.all([loadRates().catch(() => []), commissionReport().catch(() => null)]);
  const buyer = buyerStats(rates);
  const paidOk = buyer.paid.n >= PRICE_STAT_MIN && buyer.paid.median != null;
  const fee = paidOk ? (EXAMPLE * (buyer.paid.median as number)) / 100 : null;
  const faq = [
    {
      q: "Czy muszę płacić prowizję, jeśli nie podpisałem umowy z biurem?",
      a: "Prowizja należy się na podstawie umowy pośrednictwa, która musi mieć formę pisemną albo elektroniczną. Jeśli nie zawarłeś umowy z biurem, nie masz wobec niego obowiązku zapłaty. Uważaj na dokumenty podpisywane przy oglądaniu mieszkania, bo karta prezentacji bywa częścią umowy.",
    },
    {
      q: "Kiedy kupujący płaci prowizję?",
      a: "Termin wynika z umowy. Zwykle jest to dzień podpisania umowy sprzedaży u notariusza, czasem już umowy przedwstępnej. Jeśli transakcja nie dojdzie do skutku, prowizja zwykle nie jest należna, chyba że umowa mówi inaczej.",
    },
    {
      q: "Czy można kupić mieszkanie bez prowizji?",
      a: "Tak. Część biur pobiera prowizję tylko od sprzedającego i pisze w ogłoszeniu „0% dla kupującego”. Możesz też szukać ofert bezpośrednio od właścicieli albo na rynku pierwotnym, gdzie deweloper zwykle sam płaci pośrednikowi.",
    },
    {
      q: "Czy prowizja dla kupującego wchodzi do kredytu?",
      a: "Zwykle nie. Bank finansuje cenę mieszkania, a prowizję, podatek PCC i opłaty notarialne kupujący pokrywa z własnych środków. Uwzględnij je, licząc wkład własny.",
    },
  ];
  return (
    <BlogArticle post={post} extraLd={[faqLd(faq)]}>
      <ShortAnswer>
        Kupujący płaci prowizję tylko wtedy, gdy podpisał umowę pośrednictwa z biurem. Wiele biur ma umowy z obiema
        stronami i bierze prowizję od sprzedającego i od kupującego, ale część biur pobiera ją tylko od sprzedającego.
        {buyer.brands >= PRICE_STAT_MIN
          ? ` W cennikach ${nBiurGen(buyer.brands)} z naszego katalogu, które piszą wprost o kupującym, ${nBiur(buyer.free)} ${plural(buyer.free, "podaje", "podają", "podaje")} 0% dla kupującego${paidOk ? `, a pozostałe biorą od kupującego typowo ${fmtRate(buyer.paid.median)} ceny` : ""}.`
          : ""}
      </ShortAnswer>

      <h2>Od czego zależy, czy kupujący płaci</h2>
      <ul className="plain">
        <li>
          <b>Od umowy.</b> Biuro może pobrać prowizję tylko od strony, z którą ma podpisaną umowę pośrednictwa. Umowa musi
          mieć formę pisemną albo elektroniczną.
        </li>
        <li>
          <b>Od modelu pracy biura.</b> Jedne biura pracują tylko dla sprzedającego (wtedy w ogłoszeniu jest „bez prowizji
          dla kupującego”), inne mają umowę z obiema stronami.
        </li>
        <li>
          <b>Od rynku.</b> Przy zakupie od dewelopera prowizję zwykle płaci deweloper. Przy rynku wtórnym częściej płacą
          obie strony.
        </li>
      </ul>

      <h2>Ile wynosi prowizja dla kupującego</h2>
      {paidOk ? (
        <p>
          W cennikach, które podają osobną stawkę dla kupującego, mediana to {fmtRate(buyer.paid.median)} ceny, a połowa
          biur bierze od {fmtRate(buyer.paid.p25)} do {fmtRate(buyer.paid.p75)} (próba: {nBiurGen(buyer.paid.n)}). Przy
          mieszkaniu za {fmtPln(EXAMPLE)} to około {fmtPln(fee)}, a jeśli stawka jest netto, dochodzi 23% VAT.
        </p>
      ) : (
        <p>
          Biura rzadko podają w cenniku osobną stawkę dla kupującego. Zwykle jest to podobny procent ceny jak dla
          sprzedającego.
          {report && report.median != null
            ? ` Typowa stawka za sprzedaż w naszym katalogu to ${fmtRate(report.median)}.`
            : ""}
        </p>
      )}
      <p>
        Do prowizji dolicz pozostałe koszty zakupu na rynku wtórnym: podatek PCC (2% ceny, z wyjątkami dla pierwszego
        mieszkania), taksę notarialną i opłaty sądowe za wpis do księgi wieczystej.
      </p>

      <h2>Na co uważać jako kupujący</h2>
      <ol>
        <li>Zapytaj biuro przed pierwszą prezentacją, czy bierze prowizję od kupującego i ile.</li>
        <li>Czytaj każdy dokument przed podpisem. Karta prezentacji lub „potwierdzenie oglądania” może być umową.</li>
        <li>Sprawdź, czy stawka jest netto czy brutto i od jakiej kwoty się ją liczy.</li>
        <li>Ustal, kiedy prowizja jest należna i co się dzieje, gdy bank odmówi kredytu.</li>
        <li>
          Sprawdź biuro: wpis w rejestrze, polisę OC, opinie.{" "}
          <Link href="/poradnik/jak-sprawdzic-biuro-nieruchomosci">Jak sprawdzić biuro nieruchomości</Link>.
        </li>
      </ol>
      <p>
        Przepisy o pośrednictwie mogą się zmieniać, w 2026 roku trwają prace nad ograniczeniem pobierania prowizji od obu
        stron transakcji. Przed podpisaniem umowy sprawdź aktualny stan prawny.
      </p>
      <p>
        Szukasz biura, które podaje stawki na stronie? Zobacz{" "}
        <Link href="/poradnik/biura-z-jawnym-cennikiem">biura z jawnym cennikiem</Link> albo{" "}
        <Link href="/raporty/prowizje-biur-nieruchomosci-2026">mediany prowizji w miastach</Link>.
      </p>

      <Faq items={faq} />
    </BlogArticle>
  );
}
