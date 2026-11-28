"use server";

import { redirect } from "next/navigation";

import { setUserAdmin } from "@/lib/admin-repo";
import { parsePortalForm } from "@/lib/master";
import { updatePortal } from "@/lib/master-repo";
import { UUID_RE } from "@/lib/admin-stats";
import { requireAdmin } from "@/lib/auth";

function field(form: FormData, name: string, max = 60): string {
  const v = form.get(name);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** Nadanie albo odebranie uprawnień administratora. Tylko administrator, nigdy dla własnego konta. */
export async function toggleAdminAction(form: FormData): Promise<void> {
  const me = await requireAdmin("/admin/uzytkownicy");
  const userId = field(form, "userId");
  const makeAdmin = field(form, "makeAdmin") === "1";
  if (!UUID_RE.test(userId)) redirect("/admin/uzytkownicy?error=" + encodeURIComponent("Niepoprawny użytkownik."));
  if (userId === me.id) {
    redirect("/admin/uzytkownicy?error=" + encodeURIComponent("Nie możesz zmienić własnych uprawnień administratora."));
  }
  const ok = await setUserAdmin(userId, makeAdmin);
  if (!ok) redirect("/admin/uzytkownicy?error=" + encodeURIComponent("Nie znaleziono użytkownika."));
  redirect(`/admin/uzytkownicy?ok=${makeAdmin ? "nadano" : "odebrano"}`);
}

/** Edycja rejestru portali (domena, status, notatki). Tylko administrator; slug z ukrytego pola jest walidowany. */
export async function updatePortalAction(form: FormData): Promise<void> {
  await requireAdmin("/admin/portale");
  const slug = field(form, "slug", 40);
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) redirect("/admin/portale?error=" + encodeURIComponent("Niepoprawny portal."));
  const parsed = parsePortalForm({ domain: field(form, "domain", 300), status: field(form, "status", 20), notes: field(form, "notes", 1000) });
  if (!parsed.ok) redirect("/admin/portale?error=" + encodeURIComponent(parsed.error));
  let ok = false;
  try {
    ok = await updatePortal(slug, { domain: parsed.domain, status: parsed.status, notes: parsed.notes });
  } catch {
    redirect("/admin/portale?error=" + encodeURIComponent("Zapis nie powiódł się (czy migracja 0005 jest zastosowana?)."));
  }
  if (!ok) redirect("/admin/portale?error=" + encodeURIComponent("Nie znaleziono portalu."));
  redirect(`/admin/portale?ok=${encodeURIComponent(slug)}`);
}
