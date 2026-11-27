# Zasady projektu (katalog, rankingbiurnieruchomosci.pl)

- Plan i zasady nadrzędne projektu: `docs/PLAN.md`.
- Blog: przed napisaniem lub zmianą wpisu przeczytaj `docs/blog.md` (długość, dane i progi próby, język, grafiki, SEO, panel `/admin/blog`).
- W tekstach na stronie i w odpowiedziach dla użytkownika nie używaj długiego myślnika (—) ani półpauzy (–), tylko zwykły łącznik „-”.
- Liczby na stronie tylko z danych katalogu, przy zbyt małej próbie piszemy, że danych jest za mało. Nie wymyślamy statystyk.
- Gdy użytkownik prosi o analizę albo pomysł, odpowiadamy analizą i nie wdrażamy zmian bez jego zgody.
- Dane z Google (wyniki wyszukiwania, Mapy z ocenami i opiniami) i pobieranie stron biur idą przez LiteScrape (`apps/worker/katalog_worker/litescrape.py`, klucz w panelu `/admin/koszty`, `settings.litescrape`). Zapas: Serper dla wyszukiwania i własny crawler dla stron. Google Places API jest wyłączone, nie włączaj go bez zgody użytkownika.
- Płatne API (LiteScrape, Serper, Brave): liczniki i limity w `settings.api_usage`, podgląd w panelu `/admin/koszty`. Nie dodawaj nowych płatnych zapytań ani nie zwiększaj ich liczby bez zgody użytkownika. Klucza LiteScrape nie wypisuj ani nie zapisuj w logach.
- Zmiany schematu (`alter table`) wymagają roli właściciela bazy, automat ich nie wykona (`docs/rozpoznanie.md`). Najpierw szukaj rozwiązania bez zmiany schematu.
