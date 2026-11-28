/**
 * Wspólna część konfiguracji portali branż usługowych (portale nr 3-8 z docs/ops/DECISIONS.md: odnawialne źródła energii
 * i klimatyzacja, remonty, budowa domów, warsztaty, przeprowadzki, weterynaria). Portal biur nieruchomości i biur
 * rachunkowych mają własne, ręcznie napisane pliki.
 *
 * Fabryka składa z danych portalu (nazwy, odmiana, teksty branżowe) cały `PortalConfig`: menu, stopkę, opisy serwisu,
 * zdania o cenach i pytania FAQ. Teksty zależne od branży (poradnik wyboru, zdania w formularzu, pytania o wiarygodność)
 * podaje plik portalu, bo każdą trzeba napisać osobno i z poprawną odmianą. Wszystkie funkcje serwisu opcjonalne są tu
 * wyłączone (oferty, blog, raporty, wyróżnienia, cele klienta, prowizje): żaden z tych portali ich nie ma.
 */
import { nounForm } from "../lib/noun";
import type {
  CityCtx,
  PortalCatalogView,
  PortalConfig,
  PortalLeadTexts,
  PortalServiceGroup,
  PortalTerms,
} from "../lib/portal";

type LeadTopic = "kupno" | "sprzedaz" | "wynajem" | "najem" | "wycena" | "inne";

/** Zdania poradnika miasta zależne od danych katalogu, wspólne dla portali (odmiana z konfiguracji portalu). */
export type GuideHelpers = {
  /** " Wśród firm we Wrocławiu z naszego katalogu najczęściej deklarowane są: ..." albo pusty napis. */
  groups: string;
  /** Zdanie o tym, ile firm publikuje cennik. */
  prices: string;
  /** Zdanie o potwierdzeniu firm w rejestrze (po zdaniu wstępnym z pliku portalu). */
  registry: string;
};

export type ServicePortalSpec = {
  slug: string;
  /** Nazwa robocza marki (logo, tytuły). Domena: TBD, wybór nazwy i domeny należy do właściciela. */
  brand: string;
  /** Opis rodzaju serwisu dopisywany do marki w nazwie pełnej: "Marka - firmy remontowe". */
  descriptor: string;
  shortName: string;
  schemaType: string;
  profileAnchor: string;
  trackingContentType: string;
  catalogView: PortalCatalogView;
  serviceGroups: PortalServiceGroup[];
  terms: PortalTerms;
  /** Przycisk w nagłówku (biernik: "Znajdź warsztat", "Znajdź klinikę"). */
  headerCta: string;
  /** Odnośnik "dla firm" w menu i stopce (np. "Dla warsztatów"). */
  forFirms: string;
  /** Zaimek przeczący z formą rodzajową: "Żadna z", "Żaden z", "Żadne z". */
  none: string;
  homeHeroLead: string;
  /** Pytanie ceny w nagłówkach i FAQ: "Ile kosztuje ${priceThing} we Wrocławiu?" */
  priceThing: string;
  /** Zakończenie zdania "nie publikuje cen ..., więc ...". */
  noRatesTail: string;
  contractName: string;
  leadCta: string;
  /** Zdania o roli serwisu (regulamin). */
  notPartyShort: string;
  notPartyLong: string;
  serviceExamples: string;
  priceSectionHeading: string;
  leadTopics: Record<LeadTopic, string>;
  leadMessage: (topic: LeadTopic | "", where: string) => string;
  guide: (c: CityCtx, h: GuideHelpers) => string[];
  trust: { question: string; answer: (c: CityCtx) => string };
  factors: { question: string; answer: string };
  feeNoPrices: (where: string) => string;
};

export function servicePortal(spec: ServicePortalSpec): PortalConfig {
  const t = spec.terms;
  const many = t.phrase.many;
  const few = t.phrase.few;
  const helpers = (c: CityCtx): GuideHelpers => ({
    groups:
      c.groups.length > 0
        ? ` Wśród ${t.firm.many} ${c.where} z naszego katalogu najczęściej deklarowane są: ${c.groups.map((g) => `${g.label} (${c.units(g.count)})`).join(", ")}.`
        : "",
    prices:
      c.withPrices > 0
        ? `Cennik publikuje ${c.withPrices} z ${c.unitsGen(c.n)}, u pozostałych cenę poznasz dopiero w rozmowie.`
        : `${spec.none} ${many} ${c.where} w naszym katalogu nie publikuje cennika, więc poproś o wycenę na piśmie przed podpisaniem umowy.`,
    registry:
      c.confirmed === c.n
        ? `Wszystkie ${few} z tej listy potwierdziliśmy numerem NIP w rejestrach publicznych.`
        : `${c.confirmed} z ${c.unitsGen(c.n)} ${c.where} potwierdziliśmy numerem NIP w rejestrach; przy pozostałych poproś o NIP i sprawdź go w wykazie podatników VAT.`,
  });
  const lead: PortalLeadTexts = { topics: spec.leadTopics, message: spec.leadMessage };
  return {
    slug: spec.slug,
    siteName: `${spec.brand} - ${spec.descriptor}`,
    brandName: spec.brand,
    shortName: spec.shortName,
    // domena: TBD (decyzja właściciela); znacznik z końcówką .invalid nie istnieje w sieci, wdrożenie ustawia SITE_URL
    siteUrl: "https://tbd.invalid",
    domains: [],
    contactEmail: "kontakt@tbd.invalid",
    themeId: spec.slug,
    verticalSlug: spec.slug,
    features: {
      offers: false,
      commissionCalculator: false,
      blog: false,
      reports: false,
      awards: false,
      goals: false,
      saleCommission: false,
    },
    catalogView: spec.catalogView,
    serviceGroups: spec.serviceGroups,
    terms: spec.terms,
    schema: {
      firmType: spec.schemaType,
      profileAnchor: spec.profileAnchor,
      trackingContentType: spec.trackingContentType,
    },
    texts: {
      siteDescription: `Niezależny katalog i ranking ${many} w Polsce oparty na danych z rejestrów publicznych i stron firm.`,
      layoutDescription: `Niezależny ranking ${many} w Polsce. Porównaj ${few} w swoim mieście: ${t.fee.nomPl}, zakres usług, opinie i dane z rejestrów.`,
      manifestDescription: `Niezależny ranking i katalog ${many} w Polsce.`,
      llmsSummary: `Niezależny katalog i ranking ${many} w Polsce, podzielony na miasta. Dane z rejestrów publicznych (KRS, wykaz VAT) i oficjalnych stron firm, jawna metodologia rankingu (wynik 0-100, punkty za potwierdzenie w rejestrze, staż, cennik, spójność danych, zakres usług i opinie w Google), płatność nie wpływa na pozycję. Firmy potwierdzone w rejestrze są oznaczone; firmy bez potwierdzenia są w katalogu niżej w rankingu.`,
      footerAbout: `Niezależny katalog ${many}. Dane pochodzą z rejestrów publicznych (KRS, wykaz podatników VAT) i ze stron firm. Płatność nie wpływa na pozycję w rankingu.`,
      ogHeadline: `Ranking ${many} w Polsce`,
      ogSubline: `Porównaj ${few} w swoim mieście: ${t.fee.nomPl}, zakres usług, opinie i dane z rejestrów.`,
      ogAlt: `Ranking ${many} w Polsce`,
      headerCta: spec.headerCta,
      navForFirms: spec.forFirms,
      footerForFirmsHeading: spec.forFirms,
      headerNav: [
        { href: "/miasta", label: "Miasta" },
        { href: "/ranking", label: "Ranking" },
        { href: "/metodologia", label: "Jak oceniamy" },
        { href: "/dla-firm", label: spec.forFirms },
      ],
      mobileNav: [
        { href: "/miasta", label: "Miasta" },
        { href: "/ranking", label: "Ranking" },
        { href: "/metodologia", label: "Jak oceniamy" },
        { href: "/dla-firm", label: spec.forFirms },
        { href: "/kontakt", label: "Kontakt" },
      ],
      homeHeroLead: spec.homeHeroLead,
      homeSteps: [
        {
          title: "Wybierz miasto",
          text: `Wpisz miejscowość i zobacz ${few}, które sprawdziliśmy w tej okolicy.`,
        },
        {
          title: `Porównaj ${t.synonym.few}`,
          text: "Ranking pokazuje staż w rejestrze, jawność cennika, zakres usług i opinie z Map Google.",
        },
        {
          title: spec.leadCta,
          text: `Napisz przez formularz na stronie ${t.firm.genOne}. Przekażemy wiadomość bezpłatnie i bez zobowiązań.`,
        },
      ],
      homeWhyDaily: `Dane kontaktowe i strony ${t.firm.many} sprawdzamy regularnie.`,
      contractName: spec.contractName,
      leadCta: spec.leadCta,
      notPartyShort: spec.notPartyShort,
      notPartyLong: spec.notPartyLong,
      siteDataList: "dane kontaktowe, zakres usług, cennik",
      serviceExamples: spec.serviceExamples,
      priceSectionHeading: spec.priceSectionHeading,
      forFirmsDataList: "ceny",
      firmNoRates: (name) => `${name} nie publikuje cen na swojej stronie, więc ${spec.noRatesTail}`,
      lead,
      city: {
        guide: (c) => spec.guide(c, helpers(c)),
        noPrices: (c) =>
          `${spec.none} ${many} ${c.where} w naszym katalogu (${c.units(c.n)}) nie publikuje na swojej stronie cen usług, więc ${spec.noRatesTail}`,
        somePrices: (c, share, natShare) =>
          `${c.withPrices} z ${c.unitsGen(c.n)} ${c.where} (${share}%${natShare != null ? `, w całym katalogu ${natShare}%` : ""}) ${nounForm(c.withPrices, { one: "publikuje", few: "publikują", many: "publikuje" })} na swojej stronie ceny usług, które da się porównać.`,
        priceNote: (latest) =>
          latest
            ? `Ceny są deklarowane przez firmy na ich stronach i sprawdzone ${latest}. Mogły się zmienić, a ostateczną cenę określa ${spec.contractName}.`
            : `Ostateczną cenę zawsze określa ${spec.contractName}.`,
        priceHeading: (where) => `Ile kosztuje ${spec.priceThing} ${where}?`,
        faq: {
          feeQuestion: (where) => `Ile kosztuje ${spec.priceThing} ${where}?`,
          feeNoPrices: spec.feeNoPrices,
          trustQuestion: spec.trust.question,
          trustAnswer: spec.trust.answer,
          factorsQuestion: spec.factors.question,
          factorsAnswer: spec.factors.answer,
        },
      },
      llmsReports: [],
      footerCatalogLinks: [
        { href: "/ranking", label: `Najlepsze ${few} w Polsce` },
        { href: "/miasta", label: "Wszystkie miasta" },
        { href: "/metodologia", label: "Jak powstaje ranking" },
      ],
    },
  };
}
