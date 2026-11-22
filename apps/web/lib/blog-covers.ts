/**
 * Dane i rysunki okładek bloga (route: app/blog/okladka/[file]/route.tsx).
 * Każdy wpis ma własny rysunek tematyczny (dom, klucz, gwiazdki, kalendarz...) i motyw tła zależny od rodzaju wpisu,
 * a liczba na okładce pochodzi z aktualnych danych. Statystyki liczymy raz dla wszystkich okładek i trzymamy w pamięci
 * podręcznej (6 godzin), a same obrazki są generowane przy wdrożeniu i odświeżane raz na dobę.
 */
import { unstable_cache } from "next/cache";

import { BLOG_POSTS, fmtInt, fmtRate, fmtRating, fmtShare, type BlogCategory } from "./blog";
import {
  buyerStats,
  cityPairs,
  loadBlogData,
  loadRates,
  ratingLeague,
  ratingOverview,
  reachStats,
  rentBrokerageStats,
  tenureStats,
} from "./blog-stats";
import { commissionReport } from "./catalog";
import { inCity } from "./cities";
import { PRICE_STAT_MIN } from "./ranking";

export const INK = "#121211";
export const CREAM = "#f2f1ed";
export const YELLOW = "#f6cd2b";
export const YELLOW_SOFT = "#fdf3c8";

export type CoverTheme = { bg: string; fg: string; muted: string; accent: string; statBg: string; statFg: string; dark: boolean };

/** Motywy w kolorach strony: poradniki na kremowym, dane na żółtym, porównania na czarnym, pary miast na jasnożółtym. */
export const THEMES: Record<BlogCategory | "Para", CoverTheme> = {
  Poradnik: { bg: CREAM, fg: INK, muted: "#66645e", accent: YELLOW, statBg: YELLOW, statFg: INK, dark: false },
  Dane: { bg: YELLOW, fg: INK, muted: "#4a4120", accent: INK, statBg: INK, statFg: YELLOW, dark: false },
  "Porównania": { bg: INK, fg: CREAM, muted: "#b9b6ab", accent: YELLOW, statBg: YELLOW, statFg: INK, dark: true },
  Para: { bg: YELLOW_SOFT, fg: INK, muted: "#66645e", accent: YELLOW, statBg: INK, statFg: YELLOW, dark: false },
};

export type CoverStat = { stat: string; statLabel: string };
export type CoverPair = { slug: string; a: string; b: string; na: number; nb: number; ra: number | null; rb: number | null };
export type CoverData = { stats: Record<string, CoverStat>; pairs: CoverPair[] };

/** Liczby na okładki: jedno przeliczenie dla wszystkich wpisów i par miast. */
const cachedCoverData = unstable_cache(
  async (): Promise<CoverData> => {
    const [data, rates, report] = await Promise.all([loadBlogData(), loadRates().catch(() => []), commissionReport().catch(() => null)]);
    const stats: Record<string, CoverStat> = {};
    const best = ratingLeague(data.cities)[0];
    if (best) stats["oceny-biur-nieruchomosci-w-miastach"] = { stat: fmtRating(best.avgRating), statLabel: `średnia ocena biur ${inCity(best.name)}` };
    const first = data.cities[0];
    if (first) stats["biura-nieruchomosci-w-najwiekszych-miastach"] = { stat: fmtInt(first.firms), statLabel: `biur w katalogu ${inCity(first.name)}` };
    if (report && report.n >= PRICE_STAT_MIN && report.median != null) {
      stats["sprzedaz-mieszkania-z-biurem-czy-samemu"] = { stat: fmtRate(report.median), statLabel: "mediana stawki za sprzedaż w cennikach biur" };
    }
    const buyer = buyerStats(rates);
    if (buyer.paid.n >= PRICE_STAT_MIN && buyer.paid.median != null) {
      stats["czy-kupujacy-placi-prowizje-biuru-nieruchomosci"] = { stat: fmtRate(buyer.paid.median), statLabel: "mediana stawki dla kupującego w cennikach biur" };
    }
    const rent = rentBrokerageStats(rates);
    if (rent.n >= PRICE_STAT_MIN && rent.median != null) {
      stats["prowizja-za-wynajem-mieszkania"] = { stat: fmtRate(rent.median), statLabel: "czynszu: stawka za wynajem w cennikach biur" };
    }
    const o = ratingOverview(data.firms);
    if (o.share5Few != null) stats["ocena-5-w-google-biuro-nieruchomosci"] = { stat: fmtShare(o.share5Few), statLabel: "biur z mniej niż 10 opiniami ma ocenę 5,0" };
    const reach = reachStats(data.firms, data.citiesByBrand, data.now);
    if (reach.multiShare != null) stats["siec-czy-lokalne-biuro-nieruchomosci"] = { stat: fmtShare(reach.multiShare), statLabel: "firm z katalogu działa w kilku miastach" };
    const tenure = tenureStats(data.firms, data.now);
    if (tenure.share10y != null) stats["najdluzej-dzialajace-biura-nieruchomosci"] = { stat: fmtShare(tenure.share10y), statLabel: "biur jest w rejestrze 10 lat lub dłużej" };
    const pairs = cityPairs(data.cities).map((p) => ({
      slug: p.slug,
      a: p.a.name,
      b: p.b.name,
      na: p.a.firms,
      nb: p.b.firms,
      ra: p.a.rated >= 10 ? p.a.avgRating : null,
      rb: p.b.rated >= 10 ? p.b.avgRating : null,
    }));
    return { stats, pairs };
  },
  ["blog-cover-data-v1"],
  { revalidate: 21600 },
);

// Przy wdrożeniu powstaje naraz kilkadziesiąt okładek: jedno przeliczenie na proces zamiast osobnego dla każdej.
let memo: { at: number; promise: Promise<CoverData> } | null = null;
export function coverData(): Promise<CoverData> {
  if (!memo || Date.now() - memo.at > 5 * 60 * 1000) {
    const promise = cachedCoverData();
    memo = { at: Date.now(), promise };
    promise.catch(() => {
      if (memo?.promise === promise) memo = null;
    });
  }
  return memo.promise;
}

/** Wszystkie klucze okładek (do wygenerowania przy wdrożeniu). */
export async function coverKeys(): Promise<string[]> {
  const data = await coverData().catch(() => null);
  return [...BLOG_POSTS.map((p) => p.slug), ...(data?.pairs ?? []).map((p) => `porownanie-${p.slug}`)];
}

const svg = (body: string) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">${body}</svg>`)}`;

/** Rysunki tematyczne (300x300), linie w kolorze tekstu motywu, wypełnienia w kolorze akcentu. */
export function iconFor(slug: string, t: CoverTheme): string {
  const s = `stroke="${t.fg}" stroke-width="14" stroke-linejoin="round" stroke-linecap="round" fill="none"`;
  const a = t.accent === t.fg ? CREAM : t.accent;
  switch (slug) {
    case "sprzedaz-mieszkania-z-biurem-czy-samemu":
      // dom z tabliczką "na sprzedaż"
      return svg(
        `<path d="M30 150 L130 70 L230 150" ${s}/><rect x="55" y="140" width="150" height="120" ${s}/>` +
          `<rect x="80" y="170" width="40" height="40" fill="${a}" stroke="${t.fg}" stroke-width="8"/><rect x="145" y="195" width="35" height="65" fill="${t.fg}"/>` +
          `<path d="M255 260 V150" ${s}/><rect x="215" y="160" width="80" height="50" rx="6" fill="${a}" stroke="${t.fg}" stroke-width="8"/>`,
      );
    case "czy-kupujacy-placi-prowizje-biuru-nieruchomosci":
      // stos monet i znak procentu
      return svg(
        `<ellipse cx="110" cy="235" rx="70" ry="22" fill="${a}" stroke="${t.fg}" stroke-width="10"/>` +
          `<ellipse cx="110" cy="200" rx="70" ry="22" fill="${a}" stroke="${t.fg}" stroke-width="10"/>` +
          `<ellipse cx="110" cy="165" rx="70" ry="22" fill="${a}" stroke="${t.fg}" stroke-width="10"/>` +
          `<path d="M200 140 L270 40" ${s}/><circle cx="205" cy="55" r="18" ${s}/><circle cx="265" cy="125" r="18" ${s}/>`,
      );
    case "prowizja-za-wynajem-mieszkania":
      // klucz
      return svg(
        `<circle cx="95" cy="110" r="55" fill="${a}" stroke="${t.fg}" stroke-width="14"/><circle cx="95" cy="110" r="18" fill="${t.bg}" stroke="${t.fg}" stroke-width="10"/>` +
          `<path d="M140 145 L260 255" ${s}/><path d="M215 215 L240 190" ${s}/><path d="M240 240 L262 218" ${s}/>`,
      );
    case "ocena-5-w-google-biuro-nieruchomosci": {
      // pięć gwiazdek, ostatnia w połowie
      const star = (cx: number, cy: number, r: number) => {
        const pts = Array.from({ length: 10 }, (_, i) => {
          const ang = -Math.PI / 2 + (i * Math.PI) / 5;
          const rr = i % 2 ? r * 0.45 : r;
          return `${(cx + rr * Math.cos(ang)).toFixed(1)},${(cy + rr * Math.sin(ang)).toFixed(1)}`;
        });
        return pts.join(" ");
      };
      const stars = [0, 1, 2, 3, 4]
        .map((i) => {
          const cx = 30 + i * 60;
          const fill = i < 4 ? a : "none";
          return `<polygon points="${star(cx, 150, 28)}" fill="${fill}" stroke="${t.fg}" stroke-width="6" stroke-linejoin="round"/>`;
        })
        .join("");
      return svg(`${stars}<path d="M30 215 H270" stroke="${t.fg}" stroke-width="6" stroke-linecap="round"/><path d="M30 240 H190" stroke="${t.fg}" stroke-width="6" stroke-linecap="round" opacity="0.5"/>`);
    }
    case "oceny-biur-nieruchomosci-w-miastach":
      // pinezka z gwiazdką
      return svg(
        `<path d="M150 275 C150 275 60 185 60 120 A90 90 0 0 1 240 120 C240 185 150 275 150 275 Z" fill="${a}" stroke="${t.fg}" stroke-width="14" stroke-linejoin="round"/>` +
          `<polygon points="150,72 162,104 196,104 169,124 179,156 150,137 121,156 131,124 104,104 138,104" fill="${t.fg}"/>`,
      );
    case "biura-nieruchomosci-w-najwiekszych-miastach":
      // panorama miasta
      return svg(
        `<path d="M15 270 H285" ${s}/>` +
          `<rect x="30" y="150" width="50" height="120" fill="${a}" stroke="${t.fg}" stroke-width="10"/>` +
          `<rect x="90" y="80" width="60" height="190" fill="${t.fg}"/>` +
          `<rect x="160" y="120" width="50" height="150" fill="${a}" stroke="${t.fg}" stroke-width="10"/>` +
          `<rect x="220" y="180" width="50" height="90" fill="${t.fg}"/>` +
          `<path d="M105 110 H135 M105 140 H135 M105 170 H135 M105 200 H135" stroke="${a}" stroke-width="8"/>`,
      );
    case "siec-czy-lokalne-biuro-nieruchomosci":
      // sieć: węzeł centralny i oddziały
      return svg(
        [
          [150, 40],
          [255, 110],
          [220, 245],
          [80, 245],
          [45, 110],
        ]
          .map(([x, y]) => `<path d="M150 150 L${x} ${y}" stroke="${t.fg}" stroke-width="8"/><circle cx="${x}" cy="${y}" r="24" fill="${a}" stroke="${t.fg}" stroke-width="8"/>`)
          .join("") + `<circle cx="150" cy="150" r="40" fill="${t.fg}"/>`,
      );
    case "najdluzej-dzialajace-biura-nieruchomosci":
      // kalendarz
      return svg(
        `<rect x="40" y="65" width="220" height="200" rx="16" ${s}/><rect x="40" y="65" width="220" height="55" rx="16" fill="${a}" stroke="${t.fg}" stroke-width="14"/>` +
          `<path d="M95 40 V90 M205 40 V90" ${s}/>` +
          [0, 1, 2, 3]
            .flatMap((c) => [0, 1, 2].map((r) => `<rect x="${70 + c * 45}" y="${145 + r * 38}" width="28" height="24" rx="4" fill="${r === 2 && c === 3 ? a : t.fg}"/>`))
            .join(""),
      );
    default:
      return svg(`<rect x="40" y="40" width="220" height="220" rx="20" ${s}/>`);
  }
}
