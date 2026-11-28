import { describe, expect, it } from "vitest";

import { canAddDomain, canTrackPrompts, canUsePlatform, effectivePlan, hasReport, intervalDays, parseEntitlements } from "@/lib/entitlements";

// Te same wartości co w db/geo/0001_core.sql (pakiet Monitor).
const monitor = parseEntitlements({
  prompts: 50, platforms: ["chatgpt", "gemini"], frequency: "weekly", domains: 1, competitors: 10,
  premium_profile: false, autofix: false, reports: ["basic", "history", "sources"], alerts: true,
});

describe("uprawnienia z JSON pakietu", () => {
  it("odczytuje pakiet", () => {
    expect(monitor.prompts).toBe(50);
    expect(intervalDays(monitor)).toBe(7);
    expect(hasReport(monitor, "sources")).toBe(true);
    expect(hasReport(monitor, "source_gap")).toBe(false);
  });
  it("brakujące lub złe pola dają najostrożniejsze wartości", () => {
    const e = parseEntitlements({ prompts: -5, frequency: "co godzinę", platforms: "chatgpt", premium_profile: "tak" });
    expect(e).toMatchObject({ prompts: 0, frequency: "once", platforms: [], premiumProfile: false, domains: 0 });
    expect(parseEntitlements(null).prompts).toBe(0);
  });
  it("limity", () => {
    expect(canTrackPrompts(monitor, 45, 5)).toEqual({ ok: true });
    expect(canTrackPrompts(monitor, 45, 6).ok).toBe(false);
    expect(canUsePlatform(monitor, "perplexity").ok).toBe(false);
    expect(canAddDomain(monitor, 1).ok).toBe(false);
  });
  it("zaległa płatność lub anulowanie wraca do Free", () => {
    expect(effectivePlan({ planId: "growth", status: "active" })).toBe("growth");
    expect(effectivePlan({ planId: "growth", status: "trialing" })).toBe("growth");
    expect(effectivePlan({ planId: "growth", status: "past_due" })).toBe("free");
    expect(effectivePlan(null)).toBe("free");
  });
});
