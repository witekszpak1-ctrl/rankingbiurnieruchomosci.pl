import { query } from "./db";

export const LEAD_TOPICS = ["kupno", "sprzedaz", "wynajem", "najem", "wycena", "inne"] as const;
export type LeadTopic = (typeof LEAD_TOPICS)[number];
export const TOPIC_LABEL: Record<LeadTopic, string> = {
  kupno: "Chcę kupić",
  sprzedaz: "Chcę sprzedać",
  wynajem: "Chcę wynająć (szukam mieszkania)",
  najem: "Chcę oddać w najem",
  wycena: "Wycena nieruchomości",
  inne: "Inna sprawa",
};
export const LEADS_PER_HOUR = 60;
export const LEADS_PER_EMAIL_PER_HOUR = 5;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type LeadInput = { topic: LeadTopic; name: string; email: string; phone: string | null; message: string };
export type LeadError = "topic" | "name" | "email" | "phone" | "message" | "consent";

export function validateLead(raw: Record<string, unknown>): { ok: true; value: LeadInput } | { ok: false; code: LeadError } {
  const topic = String(raw.topic ?? "");
  if (!(LEAD_TOPICS as readonly string[]).includes(topic)) return { ok: false, code: "topic" };
  const name = String(raw.name ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 100) return { ok: false, code: "name" };
  const email = String(raw.email ?? "").trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) return { ok: false, code: "email" };
  const phoneRaw = String(raw.phone ?? "").trim();
  const phone = phoneRaw ? phoneRaw.replace(/[^\d+ ()-]/g, "").slice(0, 30) : "";
  if (phoneRaw && phone.replace(/\D/g, "").length < 9) return { ok: false, code: "phone" };
  const message = String(raw.message ?? "").replace(/\r\n/g, "\n").trim();
  if (message.length < 10 || message.length > 2000) return { ok: false, code: "message" };
  if (String(raw.consent ?? "") !== "on") return { ok: false, code: "consent" };
  return { ok: true, value: { topic: topic as LeadTopic, name, email, phone: phone || null, message } };
}

export async function countRecentLeads(email: string): Promise<{ total: number; byEmail: number }> {
  const rows = await query<{ total: number; byEmail: number }>(
    `select count(*)::int as total, (count(*) filter (where email = $1))::int as "byEmail"
     from leads where created_at > now() - interval '1 hour'`,
    [email],
  );
  return rows[0] ?? { total: 0, byEmail: 0 };
}

export async function insertLead(listingId: string, value: LeadInput): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `insert into leads (listing_id, brand_id, topic, name, email, phone, message)
     select l.id, l.brand_id, $2, $3, $4, $5, $6 from listings l where l.id = $1 and l.status = 'published'
     returning id`,
    [listingId, value.topic, value.name, value.email, value.phone, value.message],
  );
  return rows.length > 0;
}

export type LeadRow = {
  id: string;
  topic: LeadTopic;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  status: "new" | "done";
  createdAt: Date;
  handledBy: string | null;
  brandName: string | null;
  listingId: string | null;
  citySlug: string | null;
  slug: string | null;
  cityName: string | null;
};

export async function listLeads(status: string): Promise<LeadRow[]> {
  return query<LeadRow>(
    `select le.id, le.topic, le.name, le.email, le.phone, le.message, le.status, le.created_at as "createdAt",
            le.handled_by as "handledBy", b.name as "brandName", l.id as "listingId", c.slug as "citySlug",
            l.slug, c.name as "cityName"
     from leads le
     left join brands b on b.id = le.brand_id
     left join listings l on l.id = le.listing_id
     left join cities c on c.id = l.city_id
     where ($1::text = '' or le.status = $1)
     order by (le.status = 'new') desc, le.created_at desc limit 300`,
    [status],
  );
}

/** Liczba nowych zapytań do menu i przeglądu. Gdy tabeli jeszcze nie ma, zwraca 0. */
export async function countNewLeads(): Promise<number> {
  try {
    const rows = await query<{ n: number }>("select count(*)::int as n from leads where status = 'new'");
    return rows[0]?.n ?? 0;
  } catch {
    return 0;
  }
}
