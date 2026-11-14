/**
 * Wyróżnienia: trzy najwyżej ocenione biura w każdym mieście, w którym ranking obejmuje co najmniej CITY_RANKING_MIN
 * biur. Liczone na bieżąco z tego samego rankingu co strony miast (nikt nie może wyróżnienia kupić), więc miejsce na
 * odznace zmienia się razem z rankingiem. Biuro, które wypadnie z pierwszej trójki, dostaje odznakę neutralną.
 */

import { LOGO_FRAME_SIZE, LOGO_FRAME_STROKE, LOGO_RBN } from "./logo-paths";
import { CITY_RANKING_MIN, rankListings, type RankingInput, type Ranked } from "./ranking";

export const AWARD = {
  edition: 2026,
  top: 3,
  title: "Wyróżnienia 2026",
  path: "/wyroznienia-2026",
} as const;

export const BADGE_WIDTH = 240;
export const BADGE_HEIGHT = 80;

/** Pola wpisu potrzebne do rankingu (te same co na stronach miast i w profilu). */
export type RankingFields = {
  listingId: string;
  name: string;
  slug: string | null;
  startDate: Date | string | null;
  hasPublicPrices: boolean;
  verificationScore: number | null;
  registryConfirmed?: boolean;
  servicesCount: number;
  offersCount?: number;
  googleRating?: number | null;
  googleCount?: number | null;
};

export type RankableCard = RankingFields & { cityName: string; citySlug: string };

export function cardRankingInput(card: RankingFields): RankingInput {
  return {
    startDate: card.startDate,
    hasPublicPrices: card.hasPublicPrices,
    verificationScore: card.verificationScore,
    registryConfirmed: card.registryConfirmed,
    servicesCount: card.servicesCount,
    offersCount: card.offersCount,
    googleRating: card.googleRating,
    googleCount: card.googleCount,
  };
}

export type CityLeaders<T extends RankableCard> = {
  cityName: string;
  citySlug: string;
  /** Liczba biur w rankingu miasta. */
  count: number;
  leaders: Ranked<T>[];
};

/**
 * Pierwsza trójka w każdym mieście z co najmniej CITY_RANKING_MIN wpisami. Pozycje liczone na wszystkich wpisach
 * miasta, tak jak na stronie miasta i w profilu. Wpisy bez adresu profilu (slug) nie są laureatami, ale zajmują miejsce
 * w rankingu, żeby numeracja zgadzała się z profilem. Kolejność: najpierw miasta z największą liczbą biur.
 */
export function pickCityLeaders<T extends RankableCard>(cards: T[], now: Date = new Date()): CityLeaders<T>[] {
  const byCity = new Map<string, T[]>();
  for (const card of cards) {
    const list = byCity.get(card.citySlug);
    if (list) list.push(card);
    else byCity.set(card.citySlug, [card]);
  }
  const result: CityLeaders<T>[] = [];
  for (const [citySlug, list] of byCity) {
    if (list.length < CITY_RANKING_MIN) continue;
    const ranked = rankListings(list, cardRankingInput, now);
    const leaders = ranked.filter((r) => r.position <= AWARD.top && r.slug);
    if (leaders.length === 0) continue;
    result.push({ cityName: list[0].cityName, citySlug, count: list.length, leaders });
  }
  return result.sort((a, b) => b.count - a.count || a.cityName.localeCompare(b.cityName, "pl"));
}

/** Miejsce wpisu w rankingu jego miasta, jeśli jest w pierwszej trójce (inaczej null). */
export function awardPlace<T extends RankingFields>(listingId: string, cityCards: T[], now: Date = new Date()): { place: number; count: number } | null {
  if (cityCards.length < CITY_RANKING_MIN) return null;
  const ranked = rankListings(cityCards, cardRankingInput, now);
  const hit = ranked.find((r) => r.listingId === listingId);
  return hit && hit.position <= AWARD.top ? { place: hit.position, count: cityCards.length } : null;
}

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** Rozmiar pisma dopasowany do długości tekstu, żeby długie nazwy miast mieściły się w odznace. */
function fitFont(text: string, maxWidth: number, maxSize: number): number {
  const estimated = text.length * 0.58; // przybliżona szerokość znaku w em dla Arial/Helvetica
  return Math.max(9, Math.min(maxSize, Math.floor((maxWidth / estimated) * 10) / 10));
}

/**
 * Odznaka SVG do wklejenia na stronę biura. Z miejscem: "1. miejsce", miasto, "Wyróżnienie 2026". Bez miejsca
 * (biuro spoza pierwszej trójki albo nieznany wpis): neutralna odznaka serwisu, bez żadnej deklaracji o wyniku.
 */
export function badgeSvg(award: { place: number; cityName: string } | null): string {
  const s = 44 / LOGO_FRAME_SIZE; // znak RBN 44 x 44 px
  const inset = LOGO_FRAME_STROKE / 2;
  const inner = LOGO_FRAME_SIZE - LOGO_FRAME_STROKE;
  const mark =
    `<g transform="translate(16 18) scale(${s.toFixed(4)})" fill="#f6cd2b">` +
    `<rect x="${inset}" y="${inset}" width="${inner}" height="${inner}" fill="none" stroke="#f6cd2b" stroke-width="${LOGO_FRAME_STROKE}"/>` +
    `<path d="${LOGO_RBN}"/></g>`;
  const textX = 74;
  const textWidth = BADGE_WIDTH - textX - 12;
  const font = "Arial, Helvetica, sans-serif";
  let body: string;
  let label: string;
  if (award) {
    const city = award.cityName;
    const kicker = `WYRÓŻNIENIE ${AWARD.edition}`;
    const main = `${award.place}. miejsce`;
    label = `Ranking Biur Nieruchomości ${AWARD.edition}: ${main}, ${city}`;
    body =
      `<text x="${textX}" y="25" font-family="${font}" font-size="10" font-weight="700" letter-spacing="1.2" fill="#f6cd2b">${escapeXml(kicker)}</text>` +
      `<text x="${textX}" y="46" font-family="${font}" font-size="20" font-weight="700" fill="#ffffff">${escapeXml(main)}</text>` +
      `<text x="${textX}" y="64" font-family="${font}" font-size="${fitFont(city, textWidth, 13)}" fill="#e8e6df">${escapeXml(city)}</text>`;
  } else {
    label = "Ranking Biur Nieruchomości";
    body =
      `<text x="${textX}" y="36" font-family="${font}" font-size="15" font-weight="700" fill="#ffffff">Ranking Biur</text>` +
      `<text x="${textX}" y="55" font-family="${font}" font-size="15" font-weight="700" fill="#ffffff">Nieruchomości</text>`;
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}" viewBox="0 0 ${BADGE_WIDTH} ${BADGE_HEIGHT}" role="img" aria-label="${escapeXml(label)}">` +
    `<title>${escapeXml(label)}</title>` +
    `<rect x="0.5" y="0.5" width="${BADGE_WIDTH - 1}" height="${BADGE_HEIGHT - 1}" rx="14" fill="#111110" stroke="#f6cd2b" stroke-opacity="0.55"/>` +
    mark +
    body +
    `</svg>`
  );
}

/**
 * Kod do wklejenia na stronę biura: obrazek odznaki z linkiem do profilu. W tekście alternatywnym tylko nazwa serwisu
 * i rok (bez słów kluczowych), a miejsce pokazuje sam obrazek, więc kod nie przestaje być prawdziwy, gdy miejsce się zmieni.
 */
export function badgeEmbedCode(opts: { profileUrl: string; badgeUrl: string }): string {
  return (
    `<a href="${escapeXml(opts.profileUrl)}" title="Ranking Biur Nieruchomości ${AWARD.edition}">` +
    `<img src="${escapeXml(opts.badgeUrl)}" width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}" alt="Ranking Biur Nieruchomości ${AWARD.edition}" loading="lazy"></a>`
  );
}
