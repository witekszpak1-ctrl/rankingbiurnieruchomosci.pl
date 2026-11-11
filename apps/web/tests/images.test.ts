import { describe, expect, it } from "vitest";

import { imageSrcSet, optimizedImage, responsiveSrcSet } from "@/lib/images";

describe("optymalizacja obrazków", () => {
  it("zmniejsza do zadanej szerokości w WebP, z powrotem do oryginału przy błędzie", () => {
    const u = new URL(optimizedImage("https://biuro.pl/logo.png", 64));
    expect(u.origin).toBe("https://wsrv.nl");
    expect(u.searchParams.get("w")).toBe("64");
    expect(u.searchParams.get("output")).toBe("webp");
    expect(u.searchParams.get("default")).toBe("https://biuro.pl/logo.png");
  });
  it("SVG i adresy względne bez zmian", () => {
    expect(optimizedImage("https://biuro.pl/logo.svg", 64)).toBe("https://biuro.pl/logo.svg");
    expect(optimizedImage("/opengraph-image", 64)).toBe("/opengraph-image");
    expect(imageSrcSet("https://biuro.pl/logo.svg", 64)).toBeUndefined();
  });
  it("srcSet 1x/2x i szerokościowy", () => {
    expect(imageSrcSet("https://biuro.pl/a.jpg", 64)).toMatch(/w=64.* 1x, .*w=128.* 2x$/);
    expect(responsiveSrcSet("https://biuro.pl/a.jpg", [640, 1200])).toMatch(/w=640.* 640w, .*w=1200.* 1200w$/);
  });
});
