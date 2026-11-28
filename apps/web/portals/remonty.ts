/**
 * Portal nr 4: firmy remontowe i wykończeniowe. "Odnowa Domu" to nazwa robocza, domena: TBD (decyzja właściciela).
 * Dane: branża "remonty" w bazie (listings.vertical_id). Typ schema.org: GeneralContractor.
 */
import { servicePortal } from "./service-portal";

export const remonty = servicePortal({
  slug: "remonty",
  brand: "Odnowa Domu",
  descriptor: "firmy remontowe i wykończeniowe",
  shortName: "OD",
  schemaType: "GeneralContractor",
  profileAnchor: "firma",
  trackingContentType: "firma_remontowa",
  catalogView: {
    goals: {},
    filters: {
      lazienki: { label: "Remonty łazienek", group: "bath" },
      podklucz: { label: "Wykończenie pod klucz", group: "turnkey" },
      cennik: { label: "Jawny cennik", group: null },
    },
  },
  serviceGroups: [
    { key: "turnkey", label: "remonty i wykończenie pod klucz", re: /pod klucz|kompleks|generaln/i },
    { key: "bath", label: "remonty łazienek", re: /łazienk|prysznic/i },
    { key: "kitchen", label: "remonty kuchni", re: /kuchn/i },
    { key: "paint", label: "gładzie i malowanie", re: /malow|gładz|tynk|szpachl/i },
    { key: "floors", label: "podłogi i płytki", re: /płytk|podłog|parkiet|panel\w* podłog|posadzk|terakot/i },
    { key: "install", label: "instalacje", re: /instalac|elektryk|hydraul|wod-kan/i },
    { key: "carpentry", label: "stolarka i zabudowy", re: /stolark|okn|drzwi|zabudow/i },
    { key: "developer", label: "wykończenie mieszkań deweloperskich", re: /deweloper/i },
  ],
  terms: {
    firm: { one: "firma", few: "firmy", many: "firm", genOne: "firmy" },
    phrase: {
      one: "firma remontowa",
      few: "firmy remontowe",
      many: "firm remontowych",
      genOne: "firmy remontowej",
      datOne: "firmie remontowej",
      locPl: "firmach remontowych",
    },
    domainGen: "remontów",
    expert: "wykonawca",
    expertFull: "wykonawca remontów",
    synonym: { few: "firmy", gen: "firm" },
    fee: { nom: "cena remontu", nomPl: "ceny remontów", genPl: "robocizny" },
    company: { one: "firma", few: "firmy", many: "firm" },
  },
  headerCta: "Znajdź firmę",
  forFirms: "Dla firm",
  none: "Żadna z",
  homeHeroLead:
    "Porównaj firmy remontowe w swoim mieście według stażu, jawnych cenników i zakresu usług: remonty mieszkań, łazienek, wykończenie pod klucz. Potem poproś wybraną firmę o wycenę jednym formularzem.",
  priceThing: "remont mieszkania",
  noRatesTail: "cenę remontu trzeba ustalić bezpośrednio z firmą.",
  contractName: "umowa o wykonanie remontu",
  leadCta: "Poproś o wycenę",
  notPartyShort:
    "Nie jesteśmy firmą remontową ani wykonawcą robót i nie jesteśmy stroną umów, które zawierasz z firmami.",
  notPartyLong:
    "Operator nie wykonuje remontów ani robót budowlanych i nie jest stroną umów zawieranych między Użytkownikami a Firmami.",
  serviceExamples: "remonty mieszkań i łazienek, malowanie, podłogi, wykończenie pod klucz i inne",
  priceSectionHeading: "Ceny remontów i usług",
  leadTopics: {
    kupno: "Remont mieszkania",
    sprzedaz: "Remont łazienki",
    wynajem: "Remont kuchni",
    najem: "Wykończenie pod klucz",
    wycena: "Wycena remontu",
    inne: "Inna sprawa",
  },
  leadMessage: (topic, where) => {
    switch (topic) {
      case "kupno":
        return `Dzień dobry, planuję remont mieszkania ${where}. Proszę o kontakt i wycenę.`;
      case "sprzedaz":
        return `Dzień dobry, planuję remont łazienki ${where}. Proszę o kontakt i wycenę.`;
      case "wynajem":
        return `Dzień dobry, planuję remont kuchni ${where}. Proszę o kontakt i wycenę.`;
      case "najem":
        return `Dzień dobry, szukam firmy do wykończenia mieszkania pod klucz ${where}. Proszę o kontakt i wycenę.`;
      case "wycena":
        return `Dzień dobry, proszę o wycenę remontu ${where} i kontakt w tej sprawie.`;
      case "inne":
        return "Dzień dobry, proszę o kontakt w sprawie usług firmy.";
      default:
        return "Dzień dobry, proszę o informacje o usługach i cenniku firmy oraz o kontakt.";
    }
  },
  guide: (c, h) => [
    `Zacznij od zakresu prac. Remont łazienki, malowanie z gładziami i wykończenie mieszkania pod klucz to różne usługi, często wykonywane przez różne ekipy.${h.groups}`,
    `Poproś o wycenę na piśmie z podziałem na robociznę i materiały, zakresem prac i harmonogramem. Ceny bywają podawane za metr kwadratowy, za zakres albo za godzinę, więc porównuj oferty o tym samym zakresie. ${h.prices} Sprawdź, czy kwota jest netto czy brutto i jak liczone są prace dodatkowe.`,
    `Przeczytaj umowę przed podpisaniem: zakres, termin, zaliczkę i harmonogram płatności, sposób odbioru prac (protokół), gwarancję i odpowiedzialność za szkody. Ustal płatności tak, by nie opłacać z góry całości.`,
    `Poproś o zdjęcia lub adresy podobnych realizacji i o referencje. Ustal, kto kupuje materiały, kto jest Twoim stałym kontaktem i jak ekipa reaguje na poprawki. Zapytaj też o ubezpieczenie odpowiedzialności wykonawcy.`,
    `Na koniec sprawdź firmę w rejestrze. ${h.registry}`,
  ],
  trust: {
    question: "Jak sprawdzić wiarygodność firmy remontowej?",
    answer: (c) =>
      `Poproś o NIP i sprawdź go w wykazie podatników VAT lub w KRS, przeczytaj umowę, zapytaj o gwarancję i ubezpieczenie oraz poproś o adresy zrealizowanych remontów. W naszym katalogu ${
        c.confirmed === c.n ? "wszystkie firmy z tego miasta mają" : `${c.confirmed} z ${c.unitsGen(c.n)} ${c.where} ma`
      } potwierdzenie w rejestrze, oznaczone na profilu.`,
  },
  factors: {
    question: "Od czego zależy cena remontu?",
    answer:
      "Najczęściej od metrażu i stanu lokalu, zakresu prac (łazienka, kuchnia, pełne wykończenie), standardu materiałów, instalacji do wymiany i dostępności ekipy. Cena bywa podawana za metr kwadratowy, za zakres albo za godzinę, netto albo brutto, z materiałami lub bez nich.",
  },
  feeNoPrices: (where) =>
    `Firmy ${where} w naszym katalogu nie publikują cen usług, więc koszt trzeba ustalić z wybraną firmą. Poproś o wycenę na piśmie i sprawdź, czy zawiera materiały, robociznę i VAT.`,
});
