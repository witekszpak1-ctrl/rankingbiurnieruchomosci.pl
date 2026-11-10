import type { Metadata } from "next";

import { PublicShell } from "@/components/SiteChrome";
import { CONTACT_EMAIL } from "@/lib/format";
import { KIND_LABEL, REQUEST_KINDS } from "@/lib/requests";

import { submitRequestAction } from "./actions";

export const metadata: Metadata = {
  title: "Dla firm: korekta i usunięcie wpisu",
  description: "Jak zgłosić błąd w danych biura nieruchomości lub poprosić o usunięcie wpisu z katalogu.",
  alternates: { canonical: "/dla-firm" },
};

const ERROR_TEXT: Record<string, string> = {
  kind: "Wybierz rodzaj zgłoszenia.",
  nip: "NIP jest nieprawidłowy (10 cyfr i poprawna suma kontrolna). Popraw go albo zostaw pole puste.",
  email: "Podaj poprawny adres e-mail, na który mamy odpowiedzieć.",
  message: "Treść zgłoszenia musi mieć od 10 do 2000 znaków.",
  limit: "Wysłano zbyt wiele zgłoszeń w krótkim czasie. Spróbuj ponownie za godzinę.",
  server: "Nie udało się zapisać zgłoszenia. Spróbuj ponownie później.",
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ForCompaniesPage({ searchParams }: Props) {
  const params = await searchParams;
  const sent = params.sent === "1";
  const errorCode = typeof params.error === "string" ? params.error : "";
  const errorText = ERROR_TEXT[errorCode];

  return (
    <PublicShell>
      <h1>Dla firm: korekta i usunięcie wpisu</h1>
      <div className="answer">
        <strong>W skrócie</strong>
        <p>
          Jeśli dane Twojego biura są błędne albo nie chcesz być w katalogu, wyślij zgłoszenie z formularza poniżej.
          Poprawimy dane lub usuniemy wpis. Wpis możesz też wykluczyć z robota przez plik robots.txt na swojej stronie.
        </p>
      </div>

      <h2 id="formularz">Zgłoszenie</h2>
      {sent && (
        <div className="alert ok" role="status">
          Dziękujemy, zgłoszenie zostało przyjęte. Odpowiemy na podany adres e-mail.
        </div>
      )}
      {errorText && (
        <div className="alert bad" role="alert">
          {errorText}
        </div>
      )}
      <form action={submitRequestAction}>
        <div className="form-row" style={{ display: "block" }}>
          <label htmlFor="kind">Rodzaj zgłoszenia</label>
          <select id="kind" name="kind" required defaultValue="correction">
            {REQUEST_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {KIND_LABEL[kind]}
              </option>
            ))}
          </select>
        </div>
        <div className="form-row" style={{ display: "block" }}>
          <label htmlFor="nip">NIP firmy (nieobowiązkowo)</label>
          <input id="nip" name="nip" inputMode="numeric" autoComplete="off" maxLength={13} />
        </div>
        <div className="form-row" style={{ display: "block" }}>
          <label htmlFor="email">Twój adres e-mail (na niego odpowiemy)</label>
          <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} style={{ width: "100%", maxWidth: 420 }} />
        </div>
        <div className="form-row" style={{ display: "block" }}>
          <label htmlFor="message">Treść zgłoszenia (od 10 do 2000 znaków)</label>
          <textarea
            id="message"
            name="message"
            required
            minLength={10}
            maxLength={2000}
            rows={6}
            style={{ width: "100%", maxWidth: 640, font: "inherit", padding: "6px 10px" }}
          />
        </div>
        {/* Pole-pułapka na boty: ukryte przed ludźmi, nie wypełniać. */}
        <div style={{ position: "absolute", left: "-10000px" }} aria-hidden="true">
          <label htmlFor="website">Strona www (zostaw puste)</label>
          <input id="website" name="website" tabIndex={-1} autoComplete="off" />
        </div>
        <button className="primary" type="submit">
          Wyślij zgłoszenie
        </button>
      </form>
      <p className="note">
        Adres e-mail, NIP i treść zgłoszenia wykorzystujemy tylko do rozpatrzenia sprawy i odpowiedzi.
        {CONTACT_EMAIL && (
          <>
            {" "}
            Możesz też napisać na <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </>
        )}
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
