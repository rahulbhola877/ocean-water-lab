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

  // ---- what 2.1 added ---------------------------------------------------------------------
  const mk = (o, w, h) => {
    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:fixed;left:0;top:0;width:' + (w || 320) + 'px;height:' + (h || 180) + 'px;visibility:hidden';
    document.body.appendChild(cv);
    return new WaterLite(cv, Object.assign({ preserveDrawingBuffer: true }, o));
  };
  const meanRGB = (E) => {
    const g2 = E.gl, w = g2.drawingBufferWidth, h = g2.drawingBufferHeight, px2 = new Uint8Array(w * h * 4);
    g2.readPixels(0, 0, w, h, g2.RGBA, g2.UNSIGNED_BYTE, px2);
    const m = [0, 0, 0]; for (let i = 0; i < px2.length; i += 4) { m[0] += px2[i]; m[1] += px2[i + 1]; m[2] += px2[i + 2]; }
    return m.map((v) => v / (w * h));
  };

  // only the shaders a view needs are compiled
  const T1 = mk({ mode: 'top' }); T1.update(1 / 60); T1.render();
  const compiled = Object.keys(T1._progs);
  ok('shaders compile only for the view in use', compiled.indexOf('sea') < 0 && compiled.indexOf('world') < 0 && compiled.indexOf('topWater') >= 0, compiled.join(','));

  // events: splashes report where and how hard; the boat's wake stays quiet
  const ev = [];
  T1.on('splash', (e) => ev.push(e));
  for (let i = 0; i < 60; i++) T1.update(1 / 60);
  const quiet = ev.length;
  T1.drop(160, 90);
  ok('splash events fire for drops, not for the wake', quiet === 0 && ev.length === 1 && ev[0].mode === 'top' && isFinite(ev[0].x) && ev[0].power > 0, quiet + ' from the wake, then ' + JSON.stringify({ x: ev[0] && +ev[0].x.toFixed(1), y: ev[0] && +ev[0].y.toFixed(1), power: ev[0] && ev[0].power }));
  const off = ev.length; T1.off('splash'); T1.drop(160, 90);
  ok('off() removes listeners', ev.length === off, '');

  // rain lands in the ripple simulation
  const energy = (E) => { let e2 = 0; const c = E.top.cur; for (let i = 0; i < c.length; i++) e2 += Math.abs(c[i]); return e2; };
  const dry = mk({ mode: 'top', boat: false, floaters: false }), wet = mk({ mode: 'top', boat: false, floaters: false, rain: 1 });
  for (let i = 0; i < 90; i++) { dry.update(1 / 60); wet.update(1 / 60); }
  ok('rain makes ripples in the top view', energy(wet) > energy(dry) + 5, 'ripple energy ' + energy(wet).toFixed(1) + ' in rain, ' + energy(dry).toFixed(1) + ' dry');
  wet.render(); dry.dispose();
  ok('rain streaks draw without errors', wet.gl.getError() === 0, '');
  wet.dispose();

  // moods: night is darker, sunset warmer, the storm throws lightning
  const M = mk({ mode: 'side' });
  const look = {};
  for (const mood of ['day', 'sunset', 'night']) { M.setOptions({ mood }); for (let i = 0; i < 5; i++) M.update(1 / 60); M.render(); look[mood] = meanRGB(M); }
  const lum = (c) => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
  ok('night is darker than day', lum(look.night) < lum(look.day) * 0.5, 'mean luma day ' + lum(look.day).toFixed(0) + ', night ' + lum(look.night).toFixed(0));
  ok('sunset is warmer than day', look.sunset[0] / look.sunset[2] > look.day[0] / look.day[2] * 1.3, 'red/blue day ' + (look.day[0] / look.day[2]).toFixed(2) + ', sunset ' + (look.sunset[0] / look.sunset[2]).toFixed(2));
  M.setOptions({ mood: 'storm' });
  let strikes = 0, peak = 0; M.on('lightning', () => strikes++);
  for (let i = 0; i < 60 * 14; i++) { M.update(1 / 60); peak = Math.max(peak, M._flash); }
  ok('storms throw lightning, with an event for thunder', strikes > 0 && peak > 0.5 && M.rainAmt > 0.5, strikes + ' strikes in 14 s, brightest flash ' + peak.toFixed(2) + ', rain ' + M.rainAmt);
  M.render();
  ok('storm frame renders', M.gl.getError() === 0, '');

  // context loss: everything comes back
  const lose = M.gl.getExtension('WEBGL_lose_context');
  let restored = false; M.on('contextrestored', () => { restored = true; });
  lose.loseContext();
  await new Promise((r) => setTimeout(r, 60));
  M.update(1 / 60); M.render();                        // must not throw while the context is gone
  lose.restoreContext();
  await new Promise((r) => setTimeout(r, 150));
  M.setOptions({ mood: 'day' }); M.update(1 / 60); M.render();
  const back = meanRGB(M);
  ok('the GPU context is restored after a loss', restored && M.gl.getError() === 0 && lum(back) > 20, 'mean luma after restore ' + lum(back).toFixed(0));
  M.dispose();

  // side camera: a wide world scrolls, and screen positions map into it
  const C2 = mk({ mode: 'side', worldWidth: 1440 });
  C2.camera2d.x = 99999; C2.update(1 / 60); C2.render();
  const wpos = C2.screenToWorld(160, 90);
  ok('side camera scrolls a wide world', C2.side.camX === 960 && Math.abs(wpos.x - 1200) < 1, 'view starts at x ' + C2.side.camX + ', screen centre is world x ' + wpos.x.toFixed(0));
  // top camera: zoom shows part of a bigger map and follows the boat
  C2.setOptions({ mode: 'top', mapSize: [480, 270], zoom: 2 });
  C2.camera2d.follow = C2.boat;
  for (let i = 0; i < 240; i++) C2.update(1 / 60);
  C2.render();
  const R2 = C2._rect, cx2 = R2[0] + R2[2] / 2, cy2 = R2[1] + R2[3] / 2;
  const clampC = (v, half, size) => Math.min(Math.max(v, half), size - half);   // the view never leaves the map
  const tx2 = clampC(C2.boat.x, R2[2] / 2, 480), ty2 = clampC(C2.boat.y, R2[3] / 2, 270);
  ok('top camera zooms into a bigger map and follows the boat', C2.top.worldW === 480 && Math.abs(R2[2] - 240) < 1 && Math.hypot(cx2 - tx2, cy2 - ty2) < 8,
    'view ' + R2.map((v) => v.toFixed(0)).join(',') + ', boat at ' + C2.boat.x.toFixed(0) + ',' + C2.boat.y.toFixed(0));
  C2.dispose();

  // auto quality: drawing resolution follows a GPU that slows down as it draws more
  const A2 = mk({ mode: 'side', quality: 'auto' });
  const realNow = performance.now.bind(performance);
  let fake = realNow();
  performance.now = () => fake;
  for (let i = 0; i < 400; i++) { fake += 8 + 30 * Math.pow(A2._auto ? A2._auto.scale : 0.75, 2); A2.render(); }
  const settled = A2._auto.scale;
  for (let i = 0; i < 1200; i++) { fake += 6; A2.render(); }
  performance.now = realNow;
  ok('auto quality lowers resolution under load and raises it with headroom', settled < 0.75 && settled >= 0.4 && A2._auto.scale > settled, 'scale under load ' + settled.toFixed(2) + ', then ' + A2._auto.scale.toFixed(2) + ' (stats.scale ' + A2.stats.scale + ', fps ' + A2.stats.fps + ')');
  A2.dispose();

  // ---- 2.2: the weak spots ------------------------------------------------------------------
  // a low sun keeps a top-down map readable (pixel art at sunset used to leave island centres black)
  const darkShare = (E) => {
    const g2 = E.gl, w = g2.drawingBufferWidth, h = g2.drawingBufferHeight, px2 = new Uint8Array(w * h * 4);
    g2.readPixels(0, 0, w, h, g2.RGBA, g2.UNSIGNED_BYTE, px2);
    let dark = 0; for (let i = 0; i < px2.length; i += 4) if (px2[i] * 0.3 + px2[i + 1] * 0.59 + px2[i + 2] * 0.11 < 40) dark++;
    return dark / (w * h);
  };
  const P2 = mk({ mode: 'top', style: 'pixel' });
  P2.update(1 / 60); P2.render(); const dDay = darkShare(P2);
  P2.setOptions({ mood: 'sunset' }); P2.update(1 / 60); P2.render(); const dSun = darkShare(P2);
  ok('top-down pixel sunset keeps its islands readable', dSun < dDay + 0.06, 'near-black pixels: day ' + (dDay * 100).toFixed(1) + ' %, sunset ' + (dSun * 100).toFixed(1) + ' %');
  P2.dispose();

  // big maps: full-density grid, ripples simulated only around the view
  const G2 = mk({ mode: 'top', mapSize: [480, 270], zoom: 3 });
  G2.camera2d.follow = G2.boat;
  for (let i = 0; i < 120; i++) G2.update(1 / 60);
  const win = G2.top.win, winCells = (win[2] - win[0] + 1) * (win[3] - win[1] + 1), allCells = G2.top.W * G2.top.H;
  G2.splash(G2.boat.x + 6, G2.boat.y, 1.5, 2.5);
  for (let i = 0; i < 20; i++) G2.update(1 / 60);
  const rip2 = Math.abs(G2.sample(G2.boat.x + 9, G2.boat.y).height) + Math.abs(G2.sample(G2.boat.x + 6, G2.boat.y + 3).height);
  G2.render();
  ok('big maps keep full detail and simulate ripples only near the view', Math.abs(G2.top.cell - 1) < 0.01 && winCells < allCells * 0.4 && rip2 > 0.01 && G2.gl.getError() === 0,
    'grid ' + G2.top.W + 'x' + G2.top.H + ', simulating ' + winCells + ' of ' + allCells + ' cells, ripple ' + rip2.toFixed(3));
  G2.dispose();

  // lightning on your terms
  const L2 = mk({ mode: 'side', mood: 'storm', lightning: 0 });
  let n0 = 0; L2.on('lightning', () => n0++);
  for (let i = 0; i < 60 * 20; i++) L2.update(1 / 60);
  L2.setOptions({ mood: 'sunset', lightning: 30 }); let n1 = 0; L2.off('lightning'); L2.on('lightning', () => n1++);
  for (let i = 0; i < 60 * 20; i++) L2.update(1 / 60);
  ok('lightning: off in a storm, or any rate in any mood', n0 === 0 && n1 >= 4, 'storm with lightning 0: ' + n0 + ' strikes in 20 s; sunset at 30 a minute: ' + n1);

  // medium-precision GPUs: every animation phase handed to the shaders stays small, even after a day
  L2.setOptions({ mode: 'top', mood: 'night', rain: 0.5, lightning: -1 });
  L2.time = 86400 * 1.37; L2.update(1 / 60); L2.render();
  const g3 = L2.gl, read = (pr, n) => { const l = pr.loc(n); return l ? Array.from(g3.getUniform(pr.p, l)) : [NaN]; };
  const topP = L2._progs.topWater, ph = { rip: read(topP, 'uRipOff'), fr: read(topP, 'uFr'), ang: read(topP, 'uAng') };
  L2.setOptions({ mode: 'side' }); L2.time = 86400 * 1.37; L2.update(1 / 60); L2.render();
  ph.cells = read(L2._progs.sideWater, 'uCells').slice(0, 2);
  const small = ph.rip.every((v) => v >= 0 && v < 1) && ph.fr.every((v) => v >= 0 && v < 1) && ph.ang.every((v) => v >= 0 && v < 6.3) && ph.cells.every((v) => v >= 0 && v < 256);
  ok('animation phases stay small after a day of running', small && g3.getError() === 0 && typeof L2.stats.highp === 'boolean' && L2.stats.gpu.length > 0, 'uAng ' + ph.ang.map((v) => v.toFixed(2)).join(',') + ' · GPU ' + L2.stats.gpu.slice(0, 40) + '… · highp ' + L2.stats.highp);
  L2.dispose();

  // floating things bump into each other
  const K2 = mk({ mode: 'side', floaters: false, scenery: false });
  const c1 = K2.addFloater(200, 60, { kind: 'crate', size: 22 }), c2 = K2.addFloater(200, 20, { kind: 'crate', size: 22 }), c3 = K2.addFloater(230, 40, { kind: 'barrel', size: 18 });
  for (let i = 0; i < 900; i++) K2.update(1 / 60);
  let worstOv = 0;
  for (const [p, q] of [[c1, c2], [c1, c3], [c2, c3]]) { const ox = (p.w + q.w) * 0.45 - Math.abs(p.x - q.x); if (ox > 0 && Math.abs(p.y - q.y) < (p.h + q.h) * 0.3) worstOv = Math.max(worstOv, ox); }
  ok('floating things push each other apart instead of overlapping', worstOv < 2 && [c1, c2, c3].every((f) => f.sub > 0.3), 'worst side-by-side overlap ' + worstOv.toFixed(1) + ', all floating');
  K2.dispose();
  const Q2 = mk({ mode: 'top', floaters: false, land: 'none' });
  const bq = Q2.boat; bq.auto = false; bq.x = 60; bq.y = 45; bq.heading = 0;
  const cq = Q2.addFloater(72, 45, { kind: 'crate', size: 3 });
  Q2.input.up = true;
  for (let i = 0; i < 90; i++) Q2.update(1 / 60);
  ok('the top-view boat shoves crates out of its way', cq.x - bq.x > 4, 'crate ' + (cq.x - bq.x).toFixed(1) + ' ahead of the boat');
  Q2.dispose();

  // your own 3D islands
  const I2 = mk({ mode: '3d', islands: [{ x: 0, z: -60, r: 30, hill: 12 }, { x: 120, z: -10, r: 15, hill: 4 }] });
  I2.update(1 / 60); I2.render();
  ok('3D islands can be laid out by hand', I2.islands.length === 2 && I2._terrainHeight(0, -60) > 8 && I2._terrainHeight(120, -10) > 2 && I2._terrainHeight(60, -35) < -3 && I2.gl.getError() === 0,
    'peaks ' + I2._terrainHeight(0, -60).toFixed(1) + ' m and ' + I2._terrainHeight(120, -10).toFixed(1) + ' m, water between ' + I2._terrainHeight(60, -35).toFixed(1) + ' m');
  I2.dispose();

  // benchmark
  const B2 = mk({ mode: 'top' }, 160, 90);
  const bm = B2.benchmark(2);
  ok('benchmark times each quality', ['potato', 'low', 'medium', 'high'].every((k) => bm.ms[k] > 0) && bm.recommended in bm.ms && B2.opts.quality === 'low', JSON.stringify(bm));
  B2.dispose();
  return out;
});

let failed = 0;
for (const r of results) { console.log((r.pass ? 'PASS ' : 'FAIL ') + r.name + (r.info ? '  (' + r.info + ')' : '')); if (!r.pass) failed++; }
if (errors.length) { console.log('console errors:'); errors.forEach((e) => console.log('  ' + e)); }
await browser.close();
process.exit(failed || errors.length ? 1 : 0);
