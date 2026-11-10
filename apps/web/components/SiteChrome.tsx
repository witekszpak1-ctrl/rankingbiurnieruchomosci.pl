import Link from "next/link";
import { SITE_NAME } from "@/lib/format";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="wrap">
        <Link className="brand" href="/">
          {SITE_NAME}
        </Link>
        <nav className="nav" aria-label="Główna nawigacja">
          <Link href="/">Miasta</Link>
          <Link href="/metodologia">Metodologia</Link>
          <Link href="/dla-firm">Dla firm</Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <nav className="nav" aria-label="Informacje">
          <Link href="/metodologia">Metodologia rankingu</Link>
          <Link href="/reklama">Reklama i niezależność</Link>
          <Link href="/dla-firm">Korekta i usunięcie wpisu</Link>
          <Link href="/bot">Informacje o robocie</Link>
        </nav>
        <p>
          Dane pochodzą z rejestrów publicznych (KRS, wykaz podatników VAT) i ze stron internetowych firm. Opisy są
          przygotowywane z faktów ze źródeł i oznaczone datą aktualizacji.
        </p>
      </div>
    </footer>
  );
}

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="wrap">{children}</main>
      <SiteFooter />
    </>
  );
}

export function JsonLd({ data }: { data: unknown }) {
  // Dane pochodzą z naszej bazy, ale na wszelki wypadek neutralizujemy znak "<" w JSON-LD.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
