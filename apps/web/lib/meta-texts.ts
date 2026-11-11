/**
 * Tytuły i opisy stron (SEO) jako czyste funkcje, żeby dało się je testować bez bazy.
 * Wszystkie liczby pochodzą z aktualnych danych; nie wpisujemy ocen ani opłat, których nie ma w danych.
 */
import { inCity } from "./cities";
import { nBiur } from "./plural";

export function homeMeta(year: number, firms: number, cities: number) {
  return {
    title: `Ranking biur nieruchomości w Polsce ${year} | Porównaj biura`,
    description:
      firms > 0
        ? `Niezależny ranking biur nieruchomości w Polsce: ${nBiur(firms)} w ${cities} ${cities === 1 ? "mieście" : "miastach"}. Porównaj agencje, prowizje, zakres usług i dane z rejestrów w swoim mieście.`
        : "Niezależny ranking biur nieruchomości w Polsce. Porównaj agencje, prowizje, zakres usług i dane z rejestrów w swoim mieście.",
  };
}

export function cityMeta(cityName: string, year: number, count: number, ranked: boolean, withPrices: number) {
  const where = inCity(cityName);
  if (!ranked) {
    return {
      title: `Biura nieruchomości ${cityName} | ${nBiur(count)} w katalogu`,
      description: `${nBiur(count).replace(/^./, (c) => c.toUpperCase())} nieruchomości ${where} w katalogu. Sprawdź zakres usług, prowizje, oferty i dane kontaktowe agencji.`,
    };
  }
  const prices = withPrices > 0 ? " prowizje," : "";
  return {
    title: `Ranking biur nieruchomości ${cityName} ${year} | ${nBiur(count)}`,
    description: `Ranking ${nBiur(count)} nieruchomości ${where}. Porównaj wyniki,${prices} zakres usług, oferty i doświadczenie agencji w niezależnym zestawieniu.`,
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
  const nameHasCity = input.name.toLocaleLowerCase("pl").includes(input.cityName.toLocaleLowerCase("pl"));
  const head = nameHasCity ? input.name : `${input.name} ${input.cityName}`;
  const tail = [input.hasGoogle ? "Opinie" : null, input.hasPrices ? "prowizje" : "usługi", "ranking"].filter(Boolean).join(", ");
  const facts = [
    `wynik ${input.score}/100 w rankingu`,
    input.hasPrices ? "prowizje" : null,
    "zakres usług",
    input.offers > 0 ? "aktualne oferty" : null,
    "dane kontaktowe biura",
  ].filter(Boolean);
  return {
    title: `${head} | ${tail.charAt(0).toUpperCase()}${tail.slice(1)}`,
    description: `Biuro nieruchomości ${input.name} ${inCity(input.cityName)}. Sprawdź ${facts.slice(0, -1).join(", ")} i ${facts.at(-1)}.`,
  };
}
