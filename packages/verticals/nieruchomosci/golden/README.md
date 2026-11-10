# Zestaw wzorcowy (golden set)

Ręcznie oznaczone dane do mierzenia jakości przed włączeniem autopublikacji.

## domains.csv

Ok. 200 domen z etykietą: `url,label,notes`. Etykiety: `official`, `directory`, `marketplace`, `media`, `irrelevant`,
`parked`. Zbieraj próbkę z prawdziwych wyników wyszukiwania dla kilku miast, z przewagą trudnych przypadków
(strony biur z listą oddziałów, portale lokalne, blogi z rankingami).
Mierzysz: precyzję i recall klasyfikatora (`classify_page`) oraz odsetek sporów kierowanych do Claude Code.

## entities.csv

Podmioty z rejestru z ręcznie potwierdzoną domeną: `name,city,expected_domain`. Wejście dla testu A/B dostawców
wyszukiwania (`katalog ab-search --csv entities.csv --providers brave,serper`). Zostaw też kilka wierszy bez domeny
(firmy bez strony), żeby zobaczyć, czy wyszukiwarka nie podsuwa fałszywych dopasowań.

Pliki zawierają tylko dane firmowe. Nie dodawaj danych osobowych (prywatnych adresów, telefonów).
