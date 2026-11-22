/**
 * Wpisy bloga pokazywane w innych miejscach serwisu (profil biura, strona miasta, strona główna).
 * Dobór jest celowy i stały dla danej strony: najpierw artykuły pasujące do biura albo miasta, potem uzupełnienie
 * wybrane na podstawie adresu strony (różne profile dostają różne zestawy, ale ten sam profil zawsze ten sam).
 * Wpisy ukryte w panelu nie są pokazywane.
 */
import { unstable_cache } from "next/cache";

import { BLOG_POSTS, blogPath, type BlogPost } from "./blog";
import { cityPairs, loadBlogData } from "./blog-stats";
import { seedOf } from "./pair-content";

export type BlogLinkItem = { href: string; title: string; kicker: string };
export type PairLink = { slug: string; a: { slug: string; name: string }; b: { slug: string; name: string } };

/** Lista porównań miast (lekka, z pamięci podręcznej na 6 godzin), żeby profile nie liczyły statystyk bloga. */
export const blogPairLinks = unstable_cache(
  async (): Promise<PairLink[]> => {
    const data = await loadBlogData();
    return cityPairs(data.cities).map((p) => ({ slug: p.slug, a: { slug: p.a.slug, name: p.a.name }, b: { slug: p.b.slug, name: p.b.name } }));
  },
  ["blog-pair-links-v1"],
  { revalidate: 21600 },
);

const postItem = (p: BlogPost): BlogLinkItem => ({ href: blogPath(p.slug), title: p.h1, kicker: p.category === "Dane" ? "Dane z katalogu" : p.category });
const pairItem = (p: PairLink): BlogLinkItem => ({ href: blogPath(`porownanie/${p.slug}`), title: `${p.a.name} czy ${p.b.name}? Biura nieruchomości w liczbach`, kicker: "Porównanie miast" });

/** Uzupełnia listę o kolejne wpisy w kolejności zależnej od `seed` (bez powtórzeń). */
function fill(chosen: string[], pool: BlogPost[], limit: number, seed: number): string[] {
  const rest = pool.filter((p) => !chosen.includes(p.slug));
  const start = rest.length ? seed % rest.length : 0;
  const rotated = [...rest.slice(start), ...rest.slice(0, start)];
  return [...chosen, ...rotated.map((p) => p.slug)].slice(0, limit);
}

export type FirmContext = {
  slug: string;
  citySlug: string;
  hasPublicPrices: boolean;
  services: string[];
  googleRating: number | null;
  googleCount: number | null;
  registryYears: number | null;
  citiesCount: number;
};

/** Do 3 artykułów dopasowanych do biura i jedno porównanie jego miasta z innym. */
export function firmBlogLinks(f: FirmContext, pairs: PairLink[], hidden: Set<string>, limit = 3): BlogLinkItem[] {
  const pool = BLOG_POSTS.filter((p) => !hidden.has(p.slug));
  const has = (slug: string) => pool.some((p) => p.slug === slug);
  const wanted: string[] = [];
  const add = (slug: string, when: boolean) => when && has(slug) && !wanted.includes(slug) && wanted.push(slug);
  add("sprzedaz-mieszkania-z-biurem-czy-samemu", f.hasPublicPrices);
  add("prowizja-za-wynajem-mieszkania", f.services.some((s) => /wynaj|najem|najm/i.test(s)));
  add("ocena-5-w-google-biuro-nieruchomosci", f.googleRating != null && ((f.googleCount ?? 0) < 10 || f.googleRating >= 5));
  add("siec-czy-lokalne-biuro-nieruchomosci", f.citiesCount > 1);
  add("najdluzej-dzialajace-biura-nieruchomosci", (f.registryYears ?? 0) >= 15);
  const seed = seedOf(`${f.citySlug}/${f.slug}`);
  const slugs = fill(wanted.slice(0, limit), pool, limit, seed);
  const items = slugs.map((s) => postItem(pool.find((p) => p.slug === s) as BlogPost));
  const cityPairsList = pairs.filter((p) => (p.a.slug === f.citySlug || p.b.slug === f.citySlug) && !hidden.has(`porownanie-${p.slug}`));
  if (cityPairsList.length) items.push(pairItem(cityPairsList[seed % cityPairsList.length]));
  return items;
}

/** Porównania miasta z innymi (do 3) i dwa artykuły z danymi o miastach. */
export function cityBlogLinks(citySlug: string, pairs: PairLink[], hidden: Set<string>): BlogLinkItem[] {
  const seed = seedOf(citySlug);
  const own = pairs.filter((p) => (p.a.slug === citySlug || p.b.slug === citySlug) && !hidden.has(`porownanie-${p.slug}`));
  const start = own.length ? seed % own.length : 0;
  const pairItems = [...own.slice(start), ...own.slice(0, start)].slice(0, 3).map(pairItem);
  const pool = BLOG_POSTS.filter((p) => !hidden.has(p.slug));
  const posts = fill(
    ["oceny-biur-nieruchomosci-w-miastach", "biura-nieruchomosci-w-najwiekszych-miastach"].filter((s) => pool.some((p) => p.slug === s)),
    pool.filter((p) => p.category === "Poradnik"),
    3,
    seed,
  ).map((s) => postItem(pool.find((p) => p.slug === s) as BlogPost));
  return [...pairItems, ...posts];
}

/** Najnowsze wpisy (strona główna). */
export function latestBlogLinks(hidden: Set<string>, limit = 3, published: (p: BlogPost) => string = (p) => p.published): BlogLinkItem[] {
  return BLOG_POSTS.filter((p) => !hidden.has(p.slug))
    .sort((a, b) => (published(b) > published(a) ? 1 : published(b) < published(a) ? -1 : a.slug.localeCompare(b.slug)))
    .slice(0, limit)
    .map(postItem);
}
