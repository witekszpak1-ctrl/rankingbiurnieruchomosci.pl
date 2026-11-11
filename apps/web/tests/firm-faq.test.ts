import { describe, expect, it } from "vitest";

import { firmFaq } from "@/lib/firm-faq";

const base = {
  name: "Zeta Invest", cityName: "Wrocław", address: "ul. Świdnicka 10, 50-067 Wrocław", phone: "+48711234567",
  services: ["sprzedaż mieszkań", "wynajem mieszkań"],
  prices: [{ service: "pośrednictwo w sprzedaży", unit: "percent" as const, amountMin: 1.8, amountMax: null, taxMode: "net" as const }],
  registryConfirmed: true, registryYears: 21, offersCount: 20, score: 76, position: 4, cityCount: 6,
};

describe("FAQ profilu biura", () => {
  it("odpowiedzi z danych firmy", () => {
    const faq = firmFaq(base);
    const a = (q: string) => faq.find((f) => f.q.includes(q))?.a ?? "";
    expect(a("Czym zajmuje się")).toContain("we Wrocławiu");
    expect(a("prowizja")).toContain("od 1,8% netto od ceny transakcyjnej");
    expect(a("rejestru")).toContain("od 21 lat");
    expect(a("aktualne oferty")).toContain("co najmniej 20 ofert");
    expect(a("rankingu")).toContain("4. miejsce na 6 z wynikiem 76/100");
    expect(a("skontaktować")).toContain("+48 711 234 567");
    expect(faq.length).toBeLessThanOrEqual(7);
  });
  it("bez danych nie wymyśla", () => {
    const faq = firmFaq({ ...base, services: [], prices: [], registryConfirmed: false, registryYears: null, offersCount: 0, phone: null, address: null, position: null, cityCount: null });
    expect(faq.some((f) => f.q.includes("Czym zajmuje się"))).toBe(false);
    expect(faq.some((f) => f.q.includes("aktualne oferty"))).toBe(false);
    expect(faq.find((f) => f.q.includes("prowizja"))?.a).toContain("nie publikuje stawek");
    expect(faq.find((f) => f.q.includes("rejestru"))?.a).toMatch(/^Nie udało się/);
  });
});
