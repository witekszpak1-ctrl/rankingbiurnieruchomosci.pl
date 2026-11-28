import { describe, expect, it } from "vitest";

import { buildAudit, domainMatches, normalizeDomain, platformLabel, type AuditInput, type AuditMeasurement, type AuditMention } from "@/lib/audit";

describe("normalizeDomain", () => {
  it("zostawia samą domenę", () => {
    expect(normalizeDomain("https://www.MojaFirma.pl/oferta?x=1#a")).toBe("mojafirma.pl");
    expect(normalizeDomain("  mojafirma.pl  ")).toBe("mojafirma.pl");
    expect(normalizeDomain("http://sub.firma.com.pl/")).toBe("sub.firma.com.pl");
    expect(normalizeDomain("www.firma.pl.")).toBe("firma.pl");
    expect(normalizeDomain("firma.pl/kontakt")).toBe("firma.pl");
  });
  it("obsługuje polskie znaki przez punycode", () => {
    expect(normalizeDomain("żółć.pl")).toMatch(/^xn--[a-z0-9-]+\.pl$/);
  });
  it("odrzuca adresy IP w każdym zapisie", () => {
    for (const bad of ["127.0.0.1", "http://10.0.0.5/", "192.168.1.1", "169.254.169.254", "2130706433", "0x7f.0.0.1", "[::1]", "http://[::ffff:127.0.0.1]/", "8.8.8.8"]) {
      expect(normalizeDomain(bad), bad).toBeNull();
    }
  });
  it("odrzuca localhost i nazwy wewnętrzne", () => {
    for (const bad of ["localhost", "http://localhost:3000", "app.localhost", "drukarka.local", "serwer.internal", "nas.lan", "router.home.arpa", "intranet", "a.corp"]) {
      expect(normalizeDomain(bad), bad).toBeNull();
    }
  });
  it("odrzuca dane logowania, porty, inne schematy i śmieci", () => {
    for (const bad of ["http://user:pw@firma.pl", "user@firma.pl", "firma.pl:8080", "ftp://firma.pl", "javascript:alert(1)", "file:///etc/passwd", "mailto:a@b.pl", "", "   ", "firma", "-firma.pl", "fir ma.pl", "firma..pl", "firma.p", "a".repeat(64) + ".pl", "firma.pl\n.evil.com"]) {
      expect(normalizeDomain(bad), bad).toBeNull();
    }
    expect(normalizeDomain(null)).toBeNull();
    expect(normalizeDomain(undefined)).toBeNull();
  });
  it("ogranicza długość wejścia", () => {
    expect(normalizeDomain(`${"a".repeat(300)}.pl`)).toBeNull();
    expect(normalizeDomain(`https://firma.pl/${"x".repeat(400)}`)).toBeNull();
  });
});

describe("domainMatches", () => {
  it("dopasowuje domenę, www i poddomeny, ale nie podobne nazwy", () => {
    expect(domainMatches("www.firma.pl", "firma.pl")).toBe(true);
    expect(domainMatches("oferty.firma.pl", "firma.pl")).toBe(true);
    expect(domainMatches("superfirma.pl", "firma.pl")).toBe(false);
    expect(domainMatches(null, "firma.pl")).toBe(false);
  });
});

describe("platformLabel", () => {
  it("zwykłe polskie nazwy platform", () => {
    expect(platformLabel("gemini")).toBe("Gemini");
    expect(platformLabel("google_ai_mode")).toBe("Google AI Mode");
    expect(platformLabel("google_ai_overview")).toBe("Google AI Overview");
  });
});

const FIRM = { brandId: "brand-own", name: "Alfa Nieruchomości" };
const CITY = { name: "Wrocław", slug: "wroclaw" };
const PLATFORMS = ["gemini", "google_ai_mode", "google_ai_overview"];

function mention(name: string, brandId: string | null, position: number, extra: Partial<AuditMention> = {}): AuditMention {
  return { name, domain: null, brandId, brandName: brandId ? name : null, position, recommended: false, ...extra };
}

function measure(i: number, mentions: AuditMention[], cited: string[] = [], day = 20): AuditMeasurement {
  return {
    id: `m${i}`,
    platform: PLATFORMS[i % 3],
    measuredAt: new Date(Date.UTC(2026, 10, day + (i % 3), 8, 0, 0)),
    promptText: `pytanie ${i % 4}`,
    mentions,
    citations: cited.map((domain) => ({ domain, isOwnPortal: domain === "rankingbiurnieruchomosci.pl" })),
  };
}

function input(measurements: AuditMeasurement[], over: Partial<AuditInput> = {}): AuditInput {
  return { domain: "alfa.pl", firm: FIRM, city: CITY, profileUrl: "https://rankingbiurnieruchomosci.pl/wroclaw/alfa", measurements, ...over };
}

describe("buildAudit: stany", () => {
  it("firma spoza katalogu", () => {
    const a = buildAudit(input([], { firm: null, city: null, profileUrl: null }));
    expect(a.status).toBe("not_in_catalog");
    expect(a.rates).toBeNull();
    expect(a.recommendations).toEqual([]);
  });
  it("firma w katalogu, ale bez pomiarów miasta", () => {
    const a = buildAudit(input([]));
    expect(a.status).toBe("no_measurements");
    expect(a.usage.count).toBe(0);
    expect(a.firmName).toBe("Alfa Nieruchomości");
  });
});

describe("buildAudit: firma wymieniana", () => {
  const ms = Array.from({ length: 12 }, (_, i) =>
    measure(
      i,
      [
        mention("Beta Dom", "brand-beta", 1, { recommended: i % 2 === 0 }),
        ...(i < 6 ? [mention("Alfa Nieruchomości", "brand-own", 2, { recommended: i < 3 })] : []),
        ...(i < 3 ? [mention("Gamma", null, 3, { domain: "gamma.pl" })] : []),
      ],
      ["otodom.pl", ...(i < 6 ? ["alfa.pl"] : [])],
    ),
  );
  const a = buildAudit(input(ms));

  it("liczy wskaźniki z measure.ts z przedziałami", () => {
    expect(a.status).toBe("ok");
    expect(a.enoughData).toBe(true);
    expect(a.mentioned).toBe(true);
    expect(a.mentionedAnswers).toBe(6);
    expect(a.recommendedAnswers).toBe(3);
    expect(a.citedAnswers).toBe(6);
    expect(a.rates!.mention.value).toBeCloseTo(0.5);
    expect(a.rates!.mention.low).toBeLessThan(0.5);
    expect(a.rates!.mention.high).toBeGreaterThan(0.5);
    expect(a.rates!.recommendation.hits).toBe(3);
    expect(a.score).not.toBeNull();
  });
  it("podaje użyte pomiary: liczbę, platformy i daty", () => {
    expect(a.usage.count).toBe(12);
    expect(a.usage.platforms.map((p) => p.label).sort()).toEqual(["Gemini", "Google AI Mode", "Google AI Overview"]);
    expect(a.usage.platforms.every((p) => p.count === 4)).toBe(true);
    expect(a.usage.firstMeasuredAt!.startsWith("2026-11-20")).toBe(true);
    expect(a.usage.lastMeasuredAt!.startsWith("2026-11-22")).toBe(true);
  });
  it("konkurenci wg liczby odpowiedzi, bez własnej firmy", () => {
    expect(a.competitors.map((c) => c.name)).toEqual(["Beta Dom", "Gamma"]);
    expect(a.competitors[0]).toMatchObject({ answers: 12, inCatalog: true, recommendedAnswers: 6 });
    expect(a.competitors[0].share).toBe(1);
    expect(a.competitors[1]).toMatchObject({ answers: 3, inCatalog: false, domain: "gamma.pl" });
    expect(a.competitors.some((c) => c.name.includes("Alfa"))).toBe(false);
  });
  it("źródła cytowane: bez własnej domeny firmy", () => {
    expect(a.citedDomains[0]).toMatchObject({ domain: "otodom.pl", answers: 12 });
    expect(a.citedDomains.some((c) => c.domain === "alfa.pl")).toBe(false);
  });
  it("rekomendacje z danych, z profilem w katalogu", () => {
    const text = a.recommendations.map((r) => r.text).join("\n");
    expect(text).toContain("pojawia się w 6 z 12");
    expect(text).toContain("Beta Dom (12 z 12)");
    expect(text).toContain("otodom.pl");
    expect(text).toContain("Masz profil w naszym katalogu");
    expect(a.recommendations.some((r) => r.href)).toBe(true);
  });
  it("dopasowuje firmę po domenie, gdy wzmianka nie ma brand_id", () => {
    const byDomain = buildAudit(input([measure(0, [mention("Alfa", null, 1, { domain: "www.alfa.pl" })])]));
    expect(byDomain.mentionedAnswers).toBe(1);
  });
});

describe("buildAudit: firma nie wymieniona", () => {
  const ms = Array.from({ length: 10 }, (_, i) => measure(i, [mention("Beta Dom", "brand-beta", 1)], ["otodom.pl", "morizon.pl"]));
  const a = buildAudit(input(ms, { profileUrl: null }));
  it("zero wzmianek, ale przedział niepewności", () => {
    expect(a.mentioned).toBe(false);
    expect(a.rates!.mention.value).toBe(0);
    expect(a.rates!.mention.high).toBeGreaterThan(0);
  });
  it("mówi wprost i proponuje profil", () => {
    const text = a.recommendations.map((r) => r.text).join("\n");
    expect(text).toContain("nie pojawia się w żadnej z 10");
    expect(text).toContain("nie jest cytowana");
    expect(text).toContain("Nie masz opublikowanego profilu");
  });
});

describe("buildAudit: mała próba", () => {
  const a = buildAudit(input([measure(0, [mention("Beta Dom", "brand-beta", 1)]), measure(1, [mention("Alfa Nieruchomości", "brand-own", 1)])]));
  it("nie podaje procentów ani wyniku", () => {
    expect(a.enoughData).toBe(false);
    expect(a.rates).toBeNull();
    expect(a.score).toBeNull();
    expect(a.mentionedAnswers).toBe(1);
  });
  it("mówi, że danych za mało", () => {
    expect(a.recommendations[0].text).toContain("za mało danych");
    expect(a.recommendations[0].text).toContain("2 odpowiedzi");
  });
});

describe("buildAudit: nasz portal", () => {
  const ms = Array.from({ length: 10 }, (_, i) =>
    measure(i, [mention("Beta Dom", "brand-beta", 1)], ["rankingbiurnieruchomosci.pl", ...(i % 2 ? ["otodom.pl"] : [])]),
  );
  const a = buildAudit(input(ms));
  it("wykrywa cytowanie portalu", () => {
    expect(a.ownPortal).toEqual({ cited: true, answers: 10, hasProfile: true });
    expect(a.citedDomains[0]).toMatchObject({ domain: "rankingbiurnieruchomosci.pl", isOwnPortal: true, answers: 10 });
    expect(a.recommendations.map((r) => r.text).join("\n")).toContain("rankingbiurnieruchomosci.pl jest cytowany w 10 z 10");
  });
  it("brak cytowania portalu", () => {
    const b = buildAudit(input(ms.map((m) => ({ ...m, citations: [{ domain: "otodom.pl", isOwnPortal: false }] }))));
    expect(b.ownPortal.cited).toBe(false);
  });
});

describe("buildAudit: teksty", () => {
  it("nie używa długich myślników", () => {
    const a = buildAudit(input([measure(0, [mention("Beta Dom", "brand-beta", 1)])]));
    const all = JSON.stringify(a);
    expect(all).not.toMatch(new RegExp("[" + String.fromCharCode(0x2013, 0x2014) + "]"));
  });
});
