import { describe, expect, it } from "vitest";

import { shortText } from "@/lib/format";

describe("skracanie opisu na kartach", () => {
  it("tnie na granicy słowa i dodaje wielokropek", () => {
    expect(shortText("Krótki opis.", 150)).toBe("Krótki opis.");
    const long = "Biuro z Krakowa, które zajmuje się sprzedażą, wynajmem i doradztwem przy zakupie mieszkań, domów oraz działek w całej Małopolsce i okolicach miasta.";
    const out = shortText(long, 60);
    expect(out.length).toBeLessThanOrEqual(61);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toMatch(/[,\s]…$/);
  });
});
