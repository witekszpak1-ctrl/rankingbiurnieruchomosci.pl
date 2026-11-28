import Link from "next/link";

import { formatPln } from "@/lib/affiliate";
import { currentTerms } from "@/lib/affiliate-repo";

export const metadata = { title: "Program partnerski: 20% dożywotnio" };
export const dynamic = "force-dynamic";

export default async function PartnerInfo() {
  const t = await currentTerms();
  const pct = t.rateBps / 100;
  return (
    <>
      <h1>Polecaj i zarabiaj {pct}% dożywotnio</h1>
      <p className="lead">
        Wygeneruj własny link i wyślij go firmom, agencjom albo znajomym przedsiębiorcom. Od każdej płatności poleconego
        klienta dostajesz {pct}% kwoty netto, co miesiąc, tak długo, jak klient płaci.
      </p>
      <div className="grid">
        <div className="card stat"><b>{pct}%</b><span>od każdej płatności netto klienta</span></div>
        <div className="card stat"><b>dożywotnio</b><span>klient jest przypisany do Ciebie na stałe</span></div>
        <div className="card stat"><b>{t.cookieDays} dni</b><span>tyle pamiętamy kliknięcie w Twój link</span></div>
        <div className="card stat"><b>od {formatPln(t.minPayoutGrosze)}</b><span>wypłata przelewem raz w miesiącu</span></div>
      </div>
      <h2>Przykład</h2>
      <p>Polecasz 10 firm w pakiecie Growth (299 zł netto miesięcznie). Dostajesz 10 x 59,80 zł = 598 zł miesięcznie, dopóki płacą.</p>
      <h2>Zasady w skrócie</h2>
      <ul>
        <li>Klient jest Twój, jeśli założy konto w ciągu {t.cookieDays} dni od kliknięcia Twojego linku albo wpisze Twój kod przy rejestracji. Kod wpisany ręcznie ma pierwszeństwo.</li>
        <li>Prowizja jest do wypłaty po {t.holdDays} dniach od płatności (czas na ewentualny zwrot). Zwrot pieniędzy klientowi zmniejsza prowizję.</li>
        <li>Nie ma prowizji od własnego konta i własnej firmy.</li>
        <li>Zakazane: spam, wysyłanie e-maili bez zgody odbiorców, fałszywe opinie i obietnice („gwarantujemy 1. miejsce w ChatGPT”), reklamy na naszą nazwę w wyszukiwarkach, podszywanie się pod nas. Naruszenie oznacza utratę prowizji.</li>
        <li>Zmiana warunków nie odbiera prowizji od klientów, których już poleciłeś.</li>
      </ul>
      <p className="small muted">Pełny regulamin programu powstaje przed startem sprzedaży. Powyższe zasady są wersją {t.version}.</p>
      <p><Link href="/partner/dolacz" className="btn">Dołącz do programu</Link></p>
    </>
  );
}
