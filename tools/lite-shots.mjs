// Screenshots of Water Lite in every mode and style, plus a console-error check.
//   node tools/lite-shots.mjs [width] [height]          -> media/shots/lite-<mode>-<style>.png
//   node tools/lite-shots.mjs 960 540 side:pixel 3d:toon  (only these combinations)
//   node tools/lite-shots.mjs 960 540 'top:pixel:{"mood":"night","rain":0.5}'   (extra options; "_bolt": true forces lightning)
// Needs: npm i playwright, and Chrome/Chromium (set CHROME to its path if needed).
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const w = +(args[0] || 960), h = +(args[1] || 540);
let combos = args.slice(2).map((s) => { const [m, st, ...rest] = s.split(':'); return [m, st, rest.join(':')]; });
if (!combos.length) {
  combos = [];
  for (const m of ['3d', 'side', 'top']) for (const s of ['realistic', 'toon', 'pixel', 'lowpoly', 'retro', 'ink']) combos.push([m, s]);
}
const outDir = join(root, 'media', 'shots');
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, headless: true,
  args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
const logs = [];
page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push('[' + m.type() + '] ' + m.text()); });
await page.goto(pathToFileURL(join(root, 'lite', 'index.html')).href, { waitUntil: 'load' });
await page.waitForTimeout(500);
if (process.env.CLEAN) await page.addStyleTag({ content: '.panel, .hint, .hud { display: none !important; }' });   // CLEAN=1: water only
let failed = 0;
for (const [mode, style, extra] of combos) {
  const res = await page.evaluate(([mode, style, extra]) => {
    const W = window.waterLite;
    if (!W) return 'no engine: ' + document.getElementById('err').textContent;
    if (W._realUpdate) W.update = W._realUpdate;
    document.querySelector('[data-mode="' + mode + '"]').click();
    document.querySelector('[data-style="' + style + '"]').click();
    const x = extra ? JSON.parse(extra) : {};
    W.setOptions(Object.assign({ mood: 'day', rain: -1, zoom: 1, mapSize: [160, 90], worldWidth: 480 }, x));
    if (x._cam) Object.assign(W.camera2d, x._cam);
    // a few seconds of simulated time so springs, ripples and floaters settle
    for (let i = 0; i < 150; i++) {
      if (mode === 'side' && i === 30) { W.splash(150, 0, 12, 24); W.drop(innerWidth * 0.6, innerHeight * 0.2); }
      if (mode === 'top' && i % 20 === 0) W.splash(30 + i * 0.5, 60, 1.5, 3);
      W.update(1 / 50);
    }
    if (x._bolt) { W._storm = { t: 0.08, seed: 12.3, pos: 0.35, strength: 1, next: 0 }; W.update(0.001); }
    if (!W._realUpdate) W._realUpdate = W.update;
    W.update = function () {};                             // hold this moment while the screenshot is taken
    W.render();
    const gl = W.gl, err = gl.getError();
    return err ? 'GL error ' + err : 'ok';
  }, [mode, style, extra]);
  await page.waitForTimeout(250);
  const tag = extra ? '-' + Object.entries(JSON.parse(extra)).filter(([k]) => k[0] !== '_').map(([, v]) => String(v)).join('-').replace(/[^a-z0-9.-]/gi, '') : '';
  const name = 'lite-' + mode + '-' + style + tag;
  await page.screenshot({ path: join(outDir, name + '.png') });
  await page.evaluate(() => { const W = window.waterLite; if (W && W._realUpdate) W.update = W._realUpdate; });
  if (res !== 'ok') failed++;
  console.log(name.padEnd(28), res);
}
if (logs.length) { console.log('console:'); logs.slice(0, 20).forEach((l) => console.log('  ' + l)); }
await browser.close();
process.exit(failed || logs.some((l) => l.startsWith('[pageerror]') || l.startsWith('[error]')) ? 1 : 0);
