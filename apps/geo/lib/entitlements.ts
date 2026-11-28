/**
 * Silnik uprawnień: co wolno kontu, wyłącznie na podstawie geo.plans.entitlements (JSON) i stanu abonamentu.
 * Zmiana pakietu, limitu albo ceny to zmiana w bazie, nie w kodzie. Nieznane pola są ignorowane, brakujące
 * dostają najostrożniejszą wartość (brak dostępu, limit 0).
 */

export type Frequency = "once" | "monthly" | "weekly" | "daily";

export type Entitlements = {
  prompts: number;
  platforms: string[];
  frequency: Frequency;
  domains: number;
  competitors: number;
  premiumProfile: boolean;
  autofix: boolean;
  reports: string[];
  alerts: boolean;
};

const FREQUENCIES: Frequency[] = ["once", "monthly", "weekly", "daily"];

function int(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
}

function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export function parseEntitlements(raw: unknown): Entitlements {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    prompts: int(r.prompts),
    platforms: strings(r.platforms),
    frequency: FREQUENCIES.includes(r.frequency as Frequency) ? (r.frequency as Frequency) : "once",
    domains: int(r.domains),
    competitors: int(r.competitors),
    premiumProfile: r.premium_profile === true,
    autofix: r.autofix === true,
    reports: strings(r.reports),
    alerts: r.alerts === true,
  };
}

/** Abonament daje płatne uprawnienia tylko w stanie aktywnym lub próbnym; po zaległości lub anulowaniu: Free. */
export function effectivePlan(sub: { planId: string; status: string } | null): string {
  if (!sub) return "free";
  return sub.status === "active" || sub.status === "trialing" ? sub.planId : "free";
}

export type Check = { ok: true } | { ok: false; reason: string; limit: number | string };

export function canTrackPrompts(e: Entitlements, alreadyTracked: number, adding: number): Check {
  return alreadyTracked + adding <= e.prompts
    ? { ok: true }
    : { ok: false, reason: `Pakiet pozwala monitorować ${e.prompts} pytań.`, limit: e.prompts };
}

export function canUsePlatform(e: Entitlements, platform: string): Check {
  return e.platforms.includes(platform)
    ? { ok: true }
    : { ok: false, reason: `Platforma ${platform} nie jest w pakiecie.`, limit: e.platforms.join(", ") };
}

export function canAddDomain(e: Entitlements, domains: number): Check {
  return domains + 1 <= e.domains ? { ok: true } : { ok: false, reason: `Pakiet obejmuje ${e.domains} domen.`, limit: e.domains };
}

export function hasReport(e: Entitlements, report: string): boolean {
  return e.reports.includes(report);
}

/** Ile dni między pomiarami monitorowanych pytań (Free: tylko jednorazowy audyt). */
export function intervalDays(e: Entitlements): number | null {
  return { once: null, monthly: 30, weekly: 7, daily: 1 }[e.frequency];
}
