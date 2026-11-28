import Link from "next/link";

import { CookieSettingsLink } from "@/components/CookieConsent";
import { Logo, LogoMark } from "@/components/Logo";
import { MobileNav } from "@/components/MobileNav";
import { listCities } from "@/lib/catalog";
import { operator } from "@/lib/legal";
import { SITE_NAME } from "@/lib/format";
import { capitalize, currentPortal, firmPhrase } from "@/lib/portal";

export { Logo, LogoMark };

export function SiteHeader() {
  const { texts } = currentPortal();
  return (
    <header className="site-header">
      <div className="wrap header-inner">
        <Link className="brand" href="/" title={`${SITE_NAME}: strona główna`}>
          <Logo />
        </Link>
        <nav className="nav" aria-label="Główna nawigacja">
          <Link href="/miasta">Miasta</Link>
          <Link href="/ranking">Ranking</Link>
          <Link href="/blog">Blog</Link>
          <Link href="/metodologia">Jak oceniamy</Link>
          <Link href="/dla-firm">{texts.navForFirms}</Link>
        </nav>
        <Link className="header-cta" href="/#szukaj">
          {texts.headerCta}
        </Link>
        <MobileNav />
      </div>
    </header>
  );
}

export async function SiteFooter() {
  const cities = await listCities().catch(() => []);
  const op = operator();
  const { texts } = currentPortal();
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div className="footer-about">
          <Link className="brand" href="/" title={`${SITE_NAME}: strona główna`}>
            <Logo />
          </Link>
          <p>{texts.footerAbout}</p>
        </div>
        <div>
          <h3>Miasta</h3>
          <ul>
            {cities.slice(0, 8).map((c) => (
              <li key={c.slug}>
                <Link href={`/${c.slug}`}>{`${capitalize(firmPhrase("few"))} `}{c.name}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Katalog</h3>
          <ul>
            {texts.footerCatalogLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href}>{l.label}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>{texts.footerForFirmsHeading}</h3>
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
          © {new Date().getFullYear()} {SITE_NAME}. Administrator serwisu: {op.name}
          {op.address && <>, {op.address}</>}
          {op.nip && <>, NIP {op.nip}</>}
          {op.regNo && <>, nr rej. {op.regNo}</>}
          {op.email && (
            <>
              , <a href={`mailto:${op.email}`}>{op.email}</a>
            </>
          )}
        </span>
        <nav className="footer-legal" aria-label="Informacje prawne">
          <Link href="/o-nas">O nas</Link>
          <Link href="/kontakt">Kontakt</Link>
          <Link href="/regulamin">Regulamin</Link>
          <Link href="/polityka-prywatnosci">Polityka prywatności</Link>
          <CookieSettingsLink />
        </nav>
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
