import { describe, expect, it } from "vitest";

import {
  aggregateFirms,
  buildQuery,
  csvCell,
  formatShare,
  normalizeFirmName,
  parseMeasurementFilters,
  sharePct,
  toCsv,
  type FirmCityRow,
} from "@/lib/admin-stats";

describe("filtry pomiarów", () => {
  it("przyjmuje poprawne wartości", () => {
    const f = parseMeasurementFilters({ miasto: "Kraków", platforma: "gemini", status: "done", od: "2026-11-01", do: "2026-11-28", strona: "3" });
    expect(f).toEqual({ city: "Kraków", platform: "gemini", status: "done", from: "2026-11-01", to: "2026-11-28", page: 3 });
  });
  it("odrzuca nieznane wartości i błędne daty", () => {
    const f = parseMeasurementFilters({ platforma: "x'; drop table", status: "zly", od: "2026-13-40", do: "jutro", strona: "-4" });
    expect(f).toEqual({ city: "", platform: "", status: "", from: "", to: "", page: 1 });
  });
  it("tablica parametrów daje wartości puste", () => {
    expect(parseMeasurementFilters({ miasto: ["a", "b"] }).city).toBe("");
  });
  it("buduje adres bez pustych parametrów", () => {
    expect(buildQuery("/admin/pomiary", { miasto: "Łódź", status: "", strona: 1 })).toBe("/admin/pomiary?miasto=%C5%81%C3%B3d%C5%BA&strona=1");
    expect(buildQuery("/admin/pomiary", { miasto: "" })).toBe("/admin/pomiary");
  });
});

describe("udziały z progiem próby", () => {
  it("za mała próba daje null i komunikat", () => {
    expect(sharePct(2, 4)).toBeNull();
    expect(sharePct(9, 9)).toBeNull();
    expect(formatShare(2, 4)).toBe("za mało danych (4)");
  });
  it("liczy udział", () => {
    expect(sharePct(1, 8)).toBeNull();
    expect(sharePct(1, 8, 5)).toBe(12.5);
    expect(formatShare(3, 10)).toBe("30% (3 z 10)");
    expect(formatShare(1, 8, 5)).toBe("12,5% (1 z 8)");
  });
  it("zero odpowiedzi", () => {
    expect(sharePct(0, 0, 0)).toBeNull();
  });
});

describe("agregacja firm", () => {
  const rows: FirmCityRow[] = [
    { key: "brand:1", label: "Alfa", matched: true, domain: "alfa.pl", city: "Kraków", answers: 6, recommended: 3 },
    { key: "brand:1", label: "Alfa", matched: true, domain: null, city: "Gdańsk", answers: 2, recommended: 0 },
    { key: "name:beta", label: "Beta", matched: false, domain: null, city: "Gdańsk", answers: 7, recommended: 1 },
    { key: "name:gamma", label: "Gamma", matched: false, domain: "gamma.pl", city: "Opole", answers: 1, recommended: 0 },
  ];
  const totals = new Map([["Kraków", 10], ["Gdańsk", 9], ["Opole", 2]]);
  const out = aggregateFirms(rows, totals, 5);
  it("sumuje i sortuje", () => {
    expect(out.map((o) => o.label)).toEqual(["Alfa", "Beta", "Gamma"]);
    expect(out[0]).toMatchObject({ answers: 8, recommended: 3, cities: 2, topCity: "Kraków", topCityAnswers: 6, topCityTotal: 10, topCityShare: 60, domain: "alfa.pl" });
  });
  it("udział w mieście z progiem próby", () => {
    expect(out[1].topCityShare).toBeCloseTo(77.8, 1);
    expect(out[2].topCityShare).toBeNull();
  });
  it("normalizuje nazwy kandydatów", () => {
    expect(normalizeFirmName("  Biuro  XYZ. ")).toBe("biuro xyz");
  });
});

describe("CSV", () => {
  it("cytuje i zabezpiecza formuły", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("-1+2")).toBe("'-1+2");
    expect(csvCell(null)).toBe("");
    expect(csvCell(new Date("2026-11-28T10:00:00Z"))).toBe("2026-11-28T10:00:00.000Z");
  });
  it("buduje plik z BOM i CRLF", () => {
    const csv = toCsv(["e-mail", "domena"], [["a@b.pl", null], ["c@d.pl", "x.pl"]]);
    expect(csv.startsWith("﻿e-mail,domena\r\n")).toBe(true);
    expect(csv.endsWith("c@d.pl,x.pl\r\n")).toBe(true);
  });
});
