/**
 * Portal "Ranking biur rachunkowych" (portal nr 2). Nazwa jest roboczym wariantem, a domena nie jest jeszcze
 * wybrana: kupuje ją właściciel (packages/verticals/rachunkowe/vertical.yaml, domain: TBD). Do tego czasu adres to
 * znacznik miejsca z końcówką .invalid (nie istnieje w sieci), a wdrożenie ustawia SITE_URL.
 * Dane pochodzą z branży "rachunkowe" w bazie (listings.vertical_id): portal nie pokazuje wpisów innych branż.
 */
import { nounForm } from "../lib/noun";
import type { PortalConfig } from "../lib/portal";

export const rachunkowe: PortalConfig = {
  slug: "rachunkowe",
  siteName: "Ranking biur rachunkowych",
  brandName: "Ranking Biur Rachunkowych",
  shortName: "RBR",
  // domena: TBD (decyzja właściciela); po zakupie wpisać adres tutaj albo ustawić SITE_URL we wdrożeniu
  siteUrl: "https://tbd.invalid",
  domains: [],
  contactEmail: "kontakt@tbd.invalid",
  themeId: "rachunkowe",
  verticalSlug: "rachunkowe",
  features: {
    offers: false,
    commissionCalculator: false,
    blog: false,
    reports: false,
    awards: false,
    goals: false,
    saleCommission: false,
  },
  ranking: {
    // Wagi jak w portalu nieruchomości, bez parametru ofert (portal ich nie ma). Docelowo własne wagi z vertical.yaml.
    weights: { rejestr: 20, staz: 10, jawnosc_cennika: 15, spojnosc_danych: 10, zakres_uslug: 10, opinie_google: 10 },
  },
  catalogView: {
    goals: {},
    filters: {
      kadry: { label: "Kadry i płace", group: "payroll" },
      cennik: { label: "Jawny cennik", group: null },
    },
  },
  serviceGroups: [
    { key: "full", label: "pełna księgowość", re: /pełn\w* księgow|ksiegow\w* handlow|księgi handlowe|\bksh\b/i },
    { key: "kpir", label: "KPiR i ryczałt", re: /kpir|księga przychod|ryczałt|ewidencj/i },
    { key: "payroll", label: "kadry i płace", re: /kadr|płac|płaci|\bzus\b|wynagrodz/i },
    { key: "vat", label: "VAT, JPK i KSeF", re: /\bvat\b|ksef|\bjpk\b/i },
    { key: "tax", label: "doradztwo podatkowe", re: /doradz\w* podatk|optymalizac|podatk/i },
    { key: "company", label: "zakładanie firm", re: /zakłada|założeni|rejestracj\w* (firm|działalno|spółk)/i },
    { key: "ecommerce", label: "księgowość e-commerce", re: /e-?commerce|sklep\w* internet|marketplace|allegro|amazon/i },
  ],
  terms: {
    firm: { one: "biuro", few: "biura", many: "biur", genOne: "biura" },
    phrase: {
      one: "biuro rachunkowe",
      few: "biura rachunkowe",
      many: "biur rachunkowych",
      genOne: "biura rachunkowego",
      datOne: "biuru rachunkowemu",
      accOne: "biuro rachunkowe",
      locPl: "biurach rachunkowych",
    },
    domainGen: "księgowości",
    expert: "księgowy",
    expertFull: "obsługa księgowa",
    synonym: { few: "biura", gen: "biur" },
    fee: { nom: "abonament", nomPl: "abonamenty", genPl: "abonamentów" },
    company: { one: "firma", few: "firmy", many: "firm" },
    unit: { gender: "n", sg: { nom: "biuro", gen: "biura", dat: "biuru", acc: "biuro", ins: "biurem", loc: "biurze" }, pl: { nom: "biura", gen: "biur", dat: "biurom", acc: "biura", ins: "biurami", loc: "biurach" } },
  },
  schema: {
    firmType: "AccountingService",
    profileAnchor: "biuro",
    trackingContentType: "biuro_rachunkowe",
  },
  texts: {
    siteDescription:
      "Niezależny katalog i ranking biur rachunkowych w Polsce oparty na danych z rejestrów publicznych i stron biur.",
    layoutDescription:
      "Niezależny ranking biur rachunkowych w Polsce. Porównaj biura w swoim mieście: abonamenty, zakres usług, opinie i dane z rejestrów.",
    manifestDescription: "Niezależny ranking i katalog biur rachunkowych w Polsce.",
    llmsSummary:
      "Niezależny katalog i ranking biur rachunkowych w Polsce, podzielony na miasta. Dane z rejestrów publicznych (KRS, wykaz VAT) i oficjalnych stron biur, jawna metodologia rankingu (wynik 0-100, punkty za potwierdzenie w rejestrze, staż, cennik, spójność danych, zakres usług i opinie w Google), płatność nie wpływa na pozycję. Biura potwierdzone w rejestrze są oznaczone; biura bez potwierdzenia są w katalogu niżej w rankingu.",
    footerAbout:
      "Niezależny katalog biur rachunkowych. Dane pochodzą z rejestrów publicznych (KRS, wykaz podatników VAT) i ze stron firm. Płatność nie wpływa na pozycję w rankingu.",
    ogHeadline: "Ranking biur rachunkowych w Polsce",
    ogSubline: "Porównaj biura w swoim mieście: abonamenty, zakres usług, opinie i dane z rejestrów.",
    ogAlt: "Ranking biur rachunkowych w Polsce",
    headerCta: "Znajdź biuro",
    navForFirms: "Dla biur",
    footerForFirmsHeading: "Dla biur",
    headerNav: [
      { href: "/miasta", label: "Miasta" },
      { href: "/ranking", label: "Ranking" },
      { href: "/metodologia", label: "Jak oceniamy" },
      { href: "/dla-firm", label: "Dla biur" },
    ],
    mobileNav: [
      { href: "/miasta", label: "Miasta" },
      { href: "/ranking", label: "Ranking" },
      { href: "/metodologia", label: "Jak oceniamy" },
      { href: "/dla-firm", label: "Dla biur" },
      { href: "/kontakt", label: "Kontakt" },
    ],
    homeHeroLead:
      "Porównaj biura rachunkowe w swoim mieście według stażu, jawnych cenników i zakresu usług: księgowość, kadry i płace, rozliczenia VAT. Potem poproś wybrane biuro o wycenę jednym formularzem.",
    homeOrder: ["steps", "ranking", "cities"],
    homeStepsHeading: "Dobre biuro rachunkowe w trzech krokach",
    homeSteps: [
      {
        title: "Wybierz miasto",
        text: "Wpisz miejscowość i zobacz biura rachunkowe, które sprawdziliśmy w tej okolicy. Zastanów się, czego potrzebujesz: księgi przychodów i rozchodów, ryczałt, pełna księgowość, kadry i płace.",
      },
      {
        title: "Porównaj biura",
        text: "Ranking pokazuje staż w rejestrze, jawność cennika, zakres usług i opinie z Map Google. Sprawdź, czy biuro podaje abonament i co on obejmuje.",
      },
      {
        title: "Poproś o wycenę",
        text: "Opisz firmę w formularzu na stronie biura. Przekażemy wiadomość bezpłatnie i bez zobowiązań, a umowę i zakres obsługi ustalisz bezpośrednio z biurem.",
      },
    ],
    homeFaq: [
      {
        q: "Skąd pochodzą dane o biurach?",
        a: "Z rejestrów publicznych (KRS, wykaz podatników VAT) i z oficjalnych stron internetowych biur. Biura potwierdzone w rejestrze mają to oznaczone na profilu; biura bez potwierdzenia też są w katalogu, ale niżej w rankingu.",
      },
      {
        q: "Czy biura płacą za miejsce w rankingu?",
        a: "Nie. Pozycja wynika wyłącznie z jawnej metodologii. Płatność nie ma wpływu na wynik ani na kolejność.",
      },
      {
        q: "Jak często dane są aktualizowane?",
        a: "Kontakt i obrazki sprawdzamy codziennie. Dane z rejestrów i opisy odświeżamy regularnie, a każda strona biura ma datę aktualizacji.",
      },
      {
        q: "Moje biuro ma błędne dane. Co zrobić?",
        a: "Wypełnij formularz na stronie Dla biur. Poprawimy dane albo usuniemy wpis.",
      },
    ],
    homeWhyDaily: "Dane kontaktowe i strony biur sprawdzamy regularnie.",
    contractName: "umowa o świadczenie usług księgowych",
    leadCta: "Poproś o wycenę",
    notPartyShort:
      "Nie jesteśmy biurem rachunkowym ani doradcą podatkowym i nie jesteśmy stroną umów, które zawierasz z biurami.",
    notPartyLong:
      "Operator nie świadczy usług księgowych ani doradztwa podatkowego i nie jest stroną umów zawieranych między Użytkownikami a Biurami.",
    siteDataList: "dane kontaktowe, zakres usług, cennik",
    serviceExamples: "księgowość, kadry i płace, rozliczenia VAT, doradztwo podatkowe i inne",
    priceSectionHeading: "Abonamenty i ceny usług",
    forFirmsDataList: "ceny",
    firmNoRates: (name) =>
      `${name} nie publikuje cen na swojej stronie, więc wysokość abonamentu trzeba ustalić bezpośrednio z biurem.`,
    lead: {
      topics: {
        kupno: "Szukam biura dla nowej firmy",
        sprzedaz: "Chcę zmienić biuro rachunkowe",
        wynajem: "Potrzebuję kadr i płac",
        najem: "Potrzebuję księgowości dla sklepu internetowego",
        wycena: "Wycena obsługi księgowej",
        inne: "Inna sprawa",
      },
      message: (topic, where) => {
        switch (topic) {
          case "kupno":
            return `Dzień dobry, zakładam firmę ${where} i szukam biura rachunkowego. Proszę o kontakt i wycenę obsługi.`;
          case "sprzedaz":
            return `Dzień dobry, chcę zmienić biuro rachunkowe ${where}. Proszę o kontakt i przedstawienie oferty współpracy.`;
          case "wynajem":
            return `Dzień dobry, potrzebuję obsługi kadr i płac ${where}. Proszę o kontakt i wycenę.`;
          case "najem":
            return `Dzień dobry, prowadzę sklep internetowy i szukam księgowości ${where}. Proszę o kontakt i wycenę.`;
          case "wycena":
            return `Dzień dobry, proszę o wycenę obsługi księgowej ${where} i kontakt w tej sprawie.`;
          case "inne":
            return "Dzień dobry, proszę o kontakt w sprawie usług biura.";
          default:
            return "Dzień dobry, proszę o informacje o usługach i cenniku biura oraz o kontakt.";
        }
      },
    },
    city: {
      guide: (c) => [
        `Zacznij od zakresu usług. Biuro, które świetnie prowadzi księgi małej jednoosobowej firmy, niekoniecznie obsłuży spółkę z pracownikami albo sklep internetowy.${
          c.groups.length > 0
            ? ` Wśród biur ${c.where} z naszego katalogu najczęściej deklarowane są: ${c.groups.map((g) => `${g.label} (${c.units(g.count)})`).join(", ")}.`
            : ""
        }`,
        `Zapytaj o abonament i o to, co obejmuje: liczbę dokumentów, kadry i płace, rozliczenia VAT, kontakt z urzędami, doradztwo. ${
          c.withPrices > 0
            ? `Cennik publikuje ${c.withPrices} z ${c.unitsGen(c.n)}, u pozostałych cenę poznasz dopiero w rozmowie.`
            : "Biura w tym mieście nie publikują cenników, więc poproś o wycenę na piśmie przed podpisaniem umowy."
        } Sprawdź, czy kwota jest netto, brutto czy powiększona o VAT, i co dzieje się po przekroczeniu limitu dokumentów.`,
        `Przeczytaj umowę przed podpisaniem: zakres obowiązków, termin przekazywania dokumentów, okres wypowiedzenia i odpowiedzialność biura. Dopytaj o ubezpieczenie OC, bo biuro rachunkowe prowadzące cudze księgi powinno je mieć.`,
        `Zwróć uwagę na doświadczenie w Twojej branży i sposób kontaktu. Biuro, które zna rozliczenia Twojego typu działalności (np. sklep internetowy, usługi, budowlanka), szybciej wychwyci błędy. Ustal, kto jest Twoją osobą kontaktową i jak szybko odpowiada.`,
        `Na koniec sprawdź firmę w rejestrze. ${
          c.confirmed === c.n
            ? `Wszystkie biura z tej listy potwierdziliśmy numerem NIP w rejestrach publicznych.`
            : `${c.confirmed} z ${c.unitsGen(c.n)} ${c.where} potwierdziliśmy numerem NIP w rejestrach; przy pozostałych poproś o NIP i sprawdź go w wykazie podatników VAT.`
        }`,
      ],
      noPrices: (c) =>
        `Żadne z biur rachunkowych ${c.where} w naszym katalogu (${c.units(c.n)}) nie publikuje na swojej stronie cen usług, więc wysokość abonamentu trzeba ustalić bezpośrednio z biurem.`,
      somePrices: (c, share, natShare) =>
        `${c.withPrices} z ${c.unitsGen(c.n)} ${c.where} (${share}%${natShare != null ? `, w całym katalogu ${natShare}%` : ""}) ${nounForm(c.withPrices, { one: "publikuje", few: "publikują", many: "publikuje" })} na swojej stronie ceny usług, które da się porównać.`,
      priceNote: (latest) =>
        latest
          ? `Ceny są deklarowane przez biura na ich stronach i sprawdzone ${latest}. Mogły się zmienić, a ostateczną cenę określa umowa o świadczenie usług księgowych.`
          : "Ostateczną cenę zawsze określa umowa o świadczenie usług księgowych.",
      priceHeading: (where) => `Ile kosztuje biuro rachunkowe ${where}?`,
      faq: {
        feeQuestion: (where) => `Ile kosztuje obsługa księgowa ${where}?`,
        feeNoPrices: (where) =>
          `Biura ${where} w naszym katalogu nie publikują cen usług, więc koszt trzeba ustalić z wybranym biurem. Poproś o wycenę na piśmie i sprawdź, czy zawiera VAT oraz limit dokumentów.`,
        trustQuestion: "Jak sprawdzić wiarygodność biura rachunkowego?",
        trustAnswer: (c) =>
          `Poproś o NIP i sprawdź go w wykazie podatników VAT lub w KRS, przeczytaj umowę i zapytaj o ubezpieczenie OC. W naszym katalogu ${
            c.confirmed === c.n ? "wszystkie biura z tego miasta mają" : `${c.confirmed} z ${c.unitsGen(c.n)} ${c.where} ma`
          } potwierdzenie w rejestrze, oznaczone na profilu.`,
        factorsQuestion: "Od czego zależy abonament biura rachunkowego?",
        factorsAnswer:
          "Najczęściej od formy prowadzenia księgowości (książka przychodów i rozchodów, ryczałt, pełna księgowość), liczby dokumentów w miesiącu, liczby pracowników, tego, czy firma jest płatnikiem VAT, i od zakresu usług, np. kadry i płace albo doradztwo. Cena bywa podawana netto, brutto albo z doliczanym VAT.",
      },
    },
    llmsReports: [],
    footerCatalogLinks: [
      { href: "/ranking", label: "Najlepsze biura w Polsce" },
      { href: "/miasta", label: "Wszystkie miasta" },
      { href: "/metodologia", label: "Jak powstaje ranking" },
    ],
  },
};
