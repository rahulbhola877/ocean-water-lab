// Physics checks for the full lab: capsizing, breaking crests, flooding and righting, depth fade,
// wind drift, currents, surf, collisions. Runs the real demo on the analytic sea with nothing drawn.
//   node demo/build.mjs && node tools/physics.mjs          (or: node tools/physics.mjs stormBoat)
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({ headless: true, args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 200, height: 125 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(pathToFileURL(join(root, 'demo', 'dist', 'index.html')).href + '#test-gerstner', { waitUntil: 'load' });
await page.waitForFunction(() => document.body.classList.contains('ready') || document.body.classList.contains('failed'), null, { timeout: 120000 });
const R = {};
const which = process.argv[2] || 'all';
const run = (name, fn, arg) => (which === 'all' || which === name) ? page.evaluate(fn, arg).then((v) => { R[name] = v; console.log('     ' + name, JSON.stringify(v)); }) : null;
let failed = 0;
const check = (name, pass, info) => { if (!R[name.split(':')[0]]) return; console.log((pass ? 'PASS ' : 'FAIL ') + name + '  (' + info + ')'); if (!pass) failed++; };
await page.evaluate(() => { const L = window.OceanLab; L.set('quality', 'low'); });
// a vessel run: max tilt, capsizes, flooding over `secs` of simulated time
const vesselRun = ({ scene, vessel, secs, wind, rogue, auto }) => {
  const L = window.OceanLab;
  L.scene(scene); L.resetBodies();
  if (wind !== undefined) L.set('wind', wind);
  if (rogue !== undefined) L.state.rogue = rogue;
  L.set('vessel', vessel); L.state.autopilot = auto !== false;
  L.step(360, 1 / 60);
  const b = L.boat.body, c0 = L.capsizes();
  let maxTilt = 0, maxFlood = 0, rightings = 0, wasR = false, brkHits = 0;
  for (let i = 0; i < secs * 2; i++) {
    L.step(30, 1 / 60);
    maxTilt = Math.max(maxTilt, b.tilt); maxFlood = Math.max(maxFlood, b.flood);
    if (b.righting > 0 && !wasR) rightings++; wasR = b.righting > 0;
  }
  return { brk: { accel: +L.brk.accel.toFixed(3), share: +L.brk.share.toFixed(4), speed: +L.brk.speed.toFixed(1) }, hs: +L.sea.hs.toFixed(1),
    maxTiltDeg: Math.round(maxTilt * 57.3), capsizes: L.capsizes() - c0, rightings, maxFlood: +maxFlood.toFixed(2), alive: L.bodies.indexOf(b) >= 0,
    speed: +(L.boat.speed || 0).toFixed(1), overlap: +L.overlap().toFixed(2) };
};
await run('breezeBoat', vesselRun, { scene: 'tropical', vessel: 'speedboat', secs: 60, wind: 9, rogue: 0 });
await run('stormBoat', vesselRun, { scene: 'hurricane', vessel: 'speedboat', secs: 180, rogue: 0 });
await run('stormShip', vesselRun, { scene: 'hurricane', vessel: 'ship', secs: 180, rogue: 0 });
await run('rogueBoat', vesselRun, { scene: 'hurricane', vessel: 'speedboat', secs: 180 });
// turned over by hand: it stays over and floods; R rights it
await run('inverted', () => {
  const L = window.OceanLab;
  L.scene('tropical'); L.resetBodies(); L.set('wind', 3); L.state.rogue = 0; L.rogue.on = false; L.rogue.h = 0; L.set('vessel', 'speedboat'); L.state.autopilot = false;   // and no rogue left over from the run before
  L.step(120, 1 / 60);
  const b = L.boat.body; b.q = [1, 0, 0, 0]; b.w = [0, 0, 0];
  L.step(600, 1 / 60);
  const before = { tiltDeg: Math.round(b.tilt * 57.3), capsized: b.capsized, flood: +b.flood.toFixed(2), wet: +b.wet.toFixed(2) };
  L.rightBody(b); L.step(240, 1 / 60);
  return { before, after: { tiltDeg: Math.round(b.tilt * 57.3), capsized: b.capsized, flood: +b.flood.toFixed(2) } };
});
// loose objects in the hurricane
await run('looseStorm', () => {
  const L = window.OceanLab;
  L.scene('hurricane'); L.resetBodies(); L.state.rogue = 0; L.step(360, 1 / 60);
  const loose = L.bodies.filter((b) => !b.isBoat);
  let max = 0;
  for (let i = 0; i < 240; i++) { L.step(30, 1 / 60); loose.forEach((b) => { max = Math.max(max, b.tilt); }); }
  return { n: loose.length, alive: loose.filter((b) => L.bodies.indexOf(b) >= 0).length, overNow: loose.filter((b) => b.tilt > Math.PI / 2).length, maxTiltDeg: Math.round(max * 57.3), overlap: +L.overlap().toFixed(2) };
});
// depth fade, wind drift, current
await run('underwater', () => {
  const L = window.OceanLab;
  L.scene('hurricane'); L.state.rogue = 0; L.state.surf = 0; L.step(120, 1 / 60);
  let s0 = 0, s1 = 0, s2 = 0, o = {};
  for (let i = 0; i < 200; i++) {
    const x = 300 + i * 13.7, z = -400 + i * 7.1;
    L.waterAt(x, 50, z, 1, null, 10, o); const h = o.height;
    L.waterAt(x, h, z, 1, null, 10, o); s0 += Math.hypot(o.vx, o.vy, o.vz);
    L.waterAt(x, h - 10, z, 1, null, 10, o); s1 += Math.hypot(o.vx, o.vy, o.vz);
    L.waterAt(x, h - 40, z, 1, null, 10, o); s2 += Math.hypot(o.vx, o.vy, o.vz);
  }
  return { lp: Math.round(L.sea.lp), surface: +(s0 / 200).toFixed(2), at10m: +(s1 / 200).toFixed(2), at40m: +(s2 / 200).toFixed(2) };
});
await run('drift', () => {
  const L = window.OceanLab, out = {};
  for (const [name, wind, cur] of [['breeze', 9, 0], ['current1ms', 2.5, 1]]) {
    L.scene('tropical'); L.resetBodies(); L.set('wind', wind); L.state.rogue = 0; L.state.current = cur; L.state.currentDir = 90; L.state.gusts = 0;
    L.step(400, 1 / 60);
    const c = L.bodies.find((b) => b.type === 'crate'), p0 = c.pos.slice();
    L.step(1800, 1 / 60);
    const wd = (cur ? 90 : L.state.windDir) * Math.PI / 180, dx = c.pos[0] - p0[0], dz = c.pos[2] - p0[2];
    out[name] = { along: +((dx * Math.cos(wd) + dz * Math.sin(wd)) / 30).toFixed(2), across: +((-dx * Math.sin(wd) + dz * Math.cos(wd)) / 30).toFixed(2) };
    L.state.current = 0;
  }
  return out;
});
await run('surf', () => {
  const L = window.OceanLab;
  L.scene('surfbeach'); L.state.rogue = 0; L.step(60, 1 / 60);
  // walk in from deep water towards the island until the sea bed is 2.5 m down
  let x = 0, z = 0, best = null;
  for (let r = 300; r > 0; r -= 1) { for (const a of [0, 1.2, 2.4, 3.6, 4.8]) { const px = Math.cos(a) * r, pz = Math.sin(a) * r, d = L.depthAt(px, pz); if (!best && d > 2 && d < 3) best = [px, pz, d]; } if (best) break; }
  if (!best) return 'no surf zone found';
  [x, z] = best;
  let umax = 0, umin = 0, mean = 0, o = {}, n = 0, brk = 0;
  const gx = L.depthAt(x + 1.5, z) - L.depthAt(x - 1.5, z), gz = L.depthAt(x, z + 1.5) - L.depthAt(x, z - 1.5), gl = Math.hypot(gx, gz);
  for (let t = 0; t < 30; t += 0.05) {
    L.waterAt(x, -10, z, 1, null, t, o);  // deep point: the surf moves it too
    L.waterAt(x, o.height - 0.2, z, 1, null, t, o);
    const u = -(o.vx * gx + o.vz * gz) / gl;
    umax = Math.max(umax, u); umin = Math.min(umin, u); mean += u; n++; if (o.bore > 0) brk++;
  }
  return { bed: +best[2].toFixed(1), shorewardMax: +umax.toFixed(2), seawardMax: +(-umin).toFixed(2), mean: +(mean / n).toFixed(2), boreFrac: +(brk / n).toFixed(2) };
});
const r = R;
check('breezeBoat: a speedboat in a breeze stays upright', r.breezeBoat && r.breezeBoat.capsizes === 0 && r.breezeBoat.maxTiltDeg < 60, r.breezeBoat && r.breezeBoat.maxTiltDeg + ' deg max');
check('stormBoat: hurricane seas throw the speedboat about', r.stormBoat && r.stormBoat.alive && r.stormBoat.maxTiltDeg > 30 && r.stormBoat.brk.share > 0.05, r.stormBoat && r.stormBoat.maxTiltDeg + ' deg max, ' + r.stormBoat.capsizes + ' capsizes, breaking on ' + (r.stormBoat.brk.share * 100).toFixed(1) + '% of the sea');
check('stormShip: the ship heels but stays up', r.stormShip && r.stormShip.alive && r.stormShip.maxTiltDeg < 80 && r.stormShip.maxTiltDeg > 15, r.stormShip && r.stormShip.maxTiltDeg + ' deg max');
check('inverted: a boat turned over stays over, floods, and R rights her', r.inverted && r.inverted.before.capsized && r.inverted.before.flood > 0.5 && r.inverted.after.tiltDeg < 35 && !r.inverted.after.capsized, r.inverted && JSON.stringify(r.inverted));
check('looseStorm: crates and barrels tumble but do not pass through each other', r.looseStorm && r.looseStorm.alive === r.looseStorm.n && r.looseStorm.overlap < 0.4, r.looseStorm && 'deepest overlap ' + r.looseStorm.overlap + ' m');
check('underwater: wave motion fades with depth as exp(-2 pi d / L)', r.underwater && Math.abs(r.underwater.at10m / r.underwater.surface - Math.exp(-2 * Math.PI * 10 / r.underwater.lp)) < 0.06, r.underwater && JSON.stringify(r.underwater));
check('drift: the wind sets a crate drifting (leeway) and a current carries it', r.drift && r.drift.breeze.along > 0.04 && r.drift.breeze.along < 0.6 && Math.abs(r.drift.current1ms.along - 1) < 0.25, r.drift && JSON.stringify(r.drift));
check('surf: the water under a surf wave runs shoreward', r.surf && r.surf.shorewardMax > 1, r.surf && JSON.stringify(r.surf));
console.log('console errors', errors.length, errors.slice(0, 3));
await browser.close();
process.exit(failed || errors.length ? 1 : 0);
