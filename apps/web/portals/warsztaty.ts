/**
 * Portal nr 6: warsztaty samochodowe. "Pod Maską" to nazwa robocza, domena: TBD (decyzja właściciela).
 * Dane: branża "warsztaty" w bazie (listings.vertical_id). Typ schema.org: AutoRepair.
 * Uwaga: wiele warsztatów nie ma własnej strony, a obecny robot zbiera firmy po stronach WWW (docs/geo/branze-3-8.md).
 */
import { servicePortal } from "./service-portal";

export const warsztaty = servicePortal({
  slug: "warsztaty",
  brand: "Pod Maską",
  descriptor: "warsztaty samochodowe",
  shortName: "PM",
  schemaType: "AutoRepair",
  profileAnchor: "warsztat",
  trackingContentType: "warsztat_samochodowy",
  catalogView: {
    goals: {},
    filters: {
      diagnostyka: { label: "Diagnostyka", group: "diag" },
      klimatyzacja: { label: "Klimatyzacja", group: "ac" },
      opony: { label: "Opony i wulkanizacja", group: "tyres" },
      cennik: { label: "Jawny cennik", group: null },
    },
  },
  serviceGroups: [
    { key: "mech", label: "mechanika i serwis", re: /mechanik|serwis|napraw|przegl/i },
    { key: "diag", label: "diagnostyka", re: /diagnost/i },
    { key: "ac", label: "klimatyzacja samochodowa", re: /klimatyzac/i },
    { key: "tyres", label: "opony i wulkanizacja", re: /wulkaniz|opon|geometri/i },
    { key: "brakes", label: "hamulce i zawieszenie", re: /hamulc|zawiesz|amortyz/i },
    { key: "body", label: "blacharstwo i lakiernictwo", re: /blachar|lakier|dent\b|pdr/i },
    { key: "electric", label: "elektryka i elektronika", re: /elektryk|elektronik|akumulator/i },
    { key: "hybrid", label: "hybrydy i auta elektryczne", re: /hybryd|elektryczn\w* (auta|samochod|pojazd)/i },
    { key: "gearbox", label: "skrzynie biegów i sprzęgła", re: /skrzyn|sprzęg/i },
  ],
  terms: {
    firm: { one: "warsztat", few: "warsztaty", many: "warsztatów", genOne: "warsztatu" },
    phrase: {
      one: "warsztat samochodowy",
      few: "warsztaty samochodowe",
      many: "warsztatów samochodowych",
      genOne: "warsztatu samochodowego",
      datOne: "warsztatowi samochodowemu",
      locPl: "warsztatach samochodowych",
    },
    domainGen: "napraw samochodowych",
    expert: "mechanik",
    expertFull: "mechanik samochodowy",
    synonym: { few: "warsztaty", gen: "warsztatów" },
    fee: { nom: "stawka robocizny", nomPl: "stawki robocizny", genPl: "robocizny" },
    company: { one: "warsztat", few: "warsztaty", many: "warsztatów" },
  },
  headerCta: "Znajdź warsztat",
  forFirms: "Dla warsztatów",
  none: "Żaden z",
  homeHeroLead:
    "Porównaj warsztaty samochodowe w swoim mieście według stażu, jawnych cenników i zakresu usług: mechanika, diagnostyka, klimatyzacja, opony. Potem poproś wybrany warsztat o wycenę jednym formularzem.",
  priceThing: "naprawa samochodu",
  noRatesTail: "stawkę robocizny i koszt naprawy trzeba ustalić bezpośrednio z warsztatem.",
  contractName: "zlecenie naprawy",
  leadCta: "Poproś o wycenę",
  notPartyShort:
    "Nie jesteśmy warsztatem samochodowym i nie jesteśmy stroną umów ani zleceń naprawy, które zawierasz z warsztatami.",
  notPartyLong:
    "Operator nie świadczy usług naprawy pojazdów i nie jest stroną umów zawieranych między Użytkownikami a Warsztatami.",
  serviceExamples: "mechanika, diagnostyka, klimatyzacja, opony, blacharstwo i inne",
  priceSectionHeading: "Stawki i ceny napraw",
  leadTopics: {
    kupno: "Naprawa lub serwis auta",
    sprzedaz: "Diagnostyka usterki",
    wynajem: "Wymiana opon",
    najem: "Serwis klimatyzacji",
    wycena: "Wycena naprawy",
    inne: "Inna sprawa",
  },
  leadMessage: (topic, where) => {
    switch (topic) {
      case "kupno":
        return `Dzień dobry, szukam warsztatu do naprawy lub serwisu auta ${where}. Proszę o kontakt, termin i wycenę.`;
      case "sprzedaz":
        return `Dzień dobry, potrzebuję diagnostyki usterki w aucie ${where}. Proszę o kontakt i wycenę.`;
      case "wynajem":
        return `Dzień dobry, potrzebuję wymiany opon ${where}. Proszę o kontakt, termin i wycenę.`;
      case "najem":
        return `Dzień dobry, potrzebuję serwisu klimatyzacji w aucie ${where}. Proszę o kontakt, termin i wycenę.`;
      case "wycena":
        return `Dzień dobry, proszę o wycenę naprawy ${where} i kontakt w tej sprawie.`;
      case "inne":
        return "Dzień dobry, proszę o kontakt w sprawie usług warsztatu.";
      default:
        return "Dzień dobry, proszę o informacje o usługach i cenniku warsztatu oraz o kontakt.";
    }
  },
  guide: (c, h) => [
    `Zacznij od tego, czego potrzebujesz: bieżącego serwisu, diagnostyki usterki, klimatyzacji, opon czy naprawy blacharskiej. Zapytaj, czy warsztat zna Twoją markę i czy ma sprzęt do diagnostyki.${h.groups}`,
    `Zapytaj o stawkę za roboczogodzinę i poproś o kosztorys przed naprawą. Ustal, że prace dodatkowe wymagają Twojej zgody. ${h.prices} Zapytaj, czy cena zawiera części i jakich części dotyczy (oryginalne czy zamienniki).`,
    `Poproś o zlecenie naprawy z opisem usterki i zakresem prac oraz o wydanie wymienionych części, jeśli ich chcesz. Zapytaj o gwarancję na naprawę i na części oraz o to, jak warsztat postępuje przy reklamacji.`,
    `Czytaj opinie z rozwagą: liczy się ich liczba, data i treść. Zapytaj o ubezpieczenie odpowiedzialności warsztatu na wypadek uszkodzenia auta w trakcie naprawy. Zwróć uwagę na kontakt: czy warsztat odbiera telefon, podaje terminy i informuje o postępie.`,
    `Na koniec sprawdź warsztat w rejestrze. ${h.registry}`,
  ],
  trust: {
    question: "Jak sprawdzić wiarygodność warsztatu samochodowego?",
    answer: (c) =>
      `Poproś o NIP i sprawdź go w wykazie podatników VAT, przeczytaj zlecenie naprawy, zapytaj o gwarancję i ubezpieczenie warsztatu oraz przejrzyj opinie w Mapach Google. W naszym katalogu ${
        c.confirmed === c.n ? "wszystkie warsztaty z tego miasta mają" : `${c.confirmed} z ${c.unitsGen(c.n)} ${c.where} ma`
      } potwierdzenie w rejestrze, oznaczone na profilu.`,
  },
  factors: {
    question: "Od czego zależy koszt naprawy samochodu?",
    answer:
      "Od rodzaju usterki, marki i modelu auta, ceny i dostępności części (oryginalne albo zamienniki), czasu pracy mechanika liczonego według stawki za roboczogodzinę, a często od diagnostyki, która wskazuje właściwy zakres naprawy. Cena bywa podawana netto lub brutto, z częściami albo samą robociznę, więc porównuj wyceny tego samego zakresu.",
  },
  feeNoPrices: (where) =>
    `Warsztaty ${where} w naszym katalogu nie publikują cen usług, więc koszt trzeba ustalić z wybranym warsztatem. Poproś o kosztorys przed naprawą i sprawdź, czy zawiera części, robociznę i VAT.`,
});
