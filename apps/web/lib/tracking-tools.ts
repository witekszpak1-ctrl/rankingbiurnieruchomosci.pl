/**
 * Narzędzia analityczne i reklamowe, które administrator może włączyć w panelu (zakładka „Analityka i piksele”).
 * Te same definicje opisują narzędzia w banerze zgody i w polityce prywatności, więc dokumenty zawsze odpowiadają
 * temu, co faktycznie działa na stronie. Moduł bez zależności serwerowych (używa go też kod przeglądarki).
 */

export type Category = "statistics" | "marketing";

export type ToolKey = "ga4" | "gtm" | "googleAds" | "metaPixel" | "clarity" | "hotjar" | "tiktok" | "linkedin";

export type ToolDef = {
  key: ToolKey;
  label: string;
  /** Kategoria zgody; GTM wczytuje się przy zgodzie na którąkolwiek kategorię i dostaje sygnały Consent Mode. */
  category: Category | "any";
  placeholder: string;
  pattern: RegExp;
  help: string;
  provider: string;
  purpose: string;
  cookies: string;
  transfer: string;
};

export const TOOLS: ToolDef[] = [
  {
    key: "ga4",
    label: "Google Analytics 4: identyfikator pomiaru",
    category: "statistics",
    placeholder: "G-XXXXXXXXXX",
    pattern: /^G-[A-Z0-9]{4,15}$/,
    help: "Google Analytics > Administracja > Strumienie danych > Identyfikator pomiaru.",
    provider: "Google Analytics 4 (Google Ireland Ltd., Google LLC)",
    purpose: "statystyki odwiedzin i zachowania na stronie",
    cookies: "_ga, _ga_<identyfikator> (do 2 lat)",
    transfer: "UE i USA (Data Privacy Framework)",
  },
  {
    key: "gtm",
    label: "Google Tag Manager: identyfikator kontenera",
    category: "any",
    placeholder: "GTM-XXXXXXX",
    pattern: /^GTM-[A-Z0-9]{4,10}$/,
    help: "Tagi w kontenerze dostają stan zgody przez Google Consent Mode (analytics_storage, ad_storage).",
    provider: "Google Tag Manager (Google Ireland Ltd., Google LLC)",
    purpose: "wczytywanie narzędzi analitycznych i reklamowych zgodnie z Twoją zgodą",
    cookies: "sam nie zapisuje plików cookie, robią to wczytywane narzędzia",
    transfer: "UE i USA (Data Privacy Framework)",
  },
  {
    key: "googleAds",
    label: "Google Ads: identyfikator konwersji",
    category: "marketing",
    placeholder: "AW-123456789",
    pattern: /^AW-\d{6,15}$/,
    help: "Google Ads > Narzędzia > Konwersje > Tag Google (identyfikator zaczyna się od AW-).",
    provider: "Google Ads (Google Ireland Ltd., Google LLC)",
    purpose: "mierzenie skuteczności reklam i remarketing",
    cookies: "_gcl_au (90 dni) i pliki cookie Google Ads",
    transfer: "UE i USA (Data Privacy Framework)",
  },
  {
    key: "metaPixel",
    label: "Piksel Meta (Facebook, Instagram): identyfikator",
    category: "marketing",
    placeholder: "123456789012345",
    pattern: /^\d{10,20}$/,
    help: "Meta Business Suite > Menedżer zdarzeń > Źródła danych > identyfikator piksela (same cyfry).",
    provider: "Piksel Meta (Meta Platforms Ireland Ltd.)",
    purpose: "mierzenie skuteczności reklam na Facebooku i Instagramie oraz remarketing",
    cookies: "_fbp (90 dni)",
    transfer: "UE i USA (Data Privacy Framework)",
  },
  {
    key: "clarity",
    label: "Microsoft Clarity: identyfikator projektu",
    category: "statistics",
    placeholder: "abcd1234ef",
    pattern: /^[a-z0-9]{6,20}$/,
    help: "Clarity > Ustawienia > Konfiguracja > identyfikator projektu.",
    provider: "Microsoft Clarity (Microsoft Ireland Operations Ltd.)",
    purpose: "mapy kliknięć i nagrania sesji (bez treści wpisywanych w formularze)",
    cookies: "_clck (1 rok), _clsk (1 dzień)",
    transfer: "UE i USA (Data Privacy Framework)",
  },
  {
    key: "hotjar",
    label: "Hotjar: identyfikator witryny",
    category: "statistics",
    placeholder: "1234567",
    pattern: /^\d{5,10}$/,
    help: "Hotjar > Ustawienia witryny > Site ID.",
    provider: "Hotjar (Hotjar Ltd., Malta)",
    purpose: "mapy kliknięć, nagrania sesji i ankiety",
    cookies: "_hjSessionUser_<id> (1 rok), _hjSession_<id> (30 minut)",
    transfer: "UE",
  },
  {
    key: "tiktok",
    label: "Piksel TikTok: identyfikator",
    category: "marketing",
    placeholder: "CXXXXXXXXXXXXXXXXXXX",
    pattern: /^[A-Z0-9]{15,25}$/,
    help: "TikTok Ads Manager > Zasoby > Zdarzenia > identyfikator piksela.",
    provider: "Piksel TikTok (TikTok Technology Ltd., Irlandia)",
    purpose: "mierzenie skuteczności reklam na TikToku i remarketing",
    cookies: "_ttp (13 miesięcy)",
    transfer: "UE, USA i inne kraje (standardowe klauzule umowne)",
  },
  {
    key: "linkedin",
    label: "LinkedIn Insight Tag: identyfikator partnera",
    category: "marketing",
    placeholder: "1234567",
    pattern: /^\d{4,12}$/,
    help: "LinkedIn Campaign Manager > Dane analityczne > Insight Tag > Partner ID.",
    provider: "LinkedIn Insight Tag (LinkedIn Ireland Unlimited Company)",
    purpose: "mierzenie skuteczności reklam na LinkedInie",
    cookies: "li_fat_id (30 dni), li_sugr (90 dni)",
    transfer: "UE i USA (Data Privacy Framework)",
  },
];

/** Wbudowane statystyki WitekCRM (zawsze dostępne, kategoria statystyczna). */
export const WITEKCRM = {
  site: "ws_65be8380404a2bd8",
  src: "https://witekcrm.com/api/public/pulse/s.js",
  provider: "Statystyki stron WitekCRM (witekcrm.com)",
  purpose: "liczenie odsłon, źródeł wejść i czasu na stronie",
  cookies: "nie zapisuje plików cookie",
};

export type CustomCode = { code: string; description: string };

/** Konfiguracja wysyłana do przeglądarki (tylko włączone narzędzia). */
export type PublicTracking = {
  version: string;
  ids: Partial<Record<ToolKey, string>>;
  /** Serwer wysyła zdarzenia piksela Meta także przez Conversions API (token tylko na serwerze). */
  metaCapi?: boolean;
  customStatistics: CustomCode | null;
  customMarketing: CustomCode | null;
};

export function toolsIn(config: PublicTracking, category: Category): string[] {
  const names = TOOLS.filter((t) => config.ids[t.key] && (t.category === category || t.category === "any")).map((t) =>
    t.provider.replace(/ \(.*$/, ""),
  );
  if (category === "statistics") names.unshift("WitekCRM");
  const custom = category === "statistics" ? config.customStatistics : config.customMarketing;
  if (custom) names.push(custom.description || "własny kod");
  return names;
}
