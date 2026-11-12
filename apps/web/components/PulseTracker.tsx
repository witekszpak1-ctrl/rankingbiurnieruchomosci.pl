"use client";

import Script from "next/script";

import { useConsent } from "@/components/CookieConsent";

/**
 * Licznik „Statystyki stron” z CRM (bez ciasteczek): odsłony, źródła wejść i czas na stronie.
 * Wczytuje się dopiero po zgodzie na kategorię „Statystyczne” w banerze plików cookie.
 * Boty zgłasza osobno serwer strony (lib/pulse-bots.ts), bo nie uruchamiają JavaScriptu.
 * Tylko na produkcji, żeby lokalne testy nie liczyły się do statystyk.
 */
export default function PulseTracker() {
  const consent = useConsent();
  if (process.env.NODE_ENV !== "production" || !consent?.statistics) return null;
  return (
    <Script
      id="pulse"
      src="https://witekcrm.com/api/public/pulse/s.js"
      data-site="ws_65be8380404a2bd8"
      strategy="afterInteractive"
    />
  );
}
