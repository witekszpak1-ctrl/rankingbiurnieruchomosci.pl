import type { Metadata } from "next";

import { PublicShell } from "@/components/SiteChrome";
import { CONTACT_EMAIL } from "@/lib/format";

export const metadata: Metadata = {
  title: "Dla firm: korekta i usunięcie wpisu",
  description: "Jak zgłosić błąd w danych biura nieruchomości lub poprosić o usunięcie wpisu z katalogu.",
  alternates: { canonical: "/dla-firm" },
};

export default function ForCompaniesPage() {
  return (
    <PublicShell>
      <h1>Dla firm: korekta i usunięcie wpisu</h1>
      <div className="answer">
        <strong>W skrócie</strong>
        <p>
          Jeśli dane Twojego biura są błędne albo nie chcesz być w katalogu, napisz do nas. Poprawimy dane lub usuniemy
          wpis. Wpis możesz też wykluczyć z robota przez plik robots.txt na swojej stronie.
        </p>
      </div>

      <h2>Jak zgłosić</h2>
      <p>
        Wyślij wiadomość z adresu firmowego, podając NIP firmy i opis zmiany lub prośbę o usunięcie wpisu. Kontakt:{" "}
        {CONTACT_EMAIL ? <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> : <em>adres zostanie opublikowany przed startem serwisu</em>}.
      </p>

      <h2>Skąd mamy dane o firmie</h2>
      <p>
        Dane o firmie pochodzą z rejestrów publicznych (KRS, wykaz podatników VAT) oraz z jej oficjalnej strony
        internetowej. Publikujemy wyłącznie dane firmowe: nazwę, miasto, formę prawną, rok wpisu do rejestru, stronę
        internetową, zakres usług i ceny, które firma sama podaje na swojej stronie.
      </p>

      <h2>Twoje prawa</h2>
      <p>
        Masz prawo do sprostowania danych, sprzeciwu wobec ich przetwarzania i usunięcia wpisu. Pełna informacja o
        administratorze danych i podstawie prawnej przetwarzania zostanie opublikowana przed startem serwisu.
      </p>
      <p className="note">Wersja robocza strony: treść prawna wymaga weryfikacji przed publicznym uruchomieniem.</p>
    </PublicShell>
  );
}
