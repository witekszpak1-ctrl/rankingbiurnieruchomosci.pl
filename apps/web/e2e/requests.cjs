const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const BASE = "http://localhost:3100";
const out = [];
const step = async (name, fn) => { try { await fn(); out.push("OK   " + name); } catch (e) { out.push("FAIL " + name + ": " + e.message.split("\n")[0]); } };
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1000, height: 900 } })).newPage();
  const body = async () => (await page.locator("body").innerText()).replace(/\s+/g, " ");
  const waitText = async (re) => { const t0 = Date.now(); let t = ""; while (Date.now() - t0 < 8000) { t = await body(); if (re.test(t)) return; await page.waitForTimeout(150); } assert.match(t, re); };
  const fill = async (o) => {
    await page.goto(`${BASE}/dla-firm`);
    if (o.kind) await page.selectOption("#kind", o.kind);
    await page.fill("#nip", o.nip ?? "");
    await page.fill("#email", o.email ?? "");
    await page.evaluate(() => { document.querySelector("#message").removeAttribute("minlength"); document.querySelector("#email").removeAttribute("required"); document.querySelector("form").noValidate = true; });
    await page.fill("#message", o.message ?? "");
    if (o.honey) await page.evaluate((v) => { document.querySelector("#website").value = v; }, o.honey);
    await page.click("button[type=submit]");
  };

  await step("formularz jest na stronie /dla-firm", async () => {
    await page.goto(`${BASE}/dla-firm`);
    assert.ok(await page.locator("form textarea#message").count());
  });
  await step("zły NIP daje komunikat i nic nie zapisuje", async () => {
    await fill({ kind: "correction", nip: "1234563219", email: "jan@przyklad.pl", message: "Proszę o poprawę adresu firmy." });
    await waitText(/NIP jest nieprawidłowy/);
  });
  await step("zły e-mail daje komunikat", async () => {
    await fill({ kind: "correction", email: "bez-malpy", message: "Proszę o poprawę adresu firmy." });
    await waitText(/poprawny adres e-mail/);
  });
  await step("za krótka treść daje komunikat", async () => {
    await fill({ kind: "removal", email: "jan@przyklad.pl", message: "krótko" });
    await waitText(/od 10 do 2000 znaków/);
  });
  await step("pole-pułapka: bot dostaje sukces, ale nic się nie zapisuje", async () => {
    await fill({ kind: "other", email: "bot@spam.pl", message: "Kup tanie okulary teraz teraz.", honey: "http://spam" });
    await waitText(/zgłoszenie zostało przyjęte/);
  });
  await step("poprawne zgłoszenie jest przyjęte", async () => {
    await fill({ kind: "removal", nip: "123-456-32-18", email: "Jan.Kowalski@Przyklad.pl", message: "Proszę o usunięcie wpisu mojej firmy z katalogu." });
    await waitText(/zgłoszenie zostało przyjęte/);
    assert.match(page.url(), /sent=1/);
  });
  await step("limit: czwarte zgłoszenie z tego samego e-maila jest odrzucone", async () => {
    for (let i = 0; i < 2; i++) { await fill({ kind: "other", email: "jan.kowalski@przyklad.pl", message: `Kolejne zgłoszenie numer ${i + 2} do sprawdzenia.` }); await waitText(/zgłoszenie zostało przyjęte/); }
    await fill({ kind: "other", email: "jan.kowalski@przyklad.pl", message: "To już czwarte zgłoszenie w godzinę." });
    await waitText(/zbyt wiele zgłoszeń/);
  });
  await step("panel: bez sesji /admin/requests przekierowuje na logowanie", async () => {
    await page.goto(`${BASE}/admin/requests`);
    assert.match(page.url(), /\/admin\/login$/);
  });
  await step("panel: logowanie i lista zgłoszeń z licznikiem", async () => {
    await page.fill("#email", "admin@example.org");
    await page.fill("#password", "test-haslo-123");
    await Promise.all([page.waitForURL((u) => u.pathname === "/admin"), page.click("button[type=submit]")]);
    await waitText(/nowych zgłoszeń ze strony dla firm/);
    await page.goto(`${BASE}/admin/requests`);
    await waitText(/Usunięcie wpisu/);
    const t = await body();
    assert.match(t, /jan\.kowalski@przyklad\.pl/); assert.match(t, /NIP 1234563218/); assert.doesNotMatch(t, /okulary/);
  });
  await step("panel: zmiana statusu z notatką zapisuje się i trafia do audytu", async () => {
    const card = page.locator(".tablewrap", { hasText: "usunięcie wpisu mojej firmy" }).first();
    await card.locator("select").selectOption("done");
    await card.locator("input[name=note]").fill("Wpis usunięty, odpowiedziano mailem.");
    await card.locator("button[type=submit]").click();
    await waitText(/Zgłoszenie zaktualizowane/);
    const t = await body();
    assert.match(t, /załatwione/); assert.match(t, /obsłużył: admin@example\.org/);
    const saved = await page.locator(".tablewrap", { hasText: "usunięcie wpisu mojej firmy" }).first().locator("input[name=note]").inputValue();
    assert.equal(saved, "Wpis usunięty, odpowiedziano mailem.");
    await page.goto(`${BASE}/admin/audit`);
    await waitText(/request\.update/);
  });
  await step("panel: filtr statusu", async () => {
    await page.goto(`${BASE}/admin/requests?status=done`);
    await waitText(/Usunięcie wpisu/);
    assert.doesNotMatch(await body(), /Kolejne zgłoszenie numer 2/);
  });
  await browser.close();
  console.log(out.join("\n"));
})();
