/**
 * Treść strony miasta z rzeczywistych danych: wstęp, TOP 3, prowizje, poradnik i FAQ.
 * Sekcje są warunkowe (np. mediana tylko przy wystarczającej próbce), żeby strony miast nie były kopiami z podmienioną nazwą.
 * Nie wymyślamy statystyk ani charakterystyki rynku.
 */
import type { CityPriceExample } from "./catalog";
import { inCity } from "./cities";
import { formatDate, formatPrice } from "./format";
import { nBiur, nBiurGen, plural } from "./plural";
import { unitForms } from "./unit";
import { isPlausible, priceBasis, priceKind } from "./prices";
import { capitalize, currentPortal, expertPhrase, firmPhrase, nFirmPhrase, type CityCtx } from "./portal";
import { PRICE_STAT_MIN } from "./ranking";

export type CityFirm = {
  name: string;
  slug: string | null;
  score: number;
  position: number;
  registryConfirmed: boolean;
  hasPublicPrices: boolean;
  offersCount: number;
};

export type CityData = {
  cityName: string;
  firms: CityFirm[];
  ranked: boolean;
  updatedAt: Date;
  median: number | null;
  medianN: number;
  medianObservedAt: Date | null;
  prices: CityPriceExample[];
  services: { brandId: string; service: string }[];
  /** Cały katalog, do porównania miasta z krajem (raport prowizji). */
  national?: { median: number | null; n: number; withPricesPct: number | null };
};

// Grupy usług pochodzą z konfiguracji portalu (portals/*.ts, serviceGroups).
const SERVICE_GROUPS = currentPortal().serviceGroups;

/** Dane do zdań konfiguracji portalu (portals/*.ts, texts.city). */
function cityCtx(d: CityData, groupLimit = 4): CityCtx {
  const n = d.firms.length;
  return {
    where: inCity(d.cityName),
    n,
    withPrices: d.firms.filter((f) => f.hasPublicPrices).length,
    confirmed: d.firms.filter((f) => f.registryConfirmed).length,
    units: nBiur,
    unitsGen: nBiurGen,
    groups: serviceGroups(d.services).slice(0, groupLimit),
  };
}

/** Grupy usług każdej firmy (sale, rent, management, ...), do filtrów na stronie miasta. */
export function brandServiceGroups(services: CityData["services"]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const s of services) {
    for (const g of SERVICE_GROUPS) {
      if (g.re.test(s.service)) {
        const set = out.get(s.brandId) ?? new Set<string>();
        set.add(g.key);
        out.set(s.brandId, set);
      }
    }
  }
  return out;
}

/** Ile biur deklaruje usługi z danej grupy (najczęstsze najpierw). */
export function serviceGroups(services: CityData["services"]): { label: string; count: number }[] {
  return SERVICE_GROUPS.map((g) => ({
    label: g.label,
    count: new Set(services.filter((s) => g.re.test(s.service)).map((s) => s.brandId)).size,
  }))
    .filter((g) => g.count > 0)
    .sort((a, b) => b.count - a.count);
}

const pct = (v: number) => `${v.toLocaleString("pl-PL", { maximumFractionDigits: 2 })}%`;

export function cityH1(cityName: string, ranked: boolean, year: number): string {
  return ranked ? `Ranking ${firmPhrase("many")} ${inCity(cityName)} ${year}` : `${capitalize(firmPhrase("few"))} ${inCity(cityName)}`;
}

export function cityIntro(d: CityData): string {
  const n = d.firms.length;
  const where = inCity(d.cityName);
  const confirmed = d.firms.filter((f) => f.registryConfirmed).length;
  const withPrices = d.firms.filter((f) => f.hasPublicPrices).length;
  const withOffers = d.firms.filter((f) => f.offersCount > 0).length;
  const parts = [
    `Zestawienie obejmuje ${nFirmPhrase(n)} ${where}, które mają własną stronę internetową.`,
    confirmed === n
      ? `${unitForms().by("Każde", "Każdą", "Każdy")} z nich potwierdziliśmy w rejestrach publicznych (KRS lub wykaz podatników VAT).`
      : `${confirmed} z nich potwierdziliśmy w rejestrach publicznych (KRS lub wykaz podatników VAT), pozostałe opisujemy na podstawie ich stron i oznaczamy jako niepotwierdzone.`,
    d.ranked
      ? `Kolejność wynika z jawnej metodologii, a nie z płatności: liczą się m.in. potwierdzenie w rejestrze, staż, jawność cennika, zakres usług${currentPortal().features.offers ? " i aktualne oferty" : ""}.`
      : `${unitForms().Pl.gen} jest jeszcze za mało na ranking z pozycjami, dlatego pokazujemy je alfabetycznie.`,
    `Możesz porównać ${withPrices > 0 ? `cenniki (${withPrices} ${plural(withPrices, `${unitForms().sg.nom} publikuje`, `${unitForms().pl.nom} publikują`, `${unitForms().pl.gen} publikuje`)} stawki), ` : ""}zakres usług${withOffers > 0 ? `, oferty ze stron ${unitForms().pl.gen}` : ""} i dane kontaktowe, a z każdego profilu wysłać zapytanie.`,
    `Dane zaktualizowaliśmy ${formatDate(d.updatedAt)}.`,
  ];
  return parts.join(" ");
}

export function topThree(d: CityData): CityFirm[] {
  if (!d.ranked) return [];
  return [...d.firms].sort((a, b) => a.position - b.position).slice(0, 3);
}

export type CommissionSection = {
  summary: string;
  examples: { firmName: string; firmSlug: string; service: string; value: string }[];
  note: string;
};

export function commissionSection(d: CityData): CommissionSection {
  const where = inCity(d.cityName);
  const n = d.firms.length;
  const withPrices = d.firms.filter((f) => f.hasPublicPrices).length;
  const plausible = d.prices.filter(isPlausible);
  const sale = plausible.filter((p) => p.unit === "percent" && priceKind(p.service) === "sale");
  const saleFirms = new Set(sale.map((p) => p.firmSlug)).size;
  const sentences: string[] = [];
  const copy = currentPortal().texts.city;
  const ctx = cityCtx(d);
  if (withPrices === 0) {
    sentences.push(copy.noPrices(ctx));
  } else {
    const share = n > 0 ? Math.round((100 * withPrices) / n) : 0;
    const natShare = d.national?.withPricesPct;
    sentences.push(copy.somePrices(ctx, share, natShare ?? null, saleFirms));
    if (currentPortal().features.saleCommission) {
      if (d.median != null && d.medianN >= PRICE_STAT_MIN) {
        sentences.push(
          `Mediana najniższych deklarowanych stawek od sprzedaży wynosi ${pct(d.median)} ceny transakcyjnej (na podstawie ${nBiurGen(d.medianN)}).`,
        );
        const nat = d.national;
        if (nat?.median != null && nat.n >= PRICE_STAT_MIN * 3) {
          const diff = Math.round((d.median - nat.median) * 100) / 100;
          const pp = (x: number) => pct(x).replace("%", " pkt proc.");
          const relation = diff === 0 ? "tyle samo, co" : diff < 0 ? `o ${pp(Math.abs(diff))} mniej niż` : `o ${pp(diff)} więcej niż`;
          sentences.push(`To ${relation} mediana w całym katalogu (${pct(nat.median)}, ${nBiurGen(nat.n)}).`);
        }
      } else if (saleFirms > 0) {
        sentences.push(`To za mała próba, żeby podawać medianę dla miasta; poniżej pokazujemy stawki konkretnych ${unitForms().pl.gen}.`);
      }
    }
  }
  const seen = new Set<string>();
  const examples = plausible
    .filter((p) => {
      const key = `${p.firmSlug}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5)
    .map((p) => ({
      firmName: p.firmName,
      firmSlug: p.firmSlug,
      service: p.service,
      value: `${formatPrice(p)}${priceBasis(p) ? ` ${priceBasis(p)}` : ""}`,
    }));
  const latest = plausible.reduce<Date | null>((acc, p) => (!acc || p.observedAt > acc ? p.observedAt : acc), null);
  const note = copy.priceNote(latest ? formatDate(latest) : null);
  return { summary: sentences.join(" "), examples, note };
}

export function choosingGuide(d: CityData): string[] {
  return currentPortal().texts.city.guide(cityCtx(d));
}

export type FaqItem = { q: string; a: string };

export function cityFaq(d: CityData): FaqItem[] {
  const where = inCity(d.cityName);
  const n = d.firms.length;
  const withPrices = d.firms.filter((f) => f.hasPublicPrices).length;
  const top = topThree(d)[0];
  const commission = commissionSection(d);
  const portal = currentPortal();
  const copy = portal.texts.city.faq;
  const ctx = cityCtx(d);
  const faq: FaqItem[] = [];
  faq.push({
    q: copy.feeQuestion(where),
    a:
      portal.features.saleCommission && d.median != null && d.medianN >= PRICE_STAT_MIN
        ? `Według cenników publikowanych przez ${unitForms().pl.acc} mediana najniższych stawek prowizji od sprzedaży ${where} wynosi ${pct(d.median)} ceny transakcyjnej (${nBiur(d.medianN)} z jawną stawką). Do prowizji często dochodzi VAT, a ostateczną kwotę określa umowa.`
        : commission.examples.length > 0
          ? `${portal.features.saleCommission ? `Za mało ${unitForms().pl.gen} publikuje porównywalne stawki, żeby podać medianę dla miasta. ` : ""}Przykłady z cenników: ${commission.examples
              .slice(0, 3)
              .map((e) => `${e.firmName}: ${e.value}`)
              .join("; ")}.`
          : copy.feeNoPrices(where),
  });
  if (top) {
    faq.push({
      q: `${unitForms().which} ${firmPhrase("one")} ma najwyższy wynik w rankingu ${where}?`,
      a: `Najwyższy wynik w naszym zestawieniu ma ${top.name} (${top.score}/100). To ocena według jawnej metodologii katalogu (m.in. potwierdzenie w rejestrze, staż, cennik, usługi${portal.features.offers ? " i oferty" : ""}), a nie opinia o jakości obsługi.`,
    });
  }
  faq.push({
    q: `Czy wszystkie ${firmPhrase("few")} ${where} publikują cenniki?`,
    a:
      withPrices === 0
        ? `Nie. Żadne z ${nBiurGen(n)} w naszym katalogu nie podaje stawek na stronie.`
        : withPrices === n
          ? `Tak, wszystkie ${nBiur(n)} w naszym katalogu podają ceny usług na swoich stronach.`
          : `Nie. Ceny usług na swojej stronie podaje ${withPrices} z ${nBiurGen(n)} w naszym katalogu. Jawny cennik jest jednym z parametrów rankingu.`,
  });
  faq.push({ q: copy.trustQuestion, a: copy.trustAnswer(ctx) });
  faq.push({ q: copy.factorsQuestion, a: copy.factorsAnswer });
  return faq.slice(0, 6);
}

export function districtSectionAvailable(): boolean {
  // Nie mamy wiarygodnych danych o obsługiwanych dzielnicach: nie przypisujemy ich automatycznie z adresu biura.
  return false;
}
