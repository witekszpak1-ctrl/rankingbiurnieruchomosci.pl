# Instrukcja bloga (rankingbiurnieruchomosci.pl)

Zasady pisania i budowy wpisów bloga. Obowiązują przy każdym nowym wpisie i każdej zmianie istniejącego.
Stan na 22.11.2026.

## 1. Po co jest blog

- Przewaga serwisu to dane o samych biurach (oceny Google, cenniki, staż z rejestrów, oferty), których nie publikuje konkurencja (Otodom, Sonarhome, Oferteo mają listy biur, Rankomat i Bankier ceny mieszkań).
- Blog ma przyciągać ruch na frazy o wyborze biura i prowizjach, a potem kierować czytelnika do katalogu (strony miast, profile biur, formularz zapytania).
- Nie konkurujemy na frazy, na które nie mamy danych: „ceny mieszkań [miasto]”, „najtańsze miasta”, „ile kosztuje wynajem w [mieście]”.

## 2. Gdzie co jest w kodzie

- Lista wpisów: `apps/web/lib/blog.ts` (`BLOG_POSTS`: slug, tytuł, h1, opis, kategoria, główna fraza `keyword`, daty). Przy zmianie treści zmień `modified`.
- Treść wpisu: `apps/web/app/blog/<slug>/page.tsx`. Metadane zawsze przez `blogMetadata(post)`.
- Liczby: `apps/web/lib/blog-stats.ts` (statystyki miast, ocen, stażu, stawek z cenników, pary miast).
- Rama wpisu: `apps/web/components/BlogArticle.tsx` (okładka, daty, JSON-LD, „Czytaj też”, `ShortAnswer`, `Faq` + `faqLd`, `Checklist`, `Example`, `ShareBar`).
- Wykresy: `apps/web/components/BlogCharts.tsx` (`BarList`, `DotPlot`, `Columns`, `PairBars`).
- Okładki: `apps/web/app/blog/okladka/[file]/route.tsx` (PNG 1200x630, adres `/blog/okladka/<slug>.png`).
- Porównania miast: `apps/web/app/blog/porownanie/[pair]/page.tsx` + teksty w `apps/web/lib/pair-content.ts`.
- Linki do bloga w serwisie: `apps/web/lib/blog-links.ts` + `apps/web/components/BlogLinks.tsx` (profil biura, strona miasta, strona główna).
- Panel: `/admin/blog` (data wpisu, ukrycie wpisu, długość, ocena SEO). Ustawienia z panelu: `settings.blog_overrides`.

## 3. Długość i budowa wpisu

| Typ | Długość treści | Uwagi |
|---|---|---|
| Poradnik | 1800-2600 słów | pełna odpowiedź na pytanie z tytułu, przykłady w złotych |
| Dane, Porównania | 1300-1900 słów | tabele i wykresy z danych, metodologia |
| Porównanie dwóch miast | 900-1300 słów | generowane z danych, różne sformułowania dla każdej pary |

Każdy wpis ma:
1. Ramkę „W skrócie” (`ShortAnswer`) z bezpośrednią odpowiedzią i główną frazą w pierwszym zdaniu.
2. Co najmniej 6 sekcji h2 (h3 wewnątrz, gdy potrzebne).
3. Co najmniej 2 wykresy z danych katalogu (przy wystarczającej próbie).
4. Przykłady z wyliczeniem (`Example`), np. prowizja dla mieszkania za 400 tys., 700 tys. i 1,2 mln zł.
5. Listę kontrolną (`Checklist`) do wykorzystania przed podpisaniem umowy.
6. FAQ z 6-10 pytaniami (`Faq` + `faqLd` w `extraLd`), pytania z badania fraz.
7. Co najmniej 6 linków wewnętrznych: strony miast, ranking, raport prowizji, poradniki, inne wpisy, porównania miast (tylko z `cityPairs()`, nigdy wymyślone adresy).

Dłuższy tekst ma wnosić treść: krok po kroku, najczęstsze błędy, konkretne zapisy w umowach, dane. Bez lania wody i bez powtarzania tych samych zdań w różnych wpisach.

## 4. Dane i liczby

- Liczby tylko z danych katalogu albo powszechnie znane fakty. Nigdy nie wymyślamy statystyk, cen rynkowych, kwot ani dat.
- Progi próby (stałe w `lib/blog-stats.ts`): ocena Google od 10 opinii (`MIN_REVIEWS`), miasto w porównaniu ocen od 10 takich biur (`CITY_COMPARE_MIN`), staż miasta od 10 biur z datą (`YEARS_MIN`), mediana prowizji od 3 cenników (`PRICE_STAT_MIN`). Kwartyle („połowa biur od X do Y”) dopiero od 8 stawek.
- Przy zbyt małej próbie piszemy wprost, że danych jest za mało, i nie wyciągamy wniosków.
- Różnice mniejsze niż progi „podobnie” (`SAME_RATING` 0,05 oceny, `SAME_SHARE` 5 punktów procentowych) opisujemy jako podobne.
- Liczba biur to biura w naszym katalogu (z własną, zweryfikowaną stroną), a nie cały rynek.
- Staż to data wpisu do KRS (od 2001 r.) albo rejestracji jako podatnik VAT (wykaz od 5 lipca 1993 r.), nie zawsze faktyczny początek działalności. Nie piszemy o CEIDG jako źródle.
- Mediana prowizji to mediana najniższych stawek procentowych za sprzedaż z cenników (jedna na biuro), stawki deklarowane, nie transakcyjne, netto albo brutto tak, jak podaje biuro.
- Biuro z kilku miast liczymy raz, w mieście głównego wpisu. Biura franczyzowe to zwykle osobne firmy z własnym NIP.

## 5. Prawo i podatki

- Tylko twierdzenia pewne dla Polski w danym roku, podane ostrożnie, z dopiskiem, że warunki wynikają z umowy i przepisów.
- Projekty ustaw opisujemy jako „trwają prace” bez dat wejścia w życie, dopóki nie są uchwalone.
- Bez numerów artykułów i kwot maksymalnych, jeśli nie są pewne.

## 6. Język

- Poprawna polszczyzna, krótkie zdania, zwracamy się do czytelnika na „ty”.
- Nigdy długi myślnik (—) ani półpauza (–). Tylko zwykły łącznik „-”, a lepiej przecinek lub dwukropek.
- Odmiana po liczebnikach przez `lib/plural.ts`: „z 10 opiniami” (`nOpiniami`), „przy 10 opiniach” (`nOpiniach`), „od 33 lat” (`nLatGen`), „3 biura podają” (`plural`).
- Nazwy miast w miejscowniku przez `inCity()` („w Krakowie”, „we Wrocławiu”, dla miejscowości spoza słownika „w miejscowości X”).
- JSX: tekst na końcu linii sklei się z `{wyrażeniem}` albo `<Link>` z następnej linii bez spacji. Dodaj `{" "}` albo spację na początku łańcucha.

## 7. Grafiki

- Styl strony: kremowe tło, czarny tekst, żółty akcent (`#f6cd2b`), czcionki serwisu. Bez zdjęć stockowych i bez obrazów z AI udających zdjęcia.
- Okładka każdego wpisu generuje się z kodu: tytuł, kategoria, jedna liczba z aktualnych danych i prosty rysunek (słupki dla danych, dwie kolumny dla porównań, dom dla poradników). Nową liczbę dla nowego wpisu dopisz w `coverFor()` w route okładek.
- Wykresy: słupki od zera (cienkie, zaokrąglony koniec), oceny jako kropki na osi (bez zera), dwie serie z legendą. Kolory: seria 1 żółta, seria 2 czarna; tekst zawsze w kolorze tekstu. Żółty ma niski kontrast z tłem, dlatego każdy wykres ma etykiety wartości i tabelę z danymi („Pokaż dane w tabeli”). Każdy wykres ma tytuł i podpis z próbą.

## 8. SEO

- Tytuł 30-65 znaków, opis meta 70-160 znaków (dłuższy zostanie urwany), główna fraza w tytule, opisie i pierwszym akapicie.
- Jeden h1 (robi go `BlogArticle`), dane strukturalne Article (z okładką) i FAQPage, adres kanoniczny, mapa strony (automatycznie z `BLOG_POSTS`).
- Ocenę SEO każdego wpisu pokazuje panel `/admin/blog` (kryteria w `lib/blog-seo.ts`). Cel: co najmniej 85/100.

## 9. Gdzie pokazujemy wpisy

- Profil biura: do 3 artykułów dobranych do biura (cennik → kalkulator prowizji, najem → prowizja za wynajem, mało opinii → ocena 5,0, kilka miast → sieć czy lokalne biuro, długi staż → najstarsze biura) i jedno porównanie jego miasta.
- Strona miasta: porównania z innymi miastami i artykuły z danymi o miastach.
- Strona główna: 3 najnowsze wpisy.
- Dobór jest stały dla danej strony (bez losowania przy każdym wejściu), ukryte wpisy się nie pokazują.

## 10. Nowy wpis krok po kroku

1. Wybierz frazę z badania (frazy o prowizjach, wyborze biura, najmie, sieciach, porównaniach miast) i sprawdź, czy mamy dane, które coś do niej wnoszą.
2. Dopisz wpis do `BLOG_POSTS` (z `keyword`), utwórz `app/blog/<slug>/page.tsx` według istniejących wpisów, dopisz liczbę na okładkę w `coverFor()`.
3. Uruchom `npx tsc --noEmit` i `npx vitest run` w `apps/web`, zbuduj (`npx next build`).
4. Po wdrożeniu sprawdź wpis w `/admin/blog` (długość, ocena SEO) i popraw braki.
