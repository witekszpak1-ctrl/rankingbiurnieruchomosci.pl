/**
 * Liczby z jednego przebiegu kroku automatu (pipeline_runs.counts) w trzech grupach do tabeli w panelu:
 * co zrobiono lub znaleziono, czego nie znaleziono lub co pominięto, i błędy. Nieznane klucze trafiają do "inne",
 * żeby żadna liczba z przebiegu nie zginęła.
 */

export type StatItem = { label: string; n: number };
export type RunStats = { done: StatItem[]; missed: StatItem[]; errors: StatItem[]; other: StatItem[]; calls: number | null };

type Kind = "done" | "missed" | "errors" | "skip";

/** Klucz -> [opis, grupa]. Wspólne dla wszystkich kroków, bo nazwy kluczy się nie powtarzają z innym znaczeniem. */
const KEYS: Record<string, [string, Kind]> = {
  // szukanie
  cities: ["miast przeszukanych", "done"],
  queries: ["wyszukiwań", "done"],
  candidates: ["adresów z wyników", "done"],
  new_domains: ["nowych stron www", "done"],
  blocked_results: ["portali i katalogów pominiętych", "missed"],
  search_errors: ["błędów wyszukiwarki", "errors"],
  query_errors: ["wyszukiwań nieudanych (pominięte)", "errors"],
  stopped_limit: ["zatrzymań na limicie", "errors"],
  // otwieranie stron (probe)
  agency: ["stron biur nieruchomości", "done"],
  developer: ["deweloperów (odrzuconych)", "missed"],
  portal: ["portali (odrzuconych)", "missed"],
  other_industry: ["firm z innej branży", "missed"],
  unknown: ["stron niejasnych", "missed"],
  inactive: ["stron nieaktywnych", "missed"],
  robots_disallowed: ["stron z zakazem w robots.txt", "missed"],
  robots_unreachable: ["stron z niedostępnym robots.txt", "errors"],
  fetch_error: ["stron, które się nie otworzyły", "errors"],
  // rejestry (verify, reverify)
  verified: ["firm potwierdzonych w KRS lub VAT", "done"],
  confirmed_verified: ["firm potwierdzonych ponownie", "done"],
  needs_review: ["firm do sprawdzenia ręcznie", "missed"],
  confirmed_needs_review: ["firm nadal do sprawdzenia", "missed"],
  rejected: ["odrzuconych", "missed"],
  confirmed_rejected: ["odrzuconych przy ponownym sprawdzeniu", "missed"],
  no_nip: ["stron bez NIP", "missed"],
  nip_not_in_vat_list: ["NIP spoza wykazu VAT", "missed"],
  rejected_by_registry: ["firm odrzuconych przez rejestr", "missed"],
  bad_name: ["stron bez nazwy firmy", "missed"],
  city_unconfirmed: ["firm bez potwierdzonego miasta", "missed"],
  brand_name_taken: ["nazw już zajętych", "missed"],
  no_snapshots: ["stron bez zrzutu (ponowią się)", "missed"],
  requeued_no_snapshots: ["stron odesłanych do ponownego pobrania", "missed"],
  mf_requests: ["zapytań do wykazu VAT", "skip"],
  // podstrony, paczki, import, publikacja
  domains: ["stron sprawdzonych", "done"],
  pages: ["podstron pobranych", "done"],
  refetched_home: ["stron głównych pobranych ponownie", "done"],
  describe: ["paczek do opisów", "done"],
  describe_new: ["nowych paczek dla Claude", "done"],
  classify: ["paczek do klasyfikacji", "done"],
  no_pages: ["firm bez stron do opisu", "missed"],
  blocked_contacts: ["paczek wstrzymanych (dane kontaktowe)", "errors"],
  claude_sessions: ["raportów sesji Claude", "done"],
  published: ["firm dodanych do katalogu", "done"],
  waiting: ["firm czekających na publikację", "missed"],
  // oferty
  with_offers: ["stron z ofertami", "done"],
  offers_new: ["nowych ofert", "done"],
  offers_updated: ["ofert zaktualizowanych", "done"],
  offers_deactivated: ["ofert wycofanych", "done"],
  without_offers: ["stron bez ofert", "missed"],
  // kontakty i zdjęcia
  with_phones: ["firm z telefonem", "done"],
  with_emails: ["firm z e-mailem", "done"],
  with_socials: ["firm z social media", "done"],
  with_logo: ["firm z logo", "done"],
  with_cover: ["firm ze zdjęciem", "done"],
  with_image: ["firm z obrazkiem", "skip"],
  home_failed: ["stron, które się nie otworzyły", "errors"],
  // opinie z Map Google
  firms: ["firm sprawdzonych", "skip"],
  ok: ["firm z oceną z Map Google", "done"],
  reviews: ["opinii pobranych", "done"],
  not_found: ["firm bez profilu w Mapach", "missed"],
  error: ["błędów pobierania opinii", "errors"],
  stopped_litescrape: ["firm przerwanych (LiteScrape niedostępny)", "errors"],
  skipped_unavailable: ["firm pominiętych (LiteScrape niedostępny)", "errors"],
  // sesja Claude
  described: ["opisów napisanych", "done"],
  skipped: ["paczek pominiętych", "missed"],
  cities_searched: ["miast przeszukanych przez Claude", "done"],
  litescrape_calls: ["zapytań LiteScrape", "skip"],
  run_budget: ["budżet przebiegu", "skip"],
  month_used: ["zużycie w miesiącu", "skip"],
  month_limit: ["limit miesięczny", "skip"],
};

const PREFIXES: [RegExp, (m: RegExpMatchArray) => [string, Kind]][] = [
  [/^skipped_(.+)$/, (m) => [`podstron pominiętych (${m[1].replace(/_/g, " ")})`, "missed"]],
  [/^refetch_failed_(.+)$/, (m) => [`stron niepobranych ponownie (${m[1].replace(/_/g, " ")})`, "errors"]],
];

export function runStats(counts: Record<string, unknown> | null | undefined): RunStats {
  const out: RunStats = { done: [], missed: [], errors: [], other: [], calls: null };
  for (const [key, raw] of Object.entries(counts ?? {})) {
    if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
    if (key === "litescrape_calls") out.calls = raw;
    if (raw === 0) continue;
    let entry = KEYS[key];
    if (!entry) {
      for (const [re, make] of PREFIXES) {
        const m = key.match(re);
        if (m) entry = make(m);
      }
    }
    if (!entry) {
      out.other.push({ label: key.replace(/_/g, " "), n: raw });
      continue;
    }
    const [label, kind] = entry;
    if (kind !== "skip") out[kind].push({ label, n: raw });
  }
  for (const list of [out.done, out.missed, out.errors, out.other]) list.sort((a, b) => b.n - a.n);
  return out;
}

export const sumOf = (items: StatItem[]) => items.reduce((s, x) => s + x.n, 0);
