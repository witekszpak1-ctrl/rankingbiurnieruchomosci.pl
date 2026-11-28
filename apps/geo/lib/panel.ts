import type { AuditResult } from "./audit";
import type { Tone } from "./score";

/** Czysta logika pulpitu klienta: kroki startowe z prawdziwym stanem i lista "Wymaga uwagi". Bez bazy. */

export type PanelAccount = {
  id: string;
  name: string;
  domain: string | null;
  planId: string | null;
  planName: string | null;
  status: string | null;
};

export type PanelFacts = {
  accounts: PanelAccount[];
  hasAffiliate: boolean;
  affiliateClicks: number;
};

export type SetupStep = { key: string; title: string; hint: string; done: boolean; href: string; action: string };

export function primaryAccount(accounts: PanelAccount[]): PanelAccount | null {
  return accounts.find((a) => a.domain) ?? accounts[0] ?? null;
}

export function hasPaidPlan(accounts: PanelAccount[]): boolean {
  return accounts.some((a) => a.planId && a.planId !== "free" && (a.status === "active" || a.status === "trialing"));
}

/** Cztery kroki startowe. "Zobacz audyt" jest zrobiony, gdy dla domeny konta mamy audyt z pomiarami (da się go otworzyć). */
export function setupSteps(facts: PanelFacts, audit: AuditResult | null): SetupStep[] {
  const acc = primaryAccount(facts.accounts);
  const domain = acc?.domain ?? null;
  return [
    {
      key: "domain",
      title: "Dodaj domenę",
      hint: domain ? `Strona firmy: ${domain}` : "Podaj adres strony firmy, żebyśmy mogli dopasować pomiary.",
      done: Boolean(domain),
      href: "/rejestracja",
      action: domain ? "Zmień" : "Dodaj firmę",
    },
    {
      key: "audit",
      title: "Zobacz audyt",
      hint: audit?.status === "ok" ? "Audyt jest gotowy: wynik, konkurenci i źródła." : "Audyt pojawi się, gdy domena jest w katalogu i ma pomiary.",
      done: audit?.status === "ok",
      href: domain ? `/audyt/${encodeURIComponent(domain)}` : "/audyt",
      action: "Otwórz audyt",
    },
    {
      key: "partner",
      title: "Zaproś partnera",
      hint: facts.hasAffiliate ? "Masz link partnerski i zarabiasz 20% dożywotnio." : "Dołącz do programu i polecaj dalej: 20% dożywotnio.",
      done: facts.hasAffiliate,
      href: facts.hasAffiliate ? "/partner/panel" : "/partner/dolacz",
      action: facts.hasAffiliate ? "Panel partnera" : "Dołącz",
    },
    {
      key: "plan",
      title: "Wybierz pakiet",
      hint: hasPaidPlan(facts.accounts) ? "Masz aktywny pakiet." : "Płatne pakiety uruchomimy wkrótce. Zapisz się, a damy znać.",
      done: hasPaidPlan(facts.accounts),
      href: "/#cennik",
      action: "Zobacz pakiety",
    },
  ];
}

export type AttentionItem = { tone: Tone; text: string; href?: string; action?: string };

/** Lista "Wymaga uwagi": wyłącznie z prawdziwych danych konta i audytu. */
export function attentionItems(facts: PanelFacts, audit: AuditResult | null): AttentionItem[] {
  const items: AttentionItem[] = [];
  const acc = primaryAccount(facts.accounts);
  if (!acc) {
    items.push({ tone: "warn", text: "Nie masz jeszcze konta firmy.", href: "/rejestracja", action: "Dodaj firmę" });
    return items;
  }
  if (!acc.domain) {
    items.push({ tone: "warn", text: "Konto nie ma adresu strony firmy, więc nie pokażemy audytu.", href: "/rejestracja", action: "Dodaj domenę" });
    return items;
  }
  if (acc.status && acc.status !== "active" && acc.status !== "trialing") {
    items.push({ tone: "bad", text: `Abonament ma status: ${acc.status}.`, href: "/#cennik", action: "Zobacz pakiety" });
  }
  if (audit?.status === "not_in_catalog") {
    items.push({ tone: "warn", text: `Domeny ${acc.domain} nie ma w naszym katalogu biur nieruchomości, więc nie mamy dla niej pomiarów.`, href: "/audyt", action: "Zapisz się na pełny audyt" });
  } else if (audit?.status === "no_measurements") {
    items.push({ tone: "warn", text: "Firma jest w katalogu, ale jej miasto nie ma jeszcze świeżych pomiarów (z ostatnich 30 dni)." });
  } else if (audit?.status === "ok") {
    if (!audit.enoughData) {
      items.push({ tone: "warn", text: `Za mało danych: ${audit.usage.count} odpowiedzi, potrzeba ${audit.minSample}. Wynik pojawi się po kolejnych pomiarach.` });
    } else if (!audit.mentioned) {
      items.push({ tone: "bad", text: "Asystenci AI nie wymieniają Twojej firmy w żadnej z zebranych odpowiedzi.", href: `/audyt/${encodeURIComponent(acc.domain)}`, action: "Zobacz, kogo wymieniają" });
    } else if (audit.recommendedAnswers === 0) {
      items.push({ tone: "warn", text: "Firma jest wymieniana, ale w żadnej odpowiedzi nie jest wprost polecana.", href: `/audyt/${encodeURIComponent(acc.domain)}`, action: "Zobacz rozbicie" });
    }
    if (audit.citedAnswers === 0 && audit.enoughData) {
      items.push({ tone: "warn", text: "Żadna odpowiedź AI nie cytuje Twojej strony jako źródła." });
    }
    if (!audit.ownPortal.hasProfile) {
      items.push({ tone: "warn", text: "Nie masz opublikowanego profilu w naszym katalogu.", href: "https://rankingbiurnieruchomosci.pl", action: "Przejdź do katalogu" });
    }
  }
  if (facts.hasAffiliate && facts.affiliateClicks === 0) {
    items.push({ tone: "neutral", text: "Twój link partnerski nie ma jeszcze kliknięć.", href: "/partner/panel", action: "Skopiuj link" });
  }
  return items;
}
