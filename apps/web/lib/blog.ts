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
    title: "Gdzie biura nieruchomości mają najlepsze opinie? Ranking miast 2026",
    h1: "Gdzie biura nieruchomości mają najlepsze opinie? Ranking miast",
    description: "Porównanie miast według ocen Google biur nieruchomości: średnia ocena, odsetek biur z oceną 4,8 i wyższą, liczba opinii. Tylko biura z co najmniej 10 opiniami.",
    category: "Dane",
    keyword: "najlepsze biura nieruchomości",
    published: "2026-11-21",
    modified: "2026-11-21",
  },
  {
    slug: "biura-nieruchomosci-w-najwiekszych-miastach",
    title: "Biura nieruchomości w największych miastach: liczby, oceny, staż, cenniki",
    h1: "Biura nieruchomości w miastach z największym wyborem: liczby z katalogu",
    description: "Ile biur nieruchomości działa w największych miastach, jak oceniają je klienci, jak długo działają, ile publikuje cennik i ile biorą prowizji. Tabela miast.",
    category: "Porównania",
    keyword: "biura nieruchomości w miastach",
    published: "2026-11-21",
    modified: "2026-11-21",
  },
  {
    slug: "sprzedaz-mieszkania-z-biurem-czy-samemu",
    title: "Sprzedaż mieszkania z biurem czy samemu? Policz koszt pośrednika",
    h1: "Sprzedaż mieszkania z biurem czy samemu?",
    description: "Ile kosztuje pośrednik przy sprzedaży mieszkania: kalkulator prowizji ze stawkami z cenników biur, VAT, zakres usług biura i kiedy sprzedawać samemu.",
    category: "Poradnik",
    keyword: "sprzedaż mieszkania",
    published: "2026-11-21",
    modified: "2026-11-21",
  },
  {
    slug: "czy-kupujacy-placi-prowizje-biuru-nieruchomosci",
    title: "Czy kupujący płaci prowizję biuru nieruchomości? Zasady i stawki 2026",
    h1: "Czy kupujący płaci prowizję biuru nieruchomości?",
    description: "Kiedy kupujący płaci prowizję biuru nieruchomości, ile wynosi i jak jej uniknąć. Stawki dla kupujących z cenników biur i co sprawdzić przed podpisem.",
    category: "Poradnik",
    keyword: "prowizję biuru nieruchomości",
    published: "2026-11-21",
    modified: "2026-11-21",
  },
  {
    slug: "prowizja-za-wynajem-mieszkania",
    title: "Prowizja za wynajem mieszkania: kto płaci i ile wynosi w 2026",
    h1: "Prowizja za wynajem mieszkania: kto płaci i ile wynosi",
    description: "Ile biuro bierze za wynajem mieszkania i kto płaci prowizję: właściciel czy najemca. Stawki z cenników biur, koszt zarządzania najmem, przykłady w złotych.",
    category: "Poradnik",
    keyword: "prowizja za wynajem mieszkania",
    published: "2026-11-21",
    modified: "2026-11-21",
  },
  {
    slug: "ocena-5-w-google-biuro-nieruchomosci",
    title: "Ocena 5,0 w Google: czy to znaczy, że biuro nieruchomości jest najlepsze?",
    h1: "Ocena 5,0 w Google. Czy to znaczy, że biuro jest najlepsze?",
    description: "Jak czytać oceny Google biur nieruchomości: dlaczego 5,0 z kilku opinii mówi mniej niż 4,8 ze stu i na co patrzeć zamiast gwiazdek. Dane z katalogu.",
    category: "Poradnik",
    keyword: "ocena 5,0 w Google",
    published: "2026-11-21",
    modified: "2026-11-21",
  },
  {
    slug: "siec-czy-lokalne-biuro-nieruchomosci",
    title: "Sieć czy lokalne biuro nieruchomości? Porównanie opinii i stażu",
    h1: "Sieć czy lokalne biuro nieruchomości?",
    description: "Biura z jednego miasta i firmy obecne w wielu miastach: oceny Google, liczba opinii, staż i jawność cenników. Lista firm z największym zasięgiem.",
    category: "Porównania",
    keyword: "lokalne biuro nieruchomości",
    published: "2026-11-21",
    modified: "2026-11-21",
  },
  {
    slug: "najdluzej-dzialajace-biura-nieruchomosci",
    title: "Najdłużej działające biura nieruchomości w Polsce (dane z KRS i VAT)",
    h1: "Najdłużej działające biura nieruchomości w Polsce",
    description: "Które biura nieruchomości są najdłużej w rejestrach, jak długo działa typowe biuro i ile jest nowych firm. Daty rejestracji z KRS i wykazu podatników VAT.",
    category: "Dane",
    keyword: "najdłużej działające biura nieruchomości",
    published: "2026-11-21",
    modified: "2026-11-21",
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
