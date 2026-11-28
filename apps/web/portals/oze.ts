/**
 * Portal nr 3: fotowoltaika, pompy ciepła, klimatyzacja i magazyny energii (jeden portal z kategoriami).
 * "Prąd i Ciepło" to nazwa robocza, domena: TBD (decyzja właściciela). Dane: branża "oze" w bazie (listings.vertical_id).
 * Typ schema.org: HomeAndConstructionBusiness (ogólny, bo firmy łączą instalacje elektryczne, cieplne i klimatyzacyjne;
 * HVACBusiness opisuje tylko część firm).
 */
import { servicePortal } from "./service-portal";

export const oze = servicePortal({
  slug: "oze",
  brand: "Prąd i Ciepło",
  descriptor: "firmy instalacyjne",
  shortName: "PiC",
  schemaType: "HomeAndConstructionBusiness",
  profileAnchor: "firma",
  trackingContentType: "firma_instalacyjna",
  catalogView: {
    goals: {},
    filters: {
      fotowoltaika: { label: "Fotowoltaika", group: "pv" },
      pompy: { label: "Pompy ciepła", group: "heatpump" },
      klimatyzacja: { label: "Klimatyzacja", group: "ac" },
      magazyny: { label: "Magazyny energii", group: "storage" },
      cennik: { label: "Jawny cennik", group: null },
    },
  },
  serviceGroups: [
    { key: "pv", label: "fotowoltaika", re: /fotowolt|panel\w* słonecz|instalacj\w* solarn|\bpv\b/i },
    { key: "heatpump", label: "pompy ciepła", re: /pomp\w* ciepł/i },
    { key: "ac", label: "klimatyzacja", re: /klimatyz|\bsplit\b/i },
    { key: "storage", label: "magazyny energii", re: /magazyn\w* energi|akumulator|bateri\w* domow/i },
    { key: "service", label: "serwis i przeglądy", re: /serwis|przegl|konserwac/i },
    { key: "ev", label: "ładowarki aut elektrycznych", re: /ładowark|wallbox|elektromobil/i },
    { key: "formalities", label: "pomoc w formalnościach", re: /formalno|dotacj|dofinansow|zgłoszeni/i },
  ],
  terms: {
    firm: { one: "firma", few: "firmy", many: "firm", genOne: "firmy" },
    phrase: {
      one: "firma instalacyjna",
      few: "firmy instalacyjne",
      many: "firm instalacyjnych",
      genOne: "firmy instalacyjnej",
      datOne: "firmie instalacyjnej",
      locPl: "firmach instalacyjnych",
    },
    domainGen: "energii odnawialnej",
    expert: "instalator",
    expertFull: "instalator",
    synonym: { few: "firmy", gen: "firm" },
    fee: { nom: "cena instalacji", nomPl: "ceny instalacji", genPl: "montażu" },
    company: { one: "firma", few: "firmy", many: "firm" },
  },
  headerCta: "Znajdź firmę",
  forFirms: "Dla firm",
  none: "Żadna z",
  homeHeroLead:
    "Porównaj firmy instalacyjne w swoim mieście według stażu, jawnych cenników i zakresu usług: fotowoltaika, pompy ciepła, klimatyzacja, magazyny energii. Potem poproś wybraną firmę o wycenę jednym formularzem.",
  priceThing: "instalacja fotowoltaiczna, pompa ciepła czy klimatyzacja",
  noRatesTail: "cenę instalacji trzeba ustalić bezpośrednio z firmą.",
  contractName: "umowa na montaż instalacji",
  leadCta: "Poproś o wycenę",
  notPartyShort:
    "Nie jesteśmy firmą instalacyjną ani doradcą energetycznym i nie jesteśmy stroną umów, które zawierasz z firmami.",
  notPartyLong:
    "Operator nie świadczy usług montażu instalacji ani doradztwa energetycznego i nie jest stroną umów zawieranych między Użytkownikami a Firmami.",
  serviceExamples: "fotowoltaika, pompy ciepła, klimatyzacja, magazyny energii, serwis i inne",
  priceSectionHeading: "Ceny instalacji i usług",
  leadTopics: {
    kupno: "Chcę fotowoltaikę",
    sprzedaz: "Chcę pompę ciepła",
    wynajem: "Chcę klimatyzację",
    najem: "Chcę magazyn energii",
    wycena: "Wycena instalacji",
    inne: "Inna sprawa",
  },
  leadMessage: (topic, where) => {
    switch (topic) {
      case "kupno":
        return `Dzień dobry, interesuje mnie instalacja fotowoltaiczna ${where}. Proszę o kontakt i wycenę.`;
      case "sprzedaz":
        return `Dzień dobry, interesuje mnie pompa ciepła ${where}. Proszę o kontakt i wycenę z montażem.`;
      case "wynajem":
        return `Dzień dobry, szukam firmy do montażu klimatyzacji ${where}. Proszę o kontakt i wycenę.`;
      case "najem":
        return `Dzień dobry, interesuje mnie magazyn energii ${where}. Proszę o kontakt i wycenę.`;
      case "wycena":
        return `Dzień dobry, proszę o wycenę instalacji ${where} i kontakt w tej sprawie.`;
      case "inne":
        return "Dzień dobry, proszę o kontakt w sprawie usług firmy.";
      default:
        return "Dzień dobry, proszę o informacje o usługach i cenniku firmy oraz o kontakt.";
    }
  },
  guide: (c, h) => [
    `Zacznij od tego, czego naprawdę potrzebujesz: fotowoltaiki, pompy ciepła, klimatyzacji czy magazynu energii. Firma, która dobrze montuje panele, niekoniecznie zna się na pompach ciepła, i odwrotnie.${h.groups}`,
    `Poproś o wycenę na piśmie z mocą lub modelem urządzeń, zakresem prac (projekt, montaż, uruchomienie, zgłoszenie do operatora sieci) i gwarancją. ${h.prices} Sprawdź, czy kwota jest netto czy brutto i co obejmuje.`,
    `Zapytaj o uprawnienia ekipy (np. uprawnienia elektryczne przy fotowoltaice, certyfikat do prac z czynnikami chłodniczymi przy klimatyzacji i pompach ciepła, zależnie od zakresu) oraz o ubezpieczenie odpowiedzialności wykonawcy.`,
    `Ustal, kto odpowiada za gwarancję i serwis po montażu, jak długo i jak szybko firma reaguje na awarię. Poproś o adresy lub zdjęcia podobnych instalacji. Jeśli firma pomaga w dokumentach dotacji lub ulg, zapytaj o zakres tej pomocy: o przyznaniu dofinansowania decyduje instytucja, nie firma.`,
    `Na koniec sprawdź firmę w rejestrze. ${h.registry}`,
  ],
  trust: {
    question: "Jak sprawdzić wiarygodność firmy instalacyjnej?",
    answer: (c) =>
      `Poproś o NIP i sprawdź go w wykazie podatników VAT lub w KRS, przeczytaj umowę oraz zapytaj o uprawnienia ekipy, gwarancję i ubezpieczenie. W naszym katalogu ${
        c.confirmed === c.n ? "wszystkie firmy z tego miasta mają" : `${c.confirmed} z ${c.unitsGen(c.n)} ${c.where} ma`
      } potwierdzenie w rejestrze, oznaczone na profilu.`,
  },
  factors: {
    question: "Od czego zależy cena fotowoltaiki, pompy ciepła lub klimatyzacji?",
    answer:
      "Przede wszystkim od mocy i modelu urządzeń, rodzaju dachu lub budynku, długości przewodów i rur, zakresu prac (projekt, montaż, uruchomienie, zgłoszenia) i wyposażenia dodatkowego, np. magazynu energii. Cena bywa podawana netto, brutto albo z doliczanym VAT, więc porównuj oferty o tym samym zakresie.",
  },
  feeNoPrices: (where) =>
    `Firmy ${where} w naszym katalogu nie publikują cen usług, więc koszt trzeba ustalić z wybraną firmą. Poproś o wycenę na piśmie i sprawdź, czy zawiera montaż, uruchomienie i VAT.`,
});
