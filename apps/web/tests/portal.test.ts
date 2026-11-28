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
import { existsSync } from "node:fs";
import { join } from "node:path";

import { budowlane } from "../portals/budowlane";
import { nieruchomosci } from "../portals/nieruchomosci";
import { oze } from "../portals/oze";
import { przeprowadzki } from "../portals/przeprowadzki";
import { rachunkowe } from "../portals/rachunkowe";
import { remonty } from "../portals/remonty";
import { warsztaty } from "../portals/warsztaty";
import { weterynarze } from "../portals/weterynarze";

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

/** Portale nr 3-8: wszystkie ładują się z rejestru, mają poprawną odmianę, typy schema.org i własny motyw. */
describe("portale 3-8 (oze, remonty, budowlane, warsztaty, przeprowadzki, weterynarze)", () => {
  // oczekiwane formy: nFirmPhrase dla 1, 2, 5, 12, 22, 25 (odmiana przez liczebnik) i formy przypadków
  const expected: Record<
    string,
    { portal: PortalConfig; phrases: string[]; genOne: string; datOne: string; locPl: string; units: string[]; schema: string }
  > = {
    oze: {
      portal: oze,
      phrases: ["1 firma instalacyjna", "2 firmy instalacyjne", "5 firm instalacyjnych", "12 firm instalacyjnych", "22 firmy instalacyjne", "25 firm instalacyjnych"],
      genOne: "firmy instalacyjnej",
      datOne: "firmie instalacyjnej",
      locPl: "firmach instalacyjnych",
      units: ["1 firma", "2 firmy", "5 firm", "22 firmy"],
      schema: "HomeAndConstructionBusiness",
    },
    remonty: {
      portal: remonty,
      phrases: ["1 firma remontowa", "2 firmy remontowe", "5 firm remontowych", "12 firm remontowych", "22 firmy remontowe", "25 firm remontowych"],
      genOne: "firmy remontowej",
      datOne: "firmie remontowej",
      locPl: "firmach remontowych",
      units: ["1 firma", "3 firmy", "7 firm", "24 firmy"],
      schema: "GeneralContractor",
    },
    budowlane: {
      portal: budowlane,
      phrases: ["1 firma budowlana", "2 firmy budowlane", "5 firm budowlanych", "12 firm budowlanych", "22 firmy budowlane", "25 firm budowlanych"],
      genOne: "firmy budowlanej",
      datOne: "firmie budowlanej",
      locPl: "firmach budowlanych",
      units: ["1 firma", "4 firmy", "6 firm", "23 firmy"],
      schema: "GeneralContractor",
    },
    warsztaty: {
      portal: warsztaty,
      phrases: ["1 warsztat samochodowy", "2 warsztaty samochodowe", "5 warsztatów samochodowych", "12 warsztatów samochodowych", "22 warsztaty samochodowe", "25 warsztatów samochodowych"],
      genOne: "warsztatu samochodowego",
      datOne: "warsztatowi samochodowemu",
      locPl: "warsztatach samochodowych",
      units: ["1 warsztat", "2 warsztaty", "5 warsztatów", "22 warsztaty"],
      schema: "AutoRepair",
    },
    przeprowadzki: {
      portal: przeprowadzki,
      phrases: ["1 firma przeprowadzkowa", "2 firmy przeprowadzkowe", "5 firm przeprowadzkowych", "12 firm przeprowadzkowych", "22 firmy przeprowadzkowe", "25 firm przeprowadzkowych"],
      genOne: "firmy przeprowadzkowej",
      datOne: "firmie przeprowadzkowej",
      locPl: "firmach przeprowadzkowych",
      units: ["1 firma", "2 firmy", "5 firm", "22 firmy"],
      schema: "MovingCompany",
    },
    weterynarze: {
      portal: weterynarze,
      phrases: ["1 klinika weterynaryjna", "2 kliniki weterynaryjne", "5 klinik weterynaryjnych", "12 klinik weterynaryjnych", "22 kliniki weterynaryjne", "25 klinik weterynaryjnych"],
      genOne: "kliniki weterynaryjnej",
      datOne: "klinice weterynaryjnej",
      locPl: "klinikach weterynaryjnych",
      units: ["1 klinika", "2 kliniki", "5 klinik", "22 kliniki"],
      schema: "VeterinaryCare",
    },
  };

  const SCHEMA_ORG_TYPES = new Set([
    "AccountingService", "AutoRepair", "GeneralContractor", "HomeAndConstructionBusiness", "HVACBusiness", "MovingCompany", "RealEstateAgent", "VeterinaryCare",
  ]);

  const ctx = (n: number) => ({
    where: "w Krakowie",
    n,
    withPrices: 2,
    confirmed: n,
    units: (k: number) => `${k} ${nounForm(k, { one: "x", few: "y", many: "z" })}`,
    unitsGen: (k: number) => `${k} ${nounForm(k, { one: "x", few: "y", many: "z" })}`,
    groups: [{ label: "grupa", count: 2 }],
  });

  it("każdy portal jest w rejestrze i zgadza się slug, branża i motyw", () => {
    for (const [slug, { portal }] of Object.entries(expected)) {
      expect(PORTALS[slug]).toBe(portal);
      expect(portalBySlug(slug)).toBe(portal);
      expect(portal.slug).toBe(slug);
      expect(portal.verticalSlug).toBe(slug);
      expect(portal.themeId).toBe(slug);
      expect(portal.siteUrl).toBe("https://tbd.invalid");
      expect(portal.domains).toEqual([]);
      // pakiet branży istnieje (konfiguracja, miasta, prompty)
      const pack = join(process.cwd(), "..", "..", "packages", "verticals", slug);
      expect(existsSync(join(pack, "vertical.yaml"))).toBe(true);
      expect(existsSync(join(pack, "prompts", "describe.md"))).toBe(true);
    }
    expect(Object.keys(PORTALS).sort()).toEqual(
      ["budowlane", "nieruchomosci", "oze", "przeprowadzki", "rachunkowe", "remonty", "warsztaty", "weterynarze"],
    );
  });

  it("nazwy robocze są różne i żaden portal nie powtarza schematu 'Ranking ...'", () => {
    const names = Object.values(PORTALS).map((p) => p.brandName);
    expect(new Set(names).size).toBe(names.length);
    const themes = Object.values(PORTALS).map((p) => p.themeId);
    expect(new Set(themes).size).toBe(themes.length);
    for (const slug of Object.keys(expected)) {
      expect(PORTALS[slug].brandName).not.toMatch(/^Ranking/);
      expect(PORTALS[slug].shortName.length).toBeGreaterThan(1);
    }
  });

  it("odmiana fraz przez liczebnik i przypadki", () => {
    for (const { portal, phrases, genOne, datOne, locPl } of Object.values(expected)) {
      expect([1, 2, 5, 12, 22, 25].map((n) => nFirmPhrase(n, portal))).toEqual(phrases);
      expect(portal.terms.phrase.genOne).toBe(genOne);
      expect(portal.terms.phrase.datOne).toBe(datOne);
      expect(portal.terms.phrase.locPl).toBe(locPl);
      expect(capitalize(firmPhrase("few", portal))).toBe(capitalize(portal.terms.phrase.few));
    }
  });

  it("licznik jednostki katalogu (firma, warsztat, klinika)", () => {
    for (const { portal, units } of Object.values(expected)) {
      const counts = units.map((u) => Number(u.split(" ")[0]));
      expect(counts.map((n) => `${n} ${nounForm(n, portal.terms.firm)}`)).toEqual(units);
    }
  });

  it("typ schema.org jest poprawny, funkcje wyłączone, brak tekstów innych branż", () => {
    for (const { portal, schema } of Object.values(expected)) {
      expect(portal.schema.firmType).toBe(schema);
      expect(SCHEMA_ORG_TYPES.has(portal.schema.firmType)).toBe(true);
      expect(Object.values(portal.features).every((v) => v === false)).toBe(true);
      const dump = JSON.stringify(portal, (_k, v) => (typeof v === "function" ? v.toString() : v instanceof RegExp ? v.source : v));
      expect(dump).not.toMatch(/nieruchomo|pośrednik|prowizj|rachunk|księgow/i);
      expect(dump).not.toMatch(/[\u2013\u2014]/);
    }
  });

  it("teksty miasta składają się bez pustych miejsc i bez długich myślników", () => {
    for (const { portal } of Object.values(expected)) {
      const c = ctx(5);
      const parts = [
        ...portal.texts.city.guide(c),
        portal.texts.city.noPrices(c),
        portal.texts.city.somePrices(c, 40, 35, 0),
        portal.texts.city.priceNote("1 grudnia 2026"),
        portal.texts.city.priceNote(null),
        portal.texts.city.priceHeading("w Krakowie"),
        portal.texts.city.faq.feeQuestion("w Krakowie"),
        portal.texts.city.faq.feeNoPrices("w Krakowie"),
        portal.texts.city.faq.trustAnswer(c),
        portal.texts.city.faq.trustAnswer(ctx(1)),
        portal.texts.firmNoRates("Przykładowa"),
        portal.texts.lead.message("kupno", "w Krakowie"),
        portal.texts.lead.message("", "w Krakowie"),
      ];
      for (const part of parts) {
        expect(part).not.toMatch(/undefined|NaN|\[object/);
        expect(part).not.toMatch(/[\u2013\u2014]/);
        expect(part.trim().length).toBeGreaterThan(20);
      }
      // wszystkie sześć tematów formularza ma etykietę i wiadomość
      for (const topic of ["kupno", "sprzedaz", "wynajem", "najem", "wycena", "inne"] as const) {
        expect(portal.texts.lead.topics[topic].length).toBeGreaterThan(3);
        expect(portal.texts.lead.message(topic, "we Wrocławiu").length).toBeGreaterThan(20);
      }
    }
  });

  it("czyta PORTAL=<slug> dla każdego nowego portalu i meta teksty używają jego odmiany", () => {
    for (const [slug, { portal }] of Object.entries(expected)) {
      vi.stubEnv("PORTAL", slug);
      expect(currentPortal()).toBe(portal);
      expect(firmPhrase("many")).toBe(portal.terms.phrase.many);
      expect(nFirmPhrase(3)).toBe(`3 ${portal.terms.phrase.few}`);
      vi.stubEnv("PORTAL", "");
    }
  });

  it("wagi rankingu używają tylko parametrów silnika i nie mają parametru ofert", () => {
    const known = ["rejestr", "staz", "jawnosc_cennika", "spojnosc_danych", "zakres_uslug", "opinie_google", "aktualne_oferty"];
    for (const { portal } of Object.values(expected)) {
      const keys = Object.keys(portal.ranking.weights);
      expect(keys.every((k) => known.includes(k))).toBe(true);
      expect(keys).not.toContain("aktualne_oferty");
      expect(Object.values(portal.ranking.weights).every((w) => w > 0)).toBe(true);
      expect(keys.some((k) => /platn|premium|reklam/i.test(k))).toBe(false);
    }
  });

  it("adresy funkcji wyłączonych dają 404 także w nowych portalach", () => {
    for (const { portal } of Object.values(expected)) {
      expect(isPathDisabled("/oferty", portal)).toBe(true);
      expect(isPathDisabled("/blog", portal)).toBe(true);
      expect(isPathDisabled("/ranking", portal)).toBe(false);
    }
  });
});
