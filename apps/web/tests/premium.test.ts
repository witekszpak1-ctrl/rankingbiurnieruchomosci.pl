import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { auditUrl } from "@/lib/audit-link";
import { hasPremiumContent, parsePremiumContent, safeUrl } from "@/lib/premium";
import { previewToken, verifyPreviewToken } from "@/lib/preview-token";

const SECRET = "0123456789abcdef0123456789abcdef0123";
const ID = "3f1c2a9e-5b7d-4c11-8a42-9d6e0b7f1a23";
/** Kod pliku bez komentarzy (komentarze wolno pisać o searchParams i headers). */
const src = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

describe("parsePremiumContent", () => {
  it("pusta albo błędna treść daje pustą warstwę", () => {
    for (const raw of [null, undefined, 5, "x", [], {}]) {
      expect(hasPremiumContent(parsePremiumContent(raw))).toBe(false);
    }
  });

  it("przycina, czyści i odrzuca niebezpieczne adresy", () => {
    const c = parsePremiumContent({
      long_description: "  Opis firmy.\u0000  ",
      specializations: ["Sprzedaż", "Sprzedaż", "", 5, "Wynajem"],
      service_areas: ["Wrocław"],
      faq: [{ q: "Ile?", a: "Tyle." }, { q: "", a: "x" }, { q: "bez odpowiedzi" }],
      team: [{ name: "Jan Kowalski", role: "Pośrednik" }, { role: "brak nazwy" }],
      gallery: [{ url: "https://example.pl/a.jpg", alt: "Biuro" }, { url: "javascript:alert(1)", alt: "x" }, { url: "data:text/html,x" }],
      video_url: "ftp://example.pl/film",
      cta_label: "Umów spotkanie",
      cta_url: "https://example.pl/kontakt",
    });
    expect(c.longDescription).toBe("Opis firmy.");
    expect(c.specializations).toEqual(["Sprzedaż", "Wynajem"]);
    expect(c.faq).toEqual([{ q: "Ile?", a: "Tyle." }]);
    expect(c.team).toEqual([{ name: "Jan Kowalski", role: "Pośrednik" }]);
    expect(c.gallery).toEqual([{ url: "https://example.pl/a.jpg", alt: "Biuro" }]);
    expect(c.videoUrl).toBeNull();
    expect(c.ctaUrl).toBe("https://example.pl/kontakt");
    expect(c.ctaLabel).toBe("Umów spotkanie");
    expect(hasPremiumContent(c)).toBe(true);
  });

  it("etykieta przycisku bez adresu nie tworzy przycisku", () => {
    const c = parsePremiumContent({ cta_label: "Kliknij", cta_url: "nie adres" });
    expect(c.ctaUrl).toBeNull();
    expect(c.ctaLabel).toBeNull();
    expect(hasPremiumContent(c)).toBe(false);
  });

  it("limity liczby elementów i długości", () => {
    const c = parsePremiumContent({
      long_description: "a".repeat(9000),
      specializations: Array.from({ length: 50 }, (_, i) => `s${i}`),
      faq: Array.from({ length: 30 }, (_, i) => ({ q: `q${i}`, a: "a" })),
    });
    expect(c.longDescription?.length).toBe(4000);
    expect(c.specializations).toHaveLength(20);
    expect(c.faq).toHaveLength(10);
  });

  it("safeUrl przepuszcza tylko http i https", () => {
    expect(safeUrl("https://example.pl/x")).toBe("https://example.pl/x");
    expect(safeUrl("http://example.pl")).toBe("http://example.pl/");
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("//example.pl")).toBeNull();
  });
});

describe("token podglądu", () => {
  it("poprawny token zwraca identyfikator wpisu", () => {
    const token = previewToken(ID, SECRET);
    expect(token).toMatch(/^[0-9a-f-]{36}\.[0-9a-f]{64}$/);
    expect(verifyPreviewToken(token, SECRET)).toBe(ID);
  });

  it("zły podpis, inny sekret, brak sekretu i zły format dają null", () => {
    const token = previewToken(ID, SECRET);
    expect(verifyPreviewToken(token.slice(0, -1) + (token.endsWith("0") ? "1" : "0"), SECRET)).toBeNull();
    expect(verifyPreviewToken(token, "x".repeat(40))).toBeNull();
    expect(verifyPreviewToken(token, undefined)).toBeNull();
    expect(verifyPreviewToken(token, "krotki")).toBeNull();
    expect(verifyPreviewToken("", SECRET)).toBeNull();
    expect(verifyPreviewToken(ID, SECRET)).toBeNull();
    expect(verifyPreviewToken(`${ID}.zzzz`, SECRET)).toBeNull();
  });

  it("token jednego wpisu nie pasuje do innego", () => {
    const other = "4f1c2a9e-5b7d-4c11-8a42-9d6e0b7f1a23";
    const sig = previewToken(ID, SECRET).split(".")[1];
    expect(verifyPreviewToken(`${other}.${sig}`, SECRET)).toBeNull();
  });

  it("odmawia podpisania nie-UUID i krótkiego sekretu", () => {
    expect(() => previewToken("nie-uuid", SECRET)).toThrow();
    expect(() => previewToken(ID, "krotki")).toThrow();
  });
});

describe("przycisk audytu", () => {
  it("bez NEXT_PUBLIC_GEO_AUDIT_URL nic nie zwraca (produkcja bez zmian)", () => {
    expect(auditUrl("example.pl", "wroclaw", "firma", undefined)).toBeNull();
    expect(auditUrl("example.pl", "wroclaw", "firma", "")).toBeNull();
    expect(auditUrl("example.pl", "wroclaw", "firma", "nie-adres")).toBeNull();
  });

  it("z adresem buduje /audyt/<domena> z parametrami utm", () => {
    const url = new URL(auditUrl("www.Example.pl", "wroclaw", "firma", "https://geotrace.pl/")!);
    expect(url.origin + url.pathname).toBe("https://geotrace.pl/audyt/example.pl");
    expect(url.searchParams.get("utm_source")).toBe("ranking");
    expect(url.searchParams.get("utm_medium")).toBe("profil");
    expect(url.searchParams.get("utm_campaign")).toBe("audyt-ai");
    expect(url.searchParams.get("utm_content")).toBe("wroclaw/firma");
  });

  it("brak lub dziwna domena firmy: bez przycisku", () => {
    expect(auditUrl(null, "wroclaw", "firma", "https://geotrace.pl")).toBeNull();
    expect(auditUrl("a b/../x", "wroclaw", "firma", "https://geotrace.pl")).toBeNull();
  });
});

describe("ISR profili i stron miast", () => {
  it("profil /[city]/[firm] i strona /[city] nie czytają parametrów żądania", () => {
    for (const file of ["../app/[city]/[firm]/page.tsx", "../app/[city]/page.tsx"]) {
      const text = src(file);
      expect(text, file).not.toMatch(/searchParams|headers\(|cookies\(/);
      expect(text, file).toMatch(/export const revalidate = 300/);
    }
    // Wspólny komponent profilu też nie może ich czytać (inaczej ISR przestałby działać).
    expect(src("../components/FirmProfile.tsx")).not.toMatch(/searchParams|headers\(|cookies\(/);
    expect(src("../components/CityView.tsx")).not.toMatch(/searchParams|headers\(|cookies\(/);
  });

  it("podgląd Premium jest trasą dynamiczną z noindex", () => {
    const text = src("../app/podglad/[token]/page.tsx");
    expect(text).toMatch(/dynamic = "force-dynamic"/);
    expect(text).toMatch(/index: false/);
    expect(src("../next.config.mjs")).toMatch(/\/podglad\/:path\*[\s\S]*no-store/);
  });

  it("profil publiczny pyta tylko o warstwę opublikowaną", () => {
    expect(src("../app/[city]/[firm]/page.tsx")).toMatch(/getPremium\(listing\.listingId, "published"\)/);
  });
});
