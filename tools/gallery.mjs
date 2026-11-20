// Look-development gallery: every scene from its own camera, on one page, plus a contact sheet.
//   node tools/gallery.mjs <outDir> [scene,scene,...] [width] [height] ["extra script run after each scene"]
//   node tools/gallery.mjs /tmp/look tropical,deep 800 450 "L.set('reflect', 1)"
// Frames are driven by the test API (requestAnimationFrame is switched off), so the
// result is the same however slow the machine. Each scene first runs WARM seconds
// (default 6) so the foam has built up as it would in play. Writes <outDir>/<scene>.png.
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';
const root = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');   // ROOT: render another checkout, e.g. a before shot
const [outDir = '/tmp/gallery', list, w = '800', h = '450', extra = ''] = process.argv.slice(2);
const warm = +(process.env.WARM ?? 6);                   // seconds simulated (at 10 steps a second) before the frames that are drawn
const scenes = (list || 'tropical,golden,pirate,surfbeach,hurricane,storm,deep,night,glass').split(',');
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, headless: true,
  args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const logs = [];
page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
await page.goto(pathToFileURL(join(root, 'demo', 'dist', 'index.html')).href + '#test', { waitUntil: 'load' });
await page.waitForFunction(() => document.body.classList.contains('ready') || document.body.classList.contains('failed'), null, { timeout: 300000 });
await page.addStyleTag({ content: '#panel, #panel-toggle, .hint, .forecast, #hud, #note, #tour-caption { display: none !important }' });
await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
for (const sc of scenes) {
  const t0 = Date.now();
  const info = await page.evaluate(({ sc, extra, warm }) => {
    const L = window.OceanLab;
    L.scene(sc); L.apply();
    if (extra) new Function('L', extra)(L);
    if (warm > 0) L.frames(Math.ceil(warm / 0.1), 0.1);    // let the foam and the boats reach a steady state
    L.frames(24, 1 / 30);
    return L.state.scene;
  }, { sc, extra, warm });
  await page.screenshot({ path: join(outDir, sc + '.png') });
  console.log(sc, info, (Date.now() - t0) + 'ms');
}
console.log(logs.slice(0, 3).join(' | '));
await browser.close();
