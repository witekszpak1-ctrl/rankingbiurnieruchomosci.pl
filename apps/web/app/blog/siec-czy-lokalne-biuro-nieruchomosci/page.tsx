import type { Metadata } from "next";
import Link from "next/link";

import { BlogArticle, Checklist, Example, Faq, ShortAnswer, faqLd } from "@/components/BlogArticle";
import { BarList, Columns, PairBars } from "@/components/BlogCharts";
import { blogMetadata, blogPath, fmtInt, fmtPln, fmtRate, fmtRating, fmtShare, fmtYears, getPost } from "@/lib/blog";
import {
  MIN_REVIEWS,
  PAIR_CITY_MIN,
  SAME_RATE,
  SAME_RATING,
  SAME_SHARE,
  YEARS_MIN,
  cityPairs,
  loadBlogData,
  loadRates,
  reachStats,
  yearsSince,
  type Firm,
  type RateRow,
} from "@/lib/blog-stats";
import { commissionReport } from "@/lib/catalog";
import { inCity } from "@/lib/cities";
import { nBiur, nBiurGen, nFirm, nMiast, nOpiniami, plural } from "@/lib/plural";
import { isPlausible, priceKind } from "@/lib/prices";
import { PRICE_STAT_MIN, median } from "@/lib/ranking";

export const revalidate = 86400;

const post = getPost("siec-czy-lokalne-biuro-nieruchomosci");

export const metadata: Metadata = blogMetadata(post);

/** Grupy porównujemy, gdy biura z jednego miasta mają tyle firm z oceną od MIN_REVIEWS opinii... */
const LOCAL_MIN = 20;
/** ...a firmy z kilku miast tyle. */
const MULTI_MIN = 10;
/** Odsetki (oferty na stronie) liczymy dla grupy od tylu firm. */
const GROUP_MIN = 10;
/** Medianę stawek grupy porównujemy od tylu cenników w każdej grupie (próg jak dla kwartyli). */
const RATE_GROUP_MIN = 8;
/** Kwartyle stawek z raportu prowizji pokazujemy od tylu stawek. */
const QUARTILE_MIN = 8;
/** Ile miast z największą liczbą firm pokazujemy na wykresie wpisów oddziałów. */
const CITY_CHART = 8;
/** Cena mieszkania do przykładu prowizji (przykład, nie cena rynkowa). */
const EXAMPLE_PRICE = 600000;
const VAT = 23;

const REACH_BUCKETS = [
  { label: "2 miasta", min: 2, max: 2 },
  { label: "3-4 miasta", min: 3, max: 4 },
  { label: "5-9 miast", min: 5, max: 9 },
  { label: "10 i więcej", min: 10, max: Infinity },
];

const pct = (part: number, whole: number): number | null => (whole > 0 ? (100 * part) / whole : null);

/** Odsetki spoza reachStats, liczone z tych samych firm: oferty na stronie i staż w rejestrze. */
function groupExtra(list: Firm[], now: Date) {
  const years = list.map((f) => yearsSince(f.startDate, now)).filter((y): y is number => y != null);
  return {
    firms: list.length,
    dated: years.length,
    share10y: years.length >= YEARS_MIN ? pct(years.filter((y) => y >= 10).length, years.length) : null,
    shareOffers: list.length >= GROUP_MIN ? pct(list.filter((f) => f.offersCount > 0).length, list.length) : null,
  };
}

/** Najniższa wiarygodna stawka procentowa za sprzedaż na firmę (te same zasady co raport prowizji). */
function saleRateByBrand(rates: RateRow[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rates) {
    if (priceKind(r.service) !== "sale" || !isPlausible(r) || r.amountMin == null) continue;
    const prev = out.get(r.brandId);
    if (prev == null || r.amountMin < prev) out.set(r.brandId, r.amountMin);
  }
  return out;
}

export default async function ChainVsLocalPost() {
  const [data, rates, report] = await Promise.all([
    loadBlogData().catch(() => null),
    loadRates().catch((): RateRow[] => []),
    commissionReport().catch(() => null),
  ]);
  const s = data ? reachStats(data.firms, data.citiesByBrand, data.now) : null;
  const [local, multi] = s?.groups ?? [];
  const ok = local && multi && local.rated >= LOCAL_MIN && multi.rated >= MULTI_MIN;
  // -1/0/1: mniej, podobnie, więcej w grupie firm z kilku miast (progi jak w porównaniach miast)
  const cmp = (x: number | null | undefined, y: number | null | undefined, same: number) =>
    x == null || y == null ? null : Math.abs(x - y) < same ? 0 : x > y ? 1 : -1;
  const rating = ok ? (cmp(multi.medianRating, local.medianRating, SAME_RATING) ?? 0) : 0;
  const reviews = ok && multi.medianReviews && local.medianReviews ? cmp(multi.medianReviews / local.medianReviews, 1, 0.15) : null;
  const prices = ok ? cmp(multi.sharePrices, local.sharePrices, SAME_SHARE) : null;
  const top48 = ok ? cmp(multi.share48, local.share48, SAME_SHARE) : null;

  // Te same grupy co w reachStats: firma liczona raz, liczba miast z wpisów w katalogu.
  const reachOf = (f: Firm) => Math.max(1, data?.citiesByBrand.get(f.brandId) ?? 1);
  const localFirms = data ? data.firms.filter((f) => reachOf(f) === 1) : [];
  const multiFirms = data ? data.firms.filter((f) => reachOf(f) >= 2) : [];
  const exL = data ? groupExtra(localFirms, data.now) : null;
  const exM = data ? groupExtra(multiFirms, data.now) : null;
  const offers = exL && exM ? cmp(exM.shareOffers, exL.shareOffers, SAME_SHARE) : null;
  const tenure10 = exL && exM ? cmp(exM.share10y, exL.share10y, SAME_SHARE) : null;

  // Stawki za sprzedaż z cenników w obu grupach (porównanie tylko przy RATE_GROUP_MIN cennikach w każdej).
  const saleRates = saleRateByBrand(rates);
  const ratesL = localFirms.map((f) => saleRates.get(f.brandId)).filter((v): v is number => v != null);
  const ratesM = multiFirms.map((f) => saleRates.get(f.brandId)).filter((v): v is number => v != null);
  const rateL = ratesL.length >= RATE_GROUP_MIN ? median(ratesL) : null;
  const rateM = ratesM.length >= RATE_GROUP_MIN ? median(ratesM) : null;
  const rateCmp = cmp(rateM, rateL, SAME_RATE);
  const reportOk = report != null && report.n >= PRICE_STAT_MIN && report.median != null;
  const quart = report != null && report.n >= QUARTILE_MIN && report.p25 != null && report.p75 != null ? { p25: report.p25, p75: report.p75 } : null;
  const low = quart ? (EXAMPLE_PRICE * quart.p25) / 100 : 0;
  const high = quart ? (EXAMPLE_PRICE * quart.p75) / 100 : 0;
  const half = (EXAMPLE_PRICE * 0.5) / 100;
  const gross = (v: number) => v * (1 + VAT / 100);

  // Rozkład firm z kilku miast według liczby miast.
  const reachRows =
    multiFirms.length >= MULTI_MIN
      ? REACH_BUCKETS.map((b) => ({
          label: b.label,
          value: multiFirms.filter((f) => reachOf(f) >= b.min && reachOf(f) <= b.max).length,
        }))
      : [];
  const share2 = reachRows.length ? pct(reachRows[0].value, multiFirms.length) : null;
  const n10 = reachRows.length ? reachRows[reachRows.length - 1].value : 0;

  // Wpisy w mieście, które nie są głównym wpisem firmy (oddziały i firmy z innych miast).
  const cityRows = data
    ? data.cities
        .filter((c) => c.firms >= PAIR_CITY_MIN && c.listings > 0)
        .slice(0, CITY_CHART)
        .map((c) => ({ c, extra: c.listings - c.firms, share: pct(c.listings - c.firms, c.listings) }))
    : [];
  const byShare = [...cityRows].sort((a, b) => (b.share ?? 0) - (a.share ?? 0));
  const cityTop = byShare[0];
  const cityBottom = byShare[byShare.length - 1];
  const pairs = data ? cityPairs(data.cities).slice(0, 2) : [];

  const findings: string[] = [];
  if (ok) {
    findings.push(
      rating === 0
        ? `Oceny są podobne: mediana ${fmtRating(local.medianRating)} w biurach z jednego miasta i ${fmtRating(multi.medianRating)} w firmach z kilku miast (próba: ${fmtInt(local.rated)} i ${nFirm(multi.rated)} z co najmniej ${nOpiniami(MIN_REVIEWS)}).`
        : `Wyższą medianę ocen mają ${rating > 0 ? "firmy z kilku miast" : "biura z jednego miasta"}: ${fmtRating(rating > 0 ? multi.medianRating : local.medianRating)} wobec ${fmtRating(rating > 0 ? local.medianRating : multi.medianRating)} (próba: ${fmtInt(local.rated)} i ${nFirm(multi.rated)} z co najmniej ${nOpiniami(MIN_REVIEWS)}).`,
    );
  }
  if (ok && top48 != null) {
    findings.push(
      top48 === 0
        ? `Ocenę 4,8 lub wyższą ma podobna część firm w obu grupach: ${fmtShare(local.share48)} i ${fmtShare(multi.share48)}.`
        : `Ocenę 4,8 lub wyższą ${top48 > 0 ? "częściej" : "rzadziej"} mają firmy z kilku miast: ${fmtShare(multi.share48)} wobec ${fmtShare(local.share48)} w biurach z jednego miasta.`,
    );
  }
  if (ok && reviews != null) {
    findings.push(
      reviews === 0
        ? `Typowa liczba opinii jest zbliżona: mediana ${fmtInt(multi.medianReviews)} i ${fmtInt(local.medianReviews)}.`
        : `Więcej opinii mają ${reviews > 0 ? "firmy z kilku miast" : "biura z jednego miasta"}: mediana ${fmtInt(reviews > 0 ? multi.medianReviews : local.medianReviews)} wobec ${fmtInt(reviews > 0 ? local.medianReviews : multi.medianReviews)}.${reviews > 0 ? " Firma z kilkoma biurami może mieć więcej klientów, a więc i opinii." : ""}`,
    );
  }
  if (ok && prices != null) {
    findings.push(
      prices === 0
        ? `Cennik na stronie publikuje podobna część firm: ${fmtShare(local.sharePrices)} biur z jednego miasta i ${fmtShare(multi.sharePrices)} firm z kilku miast.`
        : `Firmy z kilku miast ${prices > 0 ? "częściej" : "rzadziej"} publikują cennik: ${fmtShare(multi.sharePrices)} wobec ${fmtShare(local.sharePrices)}.`,
    );
  }
  if (exL && exM && offers != null) {
    findings.push(
      offers === 0
        ? `Oferty na własnej stronie ma podobna część firm: ${fmtShare(exL.shareOffers)} biur z jednego miasta i ${fmtShare(exM.shareOffers)} firm z kilku miast.`
        : `Firmy z kilku miast ${offers > 0 ? "częściej" : "rzadziej"} mają oferty na własnej stronie: ${fmtShare(exM.shareOffers)} wobec ${fmtShare(exL.shareOffers)}.`,
    );
  }
  if (exL && exM && tenure10 != null) {
    findings.push(
      `Od co najmniej 10 lat w rejestrze jest ${fmtShare(exM.share10y)} firm z kilku miast i ${fmtShare(exL.share10y)} biur z jednego miasta${tenure10 === 0 ? ", czyli podobna część" : ""} (firmy ze znaną datą: ${fmtInt(exM.dated)} i ${fmtInt(exL.dated)}).`,
    );
  }
  if (rateCmp != null) {
    findings.push(
      `Mediana najniższej stawki za sprzedaż z cenników to ${fmtRate(rateM)} w firmach z kilku miast i ${fmtRate(rateL)} w biurach z jednego miasta${rateCmp === 0 ? ", czyli podobnie" : ""} (${fmtInt(ratesM.length)} i ${ratesL.length} ${plural(ratesL.length, "cennik", "cenniki", "cenników")}).`,
    );
  }

  const faq = [
    {
      q: "Czy duża sieć biur nieruchomości jest lepsza od lokalnego biura?",
      a: ok
        ? `Nie ma takiej reguły. W naszym katalogu mediana ocen Google to ${fmtRating(multi.medianRating)} w firmach z kilku miast i ${fmtRating(local.medianRating)} w biurach z jednego miasta. Oceniaj konkretne biuro i agenta, a nie szyld.`
        : "Nie ma takiej reguły. W obu grupach mogą być biura bardzo dobre i słabe, więc oceniaj konkretne biuro i agenta, a nie szyld.",
    },
    {
      q: "Z kim podpisuję umowę w biurze sieci?",
      a: "Z firmą wskazaną w umowie. W biurze franczyzowym to zwykle franczyzobiorca z własnym NIP, a nie sieć. Tej firmie płacisz prowizję i do niej kierujesz reklamację.",
    },
    {
      q: "Czy w sieci zapłacę wyższą prowizję?",
      a:
        rateCmp != null
          ? `W naszych danych mediana najniższej stawki za sprzedaż to ${fmtRate(rateM)} w firmach z kilku miast i ${fmtRate(rateL)} w biurach z jednego miasta. To stawki z cenników, a nie zapłacone, więc porównaj oferty konkretnych biur.`
          : "Tego nie wiemy: cennik publikuje za mało firm, żeby porównać obie grupy. Stawkę ustala konkretne biuro, więc porównaj cenniki co najmniej dwóch biur.",
    },
    {
      q: "Jak sprawdzić, czy biuro naprawdę należy do sieci?",
      a: "Znajdź je w wyszukiwarce biur na stronie sieci i porównaj nazwę firmy oraz adres z umową. NIP sprawdź w KRS, CEIDG albo w wykazie VAT.",
    },
    {
      q: "Czy pośrednik w sieci musi mieć licencję?",
      a: "Nie. Od 2014 r. licencja pośrednika nie jest wymagana, ani w sieci, ani poza nią. Pośrednik musi natomiast mieć ubezpieczenie OC, a umowa pośrednictwa wymaga formy pisemnej albo elektronicznej.",
    },
    {
      q: "Franczyza czy własne biuro nieruchomości?",
      a: "Franczyza daje właścicielowi biura markę, wzory dokumentów i szkolenia za opłaty z umowy z siecią. Własne biuro daje pełną swobodę, ale markę i opinie budujesz sam.",
    },
  ];

  return (
    <BlogArticle post={post} extraLd={[faqLd(faq)]}>
      {ok ? (
        <ShortAnswer>
          Czy wybrać sieć, czy lokalne biuro nieruchomości, zależy bardziej od konkretnego biura i agenta niż od szyldu.{" "}
          {rating === 0
            ? `W naszym katalogu biura z jednego miasta i firmy obecne w kilku miastach mają podobne oceny klientów (mediana ${fmtRating(local.medianRating)} i ${fmtRating(multi.medianRating)}).`
            : `W naszym katalogu wyżej oceniane są ${rating > 0 ? "firmy obecne w kilku miastach" : "biura z jednego miasta"}: mediana ${fmtRating(rating > 0 ? multi.medianRating : local.medianRating)} wobec ${fmtRating(rating > 0 ? local.medianRating : multi.medianRating)}.`}{" "}
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
          Biuro pod marką sieci to zwykle osobna firma z własnym NIP, więc umowę podpisujesz z nią, a nie z siecią.
        </ShortAnswer>
      ) : (
        <ShortAnswer>
          Czy wybrać sieć, czy lokalne biuro nieruchomości, zależy bardziej od konkretnego biura i agenta niż od szyldu.
          Sieć daje rozpoznawalną markę i procedury, lokalne biuro często lepiej zna swoją okolicę. Biuro pod marką sieci
          to zwykle osobna firma z własnym NIP, więc umowę podpisujesz z nią, a nie z siecią.
        </ShortAnswer>
      )}

      {s && s.groups.length > 0 && (
        <>
          <h2>Sieć czy lokalne biuro w liczbach</h2>
          <p className="note">
            Każda firma liczona raz. Ocena: mediana ocen Google firm z co najmniej {nOpiniami(MIN_REVIEWS)}, pokazywana od{" "}
            {nFirm(MULTI_MIN)} z taką oceną w grupie, pozostałe kolumny od {nFirm(GROUP_MIN)} w grupie. Firma w kilku
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
                    <td className="num">{g.rated >= MULTI_MIN ? fmtRating(g.medianRating) : "-"}</td>
                    <td className="num">{g.rated >= MULTI_MIN ? fmtShare(g.share48) : "-"}</td>
                    <td className="num">{g.firms >= GROUP_MIN ? fmtInt(g.medianReviews) : "-"}</td>
                    <td className="num">{g.firms >= GROUP_MIN ? fmtYears(g.medianYears) : "-"}</td>
                    <td className="num">{g.firms >= GROUP_MIN ? fmtShare(g.sharePrices) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note">
            Biura franczyzowe sieci mają zwykle własny NIP, więc w katalogu są osobnymi firmami. Dlatego franczyzobiorca z
            jednym biurem trafia do grupy biur z jednego miasta, nawet pod znaną marką.
          </p>
          {s.multiShare != null && (
            <p>
              Wpisy w kilku miastach ma {fmtShare(s.multiShare)} firm z katalogu. Pozostałe to biura z jednego miasta.
            </p>
          )}
          {ok && exL && exM && (
            <PairBars
              title="Biura z jednego miasta i firmy z kilku miast: odsetek firm"
              caption={`Ocena 4,8+ wśród firm z co najmniej ${nOpiniami(MIN_REVIEWS)} (${fmtInt(local.rated)} i ${fmtInt(multi.rated)}), staż wśród firm ze znaną datą wpisu (${fmtInt(exL.dated)} i ${fmtInt(exM.dated)}), pozostałe wśród wszystkich firm grupy. Źródło: katalog, Mapy Google.`}
              nameA="Biura z jednego miasta"
              nameB="Firmy w 2 lub więcej miastach"
              rows={[
                { label: "ocena 4,8 lub wyższa", a: local.share48, b: multi.share48 },
                { label: "jawny cennik", a: local.sharePrices, b: multi.sharePrices },
                { label: "oferty na stronie", a: exL.shareOffers, b: exM.shareOffers },
                { label: "staż 10 lat lub więcej", a: exL.share10y, b: exM.share10y },
              ]}
              format={(v) => fmtShare(v)}
            />
          )}
          <h3>Jak czytać te liczby</h3>
          <p>
            Za podobne uznajemy różnice mniejsze niż {fmtRating(SAME_RATING)} oceny i {SAME_SHARE} punktów procentowych.
            Zasady liczenia opisuje{" "}
            <Link href="/metodologia">metodologia</Link>.
          </p>
        </>
      )}

      <h2>Co wynika z porównania</h2>
      {findings.length > 0 ? (
        <ul className="plain">
          {findings.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      ) : (
        <p>
          Danych jest za mało, żeby rzetelnie porównać obie grupy. Porównanie pokazujemy, gdy ocenę z co najmniej{" "}
          {nOpiniami(MIN_REVIEWS)} ma {nFirm(LOCAL_MIN)} z jednego miasta i {nFirm(MULTI_MIN)} z kilku miast.
        </p>
      )}
      {data && rateCmp == null && (
        <p>
          Prowizji obu grup nie porównujemy: cennik ze stawką za sprzedaż ma za mało firm (
          {nBiur(ratesL.length)} z jednego miasta i {nFirm(ratesM.length)} z kilku miast, a potrzebujemy co najmniej{" "}
          {RATE_GROUP_MIN} w każdej grupie).
        </p>
      )}
      {findings.length > 0 && <p>To porównanie grup, a nie ocena konkretnych firm: wynik grupy nie zastąpi sprawdzenia biura.</p>}

      {reachRows.length > 0 && (
        <>
          <h2>Ilu miast sięgają firmy z kilkoma wpisami</h2>
          <p>
            W katalogu {plural(multiFirms.length, "jest", "są", "jest")} {nFirm(multiFirms.length)} z wpisami w co
            najmniej dwóch miastach.
            {share2 != null ? ` Wpisy w dokładnie dwóch miastach ma ${fmtShare(share2)} z nich.` : ""}
            {n10 > 0
              ? ` Wpisy w dziesięciu lub więcej miastach ${plural(n10, "ma", "mają", "ma")} ${nFirm(n10)}.`
              : " Żadna firma nie ma wpisów w dziesięciu lub więcej miastach."}
          </p>
          <Columns
            title="Firmy z wpisami w kilku miastach według liczby miast"
            caption={`Razem ${nFirm(multiFirms.length)}, każda liczona raz. Źródło: katalog rankingbiurnieruchomosci.pl.`}
            rows={reachRows}
            format={(v) => fmtInt(v)}
            valueHeader="Firmy"
          />
          <p>
            Przy typowym mieszkaniu ważniejsza od zasięgu firmy jest znajomość twojej okolicy. Oferty biur z okolicy
            przejrzysz w zakładce <Link href="/oferty">oferty</Link>.
          </p>
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
          <p>
            Liczba miast to wpisy w naszym katalogu, a nie wszystkie biura firmy.
            {s.wide[0] ? ` Najwięcej miast ma ${s.wide[0].name} (${nMiast(s.wide[0].cities)}).` : ""}
            {" "}Duży zasięg nie oznacza lepszej obsługi.
          </p>
        </>
      )}

      {cityRows.length >= 3 && (
        <>
          <h2>W których miastach częściej trafisz na oddział</h2>
          <p>
            W każdym mieście są też wpisy, które nie są głównym wpisem firmy: oddziały firm z innych miast i kolejne biura
            tej samej firmy. Im ich więcej, tym częściej na liście biur trafisz na firmę z kilkoma wpisami.
            {cityTop && cityBottom && cityTop.share != null && cityBottom.share != null
              ? cityTop.share - cityBottom.share < SAME_SHARE
                ? ` W pokazanych miastach odsetek takich wpisów jest podobny.`
                : ` Najwyższy odsetek takich wpisów jest ${inCity(cityTop.c.name)} (${fmtShare(cityTop.share)}), najniższy ${inCity(cityBottom.c.name)} (${fmtShare(cityBottom.share)}).`
              : ""}
          </p>
          <BarList
            title="Odsetek wpisów oddziałów w miastach z największym wyborem"
            caption={`${nMiast(cityRows.length)} z największą liczbą firm w katalogu (co najmniej ${nFirm(PAIR_CITY_MIN)} z głównym wpisem w mieście). Źródło: katalog rankingbiurnieruchomosci.pl.`}
            rows={cityRows.map((x) => ({
              label: x.c.name,
              value: x.share,
              note: `${fmtInt(x.extra)} z ${fmtInt(x.c.listings)} ${plural(x.c.listings, "wpisu", "wpisów", "wpisów")}`,
            }))}
            format={(v) => fmtShare(v)}
            valueHeader="Wpisy oddziałów"
          />
          <p>
            Biura porównasz na stronach miast:{" "}
            {cityRows.slice(0, 4).map((x, i) => (
              <span key={x.c.slug}>
                {i > 0 ? ", " : ""}
                <Link href={`/${x.c.slug}`}>biura nieruchomości {inCity(x.c.name)}</Link>
              </span>
            ))}
            . Pozostałe znajdziesz na <Link href="/miasta">liście miast</Link>.
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

      <h2>Jak działa franczyza w biurach nieruchomości</h2>
      <p>
        Wiele sieci biur nieruchomości działa w modelu franczyzy. Franczyzobiorca to osobny przedsiębiorca z własnym NIP i
        własnymi agentami. Od sieci dostaje markę, wzory dokumentów, szkolenia i wspólną promocję, a w zamian płaci opłaty
        określone w umowie franczyzy. Oddział własny to natomiast ta sama firma co centrala, z tym samym NIP.
      </p>
      <p>
        W Polsce nie ma osobnej ustawy o franczyzie. Twoje prawa jako klienta wynikają z umowy pośrednictwa i przepisów, w
        tym ustawy o gospodarce nieruchomościami i przepisów o ochronie konsumentów.
      </p>
      <Example title="Przykład: z kim podpisujesz umowę w biurze sieci">
        <p>
          W nagłówku umowy z biurem znanej marki czytasz: „X Nieruchomości sp. z o.o., NIP …, prowadząca biuro pod marką Y
          na podstawie umowy franczyzy”. Stroną umowy jest ta spółka, nie sieć. Jej płacisz prowizję, jej polisę OC
          sprawdzasz i do niej kierujesz reklamację. Jeśli w umowie brakuje nazwy firmy i NIP, poproś o uzupełnienie.
        </p>
      </Example>
      <p>Marka nie gwarantuje więc tej samej obsługi w każdym biurze. Każde biuro ma własnych agentów i własne opinie.</p>

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
              <td>Biura franczyzowe to zwykle osobne firmy z własnymi cennikami.</td>
              <td>Często większa swoboda w ustalaniu stawki i warunków umowy.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Niezależnie od szyldu sprawdź konkretne biuro: wpis w rejestrze, polisę OC, opinie i cennik.{" "}
        <Link href="/poradnik/jak-sprawdzic-biuro-nieruchomosci">Jak sprawdzić biuro nieruchomości</Link>. Porównanie miast:{" "}
        <Link href={blogPath("biura-nieruchomosci-w-najwiekszych-miastach")}>biura w największych miastach</Link>.
      </p>

      <h2>Czy sieć bierze wyższą prowizję</h2>
      <p>
        Prowizję ustala konkretne biuro, a nie marka. Dwa biura tej samej sieci mogą mieć różne stawki, więc pytaj o cennik
        biura, z którym rozmawiasz.
        {reportOk
          ? ` We wszystkich cennikach z katalogu mediana najniższej stawki za sprzedaż to ${fmtRate(report.median)} (z ${nBiurGen(report.n)})${quart ? `, a połowa biur podaje od ${fmtRate(quart.p25)} do ${fmtRate(quart.p75)}` : ""}.`
          : " Stawek z cenników jest za mało, żeby podać medianę."}{" "}
        Szczegóły w <Link href="/raporty/prowizje-biur-nieruchomosci-2026">raporcie prowizji</Link>, a biura, które
        podają ceny, w zestawieniu <Link href="/poradnik/biura-z-jawnym-cennikiem">biur z jawnym cennikiem</Link>.
      </p>
      <Example title={`Przykład: ile kosztuje różnica w stawce przy mieszkaniu za ${fmtPln(EXAMPLE_PRICE)}`}>
        {quart && (
          <p>
            Biuro ze stawką {fmtRate(quart.p25)} (tyle lub mniej podaje co czwarte biuro z cennikiem) weźmie {fmtPln(low)}.
            Biuro ze stawką {fmtRate(quart.p75)} (tyle lub więcej podaje co czwarte biuro) weźmie {fmtPln(high)}. Różnica
            to {fmtPln(high - low)}, a jeśli to stawki netto, z VAT {fmtPln(gross(high - low))}.
          </p>
        )}
        <p>
          Każde 0,5 punktu procentowego przy tej cenie to {fmtPln(half)} netto, czyli {fmtPln(gross(half))} z {VAT}% VAT,
          jeśli biuro jest czynnym podatnikiem VAT. Jak
          liczyć prowizję, opisujemy w poradniku{" "}
          <Link href="/poradnik/ile-bierze-biuro-nieruchomosci">ile bierze biuro nieruchomości</Link>.
        </p>
      </Example>

      <h2>Kiedy wybrać sieć, a kiedy lokalne biuro</h2>
      <h3>Firma z oddziałami może mieć sens, gdy</h3>
      <ul className="plain">
        <li>sprzedajesz w jednym mieście, a kupujesz w innym, i firma ma biura w obu;</li>
        <li>kupujący mogą przyjechać z innego miasta;</li>
        <li>chcesz standardowych wzorów dokumentów i procedury reklamacji.</li>
      </ul>
      <h3>Lokalne biuro może być lepsze, gdy</h3>
      <ul className="plain">
        <li>nieruchomość jest w mniejszej miejscowości, którą dobrze zna jedno biuro;</li>
        <li>chcesz rozmawiać z właścicielem, który decyduje o stawce;</li>
        <li>zależy ci na jednym agencie od pierwszego spotkania do aktu notarialnego.</li>
      </ul>
      <Example title="Przykład: sprzedaż w jednym mieście, zakup w drugim">
        <p>
          Sprzedajesz mieszkanie w mieście A, kupujesz w B. Gdy oba biura należą do jednej firmy, masz jednego partnera do
          rozmów o terminach i możesz zapytać o niższą stawkę za dwie transakcje. Gdy to dwaj franczyzobiorcy tej samej
          sieci, rozmawiasz z dwiema firmami i dwoma cennikami.
        </p>
      </Example>
      <p>
        W obu przypadkach zestaw dwa lub trzy biura w <Link href="/porownaj">porównywarce</Link>: ocenę, liczbę opinii,
        staż, cennik i oferty. Najlepiej ocenione biura w całej Polsce pokazuje <Link href="/ranking">ranking</Link>.
      </p>

      <h2>Jak sprawdzić, czy agent jest z danej sieci</h2>
      <ol>
        <li>Poproś o wzór umowy i sprawdź, kto jest jej stroną: pełna nazwa firmy, NIP i adres. Logo na wizytówce niczego nie przesądza.</li>
        <li>Znajdź biuro w wyszukiwarce biur na oficjalnej stronie sieci i porównaj adres oraz nazwę firmy.</li>
        <li>Sprawdź NIP: spółkę w KRS, jednoosobową działalność w CEIDG, a status podatnika w wykazie podatników VAT.</li>
        <li>
          Zapytaj, czy agent jest pracownikiem biura, czy współpracuje z nim jako osobna firma. Upewnij się, kto będzie
          stroną twojej umowy.
        </li>
        <li>Poproś o dokument potwierdzający ubezpieczenie OC i sprawdź, czy polisa jest na firmę z umowy.</li>
        <li>Znajdź biuro w katalogu: profil pokazuje ocenę z liczbą opinii, staż z rejestru i cennik, jeśli jest.</li>
      </ol>

      <h2>Pytania do zadania biuru przed podpisaniem umowy</h2>
      <ul className="plain">
        <li>„Jaka firma i jaki NIP będą w umowie?” Odpowiedź pokaże, czy rozmawiasz z oddziałem, czy z franczyzobiorcą.</li>
        <li>„Kto poprowadzi moją sprawę od początku do końca?”</li>
        <li>„Czy oferta trafi do innych biur sieci i czy moja stawka się wtedy zmieni?”</li>
        <li>„Czy to wasz cennik, czy cennik całej sieci? Netto czy brutto?”</li>
        <li>
          „Czy bierzecie prowizję także od drugiej strony?” Więcej o tym w artykule{" "}
          <Link href={blogPath("czy-kupujacy-placi-prowizje-biuru-nieruchomosci")}>czy kupujący płaci prowizję</Link>.
        </li>
        <li>„Co stanie się z umową, jeśli biuro odejdzie z sieci albo zmieni markę?”</li>
      </ul>
      <p>
        Częsty błąd to ocenianie biura po opiniach innego biura tej samej marki. Jak czytać oceny, opisujemy w artykule{" "}
        <Link href={blogPath("ocena-5-w-google-biuro-nieruchomosci")}>ocena 5,0 w Google</Link>.
      </p>
      <Checklist
        title="Przed podpisaniem umowy z siecią albo lokalnym biurem sprawdź"
        items={[
          "Pełną nazwę firmy i NIP w umowie, zgodne z rejestrem.",
          "Dokument potwierdzający OC pośrednika wystawiony na tę firmę.",
          "Stawkę: netto czy brutto, kiedy jest należna i czy biuro bierze ją także od drugiej strony.",
          "Rodzaj umowy (otwarta czy na wyłączność), czas trwania i zasady wypowiedzenia.",
          "Opinie tego biura, a nie całej sieci: liczbę, daty i treść.",
          <>
            Porównanie z dwoma innymi biurami na <Link href="/miasta">stronie twojego miasta</Link>.
          </>,
        ]}
      />
      <p className="note">
        Opis przepisów jest ogólny: ostateczne warunki wynikają z umowy i przepisów. Trwają prace nad zmianami przepisów o
        pośrednictwie.
      </p>

      <Faq items={faq} />

      <p>
        Biura wyróżnione na podstawie danych (płatność nie wpływa na wynik) znajdziesz w{" "}
        <Link href="/wyroznienia-2026">wyróżnieniach 2026</Link>. Ile lat działają najstarsze firmy, pokazujemy w artykule{" "}
        <Link href={blogPath("najdluzej-dzialajace-biura-nieruchomosci")}>najdłużej działające biura</Link>.
      </p>
    </BlogArticle>
  );
}
