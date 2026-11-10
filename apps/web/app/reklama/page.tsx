import type { Metadata } from "next";
import Link from "next/link";

import { PublicShell } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "Reklama i niezależność",
  description: "Zasady oznaczania reklam i niezależność rankingu biur nieruchomości od płatności.",
  alternates: { canonical: "/reklama" },
};

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
