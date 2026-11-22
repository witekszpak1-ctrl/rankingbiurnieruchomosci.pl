import type { Metadata } from "next";
import Link from "next/link";

import { BlogArticle, Checklist, Example, Faq, ShortAnswer, faqLd } from "@/components/BlogArticle";
import { BarList, Columns, DotPlot } from "@/components/BlogCharts";
import { blogMetadata, blogPath, fmtInt, fmtRating, fmtShare, getPost } from "@/lib/blog";
import {
  CITY_COMPARE_MIN,
  MIN_REVIEWS,
  SAME_RATING,
  SAME_SHARE,
  YEARS_MIN,
  cityPairs,
  hasSolidRating,
  loadBlogData,
  tenureStats,
  yearsSince,
  type Firm,
} from "@/lib/blog-stats";
import { inCity } from "@/lib/cities";
import { formatDate, formatYear } from "@/lib/format";
import { nBiur, nBiurGen, nLat, nLatGen, nMiast, nOpiniami, plural } from "@/lib/plural";
import { PARAMETERS, median, scoreListing, weightShare } from "@/lib/ranking";

export const revalidate = 86400;

const post = getPost("najdluzej-dzialajace-biura-nieruchomosci");

export const metadata: Metadata = blogMetadata(post);

/** Wykaz podatników VAT zaczyna się od wprowadzenia VAT (5 lipca 1993 r.): wcześniejszych dat w tym źródle nie ma. */
const VAT_START_YEAR = "1993";
/** Zestawienie (lista najstarszych, rozkład stażu) pokazujemy od tylu firm ze znaną datą rejestracji. */
const MIN_DATED = 30;
/** Ile miast pokazują wykres mediany stażu i tabela miast. */
const CHART_CITIES = 15;
/** Ile porównań par miast linkujemy. */
const PAIR_LINKS = 3;
/** Staż w przykładzie punktacji rankingu (przykład, nie dane). */
const EXAMPLE_YEARS = [2, 8] as const;
/** Różnicę stażu mniejszą niż rok opisujemy jako podobną (tak jak w porównaniach par miast). */
const SAME_YEARS = 1;
const YEAR_MS = 365.25 * 24 * 3600 * 1000;

/** Przedziały stażu: od `min` lat (włącznie) do `max` lat (bez). */
const BUCKETS = [
  { label: "poniżej 3 lat", min: 0, max: 3 },
  { label: "3-10 lat", min: 3, max: 10 },
  { label: "10-20 lat", min: 10, max: 20 },
  { label: "20 lat i więcej", min: 20, max: Infinity },
] as const;

type Dated = Firm & { years: number };

type Group = {
  label: string;
  firms: number;
  /** Odsetek wszystkich firm ze znaną datą. */
  share: number | null;
  /** Firmy z oceną od MIN_REVIEWS opinii i ich zwykła średnia. */
  rated: number;
  avgRating: number | null;
  /** Firmy z jakąkolwiek oceną Google i mediana ich liczby opinii. */
  withRating: number;
  medianReviews: number | null;
  sharePrices: number | null;
};

const fmt1 = (v: number) => v.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pct = (part: number, whole: number) => (whole > 0 ? (100 * part) / whole : null);
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
/** Dopełniacz po "z": "z 1 miasta", "z 12 miast". */
const nMiastGen = (n: number) => `${n.toLocaleString("pl-PL")} ${n === 1 ? "miasta" : "miast"}`;

/** Staż z jednym miejscem po przecinku: "4 lata", "12 lat", "12,4 roku". */
function yearsText(v: number): string {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? nLat(r) : `${fmt1(r)} roku`;
}

function groupOf(label: string, list: Dated[], total: number): Group {
  const rated = list.filter(hasSolidRating);
  const withRating = list.filter((f) => f.googleRating != null);
  return {
    label,
    firms: list.length,
    share: pct(list.length, total),
    rated: rated.length,
    avgRating: mean(rated.map((f) => f.googleRating as number)),
    withRating: withRating.length,
    medianReviews: median(withRating.map((f) => f.googleCount ?? 0)),
    sharePrices: pct(list.filter((f) => f.hasPublicPrices).length, list.length),
  };
}

/** Punkty rankingu (na 100, przy komplecie danych) za staż biura z podaną liczbą lat, liczone tą samą funkcją co ranking. */
function stazPoints(years: number, now: Date): number | null {
  const start = new Date(now.getTime() - years * YEAR_MS);
  const s = scoreListing({ startDate: start, hasPublicPrices: false, verificationScore: null, servicesCount: 0 }, now);
  const item = s.breakdown.find((b) => b.key === "staz");
  return item ? item.value * weightShare(item.weight) : null;
}

export default async function OldestFirmsPost() {
  const data = await loadBlogData().catch(() => null);
  const t = data ? tenureStats(data.firms, data.now) : null;
  const ok = t != null && t.withYears >= MIN_DATED;
  const now = data?.now ?? new Date();
  const cities = (data?.cities ?? [])
    .filter((c) => c.withYears >= YEARS_MIN && c.medianYears != null)
    .sort((a, b) => (b.medianYears as number) - (a.medianYears as number));
  const first = t?.oldest[0];
  const firstYear = first ? formatYear(first.startDate) : null;
  /** Dokładna najwcześniejsza data ("5 lipca 1993"): remis `oldestTied` liczymy po dacie, a nie po roku. */
  const firstDate = first ? formatDate(first.startDate) : null;
  const lastOld = t && t.oldest.length > 0 ? t.oldest[t.oldest.length - 1] : null;
  const lastYear = lastOld ? formatYear(lastOld.startDate) : null;
  const oldestN = t?.oldest.length ?? 0;
  const tied = t?.oldestTied ?? 0;

  // Wszystkie firmy ze znaną datą rejestracji (każda raz, z głównego wpisu).
  const dated: Dated[] =
    ok && data
      ? data.firms.map((f) => ({ ...f, years: yearsSince(f.startDate, now) })).filter((f): f is Dated => f.years != null)
      : [];
  const total = data?.firms.length ?? 0;
  const coverage = ok && t ? pct(t.withYears, total) : null;
  const medianYears = t?.medianYears ?? null;
  const meanYears = mean(dated.map((f) => f.years));
  const newLastYear = dated.filter((f) => f.years < 1).length;
  const vatCap = dated.filter((f) => formatYear(f.startDate) === VAT_START_YEAR).length;

  // Lista najstarszych: z ilu miast i ile ma ocenę z wystarczającej liczby opinii.
  const topCities = t ? new Set(t.oldest.map((f) => f.citySlug)).size : 0;
  const topSolid = t ? t.oldest.filter(hasSolidRating).length : 0;

  // Przedziały stażu: rozkład, oceny, liczba opinii i cenniki (grupa porównywana od progów próby).
  const groups = BUCKETS.map((b) => groupOf(b.label, dated.filter((f) => f.years >= b.min && f.years < b.max), dated.length));
  const biggest = dated.length ? [...groups].sort((a, b) => b.firms - a.firms)[0] : null;
  const ratedGroups = groups.filter((g) => g.rated >= CITY_COMPARE_MIN && g.avgRating != null);
  const young = ratedGroups.length >= 2 ? ratedGroups[0] : null;
  const old = ratedGroups.length >= 2 ? ratedGroups[ratedGroups.length - 1] : null;
  const ratingDiff = young && old ? (old.avgRating as number) - (young.avgRating as number) : null;
  const reviewGroups = groups.filter((g) => g.withRating >= CITY_COMPARE_MIN && g.medianReviews != null);
  const revYoung = reviewGroups.length >= 2 ? reviewGroups[0] : null;
  const revOld = reviewGroups.length >= 2 ? reviewGroups[reviewGroups.length - 1] : null;
  const priceGroups = groups.filter((g) => g.firms >= YEARS_MIN && g.sharePrices != null);
  const pYoung = priceGroups.length >= 2 ? priceGroups[0] : null;
  const pOld = priceGroups.length >= 2 ? priceGroups[priceGroups.length - 1] : null;
  const priceDiff = pYoung && pOld ? (pOld.sharePrices as number) - (pYoung.sharePrices as number) : null;
  const refAvg = mean(dated.filter(hasSolidRating).map((f) => f.googleRating as number));

  // Najstarsze biuro w każdym mieście z tabeli (remis w tym samym roku: alfabetycznie, z liczbą pozostałych).
  const datedByCity = new Map<string, Dated[]>();
  for (const f of dated) datedByCity.set(f.citySlug, [...(datedByCity.get(f.citySlug) ?? []), f]);
  const oldestIn = (slug: string) => {
    const list = [...(datedByCity.get(slug) ?? [])].sort((a, b) => b.years - a.years || a.name.localeCompare(b.name, "pl"));
    const f = list[0];
    if (!f) return null;
    const year = formatYear(f.startDate);
    return { firm: f, year, sameYear: list.filter((x) => formatYear(x.startDate) === year).length - 1 };
  };
  const longest = cities[0];
  const shortest = cities.length >= 2 ? cities[cities.length - 1] : null;
  const citySpread = longest && shortest ? (longest.medianYears as number) - (shortest.medianYears as number) : null;

  // Staż w rankingu: waga i punkty z tej samej funkcji, którą liczony jest ranking.
  const staz = PARAMETERS.find((p) => p.key === "staz");
  const prices = PARAMETERS.find((p) => p.key === "jawnosc_cennika");
  const fullPts = staz ? weightShare(staz.weight) : null;
  const exPts = EXAMPLE_YEARS.map((y) => stazPoints(y, now));
  let fullYears: number | null = null;
  for (let n = 1; n <= 60 && fullPts != null; n++) {
    const p = stazPoints(n, now);
    if (p != null && p >= fullPts - 1e-9) {
      fullYears = n;
      break;
    }
  }
  const rankingOk = fullPts != null && fullYears != null && exPts.every((p) => p != null);

  const pairs = data ? cityPairs(data.cities).slice(0, PAIR_LINKS) : [];

  const faq = [
    {
      q: "Które biuro nieruchomości działa najdłużej?",
      a:
        ok && first
          ? `${
              tied > 1
                ? `Najwcześniejszą datę rejestracji w naszym katalogu (${firstDate} r.) ${plural(tied, "ma", "mają", "ma")} ${nBiur(tied)}, między innymi ${first.name} (${first.cityName}).`
                : `Najwcześniejszą datę rejestracji w naszym katalogu ma ${first.name} (${first.cityName}): ${firstDate} r.`
            }${firstYear === VAT_START_YEAR ? " To pierwszy rok w wykazie podatników VAT, więc firma może działać jeszcze dłużej." : ""}`
          : `Zestawienie jest w przygotowaniu. Pokażemy je, gdy poznamy datę rejestracji co najmniej ${nBiurGen(MIN_DATED)} z katalogu.`,
    },
    {
      q: "Jak długo działa typowe biuro nieruchomości?",
      a:
        ok && t && medianYears != null
          ? `Mediana stażu w rejestrze to ${yearsText(medianYears)}. Co najmniej 10 lat ma ${fmtShare(t.share10y)} biur ze znaną datą, a ${fmtShare(t.shareUnder3y)} zarejestrowano w ostatnich 3 latach.`
          : "Liczymy to z dat wpisu do KRS i wykazu podatników VAT. Teraz danych jest za mało, żeby podać typowy staż.",
    },
    {
      q: "Jak sprawdzić, od kiedy działa biuro nieruchomości?",
      a: "Weź NIP biura. Spółkę sprawdzisz w KRS, jednoosobową działalność w CEIDG (biznes.gov.pl), a rejestrację do VAT w wykazie podatników VAT (podatki.gov.pl). Wyszukiwarki są bezpłatne.",
      node: (
        <>
          Weź NIP biura. Spółkę sprawdzisz w KRS, jednoosobową działalność w CEIDG (biznes.gov.pl), a rejestrację do VAT w
          wykazie podatników VAT (podatki.gov.pl). Wyszukiwarki są bezpłatne. Więcej w poradniku{" "}
          <Link href="/poradnik/jak-sprawdzic-biuro-nieruchomosci">jak sprawdzić biuro nieruchomości</Link>.
        </>
      ),
    },
    {
      q: "Czy starsze biuro nieruchomości jest lepsze?",
      a:
        young && old
          ? `Nie musi. Biura z przedziału ${old.label} w rejestrze mają średnią ocenę Google ${fmtRating(old.avgRating)}, a z przedziału ${young.label} ${fmtRating(young.avgRating)} (biura z co najmniej ${nOpiniami(MIN_REVIEWS)}). Staż nie mówi, kto poprowadzi twoją sprawę.`
          : "Nie musi. Staż mówi, że firma utrzymała się na rynku, ale nie mówi, kto poprowadzi twoją sprawę.",
    },
    {
      q: "Czy warto skorzystać z nowego biura nieruchomości?",
      a: "Tak, jeśli prowadzi je doświadczony pośrednik. Zapytaj, gdzie wcześniej pracował. Nowe biuro ma często mało opinii, więc jego ocena Google mówi mniej.",
      node: (
        <>
          Tak, jeśli prowadzi je doświadczony pośrednik. Zapytaj, gdzie wcześniej pracował. Nowe biuro ma często mało opinii,
          więc jego ocena Google mówi mniej (zobacz{" "}
          <Link href={blogPath("ocena-5-w-google-biuro-nieruchomosci")}>czy ocena 5,0 oznacza najlepsze biuro</Link>).
        </>
      ),
    },
    {
      q: "Czy pośrednik nieruchomości musi mieć licencję?",
      a: "Nie. Od 2014 r. państwowa licencja pośrednika nie jest wymagana, ale pośrednik musi mieć ubezpieczenie OC, więc poproś o numer polisy. Szczegóły wynikają z aktualnych przepisów i z umowy.",
    },
  ];

  return (
    <BlogArticle post={post} extraLd={[faqLd(faq)]}>
      {ok && t && first ? (
        <ShortAnswer>
          {`Najdłużej działające biura nieruchomości w naszym katalogu, czyli ${oldestN} ${plural(oldestN, "firma", "firmy", "firm")} z najwcześniejszą datą wpisu do rejestru, zarejestrowano ${firstYear === lastYear ? `w ${firstYear} r.` : `w latach ${firstYear}-${lastYear}.`}`}{" "}
          {tied > 1 ? (
            <>
              Najwcześniejszą datę wpisu ({firstDate} r.) {plural(tied, "ma", "mają", "ma")} {nBiur(tied)}, między innymi{" "}
              {first.name} ({first.cityName}).
            </>
          ) : (
            <>
              Najwcześniejszą datę wpisu ma {first.name} ({first.cityName}): {firstDate} r.
            </>
          )}
          {firstYear === VAT_START_YEAR ? " Wykaz podatników VAT obejmuje firmy od lipca 1993 roku, więc część z nich może działać jeszcze dłużej." : ""}{" "}
          Typowe biuro nieruchomości jest w rejestrze od {nLatGen(Math.floor(t.medianYears ?? 0))}: 10 lat lub dłużej
          ma {fmtShare(t.share10y)} firm, 20 lat lub dłużej {fmtShare(t.share20y)}, a {fmtShare(t.shareUnder3y)} to firmy
          zarejestrowane w ostatnich 3 latach. Dane z rejestrów dla {nBiurGen(t.withYears)}.
        </ShortAnswer>
      ) : (
        <ShortAnswer>
          Najdłużej działające biura nieruchomości pokażemy, gdy poznamy datę rejestracji co najmniej {nBiurGen(MIN_DATED)}{" "}
          z katalogu. Na razie danych jest za mało, żeby je pokazać.
        </ShortAnswer>
      )}

      {ok && t && t.oldest.length > 0 && (
        <>
          <h2>Biura z najdłuższym stażem w rejestrze</h2>
          <p>
            {`Tabela pokazuje ${oldestN} ${plural(oldestN, "firmę", "firmy", "firm")} z najwcześniejszą datą wpisu do KRS albo wykazu podatników VAT. Pochodzą z ${nMiastGen(topCities)}.${topSolid > 0 ? ` Ocenę Google z co najmniej ${nOpiniami(MIN_REVIEWS)} ${plural(topSolid, "ma", "mają", "ma")} ${topSolid} ${plural(topSolid, "firma", "firmy", "firm")} z listy.` : ""}`}{" "}
            Najstarsze biuro nie musi mieć najwyższego wyniku w <Link href="/ranking">rankingu biur nieruchomości</Link>.
          </p>
          <p className="note">
            To data wpisu do rejestru, a nie zawsze początek działalności. Rok {VAT_START_YEAR} oznacza „{VAT_START_YEAR}{" "}
            lub wcześniej”. Kolejność według dokładnej daty wpisu, a przy tej samej dacie alfabetyczna.
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

      {ok && t && medianYears != null && (
        <>
          <h2>Jak długo działa typowe biuro nieruchomości</h2>
          <p>
            {`Datę wpisu do rejestru znamy dla ${nBiurGen(t.withYears)}${coverage != null ? `, czyli ${fmtShare(coverage)} firm z katalogu` : ""}. Mediana stażu to ${yearsText(medianYears)}: połowa z nich jest w rejestrze krócej, a połowa dłużej.`}
            {meanYears != null
              ? meanYears - medianYears >= SAME_YEARS
                ? ` Średnia jest wyższa (${yearsText(meanYears)}), bo zawyżają ją najstarsze firmy.`
                : medianYears - meanYears >= SAME_YEARS
                  ? ` Średnia jest niższa (${yearsText(meanYears)}), bo zaniżają ją młode firmy.`
                  : ` Średnia jest podobna: ${yearsText(meanYears)}.`
              : ""}
          </p>
          <Columns
            title="Biura nieruchomości według stażu w rejestrze"
            rows={groups.map((g) => ({ label: g.label, value: g.share, note: nBiur(g.firms) }))}
            format={(v) => fmtShare(v)}
            caption={`Odsetek ${nBiurGen(t.withYears)} z katalogu ze znaną datą wpisu do KRS albo wykazu podatników VAT. Przedział 3-10 lat to co najmniej 3 i mniej niż 10 lat.`}
            valueHeader="Odsetek biur"
          />
          <p>
            {biggest ? `Najwięcej biur jest w przedziale ${biggest.label} (${fmtShare(biggest.share)}).` : ""}
            {newLastYear > 0
              ? ` Datę z ostatnich 12 miesięcy ${plural(newLastYear, "ma", "mają", "ma")} ${nBiur(newLastYear)}.`
              : " Żadne biuro z katalogu nie ma daty z ostatnich 12 miesięcy."}
            {vatCap > 0
              ? ` Rok ${VAT_START_YEAR} ${plural(vatCap, "ma", "mają", "ma")} ${nBiur(vatCap)}, które mogą działać jeszcze dłużej.`
              : ""}{" "}
            Nowa firma to czasem agent z innego biura albo biuro po zmianie formy prawnej. W katalogu są tylko biura z własną
            stroną internetową, więc najmłodszych firm może w nim być mniej niż na rynku.
          </p>
          <Example title="Przykład: dlaczego podajemy medianę, a nie średnią">
            <p>
              Pięć biur ma staż 1, 2, 4, 15 i 30 lat. Średnia to (1 + 2 + 4 + 15 + 30) / 5 = 10,4 roku, choć trzy z pięciu
              działają krócej niż 5 lat. Mediana, czyli środkowa wartość, to 4 lata. To przykład, a nie dane z katalogu.
            </p>
          </Example>
        </>
      )}

      {cities.length > 0 && (
        <>
          <h2>Staż biur w miastach</h2>
          <p>
            {`Medianę stażu liczymy dla miast, w których znamy datę rejestracji co najmniej ${nBiurGen(YEARS_MIN)}. W zestawieniu ${plural(cities.length, "jest", "są", "jest")} ${nMiast(cities.length)}.`}
            {longest && shortest && citySpread != null
              ? citySpread >= SAME_YEARS
                ? ` Najdłuższą medianę mają biura ${inCity(longest.name)} (${yearsText(longest.medianYears as number)}), a najkrótszą ${inCity(shortest.name)} (${yearsText(shortest.medianYears as number)}).`
                : " We wszystkich miastach zestawienia mediana jest podobna: różnica nie przekracza roku."
              : ""}{" "}
            Wyższa mediana znaczy tylko, że w katalogu jest tam więcej firm z dłuższym stażem, a nie że biura są lepsze.
          </p>
          {cities.length >= 2 && (
            <BarList
              title="Mediana stażu biur nieruchomości w miastach (w latach)"
              rows={cities.slice(0, CHART_CITIES).map((c) => ({
                label: c.name,
                value: c.medianYears,
                note: `${nBiur(c.withYears)} z datą rejestracji`,
              }))}
              format={(v) => fmt1(v)}
              caption={`Mediana lat od wpisu do KRS albo wykazu podatników VAT. ${cities.length > CHART_CITIES ? `${CHART_CITIES} miast z najdłuższym stażem spośród ${nMiastGen(cities.length)}` : "Miasta"}, w których znamy datę rejestracji co najmniej ${nBiurGen(YEARS_MIN)}. Każde biuro liczymy raz, w mieście głównego wpisu.`}
              valueHeader="Mediana stażu (lata)"
            />
          )}
          <p className="note">Miasta od najdłuższej mediany. „+N” to liczba innych firm z tym samym rokiem co najstarsze biuro.</p>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Miasto</th>
                  <th className="num">Mediana stażu</th>
                  <th className="num">Działa 10+ lat</th>
                  <th className="num">Poniżej 3 lat</th>
                  <th className="num">Biura z datą</th>
                  <th>Najstarsze biuro</th>
                </tr>
              </thead>
              <tbody>
                {cities.slice(0, CHART_CITIES).map((c) => {
                  const o = oldestIn(c.slug);
                  return (
                    <tr key={c.slug}>
                      <td>
                        <Link href={`/${c.slug}`}>{c.name}</Link>
                      </td>
                      <td className="num">{yearsText(c.medianYears as number)}</td>
                      <td className="num">{fmtShare(c.share10y)}</td>
                      <td className="num">{fmtShare(c.shareUnder3y)}</td>
                      <td className="num">{c.withYears}</td>
                      <td>
                        {o ? (
                          <>
                            <Link href={`/${o.firm.citySlug}/${o.firm.slug}`}>{o.firm.name}</Link> ({o.year}
                            {o.sameYear > 0 ? `, +${o.sameYear}` : ""})
                          </>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p>
            Wszystkie miasta znajdziesz na stronie <Link href="/miasta">Miasta</Link>, a największe porównujemy w artykule{" "}
            <Link href={blogPath("biura-nieruchomosci-w-najwiekszych-miastach")}>biura nieruchomości w największych miastach</Link>
            .
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

      <h2>Skąd są daty i kiedy nie oznaczają początku działalności</h2>
      <p>
        Dla spółek z Krajowego Rejestru Sądowego bierzemy datę wpisu do KRS, a dla pozostałych firm (na przykład
        jednoosobowych działalności) datę rejestracji jako podatnik VAT z wykazu Ministerstwa Finansów. Firmę odnajdujemy po
        NIP ze strony biura. Taka data nie zawsze jest początkiem działalności:
      </p>
      <ul className="plain">
        <li>
          <b>KRS działa od 1 stycznia 2001 r.</b> Starsze spółki przenoszono do niego z dawnych rejestrów, więc mają
          późniejszą datę.
        </li>
        <li>
          <b>Wykaz VAT zaczyna się 5 lipca 1993 r.</b>, w dniu wprowadzenia VAT w Polsce. Wcześniejszej daty w nim nie ma.
        </li>
        <li>
          <b>Rejestracja do VAT po starcie.</b> Firma mogła zostać podatnikiem VAT później.
        </li>
        <li>
          <b>Zmiana formy prawnej.</b> Gdy jednoosobowa działalność staje się spółką, rejestr pokazuje datę powstania spółki.
        </li>
        <li>
          <b>Marka starsza niż firma.</b> Nazwa biura może być starsza niż spółka, która dziś podpisuje umowy.
        </li>
      </ul>
      <Example title="Przykład: na stronie „od 1998 roku”, w rejestrze 2012 rok">
        <p>
          Biuro pisze, że działa od 1998 r., a w profilu ma wpis do KRS z 2012 r. Możliwe, że właściciel prowadził wcześniej
          jednoosobową działalność. Zapytaj o NIP dawnej firmy i sprawdź go w CEIDG. Stroną umowy będzie jednak spółka z
          2012 r. To przykład, a nie prawdziwe biuro.
        </p>
      </Example>

      <h2>Czy staż ma znaczenie przy wyborze biura</h2>
      <p>
        Staż nie gwarantuje dobrej obsługi, ale coś mówi. Firma, która działa kilkanaście lat, przetrwała wahania rynku i
        ma reputację do stracenia. Nowe biuro może być równie dobre, zwłaszcza gdy założył je
        doświadczony agent z innej firmy. Wtedy zapytaj o jego doświadczenie i przykłady transakcji.
      </p>
      {young && old && ratingDiff != null && (
        <>
          <p>
            {`Średnia ocena Google biur z co najmniej ${nOpiniami(MIN_REVIEWS)} wynosi ${fmtRating(young.avgRating)} w przedziale ${young.label} i ${fmtRating(old.avgRating)} w przedziale ${old.label}${Math.abs(ratingDiff) < SAME_RATING ? ", czyli praktycznie tyle samo" : ""}.`}
            {revYoung && revOld && (revOld.medianReviews as number) > (revYoung.medianReviews as number)
              ? ` Mediana liczby opinii to ${fmtInt(revOld.medianReviews)} w przedziale ${revOld.label} i ${fmtInt(revYoung.medianReviews)} w przedziale ${revYoung.label}: starsze biura mogły mieć więcej czasu, żeby je zebrać.`
              : ""}
            {pYoung && pOld && priceDiff != null
              ? ` Cennik na stronie publikuje ${fmtShare(pYoung.sharePrices)} biur w przedziale ${pYoung.label} i ${fmtShare(pOld.sharePrices)} w przedziale ${pOld.label}${Math.abs(priceDiff) < SAME_SHARE ? ", czyli podobnie" : ""}.`
              : ""}
            {Math.abs(ratingDiff) >= SAME_RATING
              ? " To zależność, a nie przyczyna: nie wiemy, czy ocena zależy od stażu, czy staż od jakości obsługi."
              : " Sam staż mówi więc niewiele o tym, jak klienci oceniają biuro."}
          </p>
          <DotPlot
            title="Średnia ocena Google biur nieruchomości według stażu w rejestrze"
            rows={ratedGroups.map((g) => ({ label: g.label, value: g.avgRating, note: `${nBiur(g.rated)} w próbie` }))}
            format={(v) => fmtRating(v)}
            reference={refAvg != null ? { value: refAvg, label: "średnia wszystkich biur ze znaną datą w próbie" } : undefined}
            caption={`Zwykła średnia ocen biur z co najmniej ${nOpiniami(MIN_REVIEWS)}, przedział od ${nBiurGen(CITY_COMPARE_MIN)} w próbie. Staż z KRS albo wykazu VAT, oceny z profili biur w Mapach Google.`}
            valueHeader="Średnia ocena"
          />
        </>
      )}
      <h3>Kiedy staż waży więcej</h3>
      <ul className="plain">
        <li>
          <b>Umowa na wyłączność.</b> Wiążesz się z jednym biurem na kilka miesięcy, więc liczy się stabilna firma.
        </li>
        <li>
          <b>Zarządzanie najmem.</b> Współpraca trwa latami, a biuro często pośredniczy w płatnościach czynszu (stawki w
          artykule <Link href={blogPath("prowizja-za-wynajem-mieszkania")}>prowizja za wynajem mieszkania</Link>).
        </li>
        <li>
          <b>Nietypowa nieruchomość.</b> Przy domu, działce albo lokalu liczy się znajomość lokalnych kupujących.
        </li>
      </ul>

      <h3>Staż w naszym rankingu</h3>
      {rankingOk && fullPts != null && fullYears != null ? (
        <>
          <p>
            {`Staż w rejestrze to jeden z ${PARAMETERS.length} parametrów rankingu i daje najwyżej ${fmt1(fullPts)} pkt na 100. Gdy nie znamy daty, staż pomijamy, a wynik liczymy z pozostałych parametrów.`}{" "}
            Wagi opisujemy w <Link href="/metodologia">metodologii</Link>.
          </p>
          <Example title="Przykład: ile punktów rankingu daje staż">
            <p>
              {`Biuro z ${EXAMPLE_YEARS[0]} latami w rejestrze dostaje za staż ${fmt1(exPts[0] as number)} pkt, z ${EXAMPLE_YEARS[1]} latami ${fmt1(exPts[1] as number)} pkt, a od ${nLatGen(fullYears)} komplet: ${fmt1(fullPts)} pkt. Różnica między biurem z ${EXAMPLE_YEARS[0]} latami a biurem z pełnym stażem to ${fmt1(fullPts - (exPts[0] as number))} pkt na 100.`}
              {prices ? ` Dla porównania sam jawny cennik daje ${fmt1(weightShare(prices.weight))} pkt.` : ""} Wyliczenie
              dotyczy biura z kompletem danych.
            </p>
          </Example>
        </>
      ) : (
        <p>
          Staż w rejestrze jest jednym z parametrów rankingu. Wagi opisujemy w <Link href="/metodologia">metodologii</Link>.
        </p>
      )}

      <h2>Jak samodzielnie sprawdzić, od kiedy działa biuro</h2>
      <p>
        Potrzebujesz NIP biura: jest zwykle w stopce strony albo w projekcie umowy. Szczegółowe kroki opisujemy w
        poradniku{" "}
        <Link href="/poradnik/jak-sprawdzic-biuro-nieruchomosci">jak sprawdzić biuro nieruchomości</Link>.
      </p>
      <h3>Spółka: KRS</h3>
      <p>
        W wyszukiwarce KRS Ministerstwa Sprawiedliwości wpisz numer KRS albo NIP. Odpis pokazuje datę wpisu, formę prawną,
        zarząd i ewentualną likwidację lub upadłość, a odpis pełny także historię zmian.
      </p>
      <h3>Jednoosobowa działalność: CEIDG</h3>
      <p>
        Wpis w CEIDG (biznes.gov.pl) pokazuje datę rozpoczęcia działalności i status, na przykład aktywny albo zawieszony.
        Z dat CEIDG nie korzystamy, więc rok może się różnić od naszego profilu.
      </p>
      <h3>Podatnik VAT: biała lista</h3>
      <p>
        Wykaz podatników VAT (podatki.gov.pl) pokazuje status podatnika, datę rejestracji i rachunki bankowe firmy.
        Sprawdzisz przy tym, czy rachunek do zapłaty prowizji należy do biura.
      </p>
      <h3>Najczęstsze błędy</h3>
      <ol>
        <li>
          <b>Data konta na portalu zamiast daty firmy.</b> „Na portalu od 2015 r.” nie mówi, od kiedy biuro działa.
        </li>
        <li>
          <b>Staż sieci zamiast stażu biura.</b> Biuro sieci franczyzowej to zwykle osobna firma z własnym NIP (więcej w
          artykule <Link href={blogPath("siec-czy-lokalne-biuro-nieruchomosci")}>sieć czy lokalne biuro</Link>).
        </li>
        <li>
          <b>Rok 1993 albo 2001 jako dokładna data.</b> To pierwsze możliwe daty w wykazie VAT i w KRS.
        </li>
        <li>
          <b>Staż firmy jako doświadczenie agenta.</b> Agent mógł przyjść do biura miesiąc temu.
        </li>
      </ol>

      <h2>Lista kontrolna: historia biura przed umową</h2>
      <Checklist
        title="Przed podpisaniem umowy z biurem sprawdź"
        items={[
          "NIP biura i to, czy pasuje do nazwy firmy w rejestrze.",
          "Datę wpisu do KRS albo datę rozpoczęcia działalności w CEIDG.",
          "Status firmy: bez likwidacji, upadłości ani zawieszenia działalności.",
          "Czy firma ze strony to ta sama, która podpisze umowę (ważne w sieciach).",
          "Od kiedy w zawodzie jest agent, który poprowadzi twoją sprawę.",
          "Numer polisy OC pośrednika.",
          <>
            Czy biuro ma aktualne <Link href="/oferty">oferty</Link> w twojej okolicy.
          </>,
          <>
            Profil biura w katalogu i porównanie dwóch lub trzech biur w <Link href="/porownaj">porównywarce</Link>.
          </>,
        ]}
      />
      <p>
        Prowizja i wypowiedzenie wynikają z umowy i z przepisów. Typowe stawki opisujemy w poradniku{" "}
        <Link href="/poradnik/ile-bierze-biuro-nieruchomosci">ile bierze biuro nieruchomości</Link>. Stawki porównasz w{" "}
        <Link href="/raporty/prowizje-biur-nieruchomosci-2026">raporcie prowizji</Link> i na liście{" "}
        <Link href="/poradnik/biura-z-jawnym-cennikiem">biur z jawnym cennikiem</Link>, a najlepsze biura w miastach w{" "}
        <Link href="/wyroznienia-2026">wyróżnieniach 2026</Link>.
      </p>

      <Faq items={faq} />
    </BlogArticle>
  );
}
