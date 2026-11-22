/**
 * Lista artykułów bloga: jedno źródło dla strony /blog, mapy strony, llms.txt i linków "Czytaj też".
 * Treść artykułów jest w app/blog/<slug>/page.tsx, a liczby w nich pochodzą z lib/blog-stats.ts.
 * Przy zmianie tekstu artykułu zmień `modified` (data trafia do mapy strony i JSON-LD).
 */
import type { Metadata } from "next";

import { nLat } from "./plural";
import { pageMetadata } from "./seo";

export type BlogCategory = "Dane" | "Porównania" | "Poradnik";

export type BlogPost = {
  slug: string;
  /** Tytuł strony (title) i nagłówek h1. */
  title: string;
  h1: string;
  /** Opis do wyszukiwarki i karty na liście artykułów. */
  description: string;
  category: BlogCategory;
  /** Główna fraza, pod którą pisany jest artykuł (ocena SEO w panelu sprawdza ją w tytule, h1, opisie i wstępie). */
  keyword: string;
  published: string;
  modified: string;
};

export const BLOG_PATH = "/blog";
export const blogPath = (slug: string) => `${BLOG_PATH}/${slug}`;
/** Okładka artykułu (1200x630 PNG, generowana z kodu w app/blog/okladka/[file]/route.tsx). Pary miast: "porownanie-<para>". */
export const coverPath = (key: string) => `${BLOG_PATH}/okladka/${key}.png`;

/** Metadane strony artykułu: tytuł, opis, canonical i okładka jako obrazek do udostępniania. */
export function blogMetadata(post: Pick<BlogPost, "slug" | "title" | "description">): Metadata {
  return pageMetadata({ title: post.title, description: post.description, path: blogPath(post.slug), type: "article", image: coverPath(post.slug) });
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "oceny-biur-nieruchomosci-w-miastach",
    title: "Najlepsze biura nieruchomości: ranking miast według opinii 2026",
    h1: "Gdzie biura nieruchomości mają najlepsze opinie? Ranking miast",
    description: "Gdzie są najlepsze biura nieruchomości według opinii klientów: średnia ocena Google w miastach, odsetek biur z oceną 4,8+ i liczba opinii.",
    category: "Dane",
    keyword: "najlepsze biura nieruchomości",
    published: "2026-11-21",
    modified: "2026-11-22",
  },
  {
    slug: "biura-nieruchomosci-w-najwiekszych-miastach",
    title: "Biura nieruchomości w miastach: liczba, oceny, staż i cenniki",
    h1: "Biura nieruchomości w miastach z największym wyborem: liczby z katalogu",
    description: "Biura nieruchomości w miastach z największym wyborem: liczba biur w katalogu, oceny klientów, staż w rejestrze, jawne cenniki i mediana prowizji.",
    category: "Porównania",
    keyword: "biura nieruchomości w miastach",
    published: "2026-11-21",
    modified: "2026-11-22",
  },
  {
    slug: "sprzedaz-mieszkania-z-biurem-czy-samemu",
    title: "Sprzedaż mieszkania z biurem czy samemu? Policz koszt pośrednika",
    h1: "Sprzedaż mieszkania z biurem czy samemu?",
    description: "Sprzedaż mieszkania z biurem czy samemu: kalkulator prowizji ze stawkami z cenników biur, VAT, zakres usług pośrednika, umowa, dokumenty i podatek.",
    category: "Poradnik",
    keyword: "sprzedaż mieszkania",
    published: "2026-11-21",
    modified: "2026-11-22",
  },
  {
    slug: "czy-kupujacy-placi-prowizje-biuru-nieruchomosci",
    title: "Czy kupujący płaci prowizję biuru nieruchomości? Stawki 2026",
    h1: "Czy kupujący płaci prowizję biuru nieruchomości?",
    description: "Kiedy kupujący płaci prowizję biuru nieruchomości, ile wynosi i jak jej uniknąć. Stawki dla kupujących z cenników biur i co sprawdzić przed podpisem.",
    category: "Poradnik",
    keyword: "prowizję biuru nieruchomości",
    published: "2026-11-21",
    modified: "2026-11-22",
  },
  {
    slug: "prowizja-za-wynajem-mieszkania",
    title: "Prowizja za wynajem mieszkania: kto płaci i ile wynosi w 2026",
    h1: "Prowizja za wynajem mieszkania: kto płaci i ile wynosi",
    description: "Prowizja za wynajem mieszkania: kto płaci, właściciel czy najemca, ile biorą biura według cenników, koszt wejścia w najem i zarządzania najmem.",
    category: "Poradnik",
    keyword: "prowizja za wynajem mieszkania",
    published: "2026-11-21",
    modified: "2026-11-22",
  },
  {
    slug: "ocena-5-w-google-biuro-nieruchomosci",
    title: "Ocena 5,0 w Google: czy biuro nieruchomości jest najlepsze?",
    h1: "Ocena 5,0 w Google. Czy to znaczy, że biuro jest najlepsze?",
    description: "Ocena 5,0 w Google a jakość biura nieruchomości: rozkład ocen biur, wpływ liczby opinii, fałszywe opinie i na co patrzeć zamiast gwiazdek.",
    category: "Poradnik",
    keyword: "ocena 5,0 w Google",
    published: "2026-11-21",
    modified: "2026-11-22",
  },
  {
    slug: "siec-czy-lokalne-biuro-nieruchomosci",
    title: "Sieć czy lokalne biuro nieruchomości? Porównanie opinii i stażu",
    h1: "Sieć czy lokalne biuro nieruchomości?",
    description: "Sieć czy lokalne biuro nieruchomości: oceny Google, liczba opinii, staż i cenniki biur z jednego miasta i firm z oddziałami. Plusy i minusy.",
    category: "Porównania",
    keyword: "lokalne biuro nieruchomości",
    published: "2026-11-21",
    modified: "2026-11-22",
  },
  {
    slug: "najdluzej-dzialajace-biura-nieruchomosci",
    title: "Najdłużej działające biura nieruchomości w Polsce",
    h1: "Najdłużej działające biura nieruchomości w Polsce",
    description: "Najdłużej działające biura nieruchomości w Polsce i w miastach: daty wpisu do KRS i wykazu VAT, typowy staż biura i odsetek nowych firm.",
    category: "Dane",
    keyword: "najdłużej działające biura nieruchomości",
    published: "2026-11-21",
    modified: "2026-11-22",
  },
];

export function getPost(slug: string): BlogPost {
  const post = BLOG_POSTS.find((p) => p.slug === slug);
  if (!post) throw new Error(`Brak artykułu ${slug} w lib/blog.ts`);
  return post;
}

/** Inne artykuły do "Czytaj też": najpierw z tej samej kategorii. */
export function relatedPosts(slug: string, limit = 3): BlogPost[] {
  const self = getPost(slug);
  const others = BLOG_POSTS.filter((p) => p.slug !== slug);
  return [...others.filter((p) => p.category === self.category), ...others.filter((p) => p.category !== self.category)].slice(0, limit);
}

/** Data ostatniej zmiany treści bloga (lista artykułów). */
export function blogModified(): string {
  return BLOG_POSTS.reduce((acc, p) => (p.modified > acc ? p.modified : acc), "2026-11-21");
}

// ----------------------------------------------------------------------------- formatowanie liczb w tekstach

const pl = (v: number, digits: number) => v.toLocaleString("pl-PL", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Odsetek zaokrąglony do całości: "63%". */
export const fmtShare = (v: number | null | undefined) => (v == null ? "-" : `${Math.round(v)}%`);
/** Ocena Google z dwoma miejscami: "4,78". */
export const fmtRating = (v: number | null | undefined) => (v == null ? "-" : pl(v, 2));
/** Stawka prowizji: "2,5%" (bez zbędnych zer). */
export const fmtRate = (v: number | null | undefined) =>
  v == null ? "-" : `${v.toLocaleString("pl-PL", { maximumFractionDigits: 2 })}%`;
/** Kwota w złotych bez groszy: "15 000 zł". */
export const fmtPln = (v: number | null | undefined) => (v == null ? "-" : `${Math.round(v).toLocaleString("pl-PL")} zł`);
/** Liczba lat zaokrąglona w dół: "12 lat". */
export const fmtYears = (v: number | null | undefined) => (v == null ? "-" : nLat(Math.floor(v)));
/** Liczba całkowita z separatorem tysięcy. */
export const fmtInt = (v: number | null | undefined) => (v == null ? "-" : Math.round(v).toLocaleString("pl-PL"));
