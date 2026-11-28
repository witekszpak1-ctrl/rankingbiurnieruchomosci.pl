import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { nieruchomosci } from "../portals/nieruchomosci";
import { rachunkowe } from "../portals/rachunkowe";
import { inVertical, verticalIdSql, verticalSlug } from "../lib/vertical-scope";
import type { PortalConfig } from "../lib/portal";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.doUnmock("../lib/db");
});

describe("fragmenty SQL zakresu branży", () => {
  it("slug branży portalu trafia do podzapytania", () => {
    expect(verticalSlug(nieruchomosci)).toBe("nieruchomosci");
    expect(verticalIdSql(rachunkowe)).toBe("(select id from verticals where slug = 'rachunkowe')");
    expect(inVertical("l", rachunkowe)).toBe("l.vertical_id = (select id from verticals where slug = 'rachunkowe')");
    expect(inVertical("l1", nieruchomosci)).toBe("l1.vertical_id = (select id from verticals where slug = 'nieruchomosci')");
  });

  it("domyślnie bierze portal ze zmiennej PORTAL", () => {
    vi.stubEnv("PORTAL", "rachunkowe");
    expect(verticalSlug()).toBe("rachunkowe");
    vi.stubEnv("PORTAL", "");
    expect(verticalSlug()).toBe("nieruchomosci");
  });

  it("odrzuca slug, który nie jest bezpiecznym identyfikatorem", () => {
    const bad = { ...rachunkowe, verticalSlug: "x'; drop table listings; --" } as PortalConfig;
    expect(() => verticalSlug(bad)).toThrow(/Niepoprawny slug/);
    expect(() => inVertical("l", bad)).toThrow();
  });
});

/** Każde publiczne zapytanie katalogu musi zawierać filtr branży portalu (inaczej portal pokazałby cudze wpisy). */
describe("zapytania katalogu są ograniczone do branży portalu", () => {
  let sql: string[];

  beforeEach(() => {
    sql = [];
    vi.resetModules();
    vi.doMock("../lib/db", () => ({
      query: async (text: string) => {
        sql.push(text);
        return [];
      },
    }));
  });

  async function runAll() {
    const catalog = await import("../lib/catalog");
    const calls: [string, () => Promise<unknown>][] = [
      ["listCities", () => catalog.listCities()],
      ["listCityListings", () => catalog.listCityListings("wroclaw")],
      ["getPublishedListing", () => catalog.getPublishedListing("wroclaw", "x")],
      ["cityCommissionStats", () => catalog.cityCommissionStats("wroclaw")],
      ["commissionReport", () => catalog.commissionReport()],
      ["listPublishedPaths", () => catalog.listPublishedPaths()],
      ["listAllPublished", () => catalog.listAllPublished()],
      ["listPublishedCards", () => catalog.listPublishedCards()],
      ["getBadgeListing", () => catalog.getBadgeListing("00000000-0000-0000-0000-000000000000")],
      ["compareCards", () => catalog.compareCards(["00000000-0000-0000-0000-000000000000"])],
      ["listLatestOffers", () => catalog.listLatestOffers(3)],
      ["homeStats", () => catalog.homeStats()],
      ["listOffersPage", () => catalog.listOffersPage({ page: 0, perPage: 10 })],
      ["offerCities", () => catalog.offerCities()],
      ["cityPriceExamples", () => catalog.cityPriceExamples("wroclaw")],
      ["cityServices", () => catalog.cityServices("wroclaw")],
    ];
    const missing: string[] = [];
    for (const [name, call] of calls) {
      sql = [];
      await call();
      expect(sql.length, name).toBeGreaterThan(0);
      if (!sql.some((q) => q.includes("verticals where slug = '"))) missing.push(name);
    }
    return missing;
  }

  it("portal nieruchomości", async () => {
    vi.stubEnv("PORTAL", "");
    expect(await runAll()).toEqual([]);
    expect(sql.join("\n")).not.toContain("'rachunkowe'");
  });

  it("portal rachunkowe", async () => {
    vi.stubEnv("PORTAL", "rachunkowe");
    expect(await runAll()).toEqual([]);
  });

  it("portal rachunkowe filtruje po własnym slugu, nie po slugu nieruchomości", async () => {
    vi.stubEnv("PORTAL", "rachunkowe");
    const catalog = await import("../lib/catalog");
    await catalog.homeStats();
    expect(sql.join("\n")).toContain("slug = 'rachunkowe'");
    expect(sql.join("\n")).not.toContain("slug = 'nieruchomosci'");
  });
});
