/**
 * Konfiguracja portalu: jeden kod, wiele branż. Każdy portal (np. biura nieruchomości, biura rachunkowe) ma własną
 * nazwę, domenę, słownik branżowy z odmianą, typ danych strukturalnych, teksty ogólne i motyw wyglądu.
 *
 * Wybór portalu: zmienna środowiska PORTAL (domyślnie "nieruchomosci") to źródło prawdy na produkcji: jeden projekt
 * Vercel na portal, ten sam kod, inna wartość PORTAL (docs/geo/silnik-branz.md, "Wybór portalu i domeny").
 * Resolver przyjmuje opcjonalny host (portalForHost, portal.domains) do pracy lokalnej, podglądów i testów, ale
 * strony renderowane statycznie (ISR) nie czytają hosta z żądania, bo to wyłączyłoby ich pamięć podręczną.
 *
 * Plik nie importuje niczego z Node ani z Next, żeby dało się go użyć także w komponentach przeglądarkowych.
 * Opis działania: docs/geo/silnik-branz.md.
 */
import { nounForm, type Noun3 } from "./noun";
import { nieruchomosci } from "../portals/nieruchomosci";
import { rachunkowe } from "../portals/rachunkowe";

export type PortalFirmTerms = Noun3 & {
  /** Dopełniacz liczby pojedynczej: "biura" (np. "z 1 biura"). */
  genOne: string;
};

export type PortalTerms = {
  /** Jednostka katalogu, np. "biuro" / "biura" / "biur". */
  firm: PortalFirmTerms;
  /**
   * Pełna fraza jednostki z nazwą branży, w formach potrzebnych w tekstach: "biuro nieruchomości" / "biura
   * nieruchomości" / "biur nieruchomości" albo "biuro rachunkowe" / "biura rachunkowe" / "biur rachunkowych"
   * (przymiotnik zmienia formę, więc nie da się go skleić z dopełniaczem). genOne: dopełniacz liczby pojedynczej
   * ("biura nieruchomości", "biura rachunkowego").
   */
  phrase: PortalFirmTerms & {
    /** Celownik liczby pojedynczej: "biuru nieruchomości", "biuru rachunkowemu". */
    datOne: string;
    /** Miejscownik liczby mnogiej: "biurach nieruchomości", "biurach rachunkowych". */
    locPl: string;
  };
  /** Dopełniacz nazwy dziedziny: "nieruchomości", "księgowości". */
  domainGen: string;
  /** Specjalista z branży (mianownik): "pośrednik". */
  expert: string;
  /** Specjalista z dziedziną w pytaniach ("pośrednik nieruchomości", "księgowy"). */
  expertFull: string;
  /** Rodzajowa nazwa jednostki używana w opisach metadanych: "agencje" / "agencji" albo "biura" / "biur". */
  synonym: { few: string; gen: string };
  /** Opłata za usługę: "prowizja" / "prowizje". */
  fee: { nom: string; nomPl: string; /** dopełniacz liczby mnogiej: "prowizji", "abonamentów" */ genPl: string };
  /** Odmiana "firma" w nazwach rodzajowych ("firma" / "firmy" / "firm"). */
  company: Noun3;
};

export type PortalNavLink = { href: string; label: string };

export type PortalTexts = {
  /** Opis serwisu w danych strukturalnych (Organization). */
  siteDescription: string;
  /** Opis serwisu w metadanych strony głównej layoutu. */
  layoutDescription: string;
  /** Opis serwisu w manifeście aplikacji. */
  manifestDescription: string;
  /** Krótki opis serwisu w llms.txt. */
  llmsSummary: string;
  /** Podpis w stopce pod logo. */
  footerAbout: string;
  /** Nagłówek i podtytuł obrazka do udostępniania. */
  ogHeadline: string;
  ogSubline: string;
  /** Tekst alternatywny obrazka do udostępniania. */
  ogAlt: string;
  /** Przycisk w nagłówku i etykieta odnośnika "dla firm". */
  headerCta: string;
  navForFirms: string;
  footerForFirmsHeading: string;
  /** Menu główne w nagłówku (bez przycisku) i menu na telefonie. */
  headerNav: PortalNavLink[];
  mobileNav: PortalNavLink[];
  /** Odnośniki w kolumnie "Katalog" w stopce (treści specyficzne dla branży są tu, nie w komponencie). */
  footerCatalogLinks: PortalNavLink[];
  /** Raporty branżowe wymieniane w llms.txt (wiersz: [etykieta](adres): opis). */
  llmsReports: { href: string; label: string; description: string }[];
  /** Akapit pod nagłówkiem na stronie głównej. */
  homeHeroLead: string;
  /** Trzy kroki "Jak to działa" na stronie głównej. */
  homeSteps: { title: string; text: string }[];
  /** Punkt "Codzienna aktualizacja" w sekcji "Dlaczego nam zaufać". */
  homeWhyDaily: string;
  /** Nazwa umowy z firmą w zastrzeżeniach o cenach: "umowa pośrednictwa". */
  contractName: string;
  /** Przycisk i nagłówek formularza zapytania: "Zapytaj o ofertę". */
  leadCta: string;
  /** Zdanie o roli serwisu w podsumowaniu regulaminu ("Nie jesteśmy pośrednikiem w obrocie nieruchomościami ..."). */
  notPartyShort: string;
  /** To samo w rozdziale o odpowiedzialności ("Operator nie jest pośrednikiem ..."). */
  notPartyLong: string;
  /** Źródło danych o firmach w opisie metodologii ("zakres usług, cennik, aktualne oferty"). */
  siteDataList: string;
  /** Przykłady usług w opisie "Opisany zakres usług" na stronie dla firm. */
  serviceExamples: string;
  /** Przedmiot ceny w nazwie sekcji profilu: "Prowizje i ceny usług". */
  priceSectionHeading: string;
  /** Krótkie zdanie o danych z profilu firmy na stronie dla firm ("ceny i oferty, które firma sama pokazuje"). */
  forFirmsDataList: string;
  /** Gdy firma nie podaje cen: zdanie na profilu i w FAQ (nazwa firmy w środku). */
  firmNoRates: (name: string) => string;
  /** Formularz zapytania: tematy (klucze stałe, ograniczone w bazie), gotowe wiadomości. */
  lead: PortalLeadTexts;
  /** Treści stron miast. */
  city: PortalCityCopy;
};

export type PortalLeadTexts = {
  topics: Record<"kupno" | "sprzedaz" | "wynajem" | "najem" | "wycena" | "inne", string>;
  /** Wiadomość dla tematu; `where` to miasto z przyimkiem ("w Krakowie"). Pusty temat: wiadomość domyślna. */
  message: (topic: "kupno" | "sprzedaz" | "wynajem" | "najem" | "wycena" | "inne" | "", where: string) => string;
};

/** Dane do zdań na stronie miasta; formy liczebnikowe policzone przez wywołującego (lib/plural.ts). */
export type CityCtx = {
  where: string;
  n: number;
  withPrices: number;
  confirmed: number;
  /** "6 biur", "1 biuro" */
  units: (n: number) => string;
  /** Dopełniacz: "1 biura", "6 biur" */
  unitsGen: (n: number) => string;
  groups: { label: string; count: number }[];
};

export type PortalCityCopy = {
  /** Akapity poradnika "Jak wybrać ..." (bez nagłówka). */
  guide: (c: CityCtx) => string[];
  /** Zdanie, gdy żadna firma w mieście nie publikuje cen. */
  noPrices: (c: CityCtx) => string;
  /** Zdanie, gdy część firm publikuje ceny (share: procent, natShare: procent z całego katalogu albo null). */
  somePrices: (c: CityCtx, share: number, natShare: number | null, saleFirms: number) => string;
  /** Uwaga pod listą cen; `latest` to sformatowana data albo null. */
  priceNote: (latest: string | null) => string;
  /** Nazwa sekcji cen na stronie miasta: "Ile wynosi prowizja biura nieruchomości we Wrocławiu?". */
  priceHeading: (where: string) => string;
  /** Pytania FAQ miasta, które zależą od branży. */
  faq: {
    feeQuestion: (where: string) => string;
    feeNoPrices: (where: string) => string;
    trustQuestion: string;
    trustAnswer: (c: CityCtx) => string;
    factorsQuestion: string;
    factorsAnswer: string;
  };
};

/**
 * Funkcje serwisu, które nie dotyczą każdej branży. Ukryta funkcja znika ze stron, z menu, z mapy strony i z
 * llms.txt, a jej adresy odpowiadają 404 (strony i route handlery sprawdzają flagę przez requireFeature).
 */
export type PortalRanking = { weights: Record<string, number> };

export type PortalFeatures = {
  /** Oferty ze stron firm (lista /oferty, kafelki na stronie głównej i profilach, parametr rankingu). */
  offers: boolean;
  /** Kalkulator prowizji w artykule bloga (tylko nieruchomości). */
  commissionCalculator: boolean;
  /** Blog i porównania miast z blogu. */
  blog: boolean;
  /** Raporty branżowe (np. prowizje biur nieruchomości 2026) i poradniki. */
  reports: boolean;
  /** Wyróżnienia (odznaki) i strona nagród. */
  awards: boolean;
  /** Cel klienta (kupno, sprzedaż, wynajem) i filtr zarządzania najmem. */
  goals: boolean;
  /** Mediana procentowej prowizji od sprzedaży jako statystyka miasta. */
  saleCommission: boolean;
};

/** Pozycja listy "cel klienta" i filtra na stronie miasta: etykieta i grupa usług z `serviceGroups`. */
export type PortalCatalogView = {
  goals: Record<string, { label: string; group: string }>;
  filters: Record<string, { label: string; group: string | null }>;
};

/** Grupa usług deklarowanych przez firmy: rozpoznawana wyrażeniem regularnym po nazwie usługi. */
export type PortalServiceGroup = { key: string; label: string; re: RegExp };

export type PortalSchema = {
  /** Typ schema.org profilu firmy, np. "RealEstateAgent", "AccountingService". */
  firmType: string;
  /** Fragment identyfikatora węzła profilu firmy (#biuro). */
  profileAnchor: string;
  /** Wartość content_type w zdarzeniach reklamowych profilu. */
  trackingContentType: string;
};

export type PortalConfig = {
  slug: string;
  /** Nazwa serwisu w tytułach, danych strukturalnych i stopce: "Ranking biur nieruchomości". */
  siteName: string;
  /** Nazwa w zapisie wielkimi literami (logo, manifest): "Ranking Biur Nieruchomości". */
  brandName: string;
  /** Skrót nazwy w manifeście aplikacji. */
  shortName: string;
  /** Adres główny bez końcowego ukośnika; zmienna SITE_URL ma pierwszeństwo (podgląd, testy). */
  siteUrl: string;
  /** Domeny obsługiwane przez ten portal (wybór po hoście). */
  domains: string[];
  /** Domyślny adres kontaktowy (zmienna NEXT_PUBLIC_CONTACT_EMAIL ma pierwszeństwo). */
  contactEmail: string;
  /** Identyfikator motywu wyglądu (atrybut data-theme na <html>, zmienne CSS w app/globals.css). */
  themeId: string;
  /** Slug branży w tabeli verticals: portal pokazuje tylko wpisy tej branży (lib/vertical-scope.ts). */
  verticalSlug: string;
  features: PortalFeatures;
  /**
   * Wagi rankingu tego portalu (klucz parametru -> waga). Parametry bez wpisu nie istnieją w tym portalu. Klucze to
   * parametry silnika w lib/ranking.ts (rejestr, staz, jawnosc_cennika, spojnosc_danych, zakres_uslug, opinie_google,
   * aktualne_oferty). Płatność nie jest parametrem i nie może nim zostać (test w tests/ranking-config.test.ts).
   */
  ranking: PortalRanking;
  catalogView: PortalCatalogView;
  serviceGroups: PortalServiceGroup[];
  terms: PortalTerms;
  schema: PortalSchema;
  texts: PortalTexts;
};

export const DEFAULT_PORTAL_SLUG = "nieruchomosci";

/** Wszystkie portale wbudowane w kod. Nowy portal = nowy plik w portals/ i wpis tutaj. */
export const PORTALS: Record<string, PortalConfig> = {
  [nieruchomosci.slug]: nieruchomosci,
  [rachunkowe.slug]: rachunkowe,
};

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/:\d+$/, "").replace(/^www\./, "");
}

/** Portal obsługujący dany host (np. z nagłówka Host), albo null. Do pracy lokalnej, podglądów i testów (patrz nagłówek pliku). */
export function portalForHost(host: string | null | undefined): PortalConfig | null {
  if (!host) return null;
  const h = normalizeHost(host);
  for (const portal of Object.values(PORTALS)) {
    if (portal.domains.some((d) => normalizeHost(d) === h)) return portal;
  }
  return null;
}

/** Portal o danym slugu; nieznany slug to błąd konfiguracji (lepiej wywrócić budowanie niż pokazać zły portal). */
export function portalBySlug(slug: string): PortalConfig {
  const portal = PORTALS[slug];
  if (!portal) {
    throw new Error(`Nieznany portal "${slug}". Dostępne: ${Object.keys(PORTALS).join(", ")}.`);
  }
  return portal;
}

/**
 * Bieżący portal: najpierw host (jeśli podano i jest znany), potem zmienna PORTAL, na końcu portal domyślny.
 * Bez hosta zachowuje się jak wybór ze zmiennej środowiska.
 */
export function currentPortal(host?: string | null): PortalConfig {
  const byHost = portalForHost(host);
  if (byHost) return byHost;
  const slug = (typeof process !== "undefined" ? process.env.PORTAL?.trim() : undefined) || DEFAULT_PORTAL_SLUG;
  return portalBySlug(slug);
}

// ----------------------------------------------------------------------------- funkcje wyłączone w portalu

/** Adresy należące do funkcji, które można wyłączyć w portalu (prefiks ścieżki -> flaga). */
const FEATURE_PATHS: [string, keyof PortalFeatures][] = [
  ["/oferty", "offers"],
  ["/blog", "blog"],
  ["/poradnik", "reports"],
  ["/raporty", "reports"],
  ["/wyroznienia-2026", "awards"],
  ["/odznaka", "awards"],
];

/** Flaga funkcji, do której należy adres (albo null, gdy adres jest wspólny dla wszystkich portali). */
export function featureForPath(pathname: string): keyof PortalFeatures | null {
  for (const [prefix, feature] of FEATURE_PATHS) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return feature;
  }
  return null;
}

/** Czy adres jest wyłączony w portalu (jego funkcja ma flagę false). Middleware odpowiada na niego stroną 404. */
export function isPathDisabled(pathname: string, portal: PortalConfig = currentPortal()): boolean {
  const feature = featureForPath(pathname);
  return feature !== null && !portal.features[feature];
}

// ----------------------------------------------------------------------------- odmiana i frazy z konfiguracji

export { nounForm };
export type { Noun3 };

/** Fraza rodzajowa jednostki katalogu z nazwą branży: "biuro nieruchomości" / "biura nieruchomości" / "biur nieruchomości". */
export function firmPhrase(form: "one" | "few" | "many", portal: PortalConfig = currentPortal()): string {
  return portal.terms.phrase[form];
}

/** Liczba z pełną frazą jednostki: "6 biur nieruchomości", "1 biuro rachunkowe", "3 biura rachunkowe". */
export function nFirmPhrase(n: number, portal: PortalConfig = currentPortal()): string {
  return `${n.toLocaleString("pl-PL")} ${nounForm(n, portal.terms.phrase)}`;
}

/** "pośrednik nieruchomości" */
export function expertPhrase(portal: PortalConfig = currentPortal()): string {
  return portal.terms.expertFull;
}

/** Wielka litera na początku: "biura nieruchomości" -> "Biura nieruchomości". */
export function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase("pl") + text.slice(1);
}
