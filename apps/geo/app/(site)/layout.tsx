import Link from "next/link";
import type { ReactNode } from "react";

import { Icon, LogoMark } from "@/components/ui/Icon";

/** Nagłówek i stopka stron publicznych (strona główna, audyt, logowanie, program partnerski). */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="site-h">
        <div className="wrap">
          <Link href="/" className="logo">
            <LogoMark />
            GeoTrace
          </Link>
          <nav className="site-nav" aria-label="Główna nawigacja">
            <Link href="/#jak">Jak to działa</Link>
            <Link href="/#cennik">Cennik</Link>
            <Link href="/partner">Program partnerski</Link>
            <Link href="/#faq">Pytania</Link>
          </nav>
          <div className="site-cta">
            <Link href="/panel" className="btn ghost sm">
              Moje konto
            </Link>
            <Link href="/audyt" className="btn sm">
              Sprawdź audyt <Icon name="arrow" size={14} />
            </Link>
          </div>
        </div>
      </header>
      {children}
      <footer className="site-f">
        <div className="wrap">
          <div className="f-grid">
            <div>
              <Link href="/" className="logo">
                <LogoMark />
                GeoTrace
              </Link>
              <p className="muted small" style={{ marginTop: 12, maxWidth: "38ch" }}>
                Mierzymy, czy asystenci AI polecają Twoją firmę, kogo polecają zamiast niej i z jakich źródeł korzystają.
              </p>
            </div>
            <div>
              <h4>Produkt</h4>
              <Link href="/audyt">Darmowy audyt</Link>
              <Link href="/#jak">Jak to działa</Link>
              <Link href="/#cennik">Cennik</Link>
            </div>
            <div>
              <h4>Program partnerski</h4>
              <Link href="/partner">Zasady</Link>
              <Link href="/partner/dolacz">Dołącz</Link>
            </div>
            <div>
              <h4>Konto</h4>
              <Link href="/logowanie">Logowanie</Link>
              <Link href="/rejestracja">Załóż konto</Link>
            </div>
          </div>
          <div className="f-bot">
            <span>GeoTrace (nazwa robocza, geotrace.pl). Wersja robocza platformy.</span>
            <span>Pomiary: Gemini, Google AI Mode, Google AI Overview.</span>
          </div>
        </div>
      </footer>
    </>
  );
}
