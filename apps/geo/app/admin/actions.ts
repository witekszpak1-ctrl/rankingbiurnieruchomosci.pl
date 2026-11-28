"use server";

import { redirect } from "next/navigation";

import { setUserAdmin } from "@/lib/admin-repo";
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
