"use client";

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { TrackEvent } from "@/components/TrackEvent";

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

/**
 * Stan formularza po wysłaniu (?sent=1&eid=... albo ?error=kod) czytany w przeglądarce, a nie na serwerze.
 * Dzięki temu strona profilu nie zależy od parametrów adresu i może być trzymana w pamięci podręcznej (ISR),
 * zamiast renderować się i odpytywać bazę przy każdym wejściu (także botów).
 */
export function LeadFormStatus({ firmName, sentText, children }: { firmName: string; sentText: string; children: ReactNode }) {
  const sp = useSearchParams();
  if (sp.get("sent") === "1") {
    const eventId = sp.get("eid") ?? undefined;
    return (
      <>
        <div className="alert ok">{sentText}</div>
        <TrackEvent name="Lead" params={{ content_name: firmName }} eventId={eventId} serverSent={Boolean(eventId)} />
      </>
    );
  }
  const error = sp.get("error");
  return (
    <>
      {error && <div className="alert bad">{ERRORS[error] ?? ERRORS.server}</div>}
      {children}
    </>
  );
}
