# Cofanie zmian danych z raportów (etapy 2 i 3 planu poprawy)

Zmiany z raportów (`report.yml` z `apply`) zapisuje się dopiero po zgodzie właściciela. Przed pierwszym zapisem
14.11.2026 powstała kopia całej bazy: gałąź Neon `kopia-przed-raportami-2026-11-14` (`br-rapid-fire-baxb22ha`).

## Pełne cofnięcie

W konsoli Neon (projekt `katalog`): Branches, gałąź główna, Restore, źródło: `kopia-przed-raportami-2026-11-14`.
Cofa wszystko, co zmieniło się w bazie od utworzenia kopii, także nowe wpisy i opisy z automatu, więc najlepiej
zrobić to szybko albo cofać pojedyncze zmiany niżej.

## Cofanie pojedynczych zmian (dziennik audit_log)

Każda zmiana ma wpis w `audit_log` ze stanem przed (`before`) i po (`after`). Zapytania uruchamia właściciel
tabel. Najpierw zawsze sprawdź, co zostanie zmienione (zamień `update` na `select`).

Zmiana nazwy firmy (raport nazw):

```sql
update brands b set name = a.before ->> 'name'
from audit_log a
where a.action = 'brand.rename_bad_name' and a.entity_id = b.id::text and a.at >= '2026-11-14';
```

Nowy adres profilu po zmianie nazwy albo scaleniu (stary adres przekierowuje na nowy):

```sql
update listings l set slug = a.before ->> 'slug'
from audit_log a
where a.action = 'listing.reslug' and a.entity_id = l.id::text and a.at >= '2026-11-14';
-- przekierowania ze starych adresów na nowe przestają być potrzebne:
delete from listing_redirects where created_at >= '2026-11-14';
```

Ukrycie wpisu bez nazwy (raport nazw):

```sql
update listings l set status = 'published'
from audit_log a
where a.action = 'listing.hide_bad_name' and a.entity_id = l.id::text and a.at >= '2026-11-14';
```

Scalenie duplikatów (raport duplikatów):

```sql
-- wpis przeniesiony do firmy, która zostaje: wraca do swojej marki
update listings l set brand_id = (a.before ->> 'brand_id')::uuid
from audit_log a
where a.action = 'listing.merge_brand' and a.entity_id = l.id::text and a.before ? 'brand_id'
  and a.after ? 'brand_id' and a.at >= '2026-11-14';
-- wpis wycofany, bo firma miała już wpis w tym mieście: wraca jako opublikowany
update listings l set status = 'published'
from audit_log a
where a.action = 'listing.merge_brand' and a.entity_id = l.id::text and a.after ->> 'status' = 'removed'
  and a.at >= '2026-11-14';
```

Przeniesienie do innego miasta (raport miast):

```sql
-- wpis wraca do poprzedniego miasta (nazwa w before.city) i adresu (before.path)
update listings l set city_id = c.id, slug = split_part(a.before ->> 'path', '/', 3)
from audit_log a join cities c on c.name = a.before ->> 'city'
where a.action = 'listing.move_city' and a.entity_id = l.id::text and a.at >= '2026-11-14';
```

Po cofnięciu zatwierdź stan katalogu dla kontroli po przebiegach: workflow `report`, opcja `kontrola-akceptuj`.
