import type { Metadata } from "next";
import Link from "next/link";

import { BlogArticle, ShortAnswer } from "@/components/BlogArticle";
import { blogPath, fmtInt, fmtRating, fmtShare, fmtYears, getPost } from "@/lib/blog";
import { loadBlogData, tenureStats } from "@/lib/blog-stats";
import { formatYear } from "@/lib/format";
import { nBiurGen } from "@/lib/plural";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 86400;

const post = getPost("najdluzej-dzialajace-biura-nieruchomosci");

export const metadata: Metadata = pageMetadata({ title: post.title, description: post.description, path: blogPath(post.slug), type: "article" });

export default async function OldestFirmsPost() {
  const data = await loadBlogData().catch(() => null);
  const t = data ? tenureStats(data.firms, data.now) : null;
  const ok = t != null && t.withYears >= 30;
  const cities = (data?.cities ?? []).filter((c) => c.withYears >= 10 && c.medianYears != null).sort((a, b) => (b.medianYears as number) - (a.medianYears as number));
  const first = t?.oldest[0];
  return (
    <BlogArticle post={post}>
      {ok && first ? (
        <ShortAnswer>
          Najdłużej działające biuro w naszym katalogu to {first.name} ({first.cityName}), które działa od{" "}
          {formatYear(first.startDate)} roku. Typowe biuro nieruchomości działa {fmtYears(t.medianYears)}: 10 lat lub dłużej
          działa {fmtShare(t.share10y)} firm, 20 lat lub dłużej {fmtShare(t.share20y)}, a {fmtShare(t.shareUnder3y)} to
          firmy młodsze niż 3 lata. Dane z rejestrów dla {nBiurGen(t.withYears)}.
        </ShortAnswer>
      ) : (
        <p>Zestawienie jest w przygotowaniu.</p>
      )}

      {ok && t.oldest.length > 0 && (
        <>
          <h2>Biura z najdłuższym stażem</h2>
          <p className="note">
            Staż liczymy od daty rozpoczęcia działalności firmy w rejestrze (KRS albo CEIDG). Firma, która zmieniła formę
            prawną, na przykład z działalności jednoosobowej na spółkę, może mieć w rejestrze późniejszą datę niż
            faktyczny początek działalności.
          </p>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th className="num">#</th>
                  <th>Biuro</th>
                  <th>Miasto</th>
                  <th className="num">Od roku</th>
                  <th className="num">Ocena Google</th>
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
          <p className="note">Miasta, w których znamy datę rozpoczęcia działalności co najmniej 10 biur.</p>
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
        Staż nie gwarantuje dobrej obsługi, ale coś mówi. Firma, która działa kilkanaście lat, przeszła wzloty i spadki
        rynku, ma stałych klientów i reputację do stracenia. Nowe biuro może być równie dobre, zwłaszcza gdy założył je
        doświadczony agent z innej firmy. Wtedy zapytaj o jego doświadczenie i przykłady transakcji.
      </p>
      <p>
        Datę rozpoczęcia działalności każdego biura pokazujemy na jego profilu, a staż jest jednym z czynników rankingu
        (<Link href="/metodologia">metodologia</Link>). Jak samodzielnie sprawdzić firmę w rejestrze, opisujemy w poradniku{" "}
        <Link href="/poradnik/jak-sprawdzic-biuro-nieruchomosci">jak sprawdzić biuro nieruchomości</Link>. Zobacz też{" "}
        <Link href={blogPath("siec-czy-lokalne-biuro-nieruchomosci")}>sieć czy lokalne biuro</Link>.
      </p>
    </BlogArticle>
  );
}
