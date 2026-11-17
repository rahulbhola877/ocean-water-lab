// Builds Water Lite:
//   lite/dist/water-lite.min.js   the library, minified (drop it into any game)
//   lite/dist/index.html          the demo as one self-contained page
// Run: node lite/build.mjs   (uses esbuild for minifying if it is installed, else copies the source)
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, 'dist');
mkdirSync(dist, { recursive: true });
const src = readFileSync(join(here, 'water-lite.js'), 'utf8');

let min = src;
try {
  const mod = await import(process.env.ESBUILD ? 'file://' + process.env.ESBUILD : 'esbuild');   // ESBUILD=/path/to/esbuild/lib/main.js
  const esbuild = mod.transform ? mod : mod.default;
  min = (await esbuild.transform(src, { minify: true, target: 'es5', legalComments: 'inline' })).code;
} catch (e) {
  console.warn('esbuild not found, writing the unminified library (' + e.message.split('\n')[0] + ')');
}
writeFileSync(join(dist, 'water-lite.min.js'), min);

const page = readFileSync(join(here, 'index.html'), 'utf8');
const tag = '<script src="water-lite.js"></script>';
if (!page.includes(tag)) throw new Error('index.html no longer loads water-lite.js');
const muxTag = '<script src="vendor/mp4-muxer.min.js"></script>';
const mux = '/*! mp4-muxer 5.2.2 (c) 2023 Vanilagy, MIT License, https://github.com/Vanilagy/mp4-muxer */\n' + readFileSync(join(here, 'vendor', 'mp4-muxer.min.js'), 'utf8');
writeFileSync(join(dist, 'index.html'), page.replace(tag, () => '<script>\n' + min + '\n</script>').replace(muxTag, () => '<script>\n' + mux + '\n</script>'));

const kb = (n) => (n / 1024).toFixed(1) + ' KB';
console.log('water-lite.js', kb(src.length), '-> water-lite.min.js', kb(min.length), '| dist/index.html', kb(readFileSync(join(dist, 'index.html')).length));
