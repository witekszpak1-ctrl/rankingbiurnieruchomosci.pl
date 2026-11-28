/**
 * Portal "Ranking biur nieruchomości": wartości skopiowane 1:1 z dotychczasowego kodu strony (stan sprzed silnika
 * wielu branż), więc strona renderuje się tak samo jak przed wprowadzeniem konfiguracji.
 */
import { nounForm } from "../lib/noun";
import type { PortalConfig } from "../lib/portal";

export const nieruchomosci: PortalConfig = {
  slug: "nieruchomosci",
  siteName: "Ranking biur nieruchomości",
  brandName: "Ranking Biur Nieruchomości",
  shortName: "RBN",
  siteUrl: "https://rankingbiurnieruchomosci.pl",
  domains: ["rankingbiurnieruchomosci.pl"],
  contactEmail: "info@rankingbiurnieruchomosci.pl",
  themeId: "nieruchomosci",
  verticalSlug: "nieruchomosci",
  features: {
    offers: true,
    commissionCalculator: true,
    blog: true,
    reports: true,
    awards: true,
    goals: true,
    saleCommission: true,
  },
  ranking: {
    // Wagi jak dotąd (metodologia 1.1, /metodologia): suma 90, udział w punktach liczy weightShare.
    weights: { rejestr: 20, staz: 10, jawnosc_cennika: 15, spojnosc_danych: 10, zakres_uslug: 10, opinie_google: 10, aktualne_oferty: 15 },
  },
  catalogView: {
    // Cel klienta filtruje biura po deklarowanych usługach (grupy z serviceGroups).
    goals: {
      sprzedaz: { label: "Chcę sprzedać", group: "sale" },
      kupno: { label: "Chcę kupić", group: "sale" },
      wynajem: { label: "Chcę wynająć", group: "rent" },
    },
    filters: {
      zarzadzanie: { label: "Zarządzanie najmem", group: "management" },
      cennik: { label: "Jawny cennik", group: null },
    },
  },
  serviceGroups: [
    { key: "sale", label: "sprzedaż nieruchomości", re: /sprzeda|zbyci/i },
    { key: "rent", label: "wynajem", re: /wynaj|najem(?!.*zarz)/i },
    { key: "management", label: "zarządzanie najmem", re: /zarządza|zarzadza|administrow/i },
    { key: "primary", label: "rynek pierwotny", re: /pierwotn|deweloper|nowe (inwestycje|mieszkania|budownictwo)/i },
    { key: "commercial", label: "nieruchomości komercyjne", re: /komercyj|lokal(e|i) użytkow|biur(a|o) do wynaj|magazyn/i },
    { key: "credit", label: "pomoc w kredycie", re: /kredyt|finansowa/i },
    { key: "valuation", label: "wycena nieruchomości", re: /wycen/i },
  ],
  terms: {
    firm: { one: "biuro", few: "biura", many: "biur", genOne: "biura" },
    phrase: { one: "biuro nieruchomości", few: "biura nieruchomości", many: "biur nieruchomości", genOne: "biura nieruchomości", datOne: "biuru nieruchomości", locPl: "biurach nieruchomości" },
    domainGen: "nieruchomości",
    expert: "pośrednik",
    expertFull: "pośrednik nieruchomości",
    synonym: { few: "agencje", gen: "agencji" },
    fee: { nom: "prowizja", nomPl: "prowizje", genPl: "prowizji" },
    company: { one: "firma", few: "firmy", many: "firm" },
  },
  schema: {
    firmType: "RealEstateAgent",
    profileAnchor: "biuro",
    trackingContentType: "biuro_nieruchomosci",
  },
  texts: {
    siteDescription:
      "Niezależny katalog i ranking biur nieruchomości w Polsce oparty na danych z rejestrów publicznych i stron biur.",
    layoutDescription:
      "Niezależny ranking biur nieruchomości w Polsce. Porównaj agencje w swoim mieście: prowizje, zakres usług, oferty i dane z rejestrów.",
    manifestDescription: "Niezależny ranking i katalog biur nieruchomości w Polsce.",
    llmsSummary:
      "Niezależny katalog i ranking biur nieruchomości w Polsce, podzielony na miasta. Dane z rejestrów publicznych (KRS, wykaz VAT) i oficjalnych stron biur, jawna metodologia rankingu (wynik w rankingu 0-100, punkty za potwierdzenie w rejestrze, staż, cennik, spójność danych, usługi, opinie w Google i aktualne oferty), płatność nie wpływa na pozycję. Biura potwierdzone w rejestrze są oznaczone; biura bez potwierdzenia są w katalogu niżej w rankingu.",
    footerAbout:
      "Niezależny katalog biur nieruchomości. Dane pochodzą z rejestrów publicznych (KRS, wykaz podatników VAT) i ze stron firm. Płatność nie wpływa na pozycję w rankingu.",
    ogHeadline: "Ranking biur nieruchomości w Polsce",
    ogSubline: "Porównaj biura w swoim mieście: prowizje, zakres usług, oferty i dane z rejestrów.",
    ogAlt: "Ranking biur nieruchomości w Polsce",
    headerCta: "Znajdź biuro",
    navForFirms: "Dla biur",
    footerForFirmsHeading: "Dla biur",
    headerNav: [
      { href: "/miasta", label: "Miasta" },
      { href: "/ranking", label: "Ranking" },
      { href: "/blog", label: "Blog" },
      { href: "/metodologia", label: "Jak oceniamy" },
      { href: "/dla-firm", label: "Dla biur" },
    ],
    mobileNav: [
      { href: "/miasta", label: "Miasta" },
      { href: "/ranking", label: "Ranking" },
      { href: "/oferty", label: "Oferty biur" },
      { href: "/blog", label: "Blog" },
      { href: "/metodologia", label: "Jak oceniamy" },
      { href: "/raporty/prowizje-biur-nieruchomosci-2026", label: "Prowizje biur 2026" },
      { href: "/poradnik/jak-sprawdzic-biuro-nieruchomosci", label: "Jak sprawdzić biuro" },
      { href: "/dla-firm", label: "Dla biur" },
      { href: "/kontakt", label: "Kontakt" },
    ],
    homeHeroLead:
      "Porównaj biura w swoim mieście według stażu, jawnych prowizji i liczby aktualnych ofert. Potem napisz do wybranego biura jednym formularzem.",
    homeSteps: [
      {
        title: "Wybierz miasto",
        text: "Wpisz miejscowość i zobacz wszystkie biura nieruchomości, które sprawdziliśmy w tej okolicy.",
      },
      {
        title: "Porównaj biura",
        text: "Ranking pokazuje staż w rejestrze, jawność cennika, zakres usług i liczbę aktualnych ofert.",
      },
      {
        title: "Napisz do biura",
        text: "Zadaj pytanie przez formularz na stronie biura. Przekażemy je bezpłatnie i bez zobowiązań.",
      },
    ],
    homeWhyDaily: "Oferty i kontakt sprawdzamy każdego dnia.",
    contractName: "umowa pośrednictwa",
    leadCta: "Zapytaj o ofertę",
    notPartyShort: "Nie jesteśmy pośrednikiem w obrocie nieruchomościami i nie jesteśmy stroną umów, które zawierasz z biurami.",
    notPartyLong: "Operator nie jest pośrednikiem w obrocie nieruchomościami i nie jest stroną umów zawieranych między Użytkownikami a Biurami.",
    siteDataList: "dane kontaktowe, zakres usług, cennik, aktualne oferty",
    serviceExamples: "sprzedaż, wynajem, zarządzanie najmem, rynek pierwotny i inne",
    priceSectionHeading: "Prowizje i ceny usług",
    forFirmsDataList: "ceny i oferty",
    firmNoRates: (name) =>
      `${name} nie publikuje stawek prowizji na swojej stronie, więc wysokość wynagrodzenia trzeba ustalić bezpośrednio z biurem.`,
    lead: {
      topics: {
        kupno: "Chcę kupić",
        sprzedaz: "Chcę sprzedać",
        wynajem: "Chcę wynająć (szukam mieszkania)",
        najem: "Chcę oddać w najem",
        wycena: "Wycena nieruchomości",
        inne: "Inna sprawa",
      },
      message: (topic, where) => {
        switch (topic) {
          case "kupno":
            return `Dzień dobry, interesuje mnie zakup nieruchomości ${where}. Proszę o przesłanie aktualnych ofert i kontakt.`;
          case "sprzedaz":
            return `Dzień dobry, chcę sprzedać nieruchomość ${where}. Proszę o kontakt i przedstawienie oferty współpracy.`;
          case "wynajem":
            return `Dzień dobry, szukam mieszkania do wynajęcia ${where}. Proszę o przesłanie aktualnych ofert i kontakt.`;
          case "najem":
            return `Dzień dobry, chcę oddać w najem nieruchomość ${where}. Proszę o kontakt i przedstawienie oferty współpracy.`;
          case "wycena":
            return `Dzień dobry, proszę o wycenę nieruchomości ${where} i kontakt w tej sprawie.`;
          case "inne":
            return "Dzień dobry, proszę o kontakt w sprawie oferty biura.";
          default:
            return "Dzień dobry, proszę o informacje o aktualnej ofercie biura i kontakt.";
        }
      },
    },
    city: {
      guide: (c) => [
        `Zacznij od zakresu usług. Biuro, które na co dzień sprzedaje mieszkania, niekoniecznie dobrze poprowadzi wynajem lokalu czy sprzedaż działki.${
          c.groups.length > 0
            ? ` Wśród biur ${c.where} z naszego katalogu najczęściej deklarowane są: ${c.groups.map((g) => `${g.label} (${c.units(g.count)})`).join(", ")}.`
            : ""
        }`,
        `Zapytaj o prowizję i o to, co obejmuje: sesję zdjęciową, publikację ogłoszeń, prezentacje, negocjacje, pomoc przy dokumentach i kredycie. ${
          c.withPrices > 0
            ? `Cennik publikuje ${c.withPrices} z ${c.unitsGen(c.n)}, u pozostałych stawkę poznasz dopiero w rozmowie.`
            : "Biura w tym mieście nie publikują cenników, więc poproś o stawkę na piśmie przed podpisaniem umowy."
        } Sprawdź, czy kwota jest netto, brutto czy powiększona o VAT.`,
        `Przeczytaj umowę pośrednictwa przed podpisaniem: czy jest na wyłączność, na jak długo, z jakim okresem wypowiedzenia i kiedy należy się wynagrodzenie. Umowa na wyłączność bywa korzystna, ale tylko wtedy, gdy biuro jasno opisuje, co w zamian zrobi.`,
        `Zwróć uwagę na lokalizację i doświadczenie. Biuro, które ma aktualne oferty w Twojej okolicy, zna ceny i kupujących z tego rynku. Na stronie biura obejrzyj, jak prezentuje nieruchomości: zdjęcia, opisy, rzuty i informacje o stanie prawnym mówią dużo o tym, jak pokaże Twoją.`,
        `Na koniec sprawdź firmę w rejestrze. ${
          c.confirmed === c.n
            ? `Wszystkie biura z tej listy potwierdziliśmy numerem NIP w rejestrach publicznych.`
            : `${c.confirmed} z ${c.unitsGen(c.n)} ${c.where} potwierdziliśmy numerem NIP w rejestrach; przy pozostałych poproś o NIP i sprawdź go w wykazie podatników VAT.`
        }`,
      ],
      noPrices: (c) =>
        `Żadne z biur nieruchomości ${c.where} w naszym katalogu (${c.units(c.n)}) nie publikuje na swojej stronie stawek prowizji, więc wysokość wynagrodzenia trzeba ustalić bezpośrednio z biurem.`,
      somePrices: (c, share, natShare, saleFirms) =>
        `${c.withPrices} z ${c.unitsGen(c.n)} ${c.where} (${share}%${natShare != null ? `, w całym katalogu ${natShare}%` : ""}) ${nounForm(c.withPrices, { one: "publikuje", few: "publikują", many: "publikuje" })} na swojej stronie ceny usług, a ${saleFirms} ${nounForm(saleFirms, { one: "podaje", few: "podają", many: "podaje" })} procentową prowizję od sprzedaży, którą da się porównać.`,
      priceNote: (latest) =>
        latest
          ? `Stawki są deklarowane przez biura na ich stronach i sprawdzone ${latest}. Mogły się zmienić, a ostateczne wynagrodzenie określa umowa pośrednictwa.`
          : "Ostateczne wynagrodzenie zawsze określa umowa pośrednictwa.",
      priceHeading: (where) => `Ile wynosi prowizja biura nieruchomości ${where}?`,
      faq: {
        feeQuestion: (where) => `Ile kosztuje pośrednik nieruchomości ${where}?`,
        feeNoPrices: (where) =>
          `Biura ${where} w naszym katalogu nie publikują stawek prowizji, więc koszt trzeba ustalić z wybranym biurem. Poproś o stawkę na piśmie i sprawdź, czy zawiera VAT.`,
        trustQuestion: "Jak sprawdzić wiarygodność biura nieruchomości?",
        trustAnswer: (c) =>
          `Poproś o NIP i sprawdź go w wykazie podatników VAT lub w KRS, przeczytaj umowę pośrednictwa i zapytaj o ubezpieczenie OC. W naszym katalogu ${
            c.confirmed === c.n ? "wszystkie biura z tego miasta mają" : `${c.confirmed} z ${c.unitsGen(c.n)} ${c.where} ma`
          } potwierdzenie w rejestrze, oznaczone na profilu.`,
        factorsQuestion: "Od czego zależy prowizja biura nieruchomości?",
        factorsAnswer:
          "Najczęściej od wartości nieruchomości, rodzaju transakcji (sprzedaż, kupno, wynajem), zakresu usług, rodzaju umowy (na wyłączność lub otwarta) i od tego, czy w cenie są np. zdjęcia, reklama i pomoc prawna. Stawka bywa podawana netto, brutto albo z doliczanym VAT.",
      },
    },
    llmsReports: [
      {
        href: "/raporty/prowizje-biur-nieruchomosci-2026",
        label: "Prowizje biur nieruchomości 2026",
        description: "mediana prowizji za sprzedaż według miast, z cenników biur",
      },
    ],
    footerCatalogLinks: [
      { href: "/ranking", label: "Najlepsze biura w Polsce" },
      { href: "/wyroznienia-2026", label: "Wyróżnienia 2026" },
      { href: "/oferty", label: "Aktualne oferty biur" },
      { href: "/metodologia", label: "Jak powstaje ranking" },
      { href: "/raporty/prowizje-biur-nieruchomosci-2026", label: "Prowizje biur 2026" },
      { href: "/poradnik/jak-sprawdzic-biuro-nieruchomosci", label: "Jak sprawdzić biuro" },
      { href: "/blog", label: "Blog" },
    ],
  },
};
