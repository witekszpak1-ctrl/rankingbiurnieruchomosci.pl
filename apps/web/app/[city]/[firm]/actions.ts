"use server";

import { randomUUID } from "node:crypto";

import { redirect } from "next/navigation";
import { after } from "next/server";

import { SITE_URL } from "@/lib/format";
import { metaContext, sendMetaEvent } from "@/lib/meta-capi";

import { LEADS_PER_EMAIL_PER_HOUR, LEADS_PER_HOUR, countRecentLeads, insertLead, validateLead } from "@/lib/leads";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PATH_RE = /^\/[a-z0-9-]+\/[a-z0-9-]+$/;

/** Zapytanie klienta ze strony firmy. Trafia do panelu admina. Wynik wraca w adresie (?sent=1 albo ?error=kod). */
export async function submitLeadAction(formData: FormData) {
  const listingId = String(formData.get("listing") ?? "");
  const back = String(formData.get("back") ?? "");
  const path = PATH_RE.test(back) ? back : "/";
  // Pole-pułapka dla botów: udajemy sukces, nic nie zapisujemy.
  if (String(formData.get("website") ?? "").trim() !== "") redirect(`${path}?sent=1#zapytanie`);
  if (!UUID_RE.test(listingId)) redirect(`${path}?error=server#zapytanie`);

  const result = validateLead(Object.fromEntries(formData.entries()));
  if (!result.ok) redirect(`${path}?error=${result.code}#zapytanie`);

  let outcome: "ok" | "limit" | "server" = "ok";
  try {
    const recent = await countRecentLeads(result.value.email);
    if (recent.total >= LEADS_PER_HOUR || recent.byEmail >= LEADS_PER_EMAIL_PER_HOUR) outcome = "limit";
    else if (!(await insertLead(listingId, result.value))) outcome = "server";
  } catch (error) {
    console.error("Zapis zapytania nie powiódł się", error instanceof Error ? error.message : error);
    outcome = "server";
  }
  if (outcome === "ok") {
    // Konwersja do Meta Conversions API (tylko za zgodą na marketing): e-mail, telefon i imię jako skróty SHA-256.
    const eventId = randomUUID();
    const url = `${SITE_URL}${path}`;
    const context = await metaContext(url).catch(() => null);
    if (context?.allowed) {
      const { email, phone, name } = result.value;
      after(() => sendMetaEvent(context, { name: "Lead", eventId, url, user: { email, phone, firstName: name } }));
      redirect(`${path}?sent=1&eid=${eventId}#zapytanie`);
    }
    redirect(`${path}?sent=1#zapytanie`);
  }
  redirect(`${path}?error=${outcome}#zapytanie`);
}
