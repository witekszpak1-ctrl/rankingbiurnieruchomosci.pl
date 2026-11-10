const { chromium } = require("playwright");
const assert = require("node:assert/strict");

const BASE = process.env.BASE_URL || "http://localhost:3100";
const SHOTS = process.env.SHOTS_DIR || "./e2e/shots";
const results = [];
const step = async (name, fn) => {
  try {
    await fn();
    results.push(["OK  ", name]);
  } catch (e) {
    results.push(["FAIL", `${name}: ${e.message.split("\n")[0]}`]);
  }
};

(async () => {
  require("node:fs").mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  const page = await ctx.newPage();
  const text = async () => (await page.locator("body").innerText()).replace(/\s+/g, " ");
  // czeka do 8 s, aż treść strony pasuje do wzorca (po nawigacji z akcji serwerowej treść dochodzi z opóźnieniem)
  const expectText = async (re) => {
    const deadline = Date.now() + 8000;
    let last = "";
    while (Date.now() < deadline) {
      last = await text();
      if (re.test(last)) return;
      await page.waitForTimeout(150);
    }
    assert.match(last, re);
  };

  await step("panel bez sesji przekierowuje na logowanie", async () => {
    await page.goto(`${BASE}/admin/firms`);
    assert.match(page.url(), /\/admin\/login$/);
  });

  await step("błędne hasło pokazuje komunikat i nie loguje", async () => {
    await page.goto(`${BASE}/admin/login`);
    await page.fill("#email", (process.env.E2E_ADMIN_EMAIL || "admin@example.org"));
    await page.fill("#password", "zle-haslo");
    await page.click("button[type=submit]");
    await page.waitForURL(/error=1/);
    await expectText(/Nieprawidłowy e-mail lub hasło/);
    await page.goto(`${BASE}/admin`);
    assert.match(page.url(), /\/admin\/login/);
  });

  await step("poprawne logowanie otwiera przegląd", async () => {
    await page.goto(`${BASE}/admin/login`);
    await page.fill("#email", (process.env.E2E_ADMIN_EMAIL || "admin@example.org"));
    await page.fill("#password", (process.env.E2E_ADMIN_PASSWORD || "test-haslo-123"));
    await page.click("button[type=submit]");
    await page.waitForURL(`${BASE}/admin`);
    await expectText(/Przegląd/);
    await page.screenshot({ path: `${SHOTS}/admin_dashboard.png`, fullPage: true });
  });

  await step("kolejka weryfikacji pokazuje Theta Biuro z powodami i pozwala zatwierdzić", async () => {
    await page.goto(`${BASE}/admin/review`);
    const body = await text();
    assert.match(body, /theta-biuro\.example/);
    assert.match(body, /na stronie jest inny NIP niż w rejestrze/);
    await page.screenshot({ path: `${SHOTS}/admin_review.png`, fullPage: true });
    await page.click("form:has(input[value=approve]) button");
    await page.waitForURL(/ok=/);
    await expectText(/Domena zatwierdzona/);
    await expectText(/Kolejka jest pusta/);
  });

  await step("lista firm filtruje po statusie", async () => {
    await page.goto(`${BASE}/admin/firms?status=verified`);
    const body = await text();
    assert.match(body, /Eta Mieszkania/);
    assert.match(body, /Theta Biuro/);
    assert.doesNotMatch(body, /Alfa Nieruchomości/);
  });

  let etaUrl;
  await step("publikacja Eta Mieszkania przy spełnionej bramce", async () => {
    await page.goto(`${BASE}/admin/firms?status=verified`);
    await page.click("text=Eta Mieszkania");
    await page.waitForURL(/\/admin\/firms\/[0-9a-f-]{36}$/);
    etaUrl = page.url();
    await expectText(/Bramka publikacji: spełniona/);
    await page.screenshot({ path: `${SHOTS}/admin_firm.png`, fullPage: true });
    await page.click("form:has(input[value=publish]) button");
    await page.waitForURL(/ok=/);
    await expectText(/Wpis opublikowany/);
    const res = await page.request.get(`${BASE}/wroclaw/eta-mieszkania`);
    assert.equal(res.status(), 200);
    const city = await (await page.request.get(`${BASE}/wroclaw`)).text();
    assert.match(city, /zawiera 7 zweryfikowanych/);
  });

  await step("Theta Biuro bez opisu nie przechodzi bramki bez wymuszenia", async () => {
    await page.goto(`${BASE}/admin/firms?q=Theta`);
    await page.click("text=Theta Biuro");
    await expectText(/Bramka publikacji: niespełniona/);
    await expectText(/Brak zwalidowanego opisu/);
    await page.click("form:has(input[value=publish]) button");
    await page.waitForURL(/error=/);
    await expectText(/Bramka publikacji/);
    const res = await page.request.get(`${BASE}/wroclaw/theta-biuro`);
    assert.equal(res.status(), 404);
  });

  await step("wycofanie Eta usuwa stronę publiczną", async () => {
    await page.goto(etaUrl);
    await page.click("form:has(input[value=unpublish]) button");
    await page.waitForURL(/ok=/);
    await expectText(/Wpis wycofany/);
    assert.equal((await page.request.get(`${BASE}/wroclaw/eta-mieszkania`)).status(), 404);
    assert.match(await (await page.request.get(`${BASE}/wroclaw`)).text(), /zawiera 6 zweryfikowanych/);
  });

  await step("audyt zawiera wykonane akcje", async () => {
    await page.goto(`${BASE}/admin/audit`);
    const body = await text();
    for (const a of ["domain.approve", "listing.publish", "listing.unpublish"]) assert.match(body, new RegExp(a.replace(".", "\\.")));
    assert.match(body, /admin@example\.org/);
  });

  await step("przebiegi i przegląd się renderują", async () => {
    await page.goto(`${BASE}/admin/runs`);
    await expectText(/Przebiegi pipeline/);
    await page.goto(`${BASE}/admin`);
    await expectText(/Wydajność wyszukiwania/);
  });

  await step("wylogowanie kończy sesję", async () => {
    await page.click("text=Wyloguj");
    await page.waitForURL(/\/admin\/login/);
    await page.goto(`${BASE}/admin/firms`);
    assert.match(page.url(), /\/admin\/login$/);
  });

  // ---- część publiczna (bez sesji)
  const pub = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  const pp = await pub.newPage();

  await step("strona miasta: ranking, tabela i brak noindex dla 6 biur", async () => {
    await pp.goto(`${BASE}/wroclaw`);
    const body = (await pp.locator("body").innerText()).replace(/\s+/g, " ");
    assert.match(body, /ranking 2026/);
    assert.match(body, /Delta Estate/);
    assert.equal(await pp.locator('meta[name="robots"][content*="noindex"]').count(), 0);
    assert.equal(await pp.locator("tbody tr").count(), 6);
    assert.equal(await pp.locator('link[rel="canonical"]').getAttribute("href"), "http://localhost:3100/wroclaw");
    await pp.screenshot({ path: `${SHOTS}/public_city.png`, fullPage: true });
  });

  await step("Kraków (2 biura): lista bez rankingu i noindex", async () => {
    await pp.goto(`${BASE}/krakow`);
    const body = (await pp.locator("body").innerText()).replace(/\s+/g, " ");
    assert.match(body, /Lista biur \(alfabetycznie\)/);
    assert.doesNotMatch(body, /ranking 2026/);
    assert.ok((await pp.locator('meta[name="robots"]').getAttribute("content")).includes("noindex"));
  });

  await step("profil firmy: opis, ceny z cytatem, wynik i JSON-LD", async () => {
    await pp.goto(`${BASE}/wroclaw/alfa-nieruchomosci`);
    const body = (await pp.locator("body").innerText()).replace(/\s+/g, " ");
    assert.match(body, /Wrocławskie biuro pośredniczące/);
    assert.match(body, /od 2% netto/);
    assert.match(body, /Wynik w rankingu: \d+\/100/);
    const ld = JSON.parse(await pp.locator('script[type="application/ld+json"]').textContent());
    assert.equal(ld["@type"], "RealEstateAgent");
    assert.equal(ld.address.addressLocality, "Wrocław");
    assert.ok(!JSON.stringify(ld).includes("telephone") && !JSON.stringify(ld).includes("email"));
    await pp.screenshot({ path: `${SHOTS}/public_firm.png`, fullPage: true });
  });

  await step("brak poziomego przewijania na telefonie", async () => {
    const m = await browser.newContext({ viewport: { width: 390, height: 800 } });
    const mp = await m.newPage();
    for (const path of ["/", "/wroclaw", "/wroclaw/delta-estate", "/metodologia"]) {
      await mp.goto(`${BASE}${path}`);
      const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(overflow <= 1, `${path}: przewijanie poziome ${overflow}px`);
    }
    await mp.goto(`${BASE}/wroclaw`);
    await mp.screenshot({ path: `${SHOTS}/mobile_city.png`, fullPage: true });
    await m.close();
  });

  await step("sitemap, robots, llms.txt", async () => {
    const sitemap = await (await pp.request.get(`${BASE}/sitemap.xml`)).text();
    assert.match(sitemap, /localhost:3100\/wroclaw</);
    assert.match(sitemap, /localhost:3100\/wroclaw\/alfa-nieruchomosci</);
    assert.doesNotMatch(sitemap, /localhost:3100\/krakow</); // miasto poniżej progu jest noindex
    assert.match(sitemap, /localhost:3100\/krakow\/kappa-nieruchomosci</);
    assert.doesNotMatch(sitemap, /admin/);
    const robots = await (await pp.request.get(`${BASE}/robots.txt`)).text();
    assert.match(robots, /Disallow: \/admin/);
    assert.match(robots, /User-Agent: OAI-SearchBot/i);
    assert.match(robots, /Sitemap: http:\/\/localhost:3100\/sitemap\.xml/);
    const llms = await (await pp.request.get(`${BASE}/llms.txt`)).text();
    assert.match(llms, /Biura nieruchomości Wrocław/);
  });

  await browser.close();
  for (const [status, name] of results) console.log(status, name);
  const failed = results.filter(([s]) => s === "FAIL").length;
  console.log(failed ? `\n${failed} kroków nie przeszło` : "\nWszystkie kroki przeszły");
  process.exit(failed ? 1 : 0);
})();
