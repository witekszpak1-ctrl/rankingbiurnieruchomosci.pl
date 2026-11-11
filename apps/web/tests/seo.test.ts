import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { cityLocative, hasLocative, inCity } from "@/lib/cities";
import { cityMeta, firmMeta, homeMeta } from "@/lib/meta-texts";
import { breadcrumbLd, clampDescription, pageMetadata } from "@/lib/seo";

describe("odmiana miast", () => {
  it("poprawny miejscownik z przyimkiem", () => {
    expect(inCity("Warszawa")).toBe("w Warszawie");
    expect(inCity("Wrocław")).toBe("we Wrocławiu");
    expect(inCity("Kraków")).toBe("w Krakowie");
    expect(inCity("Białystok")).toBe("w Białymstoku");
    expect(inCity("Zakopane")).toBe("w Zakopanem");
    expect(cityLocative("Wrocław")).toBe("Wrocławiu");
  });
  it("każde miasto z listy branży ma odmianę", () => {
    const names = readFileSync(new URL("../../../packages/verticals/nieruchomosci/cities.txt", import.meta.url), "utf8")
      .split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
    expect(names.length).toBeGreaterThan(300);
    expect(names.filter((n) => !hasLocative(n))).toEqual([]);
  });
  it("nieznane miasto: bezpieczna forma", () => {
    expect(inCity("Nowe Miasteczko")).toBe("w mieście Nowe Miasteczko");
  });
});

describe("metadane", () => {
  it("strona główna", () => {
    const m = homeMeta(2026, 76, 5);
    expect(m.title).toBe("Ranking biur nieruchomości w Polsce 2026 | Porównaj biura");
    expect(m.description).toContain("76 biur w 5 miastach");
  });
  it("miasto z rankingiem i bez", () => {
    const w = cityMeta("Warszawa", 2026, 26, true, 5);
    expect(w.title).toBe("Ranking biur nieruchomości Warszawa 2026 | 26 biur");
    expect(w.description).toMatch(/^Ranking 26 biur nieruchomości w Warszawie\./);
    expect(cityMeta("Wrocław", 2026, 14, true, 0).description).toContain("we Wrocławiu");
    expect(cityMeta("Wrocław", 2026, 14, true, 0).description).not.toContain("prowizje");
    expect(cityMeta("Piaseczno", 2026, 2, false, 0).title).toBe("Biura nieruchomości Piaseczno | 2 biura w katalogu");
  });
  it("profil firmy bez wymyślonych danych", () => {
    const m = firmMeta({ name: "MAXON Nieruchomości", cityName: "Warszawa", score: 86, hasGoogle: false, hasPrices: true, offers: 12 });
    expect(m.title).toBe("MAXON Nieruchomości Warszawa | Prowizje, ranking");
    expect(m.description).toBe(
      "Biuro nieruchomości MAXON Nieruchomości w Warszawie. Sprawdź wynik 86/100 w rankingu, prowizje, zakres usług, aktualne oferty i dane kontaktowe biura.",
    );
    const g = firmMeta({ name: "Wrocław Domy", cityName: "Wrocław", score: 50, hasGoogle: true, hasPrices: false, offers: 0 });
    expect(g.title).toBe("Wrocław Domy | Opinie, usługi, ranking");
    expect(g.description).not.toContain("prowizje");
  });
  it("wspólny generator: canonical, OG, robots", () => {
    const m = pageMetadata({ title: "T", description: "Opis", path: "/warszawa" });
    expect(m.alternates?.canonical).toBe("https://rankingbiurnieruchomosci.pl/warszawa");
    expect(m.openGraph).toMatchObject({ url: "https://rankingbiurnieruchomosci.pl/warszawa", locale: "pl_PL" });
    expect(m.robots).toEqual({ index: true, follow: true });
    expect(pageMetadata({ title: "T", description: "O", path: "/x", noindex: true }).robots).toEqual({ index: false, follow: true });
  });
  it("opis przycięty do granicy słowa", () => {
    const long = "Słowo ".repeat(60);
    const c = clampDescription(long);
    expect(c.length).toBeLessThanOrEqual(160);
    expect(c.endsWith("…")).toBe(true);
  });
  it("okruszki", () => {
    const b = breadcrumbLd([{ name: "Strona główna", path: "/" }, { name: "Warszawa", path: "/warszawa" }]);
    expect(b.itemListElement[1]).toMatchObject({ position: 2, item: "https://rankingbiurnieruchomosci.pl/warszawa" });
  });
});
