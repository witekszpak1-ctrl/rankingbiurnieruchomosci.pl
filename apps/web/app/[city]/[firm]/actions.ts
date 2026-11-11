"use server";

import { redirect } from "next/navigation";

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
  if (outcome === "ok") redirect(`${path}?sent=1#zapytanie`);
  redirect(`${path}?error=${outcome}#zapytanie`);
}
