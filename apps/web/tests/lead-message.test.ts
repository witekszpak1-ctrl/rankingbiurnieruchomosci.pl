import { describe, expect, it } from "vitest";

import { leadMessage } from "../lib/lead-message";
import { validateLead } from "../lib/leads";

const TOPICS = ["", "kupno", "sprzedaz", "wynajem", "najem", "wycena", "inne"] as const;

describe("leadMessage", () => {
  it("wstawia miasto tam, gdzie sprawa go dotyczy", () => {
    expect(leadMessage("kupno", "w Krakowie")).toContain("zakup nieruchomości w Krakowie");
    expect(leadMessage("sprzedaz", "we Wrocławiu")).toContain("sprzedać nieruchomość we Wrocławiu");
    expect(leadMessage("wycena", "w Gdańsku")).toContain("wycenę nieruchomości w Gdańsku");
  });

  it("każda gotowa wiadomość przechodzi walidację formularza i jest inna dla każdej sprawy", () => {
    const all = TOPICS.map((t) => leadMessage(t, "w Krakowie"));
    expect(new Set(all).size).toBe(all.length);
    for (const message of all) {
      const r = validateLead({ topic: "kupno", name: "Anna", email: "anna@przyklad.pl", message, consent: "on" });
      expect(r.ok).toBe(true);
    }
  });

  it("bez długich myślników", () => {
    for (const t of TOPICS) expect(leadMessage(t, "w Krakowie")).not.toMatch(/[–—]/);
  });
});
