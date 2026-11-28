import type { Metadata } from "next";

import { auditFormAction } from "@/app/actions";
import { Notice, one, type SP } from "@/components/Notice";
import { Icon } from "@/components/ui/Icon";

export const metadata: Metadata = {
  title: "Darmowy audyt widoczności w AI",
  description: "Sprawdź, czy asystenci AI wymieniają Twoje biuro nieruchomości, kogo polecają zamiast Ciebie i jakie źródła cytują.",
  robots: { index: false, follow: false },
};

export default async function AuditHome({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  return (
    <div className="wrap page mid">
      <div className="eyebrow">Darmowy audyt</div>
      <h1 style={{ fontSize: "clamp(30px, 4.4vw, 44px)", letterSpacing: "-0.04em", margin: "10px 0 14px", fontWeight: 800 }}>
        Sprawdź widoczność swojej firmy w AI
      </h1>
      <p className="muted" style={{ fontSize: 17, maxWidth: "62ch" }}>
        Wpisz adres strony swojego biura nieruchomości. Pokażemy, czy Gemini, Google AI Mode i Google AI Overview wymieniają Twoją firmę w
        odpowiedziach o biurach w Twoim mieście, kogo wymieniają częściej i z jakich stron korzystają.
      </p>
      <div style={{ marginTop: 22 }}>
        <Notice error={one(sp.error)} />
      </div>
      <form action={auditFormAction} className="hero-form" role="search" style={{ marginTop: 14 }}>
        <input name="domain" type="text" required maxLength={300} placeholder="Adres strony firmy, np. mojafirma.pl" autoComplete="url" aria-label="Adres strony firmy" />
        <button type="submit" className="btn lg">
          Sprawdź widoczność <Icon name="arrow" size={16} />
        </button>
      </form>
      <ul className="checks">
        <li><Icon name="check" size={16} strokeWidth={2.5} /> Bezpłatnie</li>
        <li><Icon name="check" size={16} strokeWidth={2.5} /> Bez rejestracji</li>
        <li><Icon name="check" size={16} strokeWidth={2.5} /> Nie pobieramy Twojej strony</li>
      </ul>
      <p className="muted small" style={{ marginTop: 22, maxWidth: "70ch" }}>
        Wersja pierwsza korzysta z pomiarów, które już mamy dla największych miast, i z naszego katalogu biur nieruchomości. Nie wysyłamy nowych
        zapytań do AI. Jeśli Twojej firmy nie ma w katalogu, napiszemy to wprost.
      </p>
    </div>
  );
}
