import type { Metadata } from "next";
import Link from "next/link";

import { BlogArticle, Faq, ShortAnswer, faqLd } from "@/components/BlogArticle";
import { blogPath, fmtPln, fmtRate, getPost } from "@/lib/blog";
import { loadRates, managementStats, rentBrokerageStats } from "@/lib/blog-stats";
import { nBiurGen } from "@/lib/plural";
import { PRICE_STAT_MIN } from "@/lib/ranking";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 86400;

const post = getPost("prowizja-za-wynajem-mieszkania");
const RENT = 3000;

export const metadata: Metadata = pageMetadata({ title: post.title, description: post.description, path: blogPath(post.slug), type: "article" });

export default async function RentFeePost() {
  const rates = await loadRates().catch(() => []);
  const rent = rentBrokerageStats(rates);
  const mgmt = managementStats(rates);
  const rentOk = rent.n >= PRICE_STAT_MIN && rent.median != null;
  const mgmtOk = mgmt.n >= PRICE_STAT_MIN && mgmt.median != null;
  const faq = [
    {
      q: "Kto płaci prowizję za wynajem mieszkania: właściciel czy najemca?",
      a: "Płaci strona, która podpisała umowę pośrednictwa z biurem. Często płaci najemca, czasem właściciel, a niektóre biura biorą prowizję od obu stron. Zapytaj o to, zanim umówisz się na oglądanie.",
    },
    {
      q: "Czy prowizja za wynajem jest zwrotna?",
      a: "Zwykle nie. Prowizja jest wynagrodzeniem za doprowadzenie do podpisania umowy najmu i nie wraca po wyprowadzce, w przeciwieństwie do kaucji.",
    },
    {
      q: "Czy prowizję za wynajem można negocjować?",
      a: "Tak, szczególnie przy dłuższej umowie najmu albo poza sezonem akademickim, gdy biura mają mniej chętnych.",
    },
  ];
  return (
    <BlogArticle post={post} extraLd={[faqLd(faq)]}>
      <ShortAnswer>
        Prowizja za wynajem mieszkania to zwykle część albo całość jednego miesięcznego czynszu. Płaci ją strona, która
        podpisała umowę z biurem: najczęściej najemca, czasem właściciel albo obie strony.
        {rentOk
          ? ` W cennikach ${nBiurGen(rent.n)} z naszego katalogu mediana to ${fmtRate(rent.median)} czynszu, czyli przy czynszu ${fmtPln(RENT)} około ${fmtPln((RENT * (rent.median as number)) / 100)}.`
          : ""}
      </ShortAnswer>

      <h2>Ile biura biorą za wynajem</h2>
      {rentOk ? (
        <>
          <p>
            Połowa biur, które podają stawkę za najem procentowo, bierze od {fmtRate(rent.p25)} do {fmtRate(rent.p75)}{" "}
            miesięcznego czynszu (najniżej {fmtRate(rent.min)}, najwyżej {fmtRate(rent.max)}). Część biur podaje kwotę
            stałą albo minimalną, takich stawek nie ma w tym zestawieniu.
          </p>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Czynsz miesięczny</th>
                  <th className="num">Prowizja przy {fmtRate(rent.p25)}</th>
                  <th className="num">Przy medianie {fmtRate(rent.median)}</th>
                  <th className="num">Przy {fmtRate(rent.p75)}</th>
                </tr>
              </thead>
              <tbody>
                {[2000, 3000, 4000, 6000].map((r) => (
                  <tr key={r}>
                    <td>{fmtPln(r)}</td>
                    <td className="num">{fmtPln((r * (rent.p25 as number)) / 100)}</td>
                    <td className="num">{fmtPln((r * (rent.median as number)) / 100)}</td>
                    <td className="num">{fmtPln((r * (rent.p75 as number)) / 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note">Kwoty bez VAT. Jeśli biuro podaje stawkę netto, dolicz 23%.</p>
        </>
      ) : (
        <p>
          Najczęściej spotykane stawki to 50% albo 100% miesięcznego czynszu. Część biur ma kwotę minimalną. Stawki z
          cenników biur pokażemy tutaj, gdy zbierzemy je od co najmniej {nBiurGen(PRICE_STAT_MIN)}.
        </p>
      )}

      <h2>Ile kosztuje wejście w najem</h2>
      <p>
        Przy podpisaniu umowy zwykle płacisz naraz: pierwszy czynsz, kaucję (najczęściej jeden lub dwa czynsze) i
        prowizję biura. Przy czynszu {fmtPln(RENT)} i kaucji w wysokości jednego czynszu to{" "}
        {rentOk
          ? `około ${fmtPln(RENT * 2 + (RENT * (rent.median as number)) / 100)}`
          : `około ${fmtPln(RENT * 2)} plus prowizja`}
        . Przy najmie okazjonalnym dochodzi koszt oświadczenia u notariusza.
      </p>

      <h2>Zarządzanie najmem: ile to kosztuje właściciela</h2>
      {mgmtOk ? (
        <p>
          Biura, które zarządzają mieszkaniem na wynajem (szukanie najemców, rozliczenia, usterki, kontakt z najemcą),
          biorą miesięcznie procent czynszu. Mediana z cenników {nBiurGen(mgmt.n)} to {fmtRate(mgmt.median)} czynszu
          (połowa biur: {fmtRate(mgmt.p25)}-{fmtRate(mgmt.p75)}). Przy czynszu {fmtPln(RENT)} to około{" "}
          {fmtPln((RENT * (mgmt.median as number)) / 100)} miesięcznie.
        </p>
      ) : (
        <p>
          Biura, które zarządzają mieszkaniem na wynajem, zwykle biorą miesięcznie procent czynszu albo stałą kwotę.
          Część dolicza opłatę za znalezienie najemcy.
        </p>
      )}

      <h2>Na co uważać przy wynajmie przez biuro</h2>
      <ol>
        <li>Zapytaj o prowizję i o to, kto ją płaci, zanim umówisz się na oglądanie.</li>
        <li>Nie płać niczego przed obejrzeniem mieszkania i przed podpisaniem umowy.</li>
        <li>Sprawdź, czy osoba z biura ma pełnomocnictwo właściciela albo umowę z nim.</li>
        <li>
          Sprawdź biuro w rejestrze i w opiniach:{" "}
          <Link href="/poradnik/jak-sprawdzic-biuro-nieruchomosci">jak sprawdzić biuro nieruchomości</Link>.
        </li>
        <li>Zrób protokół zdawczo-odbiorczy ze zdjęciami i stanem liczników.</li>
      </ol>
      <p>
        Biura z cennikiem na stronie znajdziesz w zestawieniu{" "}
        <Link href="/poradnik/biura-z-jawnym-cennikiem">biura z jawnym cennikiem</Link>, a na stronie każdego miasta
        możesz filtrować biura po usłudze najmu.
      </p>

      <Faq items={faq} />
    </BlogArticle>
  );
}
