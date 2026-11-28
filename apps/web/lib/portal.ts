/**
 * Konfiguracja portalu: jeden kod, wiele branż. Każdy portal (np. biura nieruchomości, biura rachunkowe) ma własną
 * nazwę, domenę, słownik branżowy z odmianą, typ danych strukturalnych, teksty ogólne i motyw wyglądu.
 *
 * Wybór portalu: zmienna środowiska PORTAL (domyślnie "nieruchomosci"). Resolver przyjmuje opcjonalny host, więc
 * wybór po domenie (wiele domen na jednym wdrożeniu) można dodać bez zmiany interfejsu: portal.domains.
 *
 * Plik nie importuje niczego z Node ani z Next, żeby dało się go użyć także w komponentach przeglądarkowych.
 * Opis działania: docs/geo/silnik-branz.md.
 */
import { nieruchomosci } from "../portals/nieruchomosci";

/** Rzeczownik odmieniany przez liczebnik: 1 biuro, 2-4 biura, 5+ biur. */
export type Noun3 = { one: string; few: string; many: string };

export type PortalFirmTerms = Noun3 & {
  /** Dopełniacz liczby pojedynczej: "biura" (np. "z 1 biura"). */
  genOne: string;
};

export type PortalTerms = {
  /** Jednostka katalogu, np. "biuro" / "biura" / "biur". */
  firm: PortalFirmTerms;
  /** Dopełniacz nazwy branży doklejany do jednostki: "biuro nieruchomości", "biur nieruchomości". */
  domainGen: string;
  /** Specjalista z branży (mianownik): "pośrednik" w "pośrednik nieruchomości". */
  expert: string;
  /** Opłata za usługę: "prowizja" / "prowizje". */
  fee: { nom: string; nomPl: string };
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
  /** Odnośniki w kolumnie "Katalog" w stopce (treści specyficzne dla branży są tu, nie w komponencie). */
  footerCatalogLinks: PortalNavLink[];
  /** Raporty branżowe wymieniane w llms.txt (wiersz: [etykieta](adres): opis). */
  llmsReports: { href: string; label: string; description: string }[];
};

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
  terms: PortalTerms;
  schema: PortalSchema;
  texts: PortalTexts;
};

export const DEFAULT_PORTAL_SLUG = "nieruchomosci";

/** Wszystkie portale wbudowane w kod. Nowy portal = nowy plik w portals/ i wpis tutaj. */
export const PORTALS: Record<string, PortalConfig> = {
  [nieruchomosci.slug]: nieruchomosci,
};

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/:\d+$/, "").replace(/^www\./, "");
}

/** Portal obsługujący dany host (np. z nagłówka Host), albo null. Miejsce na przyszły wybór po domenie. */
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

// ----------------------------------------------------------------------------- odmiana i frazy z konfiguracji

/** Wybór formy rzeczownika po liczebniku, tak jak w lib/plural.ts (jedna reguła w jednym miejscu). */
export function nounForm(n: number, noun: Noun3): string {
  const abs = Math.abs(Math.trunc(n));
  if (abs === 1) return noun.one;
  const last = abs % 10;
  const lastTwo = abs % 100;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return noun.few;
  return noun.many;
}

/** Fraza rodzajowa jednostki katalogu z nazwą branży: "biuro nieruchomości" / "biura nieruchomości" / "biur nieruchomości". */
export function firmPhrase(form: "one" | "few" | "many", portal: PortalConfig = currentPortal()): string {
  return `${portal.terms.firm[form]} ${portal.terms.domainGen}`;
}

/** "pośrednik nieruchomości" */
export function expertPhrase(portal: PortalConfig = currentPortal()): string {
  return `${portal.terms.expert} ${portal.terms.domainGen}`;
}

/** Wielka litera na początku: "biura nieruchomości" -> "Biura nieruchomości". */
export function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase("pl") + text.slice(1);
}
