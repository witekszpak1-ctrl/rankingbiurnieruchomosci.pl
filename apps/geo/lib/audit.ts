import { MIN_SAMPLE, visibility, visibilityScore, type Interval, type MeasurementResult, type Platform } from "./measure";

/**
 * Darmowy audyt widoczności w AI: czyste funkcje (bez bazy i bez sieci). Dane wejściowe to pomiary biblioteki
 * (geo.measurements, mentions, citations) dla miasta firmy i profil z katalogu. Żadnych własnych liczb:
 * wskaźniki liczy measure.ts, a przy próbie poniżej MIN_SAMPLE mówimy, że danych jest za mało.
 */

export const OWN_PORTAL_DOMAIN = "rankingbiurnieruchomosci.pl";
export const MAX_DOMAIN_INPUT = 300;

// Końcówki, które nigdy nie są publiczną firmą (sieć lokalna, wewnętrzne, zarezerwowane do rozwiązywania nazw).
const PRIVATE_TLDS = new Set(["local", "localhost", "internal", "intranet", "lan", "home", "corp", "localdomain", "arpa", "invalid", "onion"]);
const LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const TLD_RE = /^(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/;

/**
 * Z tego, co wpisał użytkownik, robi samą domenę (małe litery, bez schematu, www, ścieżki, portu).
 * Zwraca null dla wszystkiego, co nie jest zwykłą publiczną domeną: adresów IP (także zapisanych
 * dziesiętnie lub szesnastkowo), localhost, sieci lokalnych, adresów z danymi logowania i portem,
 * innych schematów niż http(s). Audyt jeszcze niczego nie pobiera, ale ta ochrona ma być gotowa
 * przed dodaniem pomiarów na żywo i skanu strony.
 */
export function normalizeDomain(input: string | null | undefined): string | null {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw || raw.length > MAX_DOMAIN_INPUT) return null;
  if (/[\s\u0000-\u001f\u007f]/.test(raw)) return null;
  const scheme = /^([a-z][a-z0-9+.-]*):\/\//i.exec(raw);
  if (scheme && !/^https?$/i.test(scheme[1])) return null;
  if (!scheme && /^[a-z][a-z0-9+.-]*:(?!\d+(?:[/?#]|$))/i.test(raw)) return null; // np. javascript:, mailto:
  let url: URL;
  try {
    url = new URL(scheme ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (url.username || url.password || url.port) return null;
  let host = url.hostname.toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
  if (!host || host.length > 253) return null;
  if (host.includes(":") || host.includes("[") || host.includes("%")) return null; // adresy IPv6 i strefy
  const labels = host.split(".");
  if (labels.length < 2) return null;
  if (!labels.every((l) => LABEL_RE.test(l))) return null;
  const tld = labels[labels.length - 1];
  if (!TLD_RE.test(tld) || PRIVATE_TLDS.has(tld)) return null; // cyfrowa końcówka = adres IP
  if (labels.length === 2 && labels[0] === "www") return null;
  host = labels.join(".");
  return host;
}

/** Domena do porównań w bazie: sama domena i wariant z www. */
export function hostVariants(domain: string): string[] {
  return [domain, `www.${domain}`];
}

export function domainMatches(candidate: string | null | undefined, domain: string): boolean {
  if (!candidate) return false;
  const c = candidate.toLowerCase().replace(/^www\./, "");
  return c === domain || c.endsWith(`.${domain}`);
}

const PLATFORM_LABELS: Record<string, string> = {
  gemini: "Gemini",
  google_ai_mode: "Google AI Mode",
  google_ai_overview: "Google AI Overview",
  chatgpt: "ChatGPT",
  perplexity: "Perplexity",
  claude: "Claude",
  copilot: "Copilot",
};

export function platformLabel(platform: string): string {
  return PLATFORM_LABELS[platform] ?? platform;
}

export type AuditMention = {
  name: string;
  domain: string | null;
  brandId: string | null;
  /** Nazwa firmy z katalogu, gdy wzmianka została dopasowana (brandId), inaczej null. */
  brandName: string | null;
  position: number;
  recommended: boolean;
};

export type AuditCitation = { domain: string; isOwnPortal: boolean };

export type AuditMeasurement = {
  id: string;
  platform: string;
  measuredAt: Date | string;
  promptText: string;
  mentions: AuditMention[];
  citations: AuditCitation[];
};

export type AuditInput = {
  /** Znormalizowana domena firmy. */
  domain: string;
  /** Firma z katalogu dopasowana po domenie; null = domeny nie ma w katalogu. */
  firm: { brandId: string; name: string } | null;
  /** Miasto profilu firmy (miasto pomiarów). */
  city: { name: string; slug: string } | null;
  /** Adres profilu w katalogu, gdy firma ma opublikowany profil. */
  profileUrl: string | null;
  /** Najnowsze pomiary dla miasta (po jednym na klucz pamięci podręcznej). */
  measurements: AuditMeasurement[];
};

export type AuditStatus = "ok" | "not_in_catalog" | "no_measurements";

export type RateView = { value: number; low: number; high: number; hits: number };

export type CompetitorView = {
  name: string;
  domain: string | null;
  inCatalog: boolean;
  answers: number;
  recommendedAnswers: number;
  share: number;
};

export type CitedDomainView = { domain: string; answers: number; share: number; isOwnPortal: boolean };

export type Recommendation = { text: string; href?: string };

export type PlatformUse = { platform: string; label: string; count: number };

export type AuditResult = {
  status: AuditStatus;
  domain: string;
  firmName: string | null;
  city: { name: string; slug: string } | null;
  profileUrl: string | null;
  usage: {
    count: number;
    platforms: PlatformUse[];
    /** Pytania, na które odpowiadało AI (bez powtórzeń). */
    prompts: string[];
    firstMeasuredAt: string | null;
    lastMeasuredAt: string | null;
  };
  /** Wskaźniki są null, gdy próba jest mniejsza niż MIN_SAMPLE (za mało danych). */
  enoughData: boolean;
  minSample: number;
  mentioned: boolean;
  mentionedAnswers: number;
  recommendedAnswers: number;
  citedAnswers: number;
  rates: { mention: RateView; recommendation: RateView; citation: RateView } | null;
  score: number | null;
  byPlatform: { platform: string; label: string; sample: number; mentionedAnswers: number }[];
  competitors: CompetitorView[];
  citedDomains: CitedDomainView[];
  ownPortal: { cited: boolean; answers: number; hasProfile: boolean };
  recommendations: Recommendation[];
};

const OWN = "own";

function toDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}

function keyOf(m: AuditMention): string {
  if (m.brandId) return `b:${m.brandId}`;
  if (m.domain) return `d:${m.domain.toLowerCase().replace(/^www\./, "")}`;
  return `n:${m.name.trim().toLowerCase()}`;
}

function rateView(i: Interval, hits: number): RateView {
  return { ...i, hits };
}

function isOwnPortalCitation(c: AuditCitation): boolean {
  return c.isOwnPortal || domainMatches(c.domain, OWN_PORTAL_DOMAIN);
}

/** "z 5 odpowiedzi" (dopełniacz, zawsze ta sama forma) oraz "1 odpowiedź / 3 odpowiedzi". */
const ANSWERS = "odpowiedzi";
function answersCount(n: number): string {
  if (n === 1) return "1 odpowiedź";
  return `${n} odpowiedzi`;
}

export function buildAudit(input: AuditInput): AuditResult {
  const { domain, firm, city, profileUrl, measurements } = input;
  const base = {
    domain,
    firmName: firm?.name ?? null,
    city,
    profileUrl,
    minSample: MIN_SAMPLE,
  };
  const empty = (status: AuditStatus): AuditResult => ({
    status,
    ...base,
    usage: { count: 0, platforms: [], prompts: [], firstMeasuredAt: null, lastMeasuredAt: null },
    enoughData: false,
    mentioned: false,
    mentionedAnswers: 0,
    recommendedAnswers: 0,
    citedAnswers: 0,
    rates: null,
    score: null,
    byPlatform: [],
    competitors: [],
    citedDomains: [],
    ownPortal: { cited: false, answers: 0, hasProfile: Boolean(profileUrl) },
    recommendations: [],
  });

  if (!firm) return empty("not_in_catalog");
  if (!measurements.length) return empty("no_measurements");

  const total = measurements.length;
  const isOwnMention = (m: AuditMention) => (firm.brandId && m.brandId === firm.brandId) || domainMatches(m.domain, domain);

  // Dane w kształcie, którego oczekuje measure.ts (firma = klucz "own").
  const results: MeasurementResult[] = measurements.map((m) => ({
    measurementId: m.id,
    platform: m.platform as Platform,
    measuredAt: toDate(m.measuredAt),
    mentions: m.mentions.map((x) => ({ companyKey: isOwnMention(x) ? OWN : keyOf(x), position: x.position, recommended: x.recommended })),
    citedDomains: m.citations.map((c) => c.domain),
  }));
  const v = visibility(results, OWN, [domain]);

  // Liczniki odpowiedzi (do opisów "w X z N odpowiedzi"); wskaźniki z przedziałami pochodzą z measure.ts.
  let mentionedAnswers = 0;
  let recommendedAnswers = 0;
  let citedAnswers = 0;
  let portalAnswers = 0;
  const platformCount = new Map<string, number>();
  const compMap = new Map<string, { names: Map<string, number>; domain: string | null; catalogName: string | null; answers: number; recommended: number }>();
  const citeMap = new Map<string, { answers: number; own: boolean }>();

  for (const m of measurements) {
    platformCount.set(m.platform, (platformCount.get(m.platform) ?? 0) + 1);
    const mine = m.mentions.filter(isOwnMention);
    if (mine.length) mentionedAnswers++;
    if (mine.some((x) => x.recommended)) recommendedAnswers++;
    if (m.citations.some((c) => domainMatches(c.domain, domain))) citedAnswers++;
    if (m.citations.some(isOwnPortalCitation)) portalAnswers++;

    const seen = new Set<string>();
    for (const x of m.mentions) {
      if (isOwnMention(x)) continue;
      const k = keyOf(x);
      let e = compMap.get(k);
      if (!e) {
        e = { names: new Map(), domain: null, catalogName: null, answers: 0, recommended: 0 };
        compMap.set(k, e);
      }
      e.names.set(x.name, (e.names.get(x.name) ?? 0) + 1);
      e.domain = e.domain ?? x.domain;
      e.catalogName = e.catalogName ?? x.brandName;
      if (!seen.has(k)) {
        seen.add(k);
        e.answers++;
        if (m.mentions.some((y) => !isOwnMention(y) && keyOf(y) === k && y.recommended)) e.recommended++;
      }
    }

    const seenDomains = new Set<string>();
    for (const c of m.citations) {
      const d = c.domain.toLowerCase().replace(/^www\./, "");
      if (seenDomains.has(d)) continue;
      seenDomains.add(d);
      const e = citeMap.get(d) ?? { answers: 0, own: false };
      e.answers++;
      e.own = e.own || isOwnPortalCitation(c);
      citeMap.set(d, e);
    }
  }

  const competitors: CompetitorView[] = [...compMap.entries()]
    .map(([, e]) => {
      const bestName = [...e.names.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pl"))[0][0];
      return {
        name: e.catalogName ?? bestName,
        domain: e.domain,
        inCatalog: e.catalogName !== null,
        answers: e.answers,
        recommendedAnswers: e.recommended,
        share: e.answers / total,
      };
    })
    .sort((a, b) => b.answers - a.answers || a.name.localeCompare(b.name, "pl"))
    .slice(0, 8);

  const citedDomains: CitedDomainView[] = [...citeMap.entries()]
    .filter(([d]) => !domainMatches(d, domain))
    .map(([d, e]) => ({ domain: d, answers: e.answers, share: e.answers / total, isOwnPortal: e.own }))
    .sort((a, b) => b.answers - a.answers || a.domain.localeCompare(b.domain))
    .slice(0, 8);

  const times = results.map((r) => r.measuredAt.getTime());
  const platforms: PlatformUse[] = [...platformCount.entries()]
    .map(([platform, count]) => ({ platform, label: platformLabel(platform), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pl"));

  const byPlatform = Object.entries(v.byPlatform)
    .map(([platform, p]) => ({
      platform,
      label: platformLabel(platform),
      sample: p.sample,
      mentionedAnswers: Math.round(p.mentionRate * p.sample),
    }))
    .sort((a, b) => b.sample - a.sample || a.label.localeCompare(b.label, "pl"));

  const enoughData = v.enoughData;
  const hasProfile = Boolean(profileUrl);
  const inCity = city ? `w mieście ${city.name}` : "w Twoim mieście";

  // Rekomendacje: tylko z danych powyżej, bez zgadywania. Każda zdanie ma pokrycie w liczbach na stronie.
  const recs: Recommendation[] = [];
  if (!enoughData) {
    recs.push({
      text: `Mamy tylko ${answersCount(total)} ${inCity} (potrzebujemy co najmniej ${MIN_SAMPLE}), więc za mało danych na wskaźniki procentowe. Poniżej widać same liczby z tych odpowiedzi.`,
    });
  }
  if (mentionedAnswers === 0) {
    recs.push({
      text: `Twoja firma nie pojawia się w żadnej z ${total} ${ANSWERS} AI na pytania o biura nieruchomości ${inCity}${enoughData ? "" : " (to mała próba, więc nie traktuj tego jako pewnego wyniku)"}.`,
    });
  } else {
    recs.push({
      text: `Twoja firma pojawia się w ${mentionedAnswers} z ${total} ${ANSWERS}${recommendedAnswers ? `, a w ${recommendedAnswers} jest wprost polecana` : ", ale w żadnej nie jest wprost polecana"}.`,
    });
  }
  if (competitors.length) {
    const top = competitors.slice(0, 3).map((c) => `${c.name} (${c.answers} z ${total})`);
    recs.push({ text: `AI najczęściej wymienia ${inCity}: ${top.join(", ")}. To firmy, które odbierają Ci zapytania klientów.` });
  }
  const others = citedDomains.filter((c) => !c.isOwnPortal).slice(0, 3);
  if (others.length) {
    recs.push({
      text: `AI ${inCity} najczęściej cytuje serwisy: ${others.map((c) => `${c.domain} (${c.answers} z ${total})`).join(", ")}. Sprawdź, czy Twoja firma jest w nich widoczna, zwłaszcza jeśli to rankingi lub katalogi firm.`,
    });
  }
  if (citedAnswers === 0) {
    recs.push({ text: `Twoja strona (${domain}) nie jest cytowana jako źródło w żadnej z ${total} ${ANSWERS}.` });
  } else {
    recs.push({ text: `Twoja strona (${domain}) jest cytowana jako źródło w ${citedAnswers} z ${total} ${ANSWERS}.` });
  }
  if (portalAnswers > 0) {
    recs.push({
      text: `Nasz portal ${OWN_PORTAL_DOMAIN} jest cytowany w ${portalAnswers} z ${total} ${ANSWERS}, więc profil w katalogu może wpływać na to, co AI pisze o firmach ${inCity}.`,
    });
  }
  if (hasProfile) {
    recs.push({
      text: "Masz profil w naszym katalogu: uzupełnij go (opis usług, ceny, dane kontaktowe), bo to źródło, z którego korzystają asystenci AI.",
      href: profileUrl ?? undefined,
    });
  } else {
    recs.push({ text: "Nie masz opublikowanego profilu w naszym katalogu. Dodanie profilu to najprostszy krok, żeby zwiększyć szansę na wzmiankę w odpowiedziach AI." });
  }

  return {
    status: "ok",
    ...base,
    usage: {
      count: total,
      platforms,
      prompts: [...new Set(measurements.map((m) => m.promptText))].sort((a, b) => a.localeCompare(b, "pl")),
      firstMeasuredAt: times.length ? new Date(Math.min(...times)).toISOString() : null,
      lastMeasuredAt: times.length ? new Date(Math.max(...times)).toISOString() : null,
    },
    enoughData,
    mentioned: mentionedAnswers > 0,
    mentionedAnswers,
    recommendedAnswers,
    citedAnswers,
    rates: enoughData
      ? {
          mention: rateView(v.mentionRate, mentionedAnswers),
          recommendation: rateView(v.recommendationRate, recommendedAnswers),
          citation: rateView(v.citationRate, citedAnswers),
        }
      : null,
    score: visibilityScore(v),
    byPlatform,
    competitors,
    citedDomains,
    ownPortal: { cited: portalAnswers > 0, answers: portalAnswers, hasProfile },
    recommendations: recs,
  };
}
