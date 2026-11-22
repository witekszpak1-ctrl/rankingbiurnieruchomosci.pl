import type { Metadata } from "next";
import Link from "next/link";

import { BlogArticle, Checklist, Example, Faq, ShareBar, ShortAnswer, faqLd } from "@/components/BlogArticle";
import { BarList, DotPlot } from "@/components/BlogCharts";
import { blogMetadata, blogPath, fmtInt, fmtRating, fmtShare, getPost } from "@/lib/blog";
import {
  CITY_COMPARE_MIN,
  MIN_REVIEWS,
  SAME_RATING,
  SAME_SHARE,
  cityPairs,
  hasSolidRating,
  loadBlogData,
  ratingLeague,
  ratingOverview,
  type CityStats,
} from "@/lib/blog-stats";
import { inCity } from "@/lib/cities";
import { nBiur, nBiurGen, nMiast, nOpinii, nOpiniach, nOpiniami, plural } from "@/lib/plural";
import { median } from "@/lib/ranking";

export const revalidate = 86400;

const post = getPost("oceny-biur-nieruchomosci-w-miastach");

export const metadata: Metadata = blogMetadata(post);

/** Miasto "duże" w tym artykule: tyle firm w katalogu. */
const BIG = 30;
/** Ocena dodatkowego biura w przykładzie wpływu jednego biura na średnią miasta (przykład, nie dane). */
const EXTRA_RATING = 3;
/** Liczba opinii biura w przykładzie porównania ze średnią dwóch miast (przykład, nie dane). */
const EXAMPLE_REVIEWS = 80;
/** Przykład z jednym biurem w dwóch miastach pokazujemy, gdy średnie skrajnych miast różnią się co najmniej o tyle. */
const EXAMPLE_SPREAD = 0.2;
/** Ile stron miast i porównań par linkujemy w sekcji o stronach miast. */
const CITY_LINKS = 6;
const PAIR_LINKS = 3;
/** Listę miast w zdaniu pokazujemy do tylu pozycji, dłuższą zastępujemy liczbą. */
const NAMES_MAX = 6;

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const fmt1 = (v: number | null | undefined) =>
  v == null ? "-" : v.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const avgOf = (c: CityStats) => c.avgRating as number;

/** "w Krakowie", "w Krakowie i w Gdańsku", "w Krakowie, w Lublinie i w Katowicach". */
function inCities(list: CityStats[]): string {
  const n = list.map((c) => inCity(c.name));
  return n.length <= 1 ? (n[0] ?? "") : `${n.slice(0, -1).join(", ")} i ${n[n.length - 1]}`;
}

/** Miejsce w zdaniu po "mają biura": lista miast w miejscowniku, a przy długiej liście ich liczba. */
function whereCities(list: CityStats[]): string {
  return list.length <= NAMES_MAX ? inCities(list) : `w ${fmtInt(list.length)} miastach`;
}

/** Odsetek biur z oceną 4,8+ w grupie miast, liczony z biur (a nie średnia odsetków miast). */
function pooled48(cities: CityStats[]): number | null {
  const n = cities.reduce((s, c) => s + c.rated, 0);
  return n > 0 ? cities.reduce((s, c) => s + (c.share48 ?? 0) * c.rated, 0) / n : null;
}

/** Położenie oceny względem średniej miasta, z progiem "podobnie" (SAME_RATING). */
function relation(value: number, ref: number): string {
  return value - ref >= SAME_RATING ? "powyżej" : ref - value >= SAME_RATING ? "poniżej" : "na poziomie";
}

export default async function CityRatingsPost() {
  const data = await loadBlogData().catch(() => null);
  const league = data ? ratingLeague(data.cities) : [];
  const all = data ? ratingOverview(data.firms) : null;
  const ref = all?.avgRatingSolid ?? null;
  const best = league[0];
  const second = league[1];
  const worst = league[league.length - 1];
  const many = league.length >= 2;
  const spread = many ? avgOf(best) - avgOf(worst) : null;
  const closeTop = second != null && avgOf(best) - avgOf(second) < SAME_RATING;

  // Miasta względem średniej całego katalogu (różnica mniejsza niż SAME_RATING to "podobnie").
  const above = ref != null ? league.filter((c) => avgOf(c) - ref >= SAME_RATING) : [];
  const below = ref != null ? league.filter((c) => ref - avgOf(c) >= SAME_RATING) : [];
  const near = ref != null ? league.filter((c) => Math.abs(avgOf(c) - ref) < SAME_RATING) : [];

  // Biura z co najmniej MIN_REVIEWS opiniami w całym katalogu i ich część w miastach zestawienia.
  const solid = data ? data.firms.filter(hasSolidRating) : [];
  const solid48 = solid.length ? (100 * solid.filter((f) => (f.googleRating as number) >= 4.8).length) / solid.length : null;
  const leagueRated = league.reduce((s, c) => s + c.rated, 0);
  const leagueCover = solid.length ? (100 * leagueRated) / solid.length : null;
  const outside = data ? data.cities.length - league.length : 0;

  // Odsetek biur z oceną 4,8+ i poniżej 4,0.
  const by48 = [...league].sort((a, b) => (b.share48 ?? 0) - (a.share48 ?? 0) || avgOf(b) - avgOf(a));
  const top48 = by48[0];
  const low48 = by48[by48.length - 1];
  const mostLow = [...league].sort((a, b) => (b.shareBelow4 ?? 0) - (a.shareBelow4 ?? 0) || avgOf(a) - avgOf(b))[0];
  const noLow = league.filter((c) => c.shareBelow4 === 0);

  // Duże i mniejsze miasta.
  const big = league.filter((c) => c.firms >= BIG);
  const rest = league.filter((c) => c.firms < BIG);
  const bigMean = mean(big.map(avgOf));
  const restMean = mean(rest.map(avgOf));
  const diff = bigMean != null && restMean != null ? bigMean - restMean : null;
  const verdict = diff == null ? null : Math.abs(diff) < SAME_RATING ? "podobna jak" : diff < 0 ? "niższa niż" : "wyższa niż";
  const groupsOk = big.length >= 2 && rest.length >= 2 && verdict != null;
  const big48 = pooled48(big);
  const rest48 = pooled48(rest);
  const bigSet = new Set(big.map((c) => c.slug));
  const restSet = new Set(rest.map((c) => c.slug));
  const bigReviews = median(solid.filter((f) => bigSet.has(f.citySlug)).map((f) => f.googleCount ?? 0));
  const restReviews = median(solid.filter((f) => restSet.has(f.citySlug)).map((f) => f.googleCount ?? 0));

  // Rozrzut ocen w mieście z największą próbą i wpływ jednego biura na średnią miasta z najmniejszą próbą.
  const deep = [...league].sort((a, b) => b.rated - a.rated || avgOf(b) - avgOf(a))[0];
  const thin = [...league].sort((a, b) => a.rated - b.rated || avgOf(a) - avgOf(b))[0];
  const deepRatings = deep ? solid.filter((f) => f.citySlug === deep.slug).map((f) => f.googleRating as number) : [];
  const deepMin = deepRatings.length ? Math.min(...deepRatings) : null;
  const deepMax = deepRatings.length ? Math.max(...deepRatings) : null;
  const deepRange = deepMin != null && deepMax != null ? deepMax - deepMin : null;
  const thinAfter = thin ? (avgOf(thin) * thin.rated + EXTRA_RATING) / (thin.rated + 1) : null;
  const deepAfter = deep ? (avgOf(deep) * deep.rated + EXTRA_RATING) / (deep.rated + 1) : null;
  const twoSamples = thin != null && deep != null && thin.slug !== deep.slug;

  // Przykład: jedno biuro (ocena między średnimi skrajnych miast) na tle dwóch miast.
  const exRating = spread != null && spread >= EXAMPLE_SPREAD ? Math.round(((avgOf(best) + avgOf(worst)) / 2) * 10) / 10 : null;

  const pairs = data ? cityPairs(data.cities).slice(0, PAIR_LINKS) : [];
  const cityLinks = [...league].sort((a, b) => b.firms - a.firms).slice(0, CITY_LINKS);
  const total = data?.firms.length ?? 0;

  const faq = [
    {
      q: "Gdzie biura nieruchomości mają najlepsze opinie?",
      a: best
        ? `Najwyższą średnią ocen Google w naszym zestawieniu mają biura ${inCity(best.name)} (${fmtRating(best.avgRating)}). Liczymy tylko biura z co najmniej ${nOpiniami(MIN_REVIEWS)}. Kolejność może się zmieniać, bo stronę przeliczamy codziennie.`
        : `Zestawienie miast jest w przygotowaniu. Liczymy w nim tylko biura z co najmniej ${nOpiniami(MIN_REVIEWS)}.`,
    },
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
    {
      q: "Jakie biuro nieruchomości w moim mieście jest najlepsze?",
      a: "Jedna liczba tego nie rozstrzygnie. Na stronie miasta pokazujemy ranking biur liczony z rejestru, stażu, cennika, zakresu usług, spójności danych, ofert i opinii Google. Porównaj dwa lub trzy biura z czołówki.",
      node: (
        <>
          Jedna liczba tego nie rozstrzygnie. Na stronie miasta pokazujemy ranking biur liczony z rejestru, stażu, cennika,
          zakresu usług, spójności danych, ofert i opinii Google. Porównaj dwa lub trzy biura z czołówki w{" "}
          <Link href="/porownaj">porównywarce</Link>. Najlepsze biura w miastach są w{" "}
          <Link href="/wyroznienia-2026">wyróżnieniach 2026</Link>.
        </>
      ),
    },
    {
      q: "Czy ranking biur nieruchomości jest sponsorowany?",
      a: "Nie. Pozycja miasta wynika tylko z ocen Google biur z katalogu, a pozycja biura w rankingu nie zależy od płatności. Zasady opisujemy w metodologii.",
      node: (
        <>
          Nie. Pozycja miasta wynika tylko z ocen Google biur z katalogu, a pozycja biura w rankingu nie zależy od płatności.
          Zasady opisujemy w <Link href="/metodologia">metodologii</Link>.
        </>
      ),
    },
    {
      q: "Ile biur nieruchomości jest w moim mieście?",
      a: `${total > 0 ? `W całym katalogu ${plural(total, "jest", "są", "jest")} ${nBiur(total)}. ` : ""}Liczbę biur w twoim mieście podajemy na stronie miasta. To biura z własną, sprawdzoną stroną internetową, a nie wszystkie biura z miasta.`,
    },
    {
      q: "Czy w mniejszym mieście lepiej szukać biura w większym mieście obok?",
      a: "Nie zawsze. Agent z innego miasta może słabiej znać lokalne ceny i kupujących. Takie biuro ma sens, gdy naprawdę działa na twoim terenie i ma tam oferty. Porównuj je z biurami, które obsługują twoją okolicę.",
    },
  ];

  return (
    <BlogArticle post={post} extraLd={[faqLd(faq)]}>
      {best && worst && all && many ? (
        <ShortAnswer>
          Najlepsze biura nieruchomości według średniej ocen Google są {inCity(best.name)}: średnia to{" "}
          {fmtRating(best.avgRating)}, a {fmtShare(best.share48)} biur ma ocenę 4,8 lub wyższą.
          {closeTop && second ? ` Niemal tyle samo mają biura ${inCity(second.name)} (${fmtRating(second.avgRating)}).` : ""}
          {` Najniższą średnią w zestawieniu mają biura ${inCity(worst.name)} (${fmtRating(worst.avgRating)}).`}{" "}
          Porównaliśmy {nMiast(league.length)}, w których co najmniej {nBiur(CITY_COMPARE_MIN)}{" "}
          {plural(CITY_COMPARE_MIN, "ma", "mają", "ma")} co najmniej {nOpinii(MIN_REVIEWS)}. Średnia wszystkich biur z
          katalogu z co najmniej {nOpiniami(MIN_REVIEWS)}, liczona tak samo, to {fmtRating(all.avgRatingSolid)}.
          {spread != null && deepRange != null && deepRange > spread
            ? " Różnice między biurami w jednym mieście są jednak większe niż między miastami."
            : ""}
        </ShortAnswer>
      ) : (
        <ShortAnswer>
          Najlepsze biura nieruchomości według ocen Google porównujemy, gdy co najmniej dwa miasta mają po{" "}
          {nBiur(CITY_COMPARE_MIN)} z co najmniej {nOpiniami(MIN_REVIEWS)}. Teraz danych jest za mało, więc zestawienie jest w
          przygotowaniu.
        </ShortAnswer>
      )}

      {league.length > 0 && (
        <>
          <h2>Ranking miast według ocen biur nieruchomości</h2>
          <p>
            Średnia ocena miasta to średnia ocen Google biur z co najmniej {nOpiniami(MIN_REVIEWS)}, które mają w nim główny
            wpis w katalogu.
            {ref != null && above.length > 0
              ? ` Wyraźnie wyższą średnią niż cały katalog (${fmtRating(ref)}) mają biura ${whereCities(above)}.`
              : ""}
            {ref != null && below.length > 0 ? ` Wyraźnie niższą mają biura ${whereCities(below)}.` : ""}
            {ref != null && near.length > 0 && many
              ? ` ${near.length === league.length ? "Wszystkie miasta mają średnią" : near.length === 1 ? `Biura ${inCity(near[0].name)} mają średnią` : "Pozostałe miasta mają średnią"} w granicach ${fmtRating(SAME_RATING)} punktu od średniej katalogu, a tak małej różnicy nie uznajemy za istotną.`
              : ""}
          </p>
          {many && (
            <DotPlot
              title="Średnia ocena Google biur nieruchomości w miastach"
              rows={league.map((c) => ({
                label: c.name,
                value: c.avgRating,
                note: `${nBiur(c.rated)} w próbie, ${nOpinii(c.ratedReviews)}`,
              }))}
              format={(v) => fmtRating(v)}
              reference={
                ref != null ? { value: ref, label: `średnia wszystkich biur z katalogu z co najmniej ${nOpiniami(MIN_REVIEWS)}` } : undefined
              }
              caption={`Zwykła średnia ocen Google biur z co najmniej ${nOpiniami(MIN_REVIEWS)}, razem ${nBiur(leagueRated)} w próbie. Każde biuro liczone raz, w mieście głównego wpisu. Źródło: profile biur z katalogu w Mapach Google.`}
              valueHeader="Średnia ocena"
            />
          )}
          <p className="note">
            Miasta od najwyższej średniej. Kolumny dotyczą tylko biur z próby. Kliknij miasto, żeby zobaczyć ranking biur.
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

      {many && top48 && low48 && (
        <>
          <h2>Gdzie najwięcej biur ma ocenę 4,8 lub wyższą</h2>
          <p>
            Średnia może ukryć, jak rozkładają się oceny. Dlatego liczymy też odsetek biur z oceną 4,8 lub wyższą, czyli
            takich, w których zdecydowana większość opinii to pięć gwiazdek.
            {solid48 != null ? ` W całym katalogu taką ocenę ma ${fmtShare(solid48)} biur z co najmniej ${nOpiniami(MIN_REVIEWS)}.` : ""}
            {top48.slug !== low48.slug && top48.share48 !== low48.share48
              ? ` Najwyższy odsetek jest ${inCity(top48.name)} (${fmtShare(top48.share48)}), najniższy ${inCity(low48.name)} (${fmtShare(low48.share48)}).`
              : ""}
            {top48.slug !== best.slug
              ? ` Najwyższą średnią mają biura ${inCity(best.name)}, a najwięcej ocen 4,8+ jest ${inCity(top48.name)}. Zwykle znaczy to, że w takim mieście obok wielu bardzo dobrze ocenianych biur są też biura z wyraźnie niższymi ocenami.`
              : ` Biura ${inCity(best.name)} prowadzą w obu zestawieniach.`}
          </p>
          <BarList
            title="Odsetek biur z oceną Google 4,8 lub wyższą w miastach"
            rows={by48.map((c) => ({ label: c.name, value: c.share48, note: `${nBiur(c.rated)} w próbie` }))}
            format={(v) => fmtShare(v)}
            max={100}
            caption={`Odsetek biur z oceną 4,8 lub wyższą wśród biur z co najmniej ${nOpiniami(MIN_REVIEWS)}, te same miasta co w rankingu średnich. Źródło: profile biur z katalogu w Mapach Google.`}
            valueHeader="Biura z oceną 4,8+"
          />
          {mostLow && (mostLow.shareBelow4 ?? 0) > 0 && (
            <p>
              Drugi koniec skali to oceny poniżej 4,0. Najwięcej takich biur w próbie jest {inCity(mostLow.name)} (
              {fmtShare(mostLow.shareBelow4)}).
              {noLow.length > 0 && noLow.length <= NAMES_MAX
                ? ` ${cap(inCities(noLow))} nie ma w próbie ani jednego takiego biura.`
                : ""}{" "}
              Ocena poniżej 4,0 przy co najmniej {nOpiniach(MIN_REVIEWS)} nie przekreśla biura, ale to sygnał, żeby przeczytać
              negatywne opinie i zapytać o nie na spotkaniu.
            </p>
          )}
        </>
      )}

      <h2>Duże i mniejsze miasta: gdzie biura są lepiej oceniane</h2>
      {groupsOk ? (
        <>
          <p>
            Za duże miasto przyjmujemy takie, w którym mamy w katalogu co najmniej {nBiur(BIG)}. W zestawieniu są to{" "}
            {big.map((c) => c.name).join(", ")}. Średnia z wyników tych miast ({fmtRating(bigMean)}) jest {verdict} w
            pozostałych miastach zestawienia ({fmtRating(restMean)}). Spośród dużych miast najwyższą średnią mają biura{" "}
            {inCity(big[0].name)} ({fmtRating(big[0].avgRating)}), najniższą {inCity(big[big.length - 1].name)} (
            {fmtRating(big[big.length - 1].avgRating)}).
            {big48 != null && rest48 != null
              ? ` Ocenę 4,8 lub wyższą ma ${fmtShare(big48)} biur z próby w dużych miastach i ${fmtShare(rest48)} w mniejszych${Math.abs(big48 - rest48) < SAME_SHARE ? ", czyli podobnie" : ""}.`
              : ""}
            {bigReviews != null && restReviews != null
              ? ` Typowe biuro z próby w dużych miastach ma ${nOpinii(Math.round(bigReviews))}, a w mniejszych ${nOpinii(Math.round(restReviews))}.`
              : ""}
          </p>
          <p>
            Dane nie mówią, skąd biorą się różnice: może to być liczba opinii na biuro, udział oddziałów sieci albo to, jak
            często biura proszą o opinie. Sama wielkość miasta nie jest powodem, żeby ufać biuru bardziej.
          </p>
        </>
      ) : (
        <p>
          Do porównania dużych i mniejszych miast potrzebujemy co najmniej dwóch miast w każdej grupie. Za duże miasto
          przyjmujemy takie, w którym mamy w katalogu co najmniej {nBiur(BIG)}. Teraz danych jest za mało, więc nie wyciągamy
          wniosków.
        </p>
      )}
      <p>
        Praktyczna różnica jest inna. W dużym mieście łatwiej znaleźć biuro z wysoką oceną i dużą liczbą opinii. W mniejszym
        biura mają często mało opinii, więc więcej powiedzą ci rejestr, staż, cennik i oferty.
        {outside > 0 ? ` Miast z mniejszą próbą, spoza tabeli, jest w katalogu ${fmtInt(outside)}.` : ""}
      </p>

      {many && spread != null && (
        <>
          <h2>Co naprawdę znaczą różnice między miastami</h2>
          <p>
            Różnica między najwyżej i najniżej ocenianym miastem to {fmtRating(spread)} punktu w skali od 1 do 5.
            {deep && deepMin != null && deepMax != null
              ? ` ${cap(inCity(deep.name))}, gdzie próba jest największa (${nBiur(deep.rated)}), oceny biur wynoszą od ${fmt1(deepMin)} do ${fmt1(deepMax)}.`
              : ""}
            {deepRange != null && deepRange > spread
              ? " Rozrzut ocen w jednym mieście jest więc większy niż różnica między miastami. Wybór biura znaczy dużo więcej niż wybór miasta."
              : ""}{" "}
            Różnice mniejsze niż {fmtRating(SAME_RATING)} punktu traktujemy jako podobne, bo mogą zniknąć po aktualizacji ocen
            jednego lub dwóch biur.
          </p>
          {thin && thinAfter != null && (
            <Example title="Przykład: jak jedno biuro zmienia średnią miasta">
              <p>
                {cap(inCity(thin.name))} w próbie {plural(thin.rated, "jest", "są", "jest")} {nBiur(thin.rated)} ze średnią{" "}
                {fmtRating(thin.avgRating)}. Gdyby doszło biuro z oceną {fmt1(EXTRA_RATING)}, średnia wyniosłaby (
                {fmtRating(thin.avgRating)} × {thin.rated} + {fmt1(EXTRA_RATING)}) / {thin.rated + 1} ={" "}
                <b>{fmtRating(thinAfter)}</b>, czyli spadłaby o {fmtRating(avgOf(thin) - thinAfter)} punktu.
                {twoSamples && deepAfter != null
                  ? ` ${cap(inCity(deep.name))}, gdzie w próbie ${plural(deep.rated, "jest", "są", "jest")} ${nBiur(deep.rated)}, to samo biuro obniżyłoby średnią tylko o ${fmtRating(avgOf(deep) - deepAfter)} punktu.`
                  : ""}
              </p>
              <p>
                To wyliczenie, a nie prawdziwe biuro. Pokazuje, dlaczego miasta z małą próbą szybciej zmieniają miejsce w
                tabeli i dlaczego nie pokazujemy miast z mniejszą próbą niż {nBiur(CITY_COMPARE_MIN)}.
              </p>
            </Example>
          )}
        </>
      )}

      <h2>Metodologia: jak liczymy ranking miast</h2>
      <ul className="plain">
        <li>
          <b>Źródło.</b> Średnia ocena i liczba opinii pochodzą z profili firm w Mapach Google. Nie liczymy opinii z innych
          portali ani ze stron biur.
        </li>
        <li>
          <b>Progi.</b> Liczymy tylko biura z co najmniej {nOpiniami(MIN_REVIEWS)}, bo ocena 5,0 z trzech opinii mówi mało
          (więcej w artykule{" "}
          <Link href={blogPath("ocena-5-w-google-biuro-nieruchomosci")}>czy ocena 5,0 oznacza najlepsze biuro</Link>). Miasto
          pokazujemy od {nBiurGen(CITY_COMPARE_MIN)} z taką liczbą opinii. Przy równej średniej decyduje odsetek biur z oceną
          4,8+, a potem większa próba.
        </li>
        <li>
          <b>Jedno biuro, jedno miasto.</b> Biuro z kilku miast liczymy raz, w mieście głównego wpisu. Oddziały sieci to
          zwykle osobne firmy z własnym NIP, więc liczymy je osobno. Sieci porównujemy w artykule{" "}
          <Link href={blogPath("siec-czy-lokalne-biuro-nieruchomosci")}>sieć czy lokalne biuro</Link>.
        </li>
        {all && all.weightedRating != null && all.avgRatingSolid != null && (
          <li>
            <b>Zwykła średnia.</b> Każde biuro waży tyle samo. Średnia ważona liczbą opinii (jak ocenia biura przeciętny
            klient, a nie przeciętne biuro) wynosi dla całego katalogu {fmtRating(all.weightedRating)}.
            {all.weightedRating - all.avgRatingSolid >= SAME_RATING
              ? " Jest wyższa od zwykłej średniej, bo biura z dużą liczbą opinii mają zwykle wysokie oceny."
              : all.avgRatingSolid - all.weightedRating >= SAME_RATING
                ? " Jest niższa od zwykłej średniej, bo biura z dużą liczbą opinii mają zwykle nieco niższe oceny."
                : " To prawie tyle samo co zwykła średnia."}
          </li>
        )}
        <li>
          <b>Katalog, a nie cały rynek.</b> Liczymy biura z katalogu, czyli firmy z własną, sprawdzoną stroną internetową.
          {leagueCover != null && solid.length > 0
            ? ` Miasta z tabeli obejmują ${fmtShare(leagueCover)} biur z katalogu, które mają co najmniej ${nOpinii(MIN_REVIEWS)}.`
            : ""}
        </li>
        <li>
          <b>Ocena to nie cały ranking.</b> W rankingu biur liczymy też rejestr, staż, cennik, zakres usług, spójność danych
          i oferty. Zasady opisujemy w <Link href="/metodologia">metodologii</Link>.
        </li>
      </ul>

      <h2>Jak wykorzystać ranking miast przy wyborze biura</h2>
      <p>Ranking miast to punkt odniesienia, a nie lista biur do wyboru. Skorzystaj z niego w pięciu krokach.</p>
      <ol>
        <li>
          <b>Zapisz średnią swojego miasta.</b> Z nią porównasz każde biuro.
          {ref != null ? ` Jeśli miasta nie ma w tabeli, punktem odniesienia jest średnia katalogu: ${fmtRating(ref)}.` : ""}
        </li>
        <li>
          <b>Otwórz stronę miasta.</b> Jest tam ranking biur z oceną, liczbą opinii, stażem i cennikiem. Wszystkie miasta
          znajdziesz na stronie <Link href="/miasta">Miasta</Link>. Biura z małą liczbą opinii sprawdzaj po rejestrze,
          stażu i ofertach, a nie po gwiazdkach.
        </li>
        <li>
          <b>Porównaj ocenę biura ze średnią jego miasta, a nie ze średnią krajową.</b> Dlaczego, pokazuje przykład niżej.
        </li>
        <li>
          <b>Zestaw dwa lub trzy biura obok siebie.</b> W <Link href="/porownaj">porównywarce</Link> zobaczysz ocenę,
          liczbę opinii, staż i prowizję. Stawki z cenników zbieramy w{" "}
          <Link href="/raporty/prowizje-biur-nieruchomosci-2026">raporcie prowizji</Link>, a biura, które je publikują, na
          stronie <Link href="/poradnik/biura-z-jawnym-cennikiem">biura z jawnym cennikiem</Link>.
        </li>
        <li>
          <b>Sprawdź firmę i porozmawiaj z agentem.</b> NIP sprawdzisz w KRS albo w wykazie podatników VAT, krok po kroku
          opisujemy to w poradniku{" "}
          <Link href="/poradnik/jak-sprawdzic-biuro-nieruchomosci">jak sprawdzić biuro nieruchomości</Link>. Zapytaj, kto
          poprowadzi twoją sprawę i jakie biuro ma <Link href="/oferty">oferty</Link> w twojej okolicy.
        </li>
      </ol>
      {exRating != null && (
        <Example title="Przykład: to samo biuro na tle dwóch miast">
          <p>
            Biuro ma ocenę {fmt1(exRating)} z {nOpinii(EXAMPLE_REVIEWS)}. {cap(inCity(best.name))} średnia biur to{" "}
            {fmtRating(best.avgRating)}, więc takie biuro jest {relation(exRating, avgOf(best))} średniej miasta.{" "}
            {cap(inCity(worst.name))} średnia to {fmtRating(worst.avgRating)}, więc to samo biuro byłoby{" "}
            {relation(exRating, avgOf(worst))} średniej.
          </p>
          <p>
            To przykład, a nie prawdziwe biuro. Ta sama gwiazdka znaczy co innego w różnych miastach, a przy{" "}
            {nOpiniach(EXAMPLE_REVIEWS)} liczy się też treść opinii.
          </p>
        </Example>
      )}

      <h2>Najczęstsze błędy przy czytaniu rankingu miast</h2>
      <ol>
        <li>
          <b>Wybór miasta zamiast biura.</b> W mieście z najwyższą średnią też są słabo oceniane biura, a w mieście z
          najniższą są biura bardzo dobre.
        </li>
        <li>
          <b>Przywiązywanie wagi do kilku setnych.</b> Miasta, których średnie różnią się o kilka setnych, w praktyce
          wypadają tak samo.
        </li>
        <li>
          <b>Szukanie biura daleko od nieruchomości.</b> Wyższa średnia w sąsiednim mieście nie znaczy, że tamtejsze biuro
          sprzeda twoje mieszkanie lepiej. Agent powinien znać lokalne ceny i kupujących.
        </li>
      </ol>

      {cityLinks.length > 0 && (
        <>
          <h2>Biura nieruchomości w miastach z zestawienia</h2>
          <p>Ranking biur w każdym mieście z tabeli jest na jego stronie. Miasta z największą liczbą biur w katalogu:</p>
          <ul className="plain">
            {cityLinks.map((c) => (
              <li key={c.slug}>
                <Link href={`/${c.slug}`}>Biura nieruchomości {inCity(c.name)}</Link>: {nBiur(c.firms)}, średnia ocena{" "}
                {fmtRating(c.avgRating)}
              </li>
            ))}
          </ul>
          <p>
            Pozostałe miasta są na stronie <Link href="/miasta">Miasta</Link>, a wynik każdego biura w{" "}
            <Link href="/ranking">rankingu biur nieruchomości</Link>. Staż, cenniki i prowizje w największych miastach
            zestawiamy w artykule{" "}
            <Link href={blogPath("biura-nieruchomosci-w-najwiekszych-miastach")}>biura nieruchomości w największych miastach</Link>.
            {pairs.length > 0 && (
              <>
                {" "}
                Dwa miasta obok siebie:{" "}
                {pairs.map((p, i) => (
                  <span key={p.slug}>
                    {i > 0 ? ", " : ""}
                    <Link href={blogPath(`porownanie/${p.slug}`)}>
                      {p.a.name} czy {p.b.name}
                    </Link>
                  </span>
                ))}
                .
              </>
            )}
          </p>
        </>
      )}

      <h2>Lista kontrolna: wybór biura w twoim mieście</h2>
      <Checklist
        title="Zanim podpiszesz umowę z biurem, sprawdź"
        items={[
          "Średnią ocen biur w twoim mieście, z którą porównasz każde biuro.",
          `Liczbę opinii biura: co najmniej ${MIN_REVIEWS}, a lepiej kilkadziesiąt z ostatnich dwóch lat.`,
          "Treść najnowszych i najsłabszych opinii oraz odpowiedzi biura.",
          "Czy biuro ma oferty w twojej okolicy.",
          "NIP, wpis w KRS albo w wykazie podatników VAT i staż firmy.",
          "Cennik: stawkę prowizji, VAT i to, kto płaci prowizję.",
          "Czy umowa jest na wyłączność, na jak długo i jak ją wypowiedzieć.",
          "Numer polisy OC pośrednika.",
          <>
            Wynik biura w <Link href="/ranking">rankingu</Link> i porównanie dwóch lub trzech biur w{" "}
            <Link href="/porownaj">porównywarce</Link>.
          </>,
        ]}
      />
      <p>
        Prowizja i zasady wypowiedzenia wynikają z umowy z biurem i z przepisów, więc przeczytaj umowę przed podpisem. Ile
        zwykle biorą biura, opisujemy w poradniku{" "}
        <Link href="/poradnik/ile-bierze-biuro-nieruchomosci">ile bierze biuro nieruchomości</Link>.
      </p>

      <Faq items={faq} />
    </BlogArticle>
  );
}
