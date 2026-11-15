// Rysuje ikony PNG z wektorów w Chromium (pakiet playwright). Uruchomienie z katalogu apps/web:
//   node scripts/render_icons.cjs && python3 scripts/render_icons_ico.py
// Wynik: app/apple-icon.png (180 px, białe tło dla iOS), public/icon-192.png i public/icon-512.png (manifest,
// Android) oraz podgląd 256 px, z którego render_icons_ico.py robi app/favicon.ico (16, 32, 48 px).
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

(async () => {
  const icon = read("app/icon.svg");
  const apple = read("scripts/apple-icon.svg");
  const jobs = [
    [apple, 180, "app/apple-icon.png", false],
    [icon, 256, "scripts/icon-256.png", true],
    [icon, 192, "public/icon-192.png", true],
    [icon, 512, "public/icon-512.png", true],
  ];
  const browser = await chromium.launch();
  for (const [svg, size, out, transparent] of jobs) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(
      `<html><body style="margin:0;background:transparent">${svg.replace("<svg ", `<svg style="display:block;width:${size}px;height:${size}px" `)}</body></html>`,
    );
    await page.screenshot({ path: path.join(root, out), clip: { x: 0, y: 0, width: size, height: size }, omitBackground: transparent });
    await page.close();
  }
  await browser.close();
})();
