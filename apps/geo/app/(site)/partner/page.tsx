import Link from "next/link";

import { Icon } from "@/components/ui/Icon";
import { Card, StatTile } from "@/components/ui/ui";
import { formatPln } from "@/lib/affiliate";
import { currentTerms } from "@/lib/affiliate-repo";

export const metadata = { title: "Program partnerski: 20% dożywotnio" };
export const dynamic = "force-dynamic";

export default async function PartnerInfo() {
  const t = await currentTerms();
  const pct = t.rateBps / 100;
  return (
    <div className="wrap page mid">
      <div className="eyebrow">Program partnerski</div>
      <h1 style={{ fontSize: "clamp(30px, 4.4vw, 44px)", letterSpacing: "-0.04em", margin: "10px 0 14px", fontWeight: 800 }}>
        Polecaj i zarabiaj {pct}% dożywotnio
      </h1>
      <p className="muted" style={{ fontSize: 17, maxWidth: "62ch" }}>
        Wygeneruj własny link i wyślij go firmom, agencjom albo znajomym przedsiębiorcom. Od każdej płatności poleconego
        klienta dostajesz {pct}% kwoty netto, co miesiąc, tak długo, jak klient płaci.
      </p>
      <p style={{ marginTop: 20 }}>
        <Link href="/partner/dolacz" className="btn lg">Dołącz do programu <Icon name="arrow" size={16} /></Link>
      </p>
      <div className="g4 mt-24">
        <StatTile icon="wallet" tone="good" label="Prowizja" value={`${pct}%`} note="od każdej płatności netto klienta" />
        <StatTile icon="users" label="Czas" value="dożywotnio" note="klient jest przypisany do Ciebie na stałe" />
        <StatTile icon="clock" tone="warn" label="Pamiętamy kliknięcie" value={`${t.cookieDays} dni`} note="od kliknięcia Twojego linku" />
        <StatTile icon="gift" tone="accent" label="Wypłata" value={`od ${formatPln(t.minPayoutGrosze)}`} note="przelewem raz w miesiącu" />
      </div>
      <div className="g2 mt-24">
        <Card title="Przykład">
          <p>Polecasz 10 firm w pakiecie Growth (299 zł netto miesięcznie). Dostajesz 10 x 59,80 zł = 598 zł miesięcznie, dopóki płacą.</p>
        </Card>
        <Card title="Zasady w skrócie">
          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 8 }}>
            <li>Klient jest Twój, jeśli założy konto w ciągu {t.cookieDays} dni od kliknięcia Twojego linku albo wpisze Twój kod przy rejestracji. Kod wpisany ręcznie ma pierwszeństwo.</li>
            <li>Prowizja jest do wypłaty po {t.holdDays} dniach od płatności (czas na ewentualny zwrot). Zwrot pieniędzy klientowi zmniejsza prowizję.</li>
            <li>Nie ma prowizji od własnego konta i własnej firmy.</li>
            <li>Zakazane: spam, wysyłanie e-maili bez zgody odbiorców, fałszywe opinie i obietnice („gwarantujemy 1. miejsce w ChatGPT”), reklamy na naszą nazwę w wyszukiwarkach, podszywanie się pod nas. Naruszenie oznacza utratę prowizji.</li>
            <li>Zmiana warunków nie odbiera prowizji od klientów, których już poleciłeś.</li>
          </ul>
        </Card>
      </div>
      <p className="small muted" style={{ marginTop: 18 }}>Pełny regulamin programu powstaje przed startem sprzedaży. Powyższe zasady są wersją {t.version}.</p>
    </div>
  );
}
