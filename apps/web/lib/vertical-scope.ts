/**
 * Zakres danych portalu: katalog dzieli jedną bazę między branże (listings.vertical_id), a każdy portal pokazuje
 * tylko wpisy swojej branży (portal.verticalSlug). Fragmenty SQL budujemy tu, w jednym miejscu, żeby żadne zapytanie
 * publicznej części serwisu nie pominęło filtra.
 *
 * Slug wstawiamy do SQL jako literał (a nie parametr), bo to stała konfiguracji wdrożenia, a nie dane od
 * użytkownika; mimo to sprawdzamy jego postać, żeby błąd w konfiguracji nie mógł stać się wstrzyknięciem.
 */
import { currentPortal, type PortalConfig } from "./portal";

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

/** Slug branży bieżącego portalu (lub podanego), sprawdzony pod kątem bezpiecznego zapisu w SQL. */
export function verticalSlug(portal: PortalConfig = currentPortal()): string {
  const slug = portal.verticalSlug;
  if (!SLUG_RE.test(slug)) throw new Error(`Niepoprawny slug branży portalu "${portal.slug}": "${slug}".`);
  return slug;
}

/** Podzapytanie z identyfikatorem branży: (select id from verticals where slug = 'nieruchomosci'). */
export function verticalIdSql(portal?: PortalConfig): string {
  return `(select id from verticals where slug = '${verticalSlug(portal)}')`;
}

/** Warunek ograniczający wpisy do branży portalu, np. `l.vertical_id = (select ...)`. Alias to alias tabeli listings. */
export function inVertical(alias = "l", portal?: PortalConfig): string {
  return `${alias}.vertical_id = ${verticalIdSql(portal)}`;
}
