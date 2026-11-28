import Link from "next/link";

import { auditFormAction } from "@/app/actions";
import { Notice, one, type SP } from "@/components/Notice";
import { WaitlistForm } from "@/components/WaitlistForm";
import { Icon } from "@/components/ui/Icon";
import { BarList, Card, Gauge, Pill } from "@/components/ui/ui";
import { formatInt } from "@/lib/chart";
import { currentTerms } from "@/lib/affiliate-repo";
import { MIN_SAMPLE } from "@/lib/measure";
import { loadLanding, type LandingData } from "@/lib/landing-repo";
import { formatPlanPrice, loadPublicPlans } from "@/lib/plans";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Warsaw" });

function HeroPreview({ data }: { data: LandingData | null }) {
  const ex = data?.example ?? null;
  if (!ex) {
    // Brak danych (baza niedostępna albo brak pomiarów): neutralna ilustracja, bez liczb.
    return (
      <div className="float-card" aria-label="Ilustracja raportu">
        <div className="fc-top">
          <Pill tone="neutral" outline>Ilustracja raportu</Pill>
        </div>
        <div className="fc-split">
          <Gauge value={null} size="sm" legend={false} emptyLabel="Twój wynik" />
          <div className="skel">
            <i style={{ width: "70%" }} />
            <i style={{ width: "50%" }} />
            <i style={{ width: "62%" }} />
          </div>
        </div>
        <div className="skel">
          <i style={{ width: "88%" }} />
          <i style={{ width: "64%" }} />
          <i style={{ width: "40%" }} />
        </div>
        <p className="fc-note">Tak wygląda raport: wynik 0-100, firmy, które AI wymienia w Twoim mieście, i źródła, z których korzysta.</p>
      </div>
    );
  }
  const date = ex.measuredAt ? dateFmt.format(new Date(ex.measuredAt)) : "brak daty";
  const max = Math.max(...ex.top.map((t) => t.answers), 1);
  return (
    <div className="float-card">
      <div className="fc-top">
        <Pill tone="brand">Przykład z pomiaru z {date}, {ex.city}</Pill>
      </div>
      <div className="fc-split">
        <Gauge value={ex.firm?.score ?? null} size="sm" legend={false} />
        <div>
          <div className="muted small">Wynik widoczności firmy</div>
          <div className="fc-firm">{ex.firm?.name ?? "brak firmy z katalogu w próbie"}</div>
          <div className="muted small">
            {ex.firm?.score === null || !ex.firm ? `Za mało danych: ${ex.sample} odpowiedzi, potrzeba ${MIN_SAMPLE}.` : `Z ${ex.sample} odpowiedzi AI.`}
          </div>
        </div>
      </div>
      <div>
        <div className="sec-h" style={{ margin: "0 0 10px" }}>Najczęściej wymieniane w mieście</div>
        <BarList
          ranked
          items={ex.top.map((t) => ({
            key: `${t.brandId ?? t.domain ?? t.name}`,
            label: t.name,
            valueText: `${t.answers} z ${ex.sample}`,
            ratio: t.answers / max,
          }))}
        />
      </div>
      <p className="fc-note">
        To fragment naszego pomiaru, nie Twój wynik. Dla Twojej domeny policzymy go w audycie ({ex.sample} odpowiedzi AI w mieście {ex.city}).
      </p>
    </div>
  );
}

const FAQ = [
  {
    q: "Skąd wiecie, co mówią asystenci AI?",
    a: "Zadajemy asystentom AI pytania, które zadaliby Twoi klienci (np. „jakie biuro nieruchomości polecacie w moim mieście?”), i zapisujemy odpowiedzi razem z datą pomiaru. Liczymy tylko to, co asystent faktycznie zwrócił, bez własnych szacunków.",
  },
  {
    q: "Jakie platformy mierzycie?",
    a: "Obecnie Gemini, Google AI Mode i Google AI Overview. ChatGPT dodamy jako osobne źródło pomiarów, zanim ogłosimy je w pakietach.",
  },
  {
    q: "Jak pewny jest wynik?",
    a: "Każdy wskaźnik pokazujemy z liczbą odpowiedzi i datami pomiaru. Gdy próba jest mniejsza niż 10 odpowiedzi, piszemy, że danych jest za mało, zamiast podawać procent.",
  },
  {
    q: "Czy audyt jest naprawdę bezpłatny?",
    a: "Tak. Pierwsza wersja korzysta z pomiarów, które już mamy, dla firm z naszego katalogu biur nieruchomości. Pełny audyt z pomiarem na żywo dla każdej firmy jest w przygotowaniu.",
  },
  {
    q: "Kiedy ruszą płatne pakiety?",
    a: "Płatności jeszcze nie działają. Zapisz się na listę oczekujących, a napiszemy jedną wiadomość, gdy pakiety będą dostępne.",
  },
  {
    q: "Czy mogę zarabiać na poleceniach?",
    a: "Tak. Program partnerski wypłaca prowizję od każdej płatności poleconego klienta, tak długo, jak klient płaci. Zasady są na stronie programu.",
  },
];

export default async function Home({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const [data, plans, terms] = await Promise.all([
    loadLanding(),
    loadPublicPlans(),
    currentTerms().catch(() => null),
  ]);
  const ratePct = terms ? terms.rateBps / 100 : 20;
  const saved = Boolean(sp.zapisano);
  const err = one(sp.error);
  return (
    <>
      {saved || err ? (
        <div className="wrap" style={{ paddingTop: 16 }}>
          <Notice error={err} ok={saved ? "Zapisane. Napiszemy, gdy pełny audyt będzie gotowy." : null} />
        </div>
      ) : null}

      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <span className="trust">
              <span className="tdot"><Icon name="check" size={12} strokeWidth={3} /></span>
              Pomiary: Gemini, Google AI Mode, Google AI Overview
            </span>
            <div className="eyebrow" style={{ marginTop: 22 }}>Widoczność w asystentach AI</div>
            <h1>
              <span className="ln">Czy ChatGPT i Gemini</span>
              <span className="ln brand-ln">polecają Twoją firmę,</span>
              <span className="ln">czy konkurencję?</span>
            </h1>
            <p className="lead">
              Klienci pytają asystentów AI, kogo wybrać. Sprawdzamy prawdziwe odpowiedzi na ich pytania, pokazujemy, kogo AI
              polecało zamiast Ciebie, i z jakich stron korzysta.
            </p>
            <form action={auditFormAction} className="hero-form" role="search">
              <input name="domain" type="text" required maxLength={300} placeholder="Adres strony firmy, np. mojafirma.pl" autoComplete="url" aria-label="Adres strony firmy" />
              <button type="submit" className="btn lg">
                Sprawdź widoczność <Icon name="arrow" size={16} />
              </button>
            </form>
            <ul className="checks">
              <li><Icon name="check" size={16} strokeWidth={2.5} /> Bezpłatnie</li>
              <li><Icon name="check" size={16} strokeWidth={2.5} /> Bez rejestracji</li>
              <li><Icon name="check" size={16} strokeWidth={2.5} /> Prawdziwe odpowiedzi AI</li>
            </ul>
          </div>
          <HeroPreview data={data} />
        </div>
      </section>

      {data ? (
        <div className="band">
          <div className="wrap stats-band">
            <div>
              <b>{formatInt(data.stats.answers)}</b>
              <span>odpowiedzi AI zmierzonych</span>
              <small>każda z datą i pytaniem</small>
            </div>
            <div>
              <b>{formatInt(data.stats.cities)}</b>
              <span>miast z pomiarem</span>
              <small>pytania o firmy w danym mieście</small>
            </div>
            <div>
              <b>{formatInt(data.stats.companies)}</b>
              <span>firm z katalogu wymienionych w odpowiedziach</span>
              <small>dopasowane do naszego katalogu</small>
            </div>
            <div>
              <b>{formatInt(data.stats.platforms)}</b>
              <span>platformy AI w pomiarach</span>
              <small>Gemini, Google AI Mode, Google AI Overview</small>
            </div>
          </div>
        </div>
      ) : null}

      <section className="section" id="jak">
        <div className="wrap">
          <div className="sec-head">
            <div className="eyebrow">Jak to działa</div>
            <h2>Od adresu strony do listy zadań w trzech krokach</h2>
          </div>
          <div className="g3">
            <div className="card step">
              <span className="step-n">1</span>
              <h3>Wpisujesz adres strony</h3>
              <p>Dopasowujemy firmę do naszego katalogu i jej miasta. Nie pobieramy Twojej strony i nie musisz zakładać konta.</p>
            </div>
            <div className="card step">
              <span className="step-n">2</span>
              <h3>Pokazujemy odpowiedzi AI</h3>
              <p>Ile razy asystenci wymieniają Twoją firmę, kogo wymieniają częściej i jakie strony cytują. Wszystko z datą pomiaru.</p>
            </div>
            <div className="card step">
              <span className="step-n">3</span>
              <h3>Dostajesz plan działań</h3>
              <p>Krótka lista wniosków, które wynikają wyłącznie z liczb w raporcie, bez obietnic i zgadywania.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section alt">
        <div className="wrap">
          <div className="sec-head">
            <div className="eyebrow">Co dostajesz</div>
            <h2>Raport, który da się przeczytać w pięć minut</h2>
            <p>Układ raportu poniżej to schemat. Prawdziwe liczby zobaczysz po wpisaniu swojej domeny.</p>
          </div>
          <div className="g3">
            <div className="card feat">
              <div className="feat-prev" aria-hidden="true">
                <Gauge value={null} size="sm" legend={false} emptyLabel="Twój wynik" />
              </div>
              <div className="feat-t">
                <h3>Wynik widoczności 0-100</h3>
                <p>Jedna liczba z trzema pasmami oraz tabela: wzmianki, polecenia, cytowania, udział w odpowiedziach i pozycja, każda z celem.</p>
              </div>
            </div>
            <div className="card feat">
              <div className="feat-prev" aria-hidden="true">
                {[78, 54, 36, 22].map((w, i) => (
                  <div className="sk-row" key={i}>
                    <span className="bl-rank">{i + 1}</span>
                    <i style={{ width: `${w}%` }} />
                    <u style={{ width: 28 }} />
                  </div>
                ))}
              </div>
              <div className="feat-t">
                <h3>Konkurenci i źródła</h3>
                <p>Kogo AI wymienia w Twoim mieście najczęściej i z których stron korzysta, z zaznaczeniem Twojego profilu w katalogu.</p>
              </div>
            </div>
            <div className="card feat">
              <div className="feat-prev" aria-hidden="true">
                {[true, true, false, false].map((on, i) => (
                  <div className="sk-row" key={i}>
                    <span className={`sk-circle${on ? " on" : ""}`} />
                    <i style={{ width: `${70 - i * 10}%` }} />
                  </div>
                ))}
              </div>
              <div className="feat-t">
                <h3>Lista zadań i historia</h3>
                <p>Konkretne kroki wynikające z liczb oraz tygodniowa historia wzmianek, gdy zbierzemy co najmniej dwa pomiary.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="cennik">
        <div className="wrap">
          <div className="sec-head center">
            <div className="eyebrow">Cennik</div>
            <h2>Zacznij za darmo, monitoruj, gdy będziesz gotowy</h2>
            <p>Ceny netto miesięcznie. Płatności jeszcze nie działają: pakiety płatne uruchomimy wkrótce.</p>
          </div>
          <div className="plans">
            {plans.map((p) => (
              <div key={p.id} className={`card plan${p.highlight ? " hl" : ""}`}>
                {p.highlight ? <span className="pill p-badge">Najczęściej wybierany</span> : null}
                <h3>{p.name}</h3>
                <div className="price">
                  {formatPlanPrice(p)} <small>/ mies. netto</small>
                </div>
                <ul>
                  {p.features.map((f) => (
                    <li key={f}>
                      <Icon name="check" size={15} strokeWidth={2.5} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                {p.priceGrosze === 0 ? (
                  <Link href="/audyt" className="btn ghost block">Sprawdź darmowy audyt</Link>
                ) : (
                  <span className="btn ghost block" aria-disabled="true" role="button" tabIndex={-1}>Wkrótce</span>
                )}
              </div>
            ))}
          </div>
          <p className="note" style={{ textAlign: "center" }}>
            Chcesz wiedzieć, gdy pakiety ruszą? <Link href="#lista">Zapisz się na listę oczekujących</Link>.
          </p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="partner-band">
            <div>
              <div className="eyebrow" style={{ color: "rgba(255,255,255,.8)" }}>Program partnerski</div>
              <h2>Polecaj i zarabiaj {ratePct}% dożywotnio</h2>
              <p>
                Wygeneruj własny link. Od każdej płatności poleconego klienta dostajesz {ratePct}% kwoty netto, tak długo, jak klient
                płaci. Dla agencji, freelancerów i każdego, kto zna firmy szukające klientów.
              </p>
              <p style={{ marginTop: 18 }}>
                <Link href="/partner" className="btn lg">Zobacz program partnerski</Link>
              </p>
            </div>
            <div className="pb-nums">
              <div><b>{ratePct}%</b><span>od każdej płatności netto</span></div>
              <div><b>dożywotnio</b><span>klient przypisany na stałe</span></div>
              {terms ? <div><b>{terms.holdDays} dni</b><span>okres na zwroty przed wypłatą</span></div> : null}
              {terms ? <div><b>{terms.cookieDays} dni</b><span>tyle pamiętamy kliknięcie linku</span></div> : null}
            </div>
          </div>
        </div>
      </section>

      <section className="section alt" id="faq">
        <div className="wrap">
          <div className="sec-head center">
            <div className="eyebrow">Pytania</div>
            <h2>Najczęstsze pytania</h2>
          </div>
          <div className="faq">
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="lista">
        <div className="wrap">
          <div className="cta-final">
            <div>
              <div className="eyebrow">Pełny audyt</div>
              <h2>Chcesz pomiar na żywo dla swojej firmy?</h2>
              <p className="muted">
                Pierwsza wersja audytu opiera się na pomiarach biblioteki dla miasta. Pełny audyt, z pytaniami Twoich klientów o
                Twoją firmę, jest w przygotowaniu. Zostaw adres, a wyślemy jedną wiadomość, gdy będzie gotowy.
              </p>
            </div>
            <Card>
              <WaitlistForm from="/" button="Zapisz mnie na listę" />
            </Card>
          </div>
        </div>
      </section>
    </>
  );
}
