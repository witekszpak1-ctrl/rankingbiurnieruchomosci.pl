"use server";

import { redirect } from "next/navigation";

import {
  LIMIT_PER_EMAIL_PER_HOUR,
  LIMIT_PER_HOUR,
  countRecentRequests,
  insertRequest,
  validateRequestInput,
} from "@/lib/requests";

/** Formularz zgłoszeń. Wynik wraca w adresie (?sent=1 albo ?error=kod), bez odbijania treści wpisanej przez użytkownika. */
export async function submitRequestAction(formData: FormData) {
  // Pole-pułapka: człowiek go nie widzi. Boty, które je wypełnią, dostają "sukces", ale nic nie zapisujemy.
  if (String(formData.get("website") ?? "").trim() !== "") redirect("/dla-firm?sent=1");

  const result = validateRequestInput({
    kind: formData.get("kind"),
    nip: formData.get("nip"),
    email: formData.get("email"),
    message: formData.get("message"),
  });
  if (!result.ok) redirect(`/dla-firm?error=${result.code}#formularz`);

  let outcome: "ok" | "limit" | "server" = "ok";
  try {
    const recent = await countRecentRequests(result.value.email);
    if (recent.total >= LIMIT_PER_HOUR || recent.byEmail >= LIMIT_PER_EMAIL_PER_HOUR) {
      outcome = "limit";
    } else {
      await insertRequest(result.value);
    }
  } catch (error) {
    console.error("Zapis zgłoszenia nie powiódł się", error instanceof Error ? error.message : error);
    outcome = "server";
  }
  // redirect() rzuca wyjątek, więc musi być poza blokiem try
  if (outcome === "ok") redirect("/dla-firm?sent=1#formularz");
  redirect(`/dla-firm?error=${outcome}#formularz`);
}
