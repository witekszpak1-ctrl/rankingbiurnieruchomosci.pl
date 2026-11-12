import type { Metadata } from "next";
import Link from "next/link";

import { CookieSettingsLink } from "@/components/CookieConsent";
import { OperatorContact, OperatorDetails } from "@/components/LegalOperator";
import { PublicShell } from "@/components/SiteChrome";
import { CONSENT_COOKIE, CONSENT_MAX_AGE_DAYS, LEGAL_EFFECTIVE_DATE, RETENTION_MONTHS, SERVICE_HOST } from "@/lib/legal";
import { SESSION_COOKIE } from "@/lib/session";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Polityka prywatności i plików cookie",
  description:
    "Kto jest administratorem danych w serwisie Ranking Biur Nieruchomości, jakie dane przetwarzamy, w jakim celu, jak długo i jakie masz prawa. Informacje o plikach cookie.",
  path: "/polityka-prywatnosci",
});

export default function PrivacyPolicyPage() {
  return (
    <PublicShell>
      <article className="legal">
        <h1>Polityka prywatności i plików cookie</h1>
        <p className="note">Obowiązuje od {LEGAL_EFFECTIVE_DATE}</p>

        <div className="answer">
          <strong>W skrócie</strong>
          <p>
            Zbieramy tylko dane potrzebne do działania serwisu i formularzy. Nie sprzedajemy danych, nie używamy reklamowych
            plików cookie, a statystyki odwiedzin włączamy dopiero po Twojej zgodzie. Dane z formularzy usuwamy automatycznie
            po upływie okresu przechowywania. W każdej chwili możesz zapytać, jakie dane o Tobie mamy, poprawić je, usunąć albo
            sprzeciwić się ich przetwarzaniu.
          </p>
        </div>

        <h2 id="administrator">1. Administrator danych</h2>
        <p>
          Administratorem danych osobowych przetwarzanych w serwisie {SERVICE_HOST} (dalej: Serwis) jest <OperatorDetails />{" "}
          (dalej: Administrator, my).
        </p>
        <p>
          W sprawach danych osobowych skontaktujesz się z nami przez: <OperatorContact />. Nie wyznaczyliśmy inspektora
          ochrony danych, bo nie wymagają tego przepisy.
        </p>

        <h2 id="dane">2. Jakie dane przetwarzamy, w jakim celu i jak długo</h2>

        <h3>2.1. Korzystanie z Serwisu</h3>
        <p>
          Gdy otwierasz stronę, serwer hostingu automatycznie zapisuje dane techniczne zapytania: adres IP, datę i godzinę,
          adres otwieranej strony, informacje o przeglądarce i systemie (nagłówek User-Agent) oraz kraj ustalony na podstawie
          adresu IP.
        </p>
        <ul className="plain">
          <li>Cel: wyświetlenie strony, zapewnienie bezpieczeństwa, wykrywanie błędów i nadużyć.</li>
          <li>
            Podstawa: art. 6 ust. 1 lit. f RODO, czyli nasz prawnie uzasadniony interes polegający na zapewnieniu działania i
            bezpieczeństwa Serwisu.
          </li>
          <li>Okres: logi przechowuje dostawca hostingu przez krótki czas wynikający z jego ustawień, zwykle kilka dni.</li>
        </ul>
        <p>
          Wejścia programów automatycznych (np. robotów wyszukiwarek i narzędzi sztucznej inteligencji), rozpoznane po
          nagłówku User-Agent, liczymy po stronie serwera w statystykach Serwisu. Zapisujemy wtedy tylko nagłówek User-Agent,
          adres odwiedzonej strony i kraj, bez adresu IP.
        </p>
        <p>
          Zdjęcia i logo firm wyświetlamy przez serwis wsrv.nl (images.weserv.nl), który zmniejsza obrazki, żeby strony
          ładowały się szybciej. Twoja przeglądarka pobiera je wtedy z serwerów tego serwisu, które otrzymują Twój adres IP i
          informacje o przeglądarce. Podstawą jest art. 6 ust. 1 lit. f RODO (sprawne działanie Serwisu).
        </p>

        <h3>2.2. Statystyki odwiedzin (tylko za zgodą)</h3>
        <p>
          Jeśli wyrazisz zgodę w banerze plików cookie (kategoria „Statystyczne”), strona wczyta skrypt statystyk z systemu
          WitekCRM (witekcrm.com). Skrypt zbiera informacje o odsłonach: odwiedzone adresy, źródło wejścia (np. wyszukiwarka
          albo link z innej strony), czas spędzony na stronie oraz podstawowe informacje o przeglądarce i urządzeniu. Narzędzie
          nie zapisuje plików cookie.
        </p>
        <ul className="plain">
          <li>Cel: liczenie odwiedzin, sprawdzanie, które strony są przydatne, i ulepszanie Serwisu.</li>
          <li>
            Podstawa: Twoja zgoda (art. 6 ust. 1 lit. a RODO oraz art. 399 ustawy Prawo komunikacji elektronicznej). Bez zgody
            skrypt w ogóle się nie wczytuje.
          </li>
          <li>Okres: do wycofania zgody, a dane o pojedynczych odsłonach nie dłużej niż 2 lata.</li>
          <li>
            Zgodę wycofasz w każdej chwili w <CookieSettingsLink>ustawieniach plików cookie</CookieSettingsLink> (link
            jest też w stopce każdej strony). Wycofanie zgody nie wpływa na zgodność z prawem przetwarzania przed jej
            wycofaniem.
          </li>
        </ul>

        <h3>2.3. Zapytanie do biura (formularz na profilu biura)</h3>
        <p>
          Gdy wysyłasz zapytanie do biura, przetwarzamy: imię lub imię i nazwisko, adres e-mail, numer telefonu (jeśli go
          podasz), temat i treść wiadomości, wybrane biuro oraz datę wysłania.
        </p>
        <ul className="plain">
          <li>
            Cel: przekazanie zapytania wybranemu biuru nieruchomości, obsługa zapytania i zapobieganie nadużyciom (np. limit
            liczby zapytań wysyłanych z jednego adresu e-mail).
          </li>
          <li>
            Podstawa: Twoja zgoda na przekazanie danych biuru, wyrażona zaznaczeniem pola w formularzu (art. 6 ust. 1 lit. a
            RODO), oraz nasz prawnie uzasadniony interes w zapobieganiu nadużyciom i obronie przed roszczeniami (art. 6 ust. 1
            lit. f RODO).
          </li>
          <li>
            Odbiorca: biuro wybrane w formularzu. Po otrzymaniu zapytania biuro staje się odrębnym administratorem Twoich danych
            i przetwarza je według własnych zasad, w celu odpowiedzi na zapytanie.
          </li>
          <li>
            Okres: {RETENTION_MONTHS.leads} miesięcy od wysłania, potem dane usuwamy automatycznie. Wcześniej usuniemy je na
            Twoje żądanie. Wycofanie zgody nie cofa przekazania danych, które już nastąpiło.
          </li>
        </ul>

        <h3>2.4. Zgłoszenia na stronie „Dla biur”</h3>
        <p>
          Gdy wysyłasz zgłoszenie (korekta danych, usunięcie wpisu, inna sprawa, w tym sprawy dotyczące danych osobowych),
          przetwarzamy: rodzaj zgłoszenia, adres e-mail, NIP firmy (jeśli go podasz), treść zgłoszenia oraz datę wysłania.
        </p>
        <ul className="plain">
          <li>Cel: rozpatrzenie zgłoszenia, odpowiedź i udokumentowanie sposobu załatwienia sprawy.</li>
          <li>
            Podstawa: nasz prawnie uzasadniony interes w obsłudze zgłoszeń dotyczących katalogu (art. 6 ust. 1 lit. f RODO), a
            w przypadku żądań dotyczących danych osobowych obowiązek prawny wynikający z art. 12-22 RODO (art. 6 ust. 1 lit. c
            RODO).
          </li>
          <li>Okres: {RETENTION_MONTHS.requests} miesiące od wysłania, potem dane usuwamy automatycznie.</li>
        </ul>

        <h3>2.5. Zgłoszenie właściciela firmy</h3>
        <p>
          Gdy zgłaszasz, że reprezentujesz firmę z katalogu, przetwarzamy: imię i nazwisko, stanowisko lub rolę w firmie,
          adres e-mail, numer telefonu (jeśli go podasz), NIP firmy, czego dotyczy zgłoszenie i treść wiadomości.
        </p>
        <ul className="plain">
          <li>
            Cel: sprawdzenie, czy reprezentujesz firmę, aktualizacja albo usunięcie wpisu, kontakt w sprawie zgłoszenia.
          </li>
          <li>
            Podstawa: nasz prawnie uzasadniony interes w rzetelności katalogu i kontakcie z firmami (art. 6 ust. 1 lit. f RODO),
            a jeśli zawrzemy umowę, także jej wykonanie (art. 6 ust. 1 lit. b RODO).
          </li>
          <li>Okres: {RETENTION_MONTHS.claims} miesiące od wysłania, potem dane usuwamy automatycznie.</li>
        </ul>

        <h3 id="dane-firm">2.6. Dane firm w katalogu</h3>
        <p>
          Katalog obejmuje biura nieruchomości prowadzone jako spółki i jako jednoosobowe działalności gospodarcze. Dane spółek
          nie są danymi osobowymi. Dane przedsiębiorców będących osobami fizycznymi (np. imię i nazwisko w nazwie firmy, adres
          działalności) już tak. Tych danych nie zbieramy od samych przedsiębiorców, dlatego informujemy o nich tutaj (art. 14
          RODO).
        </p>
        <ul className="plain">
          <li>
            Zakres: nazwa firmy i marki, NIP, REGON, numer KRS, forma prawna, data rozpoczęcia działalności, status VAT, adres
            siedziby lub miejsca wykonywania działalności (u osób fizycznych bez wpisanego adresu działalności tylko miejscowość
            i kod pocztowy), adres strony internetowej, dane kontaktowe opublikowane przez firmę na jej stronie (telefon,
            firmowy adres e-mail, profile w mediach społecznościowych), informacje o usługach, cenach i prowizjach, tytuły, ceny
            i linki do ofert nieruchomości, zdjęcia i logo ze strony firmy, ocena i opinie z Google, opis przygotowany na
            podstawie tych danych oraz wynik w rankingu.
          </li>
          <li>
            Czego nie zbieramy: numerów PESEL, danych przedstawicieli i wspólników z rejestrów, numerów rachunków bankowych ani
            adresów e-mail wyglądających na prywatne adresy pracowników.
          </li>
          <li>
            Źródła: rejestry publiczne (Krajowy Rejestr Sądowy i wykaz podatników VAT prowadzony przez Ministra Finansów),
            strona internetowa firmy, Google (oficjalne Places API) oraz wyniki wyszukiwarek internetowych.
          </li>
          <li>
            Cel: prowadzenie publicznie dostępnego katalogu i rankingu biur nieruchomości, który pomaga konsumentom porównać
            biura i wybrać jedno z nich, oraz aktualizacja wpisów.
          </li>
          <li>
            Podstawa: nasz prawnie uzasadniony interes oraz interes użytkowników w dostępie do rzetelnych informacji o
            przedsiębiorcach działających na rynku (art. 6 ust. 1 lit. f RODO). Korzystamy wyłącznie z danych, które firmy
            same publikują albo które są jawne w rejestrach.
          </li>
          <li>
            Okres: przez czas obecności firmy w katalogu. Wpis usuwamy po skutecznym sprzeciwie, po zakończeniu działalności
            albo gdy firma przestaje spełniać kryteria katalogu. Kopie zapasowe bazy danych nadpisują się w ciągu kilku dni.
          </li>
          <li>
            Opisy firm przygotowujemy z pomocą narzędzi sztucznej inteligencji (model Claude firmy Anthropic). Przekazujemy im
            wyłącznie dane firmowe ze stron i rejestrów, z usuniętymi numerami telefonów i adresami e-mail. Każdy opis jest
            automatycznie sprawdzany, czy opiera się na faktach ze źródeł.
          </li>
          <li>
            Jeśli prowadzisz biuro z katalogu, możesz poprosić o korektę albo usunięcie wpisu i sprzeciwić się przetwarzaniu
            danych przez stronę <Link href="/dla-firm">Dla biur</Link>.
          </li>
        </ul>

        <h3>2.7. Opinie z Google</h3>
        <p>
          Na profilach firm pokazujemy ocenę i wybrane opinie z Map Google, pobrane przez oficjalne Places API: nazwę autora
          (tak jak jest widoczna w Google), ocenę, treść, datę i link do profilu autora w Google.
        </p>
        <ul className="plain">
          <li>
            Podstawa: nasz prawnie uzasadniony interes w informowaniu o opiniach klientów, z oznaczeniem źródła (art. 6 ust. 1
            lit. f RODO).
          </li>
          <li>
            Okres: opinie regularnie odświeżamy. Opinia usunięta lub zmieniona w Google zmienia się u nas przy kolejnym
            odświeżeniu.
          </li>
          <li>
            Jeśli jesteś autorem opinii i nie chcesz, żebyśmy ją pokazywali, napisz do nas. Opinię możesz też usunąć w Google.
          </li>
        </ul>

        <h2 id="odbiorcy">3. Komu powierzamy lub przekazujemy dane</h2>
        <p>
          Dane przetwarzają w naszym imieniu dostawcy usług technicznych, na podstawie umów powierzenia lub warunków
          przetwarzania danych tych dostawców. Każdy z nich ma dostęp tylko do danych potrzebnych do swojej usługi.
        </p>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Odbiorca</th>
                <th>Do czego</th>
                <th>Gdzie</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Vercel Inc.</td>
                <td>hosting Serwisu i logi serwera</td>
                <td>serwery we Frankfurcie (UE), firma z USA</td>
              </tr>
              <tr>
                <td>Neon, Inc.</td>
                <td>baza danych katalogu i formularzy</td>
                <td>serwery we Frankfurcie (UE), firma z USA</td>
              </tr>
              <tr>
                <td>GitHub, Inc. (Microsoft)</td>
                <td>kod Serwisu i automatyczne zadania aktualizujące dane firm w katalogu</td>
                <td>USA</td>
              </tr>
              <tr>
                <td>Anthropic, PBC</td>
                <td>przygotowanie opisów firm (dane firmowe bez telefonów i adresów e-mail)</td>
                <td>USA</td>
              </tr>
              <tr>
                <td>Google (Places API)</td>
                <td>wyszukanie firmy w Mapach Google oraz pobranie oceny i opinii</td>
                <td>UE i USA</td>
              </tr>
              <tr>
                <td>wsrv.nl (images.weserv.nl)</td>
                <td>zmniejszanie i wyświetlanie zdjęć firm (adres IP przeglądarki)</td>
                <td>Holandia, sieć serwerów na świecie</td>
              </tr>
              <tr>
                <td>WitekCRM (witekcrm.com)</td>
                <td>statystyki odwiedzin, tylko po wyrażeniu zgody</td>
                <td>według ustawień systemu</td>
              </tr>
              <tr>
                <td>Biuro wybrane w formularzu zapytania</td>
                <td>odpowiedź na Twoje zapytanie (jako odrębny administrator)</td>
                <td>Polska</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Dane możemy też przekazać sądom, organom ścigania i innym organom publicznym, gdy wymagają tego przepisy. Nie
          sprzedajemy danych i nie udostępniamy ich w celach reklamowych.
        </p>

        <h2 id="poza-eog">4. Przekazywanie danych poza Europejski Obszar Gospodarczy</h2>
        <p>
          Część dostawców ma siedzibę w USA. Przekazanie danych do USA odbywa się na podstawie decyzji Komisji Europejskiej
          stwierdzającej odpowiedni stopień ochrony (EU-US Data Privacy Framework) w przypadku firm, które przystąpiły do tego
          programu, albo na podstawie standardowych klauzul umownych zatwierdzonych przez Komisję Europejską (art. 46 ust. 2
          lit. c RODO). Kopię zabezpieczeń możesz otrzymać, kontaktując się z nami.
        </p>

        <h2 id="cookies">5. Pliki cookie i podobne technologie</h2>
        <p>
          Pliki cookie to małe pliki zapisywane w przeglądarce. Używamy ich jak najmniej. Nie stosujemy plików cookie
          reklamowych ani śledzących między stronami. Czcionki wczytujemy z naszego serwera, a nie z serwerów Google.
        </p>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Nazwa</th>
                <th>Cel</th>
                <th>Rodzaj</th>
                <th>Czas</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="mono">{CONSENT_COOKIE}</td>
                <td>zapamiętuje Twój wybór w banerze plików cookie</td>
                <td>niezbędny, własny</td>
                <td>{Math.round(CONSENT_MAX_AGE_DAYS / 30.4)} miesięcy</td>
              </tr>
              <tr>
                <td className="mono">{SESSION_COOKIE}</td>
                <td>logowanie do panelu administracyjnego (tylko dla obsługi Serwisu)</td>
                <td>niezbędny, własny</td>
                <td>12 godzin</td>
              </tr>
              <tr>
                <td>skrypt statystyk WitekCRM</td>
                <td>liczenie odwiedzin (opis w punkcie 2.2)</td>
                <td>statystyczny, zewnętrzny, tylko po zgodzie</td>
                <td>nie zapisuje plików cookie</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Pliki niezbędne są potrzebne do działania Serwisu i nie wymagają zgody (art. 399 ust. 3 ustawy Prawo komunikacji
          elektronicznej). Na pozostałe pytamy o zgodę w banerze przy pierwszej wizycie. Swój wybór zmienisz w każdej chwili
          w <CookieSettingsLink>ustawieniach plików cookie</CookieSettingsLink>. Pliki cookie możesz też usunąć albo
          zablokować w ustawieniach przeglądarki, ale wtedy Serwis zapyta o zgodę ponownie.
        </p>

        <h2 id="prawa">6. Twoje prawa</h2>
        <ul className="plain">
          <li>dostęp do swoich danych i otrzymanie ich kopii (art. 15 RODO),</li>
          <li>sprostowanie nieprawidłowych danych (art. 16 RODO),</li>
          <li>usunięcie danych (art. 17 RODO),</li>
          <li>ograniczenie przetwarzania (art. 18 RODO),</li>
          <li>przeniesienie danych przetwarzanych na podstawie zgody lub umowy (art. 20 RODO),</li>
          <li>
            sprzeciw wobec przetwarzania opartego na naszym prawnie uzasadnionym interesie, z przyczyn związanych z Twoją
            szczególną sytuacją (art. 21 RODO); po sprzeciwie przestajemy przetwarzać dane, chyba że wykażemy ważne prawnie
            uzasadnione podstawy nadrzędne wobec Twoich interesów albo podstawy do obrony roszczeń,
          </li>
          <li>wycofanie zgody w dowolnym momencie, bez wpływu na zgodność z prawem przetwarzania przed jej wycofaniem,</li>
          <li>
            skarga do Prezesa Urzędu Ochrony Danych Osobowych (ul. Stawki 2, 00-193 Warszawa, uodo.gov.pl), jeśli uważasz, że
            przetwarzamy dane niezgodnie z prawem.
          </li>
        </ul>
        <p>
          Żądanie wyślesz przez: <OperatorContact />. Odpowiemy bez zbędnej zwłoki, najpóźniej w ciągu miesiąca. W
          skomplikowanych sprawach termin może się wydłużyć o kolejne dwa miesiące, o czym Cię poinformujemy. Jeśli nie
          będziemy pewni, że żądanie pochodzi od Ciebie, poprosimy o dodatkowe potwierdzenie tożsamości.
        </p>

        <h2 id="dobrowolnosc">7. Czy musisz podać dane</h2>
        <p>
          Podanie danych w formularzach jest dobrowolne, ale bez danych oznaczonych jako wymagane nie przekażemy zapytania ani
          nie rozpatrzymy zgłoszenia. Do przeglądania Serwisu nie musisz podawać żadnych danych.
        </p>

        <h2 id="automatyzacja">8. Zautomatyzowane decyzje i profilowanie</h2>
        <p>
          Wynik firmy w rankingu obliczamy automatycznie według jawnych zasad opisanych w{" "}
          <Link href="/metodologia">metodologii</Link>. Ocena dotyczy działalności firmy i wpływa wyłącznie na kolejność
          prezentacji biur w Serwisie. Nie podejmujemy wobec osób decyzji opartych wyłącznie na zautomatyzowanym
          przetwarzaniu, które wywołują skutki prawne lub w podobny sposób istotnie na nie wpływają (art. 22 RODO).
        </p>

        <h2 id="bezpieczenstwo">9. Bezpieczeństwo</h2>
        <p>
          Połączenie z Serwisem jest szyfrowane (HTTPS). Dostęp do danych z formularzy ma tylko obsługa Serwisu po
          zalogowaniu. Ograniczamy zakres danych do niezbędnego minimum, a dane, których już nie potrzebujemy, usuwamy
          automatycznie.
        </p>

        <h2 id="zmiany">10. Zmiany polityki prywatności</h2>
        <p>
          Politykę aktualizujemy, gdy zmieniają się przepisy, sposób działania Serwisu albo nasi dostawcy. Nowa wersja
          obowiązuje od dnia publikacji na tej stronie. Jeśli zmiana będzie dotyczyć zgody na pliki cookie, zapytamy o zgodę
          ponownie. Zasady korzystania z Serwisu opisuje <Link href="/regulamin">Regulamin</Link>.
        </p>
      </article>
    </PublicShell>
  );
}
