import { when } from "@/components/admin";
import { getPrompt, PROMPT_DEFAULT_KEY, PROMPT_KEY } from "@/lib/prompts";
import { promptAction } from "../../actions";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function PromptPage({ searchParams }: Props) {
  const params = await searchParams;
  const [current, fallback] = await Promise.all([getPrompt(PROMPT_KEY), getPrompt(PROMPT_DEFAULT_KEY)]);
  const text = current?.text ?? fallback?.text ?? "";
  const changed = Boolean(current && fallback && current.text !== fallback.text);
  const ok = typeof params.ok === "string" ? params.ok : null;
  const error = typeof params.error === "string" ? params.error : null;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Prompt opisów</h1>
          <p className="page-sub">
            Instrukcja, według której Claude pisze opisy firm. Zmiana działa od najbliższej sesji Claude po przebiegu
            automatu GitHub (do 3 godzin).
          </p>
        </div>
      </div>
      {ok && <div className="alert ok">{ok}</div>}
      {error && <div className="alert bad">{error}</div>}

      <div className="kpis compact">
        <div className="kpi">
          <b>{changed ? "zmieniony" : "domyślny"}</b>
          <span>wersja prompta</span>
        </div>
        <div className="kpi">
          <b>{current?.updatedAt ? when(current.updatedAt).split(",")[0] : "-"}</b>
          <span>ostatnia zmiana{current?.updatedBy ? ` (${current.updatedBy})` : ""}</span>
        </div>
        <div className="kpi">
          <b>{text.length}</b>
          <span>znaków</span>
        </div>
      </div>

      <form action={promptAction} className="prompt-form">
        <label htmlFor="text">Treść prompta</label>
        <textarea id="text" name="text" defaultValue={text} rows={34} spellCheck={false} required minLength={200} maxLength={20000} />
        <div className="row-actions">
          <button className="primary" type="submit" name="action" value="save">
            Zapisz prompt
          </button>
          {changed && (
            <button type="submit" name="action" value="reset">
              Przywróć wersję domyślną
            </button>
          )}
        </div>
      </form>

      <p className="note">
        Niezależnie od prompta każdy opis sprawdza test: od 80 do 1400 znaków, każde zdanie musi opierać się na faktach
        z paczki, bez kopiowania zdań ze strony firmy, bez telefonów i e-maili w treści. Opis, który nie przejdzie testu,
        nie trafi na stronę. Nie używaj długich myślników.
      </p>
    </>
  );
}
