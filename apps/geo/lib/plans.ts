import { query } from "./db";
import { parseEntitlements, type Entitlements } from "./entitlements";

/**
 * Pakiety do wyświetlenia na stronie: z geo.plans (cena i uprawnienia w bazie), opis uprawnień po polsku.
 * Zmiana pakietu to zmiana w bazie, nie w kodzie; stała FALLBACK_PLANS służy tylko, gdy baza jest niedostępna.
 */

export type PlanView = {
  id: string;
  name: string;
  priceGrosze: number;
  /** "od 790 zł" dla pakietu agencyjnego (cena zależy od liczby domen). */
  pricePrefix: string;
  features: string[];
  highlight: boolean;
};

const PLATFORM_NAMES: Record<string, string> = { chatgpt: "ChatGPT", gemini: "Gemini", perplexity: "Perplexity", claude: "Claude", copilot: "Copilot", google_ai_overview: "Google AI Overview", google_ai_mode: "Google AI Mode" };

const REPORT_NAMES: Record<string, string> = {
  history: "historia zmian",
  sources: "ranking źródeł cytowanych przez AI",
  source_gap: "luki w źródłach (gdzie są konkurenci, a Ciebie nie ma)",
  white_label: "raporty pod własną marką",
};

function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const last = n % 10;
  const lastTwo = n % 100;
  return last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14) ? few : many;
}

/** Uprawnienia pakietu jako krótka lista zdań po polsku (bez żargonu). */
export function describeEntitlements(e: Entitlements): string[] {
  const out: string[] = [];
  out.push(`${e.prompts} ${plural(e.prompts, "pytanie", "pytania", "pytań")} o Twoją firmę w asystentach AI`);
  if (e.platforms.length) out.push(`Platformy: ${e.platforms.map((p) => PLATFORM_NAMES[p] ?? p).join(", ")}`);
  out.push(
    { once: "Jednorazowy audyt", monthly: "Pomiar raz w miesiącu", weekly: "Pomiar co tydzień", daily: "Pomiar codziennie" }[e.frequency],
  );
  out.push(`${e.domains} ${plural(e.domains, "domena", "domeny", "domen")}`);
  out.push(`Porównanie z ${e.competitors} ${plural(e.competitors, "konkurentem", "konkurentami", "konkurentami")}`);
  const reports = e.reports.filter((r) => REPORT_NAMES[r]).map((r) => REPORT_NAMES[r]);
  if (reports.length) out.push(`Raporty: ${reports.join(", ")}`);
  if (e.alerts) out.push("Powiadomienia o zmianach");
  if (e.premiumProfile) out.push("Rozszerzony profil w katalogu");
  if (e.autofix) out.push("Gotowe poprawki do wdrożenia");
  return out;
}

type PlanRow = { id: string; name: string; price: string; entitlements: unknown };

export function toPlanView(r: PlanRow): PlanView {
  return {
    id: r.id,
    name: r.name,
    priceGrosze: Number(r.price),
    pricePrefix: r.id === "agency" ? "od " : "",
    features: describeEntitlements(parseEntitlements(r.entitlements)),
    highlight: r.id === "growth",
  };
}

/** Cena w pełnych złotych z "zł" (bez groszy, gdy ich nie ma). */
export function formatPlanPrice(p: Pick<PlanView, "priceGrosze" | "pricePrefix">): string {
  if (p.priceGrosze === 0) return "0 zł";
  const zl = p.priceGrosze / 100;
  const txt = Number.isInteger(zl) ? String(zl) : zl.toFixed(2).replace(".", ",");
  return `${p.pricePrefix}${txt} zł`;
}

const FALLBACK_ROWS: PlanRow[] = [
  { id: "free", name: "Free", price: "0", entitlements: { prompts: 5, platforms: ["chatgpt", "gemini"], frequency: "once", domains: 1, competitors: 5, reports: ["basic"] } },
  { id: "monitor", name: "Monitor", price: "9900", entitlements: { prompts: 50, platforms: ["chatgpt", "gemini"], frequency: "weekly", domains: 1, competitors: 10, reports: ["basic", "history", "sources"], alerts: true } },
  { id: "growth", name: "Growth", price: "29900", entitlements: { prompts: 100, platforms: ["chatgpt", "gemini"], frequency: "weekly", domains: 1, competitors: 20, premium_profile: true, autofix: true, reports: ["basic", "history", "sources", "source_gap"], alerts: true } },
  { id: "agency", name: "Agency", price: "79000", entitlements: { prompts: 300, platforms: ["chatgpt", "gemini"], frequency: "weekly", domains: 10, competitors: 20, premium_profile: true, autofix: true, reports: ["basic", "history", "sources", "source_gap", "white_label"], alerts: true } },
];

export const FALLBACK_PLANS: PlanView[] = FALLBACK_ROWS.map(toPlanView);

export async function loadPublicPlans(): Promise<PlanView[]> {
  try {
    const rows = await query<PlanRow>(
      `select id, name, price_monthly_grosze::text as price, entitlements from geo.plans where is_public order by sort_order, id`,
    );
    return rows.length ? rows.map(toPlanView) : FALLBACK_PLANS;
  } catch {
    return FALLBACK_PLANS;
  }
}
