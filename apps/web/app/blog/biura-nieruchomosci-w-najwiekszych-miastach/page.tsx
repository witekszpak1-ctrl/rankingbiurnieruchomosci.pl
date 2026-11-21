import type { Metadata } from "next";
import Link from "next/link";

import { BlogArticle, ShortAnswer } from "@/components/BlogArticle";
import { blogPath, fmtRate, fmtRating, fmtShare, fmtYears, getPost } from "@/lib/blog";
import { CITY_COMPARE_MIN, MIN_REVIEWS, SAME_RATING, YEARS_MIN, cityPairs, loadBlogData, type CityStats } from "@/lib/blog-stats";
import { inCity } from "@/lib/cities";
import { nBiur, nOpiniami, plural } from "@/lib/plural";
import { PRICE_STAT_MIN } from "@/lib/ranking";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 86400;

const post = getPost("biura-nieruchomosci-w-najwiekszych-miastach");
const TOP = 15;

export const metadata: Metadata = pageMetadata({ title: post.title, description: post.description, path: blogPath(post.slug), type: "article" });

/** Miasta z najwyższą wartością (remis przy tej samej liczbie po zaokrągleniu, jak w tabeli). */
function leaders(cities: CityStats[], value: (c: CityStats) => number | null, round: (v: number) => number): CityStats[] {
  const withValue = cities.filter((c) => value(c) != null);
  if (withValue.length === 0) return [];
  const max = Math.max(...withValue.map((c) => round(value(c) as number)));
  return withValue.filter((c) => round(value(c) as number) === max);
}

const names = (list: CityStats[]) => list.map((c) => inCity(c.name)).join(" i ");

export default async function BigCitiesPost() {
  const data = await loadBlogData().catch(() => null);
  const top = (data?.cities ?? []).slice(0, TOP);
  const pairs = data ? cityPairs(data.cities) : [];
  const [first, second, third] = top;
  const bestRated = leaders(
    top.filter((c) => c.rated >= CITY_COMPARE_MIN),
    (c) => c.avgRating,
    (v) => Math.round(v / SAME_RATING),
  );
  const oldest = leaders(
    top.filter((c) => c.withYears >= YEARS_MIN),
    (c) => c.medianYears,
    (v) => Math.floor(v),
  );
  const mostPrices = leaders(
    top.filter((c) => (c.sharePrices ?? 0) > 0),
    (c) => c.sharePrices,
    (v) => Math.round(v),
  );
  return (
    <BlogArticle post={post}>
      {first && second && third ? (
        <ShortAnswer>
          Najwięcej biur nieruchomości mamy w katalogu {inCity(first.name)} ({nBiur(first.firms)}), {inCity(second.name)} (
          {nBiur(second.firms)}) i {inCity(third.name)} ({nBiur(third.firms)}).
          {bestRated.length === 1
            ? ` Z ${top.length} miast w tabeli najwyżej oceniane biura ma ${bestRated[0].name} (średnio ${fmtRating(bestRated[0].avgRating)}).`
            : ""}
          {oldest.length > 0 && oldest.length <= 2
            ? ` Najdłużej działają biura ${names(oldest)}: mediana stażu w rejestrze to ${fmtYears(oldest[0].medianYears)}.`
            : ""}
          {mostPrices.length > 0 && mostPrices.length <= 2
            ? ` Cennik na stronie najczęściej publikują biura ${names(mostPrices)} (${mostPrices.length > 1 ? "po " : ""}${fmtShare(mostPrices[0].sharePrices)}).`
            : ""}
        </ShortAnswer>
      ) : (
        <p>Zestawienie jest w przygotowaniu.</p>
      )}

      {top.length > 0 && (
        <>
          <h2>{top.length} miast z największą liczbą biur w katalogu</h2>
          <ul className="plain note">
            <li>
              Liczba biur to biura w naszym katalogu (z własną stroną internetową), a nie wszystkie biura działające w mieście.
              Firmę z oddziałami liczymy raz, w mieście jej głównego wpisu.
            </li>
            <li>
              Ocena: średnia biur z co najmniej {nOpiniami(MIN_REVIEWS)} Google. Gdy w mieście jest mniej niż{" "}
              {nBiur(CITY_COMPARE_MIN)} z taką liczbą opinii, pokazujemy kreskę.
            </li>
            <li>
              Staż i „Działa 10+ lat” liczymy tylko z biur, które mają w rejestrze (KRS albo wykaz podatników VAT) datę
              rejestracji. W nawiasie liczba takich biur. Gdy jest ich mniej niż {YEARS_MIN}, pokazujemy kreskę.
            </li>
            <li>
              Prowizja: mediana najniższych stawek za sprzedaż z cenników biur, gdy{" "}
              {plural(PRICE_STAT_MIN, "podaje", "podają", "podaje")} je co najmniej {nBiur(PRICE_STAT_MIN)}.
            </li>
          </ul>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Miasto</th>
                  <th className="num">Biura</th>
                  <th className="num">Średnia ocena</th>
                  <th className="num">Mediana stażu</th>
                  <th className="num">Działa 10+ lat</th>
                  <th className="num">Jawny cennik</th>
                  <th className="num">Oferty na stronie</th>
                  <th className="num">Prowizja (mediana)</th>
                </tr>
              </thead>
              <tbody>
                {top.map((c) => (
                  <tr key={c.slug}>
                    <td>
                      <Link href={`/${c.slug}`}>{c.name}</Link>
                    </td>
                    <td className="num">{c.firms}</td>
                    <td className="num">{c.rated >= CITY_COMPARE_MIN ? fmtRating(c.avgRating) : "-"}</td>
                    <td className="num">
                      {c.withYears >= YEARS_MIN ? (
                        <>
                          {fmtYears(c.medianYears)} <small className="note">({c.withYears})</small>
                        </>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="num">{c.withYears >= YEARS_MIN ? fmtShare(c.share10y) : "-"}</td>
                    <td className="num">{fmtShare(c.sharePrices)}</td>
                    <td className="num">{fmtShare(c.shareOffers)}</td>
                    <td className="num">{c.commission != null ? fmtRate(c.commission) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2>Co mówią te liczby kupującym i sprzedającym</h2>
      <ul className="plain">
        <li>
          <b>Liczba biur</b> w katalogu pokazuje, z ilu biur możesz u nas wybierać. W dużym mieście warto porównać kilka biur,
          bo stawki i jakość obsługi bardzo się różnią. Porównanie do trzech biur obok siebie zrobisz w katalogu przyciskiem
          „Porównaj”.
        </li>
        <li>
          <b>Staż</b> liczymy od daty wpisu do rejestru. Długi staż nie gwarantuje jakości, ale firma, która działa 10 lat,
          przetrwała niejeden cykl rynku. Więcej:{" "}
          <Link href={blogPath("najdluzej-dzialajace-biura-nieruchomosci")}>najdłużej działające biura</Link>.
        </li>
        <li>
          <b>Jawny cennik</b> oznacza, że biuro podaje stawki na swojej stronie. Takie biura łatwiej porównać przed pierwszym
          telefonem. Lista: <Link href="/poradnik/biura-z-jawnym-cennikiem">biura z jawnym cennikiem</Link>.
        </li>
        <li>
          <b>Prowizja</b> to mediana najniższych stawek za sprzedaż z cenników biur, a nie cena transakcyjna. Szczegóły w
          raporcie <Link href="/raporty/prowizje-biur-nieruchomosci-2026">prowizje biur 2026</Link>.
        </li>
      </ul>

      {pairs.length > 0 && (
        <>
          <h2>Porównaj dwa miasta</h2>
          <ul className="chips">
            {pairs.map((p) => (
              <li key={p.slug}>
                <Link href={blogPath(`porownanie/${p.slug}`)}>
                  {p.a.name} czy {p.b.name}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </BlogArticle>
  );
}
