import type { Metadata } from "next";
import Link from "next/link";

import { PublicShell } from "@/components/SiteChrome";
import { CITY_RANKING_MIN, PARAMETERS, PRICE_STAT_MIN } from "@/lib/ranking";

export const metadata: Metadata = {
  title: "Metodologia rankingu",
  description: "Jak zbieramy dane o biurach nieruchomości, jak je weryfikujemy i jak liczymy wynik w rankingu.",
  alternates: { canonical: "/metodologia" },
};

export default function MethodologyPage() {
  const total = PARAMETERS.reduce((sum, p) => sum + p.weight, 0);
  return (
    <PublicShell>
      <h1>Metodologia rankingu</h1>
      <div className="answer">
        <strong>W skrócie</strong>
        <p>
          Do katalogu trafiają biura nieruchomości z własną stroną internetową. Biura, których NIP ze strony zgadza się
          z rejestrem publicznym, oznaczamy jako potwierdzone. Biura bez takiego potwierdzenia (najczęściej brak NIP na
          stronie) też publikujemy, ale z wyraźnym oznaczeniem i niżej w rankingu. Wynik liczymy z mierzalnych parametrów
          ze strony firmy i rejestrów. Płatność nie wpływa na pozycję. Wersja metodologii: v0.1.
        </p>
      </div>

      <h2>Skąd bierzemy dane</h2>
      <ul className="plain">
        <li>Rejestry publiczne: KRS (Ministerstwo Sprawiedliwości) i wykaz podatników VAT (Ministerstwo Finansów).</li>
        <li>Oficjalna strona internetowa firmy: dane kontaktowe, zakres usług, cennik.</li>
      </ul>
      <p>
        Nie kopiujemy opinii z innych serwisów i nie streszczamy cudzych ocen. Opisy firm powstają z faktów zapisanych ze
        źródeł, a każdy fakt ma adres źródła i datę pobrania.
      </p>

      <h2>Weryfikacja wpisu</h2>
      <ol>
        <li>Znajdujemy kandydata na oficjalną stronę i odrzucamy katalogi, portale ogłoszeniowe, artykuły i strony niezwiązane z branżą.</li>
        <li>Odczytujemy z niej NIP i sprawdzamy go w rejestrach (suma kontrolna, status podmiotu, nazwa, adres).</li>
        <li>
          Gdy NIP ze strony zgadza się z rejestrem, biuro jest oznaczone jako potwierdzone w rejestrze. Firmy wykreślone
          lub nieaktywne w rejestrze odrzucamy.
        </li>
        <li>
          Gdy strona nie podaje NIP albo dane nie zgadzają się z rejestrem, biuro publikujemy z oznaczeniem „bez
          potwierdzenia w rejestrze”. Nie dostaje wtedy punktów za potwierdzenie w rejestrze ani za staż, a jego opis
          opiera się wyłącznie na stronie biura.
        </li>
        <li>Każdy wpis ma opis napisany od nowa z faktów ze strony biura, sprawdzony automatycznie (cytaty, źródła, brak kopiowania).</li>
      </ol>

      <h2>Parametry rankingu</h2>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Parametr</th>
              <th>Co oceniamy</th>
              <th className="num">Waga</th>
            </tr>
          </thead>
          <tbody>
            {PARAMETERS.map((p) => (
              <tr key={p.key}>
                <td>{p.label}</td>
                <td>{p.description}</td>
                <td className="num">{p.weight}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Wynik to średnia ważona parametrów, przeliczona na skalę 0-100. Jeśli dla danej firmy nie mamy danych do któregoś
        parametru, pomijamy go, a wagi pozostałych przeliczamy proporcjonalnie (suma wag: {total}). Planujemy dodać
        kolejne parametry (m.in. skalę działalności, potwierdzone ubezpieczenie OC, własne zweryfikowane opinie klientów).
        Każda zmiana wag lub parametrów będzie opisana tutaj z datą.
      </p>

      <h2>Oferty nieruchomości</h2>
      <p>
        Codziennie pobieramy oferty widoczne na stronie biura, najwyżej 20 najnowszych. Liczba na profilu to liczba ofert
        pobranych przez robota, a nie całkowita liczba ofert biura; przy pełnej próbce piszemy „co najmniej 20”.
        Lokalizacja nieruchomości wynika z treści ogłoszenia, a nie z adresu biura.
      </p>

      <h2>Kiedy publikujemy ranking</h2>
      <p>
        Ranking z pozycjami pokazujemy, gdy w mieście jest co najmniej {CITY_RANKING_MIN} biur w katalogu. Dla
        mniejszej liczby publikujemy listę w kolejności alfabetycznej, bo pozycje przy trzech firmach niewiele mówią.
      </p>

      <h2>Ceny i statystyki</h2>
      <p>
        Ceny to wartości deklarowane przez firmy na ich stronach, zapisane z cytatem i datą. Mogły się zmienić po
        dacie pobrania. Medianę prowizji od sprzedaży liczymy tylko ze stawek procentowych za sprzedaż lub kupno (bez opłat
        za najem i zarządzanie najmem), po jednej stawce na biuro, i pomijamy wartości spoza przedziału 0,5-10%, które
        zwykle są błędnym odczytem. Statystyki miasta publikujemy, gdy mamy co najmniej {PRICE_STAT_MIN} takie stawki, i
        zawsze podajemy liczbę biur, na których się opierają. Tryb VAT (netto, brutto, + VAT) pokazujemy tak, jak podaje
        go biuro.
      </p>

      <h2>Niezależność i reklama</h2>
      <p>
        Pozycja w rankingu nie zależy od płatności. Treści sponsorowane będą wyraźnie oznaczone i oddzielone od rankingu.
        Szczegóły: <Link href="/reklama">Reklama i niezależność</Link>.
      </p>

      <h2>Błąd w danych?</h2>
      <p>
        Jeśli widzisz nieprawidłowe dane albo chcesz usunięcia wpisu, zobacz <Link href="/dla-firm">stronę dla firm</Link>.
      </p>
    </PublicShell>
  );
}
