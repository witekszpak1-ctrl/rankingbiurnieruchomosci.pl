import { describe, expect, it } from "vitest";

import { slugify, uniqueSlug } from "@/lib/slug";

describe("slugify", () => {
  it("usuwa polskie znaki i normalizuje separatory", () => {
    expect(slugify("Zażółć gęślą jaźń Łódź")).toBe("zazolc-gesla-jazn-lodz");
    expect(slugify("  Alfa & Beta Nieruchomości  Sp. z o.o. ")).toBe("alfa-beta-nieruchomosci-sp-z-o-o");
    expect(slugify("Gorzów Wielkopolski")).toBe("gorzow-wielkopolski");
  });
  it("zwraca pusty ciąg dla samych znaków specjalnych", () => {
    expect(slugify("***")).toBe("");
  });
});

describe("uniqueSlug", () => {
  it("dodaje numer przy kolizji", () => {
    expect(uniqueSlug("alfa", [])).toBe("alfa");
    expect(uniqueSlug("alfa", ["alfa"])).toBe("alfa-2");
    expect(uniqueSlug("alfa", ["alfa", "alfa-2", "alfa-3"])).toBe("alfa-4");
  });
  it("używa awaryjnej nazwy dla pustej bazy", () => {
    expect(uniqueSlug("", [])).toBe("firma");
  });
});
