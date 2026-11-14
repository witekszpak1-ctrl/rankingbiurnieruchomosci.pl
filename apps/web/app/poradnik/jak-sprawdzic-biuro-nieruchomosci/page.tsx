import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd, PublicShell } from "@/components/SiteChrome";

import { articleLd, pageMetadata } from "@/lib/seo";

const PATH = "/poradnik/jak-sprawdzic-biuro-nieruchomosci";

export const metadata: Metadata = pageMetadata({
  title: "Jak sprawdzić biuro nieruchomości przed podpisaniem umowy",
  description:
    "Jak sprawdzić biuro nieruchomości: NIP w rejestrach (KRS, CEIDG, wykaz podatników VAT), ubezpieczenie OC pośrednika, opinie, umowa pośrednictwa. Lista kontrolna.",
  path: PATH,
  type: "article",
});

export default function CheckAgencyGuide() {
  return (
    <PublicShell>
      <JsonLd
        data={articleLd({
            headline: "Jak sprawdzić biuro nieruchomości",
            path: PATH,
            description: typeof metadata.description === "string" ? metadata.description : null,
            datePublished: "2026-11-14",
            dateModified: "2026-11-14",
          })}
      />
      <p className="crumbs">
        <Link href="/">Strona główna</Link> / Poradnik
      </p>
      <h1>Jak sprawdzić biuro nieruchomości</h1>
      <div className="answer">
        <strong>W skrócie</strong>
        <p>
          Sprawdź firmę w rejestrze po numerze NIP, poproś o potwierdzenie ubezpieczenia OC, przeczytaj opinie i dokładnie
          przejrzyj umowę pośrednictwa przed podpisaniem. Zajmie to kilkanaście minut.
        </p>
      </div>

      <h2>1. Firma w rejestrze</h2>
      <p>
        Biuro powinno podawać na stronie pełną nazwę firmy i NIP. Sprawdź je w bezpłatnych wyszukiwarkach:
      </p>
      <ul className="plain">
        <li>spółki: Krajowy Rejestr Sądowy (wyszukiwarka KRS Ministerstwa Sprawiedliwości),</li>
        <li>jednoosobowe działalności: CEIDG (biznes.gov.pl),</li>
        <li>status podatnika VAT i rachunek bankowy: wykaz podatników VAT (tzw. biała lista, podatki.gov.pl).</li>
      </ul>
      <p>
        Zwróć uwagę, czy nazwa i adres z rejestru zgadzają się z danymi na stronie i w umowie. W naszym katalogu biura, których
        NIP potwierdziliśmy w rejestrach, mają oznaczenie „potwierdzone w rejestrze”.
      </p>

      <h2>2. Ubezpieczenie OC pośrednika</h2>
      <p>
        Od 2014 roku do pośrednictwa w obrocie nieruchomościami nie jest potrzebna licencja, ale pośrednik ma obowiązek
        posiadać ubezpieczenie odpowiedzialności cywilnej za szkody wyrządzone klientom. Poproś o potwierdzenie zawarcia
        ubezpieczenia przed podpisaniem umowy.
      </p>

      <h2>3. Umowa pośrednictwa</h2>
      <ul className="plain">
        <li>Umowa musi mieć formę pisemną albo elektroniczną, inaczej jest nieważna.</li>
        <li>Sprawdź zakres czynności, na które umawiasz się z biurem, i czas trwania umowy.</li>
        <li>Wyłączność: czy biuro jest jedynym pośrednikiem i co jeśli sprzedasz albo kupisz samodzielnie.</li>
        <li>Prowizja: wysokość, netto czy brutto, kiedy jest należna. Więcej w poradniku <Link href="/poradnik/ile-bierze-biuro-nieruchomosci">ile bierze biuro nieruchomości</Link>.</li>
        <li>Wypowiedzenie: jak i z jakim terminem możesz zakończyć umowę.</li>
      </ul>

      <h2>4. Opinie i aktywność biura</h2>
      <p>
        Przeczytaj opinie klientów w Mapach Google i zwróć uwagę na ich liczbę i daty, nie tylko na średnią. Zobacz, czy
        biuro ma aktualne oferty na swojej stronie i czy podaje ceny usług. Te informacje pokazujemy na profilu każdego biura
        w katalogu, a sposób liczenia wyniku opisuje <Link href="/metodologia">metodologia rankingu</Link>.
      </p>

      <h2>5. Rozmowa z agentem</h2>
      <ul className="plain">
        <li>Jak biuro wyceni nieruchomość i na podstawie czego.</li>
        <li>Gdzie będzie publikować ogłoszenie i jak często będzie zdawać relację.</li>
        <li>Kto konkretnie będzie się zajmował sprawą i jak się z nim kontaktować.</li>
      </ul>
      <p>
        Biura w swoim mieście porównasz na liście <Link href="/miasta">miast</Link>: każda strona miasta ma ranking, filtry
        i porównywarkę do trzech biur.
      </p>
    </PublicShell>
  );
}
