#!/usr/bin/env node
/**
 * Kontrola renderowanych stron portalu: pobiera kluczowe strony z działającego serwera i szuka w widocznym tekście
 * słownictwa branży nieruchomości ("nieruchomoś", "mieszka", "pośredni", "agencj") oraz słowa "biur" (dozwolonego tylko
 * w portalu biur rachunkowych). Portal nieruchomości jest pomijany (to jego własne słownictwo).
 *
 * Użycie (serwer zbudowany i uruchomiony z tą samą wartością PORTAL):
 *   PORTAL=weterynarze npm run build && PORTAL=weterynarze npm start &
 *   node scripts/check-portal-html.mjs http://localhost:3000 weterynarze
 *
 * Adresy miasta i profilu firmy są brane z /miasta i ze strony miasta, więc baza musi mieć wpisy tej branży (jak nie ma,
 * skrypt sprawdza tylko strony wspólne i mówi o tym wprost). Kod wyjścia 1 = znaleziono trafienia.
 */
const [base, slug] = process.argv.slice(2);
if (!base || !slug) {
  console.error("Użycie: node scripts/check-portal-html.mjs <adres serwera> <slug portalu>");
  process.exit(2);
}
if (slug === "nieruchomosci") {
  console.log("Portal nieruchomości: kontrola nie dotyczy (własne słownictwo).");
  process.exit(0);
}

const REAL_ESTATE = /nieruchomo[śs]|mieszka|(?<![a-ząćęłńóśźż])po[śs]redni|agencj/i;
const BIUR = /biur/i;
const forbidden = slug === "rachunkowe" ? [REAL_ESTATE] : [REAL_ESTATE, BIUR];

/** Widoczny tekst strony: bez skryptów, stylów i adresów (adres może zawierać slug firmy). */
function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/\s(?:href|src|srcset|action)="[^"]*"/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, " ");
}

async function get(path) {
  const res = await fetch(new URL(path, base), { redirect: "manual" });
  return { status: res.status, body: await res.text() };
}

const paths = ["/", "/miasta", "/ranking", "/metodologia", "/dla-firm", "/o-nas", "/kontakt", "/regulamin", "/polityka-prywatnosci", "/reklama", "/porownaj", "/bot", "/llms.txt", "/manifest.webmanifest"];

// Adres miasta i profilu firmy z danych serwera.
const cities = await get("/miasta");
const cityHref = /href="\/([a-z0-9-]+)"/.exec(cities.body.replace(/href="\/(miasta|ranking|metodologia|dla-firm|o-nas|kontakt|regulamin|polityka-prywatnosci|reklama|porownaj|bot)"/g, ""))?.[1];
let city = null;
let firm = null;
if (cityHref) {
  city = `/${cityHref}`;
  paths.push(city);
  const page = await get(city);
  const firmHref = new RegExp(`href="(/${cityHref}/[a-z0-9-]+)"`).exec(page.body)?.[1];
  if (firmHref) {
    firm = firmHref;
    paths.push(firm);
  }
}
if (!city) console.warn("Uwaga: brak miast w danych, sprawdzam tylko strony wspólne.");
if (city && !firm) console.warn("Uwaga: brak profilu firmy w danych, profil nie jest sprawdzany.");

let bad = 0;
for (const path of paths) {
  const { status, body } = await get(path);
  const text = visibleText(body);
  const found = [];
  for (const re of forbidden) {
    const g = new RegExp(re.source, "gi");
    for (const m of text.matchAll(g)) found.push(`…${text.slice(Math.max(0, m.index - 40), m.index + 60)}…`);
  }
  console.log(`${status} ${path} ${found.length === 0 ? "ok" : `TRAFIEŃ x${found.length}`}`);
  for (const f of found.slice(0, 5)) console.log(`    ${f}`);
  bad += found.length;
}
if (bad > 0) {
  console.error(`Znaleziono ${bad} trafień słownictwa innej branży.`);
  process.exit(1);
}
console.log("Brak trafień.");
