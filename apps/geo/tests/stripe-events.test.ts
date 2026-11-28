import { describe, expect, it } from "vitest";

import { maskDomain } from "@/lib/affiliate-repo";
import { invoicePayment, proportionalNet } from "@/lib/stripe-events";

describe("faktury Stripe", () => {
  const inv = {
    id: "in_1", customer: "cus_1", amount_paid: 36777, total_excluding_tax: 29900, currency: "pln", created: 1_800_000_000,
    status_transitions: { paid_at: 1_800_000_100 }, parent: { subscription_details: { metadata: { account_id: "acc-1" } } },
  };
  it("bierze netto bez VAT i konto z metadanych", () => {
    expect(invoicePayment(inv)).toEqual({
      providerPaymentId: "in_1", customerId: "cus_1", accountIdHint: "acc-1",
      amountNetGrosze: 29900, amountGrossGrosze: 36777, occurredAt: new Date(1_800_000_100_000),
    });
  });
  it("pomija faktury zerowe i w innej walucie", () => {
    expect(invoicePayment({ ...inv, amount_paid: 0 })).toBeNull();
    expect(invoicePayment({ ...inv, currency: "eur" })).toBeNull();
  });
  it("zwrot częściowy proporcjonalnie", () => {
    expect(proportionalNet(36777, 29900, 36777)).toBe(29900);
    expect(proportionalNet(10000, 29900, 36777)).toBe(8130);
  });
});

describe("maskowanie domeny klienta w panelu partnera", () => {
  it("ukrywa część nazwy", () => {
    expect(maskDomain("nieruchomosci-kowalski.pl")).toBe("nie*****.pl");
    expect(maskDomain("ab.pl")).toBe("a**.pl");
    expect(maskDomain(null)).toBe("klient bez domeny");
  });
});
