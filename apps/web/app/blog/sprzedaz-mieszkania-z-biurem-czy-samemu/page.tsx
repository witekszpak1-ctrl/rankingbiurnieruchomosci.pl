import type { Metadata } from "next";
import Link from "next/link";

import { BlogArticle, Checklist, Example, Faq, ShortAnswer, faqLd } from "@/components/BlogArticle";
import { BarList, Columns } from "@/components/BlogCharts";
import { CommissionCalculator } from "@/components/CommissionCalculator";
import { blogMetadata, blogPath, fmtInt, fmtPln, fmtRate, fmtShare, fmtYears, getPost } from "@/lib/blog";
import {
  MIN_REVIEWS,
  YEARS_MIN,
  buyerStats,
  loadBlogData,
  loadRates,
  ratingOverview,
  saleVatStats,
  tenureStats,
  type RateRow,
} from "@/lib/blog-stats";
import { commissionReport } from "@/lib/catalog";
import { nBiur, nBiurGen, nOpinii, plural } from "@/lib/plural";
import { isPlausible, priceKind } from "@/lib/prices";
import { PRICE_STAT_MIN } from "@/lib/ranking";

export const revalidate = 86400;

const post = getPost("sprzedaz-mieszkania-z-biurem-czy-samemu");
const EXAMPLE = 600000;
/** Przykład podatkowy: założony koszt zakupu mieszkania (kwota umowna, nie dane rynkowe). */
const BOUGHT = 450000;
/** Kwartyle ("połowa biur od X do Y") podajemy dopiero od tylu stawek (docs/blog.md, sekcja 4). */
const QUARTILE_MIN = 8;
/** Prowizja przy kilku cenach mieszkania (przykład z instrukcji bloga). */
const PRICES = [400000, 700000, 1200000];
/** Rozkład stawek (wykres i opis) pokazujemy od tylu biur; samą medianę od PRICE_STAT_MIN. */
const DIST_MIN = 20;
/** Na wykresie miast pokazujemy najwyżej tyle miast z największą próbą. */
const CITY_CHART_MAX = 12;
const BUCKETS = [
  { label: "poniżej 1,5%", max: 1.5 },
  { label: "1,5-1,99%", max: 2 },
  { label: "2-2,49%", max: 2.5 },
  { label: "2,5-2,99%", max: 3 },
  { label: "3-3,99%", max: 4 },
  { label: "4% i więcej", max: Infinity },
];

export const metadata: Metadata = blogMetadata(post);

/** Najniższa procentowa stawka za sprzedaż na biuro, z tym samym filtrem co raport prowizji (commissionReport). */
function saleRates(rows: RateRow[]): number[] {
  const best = new Map<string, number>();
  for (const r of rows) {
    if (r.unit !== "percent" || r.amountMin == null || priceKind(r.service) !== "sale" || !isPlausible(r)) continue;
    const prev = best.get(r.brandId);
    if (prev == null || r.amountMin < prev) best.set(r.brandId, r.amountMin);
  }
  return [...best.values()];
}

export default async function SellWithAgentPost() {
  const [report, rates, data] = await Promise.all([
    commissionReport().catch(() => null),
    loadRates().catch((): RateRow[] => []),
    loadBlogData().catch(() => null),
  ]);
  const has = report != null && report.n >= PRICE_STAT_MIN && report.median != null;
  const median = has ? (report.median as number) : null;
  const quartOk = has && report.n >= QUARTILE_MIN && report.p25 != null && report.p75 != null;
  const p25 = quartOk ? report.p25 : null;
  const p75 = quartOk ? report.p75 : null;
  const fee = median != null ? (EXAMPLE * median) / 100 : null;
  const feeLow = p25 != null ? (EXAMPLE * p25) / 100 : null;
  const feeHigh = p75 != null ? (EXAMPLE * p75) / 100 : null;
  // Przykłady w złotych: mediana z cenników, a bez wystarczającej próby jawnie przykładowa stawka 2%.
  const exRate = median ?? 2;
  const exRateNote = median != null ? "mediana z cenników" : "stawka przykładowa";
  const exFee = (EXAMPLE * exRate) / 100;

  const vat = saleVatStats(rates);
  const vatOk = vat.n >= PRICE_STAT_MIN;
  const buyer = buyerStats(rates);
  const buyerOk = buyer.brands >= PRICE_STAT_MIN;

  const sale = saleRates(rates);
  const distOk = sale.length >= DIST_MIN;
  const dist = BUCKETS.map((b, i) => ({
    label: b.label,
    value: sale.filter((v) => v >= (i === 0 ? 0 : BUCKETS[i - 1].max) && v < b.max).length,
  }));
  const distMax = Math.max(0, ...dist.map((d) => d.value));
  const distTop = dist.filter((d) => d.value === distMax);
  const shareUnder2 = sale.length ? (100 * sale.filter((v) => v < 2).length) / sale.length : null;
  const share3 = sale.length ? (100 * sale.filter((v) => v >= 3).length) / sale.length : null;

  const reportCities = (report?.cities ?? []).filter((c) => c.n >= PRICE_STAT_MIN);
  const chartCities = reportCities.slice(0, CITY_CHART_MAX);
  const pricesShare = report && report.firms > 0 ? (100 * report.withPrices) / report.firms : null;
  const overview = data ? ratingOverview(data.firms) : null;
  const overviewOk = overview != null && overview.rated >= DIST_MIN && overview.shareFew != null;
  const tenure = data ? tenureStats(data.firms, data.now) : null;
  const tenureOk = tenure != null && tenure.withYears >= YEARS_MIN && tenure.medianYears != null;
  const bigCities = data ? data.cities.slice(0, 6) : [];

  // Przykład podatkowy (kwoty umowne): sprzedaż przed upływem 5 lat, prowizja jako koszt zbycia.
  const gain = EXAMPLE - exFee - BOUGHT;
  const tax = 0.19 * gain;
  const taxNoFee = 0.19 * (EXAMPLE - BOUGHT);
  const buyYear = new Date().getFullYear() - 3;

  const q1 = has
    ? `Według cenników ${nBiurGen(report.n)} z naszego katalogu, które podają stawkę procentową, mediana najniższej stawki za sprzedaż to ${fmtRate(report.median)} ceny${quartOk ? `, a połowa biur bierze od ${fmtRate(p25)} do ${fmtRate(p75)}` : ""}. Przy mieszkaniu za ${fmtPln(EXAMPLE)} to około ${fmtPln(fee)} plus ewentualny VAT.`
    : "Biura zwykle biorą procent ceny sprzedaży. Dokładna stawka wynika z umowy pośrednictwa.";
  const faq = [
    {
      q: "Ile kosztuje pośrednik przy sprzedaży mieszkania?",
      a: q1,
      node: (
        <>
          {q1} Mediany w miastach są w{" "}
          <Link href="/raporty/prowizje-biur-nieruchomosci-2026">raporcie o prowizjach biur</Link>.
        </>
      ),
    },
    {
      q: "Czy prowizję pośrednika można negocjować?",
      a: "Tak. Stawka z cennika to punkt wyjścia. Niższą łatwiej uzyskać przy umowie na wyłączność, droższym mieszkaniu albo gdy biuro ma mniej pracy.",
    },
    {
      q: "Kiedy płaci się prowizję biuru nieruchomości?",
      a: "Moment zapłaty określa umowa pośrednictwa. Najczęściej jest to dzień umowy sprzedaży u notariusza, czasem umowy przedwstępnej.",
    },
    {
      q: "Czy prowizja biura obniża podatek od sprzedaży mieszkania?",
      a: "Tak, jeśli sprzedajesz przed upływem pięciu lat od końca roku nabycia (przy spadku liczy się nabycie przez spadkodawcę). Prowizja jest wtedy kosztem odpłatnego zbycia i zmniejsza dochód. Zachowaj fakturę od biura.",
    },
    {
      q: "Czy prowizja pośrednika jest netto czy brutto?",
      a: vatOk
        ? `To zależy od biura. Wśród ${nBiurGen(vat.n)} z katalogu z procentową stawką za sprzedaż ${fmtShare((100 * vat.plusVat) / vat.n)} podaje ją netto, ${fmtShare((100 * vat.gross) / vat.n)} brutto, a ${fmtShare((100 * vat.unknown) / vat.n)} nie pisze tego wprost. Zapytaj o to przed podpisem.`
        : "To zależy od biura. Zapytaj przed podpisem, czy stawka zawiera 23% VAT.",
    },
    {
      q: "Umowa na wyłączność czy otwarta: co jest lepsze przy sprzedaży mieszkania?",
      a: "Wyłączność ułatwia negocjację stawki i zakresu usług, ale wiąże cię z jednym biurem. Umowa otwarta pozwala pracować z kilkoma biurami i szukać kupca samemu. Wyłączność wybieraj po porównaniu ofert i na krótszy okres.",
    },
    {
      q: "Czy przy umowie na wyłączność mogę sprzedać mieszkanie sam?",
      a: "Możesz, ale to, czy zapłacisz wtedy prowizję, zależy od umowy. Umowy na wyłączność często ją przewidują. Jeśli chcesz zachować prawo do sprzedaży bez prowizji, np. komuś z rodziny, wpisz to przed podpisem.",
    },
    {
      q: "Kto płaci notariusza przy sprzedaży mieszkania?",
      a: "Koszty aktu zwykle pokrywa kupujący, ale strony mogą umówić się inaczej, więc zapisz to w umowie przedwstępnej.",
    },
  ];
  return (
    <BlogArticle post={post} extraLd={[faqLd(faq)]}>
      <ShortAnswer>
        Sprzedaż mieszkania z biurem kosztuje prowizję, ale daje oszczędność czasu i mniejsze ryzyko błędów w cenie,
        dokumentach i umowie.
        {has
          ? ` Wśród ${nBiurGen(report.n)} z katalogu, które podają na stronie procentową stawkę za sprzedaż, mediana najniższej stawki z cennika to ${fmtRate(report.median)} ceny${quartOk ? ` (połowa biur: ${fmtRate(p25)}-${fmtRate(p75)})` : ""}, czyli przy mieszkaniu za ${fmtPln(EXAMPLE)} około ${fmtPln(fee)} plus ewentualny VAT.`
          : ""}{" "}
        Samemu warto sprzedawać, gdy masz kupca z polecenia, czas na prezentacje i komplet dokumentów. Policz swój koszt w
        kalkulatorze poniżej.
      </ShortAnswer>

      <h2>Ile kosztuje pośrednik: kalkulator prowizji</h2>
      <p>
        Wpisz cenę, za którą chcesz sprzedać mieszkanie. Stawki w tabeli pochodzą z cenników biur na ich stronach
        {has ? ` (${nBiurGen(report.n)} z katalogu)` : ""}. Jeśli masz już ofertę od biura, wpisz jego stawkę.
      </p>
      <CommissionCalculator median={median} p25={p25} p75={p75} defaultPrice={EXAMPLE} />
      {vatOk && (
        <p className="note">
          Netto czy brutto? {fmtShare((100 * vat.plusVat) / vat.n)} biur z cennikiem podaje stawkę netto albo z
          dopiskiem „+ VAT”, {fmtShare((100 * vat.gross) / vat.n)} brutto, a {fmtShare((100 * vat.unknown) / vat.n)} nie
          pisze tego wprost. Zapytaj o to przed podpisaniem umowy: 23% VAT to przy {fmtPln(EXAMPLE)} i stawce{" "}
          {fmtRate(has ? report.median : 2)} około {fmtPln((EXAMPLE * (has ? (report.median as number) : 2) * 0.23) / 100)}{" "}
          różnicy.
        </p>
      )}

      <Example title={`Przykład: mieszkanie za ${fmtPln(EXAMPLE)}`}>
        <p>
          Przy stawce {fmtRate(exRate)} ({exRateNote}) prowizja to {fmtPln(EXAMPLE)} × {fmtRate(exRate)} ={" "}
          {fmtPln(exFee)}. Jeśli to stawka netto, doliczasz 23% VAT ({fmtPln(exFee * 0.23)}) i płacisz razem{" "}
          {fmtPln(exFee * 1.23)}.
        </p>
        {feeLow != null && feeHigh != null && feeHigh > feeLow && (
          <p>
            W tańszym biurze (25. percentyl cenników, {fmtRate(p25)}) zapłacisz {fmtPln(feeLow)}, a w droższym (75.
            percentyl, {fmtRate(p75)}) {fmtPln(feeHigh)}. Różnica to {fmtPln(feeHigh - feeLow)}.
          </p>
        )}
      </Example>

      <Example title="Prowizja przy innych cenach mieszkania">
        <p>
          Prowizja to procent, więc rośnie razem z ceną
          {median != null ? "" : ` (przykładowa stawka ${fmtRate(exRate)}, bo mamy za mało cenników na medianę)`}.
          Kwoty bez VAT:
        </p>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Cena mieszkania</th>
                {p25 != null && <th className="num">Tańsze biuro ({fmtRate(p25)})</th>}
                <th className="num">{median != null ? `Mediana (${fmtRate(median)})` : `Stawka ${fmtRate(exRate)}`}</th>
                {p75 != null && <th className="num">Droższe biuro ({fmtRate(p75)})</th>}
              </tr>
            </thead>
            <tbody>
              {PRICES.map((price) => (
                <tr key={price}>
                  <td>{fmtPln(price)}</td>
                  {p25 != null && <td className="num">{fmtPln((price * p25) / 100)}</td>}
                  <td className="num">{fmtPln((price * exRate) / 100)}</td>
                  {p75 != null && <td className="num">{fmtPln((price * p75) / 100)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Example>

      {distOk && (
        <>
          <h3>Jak rozkładają się stawki w cennikach</h3>
          <p>
            {distTop.length === 1
              ? `Najczęściej biura podają najniższą stawkę w przedziale ${distTop[0].label} (${nBiur(distMax)} z ${sale.length}).`
              : `Najczęściej biura podają najniższą stawkę w przedziałach ${distTop.map((d) => d.label).join(" i ")} (po ${nBiur(distMax)} z ${sale.length}).`}{" "}
            Stawkę poniżej 2% ma {fmtShare(shareUnder2)} biur, a 3% lub więcej {fmtShare(share3)}. To stawki „od”, więc w
            umowie może być wyższa. Zapytaj, od czego zależy.
          </p>
          <Columns
            title="Najniższa stawka za sprzedaż w cennikach biur: liczba biur w przedziałach"
            caption={`Źródło: cenniki na stronach ${nBiurGen(sale.length)} z katalogu, jedna najniższa procentowa stawka za sprzedaż na biuro. Pomijamy stawki spoza przedziału 0,5-10%, bo zwykle są błędnym odczytem.`}
            rows={dist}
            format={(v) => fmtInt(v)}
            valueHeader="Liczba biur"
          />
        </>
      )}

      {vatOk && (
        <BarList
          title="Czy stawka za sprzedaż w cenniku zawiera VAT"
          caption={`Odsetek ${nBiurGen(vat.n)} z katalogu, które podają procentową stawkę za sprzedaż (jedna najniższa stawka na biuro).`}
          rows={[
            { label: "Netto lub „+ VAT”", value: (100 * vat.plusVat) / vat.n, note: nBiur(vat.plusVat) },
            { label: "Brutto (z VAT)", value: (100 * vat.gross) / vat.n, note: nBiur(vat.gross) },
            { label: "Nie pisze wprost", value: (100 * vat.unknown) / vat.n, note: nBiur(vat.unknown) },
          ]}
          format={fmtShare}
          max={100}
          valueHeader="Odsetek biur"
        />
      )}

      {chartCities.length >= 2 && (
        <>
          <h3>Stawki w miastach</h3>
          <p>
            W większości miast mamy cenniki tylko kilku biur, więc mediana miasta to wskazówka do rozmowy, a nie cena
            rynkowa. Biura i ich cenniki:{" "}
            {chartCities.map((c, i) => (
              <span key={c.slug}>
                <Link href={`/${c.slug}`}>{c.name}</Link>
                {i < chartCities.length - 1 ? ", " : "."}
              </span>
            ))}
          </p>
          <BarList
            title="Mediana najniższej stawki za sprzedaż w miastach"
            caption={`Tylko miasta ze stawkami co najmniej ${nBiurGen(PRICE_STAT_MIN)}${reportCities.length > CITY_CHART_MAX ? `, ${CITY_CHART_MAX} z największą próbą` : ""}. Przy tak małych próbach różnice rzędu kilku dziesiątych punktu procentowego mogą być przypadkowe. Źródło: cenniki biur z katalogu.`}
            rows={chartCities.map((c) => ({ label: c.name, value: c.median, note: `${nBiur(c.n)} w próbie` }))}
            format={fmtRate}
            valueHeader="Mediana stawki"
          />
        </>
      )}
      <p>
        Mediany we wszystkich miastach, dla których mamy stawki co najmniej {nBiurGen(PRICE_STAT_MIN)}, są w raporcie{" "}
        <Link href="/raporty/prowizje-biur-nieruchomosci-2026">prowizje biur nieruchomości 2026</Link>. Jak liczy się
        prowizję krok po kroku, opisujemy w poradniku{" "}
        <Link href="/poradnik/ile-bierze-biuro-nieruchomosci">ile bierze biuro nieruchomości</Link>.
      </p>

      <h2>Co robi biuro w ramach prowizji</h2>
      <ul className="plain">
        <li>Wycena i ustalenie ceny ofertowej na podstawie transakcji z okolicy.</li>
        <li>Zdjęcia, opis, czasem film lub wirtualny spacer, publikacja na portalach i w bazie biura.</li>
        <li>Odbieranie telefonów, selekcja zainteresowanych i prezentacje mieszkania.</li>
        <li>Negocjacje ceny i warunków z kupującym.</li>
        <li>Skompletowanie dokumentów (zaświadczenia ze spółdzielni lub wspólnoty, księga wieczysta, brak zameldowań).</li>
        <li>Przygotowanie umowy przedwstępnej i umówienie notariusza, pomoc przy kredycie kupującego.</li>
      </ul>
      <p>
        Zakres usług wynika z umowy, więc dwie oferty z tą samą stawką mogą być warte coś innego. Wpisz do umowy portale,
        sesję zdjęciową i częstotliwość raportów. Zapytaj, co jest płatne osobno, np. home staging albo operat
        rzeczoznawcy.
      </p>

      <h2>Umowa otwarta czy na wyłączność</h2>
      <p>
        Umowa pośrednictwa musi mieć formę pisemną albo elektroniczną, inaczej jest nieważna. Pośrednik musi mieć
        obowiązkowe ubezpieczenie OC, więc poproś o kopię polisy. Potem wybierasz rodzaj umowy.
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th />
              <th>Umowa otwarta</th>
              <th>Umowa na wyłączność</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Ile biur</td>
              <td>Kilka naraz, możesz też szukać kupca sam.</td>
              <td>Jedno przez cały czas trwania umowy.</td>
            </tr>
            <tr>
              <td>Zaangażowanie biura</td>
              <td>Bez pewności wynagrodzenia biuro może mniej inwestować w zdjęcia i reklamę.</td>
              <td>Łatwiej wymagać zdjęć, reklam i raportów.</td>
            </tr>
            <tr>
              <td>Stawka</td>
              <td>Mniej argumentów do negocjacji.</td>
              <td>Łatwiej o niższą stawkę albo dodatkowe usługi.</td>
            </tr>
            <tr>
              <td>Sprzedaż samodzielna</td>
              <td>Zwykle bez prowizji, jeśli kupca znajdziesz sam.</td>
              <td>Zależy od umowy, często prowizja należy się także wtedy.</td>
            </tr>
            <tr>
              <td>Ryzyko</td>
              <td>To samo mieszkanie w kilku ogłoszeniach, czasem w różnych cenach.</td>
              <td>Jesteś związany z biurem, nawet jeśli słabo pracuje.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Wyłączność ma sens, gdy wybrałeś biuro po porównaniu ofert i wpisałeś do umowy jego obowiązki. Umowa otwarta
        pasuje, gdy chcesz sprawdzić rynek. Wtedy zwykle wystarczą dwa albo trzy biura, bo przy większej liczbie trudno
        kontrolować ogłoszenia.
      </p>
      <h3>Zapisy, które sprawdzasz przed podpisem</h3>
      <ul className="plain">
        <li>
          <b>Czas trwania i wypowiedzenie.</b> Krótszy okres na start pozwala zmienić biuro, jeśli sprzedaż nie idzie.
          Sprawdź, czy i z jakim okresem możesz wypowiedzieć umowę.
        </li>
        <li>
          <b>Moment zapłaty.</b> Najbezpieczniej płacić po umowie sprzedaży u notariusza. Jeśli prowizja jest należna już
          po umowie przedwstępnej, zapytaj, co się stanie, gdy kupujący się wycofa.
        </li>
        <li>
          <b>Ochrona po zakończeniu umowy.</b> Umowy często przewidują prowizję, gdy po ich wygaśnięciu sprzedasz
          mieszkanie osobie wskazanej przez biuro. Sprawdź długość tego okresu i poproś o listę takich osób na piśmie.
          Przy wyłączności sprawdź też, czy zapłacisz, gdy kupca znajdziesz sam.
        </li>
        <li>
          <b>Kary umowne.</b> Uważaj na kary za wycofanie mieszkania ze sprzedaży albo odmowę sprzedaży kupcowi, który
          akceptuje cenę z umowy.
        </li>
        <li>
          <b>Prowizja od kupującego.</b> Zapytaj, czy biuro bierze ją także od kupującego. Trwają prace nad przepisami,
          które mają to ograniczyć, ale dziś decyduje umowa.
          {buyerOk
            ? buyer.free > 0
              ? ` W cennikach ${nBiurGen(buyer.brands)} z katalogu, które piszą wprost o kupującym, ${nBiur(buyer.free)} ${plural(buyer.free, "podaje", "podają", "podaje")} 0% dla kupującego.`
              : ` Żadne z ${nBiurGen(buyer.brands)} z katalogu, które piszą w cenniku wprost o kupującym, nie podaje 0% dla kupującego.`
            : ""}{" "}
          Więcej:{" "}
          <Link href={blogPath("czy-kupujacy-placi-prowizje-biuru-nieruchomosci")}>czy kupujący płaci prowizję biuru</Link>.
        </li>
      </ul>
      <p>
        Jeśli zapis wydaje ci się jednostronny, poradź się miejskiego lub powiatowego rzecznika konsumentów. Ostateczne
        warunki wynikają z umowy i przepisów.
      </p>

      <h2>Kiedy sprzedać samemu, a kiedy z biurem</h2>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Samodzielnie ma sens, gdy</th>
              <th>Biuro ma sens, gdy</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Masz kupca z polecenia albo z rodziny.</td>
              <td>Nie masz czasu na telefony i prezentacje.</td>
            </tr>
            <tr>
              <td>Mieszkanie jest typowe i łatwo je wycenić.</td>
              <td>Nieruchomość jest nietypowa (dom, działka, lokal z najemcą).</td>
            </tr>
            <tr>
              <td>Masz komplet dokumentów i stan prawny jest prosty.</td>
              <td>Są komplikacje: hipoteka, współwłaściciele, spadek, brak księgi wieczystej.</td>
            </tr>
            <tr>
              <td>Mieszkasz blisko i możesz pokazywać mieszkanie.</td>
              <td>Sprzedajesz z innego miasta albo z zagranicy.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <Example title="Ile musisz wynegocjować sam, żeby wyjść na swoje">
        <p>
          Sprzedajesz mieszkanie za {fmtPln(EXAMPLE)} bez biura i oszczędzasz {fmtPln(exFee)} ({fmtRate(exRate)},{" "}
          {exRateNote}). Jeśli jednak ustawisz cenę za nisko albo ustąpisz kupującemu o {fmtRate(exRate)} więcej, niż
          ustąpiłby pośrednik, oszczędność znika. Dolicz też swój czas na telefony i prezentacje.
        </p>
      </Example>
      <p>
        Trzecia droga to skup mieszkań: płaci szybko, ale zarabia na odsprzedaży, więc zwykle oferuje mniej. Porównaj jego
        ofertę z wyceną biura. Jeśli nie musisz sprzedawać od razu, policz wynajem:{" "}
        <Link href={blogPath("prowizja-za-wynajem-mieszkania")}>prowizja za wynajem mieszkania</Link>.
      </p>

      <h2>Sprzedaż mieszkania samodzielnie krok po kroku</h2>
      <ol>
        <li>
          <b>Sprawdź stan prawny.</b> W systemie Elektronicznych Ksiąg Wieczystych sprawdź właściciela, hipoteki i inne
          wpisy. Jeśli lokal nie ma księgi, ustal sytuację ze spółdzielnią i notariuszem.
        </li>
        <li>
          <b>Zbierz dokumenty</b> z listy niżej. Notariusz może wymagać aktualnych zaświadczeń, więc część zamów, gdy
          znasz termin aktu.
        </li>
        <li>
          <b>Ustal cenę.</b> Porównaj podobne mieszkania w ogłoszeniach, także w{" "}
          <Link href="/oferty">aktualnych ofertach biur</Link>, ale to ceny ofertowe. Ceny transakcyjne zawiera rejestr cen
          nieruchomości prowadzony przez starostwa i miasta na prawach powiatu.
        </li>
        <li>
          <b>Przygotuj mieszkanie i ogłoszenie.</b> Posprzątaj, zrób zdjęcia przy dziennym świetle i prosty plan. Podaj
          metraż, piętro, liczbę pokoi, opłaty, stan prawny i opis okolicy.
        </li>
        <li>
          <b>Pokazuj mieszkanie.</b> Umawiaj prezentacje w blokach i nie wysyłaj kopii dokumentów przypadkowym osobom.
        </li>
        <li>
          <b>Negocjuj.</b> Przy kredycie zapytaj o decyzję kredytową. Ustal cenę, termin wydania i to, co zostaje w
          mieszkaniu.
        </li>
        <li>
          <b>Podpisz umowę przedwstępną</b> z ceną, terminami i zadatkiem albo zaliczką. Zadatek wzmacnia umowę: gdy
          kupujący się wycofa, możesz go zatrzymać, a gdy wycofasz się ty, kupujący może żądać zwrotu podwójnej kwoty.
          Zaliczkę zwraca się w całości.
        </li>
        <li>
          <b>Podpisz umowę sprzedaży u notariusza.</b> Przeniesienie własności wymaga aktu notarialnego. Przy kredycie
          kupującego bank wypłaca pieniądze po akcie, na zasadach z umowy kredytu.
        </li>
        <li>
          <b>Przekaż mieszkanie.</b> Spisz protokół ze stanem liczników i zgłoś zmianę właściciela zarządcy oraz
          dostawcom mediów.
        </li>
      </ol>

      <h2>Sprzedaż mieszkania z biurem krok po kroku</h2>
      <ol>
        <li>
          <b>Wybierz trzy biura</b> po stawkach, opiniach i stażu w katalogu.
        </li>
        <li>
          <b>Umów wyceny.</b> Zapytaj, na jakich transakcjach biuro opiera cenę. Uważaj na biuro, które obiecuje cenę
          wyraźnie wyższą niż pozostałe tylko po to, żeby dostać umowę.
        </li>
        <li>
          <b>Negocjuj umowę:</b> stawkę, rodzaj umowy, czas trwania, zakres usług.
        </li>
        <li>
          <b>Zatwierdź ogłoszenie</b> przed publikacją i pilnuj raportów z zapytań i prezentacji.
        </li>
        <li>
          <b>Decyduj o cenie.</b> Biuro przekazuje oferty, a ty czytasz projekt umowy przedwstępnej przed spotkaniem.
        </li>
        <li>
          <b>Zapłać po akcie</b> na podstawie faktury albo rachunku i zachowaj go do rozliczenia podatku.
        </li>
      </ol>

      <h2>Dokumenty do sprzedaży mieszkania</h2>
      <p>Ostateczną listę ustala notariusz, ale większość dokumentów powtarza się w każdej transakcji.</p>
      <Checklist
        title="Dokumenty do sprzedaży mieszkania"
        items={[
          "Dowód osobisty i numer księgi wieczystej.",
          "Dokument nabycia: akt notarialny kupna lub darowizny, postanowienie o stwierdzeniu nabycia spadku albo akt poświadczenia dziedziczenia.",
          "Przy mieszkaniu spółdzielczym: zaświadczenie ze spółdzielni o prawie do lokalu i braku zaległości.",
          "Zaświadczenie od wspólnoty lub zarządcy o braku zaległości.",
          "Zaświadczenie o osobach zameldowanych albo o ich braku.",
          "Świadectwo charakterystyki energetycznej dla kupującego.",
          "Przy kredycie: zaświadczenie z banku o kwocie do spłaty, a po spłacie zgoda na wykreślenie hipoteki.",
          "Przy spadku lub darowiźnie: zaświadczenie z urzędu skarbowego o rozliczeniu podatku od spadków i darowizn.",
        ]}
      />

      <h2>Jak negocjować prowizję</h2>
      <p>
        Stawka z cennika to punkt wyjścia.
        {feeLow != null && feeHigh != null && feeHigh > feeLow
          ? ` Połowa biur z katalogu podaje od ${fmtRate(p25)} do ${fmtRate(p75)}, więc przy mieszkaniu za ${fmtPln(EXAMPLE)} różnica to około ${fmtPln(feeHigh - feeLow)}.`
          : ""}{" "}
        Argumenty, które działają:
      </p>
      <ul className="plain">
        <li>
          <b>Oferty konkurencji.</b> Pokaż stawki innych biur, np. z listy{" "}
          <Link href="/poradnik/biura-z-jawnym-cennikiem">biur z jawnym cennikiem</Link>.
        </li>
        <li>
          <b>Wyłączność za niższą stawkę.</b> Biuro ma większą pewność wynagrodzenia.
        </li>
        <li>
          <b>Stawka zależna od ceny.</b> Niższy procent do ceny, którą uważasz za realną, i wyższy od nadwyżki daje biuru
          powód, żeby walczyć o więcej.
        </li>
        <li>
          <b>Kwota stała.</b> Przy droższym mieszkaniu może wyjść korzystniej niż procent.
        </li>
        <li>
          <b>Mniej pracy dla biura.</b> Masz zdjęcia, dokumenty albo kupca z polecenia.
        </li>
      </ul>
      {fee != null && feeHigh != null && median != null && p75 != null && p75 > median && (
        <Example title="Przykład negocjacji">
          <p>
            Biuro proponuje {fmtRate(p75)}, czyli stawkę z górnej ćwiartki cenników: przy {fmtPln(EXAMPLE)} to{" "}
            {fmtPln(feeHigh)}. Jeśli wynegocjujesz medianę, {fmtRate(median)}, zapłacisz {fmtPln(fee)}, czyli{" "}
            {fmtPln(feeHigh - fee)} mniej, a ze stawkami netto {fmtPln((feeHigh - fee) * 1.23)} mniej razem z VAT.
          </p>
        </Example>
      )}

      <h2>Podatek przy sprzedaży przed upływem 5 lat</h2>
      <p>
        Jeśli sprzedajesz mieszkanie przed upływem pięciu lat, licząc od końca roku nabycia, od dochodu płacisz 19%
        podatku. Przy spadku liczy się nabycie przez spadkodawcę. Mieszkanie kupione w {buyYear} r. sprzedasz bez tego
        podatku od 1 stycznia {buyYear + 6} r.
      </p>
      <p>
        Dochód to cena sprzedaży pomniejszona o koszty sprzedaży (w tym prowizję pośrednika) oraz o udokumentowane koszty
        nabycia i nakłady. PIT-39 składasz do 30 kwietnia roku po sprzedaży. Zwolniona jest część dochodu odpowiadająca
        kwocie wydanej w ciągu trzech lat od końca roku sprzedaży na własne cele mieszkaniowe (ulga mieszkaniowa).
      </p>
      <Example title="Przykład z założonymi kwotami">
        <p>
          Kupiłeś mieszkanie za {fmtPln(BOUGHT)} z kosztami zakupu i sprzedajesz je przed upływem 5 lat za{" "}
          {fmtPln(EXAMPLE)}, płacąc biuru {fmtPln(exFee)} ({fmtRate(exRate)}, {exRateNote}). Dochód: {fmtPln(EXAMPLE)}{" "}
          minus {fmtPln(exFee)} minus {fmtPln(BOUGHT)} = {fmtPln(gain)}. Podatek 19%: {fmtPln(tax)}. Bez prowizji w
          kosztach byłoby {fmtPln(taxNoFee)}, więc faktura od biura obniża podatek o {fmtPln(taxNoFee - tax)}.
        </p>
      </Example>
      <p className="note">
        To uproszczony opis zasad, a nie porada podatkowa. Szczegóły sprawdź w Krajowej Informacji Skarbowej albo u
        doradcy podatkowego. Przepisy mogą się zmienić.
      </p>

      <h2>Najczęstsze błędy przy sprzedaży mieszkania</h2>
      <ul className="plain">
        <li>
          <b>Za wysoka cena na start.</b> Mieszkanie, które długo wisi w ogłoszeniach, osłabia twoją pozycję w
          negocjacjach.
        </li>
        <li>
          <b>Zaliczka zamiast zadatku.</b> Gdy kupujący się wycofa, zwracasz wszystko i zostajesz bez rekompensaty.
        </li>
        <li>
          <b>Brak dokumentów w dniu aktu.</b> Jedno zaświadczenie może przesunąć termin u notariusza i wypłatę kredytu
          kupującego.
        </li>
        <li>
          <b>Brak faktur.</b> Przy sprzedaży przed upływem 5 lat bez faktur za zakup, remont i prowizję trudniej
          udokumentować koszty.
        </li>
      </ul>

      <h2>Jak wybrać biuro do sprzedaży</h2>
      <ol>
        <li>
          Porównaj stawki co najmniej trzech biur. W katalogu włącz filtr „Jawny cennik” albo zajrzyj do listy{" "}
          <Link href="/poradnik/biura-z-jawnym-cennikiem">biur z jawnym cennikiem</Link>.
        </li>
        <li>
          Sprawdź opinie: liczbę i treść, nie tylko gwiazdki. Dlaczego, piszemy w artykule{" "}
          <Link href={blogPath("ocena-5-w-google-biuro-nieruchomosci")}>o ocenie 5,0 w Google</Link>.
        </li>
        <li>
          Sprawdź biuro w rejestrze i polisę OC pośrednika:{" "}
          <Link href="/poradnik/jak-sprawdzic-biuro-nieruchomosci">jak sprawdzić biuro nieruchomości</Link>.
        </li>
        <li>Przeczytaj umowę: wyłączność, okres obowiązywania, kiedy prowizja jest należna, kary umowne.</li>
      </ol>
      {(pricesShare != null || overviewOk || tenureOk) && (
        <p>
          Liczby z katalogu:
          {pricesShare != null
            ? ` cennik na stronie publikuje ${fmtShare(pricesShare)} biur, więc ${pricesShare < 50 ? "u większości" : "u pozostałych"} o stawkę trzeba zapytać.`
            : ""}
          {overviewOk
            ? ` Spośród biur z oceną Google ${fmtShare(overview.shareFew)} ma mniej niż ${nOpinii(MIN_REVIEWS)}, a wtedy nawet 5,0 niewiele mówi.`
            : ""}
          {tenureOk
            ? ` Typowe biuro działa ${fmtYears(tenure.medianYears)} (mediana stażu od daty wpisu do KRS albo wykazu podatników VAT). Więcej o stażu: `
            : ""}
          {tenureOk && (
            <>
              <Link href={blogPath("najdluzej-dzialajace-biura-nieruchomosci")}>najdłużej działające biura</Link>.
            </>
          )}
        </p>
      )}
      <p>
        Ranking biur w mieście łączy te kryteria w jeden wynik według jawnej{" "}
        <Link href="/metodologia">metodologii</Link>. Najwyżej ocenione biura znajdziesz w{" "}
        <Link href="/wyroznienia-2026">Wyróżnieniach 2026</Link> i w <Link href="/ranking">rankingu ogólnopolskim</Link>,
        a wybrane biura zestawisz w <Link href="/porownaj">porównywarce</Link>.
      </p>
      {bigCities.length > 0 && (
        <p>
          Biura w miastach z największym wyborem:{" "}
          {bigCities.map((c, i) => (
            <span key={c.slug}>
              <Link href={`/${c.slug}`}>{c.name}</Link>
              {i < bigCities.length - 1 ? ", " : "."}
            </span>
          ))}{" "}
          Pozostałe są na <Link href="/miasta">liście miast</Link>. Mieszkanie po rodzicach w innym mieście sprzedawaj
          przez biuro z tamtej okolicy. Sieć czy biuro lokalne? Zobacz{" "}
          <Link href={blogPath("siec-czy-lokalne-biuro-nieruchomosci")}>porównanie opinii i stażu</Link>.
        </p>
      )}
      <h3>Pytania do pośrednika</h3>
      <ul className="plain">
        <li>Ile podobnych mieszkań biuro sprzedało w ostatnim roku i w jakiej okolicy?</li>
        <li>Kto poprowadzi moją sprzedaż i jak często dostanę raport?</li>
        <li>Na jakiej podstawie zaproponujecie obniżkę ceny, jeśli nie będzie zainteresowania?</li>
      </ul>
      <Checklist
        title="Przed podpisaniem umowy z biurem"
        items={[
          "Masz oferty trzech biur i wiesz, czy stawki są netto, czy brutto.",
          "Sprawdziłeś firmę w rejestrze i masz kopię polisy OC.",
          "Umowa jest pisemna albo elektroniczna i opisuje zakres usług.",
          "Wiesz, czy to umowa otwarta, czy na wyłączność, i na jak długo.",
          "Wiesz, kiedy prowizja jest należna i czy zapłacisz ją przy sprzedaży samemu.",
          "Znasz okres ochrony po wygaśnięciu umowy i warunki wypowiedzenia.",
          "Rozumiesz każdą karę umowną.",
          "Każda zmiana ceny w ogłoszeniu wymaga twojej zgody.",
        ]}
      />

      <Faq items={faq} />
    </BlogArticle>
  );
}
