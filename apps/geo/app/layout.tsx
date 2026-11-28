import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: "GeoTrace: widoczność firmy w AI", template: "%s | GeoTrace" },
  description: "Sprawdź, czy ChatGPT i Gemini polecają Twoją firmę, i popraw to na podstawie pomiarów.",
  // Do czasu wyboru domeny i startu sprzedaży strona nie trafia do wyszukiwarek.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@600;700&display=swap"
        />
      </head>
      <body>
        <header className="site">
          <div className="wrap">
            <Link href="/" className="logo">GeoTrace</Link>
            <nav className="top">
              <Link href="/partner">Program partnerski</Link>
              <Link href="/panel">Moje konto</Link>
            </nav>
          </div>
        </header>
        <main>
          <div className="wrap">{children}</div>
        </main>
        <footer className="site">
          <div className="wrap">GeoTrace (nazwa robocza, geotrace.pl). Wersja robocza platformy.</div>
        </footer>
      </body>
    </html>
  );
}
