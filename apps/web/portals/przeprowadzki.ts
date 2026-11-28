/**
 * Portal nr 7: firmy przeprowadzkowe. "Nowy Adres" to nazwa robocza, domena: TBD (decyzja właściciela).
 * Dane: branża "przeprowadzki" w bazie (listings.vertical_id). Typ schema.org: MovingCompany.
 */
import { servicePortal } from "./service-portal";

export const przeprowadzki = servicePortal({
  slug: "przeprowadzki",
  brand: "Nowy Adres",
  descriptor: "firmy przeprowadzkowe",
  shortName: "NA",
  // Wagi z parametrów silnika rankingu dostępnych dziś (rejestr, staż, cennik, spójność, zakres usług, opinie Google);
  // wartości wspólnych parametrów jak w vertical.yaml tej branży, rejestr 20 jak w pozostałych portalach. Parametry
  // specyficzne dla branży z vertical.yaml (uprawnienia, realizacje, ubezpieczenie itd.) czekają na dane i implementację
  // w lib/ranking.ts.
  rankingWeights: { rejestr: 20, staz: 8, jawnosc_cennika: 20, spojnosc_danych: 8, zakres_uslug: 12, opinie_google: 14 },
  schemaType: "MovingCompany",
  profileAnchor: "firma",
  trackingContentType: "firma_przeprowadzkowa",
  catalogView: {
    goals: {},
    filters: {
      firmowe: { label: "Przeprowadzki firmowe", group: "office" },
      pianina: { label: "Pianina i ciężkie rzeczy", group: "piano" },
      cennik: { label: "Jawny cennik", group: null },
    },
  },
  serviceGroups: [
    { key: "flat", label: "przeprowadzki domowe", re: /mieszka|\bdom(u|ów|y)\b|prywatn/i },
    { key: "office", label: "przeprowadzki firmowe", re: /\bbiur|przedsiębiorstw|firmow/i },
    { key: "piano", label: "transport pianin i ciężkich rzeczy", re: /pianin|fortepian|sejf|ciężk/i },
    { key: "packing", label: "pakowanie i materiały", re: /pakow|karton|materiał/i },
    { key: "storage", label: "magazynowanie", re: /magazyn|składowan/i },
    { key: "intl", label: "przeprowadzki zagraniczne", re: /międzynarod|zagranic|europ/i },
    { key: "disposal", label: "wywóz i utylizacja mebli", re: /utyliz|wywóz|wywoz|gabaryt/i },
    { key: "carry", label: "wnoszenie i dźwig", re: /wnosz|wniesien|dźwig|winda/i },
  ],
  terms: {
    firm: { one: "firma", few: "firmy", many: "firm", genOne: "firmy" },
    phrase: {
      one: "firma przeprowadzkowa",
      few: "firmy przeprowadzkowe",
      many: "firm przeprowadzkowych",
      genOne: "firmy przeprowadzkowej",
      datOne: "firmie przeprowadzkowej",
      accOne: "firmę przeprowadzkową",
      locPl: "firmach przeprowadzkowych",
    },
    domainGen: "przeprowadzek",
    expert: "ekipa",
    expertFull: "ekipa przeprowadzkowa",
    synonym: { few: "firmy", gen: "firm" },
    fee: { nom: "cena przeprowadzki", nomPl: "ceny przeprowadzek", genPl: "przeprowadzek" },
    company: { one: "firma", few: "firmy", many: "firm" },
    unit: { gender: "f", sg: { nom: "firma", gen: "firmy", dat: "firmie", acc: "firmę", ins: "firmą", loc: "firmie" }, pl: { nom: "firmy", gen: "firm", dat: "firmom", acc: "firmy", ins: "firmami", loc: "firmach" } },
  },
  headerCta: "Znajdź firmę",
  forFirms: "Dla firm",
  none: "Żadna z",
  homeHeroLead:
    "Porównaj firmy przeprowadzkowe w swoim mieście według stażu, jawnych cenników i zakresu usług: przeprowadzki domowe i firmowe, transport mebli, pakowanie. Potem poproś wybraną firmę o wycenę jednym formularzem.",
  homeOrder: ["steps", "cities", "ranking"],
  homeStepsHeading: "Dobra firma przeprowadzkowa w trzech krokach",
  homeSteps: [
    { title: "Wybierz miasto", text: "Wpisz miejscowość i zobacz firmy przeprowadzkowe, które sprawdziliśmy w tej okolicy: przeprowadzki domowe i firmowe, transport mebli, pakowanie." },
    { title: "Porównaj firmy", text: "Ranking pokazuje staż w rejestrze, jawność cennika, zakres usług i opinie z Map Google. Sprawdź, czy firma podaje cennik i co obejmuje wycena." },
    { title: "Poproś o wycenę", text: "Podaj trasę, termin i zakres przeprowadzki w formularzu na stronie firmy. Przekażemy wiadomość bezpłatnie i bez zobowiązań, a wycenę na piśmie ustalisz bezpośrednio z firmą." },
  ],
  priceThing: "przeprowadzka domowa",
  noRatesTail: "cenę przeprowadzki trzeba ustalić bezpośrednio z firmą.",
  contractName: "umowa przeprowadzki",
  leadCta: "Poproś o wycenę",
  notPartyShort:
    "Nie jesteśmy firmą przeprowadzkową ani przewoźnikiem i nie jesteśmy stroną umów, które zawierasz z firmami.",
  notPartyLong:
    "Operator nie świadczy usług przeprowadzkowych ani przewozu i nie jest stroną umów zawieranych między Użytkownikami a Firmami.",
  serviceExamples: "przeprowadzki domowe i firmowe, transport mebli i pianin, pakowanie, magazynowanie i inne",
  priceSectionHeading: "Ceny przeprowadzek i usług",
  leadTopics: {
    kupno: "Przeprowadzka domowa",
    sprzedaz: "Przeprowadzka firmowa",
    wynajem: "Transport pianina lub ciężkich rzeczy",
    najem: "Pakowanie i magazynowanie",
    wycena: "Wycena przeprowadzki",
    inne: "Inna sprawa",
  },
  leadMessage: (topic, where) => {
    switch (topic) {
      case "kupno":
        return `Dzień dobry, planuję przeprowadzkę domową ${where}. Proszę o kontakt i wycenę.`;
      case "sprzedaz":
        return `Dzień dobry, planuję przeprowadzkę firmową ${where}. Proszę o kontakt i wycenę.`;
      case "wynajem":
        return `Dzień dobry, potrzebuję transportu pianina lub ciężkich rzeczy ${where}. Proszę o kontakt i wycenę.`;
      case "najem":
        return `Dzień dobry, potrzebuję pakowania i magazynowania rzeczy ${where}. Proszę o kontakt i wycenę.`;
      case "wycena":
        return `Dzień dobry, proszę o wycenę przeprowadzki ${where} i kontakt w tej sprawie.`;
      case "inne":
        return "Dzień dobry, proszę o kontakt w sprawie usług firmy.";
      default:
        return "Dzień dobry, proszę o informacje o usługach i cenniku firmy oraz o kontakt.";
    }
  },
  guide: (c, h) => [
    `Zacznij od zakresu. Przeprowadzka domowa lub firmowa, transport pianina i przewóz samych mebli to różne usługi. Ustal, czy potrzebujesz też pakowania, demontażu i montażu mebli, wniesienia albo magazynowania.${h.groups}`,
    `Poproś o wycenę na piśmie i ustal, jak liczona jest cena: stawka za godzinę, ryczałt za całość czy cena za pomieszczenie. Zapytaj o dopłaty (piętra bez windy, dojazd, materiały do pakowania, czas oczekiwania). ${h.prices} Sprawdź, czy kwota jest netto czy brutto.`,
    `Zapytaj o ubezpieczenie: czy przewożone rzeczy są ubezpieczone, do jakiej kwoty, co obejmuje polisa i jak zgłosić szkodę. Spisz z ekipą stan rzeczy przed i po przewozie.`,
    `Przeczytaj umowę lub potwierdzenie zlecenia: termin, adresy załadunku i rozładunku, zakres, cenę, zaliczkę i odpowiedzialność za szkody. Zapytaj, czy ekipa jest stała, a nie dobierana w dniu przeprowadzki, i jakim samochodem przyjedzie.`,
    `Na koniec sprawdź firmę w rejestrze. ${h.registry}`,
  ],
  trust: {
    question: "Jak sprawdzić wiarygodność firmy przeprowadzkowej?",
    answer: (c) =>
      `Poproś o NIP i sprawdź go w wykazie podatników VAT lub w KRS, przeczytaj umowę oraz zapytaj o ubezpieczenie przewożonych rzeczy i sposób zgłaszania szkód. W naszym katalogu ${
        c.confirmed === c.n ? "wszystkie firmy z tego miasta mają" : `${c.confirmed} z ${c.unitsGen(c.n)} ${c.where} ma`
      } potwierdzenie w rejestrze, oznaczone na profilu.`,
  },
  factors: {
    question: "Od czego zależy cena przeprowadzki?",
    answer:
      "Od ilości rzeczy i mebli, odległości, liczby osób w ekipie i rodzaju samochodu, pięter i dostępności windy, pakowania i materiałów, demontażu mebli oraz ciężkich przedmiotów, takich jak pianino. Cena bywa podawana jako stawka za godzinę, ryczałt albo cena za pomieszczenie, netto lub brutto.",
  },
  feeNoPrices: (where) =>
    `Firmy ${where} w naszym katalogu nie publikują cen usług, więc koszt trzeba ustalić z wybraną firmą. Poproś o wycenę na piśmie i sprawdź, czy zawiera dojazd, wniesienie, materiały i VAT.`,
});
