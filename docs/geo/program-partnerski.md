# Program partnerski platformy GEO

Status: zbudowany i przetestowany lokalnie (gałąź `claude/geo-platforma`), jeszcze nie wdrożony. Decyzja właściciela z 28.11.2026:
każdy może wygenerować link i dostaje 20% dożywotnio od pieniędzy wydanych przez poleconego klienta.

## Zasady (warunki w wersji 2026-11, tabela `geo.affiliate_terms`)

| Zasada | Wartość | Gdzie w kodzie |
|---|---|---|
| Prowizja | 20% kwoty netto (bez VAT, po rabatach) każdej płatności | `commissionGrosze` w `apps/geo/lib/affiliate.ts` |
| Czas | dożywotnio, dopóki klient płaci i partner jest aktywny | `recordPayment` w `lib/affiliate-repo.ts` |
| Przypisanie klienta | raz, przy założeniu konta; na stałe | `geo.referrals` (klucz: konto klienta) |
| Okno linku | 90 dni od kliknięcia (ciasteczko `geo_ref`) | `chooseAttribution` |
| Kod w formularzu | ma pierwszeństwo przed linkiem innego partnera; kod podpowiedziany z linku zostaje poleceniem z linku | `chooseAttribution` |
| Zwroty i obciążenia zwrotne | ujemna prowizja, netto proporcjonalnie do pierwotnej płatności | `proportionalNet`, webhook |
| Okres na zwroty | 30 dni od płatności, potem prowizja do wypłaty | `availableAt`, `balance` |
| Wypłata | od 100 zł, przelewem raz w miesiącu, rozliczenie w `/admin/partnerzy` | `settlePayout` |
| Polecenie samego siebie | odrzucone z powodem: to samo konto, ten sam e-mail, ta sama firmowa domena e-mail, domena e-mail partnera = strona klienta | `selfReferralReason` |
| Zmiana warunków | nie zmienia historii: prowizja zapisuje stawkę i wersję warunków, partner zostaje na warunkach, które zaakceptował | `affiliates.terms_version` |
| Indywidualna stawka | możliwa (`affiliates.rate_bps`) | |

Przykład z testu: faktura 367,77 zł brutto, 299,00 zł netto -> prowizja 59,80 zł. Zwrot 100 zł brutto -> netto 81,30 zł -> prowizja -16,26 zł.

## Obieg

1. Partner zakłada konto na `/partner/dolacz` (albo dołącza jako istniejący klient) i wybiera kod.
2. W `/partner/panel` generuje link `/r/<kod>?c=<kampania>&to=<strona>`, kopiuje go i rozsyła.
3. Kliknięcie: zapis w `geo.affiliate_clicks` (bez IP, skrót odwiedzającego z solą dnia), ciasteczko na 90 dni. Boty
   i podglądy linków (Facebook, WhatsApp itd.) nie są liczone. Przekierowanie tylko na ścieżki naszej strony.
4. Klient zakłada konto (`/rejestracja`): powstaje polecenie w `geo.referrals` (aktywne albo odrzucone z powodem).
5. Płatność: webhook Stripe `invoice.paid` -> `geo.payments` -> `geo.commissions`. Duplikat webhooka nic nie zmienia
   (unikalny identyfikator faktury). `charge.refunded` i `charge.dispute.created` tworzą ujemne prowizje.
6. Raz w miesiącu: w `/admin/partnerzy` przelew, tytuł przelewu, „Rozlicz”.

## Test z 28.11.2026 (lokalny PostgreSQL 16, przeglądarka)

Partner -> kliknięcie z kampanią „facebook” -> rejestracja klienta -> polecenie aktywne z kampanią; próba polecenia
własnej firmy odrzucona („ta sama firmowa domena e-mail”); bot bez kliknięcia; webhook 59,80 zł; duplikat bez skutku;
zły podpis 400; zwrot -16,26 zł; wypłata zablokowana poniżej minimum; rozliczenie 43,54 zł; klient bez dostępu do
`/admin`. Do tego 17 testów jednostkowych.

## Do decyzji i sprawdzenia przed startem

- **Podatki i umowa z partnerem** (do księgowej): partner-firma wystawia fakturę; osoba prywatna to przychód, dla którego
  płatnik może mieć obowiązki informacyjne (np. PIT-11). Od tego zależy, czy osobom prywatnym wypłacamy od razu.
- **Ciasteczko polecenia a zgoda na pliki cookie**: ciasteczko `geo_ref` służy rozliczeniu z partnerem. Do potwierdzenia
  z prawnikiem, czy wymaga zgody; zapas: kod polecający w formularzu działa bez ciasteczka.
- **Regulamin programu**: pełna treść przed startem sprzedaży (zakaz spamu i e-maili bez zgody, zakaz reklam na naszą
  nazwę, zakaz obietnic pozycji w AI, kary za naruszenia).
- **Wypłaty automatyczne**: na start ręczny przelew. Później Stripe Connect, gdy partnerów będzie dużo.
