import type { Metadata } from "next";
import Link from "next/link";

import { BlogArticle, ShortAnswer } from "@/components/BlogArticle";
import { blogPath, fmtRate, fmtRating, fmtShare, fmtYears, getPost } from "@/lib/blog";
import { CITY_COMPARE_MIN, cityPairs, loadBlogData } from "@/lib/blog-stats";
import { inCity } from "@/lib/cities";
import { nBiur } from "@/lib/plural";
import { PRICE_STAT_MIN } from "@/lib/ranking";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 86400;

const post = getPost("biura-nieruchomosci-w-najwiekszych-miastach");
const TOP = 15;

export const metadata: Metadata = pageMetadata({ title: post.title, description: post.description, path: blogPath(post.slug), type: "article" });

export default async function BigCitiesPost() {
  const data = await loadBlogData().catch(() => null);
  const top = (data?.cities ?? []).slice(0, TOP);
  const pairs = data ? cityPairs(data.cities) : [];
  const [first, second, third] = top;
  const rated = top.filter((c) => c.rated >= CITY_COMPARE_MIN && c.avgRating != null);
  const bestRated = [...rated].sort((a, b) => (b.avgRating as number) - (a.avgRating as number))[0];
  const oldest = [...top].filter((c) => c.withYears >= 5 && c.medianYears != null).sort((a, b) => (b.medianYears as number) - (a.medianYears as number))[0];
  const mostPrices = [...top].filter((c) => c.sharePrices != null).sort((a, b) => (b.sharePrices as number) - (a.sharePrices as number))[0];
  return (
    <BlogArticle post={post}>
      {first && second && third ? (
        <ShortAnswer>
          Najwięcej biur nieruchomości w naszym katalogu działa {inCity(first.name)} ({nBiur(first.firms)}),{" "}
          {inCity(second.name)} ({nBiur(second.firms)}) i {inCity(third.name)} ({nBiur(third.firms)}).
          {bestRated ? ` Z ${top.length} miast w tabeli najwyżej oceniane biura ma ${bestRated.name} (średnio ${fmtRating(bestRated.avgRating)}).` : ""}
          {oldest ? ` Najdłużej działają biura ${inCity(oldest.name)}: mediana stażu to ${fmtYears(oldest.medianYears)}.` : ""}
          {mostPrices ? ` Cennik na stronie najczęściej publikują biura ${inCity(mostPrices.name)} (${fmtShare(mostPrices.sharePrices)}).` : ""}
        </ShortAnswer>
      ) : (
        <p>Zestawienie jest w przygotowaniu.</p>
      )}

      {top.length > 0 && (
        <>
          <h2>{top.length} miast z największą liczbą biur</h2>
          <p className="note">
            Biura liczymy raz, w mieście głównego wpisu. Ocena: średnia biur z co najmniej 10 opiniami Google (przy mniej
            niż {nBiur(CITY_COMPARE_MIN)} w próbie pokazujemy kreskę). Prowizja: mediana z cenników, gdy podaje ją co
            najmniej {nBiur(PRICE_STAT_MIN)}.
          </p>
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
                    <td className="num">{c.withYears >= 5 ? fmtYears(c.medianYears) : "-"}</td>
                    <td className="num">{c.withYears >= 5 ? fmtShare(c.share10y) : "-"}</td>
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
          <b>Liczba biur</b> to wybór. W dużym mieście warto porównać kilka biur, bo stawki i jakość obsługi bardzo się
          różnią. Porównanie do trzech biur obok siebie zrobisz w katalogu przyciskiem „Porównaj”.
        </li>
        <li>
          <b>Staż</b> liczymy od daty rozpoczęcia działalności w rejestrze. Długi staż nie gwarantuje jakości, ale firma,
          która działa 10 lat, przeszła już niejeden cykl rynku. Więcej:{" "}
          <Link href={blogPath("najdluzej-dzialajace-biura-nieruchomosci")}>najdłużej działające biura</Link>.
        </li>
        <li>
          <b>Jawny cennik</b> to biuro, które podaje stawki na stronie. Takie biura łatwiej porównać przed pierwszym
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
