import type { Metadata } from "next";
import Link from "next/link";

import { PublicShell } from "@/components/SiteChrome";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Reklama i niezależność rankingu biur nieruchomości",
  description:
    "Zasady oznaczania reklam w katalogu biur nieruchomości. Pozycja w rankingu nie zależy od płatności, a treści sponsorowane są oddzielone od rankingu.",
  path: "/reklama",
});

export default function AdvertisingPage() {
  return (
    <PublicShell>
      <h1>Reklama i niezależność</h1>
      <div className="answer">
        <strong>W skrócie</strong>
        <p>
          Pozycja biura w rankingu nie zależy od tego, czy płaci. Treści sponsorowane są oznaczone napisem „Reklama” i
          pokazywane w osobnym miejscu, poza rankingiem.
        </p>
      </div>
      <h2>Zasady</h2>
      <ul className="plain">
        <li>Ranking wynika wyłącznie z parametrów opisanych w <Link href="/metodologia">metodologii</Link>.</li>
        <li>Każda reklama i treść sponsorowana jest wyraźnie oznaczona.</li>
        <li>Płatny pakiet nie zmienia wyniku ani pozycji, może dodać do profilu logo, własny opis lub formularz kontaktowy.</li>
        <li>Zmiany metodologii publikujemy z datą na stronie metodologii.</li>
      </ul>
      <p className="note">Na dziś serwis nie wyświetla żadnych reklam ani treści sponsorowanych.</p>
    </PublicShell>
  );
}
