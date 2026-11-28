import { afterEach, describe, expect, it, vi } from "vitest";

import { homeMeta, cityMeta, firmMeta } from "../lib/meta-texts";
import { nBiur, nBiurGen, nFirm, nFirmUnits, nFirmUnitsGen } from "../lib/plural";
import {
  capitalize,
  currentPortal,
  expertPhrase,
  featureForPath,
  isPathDisabled,
  nFirmPhrase,
  firmPhrase,
  nounForm,
  portalBySlug,
  portalForHost,
  PORTALS,
  type PortalConfig,
} from "../lib/portal";
import { nieruchomosci } from "../portals/nieruchomosci";
import { rachunkowe } from "../portals/rachunkowe";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("wybór portalu", () => {
  it("domyślnie zwraca portal nieruchomości", () => {
    vi.stubEnv("PORTAL", "");
    expect(currentPortal().slug).toBe("nieruchomosci");
    expect(currentPortal()).toBe(nieruchomosci);
  });

  it("czyta zmienną PORTAL", () => {
    vi.stubEnv("PORTAL", "nieruchomosci");
    expect(currentPortal().slug).toBe("nieruchomosci");
  });

  it("nieznany slug to błąd konfiguracji", () => {
    vi.stubEnv("PORTAL", "nie-ma-takiego");
    expect(() => currentPortal()).toThrow(/Nieznany portal/);
    expect(() => portalBySlug("x")).toThrow(/nieruchomosci/);
  });

  it("wybiera portal po hoście (z portem i www), a nieznany host oddaje do zmiennej środowiska", () => {
    expect(portalForHost("rankingbiurnieruchomosci.pl")?.slug).toBe("nieruchomosci");
    expect(portalForHost("WWW.RankingBiurNieruchomosci.pl:443")?.slug).toBe("nieruchomosci");
    expect(portalForHost("inna-domena.pl")).toBeNull();
    expect(portalForHost(null)).toBeNull();
    vi.stubEnv("PORTAL", "");
    expect(currentPortal("inna-domena.pl").slug).toBe("nieruchomosci");
    expect(currentPortal("rankingbiurnieruchomosci.pl")).toBe(nieruchomosci);
  });

  it("slug w rejestrze zgadza się z kluczem, a domeny i motyw są ustawione", () => {
    for (const [key, portal] of Object.entries(PORTALS)) {
      expect(portal.slug).toBe(key);
      // domena portalu rachunkowe jest jeszcze nieustalona (TBD), więc lista może być pusta
      expect(Array.isArray(portal.domains)).toBe(true);
      expect(portal.themeId).toBeTruthy();
      expect(portal.siteUrl).not.toMatch(/\/$/);
    }
  });
});

describe("wybór portalu po domenie", () => {
  it("domena należy do jednego portalu", () => {
    const all = Object.values(PORTALS).flatMap((p) => p.domains);
    expect(new Set(all).size).toBe(all.length);
  });

  it("host ma pierwszeństwo przed zmienną PORTAL, nieznany host oddaje wybór zmiennej", () => {
    const withDomain: PortalConfig = { ...rachunkowe, domains: ["ranking-rachunkowych.example"] };
    PORTALS[withDomain.slug] = withDomain;
    try {
      vi.stubEnv("PORTAL", "nieruchomosci");
      expect(portalForHost("www.Ranking-Rachunkowych.example:3000")).toBe(withDomain);
      expect(currentPortal("ranking-rachunkowych.example")).toBe(withDomain);
      expect(currentPortal("localhost:3000")).toBe(nieruchomosci);
      vi.stubEnv("PORTAL", "rachunkowe");
      expect(currentPortal("localhost:3000")).toBe(withDomain);
      expect(currentPortal("rankingbiurnieruchomosci.pl")).toBe(nieruchomosci);
    } finally {
      PORTALS[rachunkowe.slug] = rachunkowe;
    }
  });
});

describe("konfiguracja portalu nieruchomości (wartości jak dotychczas w kodzie)", () => {
  it("nazwa, adres i typ danych strukturalnych", () => {
    expect(nieruchomosci.siteName).toBe("Ranking biur nieruchomości");
    expect(nieruchomosci.brandName).toBe("Ranking Biur Nieruchomości");
    expect(nieruchomosci.siteUrl).toBe("https://rankingbiurnieruchomosci.pl");
    expect(nieruchomosci.contactEmail).toBe("info@rankingbiurnieruchomosci.pl");
    expect(nieruchomosci.schema.firmType).toBe("RealEstateAgent");
    expect(nieruchomosci.themeId).toBe("nieruchomosci");
  });

  it("żaden tekst z konfiguracji nie ma długiego myślnika ani półpauzy", () => {
    expect(JSON.stringify(nieruchomosci)).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`));
  });
});

describe("odmiana z konfiguracji", () => {
  it("nounForm wybiera formę jak plural()", () => {
    const noun = { one: "biuro", few: "biura", many: "biur" };
    expect([0, 1, 2, 4, 5, 12, 14, 22, 25, 112].map((n) => nounForm(n, noun))).toEqual([
      "biur", "biuro", "biura", "biura", "biur", "biur", "biur", "biura", "biur", "biur",
    ]);
  });

  it("frazy rodzajowe z nazwą branży", () => {
    expect(firmPhrase("one")).toBe("biuro nieruchomości");
    expect(firmPhrase("few")).toBe("biura nieruchomości");
    expect(firmPhrase("many")).toBe("biur nieruchomości");
    expect(expertPhrase()).toBe("pośrednik nieruchomości");
    expect(capitalize(firmPhrase("few"))).toBe("Biura nieruchomości");
  });

  it("liczniki ogólne dają to samo co dotychczasowe nBiur i nBiurGen", () => {
    for (const n of [0, 1, 2, 5, 12, 22, 1234]) {
      expect(nFirmUnits(n)).toBe(nBiur(n));
      expect(nFirmUnitsGen(n)).toBe(nBiurGen(n));
    }
    expect(nBiur(1)).toBe("1 biuro");
    expect(nBiur(3)).toBe("3 biura");
    expect(nBiur(5)).toBe("5 biur");
    expect(nBiurGen(1)).toBe("1 biura");
    expect(nBiurGen(4)).toBe("4 biur");
    expect(nFirm(2)).toBe("2 firmy");
  });

  it("inny portal zmienia odmianę i frazy (przymiotnik zmienia formę, więc frazy są podane wprost)", () => {
    expect(firmPhrase("one", rachunkowe)).toBe("biuro rachunkowe");
    expect(firmPhrase("few", rachunkowe)).toBe("biura rachunkowe");
    expect(firmPhrase("many", rachunkowe)).toBe("biur rachunkowych");
    expect(rachunkowe.terms.phrase.genOne).toBe("biura rachunkowego");
    expect(rachunkowe.terms.phrase.datOne).toBe("biuru rachunkowemu");
    expect(rachunkowe.terms.phrase.locPl).toBe("biurach rachunkowych");
    expect(capitalize(firmPhrase("few", rachunkowe))).toBe("Biura rachunkowe");
    expect(expertPhrase(rachunkowe)).toBe("obsługa księgowa");
    expect([1, 2, 5, 12, 22, 25].map((n) => nFirmPhrase(n, rachunkowe))).toEqual([
      "1 biuro rachunkowe",
      "2 biura rachunkowe",
      "5 biur rachunkowych",
      "12 biur rachunkowych",
      "22 biura rachunkowe",
      "25 biur rachunkowych",
    ]);
    expect(nFirmPhrase(6)).toBe("6 biur nieruchomości");
  });

  it("portal rachunkowe: dane strukturalne, motyw i flagi funkcji", () => {
    expect(rachunkowe.schema.firmType).toBe("AccountingService");
    expect(rachunkowe.themeId).toBe("rachunkowe");
    expect(rachunkowe.verticalSlug).toBe("rachunkowe");
    expect(Object.values(rachunkowe.features).every((v) => v === false)).toBe(true);
    expect(Object.values(nieruchomosci.features).every((v) => v === true)).toBe(true);
  });

  it("czyta PORTAL=rachunkowe i nie miesza go z domyślnym portalem", () => {
    vi.stubEnv("PORTAL", "rachunkowe");
    expect(currentPortal()).toBe(rachunkowe);
    expect(currentPortal("rankingbiurnieruchomosci.pl")).toBe(nieruchomosci);
    expect(firmPhrase("many")).toBe("biur rachunkowych");
    vi.stubEnv("PORTAL", "");
    expect(currentPortal()).toBe(nieruchomosci);
  });

  it("adresy funkcji wyłączonych w portalu (oferty, blog, raporty, wyróżnienia)", () => {
    expect(featureForPath("/oferty")).toBe("offers");
    expect(featureForPath("/blog/okladka/x")).toBe("blog");
    expect(featureForPath("/raporty/prowizje-biur-nieruchomosci-2026")).toBe("reports");
    expect(featureForPath("/poradnik/jak-sprawdzic-biuro-nieruchomosci")).toBe("reports");
    expect(featureForPath("/wyroznienia-2026")).toBe("awards");
    expect(featureForPath("/wroclaw")).toBeNull();
    expect(featureForPath("/blogger")).toBeNull();
    expect(isPathDisabled("/oferty", rachunkowe)).toBe(true);
    expect(isPathDisabled("/oferty", nieruchomosci)).toBe(false);
    expect(isPathDisabled("/ranking", rachunkowe)).toBe(false);
  });

  it("konfiguracje portali nie zawierają tekstów drugiej branży ani długich myślników", () => {
    const dump = JSON.stringify(rachunkowe, (_k, v) => (typeof v === "function" ? v.toString() : v instanceof RegExp ? v.source : v));
    expect(dump).not.toMatch(/nieruchomo|pośrednik|prowizj/i);
    for (const portal of Object.values(PORTALS)) {
      const text = JSON.stringify(portal, (_k, v) => (typeof v === "function" ? v.toString() : v));
      expect(text).not.toMatch(/[\u2013\u2014]/);
    }
  });
});

describe("teksty meta z konfiguracji nie zmieniły treści", () => {
  it("strona główna", () => {
    expect(homeMeta(2026, 3, 1)).toEqual({
      title: "Ranking biur nieruchomości w Polsce 2026 | Porównaj biura",
      description:
        "Niezależny ranking biur nieruchomości w Polsce: 3 biura w 1 mieście. Porównaj agencje, prowizje, zakres usług i dane z rejestrów w swoim mieście.",
    });
    expect(homeMeta(2026, 0, 0).description).toBe(
      "Niezależny ranking biur nieruchomości w Polsce. Porównaj agencje, prowizje, zakres usług i dane z rejestrów w swoim mieście.",
    );
  });

  it("miasto bez i z rankingiem", () => {
    expect(cityMeta("Wrocław", 2026, 3, false, 0)).toEqual({
      title: "Biura nieruchomości Wrocław | 3 biura w katalogu",
      description:
        "3 biura nieruchomości we Wrocławiu w katalogu. Sprawdź zakres usług, prowizje, oferty i dane kontaktowe agencji.",
    });
    const ranked = cityMeta("Wrocław", 2026, 7, true, 2);
    expect(ranked.title).toBe("Ranking biur nieruchomości Wrocław 2026 | 7 biur");
    expect(ranked.description).toBe(
      "Ranking 7 biur nieruchomości we Wrocławiu. Porównaj wyniki, prowizje, zakres usług, oferty i doświadczenie agencji w niezależnym zestawieniu.",
    );
  });

  it("profil biura", () => {
    const m = firmMeta({ name: "Zeta Invest", cityName: "Wrocław", score: 71, hasGoogle: true, hasPrices: true, offers: 2 });
    expect(m.title).toBe("Zeta Invest Wrocław | Opinie, prowizje, ranking");
    expect(m.description).toBe(
      "Biuro nieruchomości Zeta Invest we Wrocławiu. Sprawdź wynik 71/100 w rankingu, prowizje, zakres usług, aktualne oferty i dane kontaktowe biura.",
    );
  });
});
