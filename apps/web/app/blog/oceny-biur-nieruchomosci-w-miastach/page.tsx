import type { Metadata } from "next";
import Link from "next/link";

import { BlogArticle, Faq, ShareBar, ShortAnswer, faqLd } from "@/components/BlogArticle";
import { blogPath, fmtInt, fmtRating, fmtShare, getPost } from "@/lib/blog";
import { CITY_COMPARE_MIN, MIN_REVIEWS, SAME_RATING, loadBlogData, ratingLeague, ratingOverview } from "@/lib/blog-stats";
import { inCity } from "@/lib/cities";
import { nBiur, nMiast, nOpinii, nOpiniami } from "@/lib/plural";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 86400;

const post = getPost("oceny-biur-nieruchomosci-w-miastach");
/** Miasto "duże" w tym artykule: tyle firm w katalogu. */
const BIG = 30;

export const metadata: Metadata = pageMetadata({ title: post.title, description: post.description, path: blogPath(post.slug), type: "article" });

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

export default async function CityRatingsPost() {
  const data = await loadBlogData().catch(() => null);
  const league = data ? ratingLeague(data.cities) : [];
  const all = data ? ratingOverview(data.firms) : null;
  const best = league[0];
  const worst = league[league.length - 1];
  const big = league.filter((c) => c.firms >= BIG);
  const rest = league.filter((c) => c.firms < BIG);
  const bigMean = mean(big.map((c) => c.avgRating as number));
  const restMean = mean(rest.map((c) => c.avgRating as number));
  const diff = bigMean != null && restMean != null ? bigMean - restMean : null;
  const verdict = diff == null ? null : Math.abs(diff) < SAME_RATING ? "podobna jak" : diff < 0 ? "niższa niż" : "wyższa niż";
  const faq = [
    {
      q: "Jak liczymy średnią ocenę biur w mieście?",
      a: `Bierzemy oceny Google biur z katalogu, które mają co najmniej ${nOpinii(MIN_REVIEWS)}. Każde biuro liczy się raz, w mieście swojego głównego wpisu. Średnia to zwykła średnia ocen biur, a nie średnia ważona liczbą opinii.`,
    },
    {
      q: "Dlaczego mojego miasta nie ma w tabeli?",
      a: `Miasto pokazujemy, gdy co najmniej ${nBiur(CITY_COMPARE_MIN)} w mieście ma co najmniej ${nOpinii(MIN_REVIEWS)}. Przy mniejszej liczbie biur jedno biuro zmienia wynik całego miasta. Listę biur w każdym mieście znajdziesz na stronie Miasta.`,
      node: (
        <>
          Miasto pokazujemy, gdy co najmniej {nBiur(CITY_COMPARE_MIN)} w mieście ma co najmniej {nOpinii(MIN_REVIEWS)}. Przy
          mniejszej liczbie biur jedno biuro zmienia wynik całego miasta. Listę biur w każdym mieście znajdziesz na stronie{" "}
          <Link href="/miasta">Miasta</Link>.
        </>
      ),
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
          {fmtRating(worst.avgRating)}). Porównaliśmy {nMiast(league.length)}, w których co najmniej {nBiur(CITY_COMPARE_MIN)}{" "}
          ma co najmniej {nOpinii(MIN_REVIEWS)}. Dla porównania: średnia wszystkich biur z katalogu z co najmniej{" "}
          {nOpiniami(MIN_REVIEWS)}, liczona tak jak w tabeli, to {fmtRating(all.avgRatingSolid)}.
        </ShortAnswer>
      ) : (
        <p>Zestawienie jest w przygotowaniu.</p>
      )}

      {league.length > 0 && (
        <>
          <h2>Ranking miast według ocen biur nieruchomości</h2>
          <p className="note">
            Miasta, w których co najmniej {nBiur(CITY_COMPARE_MIN)} ma co najmniej {nOpinii(MIN_REVIEWS)} w Google, od
            najwyższej średniej. „Biura w próbie” i „Opinie” dotyczą tylko tych biur. Kliknij miasto, żeby zobaczyć ranking biur.
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
                  <th className="num">Opinie biur z próby</th>
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
                    <td className="num">{fmtInt(c.ratedReviews)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {big.length >= 2 && rest.length >= 2 && verdict && (
        <>
          <h2>Miasta z największym wyborem biur</h2>
          <p>
            W miastach, w których mamy w katalogu co najmniej {BIG} biur ({big.map((c) => c.name).join(", ")}), średnia ocena (
            {fmtRating(bigMean)}) jest {verdict} w pozostałych miastach zestawienia ({fmtRating(restMean)}). Najlepiej z nich
            wypada {big[0].name} ({fmtRating(big[0].avgRating)}), najsłabiej {big[big.length - 1].name} (
            {fmtRating(big[big.length - 1].avgRating)}). Duży wybór oznacza, że warto porównać kilka biur, a nie kierować się
            średnią miasta.
          </p>
        </>
      )}

      <h2>Jak czytać to zestawienie</h2>
      <ul className="plain">
        <li>
          Liczymy tylko biura z co najmniej {nOpiniami(MIN_REVIEWS)}. Ocena 5,0 z trzech opinii mówi mało, więcej o tym w
          artykule{" "}
          <Link href={blogPath("ocena-5-w-google-biuro-nieruchomosci")}>czy ocena 5,0 oznacza najlepsze biuro</Link>.
        </li>
        <li>Biuro działające w kilku miastach liczymy raz, w mieście jego głównego wpisu.</li>
        {all && all.weightedRating != null && all.avgRatingSolid != null && (
          <li>
            Średnia ważona liczbą opinii (jak ocenia biura przeciętny klient, a nie przeciętne biuro) wynosi dla całego
            katalogu {fmtRating(all.weightedRating)}.
            {all.weightedRating - all.avgRatingSolid >= SAME_RATING
              ? " Jest wyższa od zwykłej średniej, bo biura z dużą liczbą opinii mają zwykle wysokie oceny."
              : all.avgRatingSolid - all.weightedRating >= SAME_RATING
                ? " Jest niższa od zwykłej średniej, bo biura z dużą liczbą opinii mają zwykle nieco niższe oceny."
                : " To prawie tyle samo co zwykła średnia."}
          </li>
        )}
        <li>
          Oceny pochodzą z profili firm w Google. Aktualizujemy je stopniowo, więc ocena konkretnego biura może być sprzed
          kilku tygodni.
        </li>
        <li>
          Ocena Google to tylko jeden z czynników. Nasz ranking biur bierze pod uwagę także rejestr, staż, cennik i oferty.
          Zasady opisujemy w <Link href="/metodologia">metodologii</Link>.
        </li>
      </ul>

      <Faq items={faq} />
    </BlogArticle>
  );
}
