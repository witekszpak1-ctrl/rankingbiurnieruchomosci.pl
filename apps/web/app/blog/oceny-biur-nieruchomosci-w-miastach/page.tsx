import type { Metadata } from "next";
import Link from "next/link";

import { BlogArticle, Faq, ShareBar, ShortAnswer, faqLd } from "@/components/BlogArticle";
import { blogPath, fmtInt, fmtRating, fmtShare, getPost } from "@/lib/blog";
import { CITY_COMPARE_MIN, MIN_REVIEWS, loadBlogData, ratingLeague, ratingOverview } from "@/lib/blog-stats";
import { inCity } from "@/lib/cities";
import { nBiur, nBiurGen, nMiast, nOpinii } from "@/lib/plural";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 86400;

const post = getPost("oceny-biur-nieruchomosci-w-miastach");

export const metadata: Metadata = pageMetadata({ title: post.title, description: post.description, path: blogPath(post.slug), type: "article" });

export default async function CityRatingsPost() {
  const data = await loadBlogData().catch(() => null);
  const league = data ? ratingLeague(data.cities) : [];
  const all = data ? ratingOverview(data.firms) : null;
  const best = league[0];
  const worst = league[league.length - 1];
  const big = league.filter((c) => c.firms >= 30);
  const faq = [
    {
      q: "Jak liczymy średnią ocenę biur w mieście?",
      a: `Bierzemy oceny Google biur z katalogu, które mają co najmniej ${nOpinii(MIN_REVIEWS)}. Każde biuro liczy się raz, w mieście swojego głównego wpisu. Średnia to zwykła średnia ocen biur, a nie średnia ważona liczbą opinii.`,
    },
    {
      q: "Dlaczego mojego miasta nie ma w tabeli?",
      a: `Miasto pokazujemy, gdy ma co najmniej ${nBiur(CITY_COMPARE_MIN)} z oceną od ${nOpinii(MIN_REVIEWS)}. Przy mniejszej liczbie biur jedno biuro zmienia wynik całego miasta. Listę biur w każdym mieście znajdziesz na stronie Miasta.`,
    },
    {
      q: "Czy wysoka średnia w mieście oznacza, że każde biuro jest dobre?",
      a: "Nie. Średnia mówi o rynku, a nie o konkretnej firmie. Przed podpisaniem umowy sprawdź samo biuro: liczbę i treść opinii, wpis w rejestrze, staż i cennik.",
    },
  ];
  return (
    <BlogArticle post={post} extraLd={[faqLd(faq)]}>
      {best && worst && all ? (
        <ShortAnswer>
          Najwyżej oceniane biura nieruchomości są {inCity(best.name)}: średnia ocena Google {fmtRating(best.avgRating)}, a{" "}
          {fmtShare(best.share48)} biur ma ocenę 4,8 lub wyższą. Najniższą średnią w zestawieniu ma {worst.name} (
          {fmtRating(worst.avgRating)}). Porównaliśmy {nMiast(league.length)}, w których co najmniej{" "}
          {nBiur(CITY_COMPARE_MIN)} ma od {nOpinii(MIN_REVIEWS)}. W całym katalogu ocenę Google ma {nBiur(all.rated)}, a średnia ważona liczbą opinii wynosi {fmtRating(all.weightedRating)}.
        </ShortAnswer>
      ) : (
        <p>Zestawienie jest w przygotowaniu.</p>
      )}

      {league.length > 0 && (
        <>
          <h2>Ranking miast według ocen biur nieruchomości</h2>
          <p className="note">
            Miasta z co najmniej {nBiurGen(CITY_COMPARE_MIN)} z oceną od {nOpinii(MIN_REVIEWS)}, od najwyższej średniej.
            Kliknij miasto, żeby zobaczyć ranking biur.
          </p>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th className="num">#</th>
                  <th>Miasto</th>
                  <th className="num">Średnia ocena</th>
                  <th>Biura z oceną 4,8+</th>
                  <th className="num">Biura w próbie</th>
                  <th className="num">Opinie łącznie</th>
                </tr>
              </thead>
              <tbody>
                {league.map((c, i) => (
                  <tr key={c.slug}>
                    <td className="num">{i + 1}</td>
                    <td>
                      <Link href={`/${c.slug}`}>{c.name}</Link>
                    </td>
                    <td className="num">{fmtRating(c.avgRating)}</td>
                    <td>
                      <ShareBar value={c.share48} />
                    </td>
                    <td className="num">{c.rated}</td>
                    <td className="num">{fmtInt(c.reviews)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {big.length >= 2 && (
        <>
          <h2>Duże miasta: więcej biur, większy rozrzut</h2>
          <p>
            W miastach z co najmniej trzydziestoma biurami w katalogu ({big.map((c) => c.name).join(", ")}) wybór jest
            duży, ale średnia ocena jest zwykle niższa niż w mniejszych miastach. Najlepiej z dużych miast wypada{" "}
            {big[0].name} ({fmtRating(big[0].avgRating)}), najsłabiej {big[big.length - 1].name} (
            {fmtRating(big[big.length - 1].avgRating)}). W dużym mieście łatwiej trafić na biuro z wieloma opiniami, więc
            ocena jest bardziej miarodajna, ale też częściej trafiają się słabsze firmy.
          </p>
        </>
      )}

      <h2>Jak czytać to zestawienie</h2>
      <ul className="plain">
        <li>
          Liczymy tylko biura z co najmniej {nOpinii(MIN_REVIEWS)}. Ocena 5,0 z trzech opinii mówi mało, więcej o tym w
          artykule{" "}
          <Link href={blogPath("ocena-5-w-google-biuro-nieruchomosci")}>czy ocena 5,0 oznacza najlepsze biuro</Link>.
        </li>
        <li>Biuro działające w kilku miastach liczymy raz, w mieście jego głównego wpisu.</li>
        <li>Oceny pochodzą z profili firm w Google i odświeżają się codziennie razem z katalogiem.</li>
        <li>
          Ocena Google to tylko jeden z czynników. Nasz ranking biur bierze pod uwagę także rejestr, staż, cennik i oferty.
          Zasady opisujemy w <Link href="/metodologia">metodologii</Link>.
        </li>
      </ul>

      <Faq items={faq} />
    </BlogArticle>
  );
}
