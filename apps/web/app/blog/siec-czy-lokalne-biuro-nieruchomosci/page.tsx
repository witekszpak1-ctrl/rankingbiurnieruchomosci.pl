import type { Metadata } from "next";
import Link from "next/link";

import { BlogArticle, ShortAnswer } from "@/components/BlogArticle";
import { blogPath, fmtInt, fmtRating, fmtShare, fmtYears, getPost } from "@/lib/blog";
import { MIN_REVIEWS, loadBlogData, reachStats } from "@/lib/blog-stats";
import { nBiur, nMiast, nOpinii } from "@/lib/plural";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 86400;

const post = getPost("siec-czy-lokalne-biuro-nieruchomosci");

export const metadata: Metadata = pageMetadata({ title: post.title, description: post.description, path: blogPath(post.slug), type: "article" });

export default async function ChainVsLocalPost() {
  const data = await loadBlogData().catch(() => null);
  const s = data ? reachStats(data.firms, data.citiesByBrand, data.now) : null;
  const [local, multi] = s?.groups ?? [];
  const ok = local && multi && local.rated >= 20 && multi.rated >= 10;
  return (
    <BlogArticle post={post}>
      {ok ? (
        <ShortAnswer>
          Biura z jednego miasta i firmy obecne w kilku miastach mają podobne oceny klientów: mediana {fmtRating(local.medianRating)}{" "}
          wobec {fmtRating(multi.medianRating)}. Firmy z kilku miast mają zwykle więcej opinii (mediana{" "}
          {fmtInt(multi.medianReviews)} wobec {fmtInt(local.medianReviews)}) i
          {(multi.sharePrices ?? 0) > (local.sharePrices ?? 0) ? " częściej" : " rzadziej"} publikują cennik. Wybór zależy
          bardziej od konkretnego biura i agenta niż od tego, czy firma ma oddziały.
        </ShortAnswer>
      ) : (
        <ShortAnswer>
          Sieć daje rozpoznawalną markę i procedury, lokalne biuro często lepiej zna swoją okolicę. O jakości decyduje
          konkretne biuro i agent, a nie sam szyld.
        </ShortAnswer>
      )}

      {s && s.groups.length > 0 && (
        <>
          <h2>Porównanie w liczbach</h2>
          <p className="note">
            Każda firma liczona raz. Ocena: mediana ocen Google firm z co najmniej {nOpinii(MIN_REVIEWS)}. Firma w kilku
            miastach to firma, która ma w katalogu wpisy w więcej niż jednym mieście (oddziały albo obsługa okolicy).
          </p>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Grupa</th>
                  <th className="num">Firmy</th>
                  <th className="num">Mediana oceny</th>
                  <th className="num">Ocena 4,8+</th>
                  <th className="num">Mediana opinii</th>
                  <th className="num">Mediana stażu</th>
                  <th className="num">Jawny cennik</th>
                </tr>
              </thead>
              <tbody>
                {s.groups.map((g) => (
                  <tr key={g.label}>
                    <td>{g.label}</td>
                    <td className="num">{fmtInt(g.firms)}</td>
                    <td className="num">{g.rated >= 5 ? fmtRating(g.medianRating) : "-"}</td>
                    <td className="num">{g.rated >= 5 ? fmtShare(g.share48) : "-"}</td>
                    <td className="num">{fmtInt(g.medianReviews)}</td>
                    <td className="num">{fmtYears(g.medianYears)}</td>
                    <td className="num">{fmtShare(g.sharePrices)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {s.multiShare != null && (
            <p>
              W kilku miastach działa {fmtShare(s.multiShare)} firm z katalogu. Pozostałe to biura z jednego miasta, często
              prowadzone przez właściciela, który sam obsługuje klientów.
            </p>
          )}
        </>
      )}

      {s && s.wide.length > 0 && (
        <>
          <h2>Firmy obecne w największej liczbie miast</h2>
          <p className="note">
            Ocena Google dotyczy profilu firmy, który przypisaliśmy do jej głównego wpisu. Oddziały w innych miastach mogą
            mieć własne profile i inne oceny.
          </p>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Firma</th>
                  <th className="num">Miasta</th>
                  <th className="num">Ocena</th>
                  <th className="num">Opinie</th>
                </tr>
              </thead>
              <tbody>
                {s.wide.map((f) => (
                  <tr key={f.brandId}>
                    <td>
                      <Link href={`/${f.citySlug}/${f.slug}`}>{f.name}</Link>
                      <small className="note"> {f.cityName}</small>
                    </td>
                    <td className="num">{f.cities}</td>
                    <td className="num">{f.googleRating != null ? fmtRating(f.googleRating) : "-"}</td>
                    <td className="num">{f.googleCount != null ? fmtInt(f.googleCount) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2>Sieć czy lokalne biuro: plusy i minusy</h2>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Sieć lub firma z oddziałami</th>
              <th>Lokalne biuro</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Większa baza kupujących i ofert, wspólne ogłoszenia oddziałów.</td>
              <td>Dobra znajomość okolicy, cen i lokalnych kupców.</td>
            </tr>
            <tr>
              <td>Standardowe procedury, umowy i szkolenia agentów.</td>
              <td>Często bezpośredni kontakt z właścicielem biura.</td>
            </tr>
            <tr>
              <td>Jakość zależy od oddziału i agenta, nie od marki.</td>
              <td>Mniejszy zasięg marketingu przy nietypowych nieruchomościach.</td>
            </tr>
            <tr>
              <td>Oddziały franczyzowe to zwykle osobne firmy z własnymi cennikami.</td>
              <td>Elastyczniejsze stawki i warunki umowy.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Niezależnie od szyldu sprawdź konkretne biuro: wpis w rejestrze, polisę OC, opinie i cennik.{" "}
        <Link href="/poradnik/jak-sprawdzic-biuro-nieruchomosci">Jak sprawdzić biuro nieruchomości</Link>. Porównanie miast:{" "}
        <Link href={blogPath("biura-nieruchomosci-w-najwiekszych-miastach")}>biura w największych miastach</Link>.
        {s && s.wide[0] ? ` Najwięcej miast w katalogu obsługuje ${s.wide[0].name} (${nMiast(s.wide[0].cities)}).` : ""}
        {data ? ` W katalogu jest ${nBiur(data.firms.length)}.` : ""}
      </p>
    </BlogArticle>
  );
}
