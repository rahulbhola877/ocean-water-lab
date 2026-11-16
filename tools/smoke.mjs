// End-to-end check in the real frame loop: scenes, advanced panel, export/import,
// the pirate ship's helm and broadside, the tour and the recorder.
//   node tools/smoke.mjs
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, headless: true,
  args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 620 }, acceptDownloads: true });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
let download = null; page.on('download', (d) => { download = d.suggestedFilename(); });
await page.goto(pathToFileURL(join(root, 'demo', 'dist', 'index.html')).href, { waitUntil: 'load' });
await page.waitForFunction(() => document.body.classList.contains('ready') || document.body.classList.contains('failed'), null, { timeout: 60000 });
const click = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const out = {};
for (const sc of ['surfbeach', 'hurricane', 'pirate', 'night']) { await click('[data-scene="' + sc + '"]'); await page.waitForTimeout(2500); }
await click('[data-tab="adv"]');
out.advancedInputs = await page.evaluate(() => document.querySelectorAll('#tab-adv input').length);
await click('[data-tab="export"]');
out.exports = {};
for (const f of ['json', 'kit', 'unity', 'unreal', 'godot']) out.exports[f] = await page.evaluate((f) => { document.querySelector('[data-fmt="' + f + '"]').click(); return document.getElementById('export-text').value.length; }, f);
await click('[data-fmt="json"]');
out.import = await page.evaluate(() => { document.getElementById('import-text').value = document.getElementById('export-text').value; document.getElementById('import-load').click(); return document.getElementById('import-load').textContent; });
await click('[data-tab="quick"]'); await click('[data-set="vessel:ship"]'); await click('#helm');
await page.waitForTimeout(3000);
await page.keyboard.press(' ');
await page.waitForTimeout(2000);
out.hud = await page.evaluate(() => document.getElementById('hud-vessel').textContent + ' ' + document.getElementById('hud-speed').textContent + ' kn');
await click('#tour-play'); await page.waitForTimeout(4000);
out.tour = await page.evaluate(() => document.getElementById('tour-a').textContent);
await click('#tour-play'); await click('#rec-free'); await page.waitForTimeout(3000); await click('#rec-free'); await page.waitForTimeout(2000);
out.recording = await page.evaluate(() => document.getElementById('note').textContent);
out.download = download;
out.errors = errors.length;
console.log(JSON.stringify(out, null, 1));
if (errors.length) { console.log(errors.slice(0, 5).join('\n')); process.exitCode = 1; }
await browser.close();
