import Link from "next/link";
import { Suspense } from "react";

import { submitLeadAction } from "@/app/[city]/[firm]/actions";
import { LeadTopicMessage } from "@/components/LeadTopicMessage";
import { LeadFormStatus } from "@/components/LeadFormStatus";
import { leadMessage } from "@/lib/lead-message";
import { operator } from "@/lib/legal";
import { currentPortal } from "@/lib/portal";
import { LEAD_TOPICS, TOPIC_LABEL } from "@/lib/leads";
import { RETENTION_MONTHS } from "@/lib/legal";

type Props = {
  listingId: string;
  firmName: string;
  /** Miasto z przyimkiem ("w Krakowie") do gotowej wiadomości. */
  where: string;
  path: string;
  imageSlot?: React.ReactNode;
};

export function LeadForm({ listingId, firmName, where, path, imageSlot }: Props) {
  const messages: Record<string, string> = { "": leadMessage("", where) };
  for (const t of LEAD_TOPICS) messages[t] = leadMessage(t, where);
  return (
    <section id="zapytanie" className="lead">
      <div className="lead-head">
        {imageSlot}
        <div>
          <span className="lead-kicker">{currentPortal().texts.leadCta}</span>
          <h2>{firmName}</h2>
        </div>
      </div>
      {/* Bez JavaScriptu i przed odczytem adresu widać zwykły formularz. */}
      <Suspense fallback={form(listingId, firmName, path, messages)}>
        <LeadFormStatus firmName={firmName}>{form(listingId, firmName, path, messages)}</LeadFormStatus>
      </Suspense>
    </section>
  );
}

function form(listingId: string, firmName: string, path: string, messages: Record<string, string>) {
  return (
        <form action={submitLeadAction} className="lead-form">
          <input type="hidden" name="listing" value={listingId} />
          <input type="hidden" name="back" value={path} />
          <div className="hp" aria-hidden="true">
            <label htmlFor="website">Strona</label>
            <input id="website" name="website" tabIndex={-1} autoComplete="off" />
          </div>
          <p className="lead-intro full">Bezpłatnie i bez zobowiązań. Wiadomość jest już wpisana: wybierz sprawę i podaj kontakt.</p>
          <LeadTopicMessage topics={LEAD_TOPICS.map((t): [string, string] => [t, TOPIC_LABEL[t]])} messages={messages}>
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
          </LeadTopicMessage>
          <label className="lead-consent full">
            <input type="checkbox" name="consent" required /> Zgadzam się na przekazanie moich danych z tego formularza do
            biura {firmName} w celu odpowiedzi na zapytanie.
          </label>
          <button className="lead-submit" type="submit">
            {currentPortal().texts.leadCta}
          </button>
          <p className="lead-note full">
            Dane przekażemy tylko temu biuru, w celu odpowiedzi na zapytanie, a z naszej bazy usuniemy je automatycznie po{" "}
            {RETENTION_MONTHS.leads} miesiącach. Administratorem danych jest {operator().name ?? "operator serwisu"}. Szczegóły i Twoje prawa:{" "}
            <Link href="/polityka-prywatnosci#dane">Polityka prywatności</Link>. Wysyłając zapytanie, akceptujesz{" "}
            <Link href="/regulamin">Regulamin</Link>.
          </p>
        </form>
  );
}
