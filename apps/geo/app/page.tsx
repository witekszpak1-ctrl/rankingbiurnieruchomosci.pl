import Link from "next/link";

import { Notice, one, type SP } from "@/components/Notice";

import { joinWaitlistAction } from "./actions";

export default async function Home({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  return (
    <>
      <h1>Czy ChatGPT poleca Twoją firmę?</h1>
      <p className="lead">
        Coraz więcej klientów pyta asystentów AI: „jaką firmę polecacie w moim mieście?”. Sprawdzamy prawdziwe odpowiedzi
        ChatGPT i Gemini na pytania Twoich klientów, pokazujemy, kogo polecają zamiast Ciebie i z jakich źródeł korzystają.
      </p>

      <h2>Darmowy audyt widoczności</h2>
      <p>
        Biuro nieruchomości z miasta, które już mierzymy, sprawdzi za darmo, czy asystenci AI je wymieniają, kogo wymieniają
        zamiast niego i z jakich stron korzystają.
      </p>
      <p>
        <Link href="/audyt" className="btn">Sprawdź swoją stronę</Link>
      </p>
      <p className="muted">
        Pełny audyt z pomiarem na żywo dla każdej firmy jest w przygotowaniu. Zostaw adres, a wyślemy jedną wiadomość, gdy będzie gotowy.
      </p>
      <Notice error={one(sp.error)} ok={sp.zapisano ? "Zapisane. Napiszemy, gdy audyt będzie gotowy." : null} />
      <form action={joinWaitlistAction} className="stack">
        <label>
          Adres strony firmy
          <input id="domain" name="domain" type="text" placeholder="mojafirma.pl" autoComplete="url" />
        </label>
        <label>
          E-mail
          <input id="email" name="email" type="email" required autoComplete="email" />
        </label>
        <label className="check">
          <input id="consent" name="consent" type="checkbox" />
          <span className="small">Zgadzam się na jedną wiadomość e-mail o uruchomieniu audytu dla mojej strony.</span>
        </label>
        <button type="submit">Zapisz mnie</button>
      </form>

      <h2>Polecaj i zarabiaj 20% dożywotnio</h2>
      <p>
        Każdy może wygenerować własny link. Od każdej płatności klienta, który założy konto z Twojego polecenia, dostajesz
        20% kwoty netto, tak długo, jak klient płaci.
      </p>
      <p>
        <Link href="/partner" className="btn ghost">Zobacz program partnerski</Link>
      </p>
    </>
  );
}
