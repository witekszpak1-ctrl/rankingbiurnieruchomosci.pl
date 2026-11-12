import Link from "next/link";

import { submitLeadAction } from "@/app/[city]/[firm]/actions";
import { LEAD_TOPICS, TOPIC_LABEL } from "@/lib/leads";
import { RETENTION_MONTHS } from "@/lib/legal";

const ERRORS: Record<string, string> = {
  topic: "Wybierz, w jakiej sprawie piszesz.",
  name: "Podaj imię (2-100 znaków).",
  email: "Podaj poprawny adres e-mail.",
  phone: "Numer telefonu wygląda na niepełny.",
  message: "Napisz wiadomość (10-2000 znaków).",
  consent: "Zaznacz zgodę, żebyśmy mogli przekazać zapytanie.",
  limit: "Wysłano zbyt wiele zapytań w krótkim czasie. Spróbuj za godzinę.",
  server: "Nie udało się wysłać zapytania. Spróbuj ponownie za chwilę.",
};

type Props = {
  listingId: string;
  firmName: string;
  path: string;
  sent: boolean;
  error: string | null;
  imageSlot?: React.ReactNode;
};

export function LeadForm({ listingId, firmName, path, sent, error, imageSlot }: Props) {
  return (
    <section id="zapytanie" className="lead">
      <div className="lead-head">
        {imageSlot}
        <div>
          <span className="lead-kicker">Napisz do biura</span>
          <h2>{firmName}</h2>
        </div>
      </div>
      {sent ? (
        <div className="alert ok">Dziękujemy, zapytanie zostało wysłane. Biuro skontaktuje się z Tobą.</div>
      ) : (
        <form action={submitLeadAction} className="lead-form">
          {error && <div className="alert bad">{ERRORS[error] ?? ERRORS.server}</div>}
          <input type="hidden" name="listing" value={listingId} />
          <input type="hidden" name="back" value={path} />
          <div className="hp" aria-hidden="true">
            <label htmlFor="website">Strona</label>
            <input id="website" name="website" tabIndex={-1} autoComplete="off" />
          </div>
          <div className="lead-field full">
            <label htmlFor="topic">W jakiej sprawie</label>
            <select id="topic" name="topic" required defaultValue="">
              <option value="" disabled>
                wybierz
              </option>
              {LEAD_TOPICS.map((t) => (
                <option key={t} value={t}>
                  {TOPIC_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="lead-field">
            <label htmlFor="name">Imię</label>
            <input id="name" name="name" autoComplete="given-name" required maxLength={100} />
          </div>
          <div className="lead-field">
            <label htmlFor="email">E-mail</label>
            <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} />
          </div>
          <div className="lead-field full">
            <label htmlFor="phone">Telefon (opcjonalnie)</label>
            <input id="phone" name="phone" type="tel" autoComplete="tel" maxLength={30} />
          </div>
          <div className="lead-field full">
            <label htmlFor="message">Wiadomość</label>
            <textarea id="message" name="message" rows={5} required minLength={10} maxLength={2000} />
          </div>
          <label className="lead-consent full">
            <input type="checkbox" name="consent" required /> Zgadzam się na przekazanie moich danych z tego formularza do
            biura {firmName} w celu odpowiedzi na zapytanie.
          </label>
          <button className="lead-submit" type="submit">
            Zapytaj bezpłatnie
          </button>
          <p className="lead-note full">
            Dane przekażemy tylko temu biuru, w celu odpowiedzi na zapytanie, a z naszej bazy usuniemy je automatycznie po{" "}
            {RETENTION_MONTHS.leads} miesiącach. Administratorem danych jest operator serwisu. Szczegóły i Twoje prawa:{" "}
            <Link href="/polityka-prywatnosci#dane">Polityka prywatności</Link>. Wysyłając zapytanie, akceptujesz{" "}
            <Link href="/regulamin">Regulamin</Link>.
          </p>
        </form>
      )}
    </section>
  );
}
