/**
 * Liczby do artykułów bloga, liczone z tych samych danych co katalog (lib/catalog.ts).
 * Zasada jak w city-content.ts: nie wymyślamy statystyk. Przy zbyt małej próbie liczby się nie pokazuje,
 * a strona mówi wprost, z ilu biur jest wynik.
 * Funkcje czyste (bez bazy) są testowane w tests/blog-stats.test.ts.
 */
import { cache } from "react";

import { commissionReport, listAllPublished, listPublishedCards, type PriceRow, type TopListing } from "./catalog";
import { query } from "./db";
import { isPlausible, priceKind } from "./prices";
import { PRICE_STAT_MIN, median } from "./ranking";

/** Ocena Google liczy się do porównań dopiero od tylu opinii: 5,0 z trzech opinii niewiele mówi. */
export const MIN_REVIEWS = 10;
/** Miasto trafia do porównania ocen, gdy ma tyle firm z oceną od MIN_REVIEWS opinii. */
export const CITY_COMPARE_MIN = 10;
/** Staż miasta (mediana, odsetek 10+ lat) pokazujemy i porównujemy od tylu firm ze znaną datą rejestracji. */
export const YEARS_MIN = 10;
/** Strony "miasto czy miasto" powstają dla miast z co najmniej tyloma firmami... */
export const PAIR_CITY_MIN = 20;
/** ...i najwyżej dla tylu największych miast (pary: n * (n - 1) / 2). */
export const PAIR_CITIES = 8;

export type Firm = Pick<
  TopListing,
  "brandId" | "name" | "slug" | "citySlug" | "cityName" | "googleRating" | "googleCount" | "startDate" | "hasPublicPrices" | "offersCount"
>;

const YEAR_MS = 365.25 * 24 * 3600 * 1000;

export function yearsSince(date: Date | string | null | undefined, now: Date): number | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  const t = d.getTime();
  if (Number.isNaN(t) || t > now.getTime()) return null;
  return (now.getTime() - t) / YEAR_MS;
}

/** Firma z oceną, która coś mówi: co najmniej MIN_REVIEWS opinii w Google. */
export function hasSolidRating(f: Pick<Firm, "googleRating" | "googleCount">): boolean {
  return f.googleRating != null && (f.googleCount ?? 0) >= MIN_REVIEWS;
}

const share = (part: number, whole: number): number | null => (whole > 0 ? (100 * part) / whole : null);
const avg = (values: number[]): number | null => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

function quantile(values: number[], q: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

// ----------------------------------------------------------------------------- miasta

export type CityStats = {
  name: string;
  slug: string;
  /** Firmy z głównym wpisem w mieście (firma z kilku miast liczona raz). */
  firms: number;
  /** Wszystkie wpisy w mieście, razem z oddziałami firm z innych miast. */
  listings: number;
  /** Firmy z oceną od MIN_REVIEWS opinii. */
  rated: number;
  avgRating: number | null;
  medianRating: number | null;
  /** Odsetek firm z oceną 4,8 lub wyższą (spośród `rated`). */
  share48: number | null;
  /** Suma opinii Google wszystkich firm z oceną. */
  reviews: number;
  /** Suma opinii firm z próby (`rated`). */
  ratedReviews: number;
  medianReviews: number | null;
  /** Firmy z datą rozpoczęcia działalności z rejestru. */
  withYears: number;
  medianYears: number | null;
  /** Odsetek firm działających 10 lat lub dłużej (spośród `withYears`). */
  share10y: number | null;
  withPrices: number;
  sharePrices: number | null;
  withOffers: number;
  shareOffers: number | null;
  /** Mediana prowizji za sprzedaż z raportu prowizji; null przy próbie mniejszej niż PRICE_STAT_MIN. */
  commission: number | null;
  commissionN: number;
};

export function cityStats(
  firms: Firm[],
  listingsByCity: Map<string, number>,
  commission: Map<string, { n: number; median: number | null }>,
  now: Date,
): CityStats[] {
  const byCity = new Map<string, Firm[]>();
  for (const f of firms) byCity.set(f.citySlug, [...(byCity.get(f.citySlug) ?? []), f]);
  return [...byCity.entries()]
    .map(([slug, list]) => {
      const rated = list.filter(hasSolidRating);
      const ratings = rated.map((f) => f.googleRating as number);
      const years = list.map((f) => yearsSince(f.startDate, now)).filter((y): y is number => y != null);
      const c = commission.get(slug);
      const withPrices = list.filter((f) => f.hasPublicPrices).length;
      const withOffers = list.filter((f) => f.offersCount > 0).length;
      return {
        name: list[0].cityName,
        slug,
        firms: list.length,
        listings: Math.max(listingsByCity.get(slug) ?? 0, list.length),
        rated: rated.length,
        avgRating: avg(ratings),
        medianRating: median(ratings),
        share48: share(ratings.filter((r) => r >= 4.8).length, ratings.length),
        reviews: list.reduce((sum, f) => sum + (f.googleRating != null ? (f.googleCount ?? 0) : 0), 0),
        ratedReviews: rated.reduce((sum, f) => sum + (f.googleCount ?? 0), 0),
        medianReviews: median(list.filter((f) => f.googleRating != null).map((f) => f.googleCount ?? 0)),
        withYears: years.length,
        medianYears: median(years),
        share10y: share(years.filter((y) => y >= 10).length, years.length),
        withPrices,
        sharePrices: share(withPrices, list.length),
        withOffers,
        shareOffers: share(withOffers, list.length),
        commission: c && c.n >= PRICE_STAT_MIN ? c.median : null,
        commissionN: c?.n ?? 0,
      };
    })
    .sort((a, b) => b.firms - a.firms || a.name.localeCompare(b.name, "pl"));
}

/** Miasta do porównania ocen: z próbą co najmniej CITY_COMPARE_MIN firm, od najwyższej średniej. */
export function ratingLeague(cities: CityStats[]): CityStats[] {
  return cities
    .filter((c) => c.rated >= CITY_COMPARE_MIN && c.avgRating != null)
    .sort((a, b) => (b.avgRating as number) - (a.avgRating as number) || (b.share48 ?? 0) - (a.share48 ?? 0) || b.rated - a.rated);
}

// ----------------------------------------------------------------------------- oceny Google

export type RatingBucket = { label: string; min: number; firms: number; fewReviews: number };

const BUCKETS: { label: string; min: number }[] = [
  { label: "5,0", min: 5 },
  { label: "4,8-4,9", min: 4.8 },
  { label: "4,5-4,7", min: 4.5 },
  { label: "4,0-4,4", min: 4 },
  { label: "3,0-3,9", min: 3 },
  { label: "poniżej 3,0", min: 0 },
];

export type RatingOverview = {
  /** Firmy z jakąkolwiek oceną Google. */
  rated: number;
  reviews: number;
  medianReviews: number | null;
  avgRating: number | null;
  /** Średnia ważona liczbą opinii: tak ocenia "przeciętny klient", a nie "przeciętne biuro". */
  weightedRating: number | null;
  /** Zwykła średnia firm z co najmniej MIN_REVIEWS opiniami (tak jak w tabeli miast) i ich liczba. */
  avgRatingSolid: number | null;
  solid: number;
  share5: number | null;
  share48: number | null;
  /** Odsetek firm z oceną, które mają mniej niż MIN_REVIEWS opinii. */
  shareFew: number | null;
  /** Odsetek ocen 5,0 wśród firm z małą i z dużą liczbą opinii. */
  share5Few: number | null;
  share5Many: number | null;
  /** Odsetek ocen poniżej 4,0 wśród firm z małą i z dużą liczbą opinii. */
  shareLow4Few: number | null;
  shareLow4Many: number | null;
  /** Odsetek ocen 5,0 wśród firm z co najmniej 100 opiniami. */
  share5Over100: number | null;
  over100: number;
  buckets: RatingBucket[];
};

export function ratingOverview(firms: Firm[]): RatingOverview {
  const rated = firms.filter((f) => f.googleRating != null);
  const few = rated.filter((f) => (f.googleCount ?? 0) < MIN_REVIEWS);
  const many = rated.filter((f) => (f.googleCount ?? 0) >= MIN_REVIEWS);
  const over100 = rated.filter((f) => (f.googleCount ?? 0) >= 100);
  const r = (f: Firm) => f.googleRating as number;
  const totalReviews = rated.reduce((s, f) => s + (f.googleCount ?? 0), 0);
  const buckets = BUCKETS.map((b, i) => {
    const max = i === 0 ? Infinity : BUCKETS[i - 1].min;
    const inBucket = rated.filter((f) => r(f) >= b.min && (i === 0 ? true : r(f) < max));
    return { ...b, firms: inBucket.length, fewReviews: inBucket.filter((f) => (f.googleCount ?? 0) < MIN_REVIEWS).length };
  });
  return {
    rated: rated.length,
    reviews: totalReviews,
    medianReviews: median(rated.map((f) => f.googleCount ?? 0)),
    avgRating: avg(rated.map(r)),
    weightedRating: totalReviews > 0 ? rated.reduce((s, f) => s + r(f) * (f.googleCount ?? 0), 0) / totalReviews : null,
    avgRatingSolid: avg(many.map(r)),
    solid: many.length,
    share5: share(rated.filter((f) => r(f) >= 5).length, rated.length),
    share48: share(rated.filter((f) => r(f) >= 4.8).length, rated.length),
    shareFew: share(few.length, rated.length),
    share5Few: share(few.filter((f) => r(f) >= 5).length, few.length),
    share5Many: share(many.filter((f) => r(f) >= 5).length, many.length),
    shareLow4Few: share(few.filter((f) => r(f) < 4).length, few.length),
    shareLow4Many: share(many.filter((f) => r(f) < 4).length, many.length),
    share5Over100: share(over100.filter((f) => r(f) >= 5).length, over100.length),
    over100: over100.length,
    buckets,
  };
}

// ----------------------------------------------------------------------------- zasięg: lokalne biura i sieci

export type ReachGroup = {
  label: string;
  firms: number;
  rated: number;
  medianRating: number | null;
  share48: number | null;
  medianReviews: number | null;
  medianYears: number | null;
  sharePrices: number | null;
};

export type ReachFirm = Firm & { cities: number };

export type ReachStats = { groups: ReachGroup[]; wide: ReachFirm[]; multiShare: number | null };

/** Porównanie firm działających w jednym mieście z firmami obecnymi w kilku miastach (oddziały, sieci). */
export function reachStats(firms: Firm[], citiesByBrand: Map<string, number>, now: Date, top = 20): ReachStats {
  const withReach: ReachFirm[] = firms.map((f) => ({ ...f, cities: Math.max(1, citiesByBrand.get(f.brandId) ?? 1) }));
  const group = (label: string, list: ReachFirm[]): ReachGroup => {
    const rated = list.filter(hasSolidRating);
    const ratings = rated.map((f) => f.googleRating as number);
    return {
      label,
      firms: list.length,
      rated: rated.length,
      medianRating: median(ratings),
      share48: share(ratings.filter((x) => x >= 4.8).length, ratings.length),
      medianReviews: median(list.filter((f) => f.googleRating != null).map((f) => f.googleCount ?? 0)),
      medianYears: median(list.map((f) => yearsSince(f.startDate, now)).filter((y): y is number => y != null)),
      sharePrices: share(list.filter((f) => f.hasPublicPrices).length, list.length),
    };
  };
  const local = withReach.filter((f) => f.cities === 1);
  const multi = withReach.filter((f) => f.cities >= 2);
  const wide = withReach.filter((f) => f.cities >= 5);
  return {
    groups: [group("Biura z jednego miasta", local), group("Firmy w 2 lub więcej miastach", multi), group("Firmy w 5 lub więcej miastach", wide)],
    wide: [...multi]
      .sort((a, b) => b.cities - a.cities || (b.googleCount ?? 0) - (a.googleCount ?? 0) || a.name.localeCompare(b.name, "pl"))
      .slice(0, top),
    multiShare: share(multi.length, withReach.length),
  };
}

// ----------------------------------------------------------------------------- staż

export type TenureStats = {
  withYears: number;
  medianYears: number | null;
  share10y: number | null;
  share20y: number | null;
  shareUnder3y: number | null;
  oldest: (Firm & { years: number })[];
  /** Ile firm ma tę samą najwcześniejszą datę co pierwsza na liście (przy remisie kolejność jest alfabetyczna). */
  oldestTied: number;
};

export function tenureStats(firms: Firm[], now: Date, top = 25): TenureStats {
  const dated = firms
    .map((f) => ({ ...f, years: yearsSince(f.startDate, now) }))
    .filter((f): f is Firm & { years: number } => f.years != null);
  const years = dated.map((f) => f.years);
  const sorted = [...dated].sort((a, b) => b.years - a.years || a.name.localeCompare(b.name, "pl"));
  return {
    withYears: dated.length,
    medianYears: median(years),
    share10y: share(years.filter((y) => y >= 10).length, years.length),
    share20y: share(years.filter((y) => y >= 20).length, years.length),
    shareUnder3y: share(years.filter((y) => y < 3).length, years.length),
    oldest: sorted.slice(0, top),
    oldestTied: sorted.length ? sorted.filter((f) => f.years === sorted[0].years).length : 0,
  };
}

// ----------------------------------------------------------------------------- stawki z cenników

export type RateRow = Pick<PriceRow, "service" | "unit" | "amountMin" | "amountMax" | "taxMode"> & { brandId: string };

export type RateStats = { n: number; median: number | null; p25: number | null; p75: number | null; min: number | null; max: number | null };

/** Prowizja za najem jako procent czynszu: poza tym przedziałem to prawie zawsze inny rodzaj opłaty albo zły odczyt. */
const RENT_PERCENT = { min: 25, max: 150 };

function lowestPerBrand(rows: RateRow[], accept: (r: RateRow) => boolean): Map<string, RateRow> {
  const best = new Map<string, RateRow>();
  for (const r of rows) {
    if (r.unit !== "percent" || r.amountMin == null || !accept(r)) continue;
    const prev = best.get(r.brandId);
    if (!prev || r.amountMin < (prev.amountMin as number)) best.set(r.brandId, r);
  }
  return best;
}

function statsOf(values: number[]): RateStats {
  return {
    n: values.length,
    median: median(values),
    p25: quantile(values, 0.25),
    p75: quantile(values, 0.75),
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
  };
}

/** Prowizja za znalezienie najemcy (procent czynszu), jedna najniższa stawka na biuro. */
export function rentBrokerageStats(rows: RateRow[]): RateStats {
  const best = lowestPerBrand(
    rows,
    (r) => priceKind(r.service) === "rent_brokerage" && isPlausible(r) && (r.amountMin as number) >= RENT_PERCENT.min && (r.amountMin as number) <= RENT_PERCENT.max,
  );
  return statsOf([...best.values()].map((r) => r.amountMin as number));
}

/** Zarządzanie najmem (procent czynszu miesięcznie), jedna najniższa stawka na biuro. */
export function managementStats(rows: RateRow[]): RateStats {
  const best = lowestPerBrand(rows, (r) => priceKind(r.service) === "management" && isPlausible(r));
  return statsOf([...best.values()].map((r) => r.amountMin as number));
}

export type VatStats = { n: number; plusVat: number; gross: number; unknown: number };

/** Jak biura podają stawkę za sprzedaż: netto (plus VAT), brutto czy bez informacji. Ta sama stawka co w raporcie prowizji. */
export function saleVatStats(rows: RateRow[]): VatStats {
  const best = lowestPerBrand(rows, (r) => priceKind(r.service) === "sale" && isPlausible(r));
  const list = [...best.values()];
  return {
    n: list.length,
    plusVat: list.filter((r) => r.taxMode === "net" || r.taxMode === "plus_vat").length,
    gross: list.filter((r) => r.taxMode === "gross").length,
    unknown: list.filter((r) => !r.taxMode || r.taxMode === "unknown").length,
  };
}

const BUYER = /kupując|kupujac|kupn|zakup/i;
const BUYER_EXPLICIT = /kupując|kupujac/i;
const SELLER = /sprzeda/i;

export type BuyerStats = { brands: number; free: number; paid: RateStats };

/** Stawki dla kupującego podane wprost w cennikach: ile biur pisze "0% dla kupującego", ile bierze prowizję i jaką. */
export function buyerStats(rows: RateRow[]): BuyerStats {
  // "od kupującego" nie pasuje do wzorca sprzedaży w prices.ts, więc rozpoznajemy kupującego osobno (bez najmu).
  const buyerRows = rows.filter(
    (r) =>
      r.unit === "percent" &&
      r.amountMin != null &&
      BUYER.test(r.service) &&
      // wspólna pozycja "pośrednictwo w sprzedaży i zakupie" to nie osobna stawka dla kupującego
      (BUYER_EXPLICIT.test(r.service) || !SELLER.test(r.service)) &&
      !["rent_brokerage", "management"].includes(priceKind(r.service)),
  );
  const free = new Set(buyerRows.filter((r) => r.amountMin === 0 && (r.amountMax == null || r.amountMax === 0)).map((r) => r.brandId));
  const paid = lowestPerBrand(
    buyerRows.filter((r) => !free.has(r.brandId)),
    (r) => (r.amountMin as number) >= 0.5 && (r.amountMin as number) <= 10 && (r.amountMax == null || r.amountMax <= 10),
  );
  return { brands: new Set([...free, ...paid.keys()]).size, free: free.size, paid: statsOf([...paid.values()].map((r) => r.amountMin as number)) };
}

// ----------------------------------------------------------------------------- pary miast

export type CityPair = { slug: string; a: CityStats; b: CityStats };

export const pairSlug = (a: string, b: string) => `${a}-czy-${b}`;

/** Pary największych miast (od PAIR_CITY_MIN firm), większe miasto pierwsze. */
export function cityPairs(cities: CityStats[]): CityPair[] {
  const big = cities.filter((c) => c.firms >= PAIR_CITY_MIN).slice(0, PAIR_CITIES);
  const pairs: CityPair[] = [];
  for (let i = 0; i < big.length; i++) {
    for (let j = i + 1; j < big.length; j++) pairs.push({ slug: pairSlug(big[i].slug, big[j].slug), a: big[i], b: big[j] });
  }
  return pairs;
}

// ----------------------------------------------------------------------------- pobieranie danych

export type BlogData = {
  firms: Firm[];
  cities: CityStats[];
  citiesByBrand: Map<string, number>;
  now: Date;
};

/** Wszystkie firmy (każda raz, z głównego wpisu) i statystyki miast. Jedno źródło dla wszystkich artykułów. */
export const loadBlogData = cache(async (): Promise<BlogData> => {
  const [firms, cards, report] = await Promise.all([listAllPublished(), listPublishedCards(), commissionReport()]);
  const listingsByCity = new Map<string, number>();
  const citiesByBrand = new Map<string, Set<string>>();
  for (const c of cards) {
    listingsByCity.set(c.citySlug, (listingsByCity.get(c.citySlug) ?? 0) + 1);
    citiesByBrand.set(c.brandId, (citiesByBrand.get(c.brandId) ?? new Set()).add(c.citySlug));
  }
  const commission = new Map(report.cities.map((c) => [c.slug, { n: c.n, median: c.median }]));
  const now = new Date();
  return {
    firms,
    cities: cityStats(firms, listingsByCity, commission, now),
    citiesByBrand: new Map([...citiesByBrand.entries()].map(([k, v]) => [k, v.size])),
    now,
  };
});

/** Aktualne stawki procentowe z cenników opublikowanych firm (sprzedaż, najem, zarządzanie). */
export const loadRates = cache(async (): Promise<RateRow[]> =>
  query<RateRow>(
    `select p.brand_id as "brandId", p.service, p.unit, p.amount_min::float8 as "amountMin",
            p.amount_max::float8 as "amountMax", p.tax_mode as "taxMode"
     from price_items p
     where p.is_current and p.unit = 'percent' and p.amount_min is not null
       and exists (select 1 from listings l where l.brand_id = p.brand_id and l.status = 'published')`,
  ),
);

// ----------------------------------------------------------------------------- wnioski z porównania dwóch miast

/** Różnice mniejsze niż te progi opisujemy jako "podobnie", żeby nie wyolbrzymiać szumu w danych. */
export const SAME_RATING = 0.05;
export const SAME_SHARE = 5;
export const SAME_RATE = 0.2;

export type PairPoint = { key: string; winner: "a" | "b" | "tie" | null };

/** Kto wypada lepiej w każdej kategorii (null: za mało danych w jednym z miast). */
export function pairPoints(a: CityStats, b: CityStats): PairPoint[] {
  const cmp = (x: number | null, y: number | null, same: number, higherWins = true): PairPoint["winner"] => {
    if (x == null || y == null) return null;
    if (Math.abs(x - y) < same) return "tie";
    return (x > y) === higherWins ? "a" : "b";
  };
  const ratedOk = a.rated >= CITY_COMPARE_MIN && b.rated >= CITY_COMPARE_MIN;
  return [
    { key: "firms", winner: a.firms === b.firms ? "tie" : a.firms > b.firms ? "a" : "b" },
    { key: "rating", winner: ratedOk ? cmp(a.avgRating, b.avgRating, SAME_RATING) : null },
    { key: "share48", winner: ratedOk ? cmp(a.share48, b.share48, SAME_SHARE) : null },
    { key: "years", winner: a.withYears >= YEARS_MIN && b.withYears >= YEARS_MIN ? cmp(a.medianYears, b.medianYears, 1) : null },
    { key: "prices", winner: cmp(a.sharePrices, b.sharePrices, SAME_SHARE) },
    { key: "commission", winner: cmp(a.commission, b.commission, SAME_RATE, false) },
  ];
}
