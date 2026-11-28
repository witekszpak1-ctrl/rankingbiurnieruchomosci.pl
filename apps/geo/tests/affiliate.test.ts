import { describe, expect, it } from "vitest";

import {
  DAY_MS,
  affiliateLink,
  availableAt,
  balance,
  canRequestPayout,
  chooseAttribution,
  commissionGrosze,
  decodeRefCookie,
  encodeRefCookie,
  formatPln,
  normalizeCode,
  safeRedirectPath,
  selfReferralReason,
  suggestCode,
} from "@/lib/affiliate";
import { signStripePayload, verifyStripeSignature } from "@/lib/stripe-signature";

describe("kody i linki", () => {
  it("normalizuje kod", () => {
    expect(normalizeCode(" Witek2026 ")).toBe("witek2026");
    expect(normalizeCode("ab")).toBeNull();
    expect(normalizeCode("ma-spacje i-znaki")).toBeNull();
  });
  it("proponuje kod bez polskich znaków", () => {
    expect(suggestCode("Łukasz Żółć")).toBe("lukaszzolc");
    expect(suggestCode("Al", () => 0)).toBe("al1000");
  });
  it("buduje link z kampanią i bezpieczną ścieżką", () => {
    expect(affiliateLink("https://geo.example", "witek", { campaign: "Facebook Luty!", to: "/audyt" })).toBe(
      "https://geo.example/r/witek?c=facebookluty&to=%2Faudyt",
    );
    expect(affiliateLink("https://geo.example", "witek", { to: "https://zly.pl" })).toBe("https://geo.example/r/witek");
  });
  it("blokuje otwarte przekierowania", () => {
    expect(safeRedirectPath("//evil.com")).toBeNull();
    expect(safeRedirectPath("/\\evil.com")).toBeNull();
    expect(safeRedirectPath("https://evil.com")).toBeNull();
    expect(safeRedirectPath("/cennik")).toBe("/cennik");
  });
  it("koduje i odczytuje ciasteczko", () => {
    const v = { code: "witek", clickId: 42, at: 1_700_000_000_000, campaign: "fb" };
    expect(decodeRefCookie(encodeRefCookie(v))).toEqual(v);
    expect(decodeRefCookie("zly")).toBeNull();
    expect(decodeRefCookie("witek..123.")).toEqual({ code: "witek", clickId: null, at: 123, campaign: null });
  });
});

describe("przypisanie klienta", () => {
  const now = 1_800_000_000_000;
  const cookie = { code: "anna", clickId: 1, at: now - 10 * DAY_MS, campaign: null };
  it("kod z formularza wygrywa z linkiem", () => {
    expect(chooseAttribution({ enteredCode: "Piotr", cookie, now, cookieDays: 90 })?.code).toBe("piotr");
  });
  it("kod podpowiedziany z linku zachowuje kampanię i kliknięcie", () => {
    expect(chooseAttribution({ enteredCode: "anna", cookie: { ...cookie, campaign: "fb" }, now, cookieDays: 90 })).toEqual({
      code: "anna", clickId: 1, campaign: "fb", source: "link",
    });
  });
  it("link działa przez 90 dni", () => {
    expect(chooseAttribution({ cookie, now, cookieDays: 90 })?.source).toBe("link");
    expect(chooseAttribution({ cookie: { ...cookie, at: now - 91 * DAY_MS }, now, cookieDays: 90 })).toBeNull();
  });
  it("odrzuca polecenie samego siebie", () => {
    const base = { affiliateUserId: "a", affiliateEmail: "jan@firma.pl", customerUserId: "b", customerEmail: "x@gmail.com" };
    expect(selfReferralReason({ ...base, customerUserId: "a" })).toBe("to samo konto");
    expect(selfReferralReason({ ...base, customerEmail: "JAN@firma.pl" })).toBe("ten sam e-mail");
    expect(selfReferralReason({ ...base, customerEmail: "ola@firma.pl" })).toBe("ta sama firmowa domena e-mail");
    expect(selfReferralReason({ ...base, customerDomain: "https://www.firma.pl/" })).toBe(
      "domena e-mail partnera to strona klienta",
    );
    expect(selfReferralReason(base)).toBeNull();
    // darmowa skrzynka partnera nie blokuje klientów z tą samą skrzynką
    expect(selfReferralReason({ ...base, affiliateEmail: "jan@gmail.com" })).toBeNull();
  });
});

describe("prowizje", () => {
  it("liczy 20% od netto z zaokrągleniem do grosza", () => {
    expect(commissionGrosze(29900, 2000)).toBe(5980);
    expect(commissionGrosze(9900, 2000)).toBe(1980);
    expect(commissionGrosze(3, 2000)).toBe(1); // 0,6 grosza -> 1
    expect(commissionGrosze(2, 2000)).toBe(0); // 0,4 grosza -> 0
    expect(commissionGrosze(-29900, 2000)).toBe(-5980);
    expect(() => commissionGrosze(100, 20001)).toThrow();
  });
  it("saldo z okresem na zwroty", () => {
    const now = new Date("2026-12-31T00:00:00Z");
    const paidAt = new Date("2026-11-01T00:00:00Z");
    const rows = [
      { amountGrosze: 5980, status: "pending" as const, availableAt: availableAt(paidAt, 30) },
      { amountGrosze: 5980, status: "pending" as const, availableAt: availableAt(new Date("2026-12-20T00:00:00Z"), 30) },
      { amountGrosze: -1980, status: "pending" as const, availableAt: availableAt(new Date("2026-12-25T00:00:00Z"), 30) },
      { amountGrosze: 4000, status: "paid" as const, availableAt: paidAt },
      { amountGrosze: 9999, status: "void" as const, availableAt: paidAt },
    ];
    expect(balance(rows, now)).toEqual({ pendingGrosze: 5980, availableGrosze: 4000, paidGrosze: 4000 });
    expect(canRequestPayout(balance(rows, now), { minPayoutGrosze: 10000 })).toBe(false);
    expect(canRequestPayout({ pendingGrosze: 0, availableGrosze: 10000, paidGrosze: 0 }, { minPayoutGrosze: 10000 })).toBe(true);
  });
  it("formatuje złotówki", () => {
    expect(formatPln(598000)).toBe("5 980,00 zł");
    expect(formatPln(-1980)).toBe("-19,80 zł");
  });
});

describe("podpis Stripe", () => {
  const secret = "whsec_test";
  const body = '{"id":"evt_1"}';
  it("przyjmuje poprawny i odrzuca zmieniony lub stary", () => {
    const t = 1_800_000_000;
    const header = signStripePayload(body, secret, t);
    expect(verifyStripeSignature(body, header, secret, t)).toBe(true);
    expect(verifyStripeSignature(body + " ", header, secret, t)).toBe(false);
    expect(verifyStripeSignature(body, header, "inny", t)).toBe(false);
    expect(verifyStripeSignature(body, header, secret, t + 301)).toBe(false);
    expect(verifyStripeSignature(body, null, secret, t)).toBe(false);
  });
});
