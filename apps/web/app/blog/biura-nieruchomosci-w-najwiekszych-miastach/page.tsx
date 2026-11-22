import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";

import { BlogArticle, Checklist, Example, Faq, ShortAnswer, faqLd } from "@/components/BlogArticle";
import { BarList, DotPlot } from "@/components/BlogCharts";
import { blogMetadata, blogPath, fmtPln, fmtRate, fmtRating, fmtShare, fmtYears, getPost } from "@/lib/blog";
import {
  CITY_COMPARE_MIN,
  MIN_REVIEWS,
  SAME_RATE,
  SAME_RATING,
  SAME_SHARE,
  YEARS_MIN,
  cityPairs,
  loadBlogData,
  pairPoints,
  ratingLeague,
  ratingOverview,
  tenureStats,
  type CityStats,
  type PairPoint,
} from "@/lib/blog-stats";
import { commissionReport } from "@/lib/catalog";
import { inCity } from "@/lib/cities";
import { formatDate } from "@/lib/format";
import { OFFERS_SAMPLE_MAX, count, nBiur, nBiurGen, nMiast, nOpiniami, nOpinii, plural } from "@/lib/plural";
import { PRICE_STAT_MIN } from "@/lib/ranking";

export const revalidate = 86400;

const post = getPost("biura-nieruchomosci-w-najwiekszych-miastach");
const TOP = 15;
/** Ile pierwszych miast z tabeli opisujemy osobno. */
const DESCRIBED = 4;
/** Odsetek jawnych cenników pokazujemy na wykresie dla miast z co najmniej tyloma biurami (mniejsza próba to szum). */
const SHARE_MIN = CITY_COMPARE_MIN;
/** Cena mieszkania do przykładu prowizji (przykład do rachunku, nie cena rynkowa). */
const EXAMPLE_PRICE = 600000;
const VAT = 23;
/** Różnicę median stażu mniejszą niż rok opisujemy jako podobną (tak jak w pairPoints). */
const SAME_YEARS = 1;

export const metadata: Metadata = blogMetadata(post);

/** Miasta z najwyższą wartością (remis przy tej samej liczbie po zaokrągleniu, jak w tabeli). */
function leaders(cities: CityStats[], value: (c: CityStats) => number | null, round: (v: number) => number): CityStats[] {
  const withValue = cities.filter((c) => value(c) != null);
  if (withValue.length === 0) return [];
  const max = Math.max(...withValue.map((c) => round(value(c) as number)));
  return withValue.filter((c) => round(value(c) as number) === max);
}

const names = (list: CityStats[]) => list.map((c) => inCity(c.name)).join(" i ");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** Czasownik po liczebniku: "ma 5 biur", "mają 3 biura", "ma 1 biuro". */
const verb = (n: number, one: string, few: string) => plural(n, one, few, one);
/** Dopełniacz: "z 1 miasta", "z 12 miast". */
const nMiastGen = (n: number) => `${n.toLocaleString("pl-PL")} ${n === 1 ? "miasta" : "miast"}`;
const inPlaces = (n: number) => `w ${n.toLocaleString("pl-PL")} ${n === 1 ? "miejscowości" : "miejscowościach"}`;
const nPlaces = (n: number) => count(n, "miejscowość", "miejscowości", "miejscowości");
const nEntries = (n: number) => count(n, "wpis", "wpisy", "wpisów");

/** Porównanie z wartością dla całego katalogu (podaną raz we wstępie); różnica mniejsza niż `same` to "podobnie". */
function vsCatalog(v: number | null, ref: number | null, same: number, words: [higher: string, lower: string, similar: string]): string {
  if (v == null || ref == null) return "";
  const d = v - ref;
  return `, ${Math.abs(d) < same ? words[2] : d > 0 ? words[0] : words[1]}`;
}

const VS_RATING: [string, string, string] = ["powyżej średniej katalogu", "poniżej średniej katalogu", "na poziomie średniej katalogu"];
const VS_YEARS: [string, string, string] = ["dłużej niż w całym katalogu", "krócej niż w całym katalogu", "podobnie jak w całym katalogu"];
const VS_PRICES: [string, string, string] = ["częściej niż w całym katalogu", "rzadziej niż w całym katalogu", "podobnie jak w całym katalogu"];
const VS_RATE: [string, string, string] = ["powyżej mediany katalogu", "poniżej mediany katalogu", "na poziomie mediany katalogu"];

type Ref = {
  avgRating: number | null;
  sharePrices: number | null;
  medianYears: number | null;
  commission: number | null;
  bestRated: CityStats[];
  oldest: CityStats[];
  topCount: number;
};

/** Opis jednego miasta: każde zdanie z liczb z danych, przy zbyt małej próbie zdanie mówi to wprost. */
function cityText(c: CityStats, i: number, ref: Ref): string {
  const s: string[] = [];
  if (i === 0) {
    const entries = c.listings > c.firms ? ` (razem z oddziałami firm z innych miast ${nEntries(c.listings)})` : "";
    s.push(`${c.name} to miasto z największą liczbą biur w katalogu: ${nBiur(c.firms)} z głównym wpisem${entries}.`);
  } else if (i % 2 === 1) s.push(`${cap(inCity(c.name))} mamy ${nBiur(c.firms)}, to ${i + 1}. wynik w zestawieniu.`);
  else s.push(`${c.name} zajmuje ${i + 1}. miejsce pod względem liczby biur: ${nBiur(c.firms)}.`);

  if (c.rated >= CITY_COMPARE_MIN) {
    s.push(
      `Średnia ocena ${nBiurGen(c.rated)} z co najmniej ${nOpiniami(MIN_REVIEWS)} to ${fmtRating(c.avgRating)}${vsCatalog(c.avgRating, ref.avgRating, SAME_RATING, VS_RATING)}.`,
    );
    if (ref.bestRated.length === 1 && ref.bestRated[0].slug === c.slug) s.push("To najwyższa średnia w tabeli.");
  } else if (c.rated === 0) {
    s.push(`Żadne biuro nie ma tu jeszcze oceny z co najmniej ${nOpiniami(MIN_REVIEWS)}, więc średniej nie podajemy.`);
  } else {
    s.push(
      `Ocenę z co najmniej ${nOpiniami(MIN_REVIEWS)} ${verb(c.rated, "ma", "mają")} tylko ${nBiur(c.rated)}, to za mało na średnią dla miasta.`,
    );
  }

  if (c.withYears >= YEARS_MIN) {
    s.push(
      `Mediana stażu ${nBiurGen(c.withYears)} z datą w rejestrze to ${fmtYears(c.medianYears)}${vsCatalog(c.medianYears, ref.medianYears, SAME_YEARS, VS_YEARS)}.`,
    );
    if (ref.oldest.length === 1 && ref.oldest[0].slug === c.slug) s.push("To najdłuższy typowy staż w tabeli.");
  } else {
    s.push(
      c.withYears === 0
        ? "Daty rejestracji nie znamy dla żadnego biura z miasta, więc stażu nie podajemy."
        : `Datę rejestracji znamy tylko dla ${nBiurGen(c.withYears)}, więc stażu miasta nie podajemy.`,
    );
  }

  s.push(
    c.withPrices > 0
      ? `Cennik na stronie ${verb(c.withPrices, "ma", "mają")} ${nBiur(c.withPrices)} (${fmtShare(c.sharePrices)})${vsCatalog(c.sharePrices, ref.sharePrices, SAME_SHARE, VS_PRICES)}.`
      : "Żadne biuro z głównym wpisem w mieście nie publikuje cennika na stronie.",
  );

  if (c.commission != null) {
    s.push(
      `Mediana prowizji za sprzedaż z ${count(c.commissionN, "cennika", "cenników", "cenników")} to ${fmtRate(c.commission)}${vsCatalog(c.commission, ref.commission, SAME_RATE, VS_RATE)}.`,
    );
  } else if (c.commissionN > 0) {
    s.push(`Stawkę za sprzedaż ${verb(c.commissionN, "podaje", "podają")} tylko ${nBiur(c.commissionN)}, za mało na medianę prowizji.`);
  } else {
    s.push("Żadne biuro z miasta nie podaje w cenniku procentowej stawki za sprzedaż.");
  }
  return s.join(" ");
}

/** Jedno zdanie porównania dwóch miast dla wskaźnika z pairPoints. */
function pairLine(p: PairPoint, a: CityStats, b: CityStats): string | null {
  const who = (w: PairPoint["winner"]) => (w === "a" ? inCity(a.name) : inCity(b.name));
  switch (p.key) {
    case "firms":
      return `Liczba biur: ${a.name} ${nBiur(a.firms)}, ${b.name} ${nBiur(b.firms)}.`;
    case "rating":
      if (p.winner == null) return "Średnia ocena: w jednym z miast za mało biur z oceną, więc tego nie porównujemy.";
      return `Średnia ocena: ${a.name} ${fmtRating(a.avgRating)}, ${b.name} ${fmtRating(b.avgRating)}, ${p.winner === "tie" ? `różnica mniejsza niż ${fmtRating(SAME_RATING)}, czyli podobnie` : `wyżej ${who(p.winner)}`}.`;
    case "years":
      if (p.winner == null) return "Mediana stażu: w jednym z miast za mało dat z rejestru, więc tego nie porównujemy.";
      return `Mediana stażu: ${a.name} ${fmtYears(a.medianYears)}, ${b.name} ${fmtYears(b.medianYears)}, ${p.winner === "tie" ? "podobnie" : `dłużej działają biura ${who(p.winner)}`}.`;
    case "prices":
      if (p.winner == null) return null;
      return `Jawny cennik: ${a.name} ${fmtShare(a.sharePrices)}, ${b.name} ${fmtShare(b.sharePrices)}, ${p.winner === "tie" ? `różnica mniejsza niż ${SAME_SHARE} punktów procentowych` : `częściej ${who(p.winner)}`}.`;
    case "commission":
      if (p.winner == null) return "Mediana prowizji: w jednym z miast za mało cenników, więc tego nie porównujemy.";
      return `Mediana prowizji: ${a.name} ${fmtRate(a.commission)}, ${b.name} ${fmtRate(b.commission)}, ${p.winner === "tie" ? "podobnie" : `niższa ${who(p.winner)}`}.`;
    default:
      return null;
  }
}

export default async function BigCitiesPost() {
  const [data, report] = await Promise.all([loadBlogData().catch(() => null), commissionReport().catch(() => null)]);
  const top = (data?.cities ?? []).slice(0, TOP);
  const pairs = data ? cityPairs(data.cities) : [];
  const [first, second, third] = top;
  const last = top[top.length - 1];
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
    top.filter((c) => c.firms >= SHARE_MIN && (c.sharePrices ?? 0) > 0),
    (c) => c.sharePrices,
    (v) => Math.round(v),
  );

  // Wartości dla całego katalogu (punkt odniesienia dla miast).
  const total = data?.firms.length ?? 0;
  const cityCount = data?.cities.length ?? 0;
  const topFirms = top.reduce((sum, c) => sum + c.firms, 0);
  const singles = data ? data.cities.filter((c) => c.firms === 1).length : 0;
  const overview = data ? ratingOverview(data.firms) : null;
  const tenure = data ? tenureStats(data.firms, data.now) : null;
  const catWithPrices = data ? data.firms.filter((f) => f.hasPublicPrices).length : 0;
  const catSharePrices = total > 0 ? (100 * catWithPrices) / total : null;
  const catRating = overview && overview.solid >= CITY_COMPARE_MIN ? overview.avgRatingSolid : null;
  const catYears = tenure && tenure.withYears >= YEARS_MIN ? tenure.medianYears : null;
  const catCommission = report && report.n >= PRICE_STAT_MIN ? report.median : null;
  const ref: Ref = {
    avgRating: catRating,
    sharePrices: catSharePrices,
    medianYears: catYears,
    commission: catCommission,
    bestRated,
    oldest,
    topCount: top.length,
  };
  const refParts = [
    catRating != null ? `średnia ocena ${fmtRating(catRating)}` : null,
    catYears != null ? `mediana stażu ${fmtYears(catYears)}` : null,
    catSharePrices != null ? `jawny cennik u ${fmtShare(catSharePrices)} biur` : null,
    catCommission != null ? `mediana prowizji ${fmtRate(catCommission)}` : null,
  ].filter((x): x is string => x != null);
  const stamp = data ? `Źródło: katalog rankingbiurnieruchomosci.pl, stan na ${formatDate(data.now)}.` : "";

  // Oceny: miasta z tabeli z wystarczającą próbą, od najwyższej średniej.
  const league = ratingLeague(top);
  const hi = league[0];
  const lo = league[league.length - 1];
  const near = catRating != null ? league.filter((c) => Math.abs((c.avgRating as number) - catRating) < SAME_RATING).length : 0;

  // Cenniki: miasta z tabeli z co najmniej SHARE_MIN biurami, od najwyższego odsetka.
  const priceCities = top
    .filter((c) => c.firms >= SHARE_MIN && c.sharePrices != null)
    .sort((a, b) => (b.sharePrices as number) - (a.sharePrices as number) || b.firms - a.firms);
  const zeroPrices = priceCities.filter((c) => c.withPrices === 0).length;
  const withCommission = top.filter((c) => c.commission != null);
  const commissionCities = data ? data.cities.filter((c) => c.commission != null).length : 0;
  const exampleRows: { label: string; rate: number }[] =
    withCommission.length > 0
      ? withCommission.slice(0, 2).map((c) => ({ label: c.name, rate: c.commission as number }))
      : catCommission != null
        ? [{ label: "Cały katalog", rate: catCommission }]
        : [];

  // Przykład porównania pary: dwa największe miasta.
  const firstPair = first && second ? pairs.find((p) => p.a.slug === first.slug && p.b.slug === second.slug) : undefined;
  const pairLines = first && second ? pairPoints(first, second).map((p) => pairLine(p, first, second)).filter((l): l is string => l != null) : [];
  const pairCityCount = new Set(pairs.flatMap((p) => [p.a.slug, p.b.slug])).size;

  const commissionNote =
    cityCount > 0 ? `, a ten próg ${verb(commissionCities, "spełnia", "spełniają")} ${commissionCities} z ${cityCount} miejscowości w katalogu` : "";
  const bestText =
    league.length >= 2
      ? `Najwyższą średnią wśród ${nMiastGen(league.length)} z tabeli ma ${hi.name} (${fmtRating(hi.avgRating)}). Średnia miasta nic jednak nie mówi o konkretnym biurze, więc porównuj ocenę i liczbę opinii wybranych firm.`
      : `Średnią ocen miasta podajemy, gdy co najmniej ${nBiur(CITY_COMPARE_MIN)} ${plural(CITY_COMPARE_MIN, "ma", "mają", "ma")} w nim ocenę z co najmniej ${nOpiniami(MIN_REVIEWS)}.`;
  const faq = [
    {
      q: "W którym mieście jest najwięcej biur nieruchomości?",
      a:
        first && second && third
          ? `W naszym katalogu najwięcej biur jest ${inCity(first.name)}: ${nBiur(first.firms)}. Dalej są ${second.name} (${nBiur(second.firms)}) i ${third.name} (${nBiur(third.firms)}). Liczymy biura z własną, sprawdzoną stroną, a nie wszystkie firmy w mieście.`
          : "Zestawienie miast jest w przygotowaniu. Liczymy biura z własną, sprawdzoną stroną, a nie wszystkie firmy w mieście.",
    },
    {
      q: "Ile jest biur nieruchomości w moim mieście?",
      a: `Liczbę biur z katalogu podajemy na stronie każdego miasta${total > 0 ? `, łącznie ${nBiur(total)} ${inPlaces(cityCount)}` : ""}. Dodajemy tylko biura, których stronę sprawdziliśmy, więc w innych spisach firm bywa więcej.`,
      node: (
        <>
          Liczbę biur z katalogu podajemy na stronie każdego miasta (<Link href="/miasta">lista miast</Link>)
          {total > 0 ? `, łącznie ${nBiur(total)} ${inPlaces(cityCount)}` : ""}. Dodajemy tylko biura, których stronę
          sprawdziliśmy, więc w innych spisach firm bywa więcej.
        </>
      ),
    },
    {
      q: "Gdzie biura nieruchomości mają najlepsze opinie?",
      a: bestText,
      node: (
        <>
          {bestText} Pełne zestawienie:{" "}
          <Link href={blogPath("oceny-biur-nieruchomosci-w-miastach")}>ranking miast według opinii</Link>.
        </>
      ),
    },
    {
      q: "Czy w mniejszym mieście prowizja biura jest niższa?",
      a: `Nie da się tego rzetelnie stwierdzić. Medianę liczymy, gdy stawkę za sprzedaż ${plural(PRICE_STAT_MIN, "podaje", "podają", "podaje")} co najmniej ${nBiur(PRICE_STAT_MIN)}${commissionNote}. Ostateczna prowizja i tak wynika z umowy.`,
      node: (
        <>
          Nie da się tego rzetelnie stwierdzić. Medianę liczymy, gdy stawkę za sprzedaż{" "}
          {plural(PRICE_STAT_MIN, "podaje", "podają", "podaje")} co najmniej {nBiur(PRICE_STAT_MIN)}
          {commissionNote}. Ostateczna prowizja i tak wynika z umowy. Więcej:{" "}
          <Link href="/poradnik/ile-bierze-biuro-nieruchomosci">ile bierze biuro nieruchomości</Link>.
        </>
      ),
    },
    {
      q: "Czy biuro nieruchomości musi mieć licencję?",
      a: "Nie. Od 2014 r. licencja pośrednika nie jest wymagana. Pośrednik musi mieć ubezpieczenie OC, a umowa pośrednictwa wymaga formy pisemnej albo elektronicznej, inaczej jest nieważna. Trwają prace nad zmianami przepisów o pośrednictwie. Warunki współpracy wynikają z umowy i przepisów.",
    },
    {
      q: "Sieć czy lokalne biuro w dużym mieście?",
      a: "Dobre i słabe biura mogą być w obu grupach. Firmę z oddziałami liczymy w tabeli raz. Oceny, staż i cenniki obu grup porównujemy w osobnym artykule.",
      node: (
        <>
          Dobre i słabe biura mogą być w obu grupach. Firmę z oddziałami liczymy w tabeli raz. Oceny, staż i cenniki obu grup
          porównujemy w artykule{" "}
          <Link href={blogPath("siec-czy-lokalne-biuro-nieruchomosci")}>sieć czy lokalne biuro</Link>.
        </>
      ),
    },
  ];

  return (
    <BlogArticle post={post} extraLd={[faqLd(faq)]}>
      {first && second && third ? (
        <ShortAnswer>
          Porównaliśmy biura nieruchomości w miastach z największą liczbą wpisów w katalogu. Najwięcej jest ich{" "}
          {inCity(first.name)} ({nBiur(first.firms)}), {inCity(second.name)} ({nBiur(second.firms)}) i{" "}
          {inCity(third.name)} ({nBiur(third.firms)}).
          {bestRated.length === 1
            ? ` Z ${nMiastGen(league.length)} w tabeli, dla których liczymy średnią ocen, najwyżej oceniane biura ma ${bestRated[0].name} (średnio ${fmtRating(bestRated[0].avgRating)}).`
            : ""}
          {oldest.length > 0 && oldest.length <= 2
            ? ` Najdłuższy typowy staż mają biura ${names(oldest)}: mediana stażu w rejestrze to ${fmtYears(oldest[0].medianYears)}.`
            : ""}
          {mostPrices.length > 0 && mostPrices.length <= 2
            ? ` Cennik na stronie najczęściej publikują biura ${names(mostPrices)} (${mostPrices.length > 1 ? "po " : ""}${fmtShare(mostPrices[0].sharePrices)}).`
            : ""}
        </ShortAnswer>
      ) : (
        <ShortAnswer>
          Biura nieruchomości w miastach porównujemy na danych katalogu: liczba biur, oceny Google, staż i cenniki.
          Zestawienie jest w przygotowaniu.
        </ShortAnswer>
      )}

      {data && first && second && last && (
        <>
          <h2>W którym mieście jest najwięcej biur nieruchomości</h2>
          <p>
            {`W katalogu mamy ${nBiur(total)} ${inPlaces(cityCount)}. ${nMiast(top.length)} z największą liczbą biur ${plural(top.length, "skupia", "skupiają", "skupia")} ${fmtShare(total > 0 ? (100 * topFirms) / total : null)} z nich. Najwięcej jest ${inCity(first.name)}`}
            {first.firms > second.firms
              ? `, o ${fmtShare((100 * (first.firms - second.firms)) / second.firms)} więcej niż ${inCity(second.name)}.`
              : `, tyle samo co ${inCity(second.name)}.`}
            {` Zestawienie zamyka ${last.name} (${nBiur(last.firms)}).`}
            {singles > 0 ? ` Na drugim końcu katalogu ${verb(singles, "jest", "są")} ${nPlaces(singles)} z jednym biurem.` : ""}
          </p>
          <BarList
            title={`Liczba biur nieruchomości w katalogu: ${nMiast(top.length)} z największym wyborem`}
            caption={`Biura z głównym wpisem w mieście, firma z kilku miast liczona raz. ${stamp}`}
            rows={top.map((c) => ({ label: c.name, value: c.firms, note: `razem z oddziałami ${nEntries(c.listings)}` }))}
            format={(v) => v.toLocaleString("pl-PL")}
            valueHeader="Biura"
          />
          <p>
            Kolejność nie musi odpowiadać liczbie mieszkańców ani wielkości rynku. Zależy też od tego, ile biur ma własną stronę,
            którą sprawdziliśmy.
          </p>
        </>
      )}

      {top.length > 0 && (
        <>
          <h2>{nMiast(top.length)} z największą liczbą biur w katalogu</h2>
          <p>Nazwa miasta prowadzi do rankingu biur w tym mieście.</p>
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

      {top.length > 0 && (
        <>
          <h2>Pierwsze miasta zestawienia w liczbach</h2>
          <p>
            {refParts.length > 0 ? `Punkt odniesienia to cały katalog: ${refParts.join(", ")}. ` : ""}Różnice ocen mniejsze niż{" "}
            {fmtRating(SAME_RATING)}, odsetków mniejsze niż {SAME_SHARE} punktów procentowych, prowizji mniejsze niż{" "}
            {fmtRate(SAME_RATE).replace("%", "")} punktu procentowego i stażu mniejsze niż rok opisujemy jako podobne.
          </p>
          {top.slice(0, DESCRIBED).map((c, i) => (
            <Fragment key={c.slug}>
              <h3>
                {i + 1}. {c.name}
              </h3>
              <p>
                {cityText(c, i, ref)}{" "}
                <Link href={`/${c.slug}`}>Biura nieruchomości {inCity(c.name)}: ranking i lista</Link>.
              </p>
            </Fragment>
          ))}
        </>
      )}

      {league.length >= 2 && (
        <>
          <h2>Średnia ocena Google biur w dużych miastach</h2>
          <p>
            {`Średnią porównujemy dla ${nMiastGen(league.length)} z tabeli, w których próba jest wystarczająca. Najwyższą ma ${hi.name} (${fmtRating(hi.avgRating)}), najniższą ${lo.name} (${fmtRating(lo.avgRating)}).`}
            {(hi.avgRating as number) - (lo.avgRating as number) < SAME_RATING
              ? ` Różnica jest mniejsza niż ${fmtRating(SAME_RATING)}, więc oceny w tych miastach są w praktyce podobne.`
              : ` Różnica wynosi ${fmtRating((hi.avgRating as number) - (lo.avgRating as number))} gwiazdki.`}
            {catRating != null
              ? near > 0
                ? ` ${near} z ${nMiastGen(league.length)} ${plural(near, "mieści", "mieszczą", "mieści")} się w granicach ${fmtRating(SAME_RATING)} od średniej całego katalogu.`
                : ` Każde z tych miast różni się od średniej całego katalogu o co najmniej ${fmtRating(SAME_RATING)}.`
              : ""}
          </p>
          <DotPlot
            title="Średnia ocena Google biur nieruchomości w miastach"
            caption={`Zwykła średnia biur z co najmniej ${nOpiniami(MIN_REVIEWS)} w Google; miasta, w których jest co najmniej ${nBiur(CITY_COMPARE_MIN)} z taką oceną. ${stamp}`}
            rows={league.map((c) => ({ label: c.name, value: c.avgRating, note: `${nBiur(c.rated)} z oceną` }))}
            format={fmtRating}
            reference={catRating != null ? { value: catRating, label: "średnia całego katalogu" } : undefined}
            valueHeader="Średnia ocena"
          />
          <p>
            Średnia miasta to zwykła średnia biur, więc biuro z kilkunastoma opiniami waży w niej tyle samo co biuro z
            kilkuset. Dlaczego 5,0 z kilku opinii mówi mało,
            wyjaśniamy w artykule <Link href={blogPath("ocena-5-w-google-biuro-nieruchomosci")}>o ocenie 5,0 w Google</Link>.
          </p>
        </>
      )}

      {top.length > 0 && (
        <>
          <h2>Jawne cenniki i prowizje w dużych miastach</h2>
          {catSharePrices != null && (
            <p>
              {`Cennik na swojej stronie ${verb(catWithPrices, "publikuje", "publikują")} ${nBiur(catWithPrices)} z ${total.toLocaleString("pl-PL")} w katalogu, czyli ${fmtShare(catSharePrices)}.`}
              {priceCities.length >= 3
                ? ` Wśród ${nMiastGen(priceCities.length)} na wykresie najczęściej robią to biura ${inCity(priceCities[0].name)} (${fmtShare(priceCities[0].sharePrices)}), najrzadziej ${inCity(priceCities[priceCities.length - 1].name)} (${fmtShare(priceCities[priceCities.length - 1].sharePrices)}).`
                : ""}
              {zeroPrices > 1 ? ` W ${zeroPrices} z nich żadne biuro nie publikuje cennika.` : ""}
            </p>
          )}
          {priceCities.length >= 3 && (
            <BarList
              title="Odsetek biur z jawnym cennikiem na stronie"
              caption={`Biura z głównym wpisem w mieście, które publikują cennik na swojej stronie. Miasta z tabeli, w których katalog ma co najmniej ${nBiur(SHARE_MIN)}. ${stamp}`}
              rows={priceCities.map((c) => ({ label: c.name, value: c.sharePrices, note: `${c.withPrices} z ${nBiurGen(c.firms)}` }))}
              format={fmtShare}
              valueHeader="Jawny cennik"
            />
          )}
          <p>
            {withCommission.length > 0
              ? `Medianę prowizji za sprzedaż podajemy, gdy stawkę procentową ${plural(PRICE_STAT_MIN, "podaje", "podają", "podaje")} co najmniej ${nBiur(PRICE_STAT_MIN)}. W tabeli ten próg ${verb(withCommission.length, "spełnia", "spełniają")} ${nMiast(withCommission.length)}: ${withCommission.map((c) => `${c.name} ${fmtRate(c.commission)} (${count(c.commissionN, "cennik", "cenniki", "cenników")})`).join(", ")}.`
              : `W żadnym z tych miast stawki za sprzedaż nie ${plural(PRICE_STAT_MIN, "podaje", "podają", "podaje")} jeszcze co najmniej ${nBiur(PRICE_STAT_MIN)}, więc mediany dla miast nie podajemy.`}
            {catCommission != null && report ? ` Mediana z cenników ${nBiurGen(report.n)} z całego katalogu to ${fmtRate(catCommission)}.` : ""}{" "}
            To stawki deklarowane w cennikach, często „od”, a nie kwoty z podpisanych umów. Biura podają je netto albo
            brutto. Szczegóły w <Link href="/raporty/prowizje-biur-nieruchomosci-2026">raporcie prowizji 2026</Link>, a
            listę firm w zestawieniu <Link href="/poradnik/biura-z-jawnym-cennikiem">biura z jawnym cennikiem</Link>.
          </p>
          {exampleRows.length > 0 && (
            <Example title={`Przykład: prowizja przy mieszkaniu za ${fmtPln(EXAMPLE_PRICE)}`}>
              <p>Cena to przykład, a nie średnia cena w tych miastach. Stawka to mediana z cenników biur:</p>
              <ul>
                {exampleRows.map((r) => (
                  <li key={r.label}>
                    {`${r.label}: ${fmtPln(EXAMPLE_PRICE)} × ${fmtRate(r.rate)} = ${fmtPln((EXAMPLE_PRICE * r.rate) / 100)}. Jeśli stawka jest netto, z ${VAT}% VAT zapłacisz ${fmtPln(((EXAMPLE_PRICE * r.rate) / 100) * (1 + VAT / 100))}.`}
                  </li>
                ))}
              </ul>
              <p>
                Biuro zwolnione z VAT nie dolicza podatku. Własną kwotę policzysz w{" "}
                <Link href={blogPath("sprzedaz-mieszkania-z-biurem-czy-samemu")}>kalkulatorze prowizji</Link>.
              </p>
            </Example>
          )}
        </>
      )}

      <h2>Co oznacza każdy wskaźnik w tabeli</h2>
      <ul className="plain">
        <li>
          <b>Biura</b> to firmy, z których możesz u nas wybierać, a nie cały rynek.
        </li>
        <li>
          <b>Średnia ocena</b> mówi, jak klienci oceniają typowe biuro w mieście. Liczymy tylko biura z co najmniej{" "}
          {nOpiniami(MIN_REVIEWS)}, bo przy kilku opiniach jedna recenzja zmienia wynik.
        </li>
        <li>
          <b>Mediana stażu</b> liczona jest od daty wpisu do rejestru: połowa biur ma krótszy staż, połowa dłuższy.{" "}
          <b>Działa 10+ lat</b> to odsetek biur z co najmniej 10 latami stażu. Długi staż nie gwarantuje jakości, ale
          pokazuje, że firma od lat jest w rejestrze. Więcej:{" "}
          <Link href={blogPath("najdluzej-dzialajace-biura-nieruchomosci")}>najdłużej działające biura</Link>.
        </li>
        <li>
          <b>Jawny cennik</b> oznacza, że biuro podaje stawki na swojej stronie. Takie biura łatwiej porównać przed pierwszym
          telefonem.
        </li>
        <li>
          <b>Oferty na stronie</b> to odsetek biur, na których stronie nasz robot znalazł ogłoszenia. Robot czyta najwyżej{" "}
          {OFFERS_SAMPLE_MAX} najnowszych ogłoszeń z jednej strony. Przeglądasz je w zakładce{" "}
          <Link href="/oferty">oferty biur</Link>.
        </li>
        <li>
          <b>Prowizja</b> to mediana najniższych stawek za sprzedaż z cenników, a nie cena transakcyjna. Jak liczymy wynik
          biura w rankingu, opisuje <Link href="/metodologia">metodologia</Link>.
        </li>
      </ul>

      <h2>Jak korzystać z porównania miast</h2>
      <ol>
        <li>
          Zacznij od strony swojego miasta z <Link href="/miasta">listy miast</Link>.
        </li>
        <li>Porównuj miasta tylko tam, gdzie próba wystarcza. Kreska w tabeli znaczy „za mało danych”, a nie „słaby wynik”.</li>
        <li>
          Wybierz 3-5 biur z wysoką oceną przy wielu opiniach. Sprawdź je w <Link href="/ranking">rankingu</Link> i w{" "}
          <Link href="/wyroznienia-2026">wyróżnieniach 2026</Link>.
        </li>
        <li>
          Sprawdź firmę w rejestrze i poproś o numer polisy OC. Instrukcja:{" "}
          <Link href="/poradnik/jak-sprawdzic-biuro-nieruchomosci">jak sprawdzić biuro</Link>.
        </li>
        <li>
          Na stronie miasta zaznacz „Porównaj” przy najwyżej trzech biurach. <Link href="/porownaj">Porównywarka</Link>{" "}
          pokaże je obok siebie.
        </li>
      </ol>
      <h3>Najczęstsze błędy przy czytaniu zestawienia</h3>
      <ul>
        <li>Porównywanie stawki netto z brutto. Przy {VAT}% VAT różnica to prawie jedna czwarta kwoty.</li>
        <li>Mylenie stażu firmy z doświadczeniem agenta, który poprowadzi twoją transakcję.</li>
      </ul>
      {first && second && pairLines.length > 0 && (
        <Example title={`Przykład: ${first.name} czy ${second.name}`}>
          <ul>
            {pairLines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          <p>
            Najpierw sprawdź próbę, potem wielkość różnicy, dopiero na końcu wyciągaj wnioski.
            {firstPair ? (
              <>
                {" "}
                Pełne porównanie:{" "}
                <Link href={blogPath(`porownanie/${firstPair.slug}`)}>
                  {firstPair.a.name} czy {firstPair.b.name}
                </Link>
                .
              </>
            ) : null}
          </p>
        </Example>
      )}
      <Checklist
        title="Lista kontrolna: wybór biura w dużym mieście"
        items={[
          `Biuro ma w Google co najmniej ${nOpinii(MIN_REVIEWS)}, a ty znasz najnowsze, także krytyczne.`,
          "NIP biura zgadza się z wpisem w KRS albo w wykazie VAT.",
          "Masz stawkę prowizji na piśmie i wiesz, czy jest netto, czy brutto.",
          <>
            Wiesz, kto płaci prowizję: sprzedający, kupujący czy obie strony (
            <Link href={blogPath("czy-kupujacy-placi-prowizje-biuru-nieruchomosci")}>czy kupujący płaci prowizję</Link>).
          </>,
          "Umowa pośrednictwa jest na piśmie albo elektroniczna i określa zakres usług i czas trwania.",
          "Masz numer polisy OC pośrednika.",
        ]}
      />

      {pairs.length > 0 && (
        <>
          <h2>Porównaj dwa miasta</h2>
          <p>
            Porównania par mamy dla {nMiastGen(pairCityCount)} z największą liczbą biur: liczba biur, oceny, staż, cenniki i
            prowizje obok siebie.
          </p>
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

      <Faq items={faq} />
    </BlogArticle>
  );
}
