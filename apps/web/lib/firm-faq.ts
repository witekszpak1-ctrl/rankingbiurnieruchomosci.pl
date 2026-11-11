/**
 * Pytania i odpowiedzi na profilu biura, złożone wyłącznie z danych, które mamy (bez wymyślania).
 * Pytanie bez danych do odpowiedzi pomijamy, zamiast pisać ogólniki.
 */
import { inCity } from "./cities";
import { formatPhone, formatPrice } from "./format";
import { nLat, offersLabel } from "./plural";
import { priceBasis } from "./prices";
import type { FaqItem } from "./city-content";

export type FirmFaqInput = {
  name: string;
  cityName: string;
  address: string | null;
  phone: string | null;
  services: string[];
  prices: { service: string; unit: "percent" | "pln" | "pln_per_month" | "other" | null; amountMin: number | null; amountMax: number | null; taxMode: "net" | "gross" | "plus_vat" | "unknown" | null }[];
  registryConfirmed: boolean;
  registryYears: number | null;
  offersCount: number;
  score: number;
  position: number | null;
  cityCount: number | null;
};

export function firmFaq(f: FirmFaqInput): FaqItem[] {
  const where = inCity(f.cityName);
  const faq: FaqItem[] = [];
  if (f.services.length > 0) {
    const list = f.services.slice(0, 6).join(", ");
    faq.push({
      q: `Czym zajmuje się ${f.name}?`,
      a: `${f.name} to biuro nieruchomości ${where}. Na swojej stronie wymienia m.in.: ${list}${f.services.length > 6 ? " i inne usługi" : ""}.`,
    });
  }
  faq.push({
    q: `Gdzie działa ${f.name}?`,
    a: f.address ? `Biuro ma siedzibę pod adresem ${f.address}. W naszym katalogu jest w zestawieniu biur nieruchomości ${where}.` : `W naszym katalogu ${f.name} jest w zestawieniu biur nieruchomości ${where}. Dokładnego adresu biuro nie podaje na swojej stronie.`,
  });
  faq.push({
    q: `Ile wynosi prowizja w ${f.name}?`,
    a:
      f.prices.length > 0
        ? `Według cennika na stronie biura: ${f.prices
            .slice(0, 3)
            .map((p) => `${p.service}: ${formatPrice(p)}${priceBasis(p) ? ` ${priceBasis(p)}` : ""}`)
            .join("; ")}. Ostateczne wynagrodzenie określa umowa pośrednictwa.`
        : `${f.name} nie publikuje stawek prowizji na swojej stronie, więc wysokość wynagrodzenia trzeba ustalić bezpośrednio z biurem.`,
  });
  faq.push({
    q: `Czy ${f.name} jest firmą wpisaną do rejestru?`,
    a: f.registryConfirmed
      ? `Tak. NIP ze strony biura zgadza się z rejestrem publicznym (KRS lub wykaz podatników VAT)${f.registryYears ? `, a firma jest w rejestrze od ${nLat(f.registryYears)}` : ""}.`
      : `Nie udało się tego potwierdzić: strona biura nie podaje NIP albo dane nie zgadzają się z rejestrem. Przed podpisaniem umowy poproś o NIP i sprawdź go w wykazie podatników VAT.`,
  });
  if (f.offersCount > 0) {
    faq.push({
      q: `Czy ${f.name} ma aktualne oferty?`,
      a: `Tak, przy ostatnim sprawdzeniu na stronie biura było ${offersLabel(f.offersCount).replace(" na stronie", "")}. Najnowsze z nich pokazujemy na tym profilu z linkami do strony biura.`,
    });
  }
  faq.push({
    q: `Jak ${f.name} wypada w rankingu?`,
    a:
      f.position && f.cityCount
        ? `W rankingu biur nieruchomości ${where} ${f.name} zajmuje ${f.position}. miejsce na ${f.cityCount} z wynikiem ${f.score}/100. Wynik liczymy według jawnej metodologii, a nie z opinii klientów.`
        : `${f.name} ma wynik ${f.score}/100 według jawnej metodologii katalogu.`,
  });
  faq.push({
    q: `Jak skontaktować się z ${f.name}?`,
    a: f.phone
      ? `Telefon biura: ${formatPhone(f.phone)}. Możesz też wysłać zapytanie przez formularz na tej stronie.`
      : "Wyślij zapytanie przez formularz na tej stronie, a przekażemy je do biura.",
  });
  return faq.slice(0, 7);
}
