/**
 * Portal nr 5: firmy budowlane (budowa domów). "Pod Klucz" to nazwa robocza, domena: TBD (decyzja właściciela).
 * Dane: branża "budowlane" w bazie (listings.vertical_id). Deweloperzy nie należą do tego portalu (inna działalność).
 * Typ schema.org: GeneralContractor.
 */
import { servicePortal } from "./service-portal";

export const budowlane = servicePortal({
  slug: "budowlane",
  brand: "Pod Klucz",
  descriptor: "firmy budowlane",
  shortName: "PK",
  // Wagi z parametrów silnika rankingu dostępnych dziś (rejestr, staż, cennik, spójność, zakres usług, opinie Google);
  // wartości wspólnych parametrów jak w vertical.yaml tej branży, rejestr 20 jak w pozostałych portalach. Parametry
  // specyficzne dla branży z vertical.yaml (uprawnienia, realizacje, ubezpieczenie itd.) czekają na dane i implementację
  // w lib/ranking.ts.
  rankingWeights: { rejestr: 20, staz: 10, jawnosc_cennika: 12, spojnosc_danych: 6, zakres_uslug: 10, opinie_google: 10 },
  schemaType: "GeneralContractor",
  profileAnchor: "firma",
  trackingContentType: "firma_budowlana",
  catalogView: {
    goals: {},
    filters: {
      podklucz: { label: "Dom pod klucz", group: "turnkey" },
      surowy: { label: "Stan surowy", group: "shell" },
      cennik: { label: "Jawny cennik", group: null },
    },
  },
  serviceGroups: [
    { key: "shell", label: "stan surowy", re: /stan\w* surow|\bsurow/i },
    { key: "turnkey", label: "dom pod klucz", re: /pod klucz|kompleks|generaln/i },
    { key: "developer", label: "stan deweloperski", re: /stan\w* deweloperski/i },
    { key: "timber", label: "domy szkieletowe i drewniane", re: /szkielet|drewnian|prefabryk|modułow/i },
    { key: "masonry", label: "domy murowane", re: /murowan|ceramik|silikat|beton/i },
    { key: "energy", label: "domy energooszczędne", re: /energooszcz|pasywn|niskoenerget/i },
    { key: "design", label: "projekt i kierownik budowy", re: /projekt|kierownik\w* budowy|nadzór/i },
    { key: "finishing", label: "wykończenie wnętrz", re: /wykończ/i },
  ],
  terms: {
    firm: { one: "firma", few: "firmy", many: "firm", genOne: "firmy" },
    phrase: {
      one: "firma budowlana",
      few: "firmy budowlane",
      many: "firm budowlanych",
      genOne: "firmy budowlanej",
      datOne: "firmie budowlanej",
      locPl: "firmach budowlanych",
    },
    domainGen: "budowy domów",
    expert: "wykonawca",
    expertFull: "wykonawca domów",
    synonym: { few: "firmy", gen: "firm" },
    fee: { nom: "cena budowy", nomPl: "ceny budowy", genPl: "robót" },
    company: { one: "firma", few: "firmy", many: "firm" },
  },
  headerCta: "Znajdź firmę",
  forFirms: "Dla firm",
  none: "Żadna z",
  homeHeroLead:
    "Porównaj firmy budowlane w swoim mieście według stażu, jawnych cenników i zakresu usług: stan surowy, stan deweloperski, dom pod klucz. Potem poproś wybraną firmę o wycenę jednym formularzem.",
  priceThing: "budowa domu",
  noRatesTail: "cenę budowy trzeba ustalić bezpośrednio z firmą.",
  contractName: "umowa o roboty budowlane",
  leadCta: "Poproś o wycenę",
  notPartyShort:
    "Nie jesteśmy firmą budowlaną ani generalnym wykonawcą i nie jesteśmy stroną umów, które zawierasz z firmami.",
  notPartyLong:
    "Operator nie wykonuje robót budowlanych i nie jest stroną umów zawieranych między Użytkownikami a Firmami.",
  serviceExamples: "stan surowy, stan deweloperski, dom pod klucz, projekt, kierownik budowy i inne",
  priceSectionHeading: "Ceny budowy i usług",
  leadTopics: {
    kupno: "Budowa domu pod klucz",
    sprzedaz: "Stan surowy domu",
    wynajem: "Stan deweloperski",
    najem: "Dom z projektu indywidualnego",
    wycena: "Wycena budowy",
    inne: "Inna sprawa",
  },
  leadMessage: (topic, where) => {
    switch (topic) {
      case "kupno":
        return `Dzień dobry, planuję budowę domu pod klucz ${where}. Proszę o kontakt i wycenę.`;
      case "sprzedaz":
        return `Dzień dobry, szukam wykonawcy stanu surowego domu ${where}. Proszę o kontakt i wycenę.`;
      case "wynajem":
        return `Dzień dobry, szukam wykonawcy domu w stanie deweloperskim ${where}. Proszę o kontakt i wycenę.`;
      case "najem":
        return `Dzień dobry, mam projekt indywidualny domu i szukam wykonawcy ${where}. Proszę o kontakt i wycenę.`;
      case "wycena":
        return `Dzień dobry, proszę o wycenę budowy domu ${where} i kontakt w tej sprawie.`;
      case "inne":
        return "Dzień dobry, proszę o kontakt w sprawie usług firmy.";
      default:
        return "Dzień dobry, proszę o informacje o usługach i cenniku firmy oraz o kontakt.";
    }
  },
  guide: (c, h) => [
    `Zacznij od zakresu. Stan surowy otwarty lub zamknięty, stan deweloperski i dom pod klucz to różne umowy i różne ryzyka. Zdecyduj, czy chcesz jednego generalnego wykonawcę, czy kilka ekip.${h.groups}`,
    `Poproś o kosztorys na piśmie z podziałem na etapy, materiały i robociznę oraz o harmonogram płatności powiązany z etapami prac. Ceny za metr kwadratowy porównuj tylko wtedy, gdy dotyczą tej samej technologii, standardu i rodzaju powierzchni (użytkowej lub zabudowy). ${h.prices}`,
    `Przeczytaj umowę o roboty budowlane: zakres, termin, kary umowne, zaliczkę, odbiory etapów, gwarancję i rękojmię. Ustal, kto zapewnia kierownika budowy i nadzór oraz kto odpowiada za formalności.`,
    `Zapytaj o ubezpieczenie odpowiedzialności wykonawcy i ubezpieczenie budowy oraz o uprawnienia kadry. Poproś o adresy domów, które firma zbudowała, i porozmawiaj z ich właścicielami.`,
    `Na koniec sprawdź firmę w rejestrze. ${h.registry}`,
  ],
  trust: {
    question: "Jak sprawdzić wiarygodność firmy budowlanej?",
    answer: (c) =>
      `Poproś o NIP i sprawdź go w wykazie podatników VAT lub w KRS, przeczytaj umowę, zapytaj o ubezpieczenie i uprawnienia kadry oraz obejrzyj zrealizowane domy. W naszym katalogu ${
        c.confirmed === c.n ? "wszystkie firmy z tego miasta mają" : `${c.confirmed} z ${c.unitsGen(c.n)} ${c.where} ma`
      } potwierdzenie w rejestrze, oznaczone na profilu.`,
  },
  factors: {
    question: "Od czego zależy koszt budowy domu?",
    answer:
      "Przede wszystkim od powierzchni, technologii (murowana, szkieletowa), stopnia skomplikowania projektu, standardu materiałów, zakresu (stan surowy, deweloperski, pod klucz), warunków gruntowych i lokalizacji. Cena za metr kwadratowy może dotyczyć powierzchni użytkowej albo zabudowy i bywa podawana netto lub brutto, więc zawsze porównuj ten sam zakres.",
  },
  feeNoPrices: (where) =>
    `Firmy ${where} w naszym katalogu nie publikują cen usług, więc koszt trzeba ustalić z wybraną firmą. Poproś o kosztorys na piśmie i sprawdź, co obejmuje oraz czy cena jest netto czy brutto.`,
});
