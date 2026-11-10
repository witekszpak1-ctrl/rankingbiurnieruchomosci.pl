"use server";

import { redirect } from "next/navigation";

import { login } from "@/lib/admin-auth";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const ok = await login(email, password);
  if (!ok) {
    // opóźnienie utrudnia zgadywanie hasła; pełny limit prób dojdzie razem z zaporą na brzegu (Cloudflare)
    await new Promise((resolve) => setTimeout(resolve, 600));
    redirect("/admin/login?error=1");
  }
  redirect("/admin");
}
