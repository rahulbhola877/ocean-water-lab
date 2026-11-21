// Render the lab's film (its tour of shots, with captions and sound) to an MP4, offline,
// through the test API, so the result is smooth however slowly this machine draws.
//   node tools/film.mjs <out.mp4> [width] [height] [fps] [reel|new]
//   node tools/film.mjs /tmp/whats-new.mp4 1280 720 30 new
// "new" is the What's new film (#whatsnew). Needs: npm i playwright, and a Chrome or
// Chromium with WebCodecs (set CHROME to its path if needed).
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
const root = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const [out = '/tmp/film.mp4', w = '1280', h = '720', fps = '30', which = 'reel'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, headless: true,
  args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1, acceptDownloads: true });
const logs = [];
page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
const hash = process.env.QUALITY === 'low' ? '#test' : '#test-high';            // QUALITY=low: smaller FFT and simulations, much faster on a software GPU
await page.goto(pathToFileURL(join(root, 'demo', 'dist', 'index.html')).href + hash + (which === 'new' ? '&whatsnew' : ''), { waitUntil: 'load' });
await page.waitForFunction(() => document.body.classList.contains('ready') || document.body.classList.contains('failed'), null, { timeout: 300000 });
// quick tests: SHOTS=2 keeps the first two shots, TRIM=1 cuts every shot to 1 s
await page.evaluate(([n, trim]) => {
  const T = window.OceanLab.TOUR;
  if (n) T.splice(+n);
  if (trim) T.forEach((s) => { s.dur = Math.min(s.dur, +trim); });
}, [process.env.SHOTS || 0, process.env.TRIM || 0]);
const download = page.waitForEvent('download', { timeout: 0 });
const t0 = Date.now();
await page.evaluate(([w, h, fps]) => { window.OceanLab.renderFilm(w, h, fps); }, [+w, +h, +fps]);
for (;;) {
  await page.waitForTimeout(15000);
  const st = await page.evaluate(() => ({ on: window.OceanLab.film.on, frame: window.OceanLab.film.frame, total: window.OceanLab.film.total, note: document.getElementById('note').textContent }));
  const el = (Date.now() - t0) / 1000;
  console.log(`frame ${st.frame}/${st.total}  ${el.toFixed(0)} s  ${(el / Math.max(st.frame, 1)).toFixed(2)} s/frame  ${st.on ? '' : st.note}`);
  if (!st.on) { if (!/Film rendered|Saved/.test(st.note)) { console.log('failed:', st.note, logs.slice(0, 3).join(' | ')); process.exit(1); } break; }
}
await (await download).saveAs(out);
console.log('saved', out, logs.slice(0, 3).join(' | '));
await browser.close();
