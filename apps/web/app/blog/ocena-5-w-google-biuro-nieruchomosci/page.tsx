import type { Metadata } from "next";
import Link from "next/link";

import { BlogArticle, Checklist, Example, Faq, ShareBar, ShortAnswer, faqLd } from "@/components/BlogArticle";
import { BarList, Columns, PairBars } from "@/components/BlogCharts";
import { blogMetadata, blogPath, fmtInt, fmtPln, fmtRate, fmtRating, fmtShare, getPost } from "@/lib/blog";
import {
  CITY_COMPARE_MIN,
  MIN_REVIEWS,
  SAME_RATING,
  SAME_SHARE,
  YEARS_MIN,
  cityPairs,
  loadBlogData,
  ratingOverview,
  tenureStats,
} from "@/lib/blog-stats";
import { commissionReport } from "@/lib/catalog";
import { inCity } from "@/lib/cities";
import { nBiur, nBiurGen, nLatGen, nOpiniach, nOpiniami, nOpinii } from "@/lib/plural";
import { PARAMETERS, PRICE_STAT_MIN, scoreListing, weightShare } from "@/lib/ranking";

export const revalidate = 86400;

const post = getPost("ocena-5-w-google-biuro-nieruchomosci");

export const metadata: Metadata = blogMetadata(post);

/** Ogólne liczby o ocenach (i porównanie biur z małą i dużą liczbą opinii) pokazujemy od tylu biur w grupie. */
const RATED_MIN = 30;
/** Ile miast z największą liczbą biur pokazujemy na wykresie liczby opinii. */
const CITY_CHART = 8;
/** Od tylu opinii parametr "Opinie w Google" ma pełną wagę (jak w scoreListing w lib/ranking.ts). */
const FULL_WEIGHT_REVIEWS = 30;
/** Ceny mieszkań do przykładu prowizji (to przykłady, nie ceny rynkowe). */
const PRICES = [400000, 700000];
const VAT = 23;
/** Przykład wpływu jednej negatywnej opinii: małe biuro (same piątki) i duże biuro ze średnią 4,8. */
const SMALL_N = 4;
const BIG_N = 120;
const BIG_AVG = 4.8;
/** Przykładowe biura do wyliczenia punktów za opinie w rankingu: ocena i liczba opinii. */
const SCORE_EXAMPLES = [
  { label: "Biuro A", rating: 5, count: 3 },
  { label: "Biuro B", rating: 4.8, count: 120 },
  { label: "Biuro C", rating: 4.5, count: 30 },
];

const fmt1 = (v: number | null) =>
  v == null ? "-" : v.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const googleParam = PARAMETERS.find((p) => p.key === "opinie_google");
/** Najwięcej punktów (na 100), które daje parametr "Opinie w Google", gdy liczymy wszystkie parametry. */
const GOOGLE_MAX = googleParam ? weightShare(googleParam.weight) : null;

/** Punkty za parametr "Opinie w Google" (na 100), liczone tą samą funkcją co ranking. */
function googlePoints(rating: number, count: number): number | null {
  const item = scoreListing({
    startDate: null,
    hasPublicPrices: false,
    verificationScore: null,
    servicesCount: 0,
    offersCount: 0,
    googleRating: rating,
    googleCount: count,
  }).breakdown.find((b) => b.key === "opinie_google");
  return item && GOOGLE_MAX != null ? item.value * GOOGLE_MAX : null;
}

/** Ile opinii z 5 gwiazdkami trzeba, żeby średnia sum/n wróciła do `target` (liczone w dziesiątych częściach, bez błędów zaokrągleń). */
function fivesNeeded(sum: number, n: number, target: number): number {
  const t = Math.round(target * 10);
  return Math.max(0, Math.ceil((t * n - 10 * sum) / (50 - t)));
}

export default async function FiveStarsPost() {
  const [data, report] = await Promise.all([loadBlogData().catch(() => null), commissionReport().catch(() => null)]);
  const o = data ? ratingOverview(data.firms) : null;
  const ok = o != null && o.rated >= RATED_MIN;
  const fewN = o ? o.rated - o.solid : 0;
  const groupsOk = ok && fewN >= RATED_MIN && o.solid >= RATED_MIN;
  const fiveGap = groupsOk && o.share5Few != null && o.share5Many != null ? o.share5Few - o.share5Many : null;
  const lowGap = groupsOk && o.shareLow4Few != null && o.shareLow4Many != null ? o.shareLow4Few - o.shareLow4Many : null;
  const weightGap = ok && o.weightedRating != null && o.avgRating != null ? o.weightedRating - o.avgRating : null;

  // Wpływ jednej opinii z 1 gwiazdką na średnią małego i dużego biura (przykład liczony, nie dane).
  const smallAfter = (SMALL_N * 5 + 1) / (SMALL_N + 1);
  const bigSum = BIG_N * BIG_AVG;
  const bigAfter = (bigSum + 1) / (BIG_N + 1);
  const toRecover = fivesNeeded(SMALL_N * 5 + 1, SMALL_N + 1, BIG_AVG);

  // Miasta z największą liczbą biur, w których co najmniej CITY_COMPARE_MIN biur ma ocenę Google.
  const cityRows = data
    ? data.cities
        .map((c) => ({ c, n: data.firms.filter((f) => f.citySlug === c.slug && f.googleRating != null).length }))
        .filter((x) => x.n >= CITY_COMPARE_MIN && x.c.medianReviews != null)
        .slice(0, CITY_CHART)
    : [];
  const pairs = data ? cityPairs(data.cities).slice(0, 2) : [];

  // Dane spoza Google: odsetek biur z katalogu, dla których je znamy.
  const total = data?.firms.length ?? 0;
  const tenure = data ? tenureStats(data.firms, data.now) : null;
  const withPrices = data ? data.firms.filter((f) => f.hasPublicPrices).length : 0;
  const withOffers = data ? data.firms.filter((f) => f.offersCount > 0).length : 0;
  const pct = (part: number) => (total > 0 ? (100 * part) / total : null);
  const coverageOk = ok && total >= RATED_MIN && tenure != null;
  const coverage = coverageOk
    ? [
        { label: "ocena Google", value: pct(o.rated) },
        { label: `co najmniej ${nOpinii(MIN_REVIEWS)}`, value: pct(o.solid) },
        { label: "data wpisu do rejestru", value: pct(tenure.withYears) },
        { label: "oferty na stronie", value: pct(withOffers) },
        { label: "jawny cennik", value: pct(withPrices) },
      ].sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    : [];
  const tenureOk = tenure != null && tenure.withYears >= YEARS_MIN && tenure.medianYears != null;
  const commissionOk = report != null && report.n >= PRICE_STAT_MIN && report.median != null;

  const scored = SCORE_EXAMPLES.map((e) => ({ ...e, points: googlePoints(e.rating, e.count) }));

  const faq = [
    {
      q: "Ile opinii powinno mieć wiarygodne biuro nieruchomości?",
      a: `Nie ma jednej granicy, ale przy mniej niż ${nOpiniach(MIN_REVIEWS)} jedna opinia mocno zmienia średnią. Od kilkudziesięciu opinii w górę ocena zaczyna mówić coś o biurze.${o?.medianReviews != null ? ` Typowe biuro w naszym katalogu ma ${nOpinii(Math.round(o.medianReviews))}.` : ""} Porównuj biuro z innymi biurami w tym samym mieście.`,
    },
    {
      q: "Czy opinie Google o biurach nieruchomości są wiarygodne?",
      a: "Są dobrym punktem wyjścia, ale nie dowodem. Google usuwa opinie, które uzna za fałszywe, ale nie potwierdza, że każdy autor był klientem biura. Najwięcej mówią kilkadziesiąt opinii z ostatnich lat, konkrety w treści, rzeczowe odpowiedzi biura na krytykę i dane spoza Google: rejestr, staż i cennik.",
    },
    {
      q: "Czy biura mogą kupować opinie?",
      a: "Nie wolno. Od 1 stycznia 2023 r. ustawa o przeciwdziałaniu nieuczciwym praktykom rynkowym zakazuje zamieszczania nieprawdziwych opinii i zlecania tego innym, a także zapewniania, że opinie pochodzą od klientów, bez rozsądnego sprawdzenia, czy tak jest. Opinii kupionych albo wystawionych za nagrodę zabrania też regulamin Google. Mimo to fałszywe opinie się zdarzają. Sygnały ostrzegawcze to wiele krótkich pięciogwiazdkowych opinii w krótkim czasie i autorzy bez innych recenzji.",
    },
    {
      q: "Jak rozpoznać fałszywe opinie o biurze nieruchomości?",
      a: "Uważaj, gdy widzisz kilka sygnałów naraz: serię pięciogwiazdkowych opinii w kilka dni, autorów bez innych opinii, podobne ogólnikowe teksty i pochwały za usługi, których biuro nie wymienia na stronie. Pojedynczy sygnał niczego nie przesądza.",
    },
    {
      q: "Czy niska ocena oznacza złe biuro?",
      a: `Nie zawsze. Przy kilku opiniach jedna negatywna mocno obniża średnią${groupsOk && o.shareLow4Few != null && o.shareLow4Many != null ? `: ocenę poniżej 4,0 ma ${fmtShare(o.shareLow4Few)} biur z mniej niż ${nOpiniami(MIN_REVIEWS)} i ${fmtShare(o.shareLow4Many)} pozostałych` : ""}. Duże biuro ma też więcej negatywnych opinii w liczbach bezwzględnych, więc patrz na ich odsetek i treść, na daty i na to, czy biuro odpowiada.`,
    },
    {
      q: "Czy biuro może usunąć negatywną opinię w Google?",
      a: "Samo nie. Właściciel profilu może zgłosić opinię do Google, jeśli uważa, że narusza zasady, na przykład jest fałszywa albo obraźliwa, i może na nią publicznie odpowiedzieć. O usunięciu decyduje Google. Dlatego rzeczowa odpowiedź biura na krytykę mówi o nim więcej niż brak krytyki.",
    },
    {
      q: "Czy biuro może prosić klientów o wystawienie opinii?",
      a: "Tak. Biuro może poprosić klienta o uczciwą opinię, na przykład po akcie notarialnym. Regulamin Google zabrania natomiast płacenia za opinie, dawania w zamian rabatów lub prezentów i proszenia o opinie tylko zadowolonych klientów. Opinii o firmie nie powinni też wystawiać jej właściciele ani pracownicy.",
    },
    {
      q: "Gdzie zgłosić fałszywe opinie o biurze nieruchomości?",
      a: "Pojedynczą opinię zgłosisz w Mapach Google, w menu przy tej opinii. Jeśli podejrzewasz, że biuro systemowo zamieszcza albo kupuje opinie, możesz zawiadomić UOKiK, który zajmuje się praktykami naruszającymi zbiorowe interesy konsumentów. Zachowaj zrzuty ekranu z datami i nazwami autorów.",
    },
    {
      q: "Czy ocena Google wpływa na pozycję biura w waszym rankingu?",
      a: `Tak, ale to jeden z ${PARAMETERS.length} parametrów i najwyżej ${fmt1(GOOGLE_MAX)} ze 100 punktów. Waga oceny rośnie wraz z liczbą opinii do ${FULL_WEIGHT_REVIEWS}, więc 5,0 z trzech opinii daje mniej punktów niż 4,8 ze 120. Płatność nie wpływa na wynik. Zasady opisujemy w metodologii.`,
      node: (
        <>
          Tak, ale to jeden z {PARAMETERS.length} parametrów i najwyżej {fmt1(GOOGLE_MAX)} ze 100 punktów. Waga oceny rośnie
          wraz z liczbą opinii do {FULL_WEIGHT_REVIEWS}, więc 5,0 z trzech opinii daje mniej punktów niż 4,8 ze 120. Płatność
          nie wpływa na wynik. Zasady opisujemy w <Link href="/metodologia">metodologii</Link>.
        </>
      ),
    },
  ];

  return (
    <BlogArticle post={post} extraLd={[faqLd(faq)]}>
      {ok ? (
        <ShortAnswer>
          Ocena 5,0 w Google nie znaczy, że biuro nieruchomości jest najlepsze. Najpierw sprawdź, z ilu opinii wynika. W
          naszym katalogu ocenę 5,0 ma {fmtShare(o.share5)} biur z oceną Google.
          {fiveGap != null
            ? ` Wśród biur z mniej niż ${nOpiniami(MIN_REVIEWS)} ocenę 5,0 ma ${fmtShare(o.share5Few)}, a wśród biur z co najmniej ${nOpiniami(MIN_REVIEWS)}${fiveGap >= SAME_SHARE ? " już tylko" : ""} ${fmtShare(o.share5Many)}.`
            : ""}{" "}
          Im mniej opinii, tym łatwiej o idealną średnią. Ocena 4,8 ze stu opinii mówi o biurze więcej niż 5,0 z pięciu.
          Oprócz gwiazdek sprawdź treść i daty opinii, odpowiedzi biura, wpis w rejestrze, staż i cennik.
        </ShortAnswer>
      ) : (
        <ShortAnswer>
          Ocena 5,0 w Google nie znaczy, że biuro nieruchomości jest najlepsze. Im mniej opinii, tym łatwiej o idealną
          średnią. Ocena 4,8 ze stu opinii mówi o biurze więcej niż 5,0 z pięciu. Oprócz gwiazdek sprawdź treść i daty
          opinii, odpowiedzi biura, wpis w rejestrze, staż i cennik.
        </ShortAnswer>
      )}

      {ok && (
        <>
          <h2>Jak naprawdę wyglądają oceny biur nieruchomości</h2>
          <p>
            Sprawdziliśmy oceny Google {fmtInt(o.rated)} biur z katalogu, łącznie {fmtInt(o.reviews)} opinii. Średnia ocena
            biura to {fmtRating(o.avgRating)}, a średnia ważona liczbą opinii {fmtRating(o.weightedRating)}. Ocenę 4,8 lub
            wyższą ma {fmtShare(o.share48)} biur. Typowe biuro ma {nOpinii(Math.round(o.medianReviews ?? 0))}.
            {weightGap != null
              ? weightGap >= SAME_RATING
                ? " Średnia ważona jest wyższa, bo biura z dużą liczbą opinii mają zwykle wysokie oceny."
                : weightGap <= -SAME_RATING
                  ? " Średnia ważona jest niższa, bo biura z dużą liczbą opinii mają zwykle nieco niższe oceny niż biura z kilkoma opiniami."
                  : " Obie średnie są prawie takie same."
              : ""}
          </p>
          <Columns
            title="Ile biur z katalogu ma daną ocenę Google"
            caption={`Liczba biur w przedziałach średniej oceny Google. Wszystkie biura z oceną (${nBiur(o.rated)}), także te z mniej niż ${nOpiniami(MIN_REVIEWS)}. Każde biuro liczone raz. Źródło: profile biur w Mapach Google.`}
            rows={[...o.buckets].reverse().map((b) => ({
              label: b.label,
              value: b.firms,
              note: b.firms > 0 ? `${fmtShare((100 * b.fewReviews) / b.firms)} z mniej niż ${nOpiniami(MIN_REVIEWS)}` : undefined,
            }))}
            format={(v) => fmtInt(v)}
            valueHeader="Biura"
          />
          <p>
            Tabela pokazuje też, jaka część biur w każdym przedziale ma mniej niż {nOpinii(MIN_REVIEWS)}.
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
      <p>Każdy z tych punktów rozwijamy niżej, a na końcu jest lista kontrolna do wykorzystania przed podpisaniem umowy.</p>

      <h2>Dlaczego 5,0 z kilku opinii mówi mniej niż 4,8 ze stu</h2>
      <p>
        Średnia z kilku liczb jest bardzo czuła na każdą kolejną. Biuro z czterema opiniami ma 5,0, jeśli czterej klienci
        byli zadowoleni, ale piąta opinia może zmienić wszystko. Średnia ze stu opinii jest stabilna: jedna świetna albo
        fatalna opinia prawie jej nie rusza.
      </p>
      <Example title="Przykład: co robi jedna opinia z jedną gwiazdką">
        <ul className="plain">
          <li>
            Biuro A ma {SMALL_N} opinie, wszystkie po 5 gwiazdek. Suma to {SMALL_N * 5}, średnia 5,0. Dochodzi jedna opinia z
            1 gwiazdką: ({SMALL_N * 5} + 1) / {SMALL_N + 1} = <b>{fmtRating(smallAfter)}</b>.
          </li>
          <li>
            Biuro B ma {BIG_N} opinii ze średnią {fmt1(BIG_AVG)}. Suma to {fmtInt(bigSum)}. Po tej samej opinii z 1 gwiazdką:
            ({fmtInt(bigSum)} + 1) / {BIG_N + 1} = <b>{fmtRating(bigAfter)}</b>.
          </li>
          <li>
            Żeby biuro A wróciło do średniej {fmt1(BIG_AVG)}, musi dostać jeszcze {nOpinii(toRecover)} z 5 gwiazdkami.
          </li>
        </ul>
        <p>
          Jedna opinia obniżyła średnią biura A o {fmt1(5 - smallAfter)}, a biura B o {fmtRating(BIG_AVG - bigAfter)}.
          Dlatego ocena z kilku opinii to raczej ciekawostka niż informacja o jakości biura.
        </p>
      </Example>
      {groupsOk && (
        <>
          <p>
            Widać to w danych. Porównaliśmy {nBiur(fewN)} z mniej niż {nOpiniami(MIN_REVIEWS)} i {nBiur(o.solid)} z co
            najmniej {nOpiniami(MIN_REVIEWS)}.
            {fiveGap != null
              ? fiveGap >= SAME_SHARE
                ? ` Ocenę 5,0 ma ${fmtShare(o.share5Few)} biur z pierwszej grupy i ${fmtShare(o.share5Many)} z drugiej, więc idealna średnia częściej wynika z małej liczby opinii niż z wyjątkowej jakości biura.`
                : fiveGap <= -SAME_SHARE
                  ? ` Ocenę 5,0 ma ${fmtShare(o.share5Few)} biur z pierwszej grupy i ${fmtShare(o.share5Many)} z drugiej.`
                  : ` Ocenę 5,0 ma podobna część biur w obu grupach: ${fmtShare(o.share5Few)} i ${fmtShare(o.share5Many)}.`
              : ""}
            {lowGap != null
              ? lowGap >= SAME_SHARE
                ? ` Mała liczba opinii działa w obie strony: ocenę poniżej 4,0 ma ${fmtShare(o.shareLow4Few)} biur z mniej niż ${nOpiniami(MIN_REVIEWS)} i ${fmtShare(o.shareLow4Many)} biur z większą liczbą opinii.`
                : ` Ocenę poniżej 4,0 ma ${fmtShare(o.shareLow4Few)} biur z mniej niż ${nOpiniami(MIN_REVIEWS)} i ${fmtShare(o.shareLow4Many)} biur z większą liczbą opinii.`
              : ""}{" "}
            Jedna zła opinia przy trzech dobrych daje średnią 4,0, choć nie musi świadczyć o biurze.
          </p>
          <PairBars
            title="Skrajne oceny Google a liczba opinii biura"
            caption={`Odsetek biur z oceną 5,0 i z oceną poniżej 4,0 w dwóch grupach: biura z mniej niż ${nOpiniami(MIN_REVIEWS)} (${nBiur(fewN)}) i biura z co najmniej ${nOpiniami(MIN_REVIEWS)} (${nBiur(o.solid)}). Źródło: profile biur z katalogu w Mapach Google.`}
            nameA={`mniej niż ${nOpinii(MIN_REVIEWS)}`}
            nameB={`co najmniej ${nOpinii(MIN_REVIEWS)}`}
            rows={[
              { label: "ocena 5,0", a: o.share5Few, b: o.share5Many },
              { label: "ocena poniżej 4,0", a: o.shareLow4Few, b: o.shareLow4Many },
            ]}
            format={(v) => fmtShare(v)}
          />
        </>
      )}
      <h3>Ile opinii to dużo</h3>
      <p>
        Nie ma jednej granicy, ale możesz przyjąć prostą skalę. Przy mniej niż {nOpiniach(MIN_REVIEWS)} ocena to
        ciekawostka: czytaj treść, a średnią pomiń. Przy {MIN_REVIEWS}-{FULL_WEIGHT_REVIEWS} opiniach ocena jest orientacyjna,
        zwłaszcza gdy opinie są z różnych miesięcy. Od kilkudziesięciu opinii z ostatnich dwóch lat średnia zaczyna
        naprawdę coś mówić.
        {ok && o.medianReviews != null
          ? ` Dla porównania: typowe biuro w naszym katalogu ma ${nOpinii(Math.round(o.medianReviews))}.`
          : ""}{" "}
        Patrz też na liczbę opinii agenta, który poprowadzi twoją sprawę. W większym biurze opinie dotyczą często kilku
        osób, a ty będziesz pracować z jedną.
      </p>

      {cityRows.length >= 3 && (
        <>
          <h2>Ile opinii mają biura w miastach z największym wyborem</h2>
          <p>
            Sprawdź, ile opinii ma typowe biuro w twoim mieście. Typowe biuro {inCity(cityRows[0].c.name)} ma{" "}
            {nOpinii(Math.round(cityRows[0].c.medianReviews ?? 0))}. Biuro, które ma kilka razy mniej opinii niż typowe biuro
            w twoim mieście, ma ocenę mniej pewną, nawet jeśli to 5,0.
          </p>
          <BarList
            title="Mediana liczby opinii Google biur w miastach"
            caption={`Mediana liczby opinii wśród biur z oceną Google w ${cityRows.length} miastach z największą liczbą biur w katalogu, tylko miasta, w których ocenę ma co najmniej ${nBiur(CITY_COMPARE_MIN)}. Biuro z kilku miast liczymy raz, w mieście głównego wpisu. Źródło: profile biur w Mapach Google.`}
            rows={cityRows.map((x) => ({ label: x.c.name, value: x.c.medianReviews, note: `${nBiur(x.n)} z oceną` }))}
            format={(v) => fmtInt(v)}
            valueHeader="Mediana opinii"
          />
          <p>
            Ocenę i liczbę opinii każdego biura znajdziesz na stronach miast:{" "}
            {cityRows.slice(0, 5).map((x, i) => (
              <span key={x.c.slug}>
                {i > 0 ? ", " : ""}
                <Link href={`/${x.c.slug}`}>biura nieruchomości {inCity(x.c.name)}</Link>
              </span>
            ))}
            . Pozostałe znajdziesz na <Link href="/miasta">liście miast</Link>. Porównanie średnich ocen w miastach:{" "}
            <Link href={blogPath("oceny-biur-nieruchomosci-w-miastach")}>gdzie biura mają najlepsze opinie</Link>.
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

      <h2>Fałszywe opinie w Google: co mówi prawo i regulamin</h2>
      <p>
        Od 1 stycznia 2023 r. ustawa o przeciwdziałaniu nieuczciwym praktykom rynkowym wprost uznaje za nieuczciwe kilka
        praktyk związanych z opiniami. Przedsiębiorcy nie wolno:
      </p>
      <ul className="plain">
        <li>zamieszczać nieprawdziwych opinii konsumentów ani zlecać tego innym, na przykład agencji marketingowej;</li>
        <li>przeinaczać opinii klientów, żeby promować swoje usługi;</li>
        <li>zapewniać, że opinie pochodzą od klientów, jeśli nie podjął rozsądnych działań, żeby to sprawdzić.</li>
      </ul>
      <p>
        Przedsiębiorca, który udostępnia opinie, na przykład na swojej stronie, powinien też poinformować, czy i jak
        sprawdza, że pochodzą od osób, które naprawdę skorzystały z usługi. Jeśli biuro pokazuje na stronie same pochwały i
        nie pisze, skąd je ma, traktuj je jak reklamę. Praktykami, które naruszają zbiorowe interesy konsumentów, zajmuje
        się UOKiK, a poszkodowany klient może dochodzić roszczeń przed sądem. Szczegóły zależą od konkretnej sprawy i
        aktualnych przepisów.
      </p>
      <p>
        Niezależnie od ustawy zasady Google dla opinii w Mapach zabraniają opinii, które nie opisują prawdziwych
        doświadczeń, opinii wystawianych przez właścicieli i pracowników firmy, płacenia za opinie albo nagradzania za nie
        rabatem lub prezentem, a także proszenia o opinie tylko zadowolonych klientów. Google usuwa opinie, które uzna za
        fałszywe, ale nie potwierdza, że każdy autor był klientem biura.
      </p>
      <p>
        Biuro może natomiast poprosić każdego klienta o uczciwą opinię po zakończonej transakcji, odpowiadać na opinie i
        zgłaszać do Google te, które uważa za fałszywe. Fałszywe bywają też negatywne opinie, na przykład od konkurencji.
        Dlatego jedna ostra opinia bez szczegółów nie powinna przesądzać o twojej decyzji. Na profilach biur w naszym
        katalogu pokazujemy opinie tak, jak publikuje je Google: bez zmian i z linkiem do źródła.
      </p>

      <h2>Sygnały ostrzegawcze: kiedy wysoka ocena może być sztuczna</h2>
      <p>
        Żaden pojedynczy sygnał nie dowodzi, że opinie są fałszywe. Uważaj, gdy widzisz kilka naraz.
      </p>
      <ol>
        <li>
          <b>Seria opinii w krótkim czasie.</b> Kilkanaście pięciogwiazdkowych opinii w ciągu kilku dni, a potem cisza.
          Seria może mieć niewinne wyjaśnienie, na przykład biuro poprosiło o opinie dawnych klientów naraz. Sprawdź wtedy,
          czy opinie zawierają konkrety.
        </li>
        <li>
          <b>Autorzy bez historii.</b> Konta z jedną opinią, bez zdjęcia, z samymi imionami. Kliknij nazwę autora, żeby
          zobaczyć, co ocenia poza tym biurem.
        </li>
        <li>
          <b>Podobne teksty.</b> Te same zwroty w wielu opiniach, na przykład „pełen profesjonalizm” i „polecam z całego
          serca”, bez słowa o mieszkaniu, terminach czy dokumentach.
        </li>
        <li>
          <b>Same gwiazdki.</b> Ocena bez komentarza też liczy się do średniej. Gdy większość ocen nie ma treści, średnia
          mówi mniej.
        </li>
        <li>
          <b>Opinie niezgodne z innymi danymi.</b> Pochwały za usługi, których biuro nie wymienia na stronie, albo długa
          historia opinii przy firmie, która jest w rejestrze od kilku miesięcy. Pamiętaj, że data wpisu do rejestru nie
          zawsze jest początkiem działalności: firma mogła wcześniej działać w innej formie.
        </li>
        <li>
          <b>Opinie z wnętrza firmy.</b> Autor o tym samym nazwisku co agent albo opinia, która opisuje biuro jak
          pracownik, a nie klient.
        </li>
        <li>
          <b>Idealna ocena i nic więcej.</b> 5,0 z kilku opinii przy braku cennika, ofert na stronie i danych firmy to za
          mało, żeby zaufać biuru.
        </li>
      </ol>

      <h2>Jak czytać negatywne opinie o biurze nieruchomości</h2>
      <p>
        Negatywne opinie mówią o biurze często więcej niż pochwały, bo pokazują, co się dzieje, gdy coś idzie nie tak.
        Przeczytaj je w czterech krokach.
      </p>
      <ol>
        <li>
          <b>Posortuj opinie od najnowszych, potem od najniższej oceny.</b> Sortowanie zmienisz nad listą opinii w Mapach
          Google. Przeczytaj co najmniej pięć najsłabszych opinii z ostatnich dwóch lat.
        </li>
        <li>
          <b>Oddziel to, za co odpowiada biuro.</b> Brak kontaktu, nacisk na szybki podpis, prowizja wyższa niż w rozmowie,
          ukryte opłaty i niedotrzymane terminy dotyczą pracy biura. Cena rynkowa, kupujący, który się wycofał, albo odmowa
          kredytu w banku zwykle nie.
        </li>
        <li>
          <b>Sprawdź, kto pisze.</b> W transakcji są dwie strony. Kupujący może narzekać na agenta, który pracował dla
          sprzedającego i twardo negocjował cenę. Jeśli ty sprzedajesz, to raczej zaleta. Podobnie najemca, którego
          właściciel nie wybrał, ocenia biuro z innej perspektywy niż właściciel.
        </li>
        <li>
          <b>Szukaj powtórzeń.</b> Jedna skarga to przypadek. Ta sama skarga w kilku opiniach, na przykład na karę umowną
          albo prowizję naliczoną po zakończeniu umowy, to wzorzec. Zapytaj o to biuro i przeczytaj te zapisy w umowie
          przed podpisem.
        </li>
      </ol>
      <h3>Odpowiedzi biura na opinie</h3>
      <p>
        Dobra odpowiedź jest rzeczowa: przeprasza za błąd albo spokojnie wyjaśnia sytuację, bez danych klienta. Wyzwiska,
        groźby pozwem albo szczegóły czyjejś transakcji w odpowiedzi pokazują, jak biuro zachowa się w sporze z tobą. Brak
        odpowiedzi na wszystkie opinie nie jest wadą sam w sobie, ale pokazuje, że biuro nie dba o ten kanał kontaktu.
      </p>
      <Example title="Przykład: dwa biura z tej samej okolicy">
        <p>
          Biuro A ma ocenę 5,0 z sześciu opinii. Wszystkie pojawiły się w ciągu dwóch tygodni, czterech autorów nie ma
          innych opinii, a teksty są krótkie: „polecam”, „pełen profesjonalizm”. Biuro B ma 4,6 ze 140 opinii z kilku lat.
          Dziewięć opinii jest negatywnych. Większość sprzed trzech lat dotyczy słabego kontaktu, a w ostatnim roku są dwie,
          obie z rzeczową odpowiedzią biura.
        </p>
        <p>
          Biuro A może być dobrym, nowym biurem, ale z jego opinii nie dowiesz się prawie niczego. O biurze B wiesz, jak
          pracuje i jak reaguje na krytykę. W rozmowie z biurem A zapytaj o doświadczenie agenta i poproś o kontakt do
          dawnego klienta. Biuro B zapytaj, co zmieniło po skargach na kontakt.
        </p>
      </Example>

      <h2>Co sprawdzić poza oceną Google: rejestr, staż, cennik, oferty</h2>
      <p>
        Opinie pokazują, jak klienci wspominają współpracę. Nie powiedzą ci, czy firma jest w rejestrze, ile bierze i czy
        ma aktualne oferty. To sprawdzisz w innych źródłach.
      </p>
      <ul className="plain">
        <li>
          <b>Rejestr.</b> NIP ze strony biura sprawdzisz w KRS albo w wykazie podatników VAT. Nazwa i adres powinny się
          zgadzać z tym, co biuro podaje. Krok po kroku opisujemy to w poradniku{" "}
          <Link href="/poradnik/jak-sprawdzic-biuro-nieruchomosci">jak sprawdzić biuro nieruchomości</Link>.
        </li>
        <li>
          <b>Staż.</b> U nas to data wpisu do KRS albo rejestracji jako podatnik VAT, a nie zawsze faktyczny początek
          działalności.
          {tenureOk
            ? ` Połowa biur z katalogu ze znaną datą jest w rejestrze co najmniej od ${nLatGen(Math.floor(tenure.medianYears as number))}.`
            : ""}{" "}
          Firmy z najdłuższym stażem pokazujemy w zestawieniu{" "}
          <Link href={blogPath("najdluzej-dzialajace-biura-nieruchomosci")}>najdłużej działających biur</Link>.
        </li>
        <li>
          <b>Cennik.</b> Jawna stawka pozwala porównać biura przed pierwszym spotkaniem. Listę biur, które ją publikują,
          znajdziesz na stronie <Link href="/poradnik/biura-z-jawnym-cennikiem">biura z jawnym cennikiem</Link>, a mediany
          stawek w <Link href="/raporty/prowizje-biur-nieruchomosci-2026">raporcie prowizji</Link>.
        </li>
        <li>
          <b>Oferty.</b> Aktualne ogłoszenia na stronie biura pokazują, że firma działa i jakie nieruchomości sprzedaje.
          Przejrzyj <Link href="/oferty">oferty biur z katalogu</Link>.
        </li>
        <li>
          <b>Polisa OC.</b> Pośrednik w obrocie nieruchomościami musi mieć ubezpieczenie OC. Poproś o numer polisy albo jej
          kopię. Licencja zawodowa nie jest obowiązkowa od 2014 r., więc jej brak nie jest wadą.
        </li>
      </ul>
      {coverage.length > 0 && (
        <BarList
          title="Jakie dane o biurach z katalogu możesz sprawdzić"
          caption={`Odsetek biur z katalogu (${nBiur(total)}, każde liczone raz), dla których znamy daną informację. Data wpisu: KRS albo wykaz podatników VAT. Oferty i cennik: strona biura. Ocena: Mapy Google.`}
          rows={coverage}
          format={(v) => fmtShare(v)}
          max={100}
          valueHeader="Odsetek biur"
        />
      )}
      {coverageOk && (
        <p>
          Ocenę Google ma {fmtShare(pct(o.rated))} biur z katalogu, a co najmniej {nOpinii(MIN_REVIEWS)} tylko{" "}
          {fmtShare(pct(o.solid))}. Jawny cennik publikuje {fmtShare(pct(withPrices))} biur. Jeśli biuro ma słabą próbę opinii,
          inne dane są tym ważniejsze.
        </p>
      )}
      {commissionOk ? (
        <Example title="Przykład: o jaką kwotę chodzi przy wyborze biura">
          <p>
            Mediana najniższych stawek za sprzedaż z cenników biur w katalogu to {fmtRate(report.median)} ceny (cenniki{" "}
            {nBiurGen(report.n)}).
          </p>
          <ul className="plain">
            {PRICES.map((price) => {
              const fee = (price * (report.median as number)) / 100;
              return (
                <li key={price}>
                  Mieszkanie za {fmtPln(price)}: {fmtRate(report.median)} z {fmtPln(price)} = {fmtPln(fee)}, a jeśli stawka
                  jest netto, z {VAT}% VAT {fmtPln(fee * (1 + VAT / 100))}.
                </li>
              );
            })}
          </ul>
          <p>
            Mniej więcej tyle płacisz za pracę agenta, więc kwadrans na sprawdzenie opinii, rejestru i cennika to niewielki koszt.
            Ostateczną stawkę i to, czy zawiera VAT, określa umowa.
          </p>
        </Example>
      ) : (
        <p>
          Prowizja biura to zwykle procent ceny nieruchomości, więc kwadrans na
          sprawdzenie opinii, rejestru i cennika to niewielki koszt. Ile biorą biura, opisujemy w poradniku{" "}
          <Link href="/poradnik/ile-bierze-biuro-nieruchomosci">ile bierze biuro nieruchomości</Link>.
        </p>
      )}

      <h2>Jak liczymy opinie Google w naszym rankingu</h2>
      <p>
        W naszym rankingu ocena Google to jeden z {PARAMETERS.length} parametrów. Gdy liczymy wszystkie parametry, daje
        najwyżej {fmt1(GOOGLE_MAX)} ze 100 punktów. Ocenę przeliczamy na skalę od 0 (1 gwiazdka) do 1 (5 gwiazdek) i
        mnożymy przez wagę, która rośnie z liczbą opinii i jest pełna od {nOpinii(FULL_WEIGHT_REVIEWS)}. Biuro bez profilu
        w Google nie traci punktów: ten parametr pomijamy, a wagi pozostałych przeliczamy proporcjonalnie. Płatność nie
        wpływa na wynik. Pełny opis jest w <Link href="/metodologia">metodologii</Link>.
      </p>
      <Example title="Przykład: punkty za opinie Google dla trzech biur">
        <ul className="plain">
          {scored.map((e) => (
            <li key={e.label}>
              {e.label}: ocena {fmt1(e.rating)} z {nOpinii(e.count)}, waga opinii{" "}
              {fmtShare(100 * Math.min(1, e.count / FULL_WEIGHT_REVIEWS))}, wynik <b>{fmt1(e.points)}</b> z{" "}
              {fmt1(GOOGLE_MAX)} punktu.
            </li>
          ))}
        </ul>
        <p>
          Biuro z idealną oceną z trzech opinii dostaje dużo mniej punktów niż biura z niższą oceną, ale większą
          liczbą opinii. Resztę wyniku dają rejestr, staż, cennik, zakres usług, spójność danych i oferty.
        </p>
      </Example>
      <p>
        Wynik każdego biura zobaczysz w <Link href="/ranking">rankingu biur nieruchomości</Link>, a biura z najlepszym
        wynikiem w miastach w <Link href="/wyroznienia-2026">wyróżnieniach 2026</Link>. Kilka wybranych biur porównasz obok
        siebie w <Link href="/porownaj">porównywarce</Link>: ocena, liczba opinii, staż i prowizja w jednej tabeli. Jak
        wypadają sieci na tle biur z jednego miasta, pokazujemy w artykule{" "}
        <Link href={blogPath("siec-czy-lokalne-biuro-nieruchomosci")}>sieć czy lokalne biuro</Link>.
      </p>

      <h2>Lista kontrolna: sprawdź opinie biura w 15 minut</h2>
      <Checklist
        title="Zanim podpiszesz umowę z biurem, sprawdź"
        items={[
          "Liczbę opinii: kilkadziesiąt to dobra próba, kilka to za mało, żeby ufać średniej.",
          "Daty: większość opinii z ostatnich dwóch lat i bez nagłej serii w kilka dni.",
          "Autorów: czy mają inne opinie, czy to konta z jedną recenzją.",
          "Treść: konkrety o mieszkaniu, terminach, dokumentach i imię agenta, a nie same „polecam”.",
          "Pięć najsłabszych opinii z ostatnich dwóch lat: czego dotyczą i czy skargi się powtarzają.",
          "Odpowiedzi biura: rzeczowe, bez danych klientów i bez gróźb.",
          "Opinie o agencie, który poprowadzi twoją sprawę.",
          "NIP, wpis w KRS albo w wykazie podatników VAT i staż firmy.",
          "Cennik: stawkę, VAT i to, czy umowa jest na wyłączność.",
          "Numer polisy OC pośrednika.",
          <>
            Wynik biura w <Link href="/ranking">rankingu</Link> i porównanie z dwoma lub trzema innymi biurami w twoim mieście.
          </>,
        ]}
      />

      <Faq items={faq} />
    </BlogArticle>
  );
}
