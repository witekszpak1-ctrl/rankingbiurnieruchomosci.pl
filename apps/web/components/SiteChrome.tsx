import Link from "next/link";

import { listCities } from "@/lib/catalog";
import { SITE_NAME } from "@/lib/format";

export function Logo() {
  return (
    <span className="logo-mark" aria-hidden="true">
      <svg viewBox="0 0 32 32">
        <rect width="32" height="32" rx="9" fill="currentColor" />
        <path d="M8 22V14l8-6 8 6v8" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinejoin="round" />
        <path d="M13 22v-5h6v5" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="wrap header-inner">
        <Link className="brand" href="/">
          <Logo />
          <span>{SITE_NAME}</span>
        </Link>
        <nav className="nav" aria-label="Główna nawigacja">
          <Link href="/#miasta">Miasta</Link>
          <Link href="/ranking">Ranking</Link>
          <Link href="/metodologia">Jak oceniamy</Link>
          <Link href="/dla-firm">Dla biur</Link>
        </nav>
        <Link className="header-cta" href="/#szukaj">
          Znajdź biuro
        </Link>
      </div>
    </header>
  );
}

export async function SiteFooter() {
  const cities = await listCities().catch(() => []);
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div className="footer-about">
          <Link className="brand" href="/">
            <Logo />
            <span>{SITE_NAME}</span>
          </Link>
          <p>
            Niezależny katalog biur nieruchomości. Dane pochodzą z rejestrów publicznych (KRS, wykaz podatników VAT) i ze
            stron firm. Płatność nie wpływa na pozycję w rankingu.
          </p>
        </div>
        <div>
          <h3>Miasta</h3>
          <ul>
            {cities.slice(0, 8).map((c) => (
              <li key={c.slug}>
                <Link href={`/${c.slug}`}>Biura nieruchomości {c.name}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Katalog</h3>
          <ul>
            <li>
              <Link href="/ranking">Najlepsze biura w Polsce</Link>
            </li>
            <li>
              <Link href="/oferty">Aktualne oferty biur</Link>
            </li>
            <li>
              <Link href="/metodologia">Jak powstaje ranking</Link>
            </li>
          </ul>
        </div>
        <div>
          <h3>Dla biur</h3>
          <ul>
            <li>
              <Link href="/dla-firm">Korekta lub usunięcie wpisu</Link>
            </li>
            <li>
              <Link href="/reklama">Reklama i niezależność</Link>
            </li>
            <li>
              <Link href="/bot">Informacje o robocie</Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="wrap footer-bottom">
        <span>
          © {new Date().getFullYear()} {SITE_NAME}
        </span>
        <span>Opisy przygotowujemy z faktów ze źródeł i oznaczamy datą aktualizacji.</span>
      </div>
    </footer>
  );
}

export function PublicShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <>
      <SiteHeader />
      <main className={wide ? "main-wide" : "wrap"}>{children}</main>
      <SiteFooter />
    </>
  );
}

export function JsonLd({ data }: { data: unknown }) {
  // Dane pochodzą z naszej bazy, ale na wszelki wypadek neutralizujemy znak "<" w JSON-LD.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
