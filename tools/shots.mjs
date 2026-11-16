// Screenshots of the demo through its test API.
//   node tools/shots.mjs <width> <height> <hash> name1 "script1" [name2 "script2" ...]
//   node tools/shots.mjs 1280 720 test golden "L.scene('golden'); L.frames(20, 1/30)"
// Each shot opens a fresh page with #<hash> (use "test", or "test-high" for N = 256),
// runs the script with L = window.OceanLab, and saves media/shots/<name>.png.
// Needs: npm i playwright, and Chrome/Chromium (set CHROME to its path if needed).
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [w, h, hash, ...rest] = process.argv.slice(2);
const outDir = join(root, 'media', 'shots');
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, headless: true,
  args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
for (let i = 0; i < rest.length; i += 2) {
  const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
  const logs = [];
  page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
  await page.goto(pathToFileURL(join(root, 'demo', 'dist', 'index.html')).href + '#' + hash, { waitUntil: 'load' });
  const t0 = Date.now();
  const res = await page.evaluate(async (src) => {
    if (document.body.classList.contains('failed')) return 'FAILED: ' + document.getElementById('error').textContent;
    if (!window.OceanLab) return 'no test api';
    return JSON.stringify(await (new Function('L', 'return (async () => {' + src + '})()'))(window.OceanLab));
  }, rest[i + 1]);
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(outDir, rest[i] + '.png') });
  console.log(rest[i], String(res).slice(0, 400), (Date.now() - t0) + 'ms', logs.slice(0, 3).join(' | '));
  await page.close();
}
await browser.close();
