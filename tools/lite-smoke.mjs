// Water Lite smoke test: runs the built single-file demo and checks the public API.
//   node lite/build.mjs && node tools/lite-smoke.mjs
// Needs: npm i playwright, and Chrome/Chromium (set CHROME to its path if needed).
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, headless: true,
  args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(pathToFileURL(join(root, 'lite', 'dist', 'index.html')).href, { waitUntil: 'load' });
await page.waitForTimeout(800);

const results = await page.evaluate(async () => {
  const out = [], ok = (name, pass, info) => out.push({ name, pass: !!pass, info: info === undefined ? '' : String(info) });
  const W = window.waterLite;
  ok('demo engine created', W, typeof W);
  ok('demo loop running', W.time > 0.05, W.time.toFixed(2) + ' s');

  // every mode x style x palette through the real UI, no GL errors
  let glErr = 0;
  for (const m of ['3d', 'side', 'top']) {
    document.querySelector('[data-mode="' + m + '"]').click();
    for (const s of ['realistic', 'toon', 'pixel', 'lowpoly', 'retro', 'ink']) {
      document.querySelector('[data-style="' + s + '"]').click();
      W.update(1 / 30); W.render();
      glErr += W.gl.getError() ? 1 : 0;
    }
  }
  for (const p of ['pico8', 'sweetie16', 'gameboy', 'ocean8', 'mono', 'none', 'auto']) { document.querySelector('[data-palette="' + p + '"]').click(); W.render(); glErr += W.gl.getError() ? 1 : 0; }
  for (const q of ['potato', 'medium', 'high', 'low']) { document.querySelector('[data-quality="' + q + '"]').click(); W.update(1 / 30); W.render(); glErr += W.gl.getError() ? 1 : 0; }
  ok('all modes, styles, palettes and qualities render', glErr === 0, glErr + ' GL errors');

  // a separate engine to test the API
  const c = document.createElement('canvas');
  c.style.cssText = 'position:fixed;left:0;top:0;width:320px;height:180px;visibility:hidden';
  document.body.appendChild(c);
  const L = new WaterLite(c, { mode: 'side', style: 'realistic', transparent: true, scenery: false, floaters: false, preserveDrawingBuffer: true });
  for (let i = 0; i < 30; i++) L.update(1 / 60);
  L.render();
  const px = new Uint8Array(4), gl = L.gl;
  gl.readPixels(160, 175, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); const skyA = px[3];
  gl.readPixels(160, 10, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); const seaA = px[3];
  ok('scenery off leaves the sky transparent', skyA === 0 && seaA > 128, 'sky alpha ' + skyA + ', water alpha ' + seaA);

  // clear water: with scenery on, the seabed shows through and differs from open water higher up
  L.setOptions({ scenery: true });
  for (let i = 0; i < 10; i++) L.update(1 / 60);
  L.render();
  const S = L.side, bottomY = L._sideBottom(200), toPx = (y) => Math.round((1 - y / S.viewH) * 180);
  const sand = new Uint8Array(4), open = new Uint8Array(4);
  gl.readPixels(Math.round(200 / 480 * 320), toPx(bottomY + 5), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, sand);
  gl.readPixels(Math.round(200 / 480 * 320), toPx(S.level + 45), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, open);
  const diff = Math.abs(sand[0] - open[0]) + Math.abs(sand[1] - open[1]) + Math.abs(sand[2] - open[2]);
  ok('the seabed shows through the water', diff > 30, 'seabed rgb ' + Array.from(sand.slice(0, 3)) + ' vs open water ' + Array.from(open.slice(0, 3)));
  L.setOptions({ scenery: false });

  // a crate dropped from above floats at about its density
  const crate = L.addFloater(160, 60, { kind: 'crate', size: 20 });
  for (let i = 0; i < 360; i++) L.update(1 / 60);
  const surfY = L.side.level - L.sample(crate.x).height;
  const sub = crate.sub;
  ok('a dropped crate settles floating', Math.abs(crate.vy) < 25 && sub > 0.3 && sub < 0.8, 'submerged ' + sub.toFixed(2) + ', vy ' + crate.vy.toFixed(1) + ', centre ' + (crate.y - surfY).toFixed(1) + ' below the surface');

  // the sailboat stays upright while the sea is stirred
  const boat = L.addFloater(240, L.side.level - 10, { kind: 'boat', size: 56 });
  let worst = 0;
  for (let i = 0; i < 600; i++) { if (i % 90 === 0) L.splash(200 + (i % 180), 0, 14, 30); L.update(1 / 60); worst = Math.max(worst, Math.abs(boat.a)); }
  ok('the boat rights itself (max heel)', worst < 1.0, (worst * 180 / Math.PI).toFixed(0) + ' degrees');

  // 3D sampling, and lagoons calmer than open sea
  L.setOptions({ mode: '3d', scenery: true });
  const s3 = L.sample(3.2, -7.5);
  ok('3D sample gives a height and a unit normal', isFinite(s3.height) && Math.abs(Math.hypot.apply(null, s3.normal) - 1) < 1e-6, s3.height.toFixed(3));
  let open3 = [0, 0], bestA = -1;
  for (let a = 0; a < 6.28; a += 0.2) { const x = Math.cos(a) * 140, z = Math.sin(a) * 140 - 30, at = L._waveAtten(x, z); if (at > bestA) { bestA = at; open3 = [x, z]; } }
  let lag = 0, sea = 0;
  for (let i = 0; i < 120; i++) { L.update(0.05); lag = Math.max(lag, Math.abs(L.sample(0, -8).height)); sea = Math.max(sea, Math.abs(L.sample(open3[0], open3[1]).height)); }
  ok('the reef calms the lagoon', lag < sea * 0.5, 'lagoon ' + lag.toFixed(2) + ' m (wave scale ' + L._waveAtten(0, -8).toFixed(2) + '), open sea ' + sea.toFixed(2) + ' m (scale ' + bestA.toFixed(2) + ')');
  ok('the island rises above the sea and the lagoon is shallow', L._terrainHeight(0, -42) > 3 && L._terrainHeight(0, -6) < -1 && L._terrainHeight(0, -6) > -6, 'peak ' + L._terrainHeight(0, -42).toFixed(1) + ' m, lagoon ' + L._terrainHeight(0, -6).toFixed(1) + ' m');

  // top view with a game's own land map
  L.setOptions({ mode: 'top', land: (u, v) => u < 0.3 });
  ok('top view uses a custom land function', L._isLand(20, 45) && !L._isLand(120, 45), '');
  L.splash(100, 45, 1.5, 3);
  for (let i = 0; i < 20; i++) L.update(1 / 60);
  const ripple = Math.abs(L.sample(104, 45).height) + Math.abs(L.sample(100, 41).height);
  ok('ripples spread across the top view', ripple > 0.01, ripple.toFixed(3));
  let landStill = true;
  for (let x = 2; x < 40; x += 3) if (L.sample(x, 45).height !== 0) landStill = false;
  ok('land holds still under ripples', landStill, '');

  // pixel size gives whole pixels
  L.setOptions({ mode: 'side', style: 'pixel', pixelSize: 4 }); L.render();
  ok('pixel size maps to whole canvas pixels', L.stats.px === Math.round(4 * Math.min(devicePixelRatio, 1)) || L.stats.px >= 4, 'px ' + L.stats.px + ', low res ' + L.stats.lowW + 'x' + L.stats.lowH);
  ok('config() round-trips as JSON', JSON.parse(JSON.stringify(L.config())).land === 'custom', JSON.stringify(L.config()).length + ' chars');

  // cost of a frame in each mode (software GL here, so only relative)
  const times = {};
  for (const m of ['3d', 'side', 'top']) {
    L.setOptions({ mode: m, style: 'realistic', pixelSize: 0, quality: 'low', land: 'islands' });
    L.render(); gl.finish();
    const t0 = performance.now();
    for (let i = 0; i < 20; i++) { L.update(1 / 60); L.render(); }
    gl.finish();
    times[m] = ((performance.now() - t0) / 20).toFixed(1) + ' ms';
  }
  ok('frame times (software renderer, 320x180)', true, JSON.stringify(times));
  L.dispose();
  ok('dispose() frees the engine', gl.getError() === 0, '');
  return out;
});

let failed = 0;
for (const r of results) { console.log((r.pass ? 'PASS ' : 'FAIL ') + r.name + (r.info ? '  (' + r.info + ')' : '')); if (!r.pass) failed++; }
if (errors.length) { console.log('console errors:'); errors.forEach((e) => console.log('  ' + e)); }
await browser.close();
process.exit(failed || errors.length ? 1 : 0);
