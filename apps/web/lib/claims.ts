import { query } from "./db";
import { isValidNip } from "./requests";

export const CLAIM_WANTS = ["claim", "update", "remove", "other"] as const;
export type ClaimWant = (typeof CLAIM_WANTS)[number];
export const WANT_LABEL: Record<ClaimWant, string> = {
  claim: "Chcę przejąć i uzupełnić profil firmy",
  update: "Chcę poprawić dane firmy",
  remove: "Chcę usunąć firmę z katalogu",
  other: "Inna sprawa",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type ClaimInput = {
  name: string;
  role: string | null;
  email: string;
  phone: string | null;
  nip: string | null;
  wants: ClaimWant;
  message: string | null;
};
export type ClaimError = "name" | "email" | "phone" | "nip" | "wants" | "message" | "consent";

export function validateClaim(raw: Record<string, unknown>): { ok: true; value: ClaimInput } | { ok: false; code: ClaimError } {
  const wants = String(raw.wants ?? "");
  if (!(CLAIM_WANTS as readonly string[]).includes(wants)) return { ok: false, code: "wants" };
  const name = String(raw.name ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 120) return { ok: false, code: "name" };
  const role = String(raw.role ?? "").trim().slice(0, 80) || null;
  const email = String(raw.email ?? "").trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) return { ok: false, code: "email" };
  const phoneRaw = String(raw.phone ?? "").trim();
  const phone = phoneRaw.replace(/[^\d+ ()-]/g, "").slice(0, 30);
  if (phone.replace(/\D/g, "").length < 9) return { ok: false, code: "phone" };
  const nip = String(raw.nip ?? "").replace(/[\s-]/g, "");
  if (nip && !isValidNip(nip)) return { ok: false, code: "nip" };
  const message = String(raw.message ?? "").replace(/\r\n/g, "\n").trim();
  if (message.length > 2000) return { ok: false, code: "message" };
  if (String(raw.consent ?? "") !== "on") return { ok: false, code: "consent" };
  return { ok: true, value: { name, role, email, phone, nip: nip || null, wants: wants as ClaimWant, message: message || null } };
}

export async function countRecentClaims(email: string): Promise<{ total: number; byEmail: number }> {
  const rows = await query<{ total: number; byEmail: number }>(
    `select count(*)::int as total, (count(*) filter (where email = $1))::int as "byEmail"
     from owner_claims where created_at > now() - interval '1 hour'`,
    [email],
  );
  return rows[0] ?? { total: 0, byEmail: 0 };
}

export async function insertClaim(listingId: string, v: ClaimInput): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `insert into owner_claims (listing_id, brand_id, name, role, email, phone, nip, wants, message)
     select l.id, l.brand_id, $2, $3, $4, $5, $6, $7, $8 from listings l where l.id = $1 returning id`,
    [listingId, v.name, v.role, v.email, v.phone, v.nip, v.wants, v.message],
  );
  return rows.length > 0;
}

export type ClaimRow = ClaimInput & {
  id: string;
  status: "new" | "done" | "rejected";
  createdAt: Date;
  brandName: string | null;
  listingId: string | null;
  cityName: string | null;
  registryNip: string | null;
};

export async function listClaims(status: string): Promise<ClaimRow[]> {
  return query<ClaimRow>(
    `select oc.id, oc.name, oc.role, oc.email, oc.phone, oc.nip, oc.wants, oc.message, oc.status,
            oc.created_at as "createdAt", b.name as "brandName", l.id as "listingId", c.name as "cityName",
            le.nip as "registryNip"
     from owner_claims oc
     left join brands b on b.id = oc.brand_id
     left join legal_entities le on le.id = b.legal_entity_id
     left join listings l on l.id = oc.listing_id
     left join cities c on c.id = l.city_id
     where ($1::text = '' or oc.status = $1)
     order by (oc.status = 'new') desc, oc.created_at desc limit 300`,
    [status],
  );
}

export async function countNewClaims(): Promise<number> {
  try {
    const rows = await query<{ n: number }>("select count(*)::int as n from owner_claims where status = 'new'");
    return rows[0]?.n ?? 0;
  } catch {
    return 0;
  }
}

export async function getClaimTarget(listingId: string): Promise<{ id: string; name: string; cityName: string; path: string } | null> {
  const rows = await query<{ id: string; name: string; cityName: string; citySlug: string; slug: string }>(
    `select l.id, b.name, c.name as "cityName", c.slug as "citySlug", l.slug from listings l
     join brands b on b.id = l.brand_id join cities c on c.id = l.city_id
     where l.id = $1 and l.status = 'published'`,
    [listingId],
  );
  const r = rows[0];
  return r ? { id: r.id, name: r.name, cityName: r.cityName, path: `/${r.citySlug}/${r.slug}` } : null;
}
