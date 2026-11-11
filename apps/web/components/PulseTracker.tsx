import Script from "next/script";

/**
 * Licznik „Statystyki stron” z CRM (bez ciasteczek): odsłony, źródła wejść i czas na stronie.
 * Boty zgłasza osobno serwer strony (lib/pulse-bots.ts w proxy.ts), bo nie uruchamiają JavaScriptu.
 * Tylko na produkcji, żeby lokalne testy nie liczyły się do statystyk (jak w Analytics).
 */
export default function PulseTracker() {
  if (process.env.NODE_ENV !== "production") return null;
  return (
    <Script
      id="pulse"
      src="https://witekcrm.com/api/public/pulse/s.js"
      data-site="ws_65be8380404a2bd8"
      strategy="afterInteractive"
    />
  );
}
