// Look-development gallery: every scene from its own camera, on one page.
//   node tools/gallery.mjs <outDir> [scene,scene,...] [width] [height] ["extra script run after each scene"]
//   node tools/gallery.mjs /tmp/look tropical,deep 800 450 "L.set('reflect', 1)"
//   node tools/gallery.mjs /tmp/look shots.json 800 450
// A .json list holds named shots, [{ "name": "surf-low", "scene": "surfbeach", "script": "cam(-70, 19, 0.3, 0.08, 16)" }],
// where cam(x, z, yaw, pitch, dist, targetHeight = 1) places a fixed camera (yaw and pitch in radians).
// Frames are driven by the test API (requestAnimationFrame is switched off), so the
// result is the same however slow the machine. Each scene first runs WARM seconds
// (default 6) so the foam has built up as it would in play. Writes <outDir>/<scene>.png.
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, readFileSync } from 'fs';
const root = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');   // ROOT: render another checkout, e.g. a before shot
const [outDir = '/tmp/gallery', list, w = '800', h = '450', extra = ''] = process.argv.slice(2);
const warm = +(process.env.WARM ?? 6);                   // seconds simulated (at 10 steps a second) before the frames that are drawn
const shots = list && list.endsWith('.json') ? JSON.parse(readFileSync(list, 'utf8'))
  : (list || 'tropical,golden,pirate,surfbeach,hurricane,storm,deep,night,glass').split(',').map((sc) => ({ name: sc, scene: sc }));
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
for (const shot of shots) {
  const t0 = Date.now();
  const info = await page.evaluate(({ shot, extra, warm }) => {
    const L = window.OceanLab;
    const cam = (x, z, yaw, pitch, dist, y = 1) => {
      const c = L.cam; L.state.follow = false;
      c.target[0] = c.tTarget[0] = x; c.target[1] = c.tTarget[1] = y; c.target[2] = c.tTarget[2] = z;
      c.yaw = c.tYaw = yaw; c.pitch = c.tPitch = pitch; c.dist = c.tDist = dist;
    };
    L.scene(shot.scene); L.apply();
    if (extra) new Function('L', 'cam', extra)(L, cam);
    if (shot.script) new Function('L', 'cam', shot.script)(L, cam);
    if (warm > 0) L.frames(Math.ceil(warm / 0.1), 0.1);    // let the foam and the boats reach a steady state
    L.frames(24, 1 / 30);
    return L.state.scene;
  }, { shot, extra, warm });
  await page.screenshot({ path: join(outDir, shot.name + '.png') });
  console.log(shot.name, info, (Date.now() - t0) + 'ms');
}
console.log(logs.slice(0, 3).join(' | '));
await browser.close();
