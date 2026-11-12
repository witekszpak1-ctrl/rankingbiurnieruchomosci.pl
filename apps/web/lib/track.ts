/**
 * Zdarzenia dla narzędzi analitycznych i reklamowych (wywołanie z komponentów klienta).
 * Zdarzenie trafia do narzędzi tylko wtedy, gdy odwiedzający zgodził się na ich kategorię; obsługę (GA4, piksel Meta
 * z Conversions API, TikTok, Tag Manager) zapewnia components/CookieConsent.tsx. Bez zgody zdarzenia są pomijane.
 */

export type TrackName =
  | "PageView"
  | "ViewContent"
  | "Contact"
  | "Lead"
  | "Search"
  | "SubmitApplication"
  | "OfferClick"
  | "WebsiteClick";

export type TrackParams = Record<string, string | number>;
export type TrackOptions = { eventId?: string; serverSent?: boolean };
type Entry = [TrackName, TrackParams, TrackOptions];

declare global {
  interface Window {
    __rbnTrack?: (name: TrackName, params: TrackParams, options: TrackOptions) => void;
    __rbnQueue?: Entry[];
  }
}

export function track(name: TrackName, params: TrackParams = {}, options: TrackOptions = {}): void {
  if (typeof window === "undefined") return;
  if (window.__rbnTrack) window.__rbnTrack(name, params, options);
  else (window.__rbnQueue ??= []).push([name, params, options]);
}

export const TRACK_NAMES: TrackName[] = [
  "PageView", "ViewContent", "Contact", "Lead", "Search", "SubmitApplication", "OfferClick", "WebsiteClick",
];
