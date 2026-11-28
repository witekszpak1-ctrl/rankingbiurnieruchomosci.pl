import { joinWaitlistAction } from "@/app/actions";

/** Zapis na listę oczekujących na pełny audyt (pomiary na żywo). Po zapisie wraca na stronę, z której przyszedł. */
export function WaitlistForm({ domain, from, button = "Zapisz mnie" }: { domain?: string; from: string; button?: string }) {
  return (
    <form action={joinWaitlistAction} className="stack">
      <input type="hidden" name="from" value={from} />
      <label>
        Adres strony firmy
        <input name="domain" type="text" maxLength={300} defaultValue={domain ?? ""} placeholder="mojafirma.pl" autoComplete="url" />
      </label>
      <label>
        E-mail
        <input name="email" type="email" required maxLength={254} autoComplete="email" />
      </label>
      <label className="check">
        <input name="consent" type="checkbox" />
        <span className="small">Zgadzam się na jedną wiadomość e-mail o uruchomieniu pełnego audytu dla mojej strony.</span>
      </label>
      <button type="submit">{button}</button>
    </form>
  );
}
