/**
 * Portal nr 8: kliniki weterynaryjne. "Cztery Łapy" to nazwa robocza, domena: TBD (decyzja właściciela).
 * Dane: branża "weterynarze" w bazie (listings.vertical_id). Typ schema.org: VeterinaryCare.
 * Zawód regulowany (lekarz weterynarii): zasady reklamy i informowania o praktyce do potwierdzenia z prawnikiem
 * przed publikacją (docs/geo/branze-3-8.md). Portal nie ocenia jakości leczenia.
 */
import { servicePortal } from "./service-portal";

export const weterynarze = servicePortal({
  slug: "weterynarze",
  brand: "Cztery Łapy",
  descriptor: "kliniki weterynaryjne",
  shortName: "CŁ",
  // Wagi z parametrów silnika rankingu dostępnych dziś (rejestr, staż, cennik, spójność, zakres usług, opinie Google);
  // wartości wspólnych parametrów jak w vertical.yaml tej branży, rejestr 20 jak w pozostałych portalach. Parametry
  // specyficzne dla branży z vertical.yaml (uprawnienia, realizacje, ubezpieczenie itd.) czekają na dane i implementację
  // w lib/ranking.ts.
  rankingWeights: { rejestr: 20, staz: 6, jawnosc_cennika: 14, spojnosc_danych: 6, zakres_uslug: 16, opinie_google: 14 },
  schemaType: "VeterinaryCare",
  profileAnchor: "klinika",
  trackingContentType: "klinika_weterynaryjna",
  catalogView: {
    goals: {},
    filters: {
      nagle: { label: "Nagłe przypadki i dyżury", group: "emergency" },
      domowe: { label: "Wizyty domowe", group: "home" },
      cennik: { label: "Jawny cennik", group: null },
    },
  },
  serviceGroups: [
    { key: "consult", label: "konsultacje i profilaktyka", re: /konsultac|wizyt|profilakt|szczepien|odrobacz|czip/i },
    { key: "surgery", label: "chirurgia i zabiegi", re: /chirurg|zabieg|sterylizac|kastrac|operac/i },
    { key: "dentistry", label: "stomatologia", re: /stomatolog|dentyst|skaling/i },
    { key: "imaging", label: "diagnostyka obrazowa i laboratorium", re: /\busg\b|\brtg\b|rentgen|tomograf|laborator|badani\w* krwi/i },
    { key: "emergency", label: "nagłe przypadki i dyżury", re: /całodob|24\s?h|nagł|pogotowi|dyżur/i },
    { key: "exotic", label: "zwierzęta egzotyczne", re: /egzotyc|gryzoni|ptak|ptac|gad\b|fretk/i },
    { key: "home", label: "wizyty domowe", re: /domow|dojazd/i },
    { key: "hospital", label: "hospitalizacja", re: /hospitaliz|stacjonar|obserwac/i },
  ],
  terms: {
    firm: { one: "klinika", few: "kliniki", many: "klinik", genOne: "kliniki" },
    phrase: {
      one: "klinika weterynaryjna",
      few: "kliniki weterynaryjne",
      many: "klinik weterynaryjnych",
      genOne: "kliniki weterynaryjnej",
      datOne: "klinice weterynaryjnej",
      accOne: "klinikę weterynaryjną",
      locPl: "klinikach weterynaryjnych",
    },
    domainGen: "weterynarii",
    expert: "lekarz weterynarii",
    expertFull: "lekarz weterynarii",
    synonym: { few: "kliniki", gen: "klinik" },
    fee: { nom: "cena wizyty", nomPl: "ceny wizyt", genPl: "wizyt" },
    company: { one: "placówka", few: "placówki", many: "placówek" },
    unit: { gender: "f", sg: { nom: "klinika", gen: "kliniki", dat: "klinice", acc: "klinikę", ins: "kliniką", loc: "klinice" }, pl: { nom: "kliniki", gen: "klinik", dat: "klinikom", acc: "kliniki", ins: "klinikami", loc: "klinikach" } },
  },
  headerCta: "Znajdź klinikę",
  forFirms: "Dla klinik",
  none: "Żadna z",
  homeHeroLead:
    "Porównaj kliniki weterynaryjne w swoim mieście według stażu, jawnych cenników i zakresu usług: konsultacje, szczepienia, chirurgia, diagnostyka. Potem zapytaj wybraną klinikę o wizytę jednym formularzem. W nagłym przypadku zadzwoń bezpośrednio do placówki.",
  homeOrder: ["cities", "steps", "ranking"],
  homeStepsHeading: "Dobra klinika weterynaryjna w trzech krokach",
  homeSteps: [
    { title: "Znajdź klinikę w pobliżu", text: "Wpisz miejscowość i zobacz kliniki weterynaryjne, które sprawdziliśmy w tej okolicy, razem z adresem i danymi kontaktowymi." },
    { title: "Sprawdź zakres usług i opinie", text: "Profil pokazuje deklarowany zakres usług, ceny wizyt (jeśli placówka je podaje) oraz ocenę i opinie z Map Google. Godziny przyjęć i dyżury potwierdź w placówce." },
    { title: "Zadzwoń lub umów wizytę", text: "Zadzwoń do kliniki albo wyślij zapytanie o wizytę przez formularz na jej profilu. W nagłym przypadku dzwoń bezpośrednio do placówki." },
  ],
  methodologyNote:
    "Ranking nie ocenia jakości leczenia ani kwalifikacji lekarzy weterynarii i nie zastępuje porady lekarskiej. Opisuje wyłącznie dane ze stron placówek, z rejestrów publicznych i z Map Google: staż, jawność cennika, zakres usług i opinie.",
  extraFaq: [
    { q: "Czy ranking ocenia jakość leczenia?", a: "Nie. Ranking opisuje dane ze stron i rejestrów: staż w rejestrze, jawność cennika, zakres usług i opinie z Map Google. Nie ocenia jakości leczenia i nie zastępuje porady lekarza weterynarii." },
  ],
  priceThing: "wizyta u weterynarza",
  noRatesTail: "cenę wizyty i zabiegów trzeba ustalić bezpośrednio z placówką.",
  contractName: "wycena zabiegu",
  leadCta: "Zapytaj o wizytę",
  notPartyShort:
    "Nie jesteśmy placówką weterynaryjną, nie udzielamy porad weterynaryjnych i nie jesteśmy stroną umów, które zawierasz z placówkami.",
  notPartyLong:
    "Operator nie świadczy usług weterynaryjnych ani nie udziela porad lekarskich i nie jest stroną umów zawieranych między Użytkownikami a Klinikami.",
  serviceExamples: "konsultacje i szczepienia, chirurgia, stomatologia, diagnostyka i inne",
  priceSectionHeading: "Ceny wizyt i zabiegów",
  leadTopics: {
    kupno: "Wizyta kontrolna lub szczepienie",
    sprzedaz: "Zabieg lub operacja",
    wynajem: "Diagnostyka (USG, RTG, badania)",
    najem: "Wizyta domowa",
    wycena: "Wycena zabiegu",
    inne: "Inna sprawa",
  },
  leadMessage: (topic, where) => {
    switch (topic) {
      case "kupno":
        return `Dzień dobry, szukam kliniki ${where} na wizytę kontrolną lub szczepienie zwierzęcia. Proszę o kontakt i informację o terminach.`;
      case "sprzedaz":
        return `Dzień dobry, szukam kliniki ${where} do zabiegu u zwierzęcia. Proszę o kontakt i informację o terminie i kosztach.`;
      case "wynajem":
        return `Dzień dobry, szukam kliniki ${where} do badań diagnostycznych zwierzęcia. Proszę o kontakt i informację o terminach i cenach.`;
      case "najem":
        return `Dzień dobry, szukam weterynarza z dojazdem do domu ${where}. Proszę o kontakt i informację o dostępności i cenach.`;
      case "wycena":
        return `Dzień dobry, proszę o wycenę zabiegu ${where} i kontakt w tej sprawie.`;
      case "inne":
        return "Dzień dobry, proszę o kontakt w sprawie usług kliniki.";
      default:
        return "Dzień dobry, proszę o informacje o usługach i cenniku kliniki oraz o kontakt.";
    }
  },
  guide: (c, h) => [
    `Zacznij od tego, czego potrzebujesz: zwykłej wizyty i szczepień, zabiegu, diagnostyki obrazowej czy pomocy w nagłym przypadku. Sprawdź, czy placówka przyjmuje Twój gatunek zwierzęcia (psy, koty, zwierzęta egzotyczne).${h.groups}`,
    `Zapytaj o cenę wizyty i podstawowych zabiegów oraz o to, co obejmuje: badanie, zabieg, leki, kontrolę. ${h.prices} Przed zabiegiem poproś o wycenę na piśmie.`,
    `Zapytaj o godziny otwarcia, dyżury i o to, gdzie szukać pomocy poza godzinami pracy. W nagłym przypadku zadzwoń przed wyjazdem i upewnij się, że lekarz jest dostępny: informacje w katalogu pochodzą ze stron placówek i mogły się zmienić.`,
    `Poproś lekarza, by wyjaśnił zakres planowanego postępowania i koszty, a zgodę na zabieg wyraź po rozmowie. Nasz ranking nie ocenia jakości leczenia: pokazuje dane ze stron i rejestrów, czyli ceny, zakres usług, dostępność i opinie z Map Google.`,
    `Na koniec sprawdź placówkę w rejestrze. ${h.registry}`,
  ],
  trust: {
    question: "Jak sprawdzić wiarygodność kliniki weterynaryjnej?",
    answer: (c) =>
      `Sprawdź NIP w wykazie podatników VAT lub w KRS oraz zapytaj, czy placówka jest wpisana do właściwego rejestru zakładów leczniczych dla zwierząt. Nasz ranking nie ocenia jakości leczenia. W naszym katalogu ${
        c.confirmed === c.n ? "wszystkie kliniki z tego miasta mają" : `${c.confirmed} z ${c.unitsGen(c.n)} ${c.where} ma`
      } potwierdzenie w rejestrze firm, oznaczone na profilu.`,
  },
  factors: {
    question: "Od czego zależy cena wizyty u weterynarza?",
    answer:
      "Od rodzaju wizyty (kontrolna, szczepienie, dyżur, wizyta domowa), gatunku i wagi zwierzęcia, potrzebnych badań (USG, RTG, badania krwi), zabiegów i leków oraz pory dnia, bo wizyty w nagłych przypadkach i poza godzinami pracy bywają droższe. Cena bywa podawana netto lub brutto, a leki i materiały często są liczone osobno.",
  },
  feeNoPrices: (where) =>
    `Kliniki ${where} w naszym katalogu nie publikują cen usług, więc koszt trzeba ustalić z wybraną placówką. Poproś o wycenę przed zabiegiem i sprawdź, czy zawiera badania, leki i VAT.`,
});
