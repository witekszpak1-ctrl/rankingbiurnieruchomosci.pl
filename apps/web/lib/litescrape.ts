/**
 * Ustawienia LiteScrape (settings.litescrape): klucz API i zakres użycia przez automat (apps/worker/katalog_worker/
 * litescrape.py). Tylko po stronie serwera. Klucz nigdy nie trafia do przeglądarki, logów ani dziennika zmian:
 * w panelu widać tylko jego cztery ostatnie znaki.
 */
import { query } from "./db";

export const LITESCRAPE_KEY = "litescrape";
export const DEFAULT_SEARCH_RESULTS = 30;
export const MAX_SEARCH_RESULTS = 300;
export const COST_PER_1000_USD = 0.15;
const KEY_RE = /^[A-Za-z0-9_.:-]{16,256}$/;

export type LiteScrapeSettings = {
  apiKey: string | null;
  /** Wyników Google na frazę (10 na stronę wyników), domyślnie 30. */
  searchResults: number;
  useSearch: boolean;
  useMaps: boolean;
  useFetch: boolean;
};

export const EMPTY_LITESCRAPE: LiteScrapeSettings = {
  apiKey: null,
  searchResults: DEFAULT_SEARCH_RESULTS,
  useSearch: true,
  useMaps: true,
  useFetch: true,
};

const clampResults = (n: unknown) =>
  typeof n === "number" && Number.isFinite(n) ? Math.min(MAX_SEARCH_RESULTS, Math.max(10, Math.round(n))) : DEFAULT_SEARCH_RESULTS;

export function normalize(value: Partial<LiteScrapeSettings> | null | undefined): LiteScrapeSettings {
  const v = value ?? {};
  return {
    apiKey: typeof v.apiKey === "string" && KEY_RE.test(v.apiKey) ? v.apiKey : null,
    searchResults: clampResults(v.searchResults),
    useSearch: v.useSearch !== false,
    useMaps: v.useMaps !== false,
    useFetch: v.useFetch !== false,
  };
}

export async function getLiteScrape(): Promise<LiteScrapeSettings> {
  const rows = await query<{ value: Partial<LiteScrapeSettings> }>("select value from settings where key = $1", [LITESCRAPE_KEY]).catch(
    () => [],
  );
  return normalize(rows[0]?.value);
}

export const maskKey = (key: string | null) => (key ? `zapisany (...${key.slice(-4)})` : "brak");

export type LiteScrapeParse = { ok: true; value: LiteScrapeSettings } | { ok: false; message: string };

/** Dane z formularza panelu. Puste pole klucza zostawia zapisany klucz (chyba że zaznaczono usunięcie). */
export function parseLiteScrapeForm(form: FormData, current: LiteScrapeSettings = EMPTY_LITESCRAPE): LiteScrapeParse {
  // Usuwamy spacje i niewidoczne znaki z wklejenia. Adres e-mail to autouzupełnianie przeglądarki, nie klucz.
  const raw = String(form.get("apiKey") ?? "").replace(/[\s​-‍﻿]/g, "");
  let apiKey = current.apiKey;
  if (form.get("apiKeyRemove") === "on") apiKey = null;
  else if (raw && !raw.includes("@")) {
    const key = raw.replace(/^Bearer/i, "");
    if (!KEY_RE.test(key)) return { ok: false, message: "Klucz LiteScrape wygląda na niepełny. Skopiuj go w całości z panelu LiteScrape." };
    apiKey = key;
  }
  const resultsRaw = String(form.get("searchResults") ?? "").trim();
  const results = Number(resultsRaw);
  if (resultsRaw && (!Number.isInteger(results) || results < 10 || results > MAX_SEARCH_RESULTS)) {
    return { ok: false, message: `Liczba wyników na frazę: od 10 do ${MAX_SEARCH_RESULTS}.` };
  }
  return {
    ok: true,
    value: {
      apiKey,
      searchResults: resultsRaw ? results : current.searchResults,
      useSearch: form.get("useSearch") === "on",
      useMaps: form.get("useMaps") === "on",
      useFetch: form.get("useFetch") === "on",
    },
  };
}

export type KeyStatus =
  | { ok: true; status: string; remainingCalls: number | null; concurrencyLimit: number | null }
  | { ok: false; message: string };

/** Stan klucza i saldo z GET /api/keys/status (nie zużywa zapytań). */
export async function keyStatus(apiKey: string): Promise<KeyStatus> {
  try {
    const response = await fetch("https://api.litescrape.com/api/keys/status", {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (response.status === 401) return { ok: false, message: "LiteScrape odrzucił klucz (sprawdź, czy skopiowano go w całości)." };
    if (response.status === 403) return { ok: false, message: "Klucz jest wyłączony w LiteScrape." };
    if (!response.ok) return { ok: false, message: `LiteScrape odpowiedział błędem ${response.status}.` };
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    return {
      ok: true,
      status: typeof data.status === "string" ? data.status : "active",
      remainingCalls: num(data.remaining_calls),
      concurrencyLimit: num(data.concurrency_limit),
    };
  } catch {
    return { ok: false, message: "Nie udało się połączyć z LiteScrape (spróbuj odświeżyć stronę)." };
  }
}
