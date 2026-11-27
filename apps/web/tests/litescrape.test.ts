import { describe, expect, it } from "vitest";

import { EMPTY_LITESCRAPE, maskKey, normalize, parseLiteScrapeForm } from "@/lib/litescrape";

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const KEY = "ls_live_abcdefghijklmnop1234";

describe("ustawienia LiteScrape z panelu", () => {
  it("zapisuje klucz bez spacji, a puste pole zostawia poprzedni", () => {
    const first = parseLiteScrapeForm(form({ apiKey: ` ${KEY}​ `, searchResults: "20", useSearch: "on", useMaps: "on" }));
    expect(first).toEqual({ ok: true, value: { apiKey: KEY, searchResults: 20, useSearch: true, useMaps: true, useFetch: false } });
    const kept = parseLiteScrapeForm(form({ apiKey: "", useFetch: "on" }), { ...EMPTY_LITESCRAPE, apiKey: KEY, searchResults: 20 });
    expect(kept.ok && kept.value.apiKey).toBe(KEY);
    expect(kept.ok && kept.value.searchResults).toBe(20);
  });

  it("usuwa klucz na żądanie, odrzuca urwany klucz i złą liczbę wyników", () => {
    const removed = parseLiteScrapeForm(form({ apiKey: "", apiKeyRemove: "on" }), { ...EMPTY_LITESCRAPE, apiKey: KEY });
    expect(removed.ok && removed.value.apiKey).toBeNull();
    expect(parseLiteScrapeForm(form({ apiKey: "abc" })).ok).toBe(false);
    expect(parseLiteScrapeForm(form({ searchResults: "5" })).ok).toBe(false);
    // autouzupełnianie e-maila przez przeglądarkę to nie klucz
    const email = parseLiteScrapeForm(form({ apiKey: "jan@example.com" }), { ...EMPTY_LITESCRAPE, apiKey: KEY });
    expect(email.ok && email.value.apiKey).toBe(KEY);
  });

  it("pokazuje tylko końcówkę klucza i ma domyślnie 30 wyników na frazę", () => {
    expect(maskKey(KEY)).toBe("zapisany (...1234)");
    expect(maskKey(null)).toBe("brak");
    expect(normalize({})).toEqual(EMPTY_LITESCRAPE);
    expect(normalize({ searchResults: 9999 }).searchResults).toBe(300);
  });
});
