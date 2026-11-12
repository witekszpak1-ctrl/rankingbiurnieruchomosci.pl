// Rysuje app/apple-icon.png (180 px) i podgląd 256 px z app/icon.svg w Chromium (pakiet playwright).
// Plik app/favicon.ico (16, 32, 48 px) powstaje z podglądu: python3 scripts/render_icons_ico.py
// Uruchomienie z katalogu apps/web: node scripts/render_icons.cjs
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

(async () => {
  const svg = fs.readFileSync(path.join(__dirname, "..", "app", "icon.svg"), "utf8");
  const browser = await chromium.launch();
  for (const [size, out] of [[180, "app/apple-icon.png"], [256, "scripts/icon-256.png"]]) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(`<body style="margin:0">${svg.replace("<svg ", `<svg style="display:block;width:${size}px;height:${size}px" `)}</body>`);
    await page.screenshot({ path: path.join(__dirname, "..", out), clip: { x: 0, y: 0, width: size, height: size } });
    await page.close();
  }
  await browser.close();
})();
