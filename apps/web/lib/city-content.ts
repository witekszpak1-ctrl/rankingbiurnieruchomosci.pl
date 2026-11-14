/**
 * Treść strony miasta z rzeczywistych danych: wstęp, TOP 3, prowizje, poradnik i FAQ.
 * Sekcje są warunkowe (np. mediana tylko przy wystarczającej próbce), żeby strony miast nie były kopiami z podmienioną nazwą.
 * Nie wymyślamy statystyk ani charakterystyki rynku.
 */
import type { CityPriceExample } from "./catalog";
import { inCity } from "./cities";
import { formatDate, formatPrice } from "./format";
import { nBiur, nBiurGen, plural } from "./plural";
import { isPlausible, priceBasis, priceKind } from "./prices";
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
};

const SERVICE_GROUPS: { key: string; label: string; re: RegExp }[] = [
  { key: "sale", label: "sprzedaż nieruchomości", re: /sprzeda|zbyci/i },
  { key: "rent", label: "wynajem", re: /wynaj|najem(?!.*zarz)/i },
  { key: "management", label: "zarządzanie najmem", re: /zarządza|zarzadza|administrow/i },
  { key: "primary", label: "rynek pierwotny", re: /pierwotn|deweloper|nowe (inwestycje|mieszkania|budownictwo)/i },
  { key: "commercial", label: "nieruchomości komercyjne", re: /komercyj|lokal(e|i) użytkow|biur(a|o) do wynaj|magazyn/i },
  { key: "credit", label: "pomoc w kredycie", re: /kredyt|finansowa/i },
  { key: "valuation", label: "wycena nieruchomości", re: /wycen/i },
];

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
  return ranked ? `Ranking biur nieruchomości ${inCity(cityName)} ${year}` : `Biura nieruchomości ${inCity(cityName)}`;
}

export function cityIntro(d: CityData): string {
  const n = d.firms.length;
  const where = inCity(d.cityName);
  const confirmed = d.firms.filter((f) => f.registryConfirmed).length;
  const withPrices = d.firms.filter((f) => f.hasPublicPrices).length;
  const withOffers = d.firms.filter((f) => f.offersCount > 0).length;
  const parts = [
    `Zestawienie obejmuje ${nBiur(n)} nieruchomości ${where}, które mają własną stronę internetową.`,
    confirmed === n
      ? "Każde z nich potwierdziliśmy w rejestrach publicznych (KRS lub wykaz podatników VAT)."
      : `${confirmed} z nich potwierdziliśmy w rejestrach publicznych (KRS lub wykaz podatników VAT), pozostałe opisujemy na podstawie ich stron i oznaczamy jako niepotwierdzone.`,
    d.ranked
      ? "Kolejność wynika z jawnej metodologii, a nie z płatności: liczą się m.in. potwierdzenie w rejestrze, staż, jawność cennika, zakres usług i aktualne oferty."
      : "Biur jest jeszcze za mało na ranking z pozycjami, dlatego pokazujemy je alfabetycznie.",
    `Możesz porównać ${withPrices > 0 ? `cenniki (${withPrices} ${plural(withPrices, "biuro publikuje", "biura publikują", "biur publikuje")} stawki), ` : ""}zakres usług${withOffers > 0 ? `, oferty ze stron biur` : ""} i dane kontaktowe, a z każdego profilu wysłać zapytanie.`,
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
  if (withPrices === 0) {
    sentences.push(
      `Żadne z biur nieruchomości ${where} w naszym katalogu (${nBiur(n)}) nie publikuje na swojej stronie stawek prowizji, więc wysokość wynagrodzenia trzeba ustalić bezpośrednio z biurem.`,
    );
  } else {
    sentences.push(
      `${withPrices} z ${nBiurGen(n)} ${where} ${plural(withPrices, "publikuje", "publikują", "publikuje")} na swojej stronie ceny usług, a ${saleFirms} ${plural(saleFirms, "podaje", "podają", "podaje")} procentową prowizję od sprzedaży, którą da się porównać.`,
    );
    if (d.median != null && d.medianN >= PRICE_STAT_MIN) {
      sentences.push(
        `Mediana najniższych deklarowanych stawek od sprzedaży wynosi ${pct(d.median)} ceny transakcyjnej (na podstawie ${nBiurGen(d.medianN)}).`,
      );
    } else if (saleFirms > 0) {
      sentences.push(`To za mała próba, żeby podawać medianę dla miasta; poniżej pokazujemy stawki konkretnych biur.`);
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
  const note = latest
    ? `Stawki są deklarowane przez biura na ich stronach i sprawdzone ${formatDate(latest)}. Mogły się zmienić, a ostateczne wynagrodzenie określa umowa pośrednictwa.`
    : "Ostateczne wynagrodzenie zawsze określa umowa pośrednictwa.";
  return { summary: sentences.join(" "), examples, note };
}

export function choosingGuide(d: CityData): string[] {
  const where = inCity(d.cityName);
  const n = d.firms.length;
  const withPrices = d.firms.filter((f) => f.hasPublicPrices).length;
  const confirmed = d.firms.filter((f) => f.registryConfirmed).length;
  const groups = serviceGroups(d.services).slice(0, 4);
  const paragraphs = [
    `Zacznij od zakresu usług. Biuro, które na co dzień sprzedaje mieszkania, niekoniecznie dobrze poprowadzi wynajem lokalu czy sprzedaż działki.${
      groups.length > 0
        ? ` Wśród biur ${where} z naszego katalogu najczęściej deklarowane są: ${groups.map((g) => `${g.label} (${nBiur(g.count)})`).join(", ")}.`
        : ""
    }`,
    `Zapytaj o prowizję i o to, co obejmuje: sesję zdjęciową, publikację ogłoszeń, prezentacje, negocjacje, pomoc przy dokumentach i kredycie. ${
      withPrices > 0
        ? `Cennik publikuje ${withPrices} z ${nBiurGen(n)}, u pozostałych stawkę poznasz dopiero w rozmowie.`
        : "Biura w tym mieście nie publikują cenników, więc poproś o stawkę na piśmie przed podpisaniem umowy."
    } Sprawdź, czy kwota jest netto, brutto czy powiększona o VAT.`,
    `Przeczytaj umowę pośrednictwa przed podpisaniem: czy jest na wyłączność, na jak długo, z jakim okresem wypowiedzenia i kiedy należy się wynagrodzenie. Umowa na wyłączność bywa korzystna, ale tylko wtedy, gdy biuro jasno opisuje, co w zamian zrobi.`,
    `Zwróć uwagę na lokalizację i doświadczenie. Biuro, które ma aktualne oferty w Twojej okolicy, zna ceny i kupujących z tego rynku. Na stronie biura obejrzyj, jak prezentuje nieruchomości: zdjęcia, opisy, rzuty i informacje o stanie prawnym mówią dużo o tym, jak pokaże Twoją.`,
    `Na koniec sprawdź firmę w rejestrze. ${
      confirmed === n
        ? `Wszystkie biura z tej listy potwierdziliśmy numerem NIP w rejestrach publicznych.`
        : `${confirmed} z ${nBiurGen(n)} ${where} potwierdziliśmy numerem NIP w rejestrach; przy pozostałych poproś o NIP i sprawdź go w wykazie podatników VAT.`
    }`,
  ];
  return paragraphs;
}

export type FaqItem = { q: string; a: string };

export function cityFaq(d: CityData): FaqItem[] {
  const where = inCity(d.cityName);
  const n = d.firms.length;
  const withPrices = d.firms.filter((f) => f.hasPublicPrices).length;
  const confirmed = d.firms.filter((f) => f.registryConfirmed).length;
  const top = topThree(d)[0];
  const commission = commissionSection(d);
  const faq: FaqItem[] = [];
  faq.push({
    q: `Ile kosztuje pośrednik nieruchomości ${where}?`,
    a:
      d.median != null && d.medianN >= PRICE_STAT_MIN
        ? `Według cenników publikowanych przez biura mediana najniższych stawek prowizji od sprzedaży ${where} wynosi ${pct(d.median)} ceny transakcyjnej (${nBiur(d.medianN)} z jawną stawką). Do prowizji często dochodzi VAT, a ostateczną kwotę określa umowa.`
        : commission.examples.length > 0
          ? `Za mało biur publikuje porównywalne stawki, żeby podać medianę dla miasta. Przykłady z cenników: ${commission.examples
              .slice(0, 3)
              .map((e) => `${e.firmName}: ${e.value}`)
              .join("; ")}.`
          : `Biura ${where} w naszym katalogu nie publikują stawek prowizji, więc koszt trzeba ustalić z wybranym biurem. Poproś o stawkę na piśmie i sprawdź, czy zawiera VAT.`,
  });
  if (top) {
    faq.push({
      q: `Które biuro nieruchomości ma najwyższy wynik w rankingu ${where}?`,
      a: `Najwyższy wynik w naszym zestawieniu ma ${top.name} (${top.score}/100). To ocena według jawnej metodologii katalogu (m.in. potwierdzenie w rejestrze, staż, cennik, usługi i oferty), a nie opinia o jakości obsługi.`,
    });
  }
  faq.push({
    q: `Czy wszystkie biura nieruchomości ${where} publikują cenniki?`,
    a:
      withPrices === 0
        ? `Nie. Żadne z ${nBiurGen(n)} w naszym katalogu nie podaje stawek na stronie.`
        : withPrices === n
          ? `Tak, wszystkie ${nBiur(n)} w naszym katalogu podają ceny usług na swoich stronach.`
          : `Nie. Ceny usług na swojej stronie podaje ${withPrices} z ${nBiurGen(n)} w naszym katalogu. Jawny cennik jest jednym z parametrów rankingu.`,
  });
  faq.push({
    q: "Jak sprawdzić wiarygodność biura nieruchomości?",
    a: `Poproś o NIP i sprawdź go w wykazie podatników VAT lub w KRS, przeczytaj umowę pośrednictwa i zapytaj o ubezpieczenie OC. W naszym katalogu ${
      confirmed === n ? "wszystkie biura z tego miasta mają" : `${confirmed} z ${nBiurGen(n)} ${where} ma`
    } potwierdzenie w rejestrze, oznaczone na profilu.`,
  });
  faq.push({
    q: "Od czego zależy prowizja biura nieruchomości?",
    a: "Najczęściej od wartości nieruchomości, rodzaju transakcji (sprzedaż, kupno, wynajem), zakresu usług, rodzaju umowy (na wyłączność lub otwarta) i od tego, czy w cenie są np. zdjęcia, reklama i pomoc prawna. Stawka bywa podawana netto, brutto albo z doliczanym VAT.",
  });
  return faq.slice(0, 6);
}

export function districtSectionAvailable(): boolean {
  // Nie mamy wiarygodnych danych o obsługiwanych dzielnicach: nie przypisujemy ich automatycznie z adresu biura.
  return false;
}
