/**
 * Ustawienia wpisów bloga zmieniane w panelu (/admin/blog): data wpisu i ukrycie wpisu.
 * Trzymane w settings pod kluczem "blog_overrides" jako { [slug]: { published?: "RRRR-MM-DD", hidden?: true } },
 * więc nie wymagają migracji. Treść artykułów jest w kodzie (app/blog/<slug>/page.tsx).
 */
import { cache } from "react";

import { query } from "./db";

export const BLOG_OVERRIDES_KEY = "blog_overrides";

export type BlogOverride = { published?: string; hidden?: boolean };
export type BlogOverrides = Record<string, BlogOverride>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Bez bazy (np. przy budowaniu) zwraca pusty obiekt: strona działa wtedy z danymi z lib/blog.ts. */
export const getBlogOverrides = cache(async (): Promise<BlogOverrides> => {
  const rows = await query<{ value: unknown }>("select value from settings where key = $1", [BLOG_OVERRIDES_KEY]).catch(() => []);
  return cleanOverrides(rows[0]?.value);
});

export function cleanOverrides(value: unknown): BlogOverrides {
  if (!value || typeof value !== "object") return {};
  const out: BlogOverrides = {};
  for (const [slug, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!/^[a-z0-9-]+$/.test(slug) || !raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const o: BlogOverride = {};
    if (typeof r.published === "string" && DATE_RE.test(r.published)) o.published = r.published;
    if (r.hidden === true) o.hidden = true;
    if (o.published || o.hidden) out[slug] = o;
  }
  return out;
}

/** Wpis z nałożoną datą z panelu; data zmiany nigdy wcześniejsza niż data wpisu. */
export function withOverride<T extends { slug: string; published: string; modified: string }>(post: T, overrides: BlogOverrides): T {
  const o = overrides[post.slug];
  if (!o?.published) return post;
  return { ...post, published: o.published, modified: post.modified > o.published ? post.modified : o.published };
}

export const isHidden = (slug: string, overrides: BlogOverrides) => overrides[slug]?.hidden === true;
