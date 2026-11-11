"use server";

import { redirect } from "next/navigation";

import { countRecentClaims, insertClaim, validateClaim } from "@/lib/claims";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Zgłoszenie właściciela firmy. Trafia do panelu admina (zakładka Zgłoszenia właścicieli). */
export async function submitClaimAction(formData: FormData) {
  const id = String(formData.get("listing") ?? "");
  if (!UUID_RE.test(id)) redirect("/");
  const path = `/wlasciciel/${id}`;
  if (String(formData.get("website") ?? "").trim() !== "") redirect(`${path}?sent=1`);
  const result = validateClaim(Object.fromEntries(formData.entries()));
  if (!result.ok) redirect(`${path}?error=${result.code}`);
  let outcome: "ok" | "limit" | "server" = "ok";
  try {
    const recent = await countRecentClaims(result.value.email);
    if (recent.total >= 30 || recent.byEmail >= 3) outcome = "limit";
    else if (!(await insertClaim(id, result.value))) outcome = "server";
  } catch (error) {
    console.error("Zapis zgłoszenia właściciela nie powiódł się", error instanceof Error ? error.message : error);
    outcome = "server";
  }
  if (outcome === "ok") redirect(`${path}?sent=1`);
  redirect(`${path}?error=${outcome}`);
}
