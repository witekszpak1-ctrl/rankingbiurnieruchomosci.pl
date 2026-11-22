import type { Metadata } from "next";
import Link from "next/link";

import { BlogArticle, Checklist, Example, Faq, ShortAnswer, faqLd } from "@/components/BlogArticle";
import { BarList, PairBars } from "@/components/BlogCharts";
import { blogMetadata, blogPath, fmtPln, fmtRate, fmtShare, getPost } from "@/lib/blog";
import { SAME_RATE, buyerStats, cityPairs, loadBlogData, loadRates, saleVatStats } from "@/lib/blog-stats";
import { commissionReport } from "@/lib/catalog";
import { inCity } from "@/lib/cities";
import { nBiur, nBiurGen, plural } from "@/lib/plural";
import { PRICE_STAT_MIN } from "@/lib/ranking";

export const revalidate = 86400;

const post = getPost("czy-kupujacy-placi-prowizje-biuru-nieruchomosci");
const EXAMPLE = 500000;
/** Ceny mieszkań do przykładów wyliczeń (to przykłady, nie ceny rynkowe). */
const PRICES = [300000, 500000, 800000];
/** Podatek od czynności cywilnych przy zakupie z rynku wtórnego, % ceny. */
const PCC = 2;
const VAT = 23;
/** Opłata sądowa za wpis własności i osobno za wpis hipoteki do księgi wieczystej. */
const KW_FEE = 200;
/** Przykładowy wkład własny przy kredycie, % ceny (założenie do przykładu, nie wymóg banku). */
const DOWN = 20;
/** Kwartyle ("połowa biur od X do Y", "co czwarte biuro") pokazujemy dopiero od tylu stawek (docs/blog.md, dział 4). */
const QUARTILE_MIN = 8;

export const metadata: Metadata = blogMetadata(post);

const gross = (net: number) => net * (1 + VAT / 100);

export default async function BuyerFeePost() {
  const [rates, report, data] = await Promise.all([
    loadRates().catch(() => []),
    commissionReport().catch(() => null),
    loadBlogData().catch(() => null),
  ]);
  const buyer = buyerStats(rates);
  const vat = saleVatStats(rates);
  const paidOk = buyer.paid.n >= PRICE_STAT_MIN && buyer.paid.median != null;
  const saleOk = report != null && report.n >= PRICE_STAT_MIN && report.median != null;
  const freeOk = buyer.brands >= PRICE_STAT_MIN;
  const vatOk = vat.n >= PRICE_STAT_MIN;
  const paidQ = paidOk && buyer.paid.n >= QUARTILE_MIN;
  const saleQ = saleOk && report.n >= QUARTILE_MIN;
  const fee = paidOk ? (EXAMPLE * (buyer.paid.median as number)) / 100 : null;
  const reportCities = (report?.cities ?? []).filter((c) => c.n >= PRICE_STAT_MIN && c.median != null);
  const pair = data ? (cityPairs(data.cities)[0] ?? null) : null;

  // Stawka do przykładów: mediana dla kupującego z cenników; przy zbyt małej próbie mediana za sprzedaż, a bez danych 2% jako przykład.
  const rate = paidOk ? (buyer.paid.median as number) : saleOk ? (report.median as number) : 2;
  const rateLabel = paidOk
    ? `mediana stawek dla kupującego z cenników biur (${fmtRate(rate)})`
    : saleOk
      ? `mediana stawek za sprzedaż z cenników biur (${fmtRate(rate)}), bo osobnych stawek dla kupującego mamy za mało`
      : `przykładowa stawka ${fmtRate(rate)}, bo nie mamy teraz wystarczającej próby z cenników`;
  const low = paidOk ? (paidQ ? buyer.paid.p25 : null) : saleQ ? (report?.p25 ?? null) : null;
  const target = low != null && low < rate - 0.05 ? low : Math.max(rate - 0.5, 0.5);
  const targetFromData = low != null && low < rate - 0.05;

  const net500 = (EXAMPLE * rate) / 100;
  const pcc500 = (EXAMPLE * PCC) / 100;
  const down500 = (EXAMPLE * DOWN) / 100;
  const costs = PRICES.map((price) => {
    const pcc = (price * PCC) / 100;
    const net = (price * rate) / 100;
    return { price, pcc, net, gross: gross(net), total: pcc + gross(net) };
  });

  const diff = paidOk && saleOk ? (buyer.paid.median as number) - (report.median as number) : null;
  const compare =
    diff == null
      ? null
      : Math.abs(diff) < SAME_RATE
        ? `podobna do mediany za sprzedaż (${fmtRate(report?.median)})`
        : diff < 0
          ? `niższa od mediany za sprzedaż (${fmtRate(report?.median)})`
          : `wyższa od mediany za sprzedaż (${fmtRate(report?.median)})`;
  // Przy mniej niż QUARTILE_MIN stawkach w którejś grupie wykres pokazuje same mediany.
  const withQuartiles = paidQ && saleQ;
  const quartiles =
    paidOk && saleOk
      ? withQuartiles
        ? [
            { label: "dolny kwartyl", a: buyer.paid.p25, b: report.p25 },
            { label: "mediana", a: buyer.paid.median, b: report.median },
            { label: "górny kwartyl", a: buyer.paid.p75, b: report.p75 },
          ]
        : [{ label: "mediana", a: buyer.paid.median, b: report.median }]
      : [];
  const quartMax = Math.ceil(Math.max(1, ...quartiles.flatMap((r) => [r.a ?? 0, r.b ?? 0])));
  const share = (part: number) => (vat.n > 0 ? (100 * part) / vat.n : null);

  const faq = [
    {
      q: "Czy muszę płacić prowizję, jeśli nie podpisałem umowy z biurem?",
      a: "Prowizja należy się na podstawie umowy pośrednictwa, która musi mieć formę pisemną albo elektroniczną. Bez umowy z biurem nie masz obowiązku zapłaty. Uważaj na dokumenty podpisywane przy oglądaniu mieszkania, bo karta prezentacji bywa częścią umowy.",
    },
    {
      q: "Czy muszę podpisać umowę z biurem nieruchomości, żeby obejrzeć mieszkanie?",
      a: "Żaden przepis nie każe kupującemu podpisywać umowy przed oglądaniem. Biuro może jednak pokazywać mieszkanie tylko osobom, które podpiszą umowę lub kartę prezentacji. Wtedy możesz podpisać, wynegocjować warunki przed podpisem albo zrezygnować z prezentacji.",
    },
    {
      q: "Kiedy kupujący płaci prowizję?",
      a: "Termin wynika z umowy. Zwykle jest to dzień podpisania umowy sprzedaży u notariusza, czasem już umowy przedwstępnej. Jeśli transakcja nie dojdzie do skutku, prowizja zwykle nie jest należna, chyba że umowa mówi inaczej.",
    },
    {
      q: "Ile wynosi prowizja biura nieruchomości od kupującego?",
      a: paidOk
        ? `W cennikach ${nBiurGen(buyer.paid.n)} z naszego katalogu, które podają stawkę dla kupującego, mediana najniższej stawki to ${fmtRate(buyer.paid.median)} ceny. Przy mieszkaniu za ${fmtPln(EXAMPLE)} to około ${fmtPln(fee)}, a jeśli stawka jest netto, dochodzi 23% VAT. Ostateczną stawkę określa umowa.`
        : "Biura rzadko podają w cenniku osobną stawkę dla kupującego, dlatego nie liczymy jeszcze mediany. Stawkę ustalasz w umowie pośrednictwa, zwykle jako procent ceny mieszkania albo stałą kwotę.",
      node: paidOk ? undefined : (
        <>
          Biura rzadko podają w cenniku osobną stawkę dla kupującego, dlatego nie liczymy jeszcze mediany. Stawkę ustalasz w umowie pośrednictwa, zwykle jako procent ceny mieszkania albo stałą kwotę. Stawki za sprzedaż znajdziesz w{" "}
          <Link href="/raporty/prowizje-biur-nieruchomosci-2026">raporcie prowizji</Link>.
        </>
      ),
    },
    {
      q: "Czy prowizja biura nieruchomości zawiera VAT?",
      a: "To zależy od biura. Część podaje stawkę netto i dolicza 23% VAT, część podaje stawkę brutto, a część nie pisze tego wprost. Zapytaj przed podpisem i wpisz do umowy, czy stawka jest netto czy brutto.",
    },
    {
      q: "Czy można kupić mieszkanie bez prowizji?",
      a: "Tak. Część biur pobiera prowizję tylko od sprzedającego i pisze w ogłoszeniu „0% dla kupującego”. Możesz też szukać ofert bezpośrednio od właścicieli albo na rynku pierwotnym, gdzie deweloper zwykle sam płaci pośrednikowi.",
    },
    {
      q: "Czy prowizja dla kupującego wchodzi do kredytu?",
      a: "Zwykle nie. Bank finansuje cenę mieszkania, a prowizję, podatek PCC i opłaty notarialne kupujący pokrywa z własnych środków. Uwzględnij je, licząc wkład własny.",
    },
    {
      q: "Czy zapłacę prowizję, jeśli mam umowę na wyłączność, a mieszkanie znajdę sam?",
      a: "To zależy od zapisów umowy. Część umów na wyłączność przewiduje prowizję za każde mieszkanie kupione w czasie trwania umowy, także znalezione samodzielnie. Przed podpisem sprawdź, czy prowizja dotyczy tylko mieszkań wskazanych przez biuro.",
    },
    {
      q: "Czy pośrednik może wziąć prowizję od sprzedającego i od kupującego?",
      a: "Według dotychczasowych zasad tak, jeśli ma umowę z każdą ze stron. Trwają prace nad przepisami, które mają ograniczyć pobieranie prowizji od obu stron transakcji, więc przed podpisaniem umowy sprawdź aktualny stan prawny.",
    },
  ];

  return (
    <BlogArticle post={post} extraLd={[faqLd(faq)]}>
      <ShortAnswer>
        Kupujący płaci prowizję biuru nieruchomości tylko wtedy, gdy podpisał z nim umowę pośrednictwa. Wiele biur ma
        umowy z obiema stronami i bierze prowizję od sprzedającego i od kupującego, ale część biur pobiera ją tylko od
        sprzedającego.
        {buyer.brands >= PRICE_STAT_MIN
          ? buyer.free === 0
            ? paidOk
              ? ` Wszystkie ${nBiur(buyer.brands)} z naszego katalogu, które w cenniku piszą wprost o kupującym, ${plural(buyer.brands, "pobiera", "pobierają", "pobiera")} od niego prowizję (mediana ${fmtRate(buyer.paid.median)} ceny). Biura bez prowizji od kupującego często w ogóle nie piszą o tym w cenniku, tylko w ogłoszeniach.`
              : ""
            : ` W cennikach ${nBiurGen(buyer.brands)} z naszego katalogu, które piszą wprost o kupującym, ${nBiur(buyer.free)} ${plural(buyer.free, "podaje", "podają", "podaje")} 0% dla kupującego${paidOk ? `, a pozostałe biorą od kupującego typowo ${fmtRate(buyer.paid.median)} ceny` : ""}.`
          : ""}{" "}
        Przy zakupie od dewelopera prowizję zwykle płaci deweloper. Do prowizji na rynku wtórnym dolicz podatek PCC, taksę
        notarialną i wpisy do księgi wieczystej.
      </ShortAnswer>

      <h2>Kiedy kupujący płaci prowizję biuru nieruchomości</h2>
      <p>
        Biuro nie może obciążyć cię prowizją tylko dlatego, że pokazało ci mieszkanie albo wysłało link do ogłoszenia.
        Prowizja wynika z umowy pośrednictwa, a ta musi mieć formę pisemną albo elektroniczną. Rozmowa telefoniczna czy
        umówienie prezentacji to jeszcze nie umowa. Jeśli umowę podpisałeś, decydują jej zapisy. Na rynku wtórnym typowe
        są trzy sytuacje, a zakup od dewelopera opisujemy niżej.
      </p>
      <ul className="plain">
        <li>
          <b>Biuro pracuje tylko dla sprzedającego.</b> Ma umowę ze sprzedającym i od niego bierze prowizję. W
          ogłoszeniu często widzisz dopisek „0% dla kupującego”. Nic nie płacisz, ale pamiętaj, że biuro dba wtedy przede
          wszystkim o interes sprzedającego.
        </li>
        <li>
          <b>Biuro ma umowy z obiema stronami.</b> Na rynku wtórnym to częsty układ: sprzedający płaci swoją prowizję, a
          ty swoją. Przed pierwszą prezentacją agent zwykle prosi o podpis pod umową albo kartą prezentacji.
        </li>
        <li>
          <b>Zlecasz biuru szukanie mieszkania.</b> Biuro pracuje wtedy dla ciebie jako agent kupującego: przegląda
          oferty, sprawdza stan prawny, negocjuje cenę. Za tę usługę płacisz procent ceny albo stałą kwotę z umowy.
        </li>
      </ul>
      <h3>Kiedy dokładnie płacisz</h3>
      <p>
        Termin zapłaty ustala umowa. Zwykle prowizja jest należna w dniu aktu notarialnego, czasem już przy umowie
        przedwstępnej. Bezpieczniej płacić po akcie, gdy mieszkanie jest już twoje. Jeśli biuro chce pieniędzy wcześniej,
        dopisz zwrot na wypadek, gdy do umowy sprzedaży nie dojdzie z przyczyn, za które nie odpowiadasz, na przykład
        przez odmowę kredytu.
      </p>

      <h2>Karta prezentacji, umowa pośrednictwa i wyłączność</h2>
      <h3>Karta prezentacji to nie formalność</h3>
      <p>
        Na pierwszym spotkaniu agent często podaje kartę prezentacji, protokół oglądania albo „potwierdzenie
        prezentacji”. Taki dokument potwierdza, że to biuro pokazało ci konkretne mieszkanie. Jeśli zawiera zdanie o
        prowizji, czyli stawkę i termin zapłaty, może być umową pośrednictwa albo jej częścią. Przeczytaj go przed
        podpisem, sprawdź stawkę i zrób zdjęcie podpisanej strony. Nie podpisuj w pośpiechu na klatce schodowej: poproś
        o wzór dokumentu mailem dzień wcześniej.
      </p>
      <h3>Co powinno być w umowie pośrednictwa kupna</h3>
      <ul className="plain">
        <li>Strony umowy i informacja, czy biuro pracuje także dla sprzedającego.</li>
        <li>Stawka jako procent albo kwota oraz cena, od której się ją liczy: z aktu notarialnego, a nie z ogłoszenia.</li>
        <li>Czy stawka jest netto czy brutto, a jeśli netto, czy biuro dolicza 23% VAT.</li>
        <li>Moment, w którym prowizja jest należna, i termin płatności.</li>
        <li>Zakres usług: prezentacje, sprawdzenie księgi wieczystej, zebranie zaświadczeń, pomoc przy kredycie.</li>
        <li>Czas trwania umowy i zasady wypowiedzenia.</li>
        <li>Okres ochronny: jak długo po zakończeniu umowy prowizja należy się za mieszkanie pokazane przez biuro.</li>
        <li>Wyłączność: czy możesz szukać sam albo z innymi biurami.</li>
        <li>Dane polisy OC pośrednika, bo to ubezpieczenie jest obowiązkowe.</li>
      </ul>
      <h3>Umowa na wyłączność dla kupującego</h3>
      <p>
        Wyłączność przy kupnie oznacza zwykle, że przez czas umowy szukasz mieszkania tylko przez jedno biuro. Sprawdź,
        czy prowizja dotyczy tylko mieszkań wskazanych przez biuro, czy każdego kupionego w tym czasie, także
        znalezionego samodzielnie. Zapisy, które rażąco naruszają interesy konsumenta, mogą zostać uznane za
        niedozwolone, ale łatwiej od razu poprosić o zmianę zapisu.
      </p>

      <h2>Ile wynosi prowizja dla kupującego: dane z cenników biur</h2>
      {paidOk ? (
        <p>
          W cennikach, które podają stawkę dla kupującego (osobno albo jako „zakup nieruchomości”), mediana to {fmtRate(buyer.paid.median)} ceny
          {paidQ
            ? `, a połowa biur bierze od ${fmtRate(buyer.paid.p25)} do ${fmtRate(buyer.paid.p75)}`
            : ""}{" "}
          (próba: {nBiurGen(buyer.paid.n)}
          {paidQ ? "" : `; przedział „połowa biur” podajemy dopiero od ${QUARTILE_MIN} stawek`}). Przy mieszkaniu za {fmtPln(EXAMPLE)} to
          około {fmtPln(fee)}, a jeśli stawka jest netto, dochodzi 23% VAT.
        </p>
      ) : (
        <p>
          Biura rzadko podają w cenniku osobną stawkę dla kupującego. Zwykle jest to podobny procent ceny jak dla
          sprzedającego.
          {report && report.median != null
            ? ` Typowa stawka za sprzedaż w naszym katalogu to ${fmtRate(report.median)}.`
            : ""}
        </p>
      )}
      {report && report.firms > 0 && (
        <p>
          W katalogu mamy {nBiur(report.firms)}, a cennik na stronie znaleźliśmy u {nBiurGen(report.withPrices)}.
          {buyer.brands > 0
            ? ` Wprost o kupującym ${plural(buyer.brands, "pisze", "piszą", "pisze")} ${nBiur(buyer.brands)}.`
            : " Żadne z nich nie pisze teraz wprost o kupującym."}{" "}
          Liczymy najniższą stawkę z cennika każdego biura, więc w umowie możesz zobaczyć więcej. To biura z naszego
          katalogu, a nie cały rynek.
        </p>
      )}
      {freeOk && (
        <BarList
          title="Co biura piszą w cennikach o prowizji od kupującego"
          caption={`Biura z katalogu, których cennik wprost wymienia kupującego albo zakup nieruchomości: ${nBiur(buyer.brands)}. Biura, które o kupującym nie piszą, nie są tu liczone. Źródło: cenniki na stronach biur.`}
          rows={[
            { label: "0% dla kupującego", value: buyer.free },
            { label: "prowizja od kupującego", value: buyer.paid.n },
          ]}
          format={(v) => nBiur(v)}
          valueHeader="Biura"
        />
      )}
      {quartiles.length > 0 && (
        <>
          <p>
            Mediana dla kupującego ({fmtRate(buyer.paid.median)}) jest {compare}. Traktuj obie liczby jako punkt
            odniesienia w rozmowie z biurem, a nie gwarancję.
          </p>
          <PairBars
            title="Stawki prowizji w cennikach biur: kupujący i sprzedaż"
            caption={`Najniższa stawka procentowa z cennika każdego biura, netto albo brutto tak, jak podaje biuro. Kupujący: ${nBiur(buyer.paid.n)}, sprzedaż: ${nBiur(report?.n ?? 0)}. ${withQuartiles ? "Połowa biur mieści się między dolnym a górnym kwartylem." : `Kwartyle pokazujemy od ${QUARTILE_MIN} stawek w każdej grupie, więc tu są same mediany.`} Źródło: cenniki na stronach biur z katalogu.`}
            nameA="Kupujący"
            nameB="Sprzedaż"
            rows={quartiles}
            format={(v) => fmtRate(v)}
            max={quartMax}
          />
        </>
      )}
      <h3>Netto czy brutto</h3>
      <p>
        Stawka w cenniku bywa netto i wtedy, jeśli biuro jest podatnikiem VAT, do prowizji dochodzi 23% VAT.
        {vatOk
          ? ` Wśród ${nBiurGen(vat.n)} z procentową stawką za sprzedaż ${fmtShare(share(vat.plusVat))} podaje ją netto albo z dopiskiem „+ VAT”, ${fmtShare(share(vat.gross))} brutto, a ${fmtShare(share(vat.unknown))} nie pisze tego wprost.`
          : ""}{" "}
        Przy mieszkaniu za {fmtPln(EXAMPLE)} i stawce {fmtRate(rate)} różnica między netto a brutto to około{" "}
        {fmtPln((net500 * VAT) / 100)}.
      </p>
      {vatOk && (
        <BarList
          title="Jak biura podają stawkę za sprzedaż: netto czy brutto"
          caption={`Odsetek biur z procentową stawką za sprzedaż w cenniku (${nBiur(vat.n)}). Źródło: cenniki na stronach biur z katalogu.`}
          rows={[
            { label: "netto lub „+ VAT”", value: share(vat.plusVat) },
            { label: "brutto", value: share(vat.gross) },
            { label: "bez informacji", value: share(vat.unknown) },
          ]}
          format={(v) => fmtShare(v)}
          max={100}
          valueHeader="Odsetek biur"
        />
      )}
      <h3>Prowizja w twoim mieście</h3>
      <p>
        Stawek dla kupującego jest za mało, żeby liczyć je osobno dla miast. Dla porównania pokazujemy mediany stawek za
        sprzedaż w miastach, w których mamy cenniki co najmniej {nBiurGen(PRICE_STAT_MIN)}.
      </p>
      {reportCities.length >= 2 && (
        <BarList
          title="Mediana stawki za sprzedaż w miastach z cennikami biur"
          caption={`Mediana najniższych stawek procentowych z cenników biur w mieście, tylko miasta ze stawkami co najmniej ${nBiurGen(PRICE_STAT_MIN)}. Źródło: cenniki na stronach biur z katalogu.`}
          rows={reportCities.slice(0, 10).map((c) => ({ label: c.name, value: c.median, note: `stawki ${nBiurGen(c.n)}` }))}
          format={(v) => fmtRate(v)}
          valueHeader="Mediana stawki"
        />
      )}
      {reportCities.length > 0 && (
        <p>
          Biura i ich oceny w miastach z cennikami:{" "}
          {reportCities.slice(0, 6).map((c, i) => (
            <span key={c.slug}>
              {i > 0 ? ", " : ""}
              <Link href={`/${c.slug}`}>biura nieruchomości {inCity(c.name)}</Link>
            </span>
          ))}
          . Pozostałe miasta znajdziesz na <Link href="/miasta">liście miast</Link>.
        </p>
      )}

      <h2>Rynek pierwotny i wtórny: kto płaci pośrednikowi</h2>
      <p>
        Na rynku pierwotnym kupujesz od dewelopera. W jego biurze sprzedaży nie płacisz prowizji, a pośrednika, z którym
        deweloper współpracuje, opłaca zwykle deweloper. Niektóre biura biorą jednak od kupującego opłatę za wyszukanie
        mieszkania u dewelopera, więc zapytaj o to na początku. Na rynku wtórnym częściej spotkasz prowizję od obu stron i
        dochodzi podatek PCC. Przy zakupie od dewelopera PCC zwykle nie płacisz, bo w cenie jest VAT.
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Koszt</th>
              <th>Rynek wtórny</th>
              <th>Rynek pierwotny</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Prowizja biura</td>
              <td>Gdy podpiszesz umowę z biurem</td>
              <td>Zwykle płaci deweloper</td>
            </tr>
            <tr>
              <td>Podatek</td>
              <td>PCC 2% ceny, z wyjątkiem pierwszego mieszkania</td>
              <td>VAT w cenie, bez PCC</td>
            </tr>
            <tr>
              <td>Notariusz</td>
              <td>Taksa za umowę sprzedaży, zwykle płaci kupujący</td>
              <td>Taksa za umowę deweloperską i umowę przenoszącą własność, podział kosztów sprawdź przed podpisem</td>
            </tr>
            <tr>
              <td>Księga wieczysta</td>
              <td>Wpis własności, przy kredycie także hipoteki</td>
              <td>Wpis własności, przy kredycie także hipoteki</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Ile kosztuje zakup mieszkania z prowizją: przykłady w złotych</h2>
      <p>Do ceny mieszkania z rynku wtórnego doliczasz cztery rodzaje kosztów.</p>
      <ol>
        <li>
          <b>Podatek PCC: 2% ceny.</b> Płaci kupujący, a pobiera go notariusz przy akcie. Zwolniony jest zakup pierwszego
          mieszkania lub domu, jeśli nie masz i wcześniej nie miałeś mieszkania ani domu. Przepisy przewidują wyjątki, na
          przykład dla udziału odziedziczonego w spadku. Gdy kupujesz z osobą, która ma lub miała mieszkanie, zwolnienie
          może nie objąć całej transakcji, więc zapytaj notariusza przed aktem.
        </li>
        <li>
          <b>Taksa notarialna z 23% VAT i wypisy aktu.</b> Maksymalne stawki określa rozporządzenie i zależą one od ceny.
          Notariusz poda dokładną kwotę przed aktem. Warto zapytać w dwóch kancelariach.
        </li>
        <li>
          <b>Opłaty sądowe za wpisy do księgi wieczystej.</b> Za wpis własności {fmtPln(KW_FEE)}, przy kredycie dodatkowo{" "}
          {fmtPln(KW_FEE)} za wpis hipoteki. Pobiera je notariusz.
        </li>
        <li>
          <b>Prowizja biura,</b> jeśli masz z nim umowę: procent ceny albo stała kwota, często plus 23% VAT.
        </li>
      </ol>
      <p>
        Tabela pokazuje PCC i prowizję dla trzech przykładowych cen. Stawka prowizji to {rateLabel}.
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Cena mieszkania</th>
              <th className="num">PCC 2%</th>
              <th className="num">Prowizja według stawki</th>
              <th className="num">Prowizja + 23% VAT</th>
              <th className="num">PCC i prowizja z VAT</th>
            </tr>
          </thead>
          <tbody>
            {costs.map((c) => (
              <tr key={c.price}>
                <td>{fmtPln(c.price)}</td>
                <td className="num">{fmtPln(c.pcc)}</td>
                <td className="num">{fmtPln(c.net)}</td>
                <td className="num">{fmtPln(c.gross)}</td>
                <td className="num">{fmtPln(c.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">
        Kwoty bez taksy notarialnej i opłat sądowych. Przy pierwszym mieszkaniu PCC może wynosić 0 zł. Przy stawce brutto
        liczy się kolumna „Prowizja według stawki”.
      </p>
      <Example title={`Przykład 1: mieszkanie za ${fmtPln(EXAMPLE)} za gotówkę, masz już inne mieszkanie`}>
        <ul className="plain">
          <li>
            PCC: {PCC}% z {fmtPln(EXAMPLE)} = {fmtPln(pcc500)}.
          </li>
          <li>
            Prowizja: {fmtRate(rate)} z {fmtPln(EXAMPLE)} = {fmtPln(net500)}. Jeśli stawka jest netto, z VAT wychodzi{" "}
            {fmtPln(gross(net500))}.
          </li>
          <li>Wpis własności do księgi wieczystej: {fmtPln(KW_FEE)}.</li>
          <li>
            Razem bez taksy notarialnej, przy stawce netto: <b>{fmtPln(pcc500 + gross(net500) + KW_FEE)}</b>. Do tego
            taksa według wyceny notariusza.
          </li>
        </ul>
      </Example>
      <Example title={`Przykład 2: to samo mieszkanie, pierwsze mieszkanie, kredyt z wkładem własnym ${DOWN}%`}>
        <ul className="plain">
          <li>
            Wkład własny: {DOWN}% z {fmtPln(EXAMPLE)} = {fmtPln(down500)}.
          </li>
          <li>PCC: 0 zł, jeśli spełniasz warunki zwolnienia dla pierwszego mieszkania.</li>
          <li>Prowizja z VAT przy stawce netto: {fmtPln(gross(net500))}.</li>
          <li>
            Wpisy własności i hipoteki: 2 × {fmtPln(KW_FEE)} = {fmtPln(2 * KW_FEE)}.
          </li>
          <li>
            Gotówka potrzebna na start, bez taksy i kosztów kredytu: <b>{fmtPln(down500 + gross(net500) + 2 * KW_FEE)}</b>.
          </li>
        </ul>
        <p>Do tego mogą dojść koszty kredytu, na przykład prowizja banku i ubezpieczenia.</p>
      </Example>

      <h2>Kredyt hipoteczny a prowizja biura</h2>
      <p>
        Bank finansuje cenę mieszkania do limitu liczonego od jego wartości, a nie koszty transakcji. Prowizję biura, PCC
        i taksę notarialną zwykle płacisz z własnych pieniędzy, obok wkładu własnego. Pieniądze z kredytu bank przelewa
        sprzedającemu, więc gotówkę na prowizję przygotuj osobno. Jeśli masz oszczędności tylko na wkład własny, prowizja
        może przesądzić, czy zakup się domknie.
      </p>
      <p>Co, jeśli bank odmówi kredytu? Ryzyko rozkłada się na dwie umowy.</p>
      <ul className="plain">
        <li>
          <b>Umowa pośrednictwa.</b> Zapisz, że prowizja należy się dopiero po zawarciu umowy sprzedaży. Wtedy odmowa
          kredytu nie kosztuje cię prowizji.
        </li>
        <li>
          <b>Umowa przedwstępna.</b> Zapisz, że jeśli bank odmówi kredytu w określonym terminie, zadatek wraca do ciebie w
          całości. Bez takiego zapisu możesz go stracić.
        </li>
      </ul>
      <p>
        Zadatek i zaliczka to nie to samo. Jeśli to ty nie wykonasz umowy, sprzedający może od niej odstąpić i zatrzymać
        zadatek. Jeśli nie wykona jej sprzedający, możesz żądać zadatku w podwójnej wysokości. Zaliczka wraca, gdy do
        umowy nie dojdzie. Gdy biuro chce „opłaty rezerwacyjnej”, poproś o dokument, który mówi, czym jest ta wpłata,
        komu przysługuje i kiedy wraca.
      </p>

      <h2>Jak negocjować prowizję jako kupujący</h2>
      <ol>
        <li>Zapytaj o stawkę przed pierwszą prezentacją. Przed podpisem karty masz wybór, po podpisie już mniejszy.</li>
        <li>
          Oprzyj się na danych.
          {paidQ
            ? ` Połowa biur, które podają stawkę dla kupującego, bierze od ${fmtRate(buyer.paid.p25)} do ${fmtRate(buyer.paid.p75)}, a co czwarte ${fmtRate(buyer.paid.p25)} lub mniej.`
            : paidOk
              ? ` Mediana stawek dla kupującego z cenników to ${fmtRate(buyer.paid.median)}. Stawka wyraźnie wyższa to dobry powód do rozmowy.`
              : saleQ
                ? ` Za sprzedaż połowa biur z cennikiem bierze od ${fmtRate(report.p25)} do ${fmtRate(report.p75)}. Stawka dla kupującego wyraźnie wyższa niż te liczby to dobry powód do rozmowy.`
                : " Porównaj stawki kilku biur z jawnym cennikiem."}{" "}
          Stawki według miast są w <Link href="/raporty/prowizje-biur-nieruchomosci-2026">raporcie prowizji 2026</Link>.
        </li>
        <li>
          Zaproponuj stałą kwotę zamiast procentu. Przy droższym mieszkaniu procent szybko rośnie, a praca biura nie rośnie
          w tym samym tempie.
        </li>
        <li>Ustal, czy stawka jest netto czy brutto. Sama ta różnica to 23% kwoty prowizji.</li>
        <li>Negocjuj zakres. Jeśli nie potrzebujesz pomocy przy kredycie ani przy dokumentach, poproś o niższą stawkę.</li>
        <li>
          Zapytaj, czy biuro bierze prowizję od sprzedającego. Jeśli tak, poproś o obniżkę dla siebie, bo biuro i tak
          zarabia na tej transakcji.
        </li>
        <li>
          Sprawdź, czy to mieszkanie nie jest wystawione także przez właściciela albo inne biuro, na przykład w{" "}
          <Link href="/oferty">ofertach biur</Link>.
        </li>
        <li>Spisz uzgodnienia w umowie. Ustna obietnica rabatu nie pomoże ci przy fakturze.</li>
      </ol>
      <Example title={`Przykład 3: negocjacja stawki przy mieszkaniu za ${fmtPln(EXAMPLE)}`}>
        <p>
          Biuro proponuje {fmtRate(rate)} netto, czyli {fmtPln(net500)}. Proponujesz {fmtRate(target)}
          {targetFromData
            ? `, bo tyle lub mniej bierze co czwarte biuro ${paidOk ? "podające w cenniku stawkę dla kupującego" : "z cennikiem za sprzedaż"}`
            : ", czyli pół punktu procentowego mniej"}.
          Prowizja spada do {fmtPln((EXAMPLE * target) / 100)} netto. Oszczędzasz{" "}
          {fmtPln((EXAMPLE * (rate - target)) / 100)} netto, a z VAT {fmtPln(gross((EXAMPLE * (rate - target)) / 100))}.
        </p>
      </Example>

      <h2>Najczęstsze błędy kupujących</h2>
      <ul className="plain">
        <li>
          <b>Podpis pod kartą prezentacji bez czytania.</b> Taki dokument może zobowiązać cię do zapłaty. Sprawdź, czy
          jest w nim stawka.
        </li>
        <li>
          <b>Brak zapisu, od jakiej kwoty liczona jest prowizja.</b> Cena w akcie bywa niższa niż w ogłoszeniu. Prowizja
          powinna wynikać z ceny, którą naprawdę płacisz.
        </li>
        <li>
          <b>Prowizja przy umowie przedwstępnej bez prawa do zwrotu.</b> Jeśli bank odmówi kredytu, pieniądze mogą
          przepaść.
        </li>
        <li>
          <b>Próba ominięcia biura.</b> Jeśli w okresie ochronnym kupisz bezpośrednio od właściciela mieszkanie, które
          pokazało ci biuro, prowizja i tak może być należna.
        </li>
        <li>
          <b>Brak sprawdzenia biura.</b> Opinie, staż i dane firmy zajmują kilka minut:{" "}
          <Link href="/poradnik/jak-sprawdzic-biuro-nieruchomosci">jak sprawdzić biuro nieruchomości</Link>.
        </li>
      </ul>

      <h2>Prowizja od obu stron: co może się zmienić</h2>
      <p>
        Według dotychczasowych zasad biuro może pobierać prowizję jednocześnie od sprzedającego i od kupującego, jeśli ma
        umowę z każdym z nich. Przepisy o pośrednictwie mogą się zmieniać: w 2026 roku trwają prace nad ograniczeniem
        pobierania prowizji od obu stron transakcji. Przed podpisaniem umowy sprawdź aktualny stan prawny. Ostateczne
        warunki wynikają z umowy i z przepisów obowiązujących w dniu podpisu.
        {freeOk
          ? ` W cennikach ${nBiurGen(buyer.brands)} z katalogu, które piszą wprost o kupującym, prowizję od kupującego ${plural(buyer.paid.n, "deklaruje", "deklarują", "deklaruje")} ${nBiur(buyer.paid.n)}. To tylko biura, które piszą o tym w cenniku, a nie cały rynek.`
          : ""}
      </p>

      <Checklist
        title="Przed podpisaniem umowy z biurem sprawdź"
        items={[
          "Kogo biuro reprezentuje: tylko sprzedającego, obie strony czy ciebie.",
          "Stawkę, cenę, od której się ją liczy, i to, czy jest netto czy brutto.",
          "Kiedy prowizja jest należna i czy wraca, gdy do umowy sprzedaży nie dojdzie.",
          "Okres ochronny i ewentualną wyłączność.",
          "Zakres usług w cenie prowizji.",
          "Polisę OC pośrednika i dane firmy: NIP i wpis w rejestrze firm.",
          <>
            Opinie i staż biura w <Link href="/ranking">rankingu biur</Link>. Staż to u nas data wpisu do KRS albo wykazu
            podatników VAT.
          </>,
          "Kopie wszystkich podpisanych dokumentów, także karty prezentacji.",
        ]}
      />

      <h2>Jak znaleźć biuro z jasnymi zasadami</h2>
      <p>
        Najprościej zacząć od biur, które podają stawki na stronie. Zobacz{" "}
        <Link href="/poradnik/biura-z-jawnym-cennikiem">biura z jawnym cennikiem</Link> albo{" "}
        <Link href="/raporty/prowizje-biur-nieruchomosci-2026">raport prowizji</Link> (mediany dla miast z wystarczającą
        próbą). Jak biura liczą prowizję za sprzedaż, opisujemy w poradniku{" "}
        <Link href="/poradnik/ile-bierze-biuro-nieruchomosci">ile bierze biuro nieruchomości</Link>, a koszt pośrednika z
        perspektywy sprzedającego w artykule{" "}
        <Link href={blogPath("sprzedaz-mieszkania-z-biurem-czy-samemu")}>sprzedaż mieszkania z biurem czy samemu</Link>.
      </p>
      <p>
        Wybierając biuro, patrz nie tylko na gwiazdki. Ocena 5,0 z kilku opinii mówi mniej niż 4,8 ze stu, o czym piszemy
        w artykule <Link href={blogPath("ocena-5-w-google-biuro-nieruchomosci")}>o ocenie 5,0 w Google</Link>. Kilka biur
        zestawisz obok siebie w <Link href="/porownaj">porównaniu biur</Link>, a najlepiej ocenione znajdziesz w{" "}
        <Link href="/wyroznienia-2026">wyróżnieniach 2026</Link>. Jak liczymy ranking, wyjaśnia{" "}
        <Link href="/metodologia">metodologia</Link>.
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
