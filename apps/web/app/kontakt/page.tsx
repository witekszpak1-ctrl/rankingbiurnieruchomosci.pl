import type { Metadata } from "next";
import Link from "next/link";

import { OperatorDetails } from "@/components/LegalOperator";
import { JsonLd, PublicShell } from "@/components/SiteChrome";
import { absoluteUrl, SITE_NAME } from "@/lib/format";
import { operator, operatorJsonLd } from "@/lib/legal";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Kontakt z rankingiem biur nieruchomości",
  description:
    "Kontakt z rankingbiurnieruchomosci.pl: e-mail, formularz korekty i usunięcia wpisu biura, dane administratora serwisu.",
  path: "/kontakt",
});

export default function ContactPage() {
  const op = operator();
  return (
    <PublicShell>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ContactPage",
          name: "Kontakt",
          url: absoluteUrl("/kontakt"),
          about: {
            "@type": "Organization",
            name: SITE_NAME,
            url: absoluteUrl("/"),
            email: op.email ?? undefined,
            parentOrganization: operatorJsonLd(),
          },
        }}
      />
      <h1>Kontakt</h1>
      <div className="answer">
        <strong>W skrócie</strong>
        <p>
          {op.email ? (
            <>
              E-mail: <a href={`mailto:${op.email}`}>{op.email}</a>.{" "}
            </>
          ) : null}
          Korekty i usunięcia wpisów biur przyjmujemy przez <Link href="/dla-firm">formularz dla biur</Link>.
        </p>
      </div>

      <h2>W jakiej sprawie piszesz</h2>
      <ul className="plain">
        <li>
          <b>Błąd we wpisie biura albo usunięcie wpisu:</b> <Link href="/dla-firm">formularz dla biur</Link>, rodzaj
          „Korekta danych” albo „Usunięcie wpisu”.
        </li>
        <li>
          <b>Dane osobowe (dostęp, sprostowanie, usunięcie, sprzeciw):</b> ten sam formularz, rodzaj „Inna sprawa”, albo
          e-mail. Szczegóły w <Link href="/polityka-prywatnosci#prawa">polityce prywatności</Link>.
        </li>
        <li>
          <b>Zapytanie do konkretnego biura:</b> formularz „Zapytaj bezpłatnie” na profilu tego biura. Wiadomość trafia
          prosto do biura.
        </li>
        <li>
          <b>Media i współpraca:</b> e-mail.
        </li>
      </ul>

      <h2>Administrator serwisu</h2>
      <p>
        <OperatorDetails />. Więcej o serwisie: <Link href="/o-nas">O nas</Link>.
      </p>
    </PublicShell>
  );
}
