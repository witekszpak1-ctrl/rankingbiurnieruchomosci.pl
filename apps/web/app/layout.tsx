import type { Metadata } from "next";
// Czcionka Inter z naszego serwera (bez łączenia przeglądarki z Google Fonts).
import "@fontsource-variable/inter";
import "./globals.css";
import { CookieConsent } from "@/components/CookieConsent";
import PulseTracker from "@/components/PulseTracker";
import { SITE_NAME, SITE_URL } from "@/lib/format";

// Wdrożenia podglądowe Vercel (preview) nie mogą konkurować z produkcją w wynikach wyszukiwania.
const isPreview = process.env.VERCEL_ENV !== undefined && process.env.VERCEL_ENV !== "production";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} w Polsce`, template: `%s | ${SITE_NAME}` },
  description:
    "Niezależny ranking biur nieruchomości w Polsce. Porównaj agencje w swoim mieście: prowizje, zakres usług, oferty i dane z rejestrów.",
  applicationName: SITE_NAME,
  openGraph: { siteName: SITE_NAME, locale: "pl_PL", type: "website" },
  twitter: { card: "summary_large_image" },
  ...(isPreview ? { robots: { index: false, follow: false } } : {}),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <head>
        {/* Zmniejszone obrazki firm (lib/images.ts) */}
        <link rel="preconnect" href="https://wsrv.nl" />
      </head>
      <body>
        {children}
        <CookieConsent />
        <PulseTracker />
      </body>
    </html>
  );
}
