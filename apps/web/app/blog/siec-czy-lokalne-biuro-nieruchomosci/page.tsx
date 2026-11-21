import type { Metadata } from "next";
import Link from "next/link";

import { BlogArticle, ShortAnswer } from "@/components/BlogArticle";
import { blogPath, fmtInt, fmtRating, fmtShare, fmtYears, getPost } from "@/lib/blog";
import { MIN_REVIEWS, SAME_RATING, SAME_SHARE, loadBlogData, reachStats } from "@/lib/blog-stats";
import { nBiur, nMiast, nOpiniami } from "@/lib/plural";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 86400;

const post = getPost("siec-czy-lokalne-biuro-nieruchomosci");

export const metadata: Metadata = pageMetadata({ title: post.title, description: post.description, path: blogPath(post.slug), type: "article" });

export default async function ChainVsLocalPost() {
  const data = await loadBlogData().catch(() => null);
  const s = data ? reachStats(data.firms, data.citiesByBrand, data.now) : null;
  const [local, multi] = s?.groups ?? [];
  const ok = local && multi && local.rated >= 20 && multi.rated >= 10;
  // -1/0/1: mniej, podobnie, więcej w grupie firm z kilku miast (progi jak w porównaniach miast)
  const cmp = (x: number | null | undefined, y: number | null | undefined, same: number) =>
    x == null || y == null ? null : Math.abs(x - y) < same ? 0 : x > y ? 1 : -1;
  const rating = ok ? (cmp(multi.medianRating, local.medianRating, SAME_RATING) ?? 0) : 0;
  const reviews = ok && multi.medianReviews && local.medianReviews ? cmp(multi.medianReviews / local.medianReviews, 1, 0.15) : null;
  const prices = ok ? cmp(multi.sharePrices, local.sharePrices, SAME_SHARE) : null;
  return (
    <BlogArticle post={post}>
      {ok ? (
        <ShortAnswer>
          {rating === 0
            ? `Biura z jednego miasta i firmy obecne w kilku miastach mają podobne oceny klientów (mediana ${fmtRating(local.medianRating)} i ${fmtRating(multi.medianRating)}).`
            : `Wyżej oceniane są ${rating > 0 ? "firmy obecne w kilku miastach" : "biura z jednego miasta"}: mediana ${fmtRating(rating > 0 ? multi.medianRating : local.medianRating)} wobec ${fmtRating(rating > 0 ? local.medianRating : multi.medianRating)}.`}{" "}
          {reviews === 0
            ? `Liczba opinii jest zbliżona (mediana ${fmtInt(multi.medianReviews)} i ${fmtInt(local.medianReviews)}).`
            : reviews != null
              ? `${reviews > 0 ? "Firmy z kilku miast" : "Biura z jednego miasta"} mają więcej opinii (mediana ${fmtInt(reviews > 0 ? multi.medianReviews : local.medianReviews)} wobec ${fmtInt(reviews > 0 ? local.medianReviews : multi.medianReviews)}).`
              : ""}{" "}
          {prices === 0
            ? `Cennik publikuje podobna część firm w obu grupach (${fmtShare(multi.sharePrices)} i ${fmtShare(local.sharePrices)}).`
            : prices != null
              ? `Firmy z kilku miast ${prices > 0 ? "częściej" : "rzadziej"} publikują cennik (${fmtShare(multi.sharePrices)} wobec ${fmtShare(local.sharePrices)}).`
              : ""}{" "}
          O wyborze decyduje bardziej konkretne biuro i agent niż to, czy firma ma oddziały.
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
            Każda firma liczona raz. Ocena: mediana ocen Google firm z co najmniej {nOpiniami(MIN_REVIEWS)}. Firma w kilku
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
                {s.groups
                  .filter((g) => g.firms > 0)
                  .map((g) => (
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
          <p className="note">
            Biura franczyzowe sieci mają zwykle własny NIP, więc w katalogu są osobnymi firmami. Grupa „w kilku miastach” to
            firmy z wpisami w kilku miastach: z oddziałami albo obsługujące okoliczne miejscowości.
          </p>
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
