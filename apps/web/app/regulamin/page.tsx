import type { Metadata } from "next";
import Link from "next/link";

import { OperatorContact, OperatorDetails } from "@/components/LegalOperator";
import { PublicShell } from "@/components/SiteChrome";
import { LEGAL_EFFECTIVE_DATE, SERVICE_HOST } from "@/lib/legal";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Regulamin serwisu",
  description:
    "Zasady korzystania z serwisu Ranking Biur Nieruchomości: usługi, wymagania techniczne, ranking i opinie, formularze, reklamacje i odpowiedzialność.",
  path: "/regulamin",
});

export default function TermsPage() {
  return (
    <PublicShell>
      <article className="legal">
        <h1>Regulamin serwisu</h1>
        <p className="note">Obowiązuje od {LEGAL_EFFECTIVE_DATE}</p>

        <div className="answer">
          <strong>W skrócie</strong>
          <p>
            Serwis jest bezpłatnym katalogiem i rankingiem biur nieruchomości. Dane pochodzą z rejestrów publicznych, ze stron
            biur i z Google. Pozycja w rankingu nie zależy od płatności. Nie jesteśmy pośrednikiem w obrocie nieruchomościami i
            nie jesteśmy stroną umów, które zawierasz z biurami.
          </p>
        </div>

        <h2 id="p1">§ 1. Postanowienia ogólne</h2>
        <ol>
          <li>
            Regulamin określa zasady korzystania z serwisu internetowego {SERVICE_HOST} (dalej: Serwis) i jest regulaminem, o
            którym mowa w art. 8 ustawy z dnia 18 lipca 2002 r. o świadczeniu usług drogą elektroniczną.
          </li>
          <li>
            Serwis prowadzi <OperatorDetails /> (dalej: Operator). Kontakt z Operatorem: <OperatorContact />.
          </li>
          <li>
            Pojęcia użyte w Regulaminie:
            <ul className="plain">
              <li>Użytkownik: każda osoba korzystająca z Serwisu,</li>
              <li>Konsument: Użytkownik będący konsumentem w rozumieniu art. 22¹ Kodeksu cywilnego,</li>
              <li>Biuro: przedsiębiorca prowadzący biuro nieruchomości, którego dane są prezentowane w Serwisie,</li>
              <li>Formularz: formularz w Serwisie, przez który Użytkownik wysyła zapytanie lub zgłoszenie.</li>
            </ul>
          </li>
          <li>
            Korzystając z Serwisu, Użytkownik akceptuje Regulamin. Regulamin jest dostępny bezpłatnie na tej stronie i można go
            zapisać lub wydrukować.
          </li>
        </ol>

        <h2 id="p2">§ 2. Usługi</h2>
        <ol>
          <li>
            Operator świadczy bezpłatnie następujące usługi:
            <ul className="plain">
              <li>przeglądanie katalogu i rankingu biur nieruchomości, profili biur, ofert biur i opinii,</li>
              <li>wyszukiwanie biur według miasta,</li>
              <li>formularz zapytania do wybranego Biura, przekazywanego temu Biuru przez Operatora,</li>
              <li>formularze dla Biur: korekta danych, usunięcie wpisu, zgłoszenie właściciela firmy i inne sprawy.</li>
            </ul>
          </li>
          <li>
            Usługi płatne dla Biur (np. rozszerzony profil) są możliwe wyłącznie na podstawie odrębnej umowy. Ich zasady opisuje
            strona <Link href="/reklama">Reklama i niezależność</Link>. Płatność nie wpływa na pozycję w rankingu.
          </li>
        </ol>

        <h2 id="p3">§ 3. Wymagania techniczne</h2>
        <ol>
          <li>
            Do korzystania z Serwisu potrzebne jest urządzenie z dostępem do internetu i aktualna przeglądarka internetowa z
            włączoną obsługą JavaScript. Do wysłania Formularza potrzebny jest adres e-mail.
          </li>
          <li>
            Korzystanie z internetu wiąże się z typowymi zagrożeniami, takimi jak złośliwe oprogramowanie, próby wyłudzenia
            danych (phishing) czy przechwycenie transmisji. Operator szyfruje połączenie z Serwisem (HTTPS). Użytkownik powinien
            stosować aktualne oprogramowanie i ochronę antywirusową.
          </li>
          <li>Serwis używa plików cookie na zasadach opisanych w Polityce prywatności.</li>
        </ol>

        <h2 id="p4">§ 4. Zawarcie i rozwiązanie umowy</h2>
        <ol>
          <li>
            Umowa o świadczenie usługi przeglądania Serwisu zostaje zawarta z chwilą otwarcia Serwisu i rozwiązuje się z chwilą
            jego opuszczenia.
          </li>
          <li>
            Umowa o przekazanie zapytania lub rozpatrzenie zgłoszenia zostaje zawarta z chwilą wysłania Formularza i wygasa po
            przekazaniu zapytania Biuru albo rozpatrzeniu zgłoszenia.
          </li>
          <li>Użytkownik może w każdej chwili zakończyć korzystanie z Serwisu, bez podawania przyczyny i bez kosztów.</li>
        </ol>

        <h2 id="p5">§ 5. Charakter informacji i ranking</h2>
        <ol>
          <li>
            Informacje o Biurach pochodzą z rejestrów publicznych (KRS, wykaz podatników VAT), ze stron internetowych Biur i z
            Google. Operator dokłada starań, żeby były aktualne i rzetelne, ale mogą się one zmienić po dacie ich pobrania,
            podanej przy danych.
          </li>
          <li>
            Informacje w Serwisie mają charakter informacyjny i nie stanowią oferty w rozumieniu Kodeksu cywilnego ani porady
            prawnej, podatkowej czy inwestycyjnej.
          </li>
          <li>
            Operator nie jest pośrednikiem w obrocie nieruchomościami i nie jest stroną umów zawieranych między Użytkownikami a
            Biurami. Za usługi Biur odpowiadają Biura.
          </li>
          <li>
            Kolejność Biur w rankingu wynika wyłącznie z parametrów opisanych w <Link href="/metodologia">metodologii</Link>,
            gdzie podajemy też ich znaczenie (wagi). Biura nie płacą za umieszczenie w katalogu ani za pozycję w rankingu.
            Treści sponsorowane, jeśli się pojawią, będą wyraźnie oznaczone napisem „Reklama” i oddzielone od rankingu.
          </li>
        </ol>

        <h2 id="p6">§ 6. Opinie</h2>
        <ol>
          <li>
            Serwis pokazuje ocenę i opinie o Biurach pochodzące z Map Google, pobierane przez oficjalne Places API, z
            oznaczeniem źródła. Operator nie zbiera własnych opinii od Użytkowników.
          </li>
          <li>
            Operator nie weryfikuje, czy opinie pochodzą od osób, które korzystały z usług Biura. Opinie nie są przez Operatora
            zmieniane ani wybierane według ich wydźwięku. Za ich treść odpowiadają autorzy, a za zasady ich publikacji Google.
          </li>
        </ol>

        <h2 id="p7">§ 7. Oferty nieruchomości</h2>
        <ol>
          <li>
            Serwis pokazuje tytuły, ceny i linki do ofert opublikowanych przez Biura na ich stronach. Pełna i aktualna treść
            oferty znajduje się na stronie Biura, a cenę i dostępność nieruchomości trzeba potwierdzić w Biurze.
          </li>
          <li>Za treść ofert odpowiadają Biura. Biuro może poprosić o usunięcie swoich ofert z Serwisu.</li>
        </ol>

        <h2 id="p8">§ 8. Formularze i zasady korzystania</h2>
        <ol>
          <li>
            Użytkownik podaje w Formularzu prawdziwe dane i nie podaje danych innych osób bez ich zgody. Zapytanie wysłane przez
            Formularz Operator przekazuje Biuru wybranemu przez Użytkownika. Odpowiedź przesyła Biuro.
          </li>
          <li>
            Zabronione jest dostarczanie treści o charakterze bezprawnym, w tym obraźliwych, naruszających dobra osobiste lub
            prawa osób trzecich, wysyłanie przez Formularze niezamówionych informacji handlowych oraz działania zakłócające
            pracę Serwisu lub zmierzające do uzyskania nieuprawnionego dostępu do jego zasobów.
          </li>
          <li>Operator może nie przekazać zapytania albo nie rozpatrzyć zgłoszenia, które narusza ust. 2.</li>
        </ol>

        <h2 id="p9">§ 9. Zgłaszanie nieprawidłowych lub bezprawnych treści</h2>
        <ol>
          <li>
            Każdy może zgłosić błąd w danych albo treść, którą uważa za bezprawną, przez stronę{" "}
            <Link href="/dla-firm">Dla biur</Link> albo e-mailem, wskazując adres strony, opis problemu i uzasadnienie.
          </li>
          <li>
            Operator rozpatruje zgłoszenia bez zbędnej zwłoki, zwykle w ciągu 14 dni, i informuje zgłaszającego o decyzji wraz
            z uzasadnieniem. Biuro może w każdej chwili poprosić o korektę albo usunięcie swojego wpisu.
          </li>
          <li>
            Punktem kontaktowym dla Użytkowników i organów, o którym mowa w art. 11 i 12 rozporządzenia (UE) 2022/2065 (akt o
            usługach cyfrowych), jest Operator, dostępny przez kanały kontaktu wskazane w § 1 ust. 2, w języku polskim lub
            angielskim.
          </li>
        </ol>

        <h2 id="p10">§ 10. Reklamacje</h2>
        <ol>
          <li>
            Reklamację dotyczącą działania Serwisu można złożyć przez kanały kontaktu wskazane w § 1 ust. 2. Reklamacja powinna
            zawierać adres e-mail do odpowiedzi i opis problemu.
          </li>
          <li>
            Operator rozpatruje reklamację w ciągu 14 dni od jej otrzymania i odpowiada na adres e-mail podany w reklamacji.
          </li>
          <li>
            Konsument może skorzystać z pozasądowych sposobów rozpatrywania reklamacji, np. z pomocy miejskiego lub powiatowego
            rzecznika konsumentów albo Wojewódzkiego Inspektoratu Inspekcji Handlowej. Informacje są dostępne na stronie Urzędu
            Ochrony Konkurencji i Konsumentów (uokik.gov.pl).
          </li>
        </ol>

        <h2 id="p11">§ 11. Prawa autorskie</h2>
        <ol>
          <li>
            Opisy, zestawienia, ranking oraz układ Serwisu są chronione prawem. Można je cytować w dozwolonym zakresie, z
            podaniem źródła i linkiem do Serwisu.
          </li>
          <li>
            Nazwy, znaki towarowe, logo, zdjęcia i oferty Biur należą do ich właścicieli i są prezentowane wyłącznie w celu
            informacyjnym.
          </li>
        </ol>

        <h2 id="p12">§ 12. Odpowiedzialność</h2>
        <ol>
          <li>
            Operator odpowiada za świadczenie usług zgodnie z Regulaminem i przepisami prawa. Operator nie odpowiada za usługi
            Biur, treść stron Biur i ofert ani za decyzje podjęte wyłącznie na podstawie informacji z Serwisu.
          </li>
          <li>
            Operator może czasowo ograniczyć dostęp do Serwisu z powodu prac technicznych, awarii lub ze względów
            bezpieczeństwa.
          </li>
          <li>Regulamin nie wyłącza ani nie ogranicza uprawnień Konsumentów wynikających z bezwzględnie obowiązujących przepisów.</li>
        </ol>

        <h2 id="p13">§ 13. Dane osobowe</h2>
        <p>
          Zasady przetwarzania danych osobowych i używania plików cookie opisuje{" "}
          <Link href="/polityka-prywatnosci">Polityka prywatności</Link>.
        </p>

        <h2 id="p14">§ 14. Zmiany Regulaminu</h2>
        <ol>
          <li>
            Operator może zmienić Regulamin z ważnych przyczyn, w szczególności zmiany przepisów, zakresu lub sposobu
            świadczenia usług albo względów bezpieczeństwa.
          </li>
          <li>
            Zmieniony Regulamin obowiązuje od dnia wskazanego przy jego treści, nie wcześniej niż 7 dni od publikacji. Do
            zapytań i zgłoszeń wysłanych przed zmianą stosuje się Regulamin w dotychczasowym brzmieniu.
          </li>
        </ol>

        <h2 id="p15">§ 15. Postanowienia końcowe</h2>
        <ol>
          <li>
            Regulamin podlega prawu polskiemu. Wybór prawa nie pozbawia Konsumenta ochrony przysługującej mu na podstawie
            bezwzględnie obowiązujących przepisów państwa jego zwykłego pobytu.
          </li>
          <li>Spory rozstrzyga sąd właściwy według przepisów ogólnych.</li>
          <li>Regulamin obowiązuje od {LEGAL_EFFECTIVE_DATE}</li>
        </ol>
      </article>
    </PublicShell>
  );
}
