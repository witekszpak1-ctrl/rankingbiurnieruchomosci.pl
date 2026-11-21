import type { Metadata } from "next";
import Link from "next/link";

import { BlogArticle, Faq, ShareBar, ShortAnswer, faqLd } from "@/components/BlogArticle";
import { blogPath, fmtInt, fmtRating, fmtShare, getPost } from "@/lib/blog";
import { MIN_REVIEWS, loadBlogData, ratingOverview } from "@/lib/blog-stats";
import { nOpiniach, nOpiniami, nOpinii } from "@/lib/plural";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 86400;

const post = getPost("ocena-5-w-google-biuro-nieruchomosci");

export const metadata: Metadata = pageMetadata({ title: post.title, description: post.description, path: blogPath(post.slug), type: "article" });

export default async function FiveStarsPost() {
  const data = await loadBlogData().catch(() => null);
  const o = data ? ratingOverview(data.firms) : null;
  const ok = o != null && o.rated >= 30;
  const faq = [
    {
      q: "Ile opinii powinno mieć wiarygodne biuro nieruchomości?",
      a: `Nie ma jednej granicy, ale przy mniej niż ${nOpiniach(MIN_REVIEWS)} jedna opinia mocno zmienia średnią. Od kilkudziesięciu opinii w górę ocena zaczyna mówić coś o biurze.${o?.medianReviews != null ? ` Typowe biuro w naszym katalogu ma ${nOpinii(Math.round(o.medianReviews))}.` : ""}`,
    },
    {
      q: "Czy biura mogą kupować opinie?",
      a: "Nie wolno. Od 1 stycznia 2023 r. ustawa o przeciwdziałaniu nieuczciwym praktykom rynkowym zakazuje zamieszczania nieprawdziwych opinii i zlecania tego innym, a także zapewniania, że opinie pochodzą od klientów, bez rozsądnego sprawdzenia, czy tak jest. Opinii kupionych albo wystawionych za nagrodę zabrania też regulamin Google. Mimo to fałszywe opinie się zdarzają. Sygnały ostrzegawcze to wiele krótkich pięciogwiazdkowych opinii w krótkim czasie i autorzy bez innych recenzji.",
    },
    {
      q: "Czy niska ocena oznacza złe biuro?",
      a: `Nie zawsze. Przy kilku opiniach jedna negatywna mocno obniża średnią${o?.shareLow4Few != null && o?.shareLow4Many != null ? `: ocenę poniżej 4,0 ma ${fmtShare(o.shareLow4Few)} biur z mniej niż ${nOpiniami(MIN_REVIEWS)} i ${fmtShare(o.shareLow4Many)} pozostałych` : ""}. Duże biuro ma też więcej negatywnych opinii w liczbach bezwzględnych, więc patrz na ich odsetek i treść, na daty i na to, czy biuro odpowiada.`,
    },
  ];
  return (
    <BlogArticle post={post} extraLd={[faqLd(faq)]}>
      {ok ? (
        <ShortAnswer>
          Nie zawsze. W naszym katalogu ocenę 5,0 ma {fmtShare(o.share5)} biur z oceną Google, ale wśród biur z mniej niż{" "}
          {nOpiniami(MIN_REVIEWS)} ocenę 5,0 ma {fmtShare(o.share5Few)}, a wśród biur z co najmniej {nOpiniami(MIN_REVIEWS)}{" "}
          już tylko {fmtShare(o.share5Many)}. Im mniej opinii, tym łatwiej o idealną średnią. Ocena 4,8 ze stu opinii mówi o
          biurze więcej niż 5,0 z pięciu.
        </ShortAnswer>
      ) : (
        <ShortAnswer>
          Nie zawsze. Im mniej opinii, tym łatwiej o idealną średnią. Ocena 4,8 ze stu opinii mówi o biurze więcej niż 5,0
          z pięciu.
        </ShortAnswer>
      )}

      {ok && (
        <>
          <h2>Jak naprawdę wyglądają oceny biur nieruchomości</h2>
          <p>
            Sprawdziliśmy oceny Google {fmtInt(o.rated)} biur z katalogu, łącznie {fmtInt(o.reviews)} opinii. Średnia ocena
            biura to {fmtRating(o.avgRating)}, a średnia ważona liczbą opinii {fmtRating(o.weightedRating)}. Ocenę 4,8 lub
            wyższą ma {fmtShare(o.share48)} biur. Typowe biuro ma {nOpinii(Math.round(o.medianReviews ?? 0))}.
          </p>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Ocena Google</th>
                  <th className="num">Biura</th>
                  <th>Udział</th>
                  <th className="num">W tym z mniej niż {MIN_REVIEWS} opiniami</th>
                </tr>
              </thead>
              <tbody>
                {o.buckets.map((b) => (
                  <tr key={b.label}>
                    <td>{b.label}</td>
                    <td className="num">{fmtInt(b.firms)}</td>
                    <td>
                      <ShareBar value={o.rated > 0 ? (100 * b.firms) / o.rated : null} />
                    </td>
                    <td className="num">{b.firms > 0 ? fmtShare((100 * b.fewReviews) / b.firms) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Oceny są wysokie, bo zadowoleni klienci biur nieruchomości chętnie wystawiają opinie, a biura o nie proszą po
            transakcji. Dlatego sama gwiazdka słabo odróżnia biura. Różnica między 4,6 a 4,9 jest mniejsza, niż się wydaje,
            a różnica między pięcioma a stu opiniami jest ogromna.
            {o.over100 >= 10 && o.share5Over100 != null
              ? ` Wśród biur z co najmniej 100 opiniami ocenę 5,0 ma ${fmtShare(o.share5Over100)}.`
              : ""}
          </p>
          {o.shareLow4Few != null && o.shareLow4Many != null && (
            <p>
              Mała liczba opinii działa w obie strony: ocenę poniżej 4,0 ma {fmtShare(o.shareLow4Few)} biur z mniej niż{" "}
              {nOpiniami(MIN_REVIEWS)} i {fmtShare(o.shareLow4Many)} biur z większą liczbą opinii. Jedna zła opinia przy
              trzech dobrych daje słabą średnią, choć nie musi świadczyć o biurze.
            </p>
          )}
        </>
      )}

      <h2>Na co patrzeć zamiast samej gwiazdki</h2>
      <ol>
        <li>
          <b>Liczba opinii.</b> Od kilkudziesięciu opinii ocena zaczyna być miarodajna. Przy kilku opiniach traktuj ją jako
          ciekawostkę.
        </li>
        <li>
          <b>Treść opinii.</b> Szukaj konkretów: czas sprzedaży, kontakt z agentem, pomoc w dokumentach. Ogólne „polecam”
          mówi niewiele.
        </li>
        <li>
          <b>Daty.</b> Opinie sprzed lat mogą dotyczyć innych agentów. Liczy się ostatni rok lub dwa.
        </li>
        <li>
          <b>Negatywne opinie i odpowiedzi biura.</b> Sprawdź, czego dotyczą i czy biuro odpowiada rzeczowo.
        </li>
        <li>
          <b>Dane spoza Google.</b> Wpis w rejestrze, staż, jawny cennik i aktualne oferty. W naszym rankingu ocena Google to
          tylko jeden z czynników, opisujemy to w <Link href="/metodologia">metodologii</Link>.
        </li>
      </ol>
      <p>
        Porównanie miast według ocen biur:{" "}
        <Link href={blogPath("oceny-biur-nieruchomosci-w-miastach")}>gdzie biura mają najlepsze opinie</Link>. Ranking biur w
        Polsce: <Link href="/ranking">najlepsze biura nieruchomości</Link>.
      </p>

      <Faq items={faq} />
    </BlogArticle>
  );
}
