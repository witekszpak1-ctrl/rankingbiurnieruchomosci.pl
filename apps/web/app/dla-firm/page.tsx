import type { Metadata } from "next";
import Link from "next/link";

import { PublicShell } from "@/components/SiteChrome";
import { pageMetadata } from "@/lib/seo";
import { CONTACT_EMAIL } from "@/lib/format";
import { KIND_LABEL, REQUEST_KINDS } from "@/lib/requests";

import { submitRequestAction } from "./actions";

export const metadata: Metadata = pageMetadata({
  title: "Dla biur nieruchomości: korekta danych i pozycja w rankingu",
  description:
    "Jakie dane o biurze publikujemy, od czego zależy pozycja w rankingu i jak zgłosić korektę albo usunięcie wpisu. Płatność nie wpływa na wynik.",
  path: "/dla-firm",
});

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
        internetowej. Publikujemy wyłącznie dane firmowe: nazwę, miasto i adres biura, formę prawną i rok wpisu do
        rejestru, stronę internetową, firmowy telefon i e-mail, profile w mediach społecznościowych, logo, zakres usług,
        ceny i oferty, które firma sama pokazuje na swojej stronie, oraz ocenę z Map Google, jeśli biuro ma tam profil.
        Opis biura piszemy od nowa na podstawie tych faktów, bez kopiowania tekstów ze strony.
      </p>

      <h2>Od czego zależy pozycja w rankingu</h2>
      <p>
        Pozycję liczymy według <Link href="/metodologia">publicznej metodologii</Link>, z danych, które biuro samo publikuje.
        Płatność nie wpływa na wynik. Najczęściej pomagają:
      </p>
      <ul className="plain">
        <li>
          <b>NIP na stronie biura</b> (np. w stopce lub na stronie kontaktowej). Pozwala potwierdzić firmę w rejestrze;
          biura bez potwierdzenia są w katalogu, ale niżej w rankingu.
        </li>
        <li>
          <b>Jawny cennik</b>, czyli stawki prowizji podane na stronie, z informacją o VAT.
        </li>
        <li>
          <b>Opisany zakres usług</b>: sprzedaż, wynajem, zarządzanie najmem, rynek pierwotny i inne.
        </li>
        <li>
          <b>Aktualne oferty</b> widoczne na stronie biura.
        </li>
      </ul>
      <p>
        Dane odświeżamy automatycznie, więc zmiany na stronie biura trafiają do katalogu zwykle w ciągu kilku dni. Jeśli
        prowadzisz biuro z naszego katalogu, na dole jego profilu jest przycisk „Jestem właścicielem tej firmy”.
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
