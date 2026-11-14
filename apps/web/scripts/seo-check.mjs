// Test SEO na działającej stronie (etap 6 planu poprawy). Uruchamiany po wdrożeniu (workflow seo-check.yml)
// albo ręcznie: node scripts/seo-check.mjs [https://adres-strony]
// Sprawdza na kilku stronach: kod 200, jeden nagłówek h1, canonical, regułę indeksowania i poprawny JSON-LD,
// a także przekierowania http i www jednym krokiem na https bez www.
const BASE = (process.argv[2] || process.env.SEO_BASE || "https://rankingbiurnieruchomosci.pl").replace(/\/$/, "");
const failures = [];
const fail = (msg) => failures.push(msg);

async function get(path) {
  const res = await fetch(BASE + path, { redirect: "manual", headers: { "user-agent": "SeoCheck/1.0 (+post-deploy test)" } });
  return { status: res.status, html: res.status === 200 ? await res.text() : "", location: res.headers.get("location") };
}

function canonical(html) {
  const m = html.match(/<link[^>]+rel="canonical"[^>]*href="([^"]+)"/i) || html.match(/<link[^>]+href="([^"]+)"[^>]*rel="canonical"/i);
  return m ? m[1] : null;
}

function robots(html) {
  const m = html.match(/<meta[^>]+name="robots"[^>]*content="([^"]+)"/i);
  return m ? m[1] : "";
}

async function checkPage(path, expect) {
  const { status, html } = await get(path);
  if (status !== 200) return fail(`${path}: kod ${status}`);
  const h1 = (html.match(/<h1[\s>]/gi) || []).length;
  if (h1 !== 1) fail(`${path}: nagłówków h1: ${h1} (powinien być 1)`);
  const canon = canonical(html);
  if (!canon) fail(`${path}: brak canonical`);
  else if (expect.canonical && canon.replace(/\/$/, "") !== (BASE + expect.canonical).replace(/\/$/, "")) {
    fail(`${path}: canonical ${canon}, oczekiwany ${BASE + expect.canonical}`);
  }
  if (expect.maxKb && html.length > expect.maxKb * 1024) fail(`${path}: kod strony ${Math.round(html.length / 1024)} KB (limit ${expect.maxKb} KB)`);
  const noindex = /noindex/i.test(robots(html));
  if (expect.noindex !== undefined && noindex !== expect.noindex) {
    fail(`${path}: ${noindex ? "ma" : "nie ma"} noindex, oczekiwano ${expect.noindex ? "noindex" : "indeksowania"}`);
  }
  for (const m of html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      JSON.parse(m[1]);
    } catch {
      fail(`${path}: niepoprawny JSON-LD`);
    }
  }
}

async function checkRedirect(url) {
  const res = await fetch(url, { redirect: "manual" });
  const loc = res.headers.get("location") || "";
  if (![301, 308].includes(res.status) || !loc.startsWith(BASE)) {
    fail(`${url}: kod ${res.status}, przekierowanie na "${loc}" (oczekiwano jednego kroku na ${BASE})`);
  }
}

const sitemap = await (await fetch(BASE + "/sitemap.xml")).text();
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(BASE, ""));
const city = urls.find((u) => /^\/[a-z0-9-]+$/.test(u) && !["/miasta", "/metodologia", "/o-nas", "/kontakt", "/dla-firm", "/reklama", "/bot", "/ranking"].includes(u));
const firm = urls.find((u) => /^\/[a-z0-9-]+\/[a-z0-9-]+$/.test(u));

await checkPage("/", { canonical: "/", noindex: false });
for (const p of ["/miasta", "/metodologia", "/o-nas", "/kontakt"]) await checkPage(p, { canonical: p, noindex: false });
if (city) {
  await checkPage(city, { canonical: city });
  await checkPage(`${city}?cel=wynajem`, { canonical: city, noindex: true });
}
if (firm) await checkPage(firm, { canonical: firm });
// Kryterium planu poprawy: kod strony Warszawy (najwięcej biur) poniżej 200 KB.
await checkPage("/warszawa", { canonical: "/warszawa", noindex: false, maxKb: 200 });
await checkPage("/porownaj", { noindex: true });

const host = new URL(BASE).host;
if (!host.startsWith("www.") && !host.endsWith("vercel.app")) {
  await checkRedirect(`https://www.${host}/`);
  await checkRedirect(`http://${host}/`);
}

if (failures.length) {
  console.error(`Test SEO: ${failures.length} problemów na ${BASE}`);
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}
console.log(`Test SEO: wszystko w porządku na ${BASE} (miasto ${city ?? "brak"}, profil ${firm ?? "brak"}).`);
