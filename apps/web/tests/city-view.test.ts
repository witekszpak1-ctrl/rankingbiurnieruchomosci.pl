import { describe, expect, it } from "vitest";

import { parseView, viewHref } from "@/lib/city-view";

describe("widok strony miasta w adresie", () => {
  it("czyta stronę, cel i filtry, pomija nieznane wartości", () => {
    expect(parseView({})).toEqual({ page: 1, goal: null, filters: [] });
    expect(parseView({ strona: "3", cel: "wynajem", filtr: ["cennik", "xyz"] })).toEqual({
      page: 3,
      goal: "wynajem",
      filters: ["cennik"],
    });
    expect(parseView({ strona: "-2", cel: "nieznany" })).toEqual({ page: 1, goal: null, filters: [] });
  });

  it("buduje adres w stałej kolejności parametrów, bez strony 1", () => {
    expect(viewHref("krakow", { page: 1, goal: null, filters: [] })).toBe("/krakow");
    expect(viewHref("krakow", { page: 2, goal: null, filters: [] })).toBe("/krakow?strona=2");
    expect(viewHref("krakow", { page: 2, goal: "sprzedaz", filters: ["zarzadzanie", "cennik"] })).toBe(
      "/krakow?cel=sprzedaz&filtr=zarzadzanie&filtr=cennik&strona=2",
    );
  });
});

describe("odmiana po słowie z", () => {
  it("dopełniacz: 7 z 63 biur, 1 z 1 biura", async () => {
    const { nBiurGen } = await import("@/lib/plural");
    for (const [n, text] of [[1, "1 biura"], [2, "2 biur"], [5, "5 biur"], [12, "12 biur"], [22, "22 biur"], [63, "63 biur"], [161, "161 biur"]] as const) {
      expect(nBiurGen(n)).toBe(text);
    }
  });
});
