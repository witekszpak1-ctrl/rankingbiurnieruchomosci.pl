/**
 * Warstwa Premium profilu ("Informacje od firmy"): treści dostarczone przez firmę, pokazywane na profilu osobno od
 * danych zweryfikowanych przez katalog. Zasada (docs/ops/DECISIONS.md): Premium tylko odsłania więcej danych i nie
 * wpływa na wynik w rankingu. Ten moduł NIE jest importowany przez lib/ranking.ts ani lib/catalog.ts (pilnuje tego
 * tests/premium.test.ts), a RankingInput nie ma żadnych pól premium.
 *
 * Treść pochodzi z tabeli listing_premium (db/migrations/0022). Zapisuje ją kiedyś platforma GeoTrace, więc przy
 * odczycie każde pole jest walidowane i przycinane (zła treść nie psuje profilu). Brak tabeli (migracja jeszcze nie
 * nałożona) albo błąd bazy to po prostu brak warstwy Premium: profil renderuje się jak dotąd.
 */
import { query } from "./db";
import { getPublishedListing, type ListingDetail } from "./catalog";
import { inVertical } from "./vertical-scope";

export type PremiumStatus = "draft" | "published";

export type PremiumContent = {
  longDescription: string | null;
  specializations: string[];
  serviceAreas: string[];
  faq: { q: string; a: string }[];
  team: { name: string; role: string | null }[];
  gallery: { url: string; alt: string }[];
  videoUrl: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
};

export type Premium = { status: PremiumStatus; content: PremiumContent; approvedAt: Date | null; updatedAt: Date };

const LIMITS = {
  longDescription: 4000,
  listItems: 20,
  item: 120,
  faqItems: 10,
  question: 200,
  answer: 1200,
  teamItems: 12,
  galleryItems: 8,
  alt: 160,
  url: 600,
  cta: 60,
} as const;

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

/** Adres tylko http(s); inne schematy (javascript:, data:) są odrzucane. */
export function safeUrl(value: unknown): string | null {
  const raw = text(value, LIMITS.url);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function strings(value: unknown, max: number, count: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const t = text(item, max);
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= count) break;
  }
  return out;
}

function objects(value: unknown, count: number): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x)).slice(0, count);
}

/** Waliduje i przycina treść jsonb z bazy do postaci bezpiecznej do wyświetlenia. Nigdy nie rzuca. */
export function parsePremiumContent(raw: unknown): PremiumContent {
  const c = typeof raw === "object" && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const faq = objects(c.faq, LIMITS.faqItems).flatMap((f) => {
    const q = text(f.q, LIMITS.question);
    const a = text(f.a, LIMITS.answer);
    return q && a ? [{ q, a }] : [];
  });
  const team = objects(c.team, LIMITS.teamItems).flatMap((m) => {
    const name = text(m.name, LIMITS.item);
    return name ? [{ name, role: text(m.role, LIMITS.item) }] : [];
  });
  const gallery = objects(c.gallery, LIMITS.galleryItems).flatMap((g) => {
    const url = safeUrl(g.url);
    return url ? [{ url, alt: text(g.alt, LIMITS.alt) ?? "" }] : [];
  });
  const ctaUrl = safeUrl(c.cta_url);
  const ctaLabel = text(c.cta_label, LIMITS.cta);
  return {
    longDescription: text(c.long_description, LIMITS.longDescription),
    specializations: strings(c.specializations, LIMITS.item, LIMITS.listItems),
    serviceAreas: strings(c.service_areas, LIMITS.item, LIMITS.listItems),
    faq,
    team,
    gallery,
    videoUrl: safeUrl(c.video_url),
    // Przycisk działa tylko z adresem; sam adres dostaje domyślną etykietę w komponencie.
    ctaLabel: ctaUrl ? ctaLabel : null,
    ctaUrl,
  };
}

/** Czy treść zawiera cokolwiek do pokazania (pusty wiersz nie tworzy pustej sekcji). */
export function hasPremiumContent(c: PremiumContent): boolean {
  return Boolean(
    c.longDescription ||
      c.specializations.length ||
      c.serviceAreas.length ||
      c.faq.length ||
      c.team.length ||
      c.gallery.length ||
      c.videoUrl ||
      c.ctaUrl,
  );
}

type Row = { status: string; content: unknown; approvedAt: Date | null; updatedAt: Date };

/**
 * Wiersz Premium wpisu o wymaganym statusie. Profil publiczny pyta o "published", podgląd o "draft".
 * Błąd (np. brak tabeli przed nałożeniem migracji) daje null: profil bez warstwy Premium.
 */
export async function getPremium(listingId: string, status: PremiumStatus): Promise<Premium | null> {
  try {
    const rows = await query<Row>(
      `select status, content, approved_at as "approvedAt", updated_at as "updatedAt"
       from listing_premium where listing_id = $1 and status = $2`,
      [listingId, status],
    );
    const row = rows[0];
    if (!row) return null;
    const content = parsePremiumContent(row.content);
    if (!hasPremiumContent(content)) return null;
    return { status: row.status === "published" ? "published" : "draft", content, approvedAt: row.approvedAt, updatedAt: row.updatedAt };
  } catch {
    return null;
  }
}

/** Profil po identyfikatorze wpisu (podgląd Premium): wpis musi być opublikowany w branży tego portalu. */
export async function getListingForPreview(listingId: string): Promise<ListingDetail | null> {
  const rows = await query<{ citySlug: string; slug: string }>(
    `select c.slug as "citySlug", l.slug
     from listings l join cities c on c.id = l.city_id
     where l.id = $1 and l.status = 'published' and l.slug is not null and ${inVertical("l")}`,
    [listingId],
  );
  const row = rows[0];
  return row ? getPublishedListing(row.citySlug, row.slug) : null;
}
