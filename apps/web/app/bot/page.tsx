import type { Metadata } from "next";

import { PublicShell } from "@/components/SiteChrome";
import { CONTACT_EMAIL, SITE_URL } from "@/lib/format";

export const metadata: Metadata = {
  title: "Informacje o robocie",
  description: "Jak działa robot zbierający dane o biurach nieruchomości i jak go wykluczyć.",
  alternates: { canonical: "/bot" },
};

export default function BotPage() {
  return (
    <PublicShell>
      <h1>Informacje o robocie</h1>
      <div className="answer">
        <strong>W skrócie</strong>
        <p>
          Nasz robot odwiedza strony biur nieruchomości, żeby zapisać dane firmowe do katalogu. Przestrzega pliku
          robots.txt, robi przerwy między zapytaniami do tego samego serwera i przedstawia się nazwą KatalogBot.
        </p>
      </div>
      <h2>Jak się przedstawia</h2>
      <p className="mono">KatalogBot/0.1 (+{SITE_URL}/bot/{CONTACT_EMAIL ? `; kontakt: ${CONTACT_EMAIL}` : ""})</p>
      <h2>Jak wykluczyć robota</h2>
      <p>
        Dodaj do pliku robots.txt na swojej stronie wpis <span className="mono">User-agent: KatalogBot</span> oraz{" "}
        <span className="mono">Disallow: /</span>. Zastosujemy się do niego. Możesz też poprosić o usunięcie wpisu na
        stronie <a href="/dla-firm">dla firm</a>.
      </p>
    </PublicShell>
  );
}
