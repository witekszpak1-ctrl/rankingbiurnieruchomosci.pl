import type { Metadata } from "next";

import { SITE_NAME, absoluteUrl } from "./format";
import { operator, operatorJsonLd } from "./legal";

/** Domyślny obrazek do udostępniania (app/opengraph-image.tsx). */
export const DEFAULT_OG_IMAGE = "/opengraph-image";

export type PageSeo = {
  /** Pełny tytuł strony (bez doklejania nazwy serwisu). */
  title: string;
  description: string;
  /** Ścieżka kanoniczna, np. "/warszawa". Zawsze na domenie produkcyjnej. */
  path: string;
  image?: string | null;
  type?: "website" | "article" | "profile";
  /** Strona widoczna dla ludzi, ale nie do indeksu (np. formularze, cienkie strony). */
  noindex?: boolean;
};

/** Przycina opis do granicy zdania lub słowa, żeby nie urwać go w połowie wyrazu. */
export function clampDescription(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const sentence = cut.lastIndexOf(". ");
  if (sentence > max * 0.6) return cut.slice(0, sentence + 1);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:\s-]+$/, "")}…`;
}

/** Wspólne metadane strony: tytuł, opis, canonical, robots, Open Graph i karta Twittera, po polsku. */
export function pageMetadata(seo: PageSeo): Metadata {
  const description = clampDescription(seo.description);
  const url = absoluteUrl(seo.path);
  const image = seo.image ? (seo.image.startsWith("http") ? seo.image : absoluteUrl(seo.image)) : absoluteUrl(DEFAULT_OG_IMAGE);
  return {
    title: { absolute: seo.title },
    description,
    alternates: { canonical: url },
    robots: seo.noindex ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      title: seo.title,
      description,
      url,
      siteName: SITE_NAME,
      locale: "pl_PL",
      type: seo.type ?? "website",
      images: [{ url: image }],
    },
    twitter: { card: "summary_large_image", title: seo.title, description, images: [image] },
  };
}

/** Lista okruszków jako BreadcrumbList (schema.org). */
export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

// ----------------------------------------------------------------------------- dane strukturalne (schema.org)

/** Jeden identyfikator serwisu i witryny na wszystkich stronach: wyszukiwarki łączą je w jeden podmiot. */
export const ORG_ID = absoluteUrl("/#organizacja");
export const SITE_ID = absoluteUrl("/#witryna");
/** Kwadratowy znak serwisu (180x180 px); obrazek do udostępniania (1200x630) nie nadaje się na logo. */
export const SITE_LOGO = absoluteUrl("/apple-icon.png");
export const SITE_DESCRIPTION =
  "Niezależny katalog i ranking biur nieruchomości w Polsce oparty na danych z rejestrów publicznych i stron biur.";

/** Serwis jako Organization; administrator serwisu (operator) jako parentOrganization. */
export function organizationLd(): Record<string, unknown> {
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: SITE_NAME,
    url: absoluteUrl("/"),
    logo: { "@type": "ImageObject", url: SITE_LOGO, width: 180, height: 180 },
    email: operator().email ?? undefined,
    description: SITE_DESCRIPTION,
    parentOrganization: operatorJsonLd(),
  };
}

/** Witryna jako cel isPartOf (z nazwą i adresem, żeby blok był czytelny także sam). */
export function websiteRef(): Record<string, unknown> {
  return { "@type": "WebSite", "@id": SITE_ID, name: SITE_NAME, url: absoluteUrl("/") };
}

/** Artykuł (metodologia, raport, poradnik): autor i wydawca to serwis; data zmiany nigdy wcześniejsza niż publikacji. */
export function articleLd(a: {
  headline: string;
  path: string;
  description?: string | null;
  datePublished: string;
  dateModified: string;
  version?: string;
}): Record<string, unknown> {
  const url = absoluteUrl(a.path);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#artykul`,
    headline: a.headline,
    description: a.description ?? undefined,
    url,
    mainEntityOfPage: url,
    image: absoluteUrl(DEFAULT_OG_IMAGE),
    datePublished: a.datePublished,
    dateModified: a.dateModified < a.datePublished ? a.datePublished : a.dateModified,
    version: a.version,
    inLanguage: "pl-PL",
    author: organizationLd(),
    publisher: organizationLd(),
    isPartOf: websiteRef(),
  };
}

/**
 * Adres biura jako PostalAddress z osobnym kodem pocztowym:
 * "ul. Skierniewicka 10A, 01-230, Warszawa" -> ulica "ul. Skierniewicka 10A", kod "01-230", miejscowość "Warszawa".
 * Miejscowość bierzemy z adresu (biuro z Piaseczna w rankingu Warszawy ma w adresie Piaseczno), inaczej miasto wpisu.
 */
export function postalAddressLd(address: string | null | undefined, city: string): Record<string, unknown> {
  const base = { "@type": "PostalAddress", addressLocality: city, addressCountry: "PL" };
  const text = (address ?? "").replace(/\s+/g, " ").trim();
  if (!text) return base;
  const m = text.match(/\b(\d{2}-\d{3})\b/);
  if (!m || m.index == null) return { ...base, streetAddress: text };
  const clean = (x: string) => x.replace(/^[\s,;]+|[\s,;]+$/g, "");
  const before = clean(text.slice(0, m.index));
  const after = clean(text.slice(m.index + m[1].length));
  let street = before;
  let locality = after.split(",")[0]?.trim() || city;
  if (!before && after.includes(",")) {
    street = clean(after.slice(after.indexOf(",") + 1));  // "01-230 Warszawa, ul. X 5"
  } else if (before && after.includes(",")) {
    locality = clean(after.split(",")[0]);
  }
  if (locality.toLowerCase() === "polska") locality = city;
  return { ...base, streetAddress: street || undefined, postalCode: m[1], addressLocality: locality };
}
