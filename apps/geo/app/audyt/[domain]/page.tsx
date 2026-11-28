import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import Link from "next/link";

import { Notice, one, type SP } from "@/components/Notice";
import { WaitlistForm } from "@/components/WaitlistForm";
import { MIN_SAMPLE } from "@/lib/measure";
import { OWN_PORTAL_DOMAIN, buildAudit, normalizeDomain, type AuditResult, type RateView } from "@/lib/audit";
import { loadAuditInput } from "@/lib/audit-repo";

// Wynik zależy od adresu i od bazy, ale jest tylko do odczytu: renderujemy na żądanie i trzymamy wynik w pamięci
// podręcznej serwera przez godzinę (pomiary biblioteki odświeżają się raz w tygodniu), więc powtarzane wejścia
// na ten sam adres nie obciążają bazy.
export const dynamic = "force-dynamic";
const CACHE_SECONDS = 3600;

const loadAudit = unstable_cache(
  async (domain: string): Promise<AuditResult> => buildAudit(await loadAuditInput(domain)),
  ["audyt-v1"],
  { revalidate: CACHE_SECONDS },
);

type Params = Promise<{ domain: string }>;

function decode(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return "";
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const domain = normalizeDomain(decode((await params).domain));
  return {
    title: domain ? `Audyt widoczności w AI: ${domain}` : "Audyt widoczności w AI",
    robots: { index: false, follow: false },
  };
}

const dateFmt = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Warsaw" });
function fmtDate(iso: string | null): string {
  return iso ? dateFmt.format(new Date(iso)) : "brak daty";
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

function range(r: RateView): string {
  return `przedział 95%: ${pct(r.low)} - ${pct(r.high)}`;
}

function Stat({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <div className="card stat">
      <b>{value}</b>
      <span>{title}</span>
      <p className="muted small">{note}</p>
    </div>
  );
}

function Missing({ domain, status, sp }: { domain: string; status: "not_in_catalog" | "no_measurements"; sp: Record<string, string | string[] | undefined> }) {
  return (
    <>
      <h1>Audyt widoczności w AI: {domain}</h1>
      {status === "not_in_catalog" ? (
        <p className="lead">
          Nie znamy jeszcze tej strony: nie ma jej w naszym katalogu biur nieruchomości, więc nie wiemy, w jakim mieście działa,
          i nie mamy pomiarów, które da się do niej przypisać. Nie zgadujemy wyniku.
        </p>
      ) : (
        <p className="lead">
          Firma jest w naszym katalogu, ale nie mamy jeszcze świeżych pomiarów odpowiedzi AI dla jej miasta (z ostatnich 30 dni).
          Pomiary robimy co tydzień dla 20 największych miast, więc możliwe, że Twoje miasto jeszcze na nie czeka.
        </p>
      )}
      <p>
        Pełny audyt, z pomiarem na żywo dla Twojej firmy i Twoich pytań klientów, będzie osobną usługą. Zostaw adres, a wyślemy
        jedną wiadomość, gdy będzie gotowy.
      </p>
      <Notice ok={sp.zapisano ? "Zapisane. Napiszemy, gdy pełny audyt będzie gotowy." : null} error={one(sp.error)} />
      <WaitlistForm domain={domain} from={`/audyt/${encodeURIComponent(domain)}`} />
      <p className="small">
        <Link href="/audyt">Sprawdź inny adres</Link>
      </p>
    </>
  );
}

export default async function AuditResultPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  const sp = await searchParams;
  const domain = normalizeDomain(decode((await params).domain));
  if (!domain) {
    return (
      <>
        <h1>Audyt widoczności w AI</h1>
        <p className="error" role="alert">To nie wygląda na adres strony firmy. Wpisz zwykłą domenę, np. mojafirma.pl.</p>
        <p><Link href="/audyt" className="btn">Wróć do formularza</Link></p>
      </>
    );
  }

  let audit: AuditResult;
  try {
    audit = await loadAudit(domain);
  } catch {
    return (
      <>
        <h1>Audyt widoczności w AI: {domain}</h1>
        <p className="error" role="alert">Audyt jest chwilowo niedostępny. Spróbuj ponownie za kilka minut.</p>
        <p><Link href="/audyt">Wróć do formularza</Link></p>
      </>
    );
  }

  if (audit.status !== "ok") return <Missing domain={domain} status={audit.status} sp={sp} />;

  const { usage, rates } = audit;
  const cityName = audit.city?.name ?? "";
  const n = usage.count;
  const dates =
    usage.firstMeasuredAt && usage.lastMeasuredAt && fmtDate(usage.firstMeasuredAt) !== fmtDate(usage.lastMeasuredAt)
      ? `od ${fmtDate(usage.firstMeasuredAt)} do ${fmtDate(usage.lastMeasuredAt)}`
      : fmtDate(usage.lastMeasuredAt);
  const noData = `za mało danych (próba ${n}, potrzeba ${MIN_SAMPLE})`;

  return (
    <>
      <h1>Audyt widoczności w AI: {audit.firmName}</h1>
      <p className="lead">
        {domain}, miasto {cityName}. Wynik opiera się na {n} odpowiedziach asystentów AI na pytania klientów o biura
        nieruchomości w tym mieście, zmierzonych {dates}.
      </p>
      <p className="small muted">
        Platformy: {usage.platforms.map((p) => `${p.label} (${p.count})`).join(", ")}. To pomiar z biblioteki wspólnej dla wszystkich
        firm w mieście, nie pytanie zadane specjalnie o Twoją firmę.
      </p>

      <h2>Wynik</h2>
      <div className="grid">
        <Stat
          title="Wynik widoczności 0-100"
          value={audit.score === null ? "za mało danych" : String(audit.score)}
          note={audit.score === null ? noData : "Średnia ważona wskaźników poniżej (wzmianki, polecenia, cytowania, pozycja)."}
        />
        <Stat
          title="Odpowiedzi z Twoją firmą"
          value={`${audit.mentionedAnswers} z ${n}`}
          note={rates ? `${pct(rates.mention.value)}, ${range(rates.mention)}` : noData}
        />
        <Stat
          title="Odpowiedzi, w których firma jest polecana"
          value={`${audit.recommendedAnswers} z ${n}`}
          note={rates ? `${pct(rates.recommendation.value)}, ${range(rates.recommendation)}` : noData}
        />
        <Stat
          title="Odpowiedzi cytujące Twoją stronę"
          value={`${audit.citedAnswers} z ${n}`}
          note={rates ? `${pct(rates.citation.value)}, ${range(rates.citation)}` : noData}
        />
      </div>

      <h2>Co możesz zrobić</h2>
      <ul>
        {audit.recommendations.map((r, i) => (
          <li key={i}>
            {r.text}
            {r.href ? (
              <>
                {" "}
                <a href={r.href} rel="noopener">Zobacz profil</a>
              </>
            ) : null}
          </li>
        ))}
      </ul>

      <h2>Wyniki według platform</h2>
      <div className="tw">
        <table>
          <thead>
            <tr><th>Platforma</th><th>Odpowiedzi</th><th>Z Twoją firmą</th></tr>
          </thead>
          <tbody>
            {audit.byPlatform.map((p) => (
              <tr key={p.platform}><td>{p.label}</td><td>{p.sample}</td><td>{p.mentionedAnswers}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Kogo AI wymienia w mieście {cityName}</h2>
      {audit.competitors.length ? (
        <div className="tw">
          <table>
            <thead>
              <tr><th>Firma</th><th>Odpowiedzi z wzmianką</th><th>Udział</th><th>Polecana w</th><th>W katalogu</th></tr>
            </thead>
            <tbody>
              {audit.competitors.map((c, i) => (
                <tr key={`${c.name}-${i}`}>
                  <td>{c.name}{c.domain ? <span className="muted small"> ({c.domain})</span> : null}</td>
                  <td>{c.answers} z {n}</td>
                  <td>{pct(c.share)}</td>
                  <td>{c.recommendedAnswers}</td>
                  <td>{c.inCatalog ? "tak" : "nie"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">W tych odpowiedziach AI nie wymieniło żadnej innej firmy.</p>
      )}

      <h2>Z jakich stron korzysta AI</h2>
      {audit.citedDomains.length ? (
        <div className="tw">
          <table>
            <thead>
              <tr><th>Strona</th><th>Odpowiedzi, które ją cytują</th><th>Udział</th></tr>
            </thead>
            <tbody>
              {audit.citedDomains.map((c) => (
                <tr key={c.domain}>
                  <td>{c.domain}{c.isOwnPortal ? <span className="pill"> nasz portal</span> : null}</td>
                  <td>{c.answers} z {n}</td>
                  <td>{pct(c.share)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">Odpowiedzi nie podawały źródeł.</p>
      )}
      <p className="small muted">
        {audit.ownPortal.cited
          ? `Nasz portal ${OWN_PORTAL_DOMAIN} jest cytowany w ${audit.ownPortal.answers} z ${n} odpowiedzi.`
          : `Nasz portal ${OWN_PORTAL_DOMAIN} nie jest cytowany w żadnej z tych odpowiedzi.`}
        {audit.profileUrl ? (
          <>
            {" "}
            Twój profil w katalogu: <a href={audit.profileUrl} rel="noopener">{audit.profileUrl}</a>.
          </>
        ) : null}
      </p>

      <h2>Pytania, na które odpowiadało AI</h2>
      <ul className="small">
        {usage.prompts.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>

      <h2>Chcesz pełny audyt?</h2>
      <p>
        To jest wersja pierwsza: opiera się na pomiarach biblioteki dla miasta. Pełny audyt zmierzy na żywo pytania Twoich klientów
        o Twoją firmę. Zostaw adres, a wyślemy jedną wiadomość, gdy będzie gotowy.
      </p>
      <Notice ok={sp.zapisano ? "Zapisane. Napiszemy, gdy pełny audyt będzie gotowy." : null} error={one(sp.error)} />
      <WaitlistForm domain={domain} from={`/audyt/${encodeURIComponent(domain)}`} />
      <p className="small">
        <Link href="/audyt">Sprawdź inny adres</Link>
      </p>
    </>
  );
}
