/**
 * Tytuły i opisy stron (SEO) jako czyste funkcje, żeby dało się je testować bez bazy.
 * Wszystkie liczby pochodzą z aktualnych danych; nie wpisujemy ocen ani opłat, których nie ma w danych.
 */
import { inCity } from "./cities";
import { nBiur } from "./plural";
import { capitalize, currentPortal, firmPhrase, nFirmPhrase } from "./portal";
import { unitForms } from "./unit";

export function homeMeta(year: number, firms: number, cities: number) {
  const { terms } = currentPortal();
  const plural = firmPhrase("many");
  return {
    title: `Ranking ${plural} w Polsce ${year} | Porównaj ${terms.firm.few}`,
    description:
      firms > 0
        ? `Niezależny ranking ${plural} w Polsce: ${nBiur(firms)} w ${cities} ${cities === 1 ? "mieście" : "miastach"}. Porównaj ${terms.synonym.few}, ${terms.fee.nomPl}, zakres usług i dane z rejestrów w swoim mieście.`
        : `Niezależny ranking ${plural} w Polsce. Porównaj ${terms.synonym.few}, ${terms.fee.nomPl}, zakres usług i dane z rejestrów w swoim mieście.`,
  };
}

export function cityMeta(cityName: string, year: number, count: number, ranked: boolean, withPrices: number) {
  const where = inCity(cityName);
  const { terms, features } = currentPortal();
  const offers = features.offers;
  if (!ranked) {
    return {
      title: `${capitalize(firmPhrase("few"))} ${cityName} | ${nBiur(count)} w katalogu`,
      description: `${nFirmPhrase(count).replace(/^./, (c) => c.toUpperCase())} ${where} w katalogu. Sprawdź zakres usług, ${terms.fee.nomPl}${offers ? ", oferty" : ""} i dane kontaktowe ${terms.synonym.gen}.`,
    };
  }
  const prices = withPrices > 0 ? ` ${terms.fee.nomPl},` : "";
  return {
    title: `Ranking ${firmPhrase("many")} ${cityName} ${year} | ${nBiur(count)}`,
    description: `Ranking ${nFirmPhrase(count)} ${where}. Porównaj wyniki,${prices} zakres usług${offers ? ", oferty" : ""} i doświadczenie ${terms.synonym.gen} w niezależnym zestawieniu.`,
  };
}

export function firmMeta(input: {
  name: string;
  cityName: string;
  score: number;
  hasGoogle: boolean;
  hasPrices: boolean;
  offers: number;
}) {
  const { terms, features } = currentPortal();
  const nameHasCity = input.name.toLocaleLowerCase("pl").includes(input.cityName.toLocaleLowerCase("pl"));
  const head = nameHasCity ? input.name : `${input.name} ${input.cityName}`;
  const tail = [input.hasGoogle ? "Opinie" : null, input.hasPrices ? terms.fee.nomPl : "usługi", "ranking"].filter(Boolean).join(", ");
  const facts = [
    `wynik ${input.score}/100 w rankingu`,
    input.hasPrices ? terms.fee.nomPl : null,
    "zakres usług",
    input.offers > 0 && features.offers ? "aktualne oferty" : null,
    `dane kontaktowe ${unitForms().sg.gen}`,
  ].filter(Boolean);
  return {
    title: `${head} | ${tail.charAt(0).toUpperCase()}${tail.slice(1)}`,
    description: `${capitalize(firmPhrase("one"))} ${input.name} ${inCity(input.cityName)}. Sprawdź ${facts.slice(0, -1).join(", ")} i ${facts.at(-1)}.`,
  };
}
