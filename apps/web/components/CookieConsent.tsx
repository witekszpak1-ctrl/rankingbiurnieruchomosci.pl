"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { CONSENT_COOKIE, CONSENT_MAX_AGE_DAYS, CONSENT_VERSION } from "@/lib/consent";
import { track, type TrackName, type TrackOptions, type TrackParams } from "@/lib/track";
import { type PublicTracking, toolsIn, WITEKCRM } from "@/lib/tracking-tools";

/**
 * Zgoda na pliki cookie i podobne technologie (art. 399 Prawa komunikacji elektronicznej, RODO) oraz wczytywanie
 * narzędzi analitycznych i reklamowych dopiero po zgodzie. Kategorie: niezbędne (zawsze), statystyczne, marketingowe.
 * Wybór zapisujemy w ciasteczku rbn_zgoda: "v=<wersja>&s=<0|1>&m=<0|1>&k=<wersja narzędzi>&t=<data>".
 * Gdy w panelu dojdzie lub zniknie narzędzie, zmienia się wersja narzędzi i baner pyta o zgodę ponownie.
 * Odrzucenie jest tak samo łatwe jak akceptacja. Liczenie wszystkich wejść przez serwer działa niezależnie od zgody.
 */

export type Consent = { statistics: boolean; marketing: boolean };

const OPEN_EVENT = "rbn:otworz-zgode";
const TEST_PARAM = "test_narzedzi";
const TEST_FLAG = "rbn_test_narzedzi";
const EMPTY: PublicTracking = { version: "", ids: {}, customStatistics: null, customMarketing: null };

type Stored = Consent & { tools: string };

function readStored(): Stored | null {
  const raw = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${CONSENT_COOKIE}=`))
    ?.slice(CONSENT_COOKIE.length + 1);
  if (!raw) return null;
  const params = new URLSearchParams(decodeURIComponent(raw));
  if (Number(params.get("v")) !== CONSENT_VERSION) return null;
  return { statistics: params.get("s") === "1", marketing: params.get("m") === "1", tools: params.get("k") ?? "" };
}

function saveConsent(consent: Consent, tools: string): void {
  const value = new URLSearchParams({
    v: String(CONSENT_VERSION),
    s: consent.statistics ? "1" : "0",
    m: consent.marketing ? "1" : "0",
    k: tools,
    t: new Date().toISOString().slice(0, 10),
  }).toString();
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(value)}; Max-Age=${CONSENT_MAX_AGE_DAYS * 86400}; Path=/; SameSite=Lax${secure}`;
}

/** Link otwierający ustawienia plików cookie (stopka, polityka prywatności). */
export function CookieSettingsLink({ children = "Ustawienia cookies" }: { children?: React.ReactNode }) {
  return (
    <button type="button" className="link-button" onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}>
      {children}
    </button>
  );
}

// ----------------------------------------------------------------------------- wczytywanie narzędzi

const loaded = new Set<string>();

function addScript(key: string, attrs: { src?: string; text?: string; data?: Record<string, string> }): void {
  if (loaded.has(key)) return;
  loaded.add(key);
  const el = document.createElement("script");
  if (attrs.src) {
    el.src = attrs.src;
    el.async = true;
  }
  if (attrs.text) el.text = attrs.text;
  for (const [name, value] of Object.entries(attrs.data ?? {})) el.setAttribute(`data-${name}`, value);
  document.head.appendChild(el);
}

/** Wkleja własny kod z panelu: skrypty trzeba utworzyć od nowa, żeby przeglądarka je uruchomiła. */
function addCustomCode(key: string, html: string): void {
  if (loaded.has(key)) return;
  loaded.add(key);
  const template = document.createElement("template");
  template.innerHTML = html;
  for (const node of Array.from(template.content.childNodes)) {
    if (node instanceof HTMLScriptElement) {
      const script = document.createElement("script");
      for (const attr of Array.from(node.attributes)) script.setAttribute(attr.name, attr.value);
      script.text = node.text;
      document.head.appendChild(script);
    } else {
      document.body.appendChild(node);
    }
  }
}

function consentModeValues(c: Consent) {
  const ad = c.marketing ? "granted" : "denied";
  return `{analytics_storage:'${c.statistics ? "granted" : "denied"}',ad_storage:'${ad}',ad_user_data:'${ad}',ad_personalization:'${ad}'}`;
}

function loadTools(config: PublicTracking, c: Consent): void {
  const { ids } = config;
  const production = process.env.NODE_ENV === "production";
  if (c.statistics && production) addScript("witekcrm", { src: WITEKCRM.src, data: { site: WITEKCRM.site } });

  const googleIds = [c.statistics && ids.ga4, c.marketing && ids.googleAds].filter(Boolean) as string[];
  const gtm = ids.gtm && (c.statistics || c.marketing) ? ids.gtm : null;
  if (googleIds.length || gtm) {
    if (!loaded.has("gtag-base")) {
      addScript("gtag-base", {
        text: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('consent','default',${consentModeValues(c)});gtag('js',new Date());`,
      });
    } else {
      addScript(`gtag-update-${c.statistics}-${c.marketing}`, { text: `gtag('consent','update',${consentModeValues(c)});` });
    }
    for (const id of googleIds) addScript(`gtag-config-${id}`, { text: `gtag('config','${id}');` });
    if (googleIds.length) addScript("gtag-js", { src: `https://www.googletagmanager.com/gtag/js?id=${googleIds[0]}` });
    if (gtm) {
      addScript("gtm", {
        text: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s);j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtm}');`,
      });
    }
  }
  if (c.statistics && ids.clarity) {
    addScript("clarity", {
      text: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${ids.clarity}");`,
    });
  }
  if (c.statistics && ids.hotjar) {
    addScript("hotjar", {
      text: `(function(h,o,t,j,a,r){h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};h._hjSettings={hjid:${ids.hotjar},hjsv:6};a=o.getElementsByTagName('head')[0];r=o.createElement('script');r.async=1;r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;a.appendChild(r);})(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');`,
    });
  }
  if (c.marketing && ids.metaPixel) {
    addScript("meta-pixel", {
      text: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${ids.metaPixel}');`,
    });
  }
  if (c.marketing && ids.tiktok) {
    addScript("tiktok", {
      text: `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};ttq.load('${ids.tiktok}');ttq.page();}(window,document,'ttq');`,
    });
  }
  if (c.marketing && ids.linkedin) {
    addScript("linkedin", {
      text: `window._linkedin_data_partner_ids=window._linkedin_data_partner_ids||[];window._linkedin_data_partner_ids.push('${ids.linkedin}');(function(l){if(!l){window.lintrk=function(a,b){window.lintrk.q.push([a,b])};window.lintrk.q=[]}var s=document.getElementsByTagName("script")[0];var b=document.createElement("script");b.type="text/javascript";b.async=true;b.src="https://snap.licdn.com/li.lms-analytics/insight.min.js";s.parentNode.insertBefore(b,s);})(window.lintrk);`,
    });
  }
  if (c.statistics && config.customStatistics) addCustomCode("custom-statistics", config.customStatistics.code);
  if (c.marketing && config.customMarketing) addCustomCode("custom-marketing", config.customMarketing.code);
}

type TrackWindow = Window & {
  fbq?: (...args: unknown[]) => void;
  ttq?: { page: () => void; track: (name: string, params?: TrackParams) => void };
  gtag?: (...args: unknown[]) => void;
  dataLayer?: unknown[];
};

const META_STANDARD = new Set(["PageView", "ViewContent", "Contact", "Lead", "Search", "SubmitApplication"]);
const GA4_NAME: Partial<Record<TrackName, string>> = {
  ViewContent: "view_item",
  Contact: "contact",
  Lead: "generate_lead",
  Search: "search",
  SubmitApplication: "submit_application",
  OfferClick: "select_content",
  WebsiteClick: "click_website",
};
const TIKTOK_NAME: Partial<Record<TrackName, string>> = {
  ViewContent: "ViewContent",
  Contact: "Contact",
  Lead: "SubmitForm",
  Search: "Search",
  SubmitApplication: "SubmitForm",
  OfferClick: "ClickButton",
  WebsiteClick: "ClickButton",
};

function newEventId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Rozsyła zdarzenie do narzędzi, na które jest zgoda. Piksel Meta dostaje event_id wspólny z Conversions API. */
function dispatch(config: PublicTracking, c: Consent, test: boolean, name: TrackName, params: TrackParams, options: TrackOptions): void {
  const w = window as TrackWindow;
  const eventId = options.eventId ?? newEventId();
  if (c.statistics || c.marketing) w.dataLayer?.push({ event: `rbn_${name}`, ...params });
  if (c.statistics && config.ids.ga4 && w.gtag && GA4_NAME[name]) w.gtag("event", GA4_NAME[name], params);
  if (c.marketing && config.ids.metaPixel && w.fbq) {
    w.fbq(META_STANDARD.has(name) ? "track" : "trackCustom", name, params, { eventID: eventId });
    if (config.metaCapi && !options.serverSent) {
      fetch("/api/meta/zdarzenie", {
        method: "POST",
        keepalive: true,
        headers: { "content-type": "application/json", ...(test ? { "x-rbn-test": "1" } : {}) },
        body: JSON.stringify({ name, eventId, url: window.location.href, params }),
      }).catch(() => undefined);
    }
  }
  if (c.marketing && w.ttq && name !== "PageView" && TIKTOK_NAME[name]) w.ttq.track(TIKTOK_NAME[name] as string, params);
}

/** Kliknięcia elementów z data-track (np. data-track="WebsiteClick" data-track-content_name="...") i wysłanie
 *  formularza z data-track="Search" (wpisana fraza, np. miasto, jako search_string). */
function listenForTrackedElements(): () => void {
  const params = (el: HTMLElement): TrackParams => {
    const out: TrackParams = {};
    for (const [key, value] of Object.entries(el.dataset)) {
      if (key.startsWith("track") && key !== "track" && value) {
        const name = key.slice(5).replace(/^[A-Z]/, (ch) => ch.toLowerCase()).replace(/[A-Z]/g, (ch) => `_${ch.toLowerCase()}`);
        out[name] = value;
      }
    }
    return out;
  };
  const onClick = (event: MouseEvent) => {
    const el = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-track]");
    if (el && el.tagName !== "FORM") track(el.dataset.track as TrackName, params(el));
  };
  const onSubmit = (event: SubmitEvent) => {
    const form = event.target as HTMLFormElement | null;
    if (form?.dataset.track === "Search") {
      const field = form.querySelector<HTMLInputElement>('input[name="q"], input[name="miasto"], input[type="search"], input[type="text"]');
      const q = field?.value?.trim();
      track("Search", q ? { search_string: q.slice(0, 100) } : {});
    }
  };
  document.addEventListener("click", onClick, true);
  document.addEventListener("submit", onSubmit, true);
  return () => {
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("submit", onSubmit, true);
  };
}

// ----------------------------------------------------------------------------- baner

export function CookieConsent() {
  const pathname = usePathname();
  const [config, setConfig] = useState<PublicTracking | null>(null);
  const [consent, setConsent] = useState<Consent | null>(null);
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(false);
  const [draft, setDraft] = useState<Consent>({ statistics: false, marketing: false });
  const firstButton = useRef<HTMLButtonElement>(null);
  const firstPath = useRef<string | null>(null);
  const [testMode, setTestMode] = useState(false);

  useEffect(() => {
    let active = true;
    // Tryb testowy (tylko zalogowany administrator): ?test_narzedzi=1 włącza, ?test_narzedzi=0 wyłącza.
    const param = new URLSearchParams(window.location.search).get(TEST_PARAM);
    try {
      if (param === "1") sessionStorage.setItem(TEST_FLAG, "1");
      if (param === "0") sessionStorage.removeItem(TEST_FLAG);
    } catch {
      /* brak dostępu do sessionStorage: tryb testowy niedostępny */
    }
    let wantsTest = false;
    try {
      wantsTest = sessionStorage.getItem(TEST_FLAG) === "1";
    } catch {
      wantsTest = false;
    }
    const testCheck = wantsTest
      ? fetch("/api/sledzenie/test", { cache: "no-store" }).then((r) => r.ok).catch(() => false)
      : Promise.resolve(false);
    fetch("/api/sledzenie")
      .then((r) => (r.ok ? (r.json() as Promise<PublicTracking>) : EMPTY))
      .catch(() => EMPTY)
      .then(async (cfg) => {
        const isTest = await testCheck;
        if (!active) return;
        setConfig(cfg);
        if (isTest) {
          setTestMode(true);
          setConsent({ statistics: true, marketing: true });
          return;
        }
        const stored = readStored();
        if (stored && stored.tools === cfg.version) {
          setConsent({ statistics: stored.statistics, marketing: stored.marketing });
          setDraft({ statistics: stored.statistics, marketing: stored.marketing });
        } else {
          if (stored) setDraft({ statistics: stored.statistics, marketing: stored.marketing });
          setOpen(true);
        }
      });
    const onOpen = () => {
      setDetails(true);
      setOpen(true);
      requestAnimationFrame(() => firstButton.current?.focus());
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      active = false;
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (!config || !consent) return;
    loadTools(config, consent);
    if (!consent.statistics && !consent.marketing) {
      window.__rbnQueue = [];
      return;
    }
    const firstSetup = !window.__rbnTrack;
    window.__rbnTrack = (name, params, options) => dispatch(config, consent, testMode, name, params, options);
    const queued = window.__rbnQueue ?? [];
    window.__rbnQueue = [];
    if (firstSetup) track("PageView");
    for (const [name, params, options] of queued) track(name, params, options);
    return listenForTrackedElements();
  }, [config, consent, testMode]);

  useEffect(() => {
    if (firstPath.current === null) {
      firstPath.current = pathname;
      return;
    }
    if (consent?.marketing) {
      track("PageView");
      (window as TrackWindow).ttq?.page();
    }
  }, [pathname, consent]);

  const choose = useCallback(
    (next: Consent) => {
      const before = consent;
      saveConsent(next, config?.version ?? "");
      setConsent(next);
      setDraft(next);
      setOpen(false);
      setDetails(false);
      // Skryptów, które już działają, nie da się wyłączyć bez przeładowania strony.
      if ((before?.statistics && !next.statistics) || (before?.marketing && !next.marketing)) window.location.reload();
    },
    [consent, config],
  );

  if (testMode && !pathname?.startsWith("/admin")) {
    return (
      <div className="tracking-test-badge" role="status">
        Tryb testowy: wszystkie narzędzia z panelu działają bez zgody, tylko w tej przeglądarce (administrator).{" "}
        <a href={`${pathname}?${TEST_PARAM}=0`}>Wyłącz</a>
      </div>
    );
  }

  if (!open || !config || pathname?.startsWith("/admin")) return null;

  const statsTools = toolsIn(config, "statistics");
  const marketingTools = toolsIn(config, "marketing");
  const hasMarketing = marketingTools.length > 0;

  return (
    <div className="cookie-banner" role="dialog" aria-modal="false" aria-labelledby="cookie-title">
      <div className="cookie-inner">
        <p id="cookie-title" className="cookie-title">
          Pliki cookie i statystyki
        </p>
        <p className="cookie-text">
          Używamy plików cookie niezbędnych do działania serwisu. Za Twoją zgodą włączymy też narzędzia statystyczne
          {hasMarketing ? " i reklamowe" : ""}, które pomagają nam ulepszać serwis
          {hasMarketing ? " i mierzyć skuteczność reklam" : ""}. Szczegóły znajdziesz w{" "}
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
              <input
                type="checkbox"
                checked={draft.statistics}
                onChange={(e) => setDraft({ ...draft, statistics: e.target.checked })}
              />
              <span>
                <b>Statystyczne</b> liczenie odwiedzin i analiza korzystania ze strony: {statsTools.join(", ")}.
              </span>
            </label>
            {hasMarketing && (
              <label className="cookie-option">
                <input
                  type="checkbox"
                  checked={draft.marketing}
                  onChange={(e) => setDraft({ ...draft, marketing: e.target.checked })}
                />
                <span>
                  <b>Marketingowe</b> mierzenie skuteczności reklam i remarketing: {marketingTools.join(", ")}.
                </span>
              </label>
            )}
          </fieldset>
        )}

        <div className="cookie-actions">
          <button
            ref={firstButton}
            type="button"
            className="cookie-btn"
            onClick={() => choose({ statistics: true, marketing: hasMarketing })}
          >
            Akceptuję wszystkie
          </button>
          <button type="button" className="cookie-btn" onClick={() => choose({ statistics: false, marketing: false })}>
            Tylko niezbędne
          </button>
          {details ? (
            <button
              type="button"
              className="cookie-btn secondary"
              onClick={() => choose({ statistics: draft.statistics, marketing: hasMarketing && draft.marketing })}
            >
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
