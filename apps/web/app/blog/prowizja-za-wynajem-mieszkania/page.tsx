import type { Metadata } from "next";
import Link from "next/link";

import { BlogArticle, Checklist, Example, Faq, ShortAnswer, faqLd } from "@/components/BlogArticle";
import { BarList, Columns } from "@/components/BlogCharts";
import { blogMetadata, blogPath, fmtInt, fmtPln, fmtRate, fmtShare, getPost } from "@/lib/blog";
import {
  MIN_REVIEWS,
  cityPairs,
  hasSolidRating,
  loadBlogData,
  loadRates,
  managementStats,
  rentBrokerageStats,
  saleVatStats,
  yearsSince,
  type RateRow,
} from "@/lib/blog-stats";
import { nBiur, nBiurGen, nOpinii, plural } from "@/lib/plural";
import { isPlausible, priceKind } from "@/lib/prices";
import { PRICE_STAT_MIN } from "@/lib/ranking";

export const revalidate = 86400;

const post = getPost("prowizja-za-wynajem-mieszkania");
const RENT = 3000;
/** Kwartyle ("połowa biur od X do Y") pokazujemy dopiero od tylu stawek; przy mniejszej próbie tylko zakres. */
const SPREAD_MIN = 8;
/** Rozkład stawek (wykres i opis) i wykresy z odsetkami biur pokazujemy od tylu biur w próbie. */
const DIST_MIN = 10;
/** Przykład podstawy prowizji: czynsz najmu i opłaty administracyjne (kwoty umowne, nie dane rynkowe). */
const BASE_RENT = 2500;
const ADMIN_FEES = 600;
const VAT = 0.23;
/** Ryczałt od przychodów z najmu prywatnego do 100 000 zł rocznie. */
const LUMP_TAX = 0.085;
/** Ten sam przedział co w rentBrokerageStats (lib/blog-stats.ts): poza nim to zwykle inna opłata albo zły odczyt. */
const RENT_PERCENT = { min: 25, max: 150 };
/** Czynsze w tabelach z przeliczeniem stawek na złote. */
const RENTS = [2000, 3000, 5000];

type Bucket = { label: string; test: (v: number) => boolean };

const RENT_BUCKETS: Bucket[] = [
  { label: "poniżej 50%", test: (v) => v < 50 },
  { label: "50%", test: (v) => v === 50 },
  { label: "między 50 a 100%", test: (v) => v > 50 && v < 100 },
  { label: "100%", test: (v) => v === 100 },
  { label: "powyżej 100%", test: (v) => v > 100 },
];

const MGMT_BUCKETS: Bucket[] = [
  { label: "poniżej 8%", test: (v) => v < 8 },
  { label: "8-9,99%", test: (v) => v >= 8 && v < 10 },
  { label: "10-11,99%", test: (v) => v >= 10 && v < 12 },
  { label: "12-14,99%", test: (v) => v >= 12 && v < 15 },
  { label: "15% i więcej", test: (v) => v >= 15 },
];

export const metadata: Metadata = blogMetadata(post);

/** Najniższa procentowa stawka na biuro, z tymi samymi filtrami co rentBrokerageStats i managementStats. */
function ratesOf(rows: RateRow[], kind: "rent_brokerage" | "management"): number[] {
  const best = new Map<string, number>();
  for (const r of rows) {
    if (r.unit !== "percent" || r.amountMin == null || priceKind(r.service) !== kind || !isPlausible(r)) continue;
    if (kind === "rent_brokerage" && (r.amountMin < RENT_PERCENT.min || r.amountMin > RENT_PERCENT.max)) continue;
    const prev = best.get(r.brandId);
    if (prev == null || r.amountMin < prev) best.set(r.brandId, r.amountMin);
  }
  return [...best.values()];
}

function bucketize(values: number[], buckets: Bucket[]) {
  return buckets.map((b) => ({ label: b.label, value: values.filter(b.test).length }));
}

export default async function RentFeePost() {
  const [rates, data] = await Promise.all([loadRates().catch((): RateRow[] => []), loadBlogData().catch(() => null)]);
  const rent = rentBrokerageStats(rates);
  const mgmt = managementStats(rates);
  const sale = saleVatStats(rates);
  const rentOk = rent.n >= PRICE_STAT_MIN && rent.median != null;
  const mgmtOk = mgmt.n >= PRICE_STAT_MIN && mgmt.median != null;
  const rentSame = rentOk && rent.min === rent.max;
  const rentSpread = rentOk && rent.n >= SPREAD_MIN && !rentSame;
  const mgmtSpread = mgmtOk && mgmt.n >= SPREAD_MIN && mgmt.min !== mgmt.max;

  // Przykłady w złotych: stawka z cenników, a bez wystarczającej próby jawnie przykładowa.
  const exRate = rentOk ? (rent.median as number) : 50;
  const exRateNote = rentOk ? (rentSame ? "stawka z cenników" : "mediana z cenników") : "stawka przykładowa";
  const fee = (RENT * exRate) / 100;
  const feeDays = Math.round((30 * exRate) / 100);
  const mgmtRate = mgmtOk ? (mgmt.median as number) : 10;
  const mgmtNote = mgmtOk ? "mediana z cenników" : "stawka przykładowa";
  const mgmtFee = (RENT * mgmtRate) / 100;
  const mgmtLeft = RENT - mgmtFee * (1 + VAT) - RENT * LUMP_TAX;
  const baseFee = (BASE_RENT * exRate) / 100;
  const fullFee = ((BASE_RENT + ADMIN_FEES) * exRate) / 100;
  const entryA = RENT + RENT + fee;
  const entryB = RENT + 2 * RENT + RENT * (1 + VAT);

  const rentList = ratesOf(rates, "rent_brokerage");
  const mgmtList = ratesOf(rates, "management");
  const rentDistOk = rentList.length >= DIST_MIN;
  const mgmtDistOk = mgmtList.length >= DIST_MIN;
  const rentDist = bucketize(rentList, RENT_BUCKETS);
  const mgmtDist = bucketize(mgmtList, MGMT_BUCKETS);
  const mgmtTopN = Math.max(0, ...mgmtDist.map((d) => d.value));
  const mgmtTop = mgmtDist.filter((d) => d.value === mgmtTopN);
  const rentHalf = rentList.filter((v) => v === 50).length;
  const rentFull = rentList.filter((v) => v === 100).length;

  const firms = data?.firms ?? [];
  const withPrices = firms.filter((f) => f.hasPublicPrices).length;
  const pricesChartOk = withPrices >= DIST_MIN;
  const checkOk = data != null && firms.length >= DIST_MIN;
  const solid = firms.filter(hasSolidRating).length;
  const dated = data ? firms.filter((f) => yearsSince(f.startDate, data.now) != null).length : 0;
  const withOffers = firms.filter((f) => f.offersCount > 0).length;
  const ofFirms = (n: number) => (firms.length > 0 ? (100 * n) / firms.length : null);
  const bigCities = data ? data.cities.slice(0, 6) : [];
  const pair = data ? (cityPairs(data.cities)[0] ?? null) : null;

  const qRate = rentOk
    ? `W cennikach ${nBiurGen(rent.n)} z naszego katalogu ${rentSame ? "stawka" : "mediana"} to ${fmtRate(rent.median)} miesięcznego czynszu, czyli przy czynszu ${fmtPln(RENT)} około ${fmtPln(fee)}.${rent.n < SPREAD_MIN ? " To mała próba, więc traktuj tę liczbę orientacyjnie." : ""} Jeśli stawka jest netto, dolicz 23% VAT.`
    : "Zwykle to część albo całość jednego miesięcznego czynszu. Dokładną stawkę określa umowa z biurem, a jeśli jest netto, dolicz 23% VAT.";
  const qMgmt = mgmtOk
    ? `Według cenników ${nBiurGen(mgmt.n)} z katalogu mediana to ${fmtRate(mgmt.median)} czynszu miesięcznie${mgmtSpread ? `, a połowa biur bierze od ${fmtRate(mgmt.p25)} do ${fmtRate(mgmt.p75)}` : ""}. Przy czynszu ${fmtPln(RENT)} to około ${fmtPln(mgmtFee)} miesięcznie.`
    : "Zwykle procent czynszu miesięcznie albo stała kwota. Część firm dolicza opłatę za znalezienie najemcy. Zapytaj, czy płacisz, gdy mieszkanie stoi puste.";
  const faq = [
    {
      q: "Kto płaci prowizję za wynajem mieszkania: właściciel czy najemca?",
      a: "Płaci strona, która podpisała umowę pośrednictwa z biurem. Często płaci najemca, czasem właściciel, a niektóre biura biorą prowizję od obu stron. Zapytaj o to, zanim umówisz się na oglądanie.",
    },
    {
      q: "Ile wynosi prowizja za wynajem mieszkania?",
      a: qRate,
      node: (
        <>
          {qRate} Biura, które podają stawki na stronie, znajdziesz w zestawieniu{" "}
          <Link href="/poradnik/biura-z-jawnym-cennikiem">biura z jawnym cennikiem</Link>.
        </>
      ),
    },
    {
      q: "Czy prowizja za wynajem jest liczona z VAT?",
      a: `Biuro, które jest czynnym podatnikiem VAT, dolicza do usługi pośrednictwa 23% VAT. Przy czynszu ${fmtPln(RENT)} i stawce ${fmtRate(exRate)} netto zapłacisz ${fmtPln(fee * (1 + VAT))}, a nie ${fmtPln(fee)}.`,
    },
    {
      q: "Czy biuro może wziąć prowizję od właściciela i od najemcy?",
      a: "Tak, jeśli ma umowę z każdą ze stron. Dziś przepisy tego nie zabraniają, ale trwają prace nad ich zmianą. Zapytaj biuro, od kogo bierze wynagrodzenie.",
    },
    {
      q: "Czy najemca płaci prowizję, jeśli nie podpisał umowy z biurem?",
      a: "Jeśli najemca nie podpisał z biurem umowy pośrednictwa (pisemnej albo elektronicznej), w której zobowiązuje się do zapłaty, biuro zwykle nie ma podstawy do żądania prowizji. Sprawdź, co podpisałeś przy oglądaniu, np. kartę prezentacji. Ostateczne warunki wynikają z umowy i przepisów.",
    },
    {
      q: "Czy biuro może pobrać opłatę za obejrzenie mieszkania?",
      a: "Opłata za obejrzenie, adres albo rezerwację przed obejrzeniem to sygnał ostrzegawczy. Wynagrodzenie biura zwykle zależy od podpisania umowy najmu, więc nie płać przed obejrzeniem mieszkania.",
    },
    {
      q: "Czy prowizja za wynajem jest zwrotna?",
      a: "Zwykle nie. Prowizja jest wynagrodzeniem za doprowadzenie do podpisania umowy najmu i nie wraca po wyprowadzce, w przeciwieństwie do kaucji.",
    },
    { q: "Ile kosztuje zarządzanie najmem?", a: qMgmt },
    {
      q: "Ile może wynosić kaucja za mieszkanie i kiedy wraca?",
      a: "Przy zwykłym najmie do dwunastokrotności miesięcznego czynszu, przy okazjonalnym do sześciokrotności. Właściciel zwraca ją w ciągu miesiąca od opróżnienia mieszkania, po potrąceniu należności z tytułu najmu.",
    },
  ];

  return (
    <BlogArticle post={post} extraLd={[faqLd(faq)]}>
      <ShortAnswer>
        Prowizja za wynajem mieszkania to zwykle część albo całość jednego miesięcznego czynszu. Płaci ją strona, która
        podpisała umowę z biurem: często najemca, czasem właściciel albo obie strony.
        {rentOk
          ? ` W cennikach ${nBiurGen(rent.n)} z naszego katalogu ${rentSame ? "stawka" : "mediana"} to ${fmtRate(rent.median)} czynszu, czyli przy czynszu ${fmtPln(RENT)} około ${fmtPln((RENT * (rent.median as number)) / 100)}.`
          : ""}{" "}
        Na start najmu przygotuj też pierwszy czynsz i kaucję. Jeśli stawka biura jest netto, dolicz 23% VAT.
      </ShortAnswer>

      <h2>Kto płaci prowizję za wynajem mieszkania</h2>
      <p>
        Prowizję płaci ten, kto podpisał z biurem umowę pośrednictwa i zobowiązał się w niej do zapłaty. Są trzy modele:
      </p>
      <ul className="plain">
        <li>
          <b>Płaci najemca.</b> Biuro ma mieszkanie od właściciela, ale wynagrodzenie bierze od osoby, która je wynajmie.
        </li>
        <li>
          <b>Płaci właściciel.</b> Właściciel zleca biuru znalezienie najemcy i sam pokrywa koszt. W ogłoszeniu może
          wtedy być dopisek „bez prowizji dla najemcy”.
        </li>
        <li>
          <b>Płacą obie strony.</b> Biuro ma umowę z każdą stroną i od każdej bierze wynagrodzenie. Dziś przepisy tego nie
          zabraniają, ale trwają prace nad zmianami w przepisach o pośrednictwie.
        </li>
      </ul>
      <h3>Czy najemca musi płacić prowizję biuru</h3>
      <p>
        Umowa pośrednictwa wymaga formy pisemnej albo elektronicznej, inaczej jest nieważna. Jeśli nie podpisałeś z
        biurem umowy, w której zobowiązujesz się do zapłaty, biuro zwykle nie ma podstawy, żeby żądać od ciebie prowizji.
        Biuro może jednak pokazać mieszkanie dopiero po podpisaniu umowy albo karty prezentacji, a w nich często są już
        stawka i warunek zapłaty.
      </p>
      <p>
        Biuro musi mieć ubezpieczenie OC pośrednika. Możesz poprosić o kopię polisy. Ostateczne warunki wynikają z umowy i
        przepisów. Z cenników biur nie da się wiarygodnie policzyć, jak często płaci najemca, a jak często właściciel,
        więc tego nie podajemy.
      </p>

      <h2>Ile biura biorą za wynajem</h2>
      {rentOk ? (
        <>
          <p>
            {rentSame
              ? `Wszystkie ${nBiur(rent.n)}, które podają stawkę za najem procentowo, ${plural(rent.n, "bierze", "biorą", "bierze")} ${fmtRate(rent.median)} miesięcznego czynszu.`
              : rentSpread
                ? `Połowa biur, które podają stawkę za najem procentowo, bierze od ${fmtRate(rent.p25)} do ${fmtRate(rent.p75)} miesięcznego czynszu (najniżej ${fmtRate(rent.min)}, najwyżej ${fmtRate(rent.max)}).`
                : `Stawki ${nBiurGen(rent.n)}, które podają je procentowo, mieszczą się między ${fmtRate(rent.min)} a ${fmtRate(rent.max)} miesięcznego czynszu.`}{" "}
            Część biur podaje kwotę stałą albo minimalną, takich stawek nie ma w tym zestawieniu.
            {rent.n < SPREAD_MIN ? " To mała próba, więc traktuj te liczby jako orientacyjne." : ""}
          </p>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Czynsz miesięczny</th>
                  {rentSpread && <th className="num">Tańsze biura (25. percentyl, {fmtRate(rent.p25)})</th>}
                  <th className="num">{rentSpread ? `Mediana (${fmtRate(rent.median)})` : `Prowizja przy ${fmtRate(rent.median)}`}</th>
                  {rentSpread && <th className="num">Droższe biura (75. percentyl, {fmtRate(rent.p75)})</th>}
                </tr>
              </thead>
              <tbody>
                {RENTS.map((r) => (
                  <tr key={r}>
                    <td>{fmtPln(r)}</td>
                    {rentSpread && <td className="num">{fmtPln((r * (rent.p25 as number)) / 100)}</td>}
                    <td className="num">{fmtPln((r * (rent.median as number)) / 100)}</td>
                    {rentSpread && <td className="num">{fmtPln((r * (rent.p75 as number)) / 100)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note">
            Kwoty liczone od stawki z cennika (netto albo brutto, tak jak podaje biuro). Jeśli stawka jest netto, dolicz 23%
            VAT.
          </p>
        </>
      ) : (
        <p>
          Stawka to zwykle procent miesięcznego czynszu, np. połowa albo cały czynsz, albo kwota stała. Stawki z cenników
          biur pokażemy tutaj, gdy zbierzemy je od co najmniej {nBiurGen(PRICE_STAT_MIN)}.
        </p>
      )}

      {pricesChartOk && (
        <>
          <p>
            Spośród {nBiurGen(withPrices)} z cennikiem na stronie procentową stawkę za znalezienie najemcy{" "}
            {plural(rent.n, "podaje", "podają", "podaje")} {fmtInt(rent.n)}, za zarządzanie najmem {fmtInt(mgmt.n)}, a za
            sprzedaż {fmtInt(sale.n)}.
            {rent.n < withPrices / 2
              ? " Większość biur z cennikiem nie podaje więc procentowej stawki za najem i o prowizję trzeba zapytać."
              : ""}
          </p>
          <BarList
            title="Ile biur z cennikiem podaje procentową stawkę za daną usługę"
            caption={`Biura z katalogu z cennikiem na stronie: ${fmtInt(withPrices)} (cała skala wykresu). Pomijamy stawki kwotowe i spoza wiarygodnego przedziału, przy najmie ${RENT_PERCENT.min}-${RENT_PERCENT.max}% czynszu.`}
            rows={[
              { label: "Sprzedaż", value: sale.n, note: nBiur(sale.n) },
              { label: "Zarządzanie najmem", value: mgmt.n, note: nBiur(mgmt.n) },
              { label: "Znalezienie najemcy", value: rent.n, note: nBiur(rent.n) },
            ]}
            format={(v) => fmtInt(v)}
            max={withPrices}
            valueHeader="Liczba biur"
          />
        </>
      )}

      <h3>50% czy 100% czynszu</h3>
      {rentDistOk ? (
        <>
          <p>
            Połowę czynszu bierze {fmtShare((100 * rentHalf) / rentList.length)} biur, które podają stawkę za najem
            procentowo, a cały czynsz {fmtShare((100 * rentFull) / rentList.length)}. Pozostałe mają stawki pośrednie,
            niższe albo wyższe.
          </p>
          <Columns
            title="Stawka za znalezienie najemcy w cennikach biur: liczba biur"
            caption={`Źródło: cenniki ${nBiurGen(rentList.length)} z katalogu, jedna najniższa procentowa stawka za najem na biuro, procent miesięcznego czynszu.`}
            rows={rentDist}
            format={(v) => fmtInt(v)}
            valueHeader="Liczba biur"
          />
        </>
      ) : (
        <p>
          Ile biur bierze połowę, a ile cały czynsz, pokażemy od {nBiurGen(DIST_MIN)} ze stawką procentową za najem. Przy
          czynszu {fmtPln(RENT)} to {fmtPln(RENT / 2)} albo {fmtPln(RENT)} plus ewentualny VAT.
        </p>
      )}

      <h3>Od czego liczy się prowizja</h3>
      <p>
        Umowy różnie definiują czynsz: czasem to sam czynsz dla właściciela, czasem czynsz z opłatami administracyjnymi.
        Poproś, żeby umowa podawała kwotę, od której liczona jest prowizja.
      </p>
      <Example title="Ta sama stawka, dwie podstawy">
        <p>
          Czynsz najmu to {fmtPln(BASE_RENT)}, opłaty administracyjne {fmtPln(ADMIN_FEES)}, stawka biura {fmtRate(exRate)}{" "}
          ({exRateNote}).
        </p>
        <ul className="plain">
          <li>
            Od samego czynszu: {fmtRate(exRate)} x {fmtPln(BASE_RENT)} = {fmtPln(baseFee)}.
          </li>
          <li>
            Od czynszu z opłatami: {fmtRate(exRate)} x {fmtPln(BASE_RENT + ADMIN_FEES)} = {fmtPln(fullFee)}.
          </li>
          <li>
            Ze stawką netto i 23% VAT: {fmtPln(baseFee * (1 + VAT))} albo {fmtPln(fullFee * (1 + VAT))}.
          </li>
        </ul>
        <p>
          Różnica między najtańszym a najdroższym wariantem to {fmtPln(fullFee * (1 + VAT) - baseFee)}, choć stawka w
          cenniku jest ta sama.
        </p>
      </Example>

      <h2>Ile kosztuje wejście w najem</h2>
      <p>
        Przy podpisaniu umowy zwykle płacisz naraz: pierwszy czynsz, kaucję (np. jeden albo dwa czynsze) i
        prowizję biura. Do tego dochodzą opłaty za pierwszy miesiąc, jeśli rozliczasz je z właścicielem, a przy najmie
        okazjonalnym koszt oświadczenia u notariusza.
      </p>
      <Example title={`Koszt wejścia w najem przy czynszu ${fmtPln(RENT)}`}>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th />
                <th className="num">Kaucja 1 czynsz, prowizja {fmtRate(exRate)} brutto</th>
                <th className="num">Kaucja 2 czynsze, prowizja 100% + VAT</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Pierwszy czynsz</td>
                <td className="num">{fmtPln(RENT)}</td>
                <td className="num">{fmtPln(RENT)}</td>
              </tr>
              <tr>
                <td>Kaucja</td>
                <td className="num">{fmtPln(RENT)}</td>
                <td className="num">{fmtPln(2 * RENT)}</td>
              </tr>
              <tr>
                <td>Prowizja biura</td>
                <td className="num">{fmtPln(fee)}</td>
                <td className="num">{fmtPln(RENT)}</td>
              </tr>
              <tr>
                <td>VAT od prowizji</td>
                <td className="num">w cenie</td>
                <td className="num">{fmtPln(RENT * VAT)}</td>
              </tr>
              <tr>
                <td>
                  <b>Razem na start</b>
                </td>
                <td className="num">
                  <b>{fmtPln(entryA)}</b>
                </td>
                <td className="num">
                  <b>{fmtPln(entryB)}</b>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Stawka {fmtRate(exRate)} to {exRateNote}, drugi wariant to biuro, które bierze cały czynsz netto. Kaucja wraca
          po zakończeniu najmu, prowizja nie, więc trwały koszt to {fmtPln(fee)} albo {fmtPln(RENT * (1 + VAT))}.
        </p>
      </Example>
      <h3>Ile może wynosić kaucja</h3>
      <p>
        Prawo ogranicza kaucję: przy zwykłym najmie do dwunastokrotności miesięcznego czynszu, przy najmie okazjonalnym do
        sześciokrotności. Właściciel ma miesiąc od opróżnienia mieszkania na zwrot i może z kaucji potrącić należności z
        tytułu najmu, np. zaległy czynsz albo koszt naprawy szkód. Spór o potrącenia rozstrzyga zwykle protokół ze
        zdjęciami.
      </p>

      <h2>Zarządzanie najmem: ile to kosztuje właściciela</h2>
      {mgmtOk ? (
        <p>
          Biura, które zarządzają mieszkaniem na wynajem (szukanie najemców, rozliczenia, usterki, kontakt z najemcą),
          biorą miesięcznie procent czynszu. Mediana z cenników {nBiurGen(mgmt.n)} to {fmtRate(mgmt.median)} czynszu
          {mgmtSpread
            ? ` (połowa biur: ${fmtRate(mgmt.p25)}-${fmtRate(mgmt.p75)}).`
            : mgmt.min !== mgmt.max
              ? ` (stawki od ${fmtRate(mgmt.min)} do ${fmtRate(mgmt.max)}).`
              : " miesięcznie."}{" "}
          Przy czynszu {fmtPln(RENT)} to około {fmtPln((RENT * (mgmt.median as number)) / 100)} miesięcznie.
        </p>
      ) : (
        <p>
          Biura, które zarządzają mieszkaniem na wynajem, zwykle biorą miesięcznie procent czynszu albo stałą kwotę.
          Część dolicza opłatę za znalezienie najemcy.
        </p>
      )}
      {mgmtOk && (
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Czynsz miesięczny</th>
                <th className="num">Zarządzanie miesięcznie ({fmtRate(mgmt.median)})</th>
                <th className="num">Zarządzanie rocznie</th>
              </tr>
            </thead>
            <tbody>
              {RENTS.map((r) => (
                <tr key={r}>
                  <td>{fmtPln(r)}</td>
                  <td className="num">{fmtPln((r * (mgmt.median as number)) / 100)}</td>
                  <td className="num">{fmtPln((12 * r * (mgmt.median as number)) / 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {mgmtDistOk && (
        <>
          <p>
            {mgmtTop.length === 1
              ? `Najczęściej biura podają najniższą stawkę za zarządzanie w przedziale ${mgmtTop[0].label} (${nBiur(mgmtTopN)} z ${mgmtList.length}).`
              : `Najczęściej biura podają najniższą stawkę za zarządzanie w przedziałach ${mgmtTop.map((d) => d.label).join(" i ")} (po ${nBiur(mgmtTopN)} z ${mgmtList.length}).`}{" "}
            To stawki „od”, w umowie może być wyższa.
          </p>
          <Columns
            title="Najniższa stawka za zarządzanie najmem w cennikach biur: liczba biur"
            caption={`Źródło: cenniki ${nBiurGen(mgmtList.length)} z katalogu, jedna najniższa procentowa stawka za zarządzanie na biuro (procent miesięcznego czynszu, netto albo brutto).`}
            rows={mgmtDist}
            format={(v) => fmtInt(v)}
            valueHeader="Liczba biur"
          />
        </>
      )}
      <h3>Co obejmuje zarządzanie najmem</h3>
      <ul className="plain">
        <li>Ogłoszenia, prezentacje, sprawdzenie najemcy, umowa i protokół.</li>
        <li>Pilnowanie wpłat czynszu i rozliczanie mediów.</li>
        <li>Usterki i drobne naprawy do ustalonego limitu.</li>
        <li>Odbiór mieszkania i rozliczenie kaucji.</li>
      </ul>
      <p>
        Zakres zależy od umowy. Nie myl tej usługi z zarządzaniem wspólnotą mieszkaniową.
      </p>
      <h3>O co zapytać przed podpisaniem umowy o zarządzanie</h3>
      <ul className="plain">
        <li>
          <b>Od czego jest procent.</b> Od czynszu wpłaconego czy należnego? Od tego zależy, czy płacisz, gdy najemca
          zalega albo mieszkanie stoi puste.
        </li>
        <li>
          <b>Znalezienie najemcy.</b> Czy jest w cenie, czy płatne osobno przy każdej zmianie najemcy.
        </li>
        <li>
          <b>Naprawy.</b> Do jakiej kwoty firma zleca naprawy bez twojej zgody i czy dolicza do nich marżę.
        </li>
        <li>
          <b>Pieniądze i wypowiedzenie.</b> Na jaki rachunek trafiają czynsz i kaucja oraz z jakim okresem wypowiesz
          umowę.
        </li>
      </ul>
      <Example title={`Ile zostaje z czynszu ${fmtPln(RENT)} po opłacie za zarządzanie`}>
        <ul className="plain">
          <li>
            Opłata za zarządzanie, {fmtRate(mgmtRate)} ({mgmtNote}): {fmtPln(mgmtFee)}.
          </li>
          <li>VAT 23%, jeśli stawka jest netto: {fmtPln(mgmtFee * VAT)}.</li>
          <li>
            Ryczałt od najmu, 8,5% od przychodu: {fmtPln(RENT * LUMP_TAX)}.
          </li>
          <li>
            Zostaje: <b>{fmtPln(mgmtLeft)}</b> miesięcznie, czyli {fmtPln(12 * mgmtLeft)} rocznie.
          </li>
        </ul>
        <p>
          Od 2023 r. najem prywatny rozliczasz tylko ryczałtem (8,5% przychodu do 100 000 zł rocznie, 12,5% od
          nadwyżki), więc opłaty dla biura nie obniżają podatku. Pomijamy pustostany i naprawy, media płaci najemca.
        </p>
      </Example>

      <h2>Wynajem przez biuro czy samodzielnie</h2>
      <h3>Perspektywa właściciela</h3>
      <p>
        Biuro przejmuje ogłoszenia, telefony, prezentacje i sprawdzenie najemcy. Jeśli prowizję płaci najemca, ty nie
        płacisz nic, ale część chętnych odpadnie, bo szuka ofert bez prowizji. Samodzielnie oszczędzasz prowizję, za to
        czas szukania i ryzyko złego wyboru najemcy bierzesz na siebie.
      </p>
      <Example title="Kiedy prowizja się zwraca">
        <p>
          Jeśli płacisz sam, przy czynszu {fmtPln(RENT)} i stawce {fmtRate(exRate)} ({exRateNote}) prowizja to {fmtPln(fee)}, czyli
          równowartość około {feeDays} {plural(feeDays, "dnia", "dni", "dni")} czynszu. Jeśli dzięki biuru mieszkanie stoi
          puste krócej o więcej niż tyle, wychodzisz na plus. Jeśli najemcę z polecenia masz od ręki, prowizja jest
          czystym kosztem.
        </p>
      </Example>
      <h3>Perspektywa najemcy</h3>
      <p>
        Przez biuro zapłacisz więcej na start, ale biuro może przygotować umowę i protokół oraz sprawdzić dokumenty
        właściciela. Zapytaj, co z tego jest w cenie. Pośrednik zwykle kończy pracę po wydaniu kluczy, chyba że zarządza
        najmem. Bez biura unikasz prowizji, ale wszystko sprawdzasz sam.
      </p>

      <h2>Najem okazjonalny i instytucjonalny</h2>
      <p>
        Obie formy ułatwiają właścicielowi odzyskanie mieszkania, gdy najemca nie chce się wyprowadzić. W zamian wymagają
        dokumentów u notariusza.
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th />
              <th>Zwykły najem</th>
              <th>Najem okazjonalny</th>
              <th>Najem instytucjonalny</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Kto wynajmuje</td>
              <td>Każdy właściciel.</td>
              <td>Osoba fizyczna, która nie prowadzi działalności w zakresie wynajmu.</td>
              <td>Przedsiębiorca, który prowadzi działalność w zakresie wynajmowania lokali.</td>
            </tr>
            <tr>
              <td>Oświadczenie najemcy u notariusza</td>
              <td>Nie.</td>
              <td>Tak, o poddaniu się egzekucji i opróżnieniu lokalu.</td>
              <td>Tak, o poddaniu się egzekucji i opróżnieniu lokalu.</td>
            </tr>
            <tr>
              <td>Wskazanie innego lokalu</td>
              <td>Nie.</td>
              <td>Tak, ze zgodą jego właściciela.</td>
              <td>Nie.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Umowa najmu okazjonalnego musi mieć formę pisemną i być zawarta na czas oznaczony, najwyżej na 10 lat. Właściciel
        zgłasza ją naczelnikowi urzędu skarbowego w ciągu 14 dni od początku najmu. Jeśli tego nie zrobi, traci ochronę,
        którą daje najem okazjonalny.
      </p>
      <p>
        Notariusz pobiera taksę za akt z oświadczeniem najemcy, a często też za poświadczenie podpisu właściciela lokalu
        zastępczego. Maksymalne stawki określa rozporządzenie o taksie notarialnej, do tego dochodzą VAT i wypisy.
        Zapytaj kancelarię o kwotę i wpisz do umowy, kto ją płaci. Przy wynajmie przez biuro zapytaj, czy przygotowanie
        tych dokumentów jest w cenie.
      </p>

      <h2>Umowa pośrednictwa najmu: zapisy do sprawdzenia</h2>
      <ul className="plain">
        <li>
          <b>Stawka i podstawa.</b> Procent czy kwota, od jakiego czynszu, netto czy brutto, czy jest kwota minimalna.
        </li>
        <li>
          <b>Moment zapłaty.</b> Najbezpieczniej po podpisaniu umowy najmu i wydaniu kluczy, nie po obejrzeniu ani przy
          rezerwacji.
        </li>
        <li>
          <b>Brak najmu.</b> Co się dzieje z wpłaconą prowizją, gdy właściciel wycofa się przed wydaniem kluczy.
        </li>
        <li>
          <b>Okres ochronny.</b> Prowizja może się należeć także po zakończeniu umowy, jeśli wynajmiesz mieszkanie od
          osoby albo osobie przedstawionej przez biuro. Sprawdź, jak długo to trwa.
        </li>
        <li>
          <b>Przedłużenie najmu.</b> Czy biuro chce kolejnej prowizji, gdy przedłużasz umowę z tym samym najemcą.
        </li>
        <li>
          <b>Wyłączność (dla właściciela).</b> Czy zapłacisz, gdy najemcę znajdziesz sam, i na jak długo wiąże cię umowa.
        </li>
      </ul>
      <p>
        Gdy masz wątpliwości co do zapisu, przed podpisem zapytaj o radę rzecznika konsumentów w swoim mieście albo
        powiecie.
      </p>

      <h2>Oszustwa na wynajem: jak sprawdzić biuro i ogłoszenie</h2>
      <p>
        Schemat jest zwykle podobny: atrakcyjne ogłoszenie, pośpiech i prośba o pieniądze przed obejrzeniem mieszkania.
        Sygnały ostrzegawcze:
      </p>
      <ul>
        <li>cena wyraźnie niższa niż w podobnych ogłoszeniach z okolicy,</li>
        <li>„właściciel jest za granicą”, a klucze mają przyjść kurierem po wpłacie,</li>
        <li>zaliczka, rezerwacja albo opłata za adres przed oglądaniem,</li>
        <li>link do płatności albo kod BLIK zamiast przelewu na rachunek firmy,</li>
        <li>biuro bez adresu, NIP i strony, tylko z telefonem,</li>
        <li>te same zdjęcia w innym ogłoszeniu pod inną nazwą.</li>
      </ul>
      <h3>Jak sprawdzić biuro przed wpłatą</h3>
      <ol>
        <li>Nazwa, NIP i adres biura powinny być takie same w umowie, na fakturze i w rejestrze firm.</li>
        <li>
          Jeśli biuro jest czynnym podatnikiem VAT, sprawdź jego NIP w wykazie podatników VAT i płać na rachunek, który tam
          widnieje.
        </li>
        <li>
          Poproś o numer księgi wieczystej i sprawdź w elektronicznych księgach wieczystych, kto jest właścicielem. Osoba z
          biura powinna mieć umowę z właścicielem albo jego pełnomocnictwo.
        </li>
        <li>
          Czytaj opinie: liczbę, daty i treść, nie same gwiazdki. Więcej w artykule{" "}
          <Link href={blogPath("ocena-5-w-google-biuro-nieruchomosci")}>o ocenie 5,0 w Google</Link>.
        </li>
      </ol>
      <p>
        Pełna lista kroków jest w poradniku{" "}
        <Link href="/poradnik/jak-sprawdzic-biuro-nieruchomosci">jak sprawdzić biuro nieruchomości</Link>.
        Na profilu biura w katalogu zobaczysz ocenę Google, datę wpisu do rejestru, cennik i oferty. Brak tych danych nie
        znaczy, że biuro jest nieuczciwe, ale wtedy sprawdź je dokładniej.
      </p>
      {checkOk && (
        <BarList
          title="Jakie dane o biurze sprawdzisz w naszym katalogu: odsetek biur"
          caption={`Odsetek z ${nBiurGen(firms.length)} w katalogu, każda firma liczona raz. Ocena Google liczy się od ${nOpinii(MIN_REVIEWS)}. Data to wpis do KRS albo rejestracja jako podatnik VAT, nie zawsze początek działalności.`}
          rows={[
            { label: `Ocena z ${MIN_REVIEWS}+ opinii`, value: ofFirms(solid), note: nBiur(solid) },
            { label: "Data wpisu KRS lub VAT", value: ofFirms(dated), note: nBiur(dated) },
            { label: "Oferty na stronie", value: ofFirms(withOffers), note: nBiur(withOffers) },
            { label: "Cennik na stronie", value: ofFirms(withPrices), note: nBiur(withPrices) },
          ]}
          format={fmtShare}
          max={100}
          valueHeader="Odsetek biur"
        />
      )}

      <h2>Protokół zdawczo-odbiorczy: co w nim zapisać</h2>
      <p>
        Protokół nie jest obowiązkowy, ale bez niego trudno rozstrzygnąć spór o kaucję. Spisz go przy wydaniu kluczy i
        powtórz przy wyprowadzce.
      </p>
      <ul className="plain">
        <li>Datę, adres, dane stron i liczbę kluczy.</li>
        <li>Stany i numery liczników prądu, gazu, wody i ciepła.</li>
        <li>Listę wyposażenia z opisem stanu, np. „rysa na blacie przy zlewie”, zamiast ogólnego „stan dobry”.</li>
        <li>Zdjęcia lub film z datą, wskazane w protokole jako załącznik.</li>
        <li>Usterki do naprawy i termin, w którym właściciel je usunie.</li>
        <li>Podpisy obu stron i kopię dla każdej z nich.</li>
      </ul>
      <p>
        Najemca nie odpowiada za zużycie, które wynika z prawidłowego używania mieszkania, np. lekko wytarty parkiet.
        Odpowiada za szkody ponad to, a dokładny opis stanu na starcie pozwala oddzielić jedno od drugiego.
      </p>

      <h2>Jak negocjować prowizję i czego unikać</h2>
      <p>
        Stawka z cennika to punkt wyjścia. Najemca ma mocniejszą pozycję przy dłuższej umowie, poza sezonem akademickim
        albo gdy sam znalazł ogłoszenie i potrzebuje od biura tylko umowy. Właściciel negocjuje łatwiej, gdy oddaje biuru
        kilka mieszkań albo łączy znalezienie najemcy z zarządzaniem. Zamiast niższej stawki zaproponuj prowizję od
        samego czynszu, bez opłat administracyjnych.
      </p>
      <p>Najczęstsze błędy przy wynajmie przez biuro:</p>
      <ol>
        <li>Pytanie o prowizję dopiero po obejrzeniu, gdy umowa z biurem jest już podpisana.</li>
        <li>Płatność gotówką bez pokwitowania albo na prywatne konto pracownika.</li>
        <li>Umowa na wyłączność bez terminu i bez opisanych obowiązków biura.</li>
      </ol>

      <Checklist
        title="Przed wpłatą prowizji i kaucji"
        items={[
          "Wiesz, kto płaci prowizję, ile wynosi, od jakiej kwoty i czy jest netto, czy brutto.",
          "Umowa z biurem jest pisemna albo elektroniczna i mówi, kiedy prowizja jest należna.",
          "Obejrzałeś mieszkanie i zgadza się z ogłoszeniem.",
          "Wynajmujący jest właścicielem według księgi wieczystej albo ma pełnomocnictwo.",
          "Nazwa, NIP i adres biura zgadzają się z umową i rejestrem.",
          "Płacisz przelewem na rachunek firmy i dostaniesz fakturę albo rachunek.",
          "Umowa najmu określa czynsz, opłaty, kaucję i zasady jej zwrotu.",
          "Protokół z licznikami, wyposażeniem i zdjęciami jest podpisany przez obie strony.",
        ]}
      />

      <h2>Jak znaleźć biuro do wynajmu</h2>
      <p>
        Biura z cennikiem na stronie znajdziesz w zestawieniu{" "}
        <Link href="/poradnik/biura-z-jawnym-cennikiem">biura z jawnym cennikiem</Link>, a na stronie każdego miasta
        wybierz „Chcę wynająć” albo filtr „Zarządzanie najmem”.
        {bigCities.length > 0 ? " Miasta z największym wyborem biur w katalogu: " : ""}
        {bigCities.map((c, i) => (
          <span key={c.slug}>
            <Link href={`/${c.slug}`}>{c.name}</Link>
            {i < bigCities.length - 1 ? ", " : "."}
          </span>
        ))}{" "}
        {bigCities.length > 0 ? "Pozostałe są na " : "Wszystkie miasta są na "}
        <Link href="/miasta">liście miast</Link>, a najnowsze ogłoszenia ze stron biur, także na
        wynajem, w zakładce <Link href="/oferty">oferty</Link>.
      </p>
      <p>
        Ranking w każdym mieście łączy m.in. oceny Google, staż z rejestru i jawność cennika według opisanej{" "}
        <Link href="/metodologia">metodologii</Link>. Kilka biur zestawisz w <Link href="/porownaj">porównywarce</Link>,
        a najwyżej ocenione znajdziesz w <Link href="/wyroznienia-2026">Wyróżnieniach 2026</Link> i w{" "}
        <Link href="/ranking">rankingu ogólnopolskim</Link>. Zasady prowizji za sprzedaż wyjaśniamy w poradniku{" "}
        <Link href="/poradnik/ile-bierze-biuro-nieruchomosci">ile bierze biuro nieruchomości</Link> i w{" "}
        <Link href="/raporty/prowizje-biur-nieruchomosci-2026">raporcie prowizji 2026</Link>.
        {pair ? " Wybierasz między dwoma miastami? Zobacz porównanie " : ""}
        {pair ? (
          <Link href={blogPath(`porownanie/${pair.slug}`)}>
            {pair.a.name} czy {pair.b.name}
          </Link>
        ) : null}
        {pair ? "." : ""}
      </p>

      <Faq items={faq} />
    </BlogArticle>
  );
}
