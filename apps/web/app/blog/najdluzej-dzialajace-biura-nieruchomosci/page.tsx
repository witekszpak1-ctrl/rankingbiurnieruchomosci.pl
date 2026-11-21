import type { Metadata } from "next";
import Link from "next/link";

import { BlogArticle, ShortAnswer } from "@/components/BlogArticle";
import { blogPath, fmtInt, fmtRating, fmtShare, fmtYears, getPost } from "@/lib/blog";
import { YEARS_MIN, loadBlogData, tenureStats } from "@/lib/blog-stats";
import { formatYear } from "@/lib/format";
import { nBiur, nBiurGen, nLatGen, plural } from "@/lib/plural";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 86400;

const post = getPost("najdluzej-dzialajace-biura-nieruchomosci");
/** Wykaz podatników VAT zaczyna się od wprowadzenia VAT (5 lipca 1993 r.): wcześniejszych dat w tym źródle nie ma. */
const VAT_START_YEAR = "1993";

export const metadata: Metadata = pageMetadata({ title: post.title, description: post.description, path: blogPath(post.slug), type: "article" });

export default async function OldestFirmsPost() {
  const data = await loadBlogData().catch(() => null);
  const t = data ? tenureStats(data.firms, data.now) : null;
  const ok = t != null && t.withYears >= 30;
  const cities = (data?.cities ?? [])
    .filter((c) => c.withYears >= YEARS_MIN && c.medianYears != null)
    .sort((a, b) => (b.medianYears as number) - (a.medianYears as number));
  const first = t?.oldest[0];
  const firstYear = first ? formatYear(first.startDate) : null;
  return (
    <BlogArticle post={post}>
      {ok && first ? (
        <ShortAnswer>
          {t.oldestTied > 1 ? (
            <>
              Najwcześniejszą datę rejestracji w naszym katalogu ({firstYear} r.) {plural(t.oldestTied, "ma", "mają", "ma")}{" "}
              {nBiur(t.oldestTied)}, między innymi {first.name} ({first.cityName}).
            </>
          ) : (
            <>
              Najwcześniejszą datę rejestracji w naszym katalogu ma {first.name} ({first.cityName}): {firstYear} r.
            </>
          )}
          {firstYear === VAT_START_YEAR ? " Wykaz podatników VAT obejmuje firmy od lipca 1993 roku, więc część z nich działa jeszcze dłużej." : ""}{" "}
          Typowe biuro nieruchomości jest w rejestrze od {nLatGen(Math.floor(t.medianYears ?? 0))}: 10 lat lub dłużej
          ma {fmtShare(t.share10y)} firm, 20 lat lub dłużej {fmtShare(t.share20y)}, a {fmtShare(t.shareUnder3y)} to firmy
          zarejestrowane w ostatnich 3 latach. Dane z rejestrów dla {nBiurGen(t.withYears)}.
        </ShortAnswer>
      ) : (
        <p>Zestawienie jest w przygotowaniu.</p>
      )}

      {ok && t.oldest.length > 0 && (
        <>
          <h2>Biura z najdłuższym stażem w rejestrze</h2>
          <p className="note">
            Staż liczymy od daty wpisu firmy do rejestru: KRS albo wykazu podatników VAT (Ministerstwo Finansów). To data
            rejestracji, a nie zawsze faktyczny początek działalności: KRS działa od 2001 roku, wykaz VAT od lipca 1993 roku, a
            firma, która zmieniła formę prawną, może mieć późniejszą datę. Rok {VAT_START_YEAR} oznacza więc „{VAT_START_YEAR}{" "}
            lub wcześniej”. Firmy z tym samym rokiem są w kolejności alfabetycznej.
          </p>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th className="num">#</th>
                  <th>Biuro</th>
                  <th>Miasto</th>
                  <th className="num">W rejestrze od</th>
                  <th className="num">Ocena Google (opinie)</th>
                </tr>
              </thead>
              <tbody>
                {t.oldest.map((f, i) => (
                  <tr key={f.brandId}>
                    <td className="num">{i + 1}</td>
                    <td>
                      <Link href={`/${f.citySlug}/${f.slug}`}>{f.name}</Link>
                    </td>
                    <td>
                      <Link href={`/${f.citySlug}`}>{f.cityName}</Link>
                    </td>
                    <td className="num">{formatYear(f.startDate)}</td>
                    <td className="num">
                      {f.googleRating != null ? `${fmtRating(f.googleRating)} (${fmtInt(f.googleCount ?? 0)})` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {cities.length > 0 && (
        <>
          <h2>Staż biur w miastach</h2>
          <p className="note">Miasta, w których znamy datę rejestracji co najmniej {nBiurGen(YEARS_MIN)}.</p>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Miasto</th>
                  <th className="num">Mediana stażu</th>
                  <th className="num">Działa 10+ lat</th>
                  <th className="num">Biura z datą</th>
                </tr>
              </thead>
              <tbody>
                {cities.slice(0, 20).map((c) => (
                  <tr key={c.slug}>
                    <td>
                      <Link href={`/${c.slug}`}>{c.name}</Link>
                    </td>
                    <td className="num">{fmtYears(c.medianYears)}</td>
                    <td className="num">{fmtShare(c.share10y)}</td>
                    <td className="num">{c.withYears}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2>Czy staż ma znaczenie przy wyborze biura</h2>
      <p>
        Staż nie gwarantuje dobrej obsługi, ale coś mówi. Firma, która działa kilkanaście lat, przetrwała wzloty i upadki
        rynku, ma stałych klientów i reputację do stracenia. Nowe biuro może być równie dobre, zwłaszcza gdy założył je
        doświadczony agent z innej firmy. Wtedy zapytaj o jego doświadczenie i przykłady transakcji.
      </p>
      <p>
        Staż w rejestrze każdego biura pokazujemy na jego profilu i jest on jednym z czynników rankingu (opisujemy to w{" "}
        <Link href="/metodologia">metodologii</Link>). Jak samodzielnie sprawdzić firmę w rejestrze, opisujemy w poradniku{" "}
        <Link href="/poradnik/jak-sprawdzic-biuro-nieruchomosci">jak sprawdzić biuro nieruchomości</Link>. Zobacz też{" "}
        <Link href={blogPath("siec-czy-lokalne-biuro-nieruchomosci")}>sieć czy lokalne biuro</Link>.
      </p>
    </BlogArticle>
  );
}
