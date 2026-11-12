"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { CONSENT_COOKIE, CONSENT_MAX_AGE_DAYS, CONSENT_VERSION } from "@/lib/consent";

/**
 * Zgoda na pliki cookie i podobne technologie (art. 399 Prawa komunikacji elektronicznej, RODO).
 * Kategorie: niezbędne (zawsze) i statystyczne (skrypt WitekCRM, tylko po zgodzie).
 * Wybór zapisujemy w ciasteczku rbn_zgoda: "v=<wersja>&s=<0|1>&t=<data>". Odrzucenie jest tak samo łatwe jak akceptacja.
 */

export type Consent = { statistics: boolean };

const OPEN_EVENT = "rbn:otworz-zgode";
const CHANGE_EVENT = "rbn:zgoda";

export function readConsent(): Consent | null {
  if (typeof document === "undefined") return null;
  const raw = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${CONSENT_COOKIE}=`))
    ?.slice(CONSENT_COOKIE.length + 1);
  if (!raw) return null;
  const params = new URLSearchParams(decodeURIComponent(raw));
  if (Number(params.get("v")) !== CONSENT_VERSION) return null;
  return { statistics: params.get("s") === "1" };
}

function saveConsent(consent: Consent): void {
  const value = new URLSearchParams({
    v: String(CONSENT_VERSION),
    s: consent.statistics ? "1" : "0",
    t: new Date().toISOString().slice(0, 10),
  }).toString();
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(value)}; Max-Age=${CONSENT_MAX_AGE_DAYS * 86400}; Path=/; SameSite=Lax${secure}`;
  window.dispatchEvent(new CustomEvent<Consent>(CHANGE_EVENT, { detail: consent }));
}

/** Aktualna zgoda w komponentach klienta; null przed wyborem i podczas renderowania na serwerze. */
export function useConsent(): Consent | null {
  const [consent, setConsent] = useState<Consent | null>(null);
  useEffect(() => {
    setConsent(readConsent());
    const onChange = (event: Event) => setConsent((event as CustomEvent<Consent>).detail);
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, []);
  return consent;
}

/** Link otwierający ustawienia plików cookie (stopka, polityka prywatności). */
export function CookieSettingsLink({ children = "Ustawienia cookies" }: { children?: React.ReactNode }) {
  return (
    <button type="button" className="link-button" onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}>
      {children}
    </button>
  );
}

export function CookieConsent() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(false);
  const [statistics, setStatistics] = useState(false);
  const firstButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const current = readConsent();
    if (current === null) setOpen(true);
    else setStatistics(current.statistics);
    const onOpen = () => {
      const saved = readConsent();
      setStatistics(saved?.statistics ?? false);
      setDetails(true);
      setOpen(true);
      requestAnimationFrame(() => firstButton.current?.focus());
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  const choose = useCallback((consent: Consent) => {
    const before = readConsent();
    saveConsent(consent);
    setStatistics(consent.statistics);
    setOpen(false);
    setDetails(false);
    // Skryptu, który już działa, nie da się wyłączyć bez przeładowania strony.
    if (before?.statistics && !consent.statistics) window.location.reload();
  }, []);

  if (!open || pathname?.startsWith("/admin")) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-modal="false" aria-labelledby="cookie-title">
      <div className="cookie-inner">
        <p id="cookie-title" className="cookie-title">
          Pliki cookie i statystyki
        </p>
        <p className="cookie-text">
          Używamy plików cookie niezbędnych do działania serwisu. Za Twoją zgodą włączymy też statystyki odwiedzin, które
          pomagają nam ulepszać serwis. Nie używamy reklam ani śledzenia między stronami. Szczegóły znajdziesz w{" "}
          <Link href="/polityka-prywatnosci#cookies">Polityce prywatności</Link>.
        </p>

        {details && (
          <fieldset className="cookie-options">
            <legend className="sr-only">Kategorie plików cookie</legend>
            <label className="cookie-option">
              <input type="checkbox" checked disabled />
              <span>
                <b>Niezbędne</b> zawsze włączone. Zapamiętują Twój wybór i pozwalają korzystać z serwisu.
              </span>
            </label>
            <label className="cookie-option">
              <input type="checkbox" checked={statistics} onChange={(e) => setStatistics(e.target.checked)} />
              <span>
                <b>Statystyczne</b> liczenie odwiedzin w systemie WitekCRM, bez plików cookie i bez reklam.
              </span>
            </label>
          </fieldset>
        )}

        <div className="cookie-actions">
          <button ref={firstButton} type="button" className="cookie-btn" onClick={() => choose({ statistics: true })}>
            Akceptuję wszystkie
          </button>
          <button type="button" className="cookie-btn" onClick={() => choose({ statistics: false })}>
            Tylko niezbędne
          </button>
          {details ? (
            <button type="button" className="cookie-btn secondary" onClick={() => choose({ statistics })}>
              Zapisz wybór
            </button>
          ) : (
            <button type="button" className="cookie-btn secondary" onClick={() => setDetails(true)}>
              Ustawienia
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
