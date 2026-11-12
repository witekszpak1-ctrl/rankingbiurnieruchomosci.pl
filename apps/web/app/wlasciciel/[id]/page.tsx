import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { submitClaimAction } from "./actions";
import { PublicShell } from "@/components/SiteChrome";
import { TrackEvent } from "@/components/TrackEvent";
import { CLAIM_WANTS, WANT_LABEL, getClaimTarget } from "@/lib/claims";
import { RETENTION_MONTHS } from "@/lib/legal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { absolute: "Jestem właścicielem firmy | Ranking biur nieruchomości" },
  robots: { index: false, follow: false },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ERRORS: Record<string, string> = {
  wants: "Wybierz, czego dotyczy zgłoszenie.",
  name: "Podaj imię i nazwisko.",
  email: "Podaj poprawny adres e-mail.",
  phone: "Podaj numer telefonu (oddzwonimy, żeby potwierdzić zgłoszenie).",
  nip: "Numer NIP jest niepoprawny.",
  message: "Wiadomość może mieć najwyżej 2000 znaków.",
  consent: "Zaznacz oświadczenie i zgodę.",
  limit: "Wysłano zbyt wiele zgłoszeń. Spróbuj za godzinę.",
  server: "Nie udało się wysłać zgłoszenia. Spróbuj ponownie za chwilę.",
};

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ClaimPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  if (!UUID_RE.test(id)) notFound();
  const firm = await getClaimTarget(id);
  if (!firm) notFound();
  const error = typeof sp.error === "string" ? sp.error : null;
  return (
    <PublicShell>
      <nav className="crumbs" aria-label="Okruszki">
        <Link href="/">Strona główna</Link>
        <span>›</span>
        <Link href={firm.path}>{firm.name}</Link>
        <span>›</span>
        <span>Jestem właścicielem</span>
      </nav>
      <div className="claim">
        <div className="claim-intro">
          <span className="eyebrow">Dla właścicieli biur</span>
          <h1>Jestem właścicielem firmy {firm.name}</h1>
          <p>
            Zostaw dane, a skontaktujemy się z Tobą. Po potwierdzeniu, że reprezentujesz firmę, uzupełnimy profil,
            poprawimy dane albo usuniemy wpis.
          </p>
          <ul className="checks-row vertical">
            <li>Bezpłatnie</li>
            <li>Potwierdzamy zgłoszenie telefonicznie albo mailowo</li>
            <li>Pozycja w rankingu nie zależy od płatności</li>
          </ul>
        </div>
        <div className="lead claim-form">
          {sp.sent === "1" ? (
            <>
              <div className="alert ok">
                Dziękujemy, zgłoszenie zostało wysłane. Odezwiemy się w ciągu kilku dni roboczych.{" "}
                <Link href={firm.path}>Wróć do profilu firmy</Link>
              </div>
              <TrackEvent name="SubmitApplication" params={{ content_name: firm.name }} />
            </>
          ) : (
            <form action={submitClaimAction} className="lead-form">
              {error && <div className="alert bad">{ERRORS[error] ?? ERRORS.server}</div>}
              <input type="hidden" name="listing" value={firm.id} />
              <div className="hp" aria-hidden="true">
                <label htmlFor="website">Strona</label>
                <input id="website" name="website" tabIndex={-1} autoComplete="off" />
              </div>
              <div className="lead-field full">
                <label htmlFor="wants">Czego dotyczy zgłoszenie</label>
                <select id="wants" name="wants" required defaultValue="claim">
                  {CLAIM_WANTS.map((w) => (
                    <option key={w} value={w}>
                      {WANT_LABEL[w]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="lead-field">
                <label htmlFor="name">Imię i nazwisko</label>
                <input id="name" name="name" autoComplete="name" required maxLength={120} />
              </div>
              <div className="lead-field">
                <label htmlFor="role">Stanowisko (opcjonalnie)</label>
                <input id="role" name="role" maxLength={80} placeholder="np. właściciel" />
              </div>
              <div className="lead-field">
                <label htmlFor="email">E-mail</label>
                <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} />
              </div>
              <div className="lead-field">
                <label htmlFor="phone">Telefon</label>
                <input id="phone" name="phone" type="tel" autoComplete="tel" required maxLength={30} />
              </div>
              <div className="lead-field full">
                <label htmlFor="nip">NIP firmy (opcjonalnie, przyspiesza weryfikację)</label>
                <input id="nip" name="nip" inputMode="numeric" maxLength={13} />
              </div>
              <div className="lead-field full">
                <label htmlFor="message">Wiadomość (opcjonalnie)</label>
                <textarea id="message" name="message" rows={4} maxLength={2000} />
              </div>
              <label className="lead-consent full">
                <input type="checkbox" name="consent" required /> Oświadczam, że reprezentuję firmę {firm.name}, i zgadzam
                się na kontakt w sprawie tego zgłoszenia.
              </label>
              <button className="lead-submit" type="submit">
                Wyślij zgłoszenie
              </button>
              <p className="lead-note full">
                Dane wykorzystamy do sprawdzenia, czy reprezentujesz firmę, i do kontaktu w sprawie zgłoszenia. Usuniemy je
                automatycznie po {RETENTION_MONTHS.claims} miesiącach. Szczegóły i Twoje prawa:{" "}
                <Link href="/polityka-prywatnosci#dane">Polityka prywatności</Link>.
              </p>
            </form>
          )}
        </div>
      </div>
    </PublicShell>
  );
}
