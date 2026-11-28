/**
 * Portal "Ranking biur nieruchomości": wartości skopiowane 1:1 z dotychczasowego kodu strony (stan sprzed silnika
 * wielu branż), więc strona renderuje się tak samo jak przed wprowadzeniem konfiguracji.
 */
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
  terms: {
    firm: { one: "biuro", few: "biura", many: "biur", genOne: "biura" },
    domainGen: "nieruchomości",
    expert: "pośrednik",
    fee: { nom: "prowizja", nomPl: "prowizje" },
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
