import type { Metadata } from "next";
import Link from "next/link";

import { OperatorContact, OperatorDetails } from "@/components/LegalOperator";
import { JsonLd, PublicShell } from "@/components/SiteChrome";
import { absoluteUrl, SITE_NAME } from "@/lib/format";
import { operator, operatorJsonLd } from "@/lib/legal";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "O nas: kto prowadzi ranking biur nieruchomości",
  description:
    "Kto prowadzi rankingbiurnieruchomosci.pl, skąd są dane o biurach nieruchomości, jak często je odświeżamy i jak zgłosić błąd we wpisie.",
  path: "/o-nas",
});

export default function AboutPage() {
  const op = operator();
  return (
    <PublicShell>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "AboutPage",
          name: "O nas",
          url: absoluteUrl("/o-nas"),
          about: {
            "@type": "Organization",
            name: SITE_NAME,
            url: absoluteUrl("/"),
            email: op.email ?? undefined,
            parentOrganization: operatorJsonLd(),
          },
        }}
      />
      <h1>O nas</h1>
      <div className="answer">
        <strong>W skrócie</strong>
        <p>
          {SITE_NAME} to katalog i ranking biur nieruchomości w Polsce. Dane o biurach zbieramy z rejestrów publicznych
          i z ich własnych stron, a kolejność w rankingu wynika z <Link href="/metodologia">jawnej metodologii</Link>.
          Płatność nie wpływa na pozycję biura.
        </p>
      </div>

      <h2>Kto prowadzi serwis</h2>
      <p>
        Serwis prowadzi <OperatorDetails />. Kontakt: <OperatorContact />.
      </p>

      <h2>Skąd są dane</h2>
      <ul className="plain">
        <li>
          <b>Rejestry publiczne:</b> Krajowy Rejestr Sądowy i wykaz podatników VAT. Sprawdzamy w nich NIP podany na
          stronie biura, nazwę firmy, formę prawną i datę wpisu.
        </li>
        <li>
          <b>Strona internetowa biura:</b> zakres usług, ceny i prowizje, aktualne oferty, firmowe dane kontaktowe.
          Publikujemy tylko to, co biuro samo pokazuje.
        </li>
        <li>
          <b>Mapy Google:</b> średnia ocena i liczba opinii, jeśli biuro ma tam profil, z linkiem do Google.
        </li>
      </ul>
      <p>
        Opisy biur piszemy od nowa na podstawie zebranych faktów, bez kopiowania tekstów ze stron firm. Szczegóły:{" "}
        <Link href="/metodologia">metodologia</Link>, <Link href="/bot">informacje o naszym robocie</Link>,{" "}
        <Link href="/reklama">reklama i niezależność</Link>.
      </p>

      <h2>Jak często odświeżamy dane</h2>
      <ul className="plain">
        <li>Nowe biura i opisy trafiają do katalogu na bieżąco, automat pracuje co godzinę.</li>
        <li>Oferty ze stron biur sprawdzamy zwykle co 1-2 dni.</li>
        <li>Oceny z Google i dane kontaktowe odświeżamy regularnie, partiami.</li>
      </ul>

      <h2>Jak zgłosić błąd</h2>
      <p>
        Jeśli we wpisie biura jest błąd, wyślij zgłoszenie przez formularz na stronie{" "}
        <Link href="/dla-firm">Dla biur</Link> (rodzaj „Korekta danych”). Właściciel biura może też skorzystać z przycisku
        „Jestem właścicielem tej firmy” na dole profilu.
      </p>

      <h2 id="kontakt">Kontakt dla biur i mediów</h2>
      <p>
        {op.email ? (
          <>
            Napisz na <a href={`mailto:${op.email}`}>{op.email}</a>.{" "}
          </>
        ) : null}
        Sprawy wpisów biur najszybciej załatwisz przez <Link href="/dla-firm">formularz dla biur</Link>. Więcej:{" "}
        <Link href="/kontakt">Kontakt</Link>.
      </p>
    </PublicShell>
  );
}
