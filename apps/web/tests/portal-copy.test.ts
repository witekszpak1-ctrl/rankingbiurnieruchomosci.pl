/**
 * Teksty portali branżowych: żaden portal inny niż nieruchomości nie może zawierać słownictwa pośrednictwa w obrocie
 * nieruchomościami ("nieruchomoś", "mieszka", "pośredni", "agencj"), a słowo "biur" jest dozwolone tylko w portalu
 * biur rachunkowych. Test działa na poziomie konfiguracji (PortalConfig, wywołanie funkcji tekstowych z przykładowymi
 * danymi) i na poziomie funkcji składających teksty stron (lib/city-content, lib/firm-faq, lib/meta-texts,
 * lib/ranking, lib/path-status). Renderowane strony sprawdza skrypt scripts/check-portal-html.mjs na działającym
 * serwerze (docs/geo/silnik-branz.md, "Teksty portali").
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { PORTALS, type PortalConfig } from "../lib/portal";
import { unitForms } from "../lib/unit";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

const SLUGS = Object.keys(PORTALS);
const OTHER = SLUGS.filter((s) => s !== "nieruchomosci");

/** Słowa pośrednictwa w obrocie nieruchomościami; "bezpośrednio" nie jest trafieniem (stąd początek wyrazu). */
const REAL_ESTATE = /nieruchomo[śs]|mieszka|(?<![a-ząćęłńóśźż])po[śs]redni|agencj/i;
const BIUR = /biur/i;

function forbidden(slug: string): RegExp[] {
  return slug === "rachunkowe" ? [REAL_ESTATE] : [REAL_ESTATE, BIUR];
}

/** Zbiera napisy z obiektu konfiguracji (funkcje pomijamy, sprawdzamy je osobno z przykładowymi danymi). */
function strings(value: unknown, path = "", out: [string, string][] = []): [string, string][] {
  if (typeof value === "string") out.push([path, value]);
  else if (Array.isArray(value)) value.forEach((v, i) => strings(v, `${path}[${i}]`, out));
  else if (value && typeof value === "object" && !(value instanceof RegExp)) {
    for (const [k, v] of Object.entries(value)) strings(v, path ? `${path}.${k}` : k, out);
  }
  return out;
}

function hits(slug: string, items: [string, string][]): string[] {
  const res = forbidden(slug);
  return items.filter(([, text]) => res.some((re) => re.test(text))).map(([where, text]) => `${where}: ${text.slice(0, 120)}`);
}

const SAMPLE_CTX = (portal: PortalConfig) => {
  const u = unitForms(portal);
  const count = (n: number) => `${n} ${n === 1 ? u.sg.nom : n < 5 ? u.pl.nom : u.pl.gen}`;
  return {
    where: "we Wrocławiu",
    n: 6,
    withPrices: 2,
    confirmed: 5,
    units: count,
    unitsGen: (n: number) => `${n} ${n === 1 ? u.sg.gen : u.pl.gen}`,
    groups: [{ label: "usługa przykładowa", count: 3 }],
  };
};

describe("konfiguracja portali: teksty bez słownictwa innej branży", () => {
  it.each(OTHER)("%s: napisy konfiguracji", (slug) => {
    const portal = PORTALS[slug];
    const items = strings({ ...portal, ranking: undefined, schema: undefined, domains: undefined, siteUrl: undefined, contactEmail: undefined });
    // klucze adresów (href) i nazwy techniczne nie są tekstem strony
    const visible = items.filter(([path]) => !/href$|\.group$|\.key$|slug|themeId|verticalSlug/.test(path));
    expect(hits(slug, visible)).toEqual([]);
  });

  it.each(OTHER)("%s: funkcje tekstowe konfiguracji z przykładowymi danymi", (slug) => {
    const portal = PORTALS[slug];
    const ctx = SAMPLE_CTX(portal);
    const out: [string, string][] = [];
    for (const t of ["kupno", "sprzedaz", "wynajem", "najem", "wycena", "inne", ""] as const) {
      out.push([`lead.message(${t})`, portal.texts.lead.message(t, "we Wrocławiu")]);
    }
    out.push(["firmNoRates", portal.texts.firmNoRates("Firma Testowa")]);
    const city = portal.texts.city;
    city.guide(ctx).forEach((p, i) => out.push([`city.guide[${i}]`, p]));
    out.push(["city.noPrices", city.noPrices(ctx)]);
    out.push(["city.somePrices", city.somePrices(ctx, 33, 40, 1)]);
    out.push(["city.priceNote", city.priceNote("28 listopada 2026")]);
    out.push(["city.priceNote(null)", city.priceNote(null)]);
    out.push(["city.priceHeading", city.priceHeading("we Wrocławiu")]);
    out.push(["faq.feeQuestion", city.faq.feeQuestion("we Wrocławiu")]);
    out.push(["faq.feeNoPrices", city.faq.feeNoPrices("we Wrocławiu")]);
    out.push(["faq.trustAnswer", city.faq.trustAnswer(ctx)]);
    out.push(["faq.trustAnswer(all)", city.faq.trustAnswer({ ...ctx, confirmed: ctx.n })]);
    expect(hits(slug, out)).toEqual([]);
  });

  it("kontrola wykrywa słownictwo nieruchomości (sprawdzenie samego testu)", () => {
    const nier = strings(PORTALS.nieruchomosci.texts);
    expect(hits("weterynarze", nier).length).toBeGreaterThan(10);
    expect(hits("rachunkowe", nier).length).toBeGreaterThan(5);
    expect(hits("weterynarze", [["x", "Dzwoń bezpośrednio do placówki."]])).toEqual([]);
  });

  it("portal nieruchomości zachowuje swoje dotychczasowe teksty", () => {
    const t = PORTALS.nieruchomosci.texts;
    expect(t.homeStepsHeading).toBe("Dobre biuro w trzech krokach");
    expect(t.homeFaq[0].q).toBe("Skąd pochodzą dane o biurach?");
    expect(t.homeFaq[3].q).toBe("Moje biuro ma błędne dane. Co zrobić?");
    expect(t.homeFaq[2].a).toContain("Oferty, kontakt i obrazki sprawdzamy codziennie");
    expect(PORTALS.nieruchomosci.terms.phrase.accOne).toBe("biuro nieruchomości");
  });
});

describe("odmiana jednostki katalogu", () => {
  it.each(SLUGS)("%s: odmiana zgodna z formami po liczebniku", (slug) => {
    const { terms } = PORTALS[slug];
    expect(terms.unit.sg.nom).toBe(terms.firm.one);
    expect(terms.unit.pl.nom).toBe(terms.firm.few);
    expect(terms.unit.pl.gen).toBe(terms.firm.many);
    expect(terms.unit.sg.gen).toBe(terms.firm.genOne);
    // biernik frazy zaczyna się od biernika jednostki ("klinikę weterynaryjną", "warsztat samochodowy")
    expect(terms.phrase.accOne.startsWith(terms.unit.sg.acc)).toBe(true);
    // wszystkie formy wypełnione
    for (const c of Object.values({ ...terms.unit.sg, ...terms.unit.pl })) expect(c).toMatch(/\S/);
  });

  it("zaimki i przymiotniki zgodne z rodzajem", () => {
    const klinika = unitForms(PORTALS.weterynarze);
    expect(klinika.this.gen).toBe("tej");
    expect(klinika.which).toBe("Która");
    expect(klinika.checkedAcc).toBe("sprawdzoną");
    const warsztat = unitForms(PORTALS.warsztaty);
    expect(warsztat.this.gen).toBe("tego");
    expect(warsztat.chosenAcc).toBe("wybrany");
    const biuro = unitForms(PORTALS.nieruchomosci);
    expect(biuro.none).toBe("Żadne");
    expect(biuro.Pl.gen).toBe("Biur");
  });
});

describe("teksty składane z odmiany: poziom funkcji stron", () => {
  const NAMES = ["Firma A", "Firma B", "Firma C", "Firma D", "Firma E"];

  async function collect(slug: string): Promise<[string, string][]> {
    vi.stubEnv("PORTAL", slug);
    vi.resetModules();
    const cc = await import("../lib/city-content");
    const faq = await import("../lib/firm-faq");
    const meta = await import("../lib/meta-texts");
    const ranking = await import("../lib/ranking");
    const status = await import("../lib/path-status");
    const data: import("../lib/city-content").CityData = {
      cityName: "Wrocław",
      firms: NAMES.map((name, i) => ({
        name,
        slug: name.toLowerCase().replace(/\s+/g, "-"),
        position: i + 1,
        score: 90 - i * 5,
        registryConfirmed: i !== 2,
        hasPublicPrices: i < 2,
        offersCount: 0,
      })),
      ranked: true,
      updatedAt: new Date("2026-11-11T10:00:00Z"),
      median: null,
      medianN: 0,
      medianObservedAt: null,
      prices: [],
      services: [
        { brandId: "a", service: "usługa pierwsza" },
        { brandId: "b", service: "usługa druga" },
      ],
    };
    const out: [string, string][] = [];
    for (const ranked of [true, false]) {
      const d = { ...data, ranked };
      out.push([`cityH1(${ranked})`, cc.cityH1(d.cityName, ranked, 2026)]);
      out.push([`cityIntro(${ranked})`, cc.cityIntro(d)]);
    }
    const commission = cc.commissionSection(data);
    out.push(["commission.summary", commission.summary], ["commission.note", commission.note]);
    cc.choosingGuide(data).forEach((p, i) => out.push([`guide[${i}]`, p]));
    cc.cityFaq(data).forEach((f, i) => out.push([`cityFaq[${i}].q`, f.q], [`cityFaq[${i}].a`, f.a]));
    const firm = {
      name: "Firma A",
      cityName: "Wrocław",
      address: "ul. Przykładowa 1, 50-001 Wrocław",
      phone: "+48711234567",
      services: ["usługa pierwsza", "usługa druga"],
      prices: [{ service: "usługa pierwsza", unit: "pln" as const, amountMin: 100, amountMax: null, taxMode: "net" as const }],
      registryConfirmed: true,
      registryYears: 12,
      offersCount: 0,
      score: 80,
      position: 2,
      cityCount: 6,
    };
    for (const variant of [firm, { ...firm, address: null, phone: null, prices: [], registryConfirmed: false, registryYears: null, position: null, cityCount: null }]) {
      faq.firmFaq(variant).forEach((f, i) => out.push([`firmFaq[${i}].q`, f.q], [`firmFaq[${i}].a`, f.a]));
    }
    const home = meta.homeMeta(2026, 8, 2);
    out.push(["homeMeta.title", home.title], ["homeMeta.description", home.description]);
    for (const ranked of [true, false]) {
      const m = meta.cityMeta("Wrocław", 2026, 6, ranked, 2);
      out.push([`cityMeta.title(${ranked})`, m.title], [`cityMeta.description(${ranked})`, m.description]);
    }
    const fm = meta.firmMeta({ name: "Firma A", cityName: "Wrocław", score: 80, hasGoogle: true, hasPrices: true, offers: 0 });
    out.push(["firmMeta.title", fm.title], ["firmMeta.description", fm.description]);
    ranking.PARAMETERS.forEach((p) => out.push([`param.${p.key}`, `${p.label} ${p.whenMissing} ${p.description}`]));
    ranking.METHODOLOGY.changes.forEach((c, i) => out.push([`methodology.changes[${i}]`, c.text]));
    out.push(["GONE_HTML", status.GONE_HTML]);
    return out;
  }

  it.each(OTHER)("%s: teksty stron miasta, profilu, metadanych i metodologii", async (slug) => {
    const items = await collect(slug);
    expect(items.length).toBeGreaterThan(30);
    expect(hits(slug, items)).toEqual([]);
  });

  it("portal nieruchomości: zdania jak dotąd", async () => {
    const items = await collect("nieruchomosci");
    const get = (k: string) => items.find(([p]) => p === k)?.[1] ?? "";
    expect(get("cityIntro(true)")).toContain("Każde z nich potwierdziliśmy".replace("Każde z nich", "4 z nich"));
    expect(get("cityIntro(false)")).toContain("Biur jest jeszcze za mało na ranking z pozycjami");
    expect(get("firmFaq[1].a")).toContain("Biuro ma siedzibę pod adresem");
  });
});
