import type { Metadata } from "next";

import { SITE_NAME, absoluteUrl } from "./format";

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
