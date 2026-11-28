import type { Metadata } from "next";

import { Notice, one, type SP } from "@/components/Notice";

import { auditFormAction } from "../actions";

export const metadata: Metadata = {
  title: "Darmowy audyt widoczności w AI",
  description: "Sprawdź, czy asystenci AI wymieniają Twoje biuro nieruchomości, kogo polecają zamiast Ciebie i jakie źródła cytują.",
  robots: { index: false, follow: false },
};

export default async function AuditHome({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  return (
    <>
      <h1>Darmowy audyt widoczności w AI</h1>
      <p className="lead">
        Wpisz adres strony swojego biura nieruchomości. Pokażemy, czy Gemini, Google AI Mode i Google AI Overview wymieniają
        Twoją firmę w odpowiedziach o biurach w Twoim mieście, kogo wymieniają częściej i z jakich stron korzystają.
      </p>
      <Notice error={one(sp.error)} />
      <form action={auditFormAction} className="stack">
        <label>
          Adres strony firmy
          <input name="domain" type="text" required maxLength={300} placeholder="mojafirma.pl" autoComplete="url" />
        </label>
        <button type="submit">Sprawdź widoczność</button>
      </form>
      <p className="muted small">
        Wersja pierwsza korzysta z pomiarów, które już mamy dla największych miast, i z naszego katalogu biur nieruchomości.
        Nie wysyłamy nowych zapytań do AI i nie pobieramy Twojej strony. Jeśli Twojej firmy nie ma w katalogu, napiszemy to wprost.
      </p>
    </>
  );
}
