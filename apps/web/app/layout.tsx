import type { Metadata } from "next";
import "./globals.css";
import PulseTracker from "@/components/PulseTracker";
import { SITE_NAME, SITE_URL } from "@/lib/format";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} w Polsce`, template: `%s | ${SITE_NAME}` },
  description:
    "Katalog zweryfikowanych biur nieruchomości w Polsce, podzielony na miasta. Dane z rejestrów i stron firm, jawna metodologia.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
        />
      </head>
      <body>
        {children}
        <PulseTracker />
      </body>
    </html>
  );
}
