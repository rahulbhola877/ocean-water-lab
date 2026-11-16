/*!
 * Water Lite 2: clear, stylized real-time water for low-end browser games.
 * Part of Ocean Water Lab, MIT License. https://github.com/rahulbhola877/ocean-water-lab
 *
 * Everything under the surface is drawn first; the water is then drawn from it, so you see the
 * seabed, rocks, fish and the sunken half of anything floating, bent by the waves and tinted by
 * how deep it is, with moving caustic light on the bottom.
 *
 *   '3d'    islands and lagoons: refraction, depth colour, caustics, reflections, shore foam
 *   'side'  a 2D side view: seabed, reef, seaweed, fish and a dock seen through the water
 *   'top'   a 2D top-down view: the seabed shows through, ripples bounce off coasts, waves wash
 *           up the beach and floating things cast shadows on the bottom
 *   styles: realistic, toon, pixel, lowpoly, retro, ink (the simulation is the same in every one)
 *
 * WebGL 1, no extensions required (OES_standard_derivatives is used when present), no
 * dependencies, ES5.
 *
 *   var water = new WaterLite(canvas, { mode: 'top', style: 'pixel' });
 *   function frame(dt) { water.update(dt); water.render(); }
 */
(function (root) {
  'use strict';

  var PALETTES = {
    none: null,
    pico8: ['#000000', '#1d2b53', '#7e2553', '#008751', '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8', '#ff004d', '#ffa300', '#ffec27', '#00e436', '#29adff', '#83769c', '#ff77a8', '#ffccaa'],
    sweetie16: ['#1a1c2c', '#5d275d', '#b13e53', '#ef7d57', '#ffcd75', '#a7f070', '#38b764', '#257179', '#29366f', '#3b5dc9', '#41a6f6', '#73eff7', '#f4f4f4', '#94b0c2', '#566c86', '#333c57'],
    gameboy: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'],
    ocean8: ['#07132a', '#0c2d58', '#13508a', '#1f7fb8', '#43b5da', '#8fe3ea', '#f1fbf7', '#f2d48c'],
    mono: ['#0e1424', '#efeadf']
  };
  // pixel: size of a game pixel in CSS px; bands: colour steps (0 = smooth); crisp: hard-edged foam, caustics and glints
  var STYLES = {
    realistic: { id: 0, pixel: 1, palette: 'none', dither: 0, bits: 0, scan: 0, snap: 0, bands: 0, crisp: 0, murk: 1 },
    toon: { id: 1, pixel: 1, palette: 'none', dither: 0, bits: 0, scan: 0, snap: 0, bands: 3, crisp: 1, murk: 1.3 },
    pixel: { id: 2, pixel: 4, palette: 'sweetie16', dither: 0.25, bits: 0, scan: 0, snap: 0, bands: 4, crisp: 1, murk: 0.95 },
    lowpoly: { id: 3, pixel: 1, palette: 'none', dither: 0, bits: 0, scan: 0, snap: 0, bands: 0, crisp: 0, murk: 1.1 },
    retro: { id: 4, pixel: 3, palette: 'none', dither: 0.6, bits: 5, scan: 0.28, snap: 1, bands: 0, crisp: 0, murk: 1.1 },
    ink: { id: 5, pixel: 1, palette: 'none', dither: 0, bits: 0, scan: 0, snap: 0, bands: 0, crisp: 1, murk: 1 }
  };
  // terrain: 3D island mesh size; refr: resolution of the under-water pass; refl: island reflections in 3D
  var QUALITY = {
    potato: { scale: 0.5, grid: 64, waves: 4, sim: 112, dpr: 1, sub: 2, terrain: 81, refr: 0.5, refl: false },
    low: { scale: 0.75, grid: 96, waves: 8, sim: 160, dpr: 1, sub: 2, terrain: 121, refr: 0.75, refl: true },
    medium: { scale: 1, grid: 128, waves: 12, sim: 224, dpr: 1.5, sub: 3, terrain: 161, refr: 1, refl: true },
    high: { scale: 1, grid: 180, waves: 16, sim: 288, dpr: 2, sub: 3, terrain: 201, refr: 1, refl: true },
    // auto: low's simulation, with the drawing resolution adjusted from frame times (0.4 .. 1)
    auto: { scale: 1, grid: 96, waves: 8, sim: 160, dpr: 1.5, sub: 2, terrain: 121, refr: 0.75, refl: true, auto: true }
  };
  // deep: colour of deep water; shallow: lit shallow water; tint: the colour water gives what you see through it
  // (sets how fast each colour is absorbed; defaults to shallow)
  var THEMES = {
    realistic: { deep: '#05346c', shallow: '#18a9bd', foam: '#f4f8f6', skyTop: '#3a7ad0', skyHorizon: '#c3dcef', sun: '#fff3dc', sand: '#ecd8a8', grass: '#5b9a3a', rock: '#8c8276', wood: '#9a6a3a', paint: '#c0392b', paper: '#f3efe4', ink: '#1d2740' },
    toon: { deep: '#0a4c9c', shallow: '#12c6dc', foam: '#ffffff', skyTop: '#45a6ff', skyHorizon: '#c6efff', sun: '#fff6b0', sand: '#f7dc96', grass: '#5cc444', rock: '#9b9087', wood: '#c8833f', paint: '#e0453a', paper: '#f3efe4', ink: '#1a2238' },
    pixel: { deep: '#3b5dc9', shallow: '#41a6f6', tint: '#257179', foam: '#f4f4f4', skyTop: '#3b5dc9', skyHorizon: '#73eff7', sun: '#ffcd75', sand: '#ffcd75', grass: '#38b764', rock: '#566c86', wood: '#ef7d57', paint: '#b13e53', paper: '#f4f4f4', ink: '#1a1c2c' },
    lowpoly: { deep: '#0c3966', shallow: '#22b5bb', foam: '#eef8f4', skyTop: '#f2906c', skyHorizon: '#ffd9a8', sun: '#fff1c1', sand: '#efcb95', grass: '#79a95a', rock: '#8e8075', wood: '#b07a48', paint: '#c2453a', paper: '#f3efe4', ink: '#1d2740' },
    retro: { deep: '#0d3966', shallow: '#2ba3bb', foam: '#e8f3ef', skyTop: '#3a5aa0', skyHorizon: '#bcd2e2', sun: '#fff0c0', sand: '#d9b97c', grass: '#5c8a3e', rock: '#857b70', wood: '#9a6a3a', paint: '#b8322a', paper: '#f3efe4', ink: '#1d2740' },
    ink: { deep: '#1d2740', shallow: '#6d86a8', foam: '#f3efe4', skyTop: '#f3efe4', skyHorizon: '#f3efe4', sun: '#f3efe4', sand: '#efe6d2', grass: '#e6e1d0', rock: '#d8d2c4', wood: '#f3efe4', paint: '#f3efe4', paper: '#f3efe4', ink: '#1d2740' }
  };
  var DEFAULTS = {
    mode: '3d', style: 'realistic', quality: 'low',
    palette: 'auto', pixelSize: 0, dither: -1,          // 'auto' / 0 / -1 = use the style's own
    wind: 7, windDir: 30, waveHeight: 1, choppiness: 0.7, foam: 1,
    clarity: 1,                                           // how far you see into the water (2 = twice as far)
    reflections: true,                                    // islands mirrored in the 3D sea; the world above mirrored in the side view
    colors: null,                                         // override any THEMES key, e.g. { deep: '#002244' }
    sunElevation: 42, sunAzimuth: 215,                    // a mood moves the sun unless you set these yourself
    mood: 'day',                                          // 'day', 'sunset', 'night' or 'storm'
    rain: -1,                                             // 0 .. 1; -1 = the mood's own (storms rain)
    lightning: -1,                                        // random strikes a minute; 0 = none; -1 = the mood's own (storms: about 8)
    scenery: true,                                        // false: only the water (transparent around it with { transparent: true })
    level: 0.55,                                          // side view: water line, fraction of the height from the top
    land: 'islands',                                      // top view: 'islands', 'none' or function (u, v) -> true/height
    mapSize: [160, 90],                                   // top view: world size; bigger maps get more islands and scroll
    zoom: 1,                                              // top view: 1 shows the whole map, 2 half as wide, ...
    worldWidth: 480,                                      // side view: world width; wider than 480 scrolls with camera2d.x
    islands: null,                                        // 3D: your own layout, [{ x, z, r, hill }, ...]; null = made from seed
    seed: 7, floaters: true, boat: true
  };
  // 2D bodies: height / width, the part that floats (heights from the centre, y down), centre of mass, density
  var KIND2D = {
    crate: { ratio: 1, hull: [-0.5, 0.5], com: 0, density: 0.55 },
    barrel: { ratio: 1.15, hull: [-0.5, 0.5], com: 0, density: 0.6 },
    duck: { ratio: 0.9, hull: [-0.1, 0.36], com: 0.16, density: 0.35 },
    boat: { ratio: 0.8, hull: [0.18, 0.42], com: 0.3, density: 0.45 }
  };
  // light: multiplies what is not lit by the sun or moon; sun: multiplies the theme's sun colour, or moon: replaces it;
  // desat: how much colour drains from land and objects (moonlight); sky colours are mixed in (skyMid: a third stop);
  // elev/az place the sun or moon; ink style swaps in its own paper and ink
  var MOODS = {
    day: { light: [1, 1, 1], sun: [1, 1, 1] },
    sunset: { light: [0.86, 0.66, 0.58], sun: [1.1, 0.7, 0.42], soft: 0.35, skyTop: '#433a7e', skyMid: '#c4688a', skyHorizon: '#ffa368', elev: 7, az: 240, paper: '#f2dfc2', ink: '#3b2a2a' },
    night: { light: [0.2, 0.26, 0.42], moon: [0.36, 0.42, 0.58], desat: 0.6, soft: 0.45, skyTop: '#040a1c', skyHorizon: '#172a52', elev: 34, az: 235, stars: 1, glow: 1, paper: '#1d2740', ink: '#efeadf' },
    storm: { light: [0.5, 0.55, 0.6], moon: [0.36, 0.38, 0.42], desat: 0.35, soft: 0.3, skyTop: '#2e3741', skyHorizon: '#6a757d', elev: 55, rain: 0.7, wind: 1.6, lightning: 1, overcast: 1, murk: 1.35, paper: '#dfe1df', ink: '#1f2a33' }
  };
  var MAXD = 30;            // 3D: deepest water the under-water pass records, metres
  var SIDE = { W: 480, unit: 0.05, cliff: [46, 9, 5], deckX: 356, posts: [366, 414, 462] };

  function hex(h) { var n = parseInt(String(h).slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function rng(seed) { var s = (seed >>> 0) || 1; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function hash2(x, y, s) { var h = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return h - Math.floor(h); }
  function vnoise(x, y, s) {
    var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    return (hash2(ix, iy, s) * (1 - u) + hash2(ix + 1, iy, s) * u) * (1 - v) + (hash2(ix, iy + 1, s) * (1 - u) + hash2(ix + 1, iy + 1, s) * u) * v;
  }
  var G = 9.81;

  // ======================================================================================
  // Procedural textures, made once: tileable 256 x 256 RGBA.
  //   water:  RG ripple slope, B ripple height, A foam lace (bubble walls)
  //   detail: R caustics (light focused by ripples onto a floor), G clouds, B noise, A pebbles
  // ======================================================================================
  function tileNoise(N, cells, amps, salt) {
    // lattice values and per-column weights are worked out once per octave, not per pixel
    var out = new Float32Array(N * N), lo = 1e9, hi = -1e9, x, y, o, k;
    for (o = 0; o < cells.length; o++) {
      var L = cells[o], A = amps[o], lat = new Float64Array(L * L), I0 = new Int32Array(N), I1 = new Int32Array(N), U = new Float64Array(N);
      for (k = 0; k < L * L; k++) lat[k] = hash2(k % L, Math.floor(k / L), salt + o);
      for (x = 0; x < N; x++) { var fx = x / N * L, ix = Math.floor(fx), tx = fx - ix; I0[x] = ix; I1[x] = (ix + 1) % L; U[x] = tx * tx * (3 - 2 * tx); }
      for (y = 0; y < N; y++) {
        var r0 = I0[y] * L, r1 = I1[y] * L, w = U[y], row = y * N;
        for (x = 0; x < N; x++) {
          var u = U[x], a = I0[x], b = I1[x];
          out[row + x] += A * ((lat[r0 + a] * (1 - u) + lat[r0 + b] * u) * (1 - w) + (lat[r1 + a] * (1 - u) + lat[r1 + b] * u) * w);
        }
      }
    }
    for (x = 0; x < N * N; x++) { if (out[x] < lo) lo = out[x]; if (out[x] > hi) hi = out[x]; }
    for (x = 0; x < N * N; x++) out[x] = (out[x] - lo) / (hi - lo);
    return out;
  }
  function worley(N, cells, salt) {
    // feature points on a grid padded by one cell on each side, so neighbours need no wrapping
    var F1 = new Float32Array(N * N), F2 = new Float32Array(N * N), P = cells + 2, qx = new Float64Array(P * P), qy = new Float64Array(P * P), i, j, x, y;
    for (j = 0; j < P; j++) for (i = 0; i < P; i++) {
      var wi = (i - 1 + cells) % cells, wj = (j - 1 + cells) % cells;
      qx[j * P + i] = i - 1 + hash2(wi, wj, salt); qy[j * P + i] = j - 1 + hash2(wi, wj, salt + 17);
    }
    for (y = 0; y < N; y++) {
      var fy = y / N * cells, cy = Math.floor(fy);
      for (x = 0; x < N; x++) {
        var fx = x / N * cells, cx = Math.floor(fx), d1 = 81, d2 = 81;
        for (var oy = 0; oy < 3; oy++) {
          var base = (cy + oy) * P + cx;
          for (var ox = 0; ox < 3; ox++) {
            var dx = qx[base + ox] - fx, dy = qy[base + ox] - fy, d = dx * dx + dy * dy;   // squared; sqrt once below
            if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
          }
        }
        F1[y * N + x] = Math.sqrt(d1); F2[y * N + x] = Math.sqrt(d2);
      }
    }
    return { f1: F1, f2: F2 };
  }
  function genTextures(seed) {
    var N = 256, NN = N * N, R = rng(seed * 977 + 31), i, x, y;
    var H = new Float32Array(NN), GX = new Float32Array(NN), GY = new Float32Array(NN), LX = new Float32Array(NN), LY = new Float32Array(NN);
    var EXPT = new Float32Array(1030);
    for (i = 0; i < 1030; i++) EXPT[i] = Math.exp(Math.min(i, 1024) / 512 - 2);          // exp(sin - 1)
    var waves = [];
    while (waves.length < 48) {                          // ripples: sharp-crested waves that wrap around the tile
      var f = 3 * Math.pow(9, R()), th = (waves.length + R()) / 48 * 6.2832 * 2.618;
      var kx = Math.round(f * Math.cos(th)), ky = Math.round(f * Math.sin(th));
      if (!kx && !ky) continue;
      var fl = Math.sqrt(kx * kx + ky * ky);
      waves.push({ kx: kx, ky: ky, a: (0.6 + 0.4 * R()) / fl, ph: R() * 6.2832, low: fl <= 7 });
    }
    var TAU = Math.PI * 2, mask = N - 1, tA = new Float64Array(N), tX = new Float64Array(N), tY = new Float64Array(N);
    waves.forEach(function (W) {
      // whole-number wave vectors: the phase at (x, y) is (kx x + ky y) mod N, so one table per wave covers the tile
      var gxs = W.a * TAU * W.kx / N, gys = W.a * TAU * W.ky / N;
      for (var p = 0; p < N; p++) {
        var t = TAU * p / N + W.ph, e = EXPT[((Math.sin(t) + 1) * 512) | 0], de = e * Math.cos(t);
        tA[p] = W.a * e; tX[p] = gxs * de; tY[p] = gys * de;
      }
      for (y = 0; y < N; y++) {
        var ph = (W.ky * y) & mask, row = y * N;
        for (x = 0; x < N; x++) {
          var k = row + x;
          H[k] += tA[ph]; GX[k] += tX[ph]; GY[k] += tY[ph];
          if (W.low) { LX[k] += tX[ph]; LY[k] += tY[ph]; }
          ph = (ph + W.kx) & mask;
        }
      }
    });
    var rms = 0, hmin = 1e9, hmax = -1e9;
    for (i = 0; i < NN; i++) { rms += GX[i] * GX[i] + GY[i] * GY[i]; if (H[i] < hmin) hmin = H[i]; if (H[i] > hmax) hmax = H[i]; }
    var S = 0.42 / (Math.sqrt(rms / NN) || 1);
    var w1 = worley(N, 9, 11), w2 = worley(N, 19, 23), water = new Uint8Array(NN * 4);
    for (i = 0; i < NN; i++) {
      var nx = -GX[i] * S, ny = -GY[i] * S, il = 1 / Math.sqrt(nx * nx + ny * ny + 1);
      water[i * 4] = Math.round((nx * il * 0.5 + 0.5) * 255);
      water[i * 4 + 1] = Math.round((ny * il * 0.5 + 0.5) * 255);
      water[i * 4 + 2] = Math.round((H[i] - hmin) / (hmax - hmin) * 255);
      var lace = Math.max(1 - smooth(0, 0.2, w1.f2[i] - w1.f1[i]), 0.75 * (1 - smooth(0, 0.14, w2.f2[i] - w2.f1[i])));
      water[i * 4 + 3] = Math.round(clamp(lace * 0.75 + 0.25 * (1 - Math.min(w2.f1[i] * 1.4, 1)), 0, 1) * 255);
    }
    // caustics: light through the long ripples, gathered on a floor below (photon splatting)
    var hxx = 0;
    for (y = 0; y < N; y++) for (x = 0; x < N; x++) { var dd = (LX[y * N + (x + 1) % N] - LX[y * N + (x + N - 1) % N]) * 0.5; hxx += dd * dd; }
    var K = 0.9 / (Math.sqrt(hxx / NN) || 1), acc = new Float32Array(NN);
    for (y = 0; y < N; y++) for (x = 0; x < N; x++) for (var sy = 0; sy < 2; sy++) for (var sx = 0; sx < 2; sx++) {
      var fx = x + 0.25 + sx * 0.5, fy = y + 0.25 + sy * 0.5, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      var i00 = iy * N + ix, i10 = iy * N + (ix + 1) % N, i01 = ((iy + 1) % N) * N + ix, i11 = ((iy + 1) % N) * N + (ix + 1) % N;
      var gx = (LX[i00] * (1 - tx) + LX[i10] * tx) * (1 - ty) + (LX[i01] * (1 - tx) + LX[i11] * tx) * ty;
      var gy = (LY[i00] * (1 - tx) + LY[i10] * tx) * (1 - ty) + (LY[i01] * (1 - tx) + LY[i11] * tx) * ty;
      var X = fx - gx * K, Y = fy - gy * K, jx = Math.floor(X), jy = Math.floor(Y), ux = X - jx, uy = Y - jy;
      jx = ((jx % N) + N) % N; jy = ((jy % N) + N) % N;
      var jx1 = (jx + 1) % N, jy1 = (jy + 1) % N;
      acc[jy * N + jx] += (1 - ux) * (1 - uy); acc[jy * N + jx1] += ux * (1 - uy); acc[jy1 * N + jx] += (1 - ux) * uy; acc[jy1 * N + jx1] += ux * uy;
    }
    var clouds = tileNoise(N, [4, 8, 16, 32, 64], [0.5, 0.25, 0.14, 0.07, 0.04], 101);
    var noise = tileNoise(N, [8, 16, 32, 64], [0.5, 0.26, 0.15, 0.09], 202);
    var w3 = worley(N, 16, 303), detail = new Uint8Array(NN * 4);
    for (y = 0; y < N; y++) for (x = 0; x < N; x++) {
      var sum = 0;
      for (var by = -1; by <= 1; by++) for (var bx = -1; bx <= 1; bx++) sum += acc[((y + by + N) % N) * N + (x + bx + N) % N] * (bx === 0 && by === 0 ? 4 : (bx === 0 || by === 0 ? 2 : 1));
      i = y * N + x;
      detail[i * 4] = Math.round(clamp(sum / 64 / 3, 0, 1) * 255);   // 1 = average light, stored / 3
      detail[i * 4 + 1] = Math.round(clouds[i] * 255);
      detail[i * 4 + 2] = Math.round(noise[i] * 255);
      detail[i * 4 + 3] = Math.round(clamp(1 - w3.f1[i] * 1.5, 0, 1) * 255);
    }
    return { size: N, water: water, detail: detail };
  }

  // ======================================================================================
  // Shaders
  // ======================================================================================
  var FS_HEAD = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n';
  var VS_HEAD = 'precision highp float;\n';
  var COMMON = [
    'uniform float uStyle; uniform float uTime; uniform float uBands; uniform float uCrisp; uniform float uScenery;',
    'uniform vec3 uPaper; uniform vec3 uInk; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uSigma; uniform vec3 uFoamCol;',
    'uniform vec3 uSkyTop; uniform vec3 uSkyHor; uniform vec3 uSunCol; uniform vec3 uSunDir;',
    'uniform vec3 uSand; uniform vec3 uGrass; uniform vec3 uRock; uniform vec3 uWood;',
    'uniform vec2 uCloudOff; uniform sampler2D uDetail; uniform sampler2D uWaterTex;',
    // moods and weather: uLight dims what is not lit by uSunCol (night, storm); uGlow lights foam at night
    'uniform vec3 uLight; uniform vec3 uGlowCol; uniform float uGlow; uniform float uStars; uniform float uRain; uniform float uOvercast;',
    'uniform vec3 uSkyMid; uniform float uDesat;',
    // animation phases, worked out on the CPU and kept small, because phones whose GPUs only have medium precision
    // lose a growing time value within a minute or two: texture scrolls are wrapped to 0..1, angles to 0..2pi
    'uniform vec4 uRipOff; uniform vec4 uCauOff; uniform vec4 uScrl; uniform vec4 uScrl2; uniform vec4 uFr; uniform vec4 uAng; uniform vec4 uAng2; uniform vec4 uCells;',
    'vec3 moodTint(vec3 c) { return mix(c, vec3(dot(c, vec3(0.3, 0.59, 0.11))), uDesat); }   // objects lose colour by moonlight',
    'bool isStyle(float s) { return abs(uStyle - s) < 0.5; }',
    'bool smoothStyle() { return uBands < 0.5 && uCrisp < 0.5; }',
    'float hash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }',
    'float band(float x, float n) { return floor(clamp(x, 0.0, 0.999) * n) / (n - 1.0); }',
    'float qz(float x) { return uBands > 0.5 ? band(x, uBands) : x; }',
    'float cel(float d) { return uBands > 0.5 ? 0.5 + 0.5 * band(clamp(d * 1.2 + 0.15, 0.0, 1.0), 3.0) : d; }',
    'float thr(float x, float t, float w) { return uCrisp > 0.5 ? step(t, x) : smoothstep(t - w, t + w, x); }',
    'float hatch(float dark, vec2 fc) {',
    '  float a = step(fract((fc.x + fc.y) * 0.2), 0.22) * step(0.4, dark);',
    '  float b = step(fract((fc.x - fc.y) * 0.2), 0.22) * step(0.72, dark);',
    '  return max(a, b);',
    '}',
    'float lineAA(float d, float v, float px, float fb) {',
    '#ifdef HAS_DERIV',
    '  float w = max(fwidth(v), 1e-5) * px;',
    '#else',
    '  float w = fb;',
    '#endif',
    '  return 1.0 - smoothstep(w * 0.5, w, abs(d));',
    '}',
    'float iso(float v, float spacing, float px, float fb) { return lineAA((fract(v / spacing + 0.5) - 0.5) * spacing, v, px, fb); }',
    'float tnoise(vec2 p) { return texture2D(uDetail, p).b; }',
    // caustics: two drifting copies of the caustic map; where both are bright the light is focused
    'vec2 causticUv(vec2 p) {',
    '  vec2 warp = texture2D(uWaterTex, p * 0.6 + uCauOff.xy, 2.5).rg - 0.5;',
    '  return p + warp * 0.14 + uCauOff.zw;',
    '}',
    'float caustic(vec2 p) {                                               // about 0.2 .. 3, 0.8 on average',
    '  float c = texture2D(uDetail, causticUv(p)).r * 3.0;',
    '  return uCrisp > 0.5 ? 0.8 + 0.55 * step(1.15, c) : c;',
    '}',
    'vec3 causticRGB(vec2 p) {                                             // with the slight colour split of real caustics',
    '  if (!smoothStyle()) return vec3(caustic(p));',
    '  vec2 q = causticUv(p), o = vec2(0.0032, 0.0021);',
    '  return vec3(texture2D(uDetail, q + o).r, texture2D(uDetail, q).r, texture2D(uDetail, q - o).r) * 3.0;',
    '}',
    // ripple slope from two drifting layers of the ripple map
    'vec2 ripples(vec2 p) {',
    '  vec2 a = texture2D(uWaterTex, p + uRipOff.xy).rg;',
    '  vec2 b = texture2D(uWaterTex, p * 1.73 + uRipOff.zw).rg;',
    '  return a + b - 1.0;',
    '}',
    // light left after `path` metres of water; banded styles step in equal amounts of optical depth
    'vec3 absorb(float path, vec3 sigma) {',
    '  if (uBands > 0.5) {',
    '    float s = max(dot(sigma, vec3(0.3333)), 1e-4);',
    '    path = floor(s * path * uBands / 3.0 + 0.5) * 3.0 / uBands / s;',
    '  }',
    '  return exp(-sigma * path);',
    '}',
    'vec3 scatterColor(float path) {                                        // the colour of the water itself',
    '  if (smoothStyle()) return uDeep;',
    '  float od = dot(uSigma, vec3(0.3333)) * path;',
    '  return mix(uShallow, uDeep, band(clamp(od / 2.2, 0.0, 1.0), max(uBands, 2.0)));',
    '}',
    'vec3 seabedSand() { return mix(uSand, vec3(0.93, 0.95, 0.95), 0.5); }    // coral sand under water reads paler',
    // rain: rings spreading from where drops land; xy is the slope they add, z how bright the ring is
    'vec3 rainRing(vec2 p, float seed) {',
    '  vec2 c = floor(p), f = fract(p) - 0.5;',
    '  float h = hash(c + seed);',
    '  if (h > uRain) return vec3(0.0);',
    '  vec2 o = (vec2(hash(c + seed + 3.7), hash(c + seed + 9.1)) - 0.5) * 0.36;',
    '  float ph = fract(uFr.w + h * 17.0);',
    '  vec2 v = f - o; float r = length(v) + 1e-4;',
    '  float x = (r - ph * 0.4) * 20.0, env = (1.0 - ph) * (1.0 - ph) * (1.0 - smoothstep(0.38, 0.5, r)), g = exp(-x * x);',
    '  return vec3(v / r * (-2.0 * x * g) * env * 0.16, g * env);',
    '}',
    'vec3 rainRings(vec2 p) { return uRain < 0.01 ? vec3(0.0) : rainRing(p, 0.0) + rainRing(p * 1.37 + 0.5, 7.3); }',
    // a star in this cell of a sky grid, twinkling
    'float starAt(vec2 g) {',
    '  vec2 c = floor(g), f = fract(g) - 0.5;',
    '  float h = hash(c + 0.37);',
    '  if (h < 0.955) return 0.0;',
    '  vec2 o = (vec2(hash(c + 1.3), hash(c + 4.1)) - 0.5) * 0.5;',
    '  float tw = 0.6 + 0.24 * sin(uAng2.y + h * 40.0) + 0.16 * sin(uAng2.z + h * 23.0);',
    '  return (1.0 - smoothstep(0.06, 0.17, length(f - o))) * tw * (0.5 + 10.0 * (h - 0.955));',
    '}',
    'vec3 diskColor() { return uSunCol / max(max(uSunCol.r, uSunCol.g), max(uSunCol.b, 0.2)); }   // the sun or moon itself stays bright'
  ].join('\n') + '\n';
  var SKY_FN = [
    'uniform float uStarCell;                                              // star grid cells per radian',
    'vec3 skyColor(vec3 d) {',
    '  float h = max(d.y, 0.0), mu = max(dot(d, uSunDir), 0.0);',
    '  float g = pow(h, 0.45);',
    '  float gg = uBands > 0.5 ? band(g, 4.0) : g;',
    '  vec3 c = gg < 0.5 ? mix(uSkyHor, uSkyMid, gg * 2.0) : mix(uSkyMid, uSkyTop, gg * 2.0 - 1.0);',
    '  if (uBands < 0.5) c += uSunCol * (pow(mu, 6.0) * 0.16 + pow(mu, 48.0) * 0.3) * (1.0 - 0.6 * uOvercast);',
    '  if (d.y > 0.0) {',
    '    if (uStars > 0.01) c += vec3(0.9, 0.93, 1.0) * starAt(vec2(atan(d.z, d.x), asin(clamp(d.y, 0.0, 1.0))) * uStarCell) * uStars * smoothstep(0.02, 0.2, d.y);',
    '    vec2 cp = d.xz / (d.y + 0.12) * 0.06 + uCloudOff;',
    '    float cl = texture2D(uDetail, cp).g, lo = 0.5 - 0.22 * uOvercast;',
    '    float cov = uCrisp > 0.5 ? step(lo + 0.12, cl) : smoothstep(lo, lo + 0.28, cl);',
    '    vec3 cc = mix(vec3(1.0), uSkyHor, 0.15) * (0.84 + 0.22 * pow(mu, 3.0)) * uLight;',
    '    if (uCrisp > 0.5) cc = mix(cc, mix(vec3(1.0), uSkyHor, 0.55) * uLight, step(cl, lo + 0.17));',
    '    c = mix(c, cc, cov * smoothstep(0.0, 0.12, d.y) * 0.92);',
    '  }',
    '  return c;',
    '}'
  ].join('\n') + '\n';

  var VS_QUAD = 'attribute vec2 aPos; varying vec2 vUv; void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }';

  // ---- 3D: sky -------------------------------------------------------------------------
  var FS_SKY = SKY_FN + [
    'varying vec2 vUv;',
    'uniform vec3 uRight; uniform vec3 uUp; uniform vec3 uFwd; uniform vec2 uTan;',
    'uniform vec4 uBolt; uniform float uPxAng;                            // bolt: azimuth, top elevation, seed, brightness',
    'float bolt(vec3 d) {                                                  // a jagged lightning bolt from the clouds to the sea',
    '  float el = asin(clamp(d.y, -1.0, 1.0)), t = clamp(1.0 - el / uBolt.y, 0.0, 1.0);',
    '  if (uBolt.w <= 0.0 || el < -0.01 || el > uBolt.y) return 0.0;',
    '  float k = floor(t * 9.0), f = fract(t * 9.0);',
    '  float a0 = (hash(vec2(k, uBolt.z)) - 0.5) * 0.05 * (0.3 + k / 9.0), a1 = (hash(vec2(k + 1.0, uBolt.z)) - 0.5) * 0.05 * (0.3 + (k + 1.0) / 9.0);',
    '  float da = atan(d.z, d.x) - uBolt.x;',
    '  da = mod(da + 3.14159, 6.28318) - 3.14159;',
    '  float sl = (a1 - a0) / (uBolt.y / 9.0);',
    '  float dist = abs(da - mix(a0, a1, f)) / sqrt(1.0 + sl * sl) / uPxAng;   // in pixels',
    '  return uBolt.w * (1.0 - smoothstep(0.5, 1.6, dist) + 0.35 * exp(-dist / 7.0));',
    '}',
    'void main() {',
    '  if (uScenery < 0.5) { gl_FragColor = vec4(0.0); return; }',
    '  vec2 n = vUv * 2.0 - 1.0;',
    '  vec3 d = normalize(uFwd + uRight * n.x * uTan.x + uUp * n.y * uTan.y);',
    '  float mu = dot(d, uSunDir);',
    '  vec3 c;',
    '  if (isStyle(5.0)) {',
    '    float ang = acos(clamp(mu, -1.0, 1.0));',
    '    float cl = texture2D(uDetail, d.xz / (max(d.y, 0.0) + 0.12) * 0.06 + uCloudOff).g;',
    '    float ink = max(lineAA(ang - 0.05, ang, 1.2, 0.004), lineAA(cl - 0.64, cl, 0.9, 0.01) * smoothstep(0.03, 0.12, d.y) * 0.8);',
    '    c = mix(uPaper, uInk, max(ink, lineAA(d.y, d.y, 1.2, 0.002)));',
    '  } else {',
    '    c = skyColor(d);',
    '    float disk = uCrisp > 0.5 ? step(0.9985, mu) : smoothstep(0.99935, 0.9997, mu);',
    '    c = mix(c, diskColor() * 1.1, disk * step(0.0, d.y) * (1.0 - 0.85 * uOvercast));',
    '    c = mix(c, vec3(0.92, 0.94, 1.0), clamp(bolt(d), 0.0, 1.0));',
    '  }',
    '  gl_FragColor = vec4(c, 1.0);',
    '}'
  ].join('\n');

  // ---- 3D: terrain, palms, rocks and floating things ------------------------------------
  var VS_WORLD = VS_HEAD + [
    'attribute vec3 aPos; attribute vec3 aNormal; attribute vec4 aColor;',
    'uniform mat4 uViewProj; uniform mat4 uModel; uniform float uSnap; uniform vec2 uRes; uniform float uWaveTime; uniform float uWindAmt; uniform float uIsTerrain;',
    'varying vec3 vW; varying vec3 vN; varying vec4 vC;',
    'void main() {',
    '  vec4 w = uModel * vec4(aPos, 1.0);',
    '  float s = aColor.a * uWindAmt * (1.0 - uIsTerrain);                 // palm fronds move in the wind',
    '  w.xz += s * vec2(sin(uWaveTime * 1.9 + w.x * 0.37 + w.z * 0.11), cos(uWaveTime * 1.4 + w.z * 0.33)) * 0.35;',
    '  w.y += s * sin(uWaveTime * 2.3 + w.x) * 0.12;',
    '  vW = w.xyz; vN = (uModel * vec4(aNormal, 0.0)).xyz; vC = aColor;',
    '  vec4 cp = uViewProj * w;',
    '  if (uSnap > 0.0) cp.xy = floor(cp.xy / cp.w * uRes * 0.5 + 0.5) / (uRes * 0.5) * cp.w;',
    '  gl_Position = cp;',
    '}'
  ].join('\n');
  var FS_WORLD = [
    'varying vec3 vW; varying vec3 vN; varying vec4 vC;',
    'uniform float uPass; uniform float uIsTerrain; uniform float uFlip; uniform vec3 uCamPos; uniform float uFogR; uniform float uMaxD;',
    'uniform vec4 uShadows[10];',
    'float underShadow(vec3 p) {                                           // shadows of floating things on the seabed',
    '  vec2 q = p.xz - uSunDir.xz / max(uSunDir.y, 0.2) * p.y;',
    '  float s = 0.0, soft = 0.3 + 0.04 * max(-p.y, 0.0);',
    '  for (int i = 0; i < 10; i++) {',
    '    vec4 sh = uShadows[i];',
    '    if (sh.z <= 0.0) continue;',
    '    float d = length(q - sh.xy) / sh.z;',
    '    s = max(s, (1.0 - smoothstep(1.0 - soft, 1.0 + soft, d)) * sh.w);',
    '  }',
    '  return s;',
    '}',
    'vec3 terrainAlbedo(vec3 p, vec3 N) {',
    '  float n1 = tnoise(p.xz * 0.031), n2 = tnoise(p.xz * 0.23), slope = 1.0 - N.y;',
    '  vec3 sand = uSand * (0.9 + 0.2 * n2);',
    '  if (p.y > 0.0) {',
    '    float g = smoothstep(1.0, 1.5, p.y + (n1 - 0.5) * 1.6 - slope * 2.0);',
    '    if (uCrisp > 0.5) g = step(0.5, g);',
    '    vec3 col = mix(sand, uGrass * (0.75 + 0.5 * n1) * (0.9 + 0.2 * n2), g);',
    '    col = mix(col, uRock * (0.8 + 0.35 * n2), smoothstep(0.32, 0.55, slope));',
    '    return col * (1.0 - 0.3 * (1.0 - smoothstep(0.0, 0.5, p.y)) * (1.0 - g));   // wet sand at the waterline',
    '  }',
    '  float depth = -p.y;',
    '  vec3 col = seabedSand() * (0.9 + 0.2 * n2) * mix(vec3(1.0), vec3(0.86, 0.92, 0.9), smoothstep(2.0, 12.0, depth));',
    '  float weed = smoothstep(0.6, 0.67, n1 + 0.1 * n2) * smoothstep(2.5, 5.0, depth);',
    '  col = mix(col, vec3(0.24, 0.36, 0.22) * (0.85 + 0.3 * n2), weed * 0.65);',
    '  float cells = texture2D(uDetail, p.xz * 0.075).a;',
    '  col = mix(col, uRock * 0.8, smoothstep(0.68, 0.76, cells) * smoothstep(4.0, 7.0, depth) * 0.75);',
    '  return col * (0.95 + 0.05 * sin(dot(p.xz, vec2(1.9, 1.1)) + n2 * 7.0));   // sand ripples',
    '}',
    'vec3 litSurface(vec3 albedo, vec3 N, vec3 p, float ao) {',
    '  float diff = max(dot(N, uSunDir), 0.0);',
    '  diff = cel(diff);',
    '  vec3 amb = mix(uSkyHor * 0.5, uSkyTop * 0.48, N.y * 0.5 + 0.5) * (uBands > 0.5 ? 0.75 : 1.0) * ao;',
    '  vec3 sun = uSunCol * diff * (0.7 + 0.3 * ao);',
    '  if (p.y < 0.0) {                                                     // under water: dimmer, bluer, with caustics',
    '    float depth = -p.y, sh = underShadow(p);',
    '    vec3 att = exp(-uSigma * depth * 0.5);',
    '    sun *= att * (0.5 + 0.62 * causticRGB(p.xz * 0.085)) * (1.0 - 0.7 * sh);',
    '    amb *= mix(vec3(1.0), att, 0.6);',
    '  }',
    '  return albedo * (amb + sun);',
    '}',
    'vec3 inkSurface(vec3 p, vec3 N) {',
    '  float diff = max(dot(N, uSunDir), 0.0), ink = 0.0;',
    '  if (uIsTerrain > 0.5) {',
    '    ink = p.y > 0.0 ? iso(p.y, 1.0, 1.0, 0.03) * 0.75 : iso(p.y, 2.0, 1.0, 0.05) * 0.55;',
    '    ink = max(ink, lineAA(p.y, p.y, 1.8, 0.05));',
    '    if (p.y > 1.3) ink = max(ink, step(0.92, hash(floor(gl_FragCoord.xy))) * 0.5);',
    '  }',
    '  ink = max(ink, hatch(clamp(0.75 - diff * 1.4, 0.0, 1.0), gl_FragCoord.xy) * 0.6);',
    '  return mix(uPaper, uInk, ink);',
    '}',
    'void main() {',
    '  if (uPass > 1.5 && vW.y < -0.02) discard;                          // reflections: only what is above the water',
    '  vec3 N = normalize(vN);',
    '  if (uIsTerrain < 0.5 && (gl_FrontFacing == (uFlip > 0.5))) N = -N; // leaves and sails are two-sided',
    '#ifdef HAS_DERIV',
    '  if (isStyle(3.0)) { vec3 fN = normalize(cross(dFdx(vW), dFdy(vW))); N = dot(fN, N) < 0.0 ? -fN : fN; }',
    '#endif',
    '  float ao = uIsTerrain > 0.5 ? (uBands > 0.5 ? 0.6 + 0.4 * step(0.72, vC.r) : vC.r) : 1.0;',
    '  vec3 col = isStyle(5.0) ? inkSurface(vW, N) : litSurface(uIsTerrain > 0.5 ? terrainAlbedo(vW, N) : moodTint(vC.rgb), N, vW, ao);',
    '  if (uPass > 0.5 && uPass < 1.5) { gl_FragColor = vec4(col, clamp(-vW.y / uMaxD, 0.0, 1.0)); return; }',
    '  float fog = smoothstep(uFogR * 0.3, uFogR * 0.95, length(uCamPos - vW));',
    '  if (uBands > 0.5) fog = band(fog, 4.0);',
    '  gl_FragColor = vec4(mix(col, isStyle(5.0) ? uPaper : uSkyHor, fog), 1.0);',
    '}'
  ].join('\n');

  // ---- 3D: the sea ---------------------------------------------------------------------
  var VS_SEA = VS_HEAD + [
    'attribute vec2 aGrid;',
    'uniform mat4 uViewProj; uniform vec2 uCenter; uniform float uGridR; uniform float uGridPow; uniform float uWaveTime;',
    'uniform vec4 uWA[16]; uniform vec4 uWB[16]; uniform float uWaveCount; uniform vec4 uIslands[6];',
    'uniform float uSnap; uniform vec2 uRes; uniform float uSwash;',
    'varying vec3 vWorld; varying vec3 vNormal; varying float vJac; varying float vHeight;',
    'void main() {',
    '  vec2 p = sign(aGrid) * pow(abs(aGrid), vec2(uGridPow)) * uGridR + uCenter;     // denser under the camera',
    '  float fade = 1.0 - smoothstep(uGridR * 0.55, uGridR * 0.95, length(p - uCenter));',
    '  float att = 1.0, um = 9.0;                                          // reefs calm the lagoons',
    '  for (int k = 0; k < 6; k++) { vec4 il = uIslands[k]; if (il.z > 0.0) { float u = length(p - il.xy) / il.z; um = min(um, u); att = min(att, smoothstep(1.15, 2.1, u)); } }',
    '  fade *= 0.1 + 0.9 * att;',
    '  vec3 pos = vec3(p.x, 0.0, p.y), n = vec3(0.0, 1.0, 0.0);',
    '  float jxx = 1.0, jzz = 1.0, jxz = 0.0;',
    '  for (int i = 0; i < 16; i++) {',
    '    if (float(i) >= uWaveCount) break;',
    '    vec4 a = uWA[i], b = uWB[i];',
    '    float A = a.w * fade, wa = a.z * A, th = a.z * dot(a.xy, p) - b.x * uWaveTime + b.y;',
    '    float c = cos(th), s = sin(th);',
    '    pos.xz += a.xy * (b.z * A * c); pos.y += A * s;',
    '    n.x -= a.x * wa * c; n.z -= a.y * wa * c; n.y -= b.z * wa * s;',
    '    jxx -= b.z * wa * a.x * a.x * s; jzz -= b.z * wa * a.y * a.y * s; jxz -= b.z * wa * a.x * a.y * s;',
    '  }',
    '  pos.y += uSwash * sin(uWaveTime * 0.9 - um * 11.0) * (1.0 - smoothstep(1.0, 1.35, um));   // swash: the waterline runs up and down the beach',
    '  vWorld = pos; vNormal = n; vJac = jxx * jzz - jxz * jxz; vHeight = pos.y;',
    '  vec4 cp = uViewProj * vec4(pos, 1.0);',
    '  if (uSnap > 0.0) cp.xy = floor(cp.xy / cp.w * uRes * 0.5 + 0.5) / (uRes * 0.5) * cp.w;',
    '  gl_Position = cp;',
    '}'
  ].join('\n');
  var FS_SEA = SKY_FN + [
    'varying vec3 vWorld; varying vec3 vNormal; varying float vJac; varying float vHeight;',
    'uniform sampler2D uRefr; uniform sampler2D uRefl; uniform vec2 uRes; uniform float uHasRefl;',
    'uniform vec3 uCamPos; uniform float uFoam; uniform float uAmp; uniform float uFogR; uniform float uMaxD; uniform float uDetailAmt;',
    'uniform vec4 uTrail[8]; uniform vec2 uTexOrigin;',
    'void main() {',
    '  vec3 toCam = uCamPos - vWorld; float dist = length(toCam); vec3 V = toCam / dist;',
    '  vec2 tp = vWorld.xz - uTexOrigin;                                   // near the camera, so texture lookups keep their precision',
    '  vec2 rp = ripples(tp * 0.06);',
    '  vec3 N = normalize(normalize(vNormal) + vec3(rp.x, 0.0, rp.y) * uDetailAmt / (1.0 + dist * 0.025));',
    '  vec3 rr = vec3(0.0);',
    '  if (dist < 70.0) rr = rainRings(tp * 0.7) * (1.0 - smoothstep(25.0, 70.0, dist));   // rain rings near the camera only',
    '  N = normalize(N + vec3(rr.x, 0.0, rr.y));',
    '  vec3 foamC = uFoamCol * uLight;',
    '#ifdef HAS_DERIV',
    '  if (isStyle(3.0)) { N = normalize(cross(dFdx(vWorld), dFdy(vWorld))); if (N.y < 0.0) N = -N; }',
    '#endif',
    // what lies below, straight behind this point, and bent by the surface
    '  vec2 suv = gl_FragCoord.xy / uRes;',
    '  vec4 r0 = texture2D(uRefr, suv);',
    '  float colDepth = max(r0.a * uMaxD + vHeight, 0.0);                  // water column here',
    '  vec2 off = N.xz * 0.12 * min(colDepth, 2.5) / (1.0 + dist * 0.05);',
    '  vec4 r1 = texture2D(uRefr, suv + off);',
    '  if (r1.a < 0.001) r1 = r0;                                          // never refract what stands above the water',
    '  float depth = max(r1.a * uMaxD + vHeight, 0.0);',
    '  vec3 tdir = refract(-V, N, 0.75);',
    '  float path = depth / max(-tdir.y, 0.1);',
    '  vec3 T = absorb(path, uSigma);',
    '  float crest = clamp(vHeight / max(uAmp, 0.05) * 0.5 + 0.5, 0.0, 1.0);',
    '  vec3 scatter = scatterColor(path) * (0.55 + 0.6 * clamp(uSunDir.y, 0.0, 1.0)) * uLight;',
    '  vec3 refr = r1.rgb * T + scatter * (1.0 - T);',
    '  if (smoothStyle()) refr += uShallow * uLight * 0.35 * pow(max(dot(-V, uSunDir), 0.0), 4.0) * crest * (1.0 - T.g);   // sun through the crests',
    // reflection of the sky (and the islands, when they are rendered)
    '  vec3 R = reflect(-V, N); R.y = abs(R.y);',
    '  vec3 refl = skyColor(R);',
    '  if (uHasRefl > 0.5) { vec4 pr = texture2D(uRefl, suv + N.xz * 0.05); refl = mix(refl, pr.rgb, pr.a); }',
    '  float F = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);',
    '  if (uBands > 0.5) F = band(F, 3.0) * 0.9;',
    '  vec3 col = mix(refr, refl, F);',
    '  float rs = max(dot(R, uSunDir), 0.0);',
    '  col += uSunCol * (uCrisp > 0.5 ? step(0.9975, rs) * 1.2 : pow(rs, 700.0) * 5.0 + pow(rs, 80.0) * 0.12);',
    '  if (uBands > 0.5) {',
    '    float hl = texture2D(uWaterTex, tp * vec2(0.03, 0.09) + uScrl.yz).b;',
    '    float hv = hl + crest * 0.15, wl = isStyle(2.0) ? step(0.8, hv) : step(0.8, hv) * (1.0 - step(0.835, hv));   // thin wave lines',
    '    col = mix(col, mix(col, foamC, 0.6), wl * (1.0 - smoothstep(uFogR * 0.1, uFogR * 0.35, dist)) * step(1.5, colDepth));',
    '  }',
    // foam: on the waterline, in bands rolling in to the beach, on steep crests and in wakes
    '  float lace = texture2D(uWaterTex, tp * 0.12 + vec2(uScrl.x, 0.0)).a;',
    '  float shore = 1.0 - smoothstep(0.0, 0.55, colDepth);',
    '  float bands = smoothstep(0.82, 0.97, fract(colDepth * 0.85 + uFr.x)) * (1.0 - smoothstep(0.4, 2.4, colDepth));',
    '  float crestF = (1.0 - smoothstep(0.15, 0.6, vJac));',
    '  float wake = 0.0;',
    '  for (int i = 0; i < 8; i++) {',
    '    vec4 t = uTrail[i]; if (t.w <= 0.0) continue;',
    '    wake = max(wake, (1.0 - smoothstep(t.w * 0.4, t.w, length(vWorld.xz - t.xy))) * t.z);',
    '  }',
    '  float fm = max(max(shore, bands * 0.85), max(crestF, wake)) * uFoam;',
    '  float foam = max(thr(fm * (0.45 + 0.85 * lace), 0.5, 0.12), (1.0 - smoothstep(0.0, 0.1, colDepth)) * step(0.01, uFoam));',
    '  col = mix(col, foamC * (0.72 + 0.28 * max(dot(N, uSunDir), 0.0)), foam);',
    '  col += foamC * rr.z * 0.25 * step(0.5, colDepth);                    // the rings catch a little light',
    '  if (uGlow > 0.01) {                                                 // at night, churned water glows',
    '    float glw = max(max(shore * 0.9, wake), max(crestF * 0.5, bands * 0.6)) * (0.35 + 0.9 * lace) + rr.z * 0.5;',
    '    col += uGlowCol * uGlow * glw * (0.75 + 0.25 * sin(uAng.x + lace * 9.0));',
    '  }',
    '  if (isStyle(5.0)) {',
    '    vec3 under = mix(uPaper, r1.rgb, clamp(dot(T, vec3(0.333)) * 0.9, 0.0, 1.0));',
    '    float row = floor(gl_FragCoord.y / 4.0);',
    '    float mid = smoothstep(uFogR * 0.08, uFogR * 0.2, dist) * (1.0 - smoothstep(uFogR * 0.4, uFogR * 0.8, dist));',
    '    float dash = step(fract(gl_FragCoord.y / 5.0), 0.21) * step(0.78 - crest * 0.12, hash(vec2(floor(gl_FragCoord.x / 11.0) + row * 7.0, row))) * mid * 0.6;',
    '    float strokes = lineAA(crest - 0.72, crest, 1.0, 0.03) * step(0.45, tnoise(vWorld.xz * 0.012 + 0.3)) * (1.0 - smoothstep(uFogR * 0.1, uFogR * 0.4, dist));',
    '    float glint = step(0.975, rs) * step(0.5, fract(gl_FragCoord.x * 0.18 + floor(gl_FragCoord.y * 0.5) * 0.37));',
    '    col = mix(under, uInk, max(max(dash, strokes * 0.9), glint * 0.7));',
    '    col = mix(col, uPaper, step(0.5, foam));',
    '    col = mix(col, uInk, lineAA(colDepth - 0.06, colDepth, 1.4, 0.05));',
    '  }',
    '  float fog = smoothstep(uFogR * 0.3, uFogR * 0.95, dist);',
    '  if (uBands > 0.5) fog = band(fog, 4.0);',
    '  gl_FragColor = uScenery > 0.5 ? vec4(mix(col, isStyle(5.0) ? uPaper : uSkyHor, fog), 1.0) : vec4(col, 1.0 - fog);',
    '}'
  ].join('\n');

  // ---- 2D side view, pass 1: everything behind and under the water ------------------------
  var SIDE_SURF = [
    'uniform sampler2D uHeights; uniform float uCols; uniform vec2 uView; uniform float uLevel; uniform float uRange;',
    'uniform float uWorldW; uniform float uCamX;                         // the view is uView wide, starting at uCamX in a world uWorldW wide',
    'float hRaw(float x) {',
    '  float u = clamp(x / uWorldW, 0.0, 1.0) * (uCols - 1.0), i0 = floor(u), f = u - i0;',
    '  vec4 a = texture2D(uHeights, vec2((i0 + 0.5) / uCols, 0.5));',
    '  vec4 b = texture2D(uHeights, vec2((min(i0 + 1.0, uCols - 1.0) + 0.5) / uCols, 0.5));',
    '  float ha = (a.r * 65280.0 + a.a * 255.0) / 65535.0, hb = (b.r * 65280.0 + b.a * 255.0) / 65535.0;',
    '  return (mix(ha, hb, f) * 2.0 - 1.0) * uRange;',
    '}',
    'float surf(float x) {                                                 // surface height at x, up is positive',
    '  if (isStyle(3.0)) { float k = floor(x / 16.0) * 16.0; return mix(hRaw(k), hRaw(k + 16.0), (x - k) / 16.0); }',
    '  return hRaw(x);',
    '}',
    'vec2 toUv(vec2 q) { return vec2((q.x - uCamX) / uView.x, 1.0 - q.y / uView.y); }',
    'vec2 viewPos(vec2 uv) { return vec2(uv.x * uView.x + uCamX, (1.0 - uv.y) * uView.y); }   // world units, y down'
  ].join('\n') + '\n';
  var FS_SIDE_BG = SIDE_SURF + [
    'varying vec2 vUv;',
    'uniform vec4 uCliff; uniform vec4 uDock; uniform vec3 uPosts;',
    'uniform vec2 uSunPos; uniform vec4 uBolt; uniform float uPxU; uniform float uStarCell;',
    'float cliffX(float y) { return uCliff.x + uCliff.y * sin(y * 0.045) + uCliff.z * sin(y * 0.11 + 1.3); }',
    'float sideBolt(float x, float y) {                                    // uBolt: x on screen, bottom y, seed, brightness',
    '  if (y > uBolt.y) return 0.0;',
    '  float t = y / uBolt.y, k = floor(t * 9.0), f = fract(t * 9.0);',
    '  float x0 = uBolt.x + (hash(vec2(k, uBolt.z)) - 0.5) * 34.0 * (0.3 + k / 9.0);',
    '  float x1 = uBolt.x + (hash(vec2(k + 1.0, uBolt.z)) - 0.5) * 34.0 * (0.3 + (k + 1.0) / 9.0);',
    '  float sl = (x1 - x0) / (uBolt.y / 9.0);',
    '  float dist = abs(x - mix(x0, x1, f)) / sqrt(1.0 + sl * sl) / uPxU;',
    '  return uBolt.w * (1.0 - smoothstep(0.5, 1.6, dist) + 0.35 * exp(-dist / 7.0));',
    '}',
    'float seabed(float x) { return uView.y - 12.0 - 16.0 * texture2D(uDetail, vec2(x * 0.0019, 0.13)).b; }',
    'void main() {',
    '  vec2 p = viewPos(vUv);',
    '  float sx = p.x - uCamX;                                              // across the screen; far layers scroll slower',
    '  float ys = uLevel - surf(p.x);',
    '  bool under = p.y > ys;',
    '  float bottom = seabed(p.x), n2 = tnoise(p * 0.013);',
    '  float far = uLevel - uView.y * (0.07 + 0.2 * texture2D(uDetail, vec2((sx + uCamX * 0.25) * 0.0011, 0.71)).b);',
    '  float mid = uLevel - uView.y * (0.03 + 0.11 * texture2D(uDetail, vec2((sx + uCamX * 0.55) * 0.0031 + 0.3, 0.27)).b);',
    '  float reef = bottom - 18.0 - 52.0 * texture2D(uDetail, vec2((sx + uCamX * 0.85) * 0.0033 + 0.55, 0.83)).b;',
    '  float cx = cliffX(p.y), cliffTop = uCliff.w + 4.0 * sin(p.x * 0.1);',
    '  float sd = length(vec2(sx, p.y) - uSunPos) / (uView.y * 0.055);',
    '  float clx = sx + uCamX * 0.15;',
    '  float cl = texture2D(uDetail, vec2(clx * 0.0017 + uScrl2.z, p.y * 0.0052 + 0.4), 1.5).g;',
    '  float cloudFade = 1.0 - smoothstep(uLevel * 0.25, uLevel * 0.78, p.y);',
    '  vec3 col = uDeep; float z = 1.0; bool lit = false; float ink = 0.0;',
    '  vec3 L = uLight;                                                     // what the mood lights; the sky lights itself',
    '  if (!under) {',
    '    if (uScenery < 0.5) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }',
    '    L = vec3(1.0);',
    '    float t = clamp(p.y / uLevel, 0.0, 1.0);',
    '    float tt = qz(pow(t, 1.3));',
    '    col = tt < 0.5 ? mix(uSkyTop, uSkyMid, tt * 2.0) : mix(uSkyMid, uSkyHor, tt * 2.0 - 1.0);',
    '    float cov = thr(cl, 0.6 - 0.2 * uOvercast, 0.08) * cloudFade;',
    '    if (uStars > 0.01) col += vec3(0.9, 0.93, 1.0) * starAt(vec2(sx + uCamX * 0.05, p.y) / uStarCell) * uStars * (1.0 - cov) * (1.0 - smoothstep(0.5, 0.85, t));',
    '    if (uBands < 0.5) col += uSunCol * (exp(-sd * 0.6) * 0.25 + exp(-sd * 0.15) * 0.1) * (1.0 - 0.6 * uOvercast);',
    '    col = mix(col, diskColor() * 1.1, (uCrisp > 0.5 ? step(sd, 1.0) : 1.0 - smoothstep(0.94, 1.06, sd)) * (1.0 - 0.85 * uOvercast));',
    '    float clDn = texture2D(uDetail, vec2(clx * 0.0017 + uScrl2.z, (p.y + 7.0) * 0.0052 + 0.4), 1.5).g;',
    '    vec3 cc = mix(vec3(1.0), uSkyHor, 0.05) * (uCrisp > 0.5 ? mix(0.86, 1.0, step(0.6, clDn)) : mix(0.84, 1.0, smoothstep(0.54, 0.68, clDn))) * uLight;',
    '    col = mix(col, cc, cov);',
    '    if (uBolt.w > 0.0) col = mix(col, vec3(0.92, 0.94, 1.0), clamp(sideBolt(sx, p.y), 0.0, 1.0));',
    '    if (p.y > far) col = mix(uSkyHor, uSkyTop * 0.55 + uGrass * 0.3 * uLight, 0.3 + 0.12 * qz((p.y - far) / max(uLevel - far, 1.0)));',
    '    if (p.y > mid) col = mix(uSkyHor, uGrass * (0.85 + 0.2 * n2) * uLight, 0.62);',
    '    ink = max(max(lineAA(sd - 1.0, sd, 1.2, 0.05), lineAA(cl - 0.62, cl, 0.9, 0.01) * cloudFade), max(lineAA(p.y - far, p.y, 1.1, 0.8), lineAA(p.y - mid, p.y, 1.3, 0.9)));',
    '    if (p.y > far) ink = max(ink, step(0.94, hash(floor(gl_FragCoord.xy))) * 0.5);',
    '  } else {',
    '    if (p.y > reef) { col = uRock * (0.5 + 0.18 * n2); z = 0.55; lit = true; }',
    '    if (p.y > bottom) {',
    '      float peb = texture2D(uDetail, p * 0.06).a;',
    '      col = seabedSand() * (0.85 + 0.25 * n2) * (1.0 - 0.25 * smoothstep(0.6, 0.8, peb));',
    '      z = 0.14; lit = true;',
    '    }',
    '    for (int k = -1; k <= 1; k++) {                                   // seaweed swaying in the swell',
    '      float cid = floor(p.x / 22.0) + float(k);',
    '      if (hash(vec2(cid, 3.1)) < 0.35) continue;',
    '      float baseX = (cid + 0.2 + 0.6 * hash(vec2(cid, 7.7))) * 22.0;',
    '      float hgt = 22.0 + 50.0 * hash(vec2(cid, 1.9)), up = seabed(baseX) - p.y;',
    '      if (up < 0.0 || up > hgt) continue;',
    '      float sway = sin(uAng.y + p.y * 0.055 + cid * 1.7) * up * 0.13;',
    '      float wdt = 2.6 * (1.0 - up / hgt * 0.7), dx = abs(p.x - baseX - sway);',
    '      if (dx < wdt) { col = mix(vec3(0.14, 0.42, 0.2), vec3(0.32, 0.62, 0.26), 1.0 - dx / wdt) * (0.8 + 0.3 * hash(vec2(cid, 5.0))); z = 0.1; lit = true; ink = max(ink, smoothstep(wdt - 1.2, wdt, dx)); }',
    '    }',
    '    float cm = texture2D(uDetail, p * vec2(0.025, 0.04)).a;',
    '    if (p.y > bottom - 9.0 && p.y < bottom + 1.0 && cm > 0.72) { col = mix(vec3(0.95, 0.45, 0.42), vec3(0.95, 0.62, 0.3), hash(floor(p / 9.0))); z = 0.12; lit = true; }',
    '    ink = max(ink, max(lineAA(p.y - reef, p.y, 1.0, 0.8) * 0.6, lineAA(p.y - bottom, p.y, 1.3, 0.9)));',
    '    if (p.y > bottom) ink = max(ink, step(0.88, hash(floor(gl_FragCoord.xy))) * 0.6);',
    '  }',
    '  if (uScenery > 0.5) {',
    '    if (p.x < cx && p.y > cliffTop) {                                  // a cliff on the left, above and below the water',
    '      L = uLight;',
    '      col = uRock * (0.86 + 0.14 * sin(p.y * 0.42 + n2 * 5.0)) * (0.72 + 0.38 * smoothstep(cx - 10.0, cx, p.x));',
    '      if (p.y < cliffTop + 6.0) col = uGrass * (0.9 + 0.2 * n2);',
    '      z = 0.02; lit = under;',
    '      ink = max(hatch(0.5, gl_FragCoord.xy) * 0.4, max(lineAA(p.x - cx, p.x, 1.4, 0.8), lineAA(p.y - cliffTop, p.y, 1.4, 0.8)));',
    '    }',
    '    if (p.x > uDock.x && p.y > uDock.y && p.y < uDock.y + uDock.z) {   // a wooden dock on the right',
    '      col = uWood * (0.82 + 0.18 * step(0.5, fract(p.x / 9.0))); z = 0.02; L = uLight; ink = max(ink, step(fract(p.x / 9.0), 0.1));',
    '    }',
    '    for (int i = 0; i < 3; i++) {',
    '      float px = i == 0 ? uPosts.x : (i == 1 ? uPosts.y : uPosts.z);',
    '      if (abs(p.x - px) < uDock.w && p.y > uDock.y && p.y < bottom + 4.0) {',
    '        col = uWood * 0.78 * (0.85 + 0.15 * sin(p.y * 0.7 + px));',
    '        if (under) col = mix(col, vec3(0.2, 0.36, 0.18), smoothstep(bottom - 40.0, bottom, p.y) * 0.6);',
    '        z = 0.02; lit = under; L = uLight; ink = max(ink, smoothstep(uDock.w - 1.2, uDock.w, abs(p.x - px)));',
    '      }',
    '    }',
    '  }',
    '  if (under && lit && !isStyle(5.0)) {                                // caustics, as strong as the sun or moon is bright',
    '    float ck = mix(1.0, 0.3, z) * exp(-(p.y - uLevel) / 140.0) * clamp(dot(uSunCol, vec3(0.4)), 0.25, 1.0) * (1.0 - 0.6 * uOvercast);',
    '    col *= 1.0 - 0.38 * ck + 0.62 * ck * caustic(vec2(p.x * 0.011, p.y * 0.006 + p.x * 0.002));',
    '  }',
    '  col *= L;',
    '  if (isStyle(5.0)) col = mix(uPaper, uInk, ink);',
    '  gl_FragColor = vec4(col, z);',
    '}'
  ].join('\n');
  // ---- 2D side view, pass 2: the water, seen through ---------------------------------------
  var FS_SIDE_WATER = SIDE_SURF + [
    'varying vec2 vUv;',
    'uniform sampler2D uScene; uniform float uUnit; uniform float uReflect; uniform float uFoam; uniform float uPxU;',
    'void main() {',
    '  vec2 p = viewPos(vUv);',
    '  float hs = surf(p.x), ys = uLevel - hs, d = p.y - ys;',
    '  vec4 a = texture2D(uScene, vUv);',
    '  if (d < 0.0) { gl_FragColor = vec4(a.rgb, (uScenery > 0.5 || a.a < 0.9) ? 1.0 : 0.0); return; }',
    '  vec2 rp = texture2D(uWaterTex, vec2(p.x * 0.0042 + uScrl2.x, p.y * 0.0065 - uScrl2.y)).rg * 2.0 - 1.0;',
    '  float slope = surf(p.x + 3.0) - surf(p.x - 3.0);',
    '  vec2 q = p + vec2(slope * 0.9 * exp(-d / 18.0), 0.0) + rp * (1.0 + 2.4 * exp(-d / 30.0));',
    '  if (isStyle(3.0)) {                                                  // triangle facets',
    '    vec2 f = fract(p / 10.0), c0 = floor(p / 10.0); float tri = step(1.0, f.x + f.y);',
    '    q = (c0 + mix(vec2(1.0 / 3.0), vec2(2.0 / 3.0), tri)) * 10.0 + rp * 1.5;',
    '  }',
    '  if (q.y < uLevel - surf(q.x) + 1.5) q = vec2(q.x, max(p.y, uLevel - surf(q.x) + 1.5));   // stay under the surface',
    '  vec4 b = texture2D(uScene, toUv(q));',
    '  float dm = d * uUnit;                                                // depth in metres',
    '  vec3 lightLeft = exp(-uSigma * dm * 0.3);                            // sunlight left at this depth',
    '  vec3 T = absorb(0.35 + b.a * 14.0, uSigma);                          // through the water to what is behind',
    '  float lm = qz(1.0 - exp(-dm / 3.2));',
    '  vec3 scat = (lm < 0.5 ? mix(uShallow * 0.9, uDeep, lm * 2.0) : mix(uDeep, uDeep * 0.6, lm * 2.0 - 1.0)) * uLight;   // lighter near the top, darker deep down',
    '  vec3 foamC = uFoamCol * uLight;',
    '  vec3 col = b.rgb * lightLeft * T + scat * (1.0 - T);',
    '  if (uScenery < 0.5) { col = scat; }',
    '  float sh = texture2D(uDetail, vec2((p.x + p.y * 0.42) * 0.0026 + uScrl2.w, 0.37)).g;   // light shafts',
    '  float rays = smoothstep(0.52, 0.82, sh) * exp(-d / 75.0) * smoothstep(0.0, 8.0, d);',
    '  if (!smoothStyle()) rays = step(0.86, fract((p.x + p.y * 0.42) / 96.0 - uFr.z)) * step(d, 60.0) * step(3.0, d) * 0.45;',
    '  if (!isStyle(5.0)) col += uSunCol * rays * 0.2;',
    '  if (uReflect > 0.001) {                                             // the world above, rippled, near the top',
    '    float wob = (texture2D(uWaterTex, vec2(p.x * 0.012 + uScrl.x, p.y * 0.03 - uScrl.w)).g - 0.5) * (2.0 + d * 0.25);',
    '    vec2 m = vec2(p.x + wob * 4.0, ys - d * 1.15 - 1.0);',
    '    float k = uReflect * exp(-d / 28.0);',
    '    col = mix(col, texture2D(uScene, toUv(m)).rgb * 0.95, uBands > 0.5 ? band(k, 3.0) : k);',
    '  }',
    '  float line = 1.0 - smoothstep(uPxU * 0.8, uPxU * 1.8, d);           // the surface seen from just below',
    '  vec3 win = mix(uShallow * uLight, uSkyHor, 0.3);                    // the surface seen from below holds a little sky',
    '  col = mix(col, mix(win, uFoamCol * uLight, 0.7), line * 0.85);',
    '  if (smoothStyle()) col += uShallow * uLight * 0.16 * exp(-d / 6.0);',
    '  else col = mix(col, mix(win, uFoamCol * uLight, 0.35), (1.0 - step(uPxU * 3.0, d)) * step(uPxU * 1.5, d));',
    '  float cap = smoothstep(uRange * 0.12, uRange * 0.35, hs) + smoothstep(1.2, 2.8, abs(slope));',
    '  float lace = texture2D(uWaterTex, vec2(p.x * 0.012 + uScrl.x, p.y * 0.02)).a;',
    '  float foam = thr(cap * (0.4 + 0.8 * lace), 0.45, 0.1) * (1.0 - smoothstep(2.0, 6.0, d)) * uFoam;',
    '  col = mix(col, foamC, foam);',
    '  vec2 bq = vec2(p.x * 0.06, p.y * 0.06 + uCells.x), bi = floor(bq);   // a few bubbles drifting up',
    '  vec2 bc = fract(bq) - 0.5 - vec2(0.18 * sin(uAng.z + bi.y * 1.7), 0.0);',
    '  float bub = step(0.975, hash(bi)) * (1.0 - smoothstep(0.06, 0.11, length(bc))) * smoothstep(6.0, 14.0, d);',
    '  col = mix(col, mix(col, foamC, 0.7), bub);',
    '  if (uGlow > 0.01) col += uGlowCol * uGlow * (foam * 0.9 + bub * 0.7 + line * 0.35 + cap * 0.25 * (1.0 - smoothstep(0.0, 9.0, d))) * (0.75 + 0.25 * sin(uAng.x + p.x * 0.05));',
    '  if (isStyle(5.0)) {',
    '    float vis = clamp(dot(T * lightLeft, vec3(0.333)) * 1.3, 0.0, 1.0);',
    '    col = mix(uPaper, b.rgb, vis);',
    '    col = mix(col, uInk, hatch(0.2 + (1.0 - vis) * 0.6, gl_FragCoord.xy) * 0.35);',
    '    float row = floor((d - 4.0) / 6.0);',
    '    float dash = step(0.55, hash(vec2(floor(p.x / 14.0 + row * 3.7 - uCells.y), row))) * step(row, 1.5) * step(0.0, row);',
    '    col = mix(col, uInk, lineAA(fract((d - 4.0) / 6.0) - 0.5, d / 6.0, 1.0, 0.08) * dash * 0.8);',
    '    col = mix(col, uInk, lineAA(d, d, 1.6, 1.0));',
    '    col = mix(col, uPaper, foam);',
    '  }',
    '  float alpha = uScenery > 0.5 ? 1.0 : 1.0 - dot(T, vec3(0.333)) * 0.6;',
    '  gl_FragColor = vec4(col, alpha);',
    '}'
  ].join('\n');

  // ---- 2D top down, pass 1: land and seabed --------------------------------------------
  var TOP_COMMON = [
    'uniform sampler2D uMap; uniform vec2 uWorld; uniform vec4 uViewRect;',
    'float elev(vec2 w) { return texture2D(uMap, w / uWorld).r * 16.0 - 12.0; }',
    // small-scale wiggle on the coast, so it stays organic when the camera zooms in past the map resolution
    'float coast(vec2 w, float E) {',
    '  if (abs(E) > 0.9) return E;                                        // open water and inland: no extra texture reads',
    '  return E + ((tnoise(w * 0.33) - 0.5) * 0.22 + (tnoise(w * 1.07) - 0.5) * 0.09) * (1.0 - smoothstep(0.25, 0.9, abs(E)));',
    '}',
    'vec2 facetPos(vec2 w, out float facet) {                             // low poly: everything sampled at triangle centres',
    '  facet = 0.0;',
    '  if (!isStyle(3.0)) return w;',
    '  vec2 q = w / 1.6, c0 = floor(q), f = fract(q); float tri = step(1.0, f.x + f.y);',
    '  facet = hash(c0 + tri * 7.3);',
    '  return (c0 + mix(vec2(1.0 / 3.0), vec2(2.0 / 3.0), tri)) * 1.6;',
    '}',
    'vec2 toUv(vec2 w) { return vec2((w.x - uViewRect.x) / uViewRect.z, 1.0 - (w.y - uViewRect.y) / uViewRect.w); }'
  ].join('\n') + '\n';
  var FS_TOP_BED = TOP_COMMON + [
    'varying vec2 vUv;',
    'uniform vec4 uShadows[12];',
    'void main() {',
    '  float facet;',
    '  vec2 w = facetPos(uViewRect.xy + vec2(vUv.x, 1.0 - vUv.y) * uViewRect.zw, facet);',
    '  vec4 m = texture2D(uMap, w / uWorld);',
    '  float E = coast(w, m.r * 16.0 - 12.0), rocky = m.a;',
    '  float gx = elev(w + vec2(0.7, 0.0)) - elev(w - vec2(0.7, 0.0)), gy = elev(w + vec2(0.0, 0.7)) - elev(w - vec2(0.0, 0.7));',
    '  vec3 N = normalize(vec3(-gx, 1.0, -gy) * vec3(E > 0.0 ? 2.6 : 1.1, 1.0, E > 0.0 ? 2.6 : 1.1));',
    // a map seen from above stays readable when the sun is low: light it from at least ~35 degrees up,
    // keeping the sun's direction (and its long shadows below) so slopes still show which way it shines
    '  vec3 Ls = normalize(vec3(uSunDir.x, max(uSunDir.y, 0.6 * length(uSunDir.xz)), uSunDir.z));',
    '  float diff = max(dot(N, Ls), 0.0);',
    '  diff = cel(diff);',
    '  float n1 = tnoise(w * 0.045), n2 = tnoise(w * 0.29);',
    '  float cells = texture2D(uDetail, w * 0.11).a, cells2 = texture2D(uDetail, w * 0.23 + 0.5).a;',
    '  vec2 sdir = -uSunDir.xz / max(uSunDir.y, 0.3);                      // shadows fall away from the sun',
    '  vec3 amb = mix(uSkyHor, uSkyTop, 0.5) * 0.42;',
    '  vec3 col; float a; float ink = 0.0;',
    '  if (E > 0.0) {',
    '    if (uScenery < 0.5) { gl_FragColor = vec4(0.0); return; }',
    '    float g = smoothstep(0.82, 1.1, E + (n1 - 0.5) * 0.6);',
    '    col = mix(uSand * (0.9 + 0.2 * n2), uGrass * (0.78 + 0.45 * n1) * (0.92 + 0.16 * n2), uCrisp > 0.5 ? step(0.5, g) : g);',
    '    col = mix(col, uRock * (0.78 + 0.35 * n2), rocky);',
    '    if (isStyle(3.0)) col *= 0.93 + 0.12 * facet;',
    '    col *= 1.0 - 0.28 * (1.0 - smoothstep(0.0, 0.3, E)) * (1.0 - g);  // damp sand at the water\'s edge',
    '    vec2 tc = floor(w / 4.6), tp = (tc + 0.25 + 0.5 * vec2(hash(tc), hash(tc + 9.1))) * 4.6;',
    '    float tr = 1.35 + 0.65 * hash(tc + 3.3);',
    '    float tree = step(0.42, hash(tc + 5.7)) * step(1.25, elev(tp)) * step(rocky, 0.1);',
    '    float td = length(w - tp) / tr;',
    '    float shade = tree * (1.0 - smoothstep(0.82, 1.05, length(w - tp - sdir * tr * 0.7) / tr)) * step(1.0, td);',
    '    col *= (amb + uSunCol * diff * 0.8) * (1.0 - 0.38 * shade);',
    '    if (tree > 0.5 && td < 1.0) {                                       // a tree crown, lit from the sun\'s side',
    '      float hl = 1.0 - smoothstep(0.0, 1.0, length(w - tp + normalize(sdir) * tr * 0.38) / tr);',
    '      col = uGrass * 0.55 * (0.7 + 0.6 * qz(hl)) * (0.9 + 0.2 * hash(tc)) * (amb * 1.4 + uSunCol * 0.55);',
    '      if (isStyle(1.0)) col = mix(col, vec3(0.06, 0.1, 0.08), smoothstep(0.86, 0.97, td));',
    '    }',
    '    if (isStyle(1.0)) col = mix(col, vec3(0.08, 0.12, 0.2), lineAA(E - 0.03, E, 1.8, 0.04) * 0.7);',
    '    ink = max(lineAA(E - 0.02, E, 1.6, 0.03), iso(E, 0.8, 0.9, 0.03) * 0.5);',
    '    ink = max(ink, step(0.85, E) * step(0.9, hash(floor(gl_FragCoord.xy))) * 0.6);',
    '    ink = max(ink, tree * lineAA((td - 1.0) * tr, td * tr, 1.3, 0.25));',
    '    ink = max(ink, shade * hatch(0.5, gl_FragCoord.xy) * 0.6);',
    '    a = 0.0;',
    '  } else {',
    '    float depth = -E;',
    '    col = seabedSand() * (0.88 + 0.2 * n2) * mix(vec3(1.0), vec3(0.82, 0.9, 0.88), smoothstep(1.0, 8.0, depth));',
    '    float weed = smoothstep(0.61, 0.67, n1 + 0.1 * n2) * smoothstep(1.5, 3.0, depth);',
    '    col = mix(col, vec3(0.22, 0.36, 0.2) * (0.8 + 0.3 * n2), weed * 0.7);',
    '    col = mix(col, uRock * 0.85, smoothstep(0.7, 0.78, cells) * smoothstep(4.0, 6.0, depth) * 0.7);',
    '    col = mix(col, uRock * (0.7 + 0.3 * n2), clamp(rocky * 1.5, 0.0, 1.0));',
    '    float coral = smoothstep(0.74, 0.8, cells2) * step(0.62, tnoise(w * 0.03)) * smoothstep(1.0, 2.0, depth) * (1.0 - smoothstep(4.0, 6.5, depth));',
    '    col = mix(col, mix(vec3(0.95, 0.47, 0.42), vec3(0.8, 0.5, 0.9), hash(floor(w * 1.5))), coral * 0.8);',
    '    if (isStyle(3.0)) col *= 0.93 + 0.14 * facet;',
    '    else col *= 0.93 + 0.07 * sin(dot(w, vec2(2.3, 1.4)) + n2 * 6.0);   // sand ripples',
    '    vec2 q = w - sdir * depth;                                          // shadows of floating things',
    '    float sh = 0.0;',
    '    for (int i = 0; i < 12; i++) {',
    '      vec4 s = uShadows[i]; if (s.z <= 0.0) continue;',
    '      sh = max(sh, (1.0 - smoothstep(0.65, 1.1 + depth * 0.05, length(q - s.xy) / s.z)) * s.w);',
    '    }',
    '    vec3 att = exp(-uSigma * depth * 0.45);',
    '    col *= amb * mix(vec3(1.0), att, 0.5) + uSunCol * diff * att * (0.55 + 0.6 * mix(vec3(0.8), causticRGB(w * 0.06), exp(-depth * 0.22))) * (1.0 - 0.7 * sh);',
    '    ink = iso(E, 3.0, 0.9, 0.06) * 0.4;',
    '    a = clamp(depth / 12.0, 0.0, 1.0);',
    '  }',
    '  if (isStyle(5.0)) col = mix(uPaper, uInk, clamp(ink, 0.0, 1.0));',
    '  gl_FragColor = vec4(col, a);',
    '}'
  ].join('\n');
  // ---- 2D top down, pass 2: the water over it --------------------------------------------
  var FS_TOP_WATER = TOP_COMMON + [
    'varying vec2 vUv;',
    'uniform sampler2D uBed; uniform sampler2D uSim; uniform vec2 uSimSize; uniform float uFoam; uniform float uWindAmt; uniform float uStarCell;',
    'float simH(vec2 uv) { return texture2D(uSim, uv).r * 2.0 - 1.0; }',
    'void main() {',
    '  float facet;',
    '  vec2 w = facetPos(uViewRect.xy + vec2(vUv.x, 1.0 - vUv.y) * uViewRect.zw, facet);',
    '  vec2 uvm = w / uWorld;',
    '  vec4 m = texture2D(uMap, uvm);',
    '  float E = coast(w, m.r * 16.0 - 12.0), dW = m.g * 24.0;',
    '  vec2 e = 1.0 / uSimSize;',
    '  float rip = simH(uvm);',
    '  float hx = simH(uvm + vec2(e.x, 0.0)) - simH(uvm - vec2(e.x, 0.0)), hy = simH(uvm + vec2(0.0, e.y)) - simH(uvm - vec2(0.0, e.y));',
    '  float n1 = tnoise(w * 0.07);',
    '  float lace = texture2D(uWaterTex, w * 0.085 + vec2(uScrl2.y, uScrl.y)).a;',
    '  vec2 rp = ripples(w * 0.05) * uWindAmt;',
    '  float cl = texture2D(uDetail, w * 0.0055 + uCloudOff).g;',
    '  float cshadow = smoothstep(0.55, 0.78, texture2D(uDetail, w * 0.0045 + uCloudOff * 1.3 + 0.3).g) * 0.2;',
    '  float shoreZone = 1.0 - smoothstep(0.0, 4.0, dW);',
    '  float level = rip * 0.3 + shoreZone * 0.12 * (sin(uAng.w - dW * 1.1 + n1 * 6.0) + 0.3);   // waves wash up the beach',
    '  vec4 bed = texture2D(uBed, toUv(w));',
    '  vec3 col;',
    '  if (E > level) {',
    '    col = bed.rgb * (1.0 - 0.15 * (1.0 - smoothstep(0.0, 0.12, E - level)) * step(E, 0.5));',
    '    gl_FragColor = vec4(col * (1.0 - cshadow), uScenery > 0.5 ? 1.0 : 0.0);',
    '    return;',
    '  }',
    '  float depth = level - E;',
    '  vec3 rr = rainRings(w * 0.32);',
    '  vec3 N = normalize(vec3(-hx * 2.6 + rp.x * 0.5 + rr.x * 1.6, 1.0, -hy * 2.6 + rp.y * 0.5 + rr.y * 1.6));',
    '  vec4 b = texture2D(uBed, toUv(w + N.xz * min(depth, 6.0) * 0.3));    // the bottom, bent by the surface',
    '  if (b.a < 0.001) b = bed;',
    '  vec3 T = absorb(max(level + b.a * 12.0, depth * 0.5) * 1.55, uSigma);',
    '  col = b.rgb * T + scatterColor(max(level + b.a * 12.0, depth * 0.5) * 1.55) * uLight * (1.0 - T);',
    '  vec3 sky = mix(uSkyTop, uLight, smoothstep(0.5 - 0.2 * uOvercast, 0.8 - 0.2 * uOvercast, cl) * 0.8);',
    '  col = mix(col, sky, qz(clamp(0.06 + (1.0 - N.y) * 2.5, 0.0, 0.5)));',
    '  float spec = pow(max(dot(N, normalize(uSunDir + vec3(0.0, 1.0, 0.0))), 0.0), 240.0);',
    '  col += uSunCol * (uCrisp > 0.5 ? step(0.6, spec) : spec * 1.5);',
    '  float edgeF = 1.0 - smoothstep(0.0, 0.06, depth);',
    '  float bands = smoothstep(0.86, 0.97, fract(dW * 0.22 + uFr.y)) * (1.0 - smoothstep(0.6, 4.5, dW));',
    '  float churn = smoothstep(0.16, 0.5, abs(rip));',
    '  float fm = max(max(edgeF * 1.3, bands * 0.9), churn) * uFoam;',
    '  float foam = thr(fm * (0.45 + 0.85 * lace), 0.5, 0.12);',
    '  if (uStars > 0.01) col += vec3(0.9, 0.93, 1.0) * starAt((w + N.xz * 5.0) / uStarCell) * uStars * 0.8;   // stars in the water',
    '  col += uFoamCol * uLight * rr.z * 0.2;',
    '  col = mix(col, uFoamCol * uLight * (0.9 + 0.1 * N.y), foam);',
    '  if (uGlow > 0.01) col += uGlowCol * uGlow * (max(max(edgeF * 0.8, bands * 0.6), churn) * (0.35 + 0.9 * lace) + rr.z * 0.45) * (0.75 + 0.25 * sin(uAng.x + lace * 9.0));',
    '  if (isStyle(5.0)) {',
    '    col = mix(uPaper, b.rgb, clamp(dot(T, vec3(0.333)) * 1.1, 0.0, 1.0));',
    '    float ink = 0.0;',
    '    for (int i = 0; i < 4; i++) {                                     // map-maker\'s water lines along the coast',
    '      float fi = float(i), r = 0.9 + fi * 1.5 + fi * fi * 0.35 + 0.15 * sin(uAng2.x + fi);',
    '      ink = max(ink, lineAA(dW - r, dW, 1.1, 0.22) * (1.0 - fi * 0.2));',
    '    }',
    '    ink = max(ink, iso(rip, 0.18, 1.0, 0.02) * smoothstep(0.04, 0.12, abs(rip)));',
    '    col = mix(col, uInk, ink * 0.85);',
    '    col = mix(col, uPaper, foam);',
    '  }',
    '  gl_FragColor = vec4(col * (1.0 - cshadow), 1.0);',
    '}'
  ].join('\n');

  // ---- 2D sprites ----------------------------------------------------------------------
  var VS_SPRITE = VS_HEAD + [
    'attribute vec2 aPos;',
    'uniform vec4 uViewRect; uniform vec2 uCenter; uniform vec2 uSize; uniform float uAngle;',
    'varying vec2 vL;',
    'void main() { vL = aPos; vec2 q = aPos * uSize * 0.5; float c = cos(uAngle), s = sin(uAngle);',
    '  vec2 w = uCenter + vec2(c * q.x - s * q.y, s * q.x + c * q.y) - uViewRect.xy;',
    '  gl_Position = vec4(w.x / uViewRect.z * 2.0 - 1.0, 1.0 - w.y / uViewRect.w * 2.0, 0.0, 1.0); }'
  ].join('\n');
  var FS_SPRITE = [
    'varying vec2 vL; uniform float uKind; uniform vec3 uColor; uniform vec3 uColor2; uniform float uAA; uniform float uZ;',
    'float box(vec2 p, vec2 b) { vec2 d = abs(p) - b; return max(d.x, d.y); }',
    'void main() {',
    '  vec2 p = vL; float k = uKind; vec3 col = uColor; float d = 1.0;     // p.y > 0 is down',
    '  if (k < 0.5) {                                                       // crate',
    '    d = box(p, vec2(0.94));',
    '    col = uColor * (0.9 + 0.1 * step(0.5, fract(p.y * 2.0 + 0.5)));',
    '    float frame = step(0.7, max(abs(p.x), abs(p.y))) + step(abs(p.x - p.y), 0.13);',
    '    col = mix(col, uColor * 0.6, clamp(frame, 0.0, 1.0));',
    '  } else if (k < 1.5) {                                                // barrel',
    '    d = max(box(p, vec2(0.82, 0.95)), length(p * vec2(0.85, 0.55)) - 0.9);',
    '    col = mix(uColor * (1.05 - 0.35 * abs(p.x)), uColor2, step(abs(abs(p.y) - 0.5), 0.1));',
    '  } else if (k < 2.5) {                                                // rubber duck',
    '    float body = (length((p - vec2(-0.05, 0.25)) * vec2(1.0, 1.6)) - 0.75) * 0.8;',
    '    float head = length(p - vec2(0.38, -0.38)) - 0.36, beak = box(p - vec2(0.82, -0.32), vec2(0.18, 0.08));',
    '    d = min(min(body, head), beak);',
    '    col = beak < 0.0 ? vec3(1.0, 0.45, 0.1) : uColor * (1.0 - 0.15 * smoothstep(0.0, 0.6, p.y));',
    '    if (length(p - vec2(0.48, -0.48)) < 0.07) col = vec3(0.05);',
    '  } else if (k < 3.5) {                                                // sailboat seen from the side',
    '    float hull = box(p - vec2(0.0, 0.6), vec2(0.95 - (p.y - 0.36) * 0.9, 0.24));',
    '    float mast = box(p - vec2(0.0, -0.15), vec2(0.04, 0.55));',
    '    float sail = max(max(-p.x, p.x - 0.7 * (0.36 - p.y)), max(p.y - 0.3, -p.y - 0.68));',
    '    d = min(min(hull, mast), sail);',
    '    col = hull < 0.0 ? uColor : (sail < 0.0 ? vec3(0.96, 0.95, 0.9) : vec3(0.35, 0.22, 0.12));',
    '    if (hull < 0.0 && abs(p.y - 0.47) < 0.05) col = vec3(0.95);',
    '  } else if (k < 4.5) {                                                // boat seen from above, bow up',
    '    d = (length(p / vec2(0.55, 1.0)) - 0.96) * 0.55;',
    '    float deck = (length((p - vec2(0.0, 0.08)) / vec2(0.4, 0.78)) - 1.0) * 0.4;',
    '    col = deck < 0.0 ? uColor2 * (0.9 + 0.1 * step(0.5, fract(p.x * 5.0))) : uColor;',
    '    if (box(p - vec2(0.0, 0.38), vec2(0.2, 0.16)) < 0.0) col = vec3(0.92);',
    '  } else if (k < 5.5) {                                                // a drop of spray',
    '    d = length(p) - 0.9;',
    '  } else {                                                             // a fish, facing +x',
    '    float body = (length((p - vec2(0.12, 0.0)) * vec2(1.0, 2.1)) - 0.62) * 0.45;',
    '    float tail = max(max(-0.98 - p.x, p.x + 0.42), abs(p.y) - (-0.36 - p.x) * 0.95);',
    '    d = min(body, tail);',
    '    col = mix(uColor, uColor2, smoothstep(-0.05, 0.25, p.y));',
    '    if (length(p - vec2(0.5, -0.06)) < 0.07) col = vec3(0.05);',
    '  }',
    '  float a = (uZ >= 0.0 || uAA <= 0.0) ? step(d, 0.0) : 1.0 - smoothstep(-uAA, uAA, d);',
    '  if (a < (uZ >= 0.0 ? 0.5 : 0.01)) discard;',
    '  float line = smoothstep(-0.16, -0.06, d);',
    '  if (k < 4.5 || k > 5.5) col = moodTint(col) * uLight;',
    '  if (isStyle(5.0)) col = mix(uPaper, uInk, max(line, k > 4.5 && k < 5.5 ? 0.0 : hatch(0.45, gl_FragCoord.xy) * 0.35));',
    '  else if (isStyle(1.0) && (k < 4.5 || k > 5.5)) col = mix(col, vec3(0.06, 0.08, 0.14), line);',
    '  gl_FragColor = vec4(col, uZ >= 0.0 ? uZ : a);',
    '}'
  ].join('\n');

  // ---- post: palette + ordered dithering at low resolution, then a crisp upscale ----------
  var FS_QUANT = [
    'varying vec2 vUv; uniform sampler2D uTex;',
    'uniform vec3 uPal[16]; uniform float uPalN; uniform float uDither; uniform float uBits; uniform float uSat;',
    'float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }',
    'float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }',
    'vec3 ycc(vec3 c) { return vec3(dot(c, vec3(0.299, 0.587, 0.114)), c.r - c.b, c.g - 0.5 * (c.r + c.b)) * vec3(1.4, 0.7, 0.9); }',
    'void main() {',
    '  vec4 src = texture2D(uTex, vUv); vec3 c = src.rgb;',
    '  c = clamp(mix(vec3(dot(c, vec3(0.299, 0.587, 0.114))), c, uSat), 0.0, 1.0);',
    '  float b = bayer4(gl_FragCoord.xy);',
    '  if (uBits > 0.0) { float lv = exp2(uBits) - 1.0; c = floor(c * lv + 0.5 + (b - 0.47) * uDither) / lv; }',
    '  if (uPalN > 0.0) {',
    '    vec3 q = ycc(c), c1 = uPal[0], c2 = uPal[0]; float d1 = 1e9, d2 = 1e9;',
    '    for (int i = 0; i < 16; i++) {',
    '      if (float(i) >= uPalN) break;',
    '      vec3 e = ycc(uPal[i]) - q; float dd = dot(e, e);',
    '      if (dd < d1) { d2 = d1; c2 = c1; d1 = dd; c1 = uPal[i]; } else if (dd < d2) { d2 = dd; c2 = uPal[i]; }',
    '    }',
    '    float t = sqrt(d1) / max(sqrt(d1) + sqrt(d2), 1e-5);',
    '    t = clamp((t - 0.5) / max(uDither, 1e-3) + 0.5, 0.0, 1.0);',
    '    t = floor(t * 4.0 + 0.5) / 4.0;',
    '    c = (b < t) ? c2 : c1;',
    '  }',
    '  gl_FragColor = vec4(c, src.a);',
    '}'
  ].join('\n');
  var FS_RAIN = [
    'varying vec2 vUv;',
    'uniform vec2 uRes; uniform vec2 uRainDir; uniform float uRainLen; uniform float uRainAmt; uniform vec4 uRainCol;',
    'uniform vec3 uFallF; uniform vec3 uFallC;                            // how far each layer has fallen: periods done (wrapped) and the part done',
    'float h21(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }',
    'float layer(vec2 px, float spacing, float len, float fallF, float fallC, float seed) {',
    '  vec2 perp = vec2(-uRainDir.y, uRainDir.x);',
    '  float a = dot(px, uRainDir), c = dot(px, perp) / spacing, col = floor(c);',
    '  float cx = abs(fract(c) - 0.5) * spacing;                           // pixels from the middle of this column',
    '  float period = len * 3.0 + 10.0;',
    '  float y = a + (h21(vec2(col, seed)) - fallF) * period;',
    '  float kk = floor(y / period), f = y - kk * period, k = kk - fallC;',
    '  if (h21(vec2(col * 1.7 + k, seed + 3.0)) > uRainAmt) return 0.0;',
    '  float d = period * (0.3 + 0.4 * h21(vec2(k, col + seed))) - f;     // distance behind the head of the drop',
    '  return step(0.0, d) * step(d, len) * (1.0 - d / len) * (1.0 - smoothstep(0.35, 0.85, cx));',
    '}',
    'void main() {',
    '  vec2 px = vec2(vUv.x, 1.0 - vUv.y) * uRes;                           // low-res pixels, y down',
    '  float r = layer(px, 7.0, uRainLen, uFallF.x, uFallC.x, 1.0) * 0.6 + layer(px, 11.0, uRainLen * 1.6, uFallF.y, uFallC.y, 2.0) + layer(px, 5.0, uRainLen * 0.6, uFallF.z, uFallC.z, 3.0) * 0.4;',
    '  gl_FragColor = vec4(uRainCol.rgb, clamp(r, 0.0, 1.0) * uRainCol.a);',
    '}'
  ].join('\n');
  var FS_BLIT = [
    'varying vec2 vUv; uniform sampler2D uTex; uniform vec2 uUvScale; uniform float uScan; uniform float uPx;',
    'void main() {',
    '  vec4 c = texture2D(uTex, vUv * uUvScale);',
    '  if (uScan > 0.0) {',
    '    float row = uPx > 1.5 ? step(fract((gl_FragCoord.y - 0.5) / uPx), 0.34) : step(0.5, fract(gl_FragCoord.y * 0.5));',
    '    c.rgb *= 1.0 - uScan * (0.45 * row + 0.12 * step(0.66, fract(gl_FragCoord.x / 3.0)));',
    '  }',
    '  gl_FragColor = vec4(c.rgb * c.a, c.a);',
    '}'
  ].join('\n');

  // ======================================================================================
  // Meshes
  // ======================================================================================
  function MeshBuilder() { this.v = []; }
  MeshBuilder.prototype.tri = function (a, b, c, col, sway) {
    var e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    var n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], l = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]) || 1, V = this.v;
    [a, b, c].forEach(function (p) { V.push(p[0], p[1], p[2], n[0] / l, n[1] / l, n[2] / l, col[0], col[1], col[2], sway || 0); });
  };
  MeshBuilder.prototype.quad = function (a, b, c, d, col, sway) { this.tri(a, b, c, col, sway); this.tri(a, c, d, col, sway); };
  function addPalm(B, x, y, z, R) {
    var h = 5.5 + R() * 3, la = R() * 6.2832, lean = 0.12 + R() * 0.22, segs = 6, sides = 6, ring = [], s, k, top = null;
    for (s = 0; s <= segs; s++) {
      var t = s / segs, bend = lean * t * t * h, cx = x + Math.cos(la) * bend, cz = z + Math.sin(la) * bend, cy = y - 0.3 + t * h, rad = 0.26 - 0.1 * t, pts = [];
      for (k = 0; k < sides; k++) { var a = k / sides * 6.2832; pts.push([cx + Math.cos(a) * rad, cy, cz + Math.sin(a) * rad]); }
      ring.push(pts);
      if (s === segs) top = [cx, cy, cz];
    }
    for (s = 0; s < segs; s++) for (k = 0; k < sides; k++) {
      var tone = s % 2 ? 0.86 : 1;
      B.quad(ring[s][k], ring[s][(k + 1) % sides], ring[s + 1][(k + 1) % sides], ring[s + 1][k], [0.5 * tone, 0.38 * tone, 0.26 * tone], 0.05 * s / segs);
    }
    for (k = 0; k < 8; k++) {                            // fronds: drooping blades with a fold down the middle
      var fa = k / 8 * 6.2832 + R() * 0.4, len = 3.2 + R() * 1.3, droop = 0.9 + R() * 0.6, dx = Math.cos(fa), dz = Math.sin(fa), sxv = -dz, szv = dx;
      var prev = top, prevW = 0.05, green = [0.22 + R() * 0.08, 0.5 + R() * 0.12, 0.16];
      for (var p = 1; p <= 4; p++) {
        var tt = p / 4, cur = [top[0] + dx * len * tt, top[1] + 0.5 * tt - droop * tt * tt * 1.6, top[2] + dz * len * tt];
        var wdt = Math.sin(tt * Math.PI) * 0.65 + 0.06, sw = 0.3 + 0.7 * tt;
        var l0 = [prev[0] + sxv * prevW, prev[1] - prevW * 0.3, prev[2] + szv * prevW], r0 = [prev[0] - sxv * prevW, prev[1] - prevW * 0.3, prev[2] - szv * prevW];
        var l1 = [cur[0] + sxv * wdt, cur[1] - wdt * 0.3, cur[2] + szv * wdt], r1 = [cur[0] - sxv * wdt, cur[1] - wdt * 0.3, cur[2] - szv * wdt];
        B.quad(prev, cur, l1, l0, green, sw);
        B.quad(cur, prev, r0, r1, [green[0] * 0.85, green[1] * 0.85, green[2] * 0.85], sw);
        prev = cur; prevW = wdt;
      }
    }
  }
  function addRock(B, x, y, z, r, R) {
    var t = (1 + Math.sqrt(5)) / 2, V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
    var F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    var P = V.map(function (v) {
      var l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]), s = r * (0.75 + R() * 0.5) / l;
      return [x + v[0] * s * 1.2, y + v[1] * s * 0.7, z + v[2] * s];
    });
    var base = 0.5 + R() * 0.12;
    F.forEach(function (f) { var tone = 0.85 + R() * 0.25; B.tri(P[f[0]], P[f[1]], P[f[2]], [base * tone * 1.05, base * tone, base * tone * 0.92], 0); });
  }

  // ======================================================================================
  function WaterLite(canvas, opts) {
    opts = opts || {};
    this.canvas = canvas;
    var attrs = { antialias: false, alpha: !!opts.transparent, depth: true, stencil: false, powerPreference: 'low-power', preserveDrawingBuffer: !!opts.preserveDrawingBuffer };
    var gl = canvas.getContext('webgl', attrs) || canvas.getContext('experimental-webgl', attrs);
    if (!gl) throw new Error('WebGL is not available');
    this.gl = gl;
    this.opts = {};
    for (var k in DEFAULTS) this.opts[k] = DEFAULTS[k];
    this.time = 0;
    this.cam = { yaw: 1.32, pitch: 0.3, dist: 34, target: [0, 0, -5], fov: 55 * Math.PI / 180, auto: true };
    this.floaters = []; this.drops = []; this.trail = []; this.fish = [];
    this.input = { up: false, down: false, left: false, right: false };
    this.camera2d = { x: 0, y: 0, follow: null };          // 2D views: centre of the view in world units; follow: any { x, y }
    this.stats = { lowW: 0, lowH: 0, px: 1, fps: 0, scale: 1 };
    this._ev = {};
    this._initGL();
    var self = this;
    // phones and some drivers drop the GPU context (tab in background, driver reset); rebuild everything from CPU copies
    this._onLost = function (e) { e.preventDefault(); self._emit('contextlost', {}); };
    this._onRestored = function () { self._restore(); self._emit('contextrestored', {}); };
    canvas.addEventListener('webglcontextlost', this._onLost, false);
    canvas.addEventListener('webglcontextrestored', this._onRestored, false);
    this.setOptions(opts);
  }
  WaterLite.PALETTES = PALETTES; WaterLite.STYLES = STYLES; WaterLite.QUALITY = QUALITY; WaterLite.THEMES = THEMES; WaterLite.DEFAULTS = DEFAULTS;
  WaterLite.version = '2.2.0';
  WaterLite._genTextures = genTextures;   // exposed for tools and tests

  WaterLite.prototype._prog = function (vs, fsBody, name, raw) {
    var gl = this.gl;
    var fs = raw ? FS_HEAD + fsBody : (this.deriv ? '#extension GL_OES_standard_derivatives : enable\n#define HAS_DERIV 1\n' : '') + FS_HEAD + COMMON + fsBody;
    function sh(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) throw new Error(name + ': ' + gl.getShaderInfoLog(s));
      return s;
    }
    var p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, /aGrid/.test(vs) ? 'aGrid' : 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error(name + ': ' + gl.getProgramInfoLog(p));
    var locs = {};
    return { p: p, loc: function (n) { if (!(n in locs)) locs[n] = gl.getUniformLocation(p, n); return locs[n]; }, attr: function (n) { return gl.getAttribLocation(p, n); } };
  };

  // shader programs are compiled the first time a view needs them, so a game that only uses
  // the top view never pays for the 3D shaders
  var PROGRAMS = {
    sky: function () { return [VS_QUAD, FS_SKY, 'sky']; },
    world: function () { return [VS_WORLD, FS_WORLD, 'world']; },
    sea: function () { return [VS_SEA, FS_SEA, 'sea']; },
    sideBg: function () { return [VS_QUAD, FS_SIDE_BG, 'side background']; },
    sideWater: function () { return [VS_QUAD, FS_SIDE_WATER, 'side water']; },
    topBed: function () { return [VS_QUAD, FS_TOP_BED, 'top seabed']; },
    topWater: function () { return [VS_QUAD, FS_TOP_WATER, 'top water']; },
    sprite: function () { return [VS_SPRITE, FS_SPRITE, 'sprite']; },
    rain: function () { return [VS_QUAD, FS_RAIN, 'rain']; },
    quant: function () { return [VS_QUAD, FS_QUANT, 'quantize', true]; },
    blit: function () { return [VS_QUAD, FS_BLIT, 'blit', true]; }
  };
  var TEXTURES = null;                                     // generated once per page, shared by every instance
  WaterLite.prototype._initGL = function () {
    var gl = this.gl, self = this, hp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT), dbg = gl.getExtension('WEBGL_debug_renderer_info');
    this.deriv = !!gl.getExtension('OES_standard_derivatives');
    this.stats.highp = !!(hp && hp.precision > 0);
    try { this.stats.gpu = String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)); } catch (e) { this.stats.gpu = 'unknown'; }
    this._progs = {};
    this.prog = {};
    Object.keys(PROGRAMS).forEach(function (k) {
      Object.defineProperty(self.prog, k, { enumerable: true, configurable: true, get: function () {
        return self._progs[k] || (self._progs[k] = self._prog.apply(self, PROGRAMS[k]()));
      } });
    });
    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    this.tex = {}; this.fbos = {};
    var T = TEXTURES || (TEXTURES = genTextures(1));
    this.texData = T;
    this.tex.water = this._repeatTex(T.water, T.size);
    this.tex.detail = this._repeatTex(T.detail, T.size);
    var crate = this._box([0.62, 0.43, 0.24], [0.42, 0.28, 0.15]), barrel = this._box([0.24, 0.42, 0.62], [0.16, 0.28, 0.42]), buoy = this._box([0.92, 0.22, 0.15], [0.95, 0.95, 0.92]);
    this.meshes = { crate: this._upload(crate), barrel: this._upload(barrel), buoy: this._upload(buoy), boat: this._upload(this._boat()) };
  };
  WaterLite.prototype._repeatTex = function (data, N) {
    var gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, N, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    return t;
  };
  // the blue channel of the detail texture, for physics that must match the drawn seabed
  WaterLite.prototype._texB = function (u, v) {
    var T = this.texData, N = T.size, x = u * N - 0.5, y = v * N - 0.5, ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    function at(i, j) { return T.detail[((((j % N) + N) % N) * N + (((i % N) + N) % N)) * 4 + 2] / 255; }
    return (at(ix, iy) * (1 - fx) + at(ix + 1, iy) * fx) * (1 - fy) + (at(ix, iy + 1) * (1 - fx) + at(ix + 1, iy + 1) * fx) * fy;
  };
  WaterLite.prototype._upload = function (B) {
    var gl = this.gl, b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(B.v), gl.STATIC_DRAW);
    return { buf: b, count: B.v.length / 10 };
  };
  WaterLite.prototype._box = function (c, edge) {
    var B = new MeshBuilder();
    [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].forEach(function (n) {
      var u = [n[1], n[2], n[0]], v = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
      function P(a, b) { return [0.5 * (n[0] + a * u[0] + b * v[0]), 0.5 * (n[1] + a * u[1] + b * v[1]), 0.5 * (n[2] + a * u[2] + b * v[2])]; }
      var tone = n[1] > 0 ? 1.1 : 1, cc = [c[0] * tone, c[1] * tone, c[2] * tone], ee = [edge[0] * tone, edge[1] * tone, edge[2] * tone];
      B.quad(P(-0.72, -0.72), P(0.72, -0.72), P(0.72, 0.72), P(-0.72, 0.72), cc, 0);          // face
      B.quad(P(-1, -1), P(1, -1), P(0.72, -0.72), P(-0.72, -0.72), ee, 0);                     // frame
      B.quad(P(1, -1), P(1, 1), P(0.72, 0.72), P(0.72, -0.72), ee, 0);
      B.quad(P(1, 1), P(-1, 1), P(-0.72, 0.72), P(0.72, 0.72), ee, 0);
      B.quad(P(-1, 1), P(-1, -1), P(-0.72, -0.72), P(-0.72, 0.72), ee, 0);
    });
    return B;
  };
  WaterLite.prototype._boat = function () {
    var B = new MeshBuilder(), hull = [0.88, 0.88, 0.85], red = [0.72, 0.14, 0.1], deck = [0.58, 0.4, 0.24], sail = [0.96, 0.95, 0.9];
    var Bw = [2.2, 0.5, 0], S1 = [-1.6, 0.5, 0.8], S2 = [-1.6, 0.5, -0.8], K = [1.0, -0.45, 0], K2 = [-1.5, -0.35, 0], M1 = [0.3, 0.5, 0.9], M2 = [0.3, 0.5, -0.9];
    B.tri(Bw, M1, K, hull); B.tri(Bw, K, M2, hull); B.tri(M1, S1, K2, red); B.tri(M1, K2, K, red); B.tri(M2, K, K2, red); B.tri(M2, K2, S2, red);
    B.tri(S1, S2, K2, hull); B.tri(Bw, M2, M1, deck); B.tri(M1, M2, S2, deck); B.tri(M1, S2, S1, deck);
    B.quad([0.17, 0.5, -0.06], [0.23, 0.5, 0.06], [0.23, 4.3, 0.04], [0.17, 4.3, -0.04], deck);
    B.tri([0.25, 0.9, 0], [0.25, 4.1, 0], [-1.45, 0.9, 0], sail, 0.15);
    B.tri([0.3, 1.0, 0], [1.9, 0.75, 0], [0.3, 3.4, 0], sail, 0.15);
    return B;
  };

  // ---- options -------------------------------------------------------------------------
  WaterLite.prototype.setOptions = function (o) {
    o = o || {};
    var prev = {}, k;
    for (k in this.opts) prev[k] = this.opts[k];
    for (k in o) if (o[k] !== undefined && k in DEFAULTS) this.opts[k] = o[k];
    var op = this.opts, st = STYLES[op.style] || STYLES.realistic, th = THEMES[op.style] || THEMES.realistic, c = op.colors || {};
    var M = MOODS[op.mood] || MOODS.day, ink = st.id === 5, rain = op.rain >= 0 ? clamp(+op.rain, 0, 1) : (M.rain || 0);
    this.style = st;
    this.colors = {};
    for (k in th) this.colors[k] = hex(c[k] || th[k]);
    var C = this.colors;
    C.glow = hex(c.glow || '#3ff2d8');
    function mixc(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
    function grey(a, t) { var l = a[0] * 0.3 + a[1] * 0.59 + a[2] * 0.11; return mixc(a, [l, l, l], t); }
    var light = M.light.slice(), soft = PALETTES[op.palette === 'auto' ? st.palette : op.palette] ? (M.soft || 0) : 0;
    // a fixed palette has few dark colours: keep the mood gentler so dark scenes land on them instead of dithering between them
    light = light.map(function (v) { return v + (1 - v) * soft; });
    if (ink) {                                             // ink keeps its look: paper and ink change with the mood
      if (M.paper && !c.paper) C.paper = hex(M.paper);
      if (M.ink && !c.ink) C.ink = hex(M.ink);
      light = [1, 1, 1];
    } else {
      var skyMid = mixc(C.skyTop, C.skyHorizon, 0.5);
      if (M.skyTop && !c.skyTop) C.skyTop = mixc(C.skyTop, hex(M.skyTop), 0.85);
      if (M.skyHorizon && !c.skyHorizon) C.skyHorizon = mixc(C.skyHorizon, hex(M.skyHorizon), 0.85);
      C.skyMid = M.skyMid ? mixc(skyMid, hex(M.skyMid), 0.85) : mixc(C.skyTop, C.skyHorizon, 0.5);
      if (M.moon) C.sun = M.moon.map(function (v) { return v + (1 - v) * soft * 0.9; });
      else C.sun = [0, 1, 2].map(function (i) { return C.sun[i] * (M.sun[i] + (1 - M.sun[i]) * Math.min(soft * 1.8, 1)); });
      if (M.desat) ['sand', 'grass', 'rock', 'wood', 'paint'].forEach(function (key) { if (!c[key]) C[key] = grey(C[key], M.desat); });
      if (rain > 0) {                                      // rain greys the sky and dims the light a little
        C.skyTop = grey(C.skyTop, rain * 0.5); C.skyHorizon = grey(C.skyHorizon, rain * 0.45); C.skyMid = grey(C.skyMid, rain * 0.48);
        C.sun = C.sun.map(function (v) { return v * (1 - 0.35 * rain); });
        light = light.map(function (v) { return v * (1 - 0.18 * rain); });
      }
    }
    if (!C.skyMid) C.skyMid = mixc(C.skyTop, C.skyHorizon, 0.5);
    this.env = { light: light, stars: ink ? 0 : (M.stars || 0), glow: ink ? 0 : (M.glow || 0), lightning: M.lightning || 0, overcast: Math.max(M.overcast || 0, rain * 0.6), wind: M.wind || 1, desat: ink ? 0 : (M.desat || 0) };
    this.rainAmt = rain;
    var sh = hex(c.tint || c.shallow || th.tint || th.shallow), cl = Math.max(op.clarity, 0.05);
    this.colors.tint = sh;
    this.sigma = [0, 1, 2].map(function (i) { return -Math.log(Math.max(sh[i], 0.03)) * 0.24 * (st.murk || 1) * (M.murk || 1) / cl; });
    this.pixelSize = op.pixelSize > 0 ? op.pixelSize : st.pixel;
    this.palName = op.palette === 'auto' ? st.palette : op.palette;
    this.dither = op.dither >= 0 ? op.dither : st.dither;
    var elD = op.sunElevation === DEFAULTS.sunElevation && M.elev !== undefined ? M.elev : op.sunElevation;
    var azD = op.sunAzimuth === DEFAULTS.sunAzimuth && M.az !== undefined ? M.az : op.sunAzimuth;
    this.sunElev = elD;
    var el = elD * Math.PI / 180, az = azD * Math.PI / 180;
    this.sunDir = [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)];
    this.q = QUALITY[op.quality] || QUALITY.low;
    var waveKeys = ['quality', 'wind', 'windDir', 'waveHeight', 'choppiness', 'seed', 'mood'];
    if (!this.waves || waveKeys.some(function (key) { return prev[key] !== op[key]; })) this._buildWaves();
    var gridKey = op.quality + (op.style === 'lowpoly' ? '/facets' : '');
    if (this._gridKey !== gridKey) { this._gridKey = gridKey; this._buildGrid(op.style === 'lowpoly' ? 46 : this.q.grid); }
    var fresh = !this._ready, modeChanged = prev.mode !== op.mode || fresh, qChanged = prev.quality !== op.quality;
    if (op.mode === 'side' && (modeChanged || qChanged || prev.floaters !== op.floaters || prev.seed !== op.seed || prev.worldWidth !== op.worldWidth)) this._initSide();
    if (op.mode === 'top' && (modeChanged || qChanged || prev.seed !== op.seed || prev.land !== op.land || prev.boat !== op.boat || prev.floaters !== op.floaters || String(prev.mapSize) !== String(op.mapSize))) this._initTop();
    if (op.mode === '3d' && (modeChanged || qChanged || prev.seed !== op.seed || prev.boat !== op.boat || prev.floaters !== op.floaters || JSON.stringify(prev.islands) !== JSON.stringify(op.islands))) this._initThree();
    if (modeChanged) {                                     // a fresh 2D camera: the left end of the side world, the middle of the map
      var cam = this.camera2d;
      cam.follow = null;
      if (op.mode === 'side') cam.x = SIDE.W / 2;
      if (op.mode === 'top') { cam.x = this.top.worldW / 2; cam.y = this.top.worldH / 2; }
    }
    this._ready = true;
    return this;
  };

  // A few Gerstner waves drawn from a Pierson-Moskowitz spectrum for the wind speed.
  WaterLite.prototype._buildWaves = function () {
    var o = this.opts, n = this.q.waves, R = rng(o.seed * 7919 + 13), U = Math.max(this._windSpeed(), 0.5);
    var wp = 0.877 * G / U, A = new Float32Array(64), B = new Float32Array(64), alpha = 0.0081;
    var wmin = wp * 0.75, wmax = wp * 4.5, sumA = 0, i;
    this.waves = [];
    for (i = 0; i < n; i++) {
      var f = (i + 0.5) / n, w = wmin * Math.pow(wmax / wmin, f), dw = w * Math.log(wmax / wmin) / n;
      var S = alpha * G * G / Math.pow(w, 5) * Math.exp(-1.25 * Math.pow(wp / w, 4));
      var amp = Math.sqrt(2 * S * dw) * o.waveHeight, kk = w * w / G;
      var dir = (o.windDir + (R() - 0.5) * 70 * (0.4 + f)) * Math.PI / 180;
      this.waves.push({ dx: Math.cos(dir), dz: Math.sin(dir), k: kk, a: amp, w: w, ph: R() * 6.2832 });
      sumA += amp;
    }
    var chop = clamp(o.choppiness, 0, 1);
    for (i = 0; i < n; i++) {
      var wv = this.waves[i];
      wv.q = chop / Math.max(wv.k * wv.a * n, 1e-4);
      A.set([wv.dx, wv.dz, wv.k, wv.a], i * 4); B.set([wv.w, wv.ph, wv.q, 0], i * 4);
    }
    this.waveA = A; this.waveB = B; this.amp = sumA;
  };

  // Surface at a point. 3D: { height, normal } at world x, z. Side: height at x (view units, up positive).
  // Top: ripple height at world x, y.
  WaterLite.prototype.sample = function (x, z) {
    var m = this.opts.mode;
    if (m === 'side') return { height: this._sideHeight(x), normal: null };
    if (m === 'top') return { height: this._topHeight(x, z), normal: null };
    var t = this.time, W = this.waves, px = x, pz = z, i, wv, th, att = this._waveAtten(x, z);
    for (var it = 0; it < 3; it++) {
      var ox = 0, oz = 0;
      for (i = 0; i < W.length; i++) { wv = W[i]; th = wv.k * (wv.dx * px + wv.dz * pz) - wv.w * t + wv.ph; var c = Math.cos(th) * wv.q * wv.a * att; ox += wv.dx * c; oz += wv.dz * c; }
      px = x - ox; pz = z - oz;
    }
    var h = 0, nx = 0, nz = 0, ny = 1;
    for (i = 0; i < W.length; i++) {
      wv = W[i]; th = wv.k * (wv.dx * px + wv.dz * pz) - wv.w * t + wv.ph;
      var s = Math.sin(th), cc = Math.cos(th), A = wv.a * att, wa = wv.k * A;
      h += A * s; nx -= wv.dx * wa * cc; nz -= wv.dz * wa * cc; ny -= wv.q * wa * s;
    }
    var l = Math.sqrt(nx * nx + ny * ny + nz * nz);
    return { height: h, normal: [nx / l, ny / l, nz / l] };
  };

  // ---- 3D --------------------------------------------------------------------------------
  WaterLite.prototype._buildGrid = function (N) {
    var gl = this.gl, pos = new Float32Array(N * N * 2), idx = new Uint16Array((N - 1) * (N - 1) * 6), k = 0, i, j;
    for (j = 0; j < N; j++) for (i = 0; i < N; i++) { pos[(j * N + i) * 2] = i / (N - 1) * 2 - 1; pos[(j * N + i) * 2 + 1] = j / (N - 1) * 2 - 1; }
    for (j = 0; j < N - 1; j++) for (i = 0; i < N - 1; i++) {
      var a = j * N + i, b = a + 1, c = a + N, d = c + 1;
      idx[k++] = a; idx[k++] = c; idx[k++] = b; idx[k++] = b; idx[k++] = c; idx[k++] = d;
    }
    if (this.grid) { gl.deleteBuffer(this.grid.vb); gl.deleteBuffer(this.grid.ib); }
    var vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
    var ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    this.grid = { vb: vb, ib: ib, count: idx.length, n: N };
  };
  WaterLite.prototype._waveAtten = function (x, z) {
    var a = 1, I = this.islands || [];
    for (var k = 0; k < I.length && k < 6; k++) a = Math.min(a, smooth(1.15, 2.1, Math.sqrt((x - I[k].x) * (x - I[k].x) + (z - I[k].z) * (z - I[k].z)) / I[k].r));
    return 0.1 + 0.9 * a;
  };
  // height of the land and seabed (metres, sea level 0)
  WaterLite.prototype._terrainHeight = function (x, z) {
    var e = -26, I = this.islands, s = this.opts.seed, k;
    var wx = vnoise(x * 0.02, z * 0.02, s) - 0.5, wz = vnoise(x * 0.02 + 5.2, z * 0.02 + 1.3, s) - 0.5;
    for (k = 0; k < I.length; k++) {
      var c = I[k], dx = x - c.x + wx * c.r * 0.55, dz = z - c.z + wz * c.r * 0.55, u = Math.sqrt(dx * dx + dz * dz) / c.r, h;
      if (u > 3) continue;
      if (u < 1) h = (1 - u) * 2.2 + c.hill * Math.pow(1 - smooth(0.05, 0.92, u), 1.4) * (0.55 + 0.7 * vnoise(x * 0.07, z * 0.07, s + 3)) + c.hill * 0.35 * (vnoise(x * 0.19, z * 0.19, s + 4) - 0.5) * smooth(1, 0.6, u);
      else {
        var t1 = clamp((u - 1) / 0.85, 0, 1);
        h = -4.2 * (1 - Math.pow(1 - t1, 1.7)) - 21.8 * smooth(1.85, 2.9, u);
        h += (vnoise(x * 0.11, z * 0.11, s + 7) - 0.5) * 0.8 * smooth(1.0, 1.3, u);
      }
      if (h > e) e = h;
    }
    var Hd = this.heads;
    for (k = 0; k < Hd.length; k++) {
      var hd = Hd[k], q = ((x - hd.x) * (x - hd.x) + (z - hd.z) * (z - hd.z)) / (hd.r * hd.r);
      if (q < 2.5) e = Math.max(e, hd.top - q * q * 1.6);
    }
    return e;
  };
  WaterLite.prototype._initThree = function () {
    var R = rng(this.opts.seed * 101 + 9), gl = this.gl, q = this.q, self = this, t, k;
    var own = Array.isArray(this.opts.islands) && this.opts.islands.length ? this.opts.islands : null;
    var isl = own ? own.map(function (o) { return { x: +o.x || 0, z: +o.z || 0, r: clamp(+o.r || 20, 3, 120), hill: clamp(o.hill === undefined ? 6 : +o.hill, 0, 40) }; }) : [{ x: 0, z: -42, r: 24, hill: 9 }];
    for (t = 0; t < 400 && isl.length < 6 && !own; t++) {
      var a = R() * 6.2832, d = 75 + R() * 95, r = 12 + R() * 20;
      var c = { x: Math.cos(a) * d, z: Math.sin(a) * d - 30, r: r, hill: 2 + R() * 9 };
      if (Math.sqrt(c.x * c.x + c.z * c.z) < 50 + r * 2.4) continue;
      if (isl.every(function (o) { return Math.sqrt((c.x - o.x) * (c.x - o.x) + (c.z - o.z) * (c.z - o.z)) > (c.r + o.r) * 2.3; })) isl.push(c);
    }
    this.islands = isl;
    this.heads = [];
    for (t = 0; t < 30; t++) {                           // coral heads and rocks in the lagoons
      var ci = t < 20 ? isl[0] : isl[1 + (t % (isl.length - 1 || 1))] || isl[0], ang = R() * 6.2832, u = 1.18 + R() * 0.6;
      this.heads.push({ x: ci.x + Math.cos(ang) * ci.r * u, z: ci.z + Math.sin(ang) * ci.r * u, r: 1.2 + R() * 2.4, top: -1.7 + R() * 2.0 });
    }
    // terrain mesh
    // the terrain mesh covers the islands: 400 m around (0, -30) for the made layout, grown to fit your own
    var bx0 = -170, bx1 = 170, bz0 = -200, bz1 = 140;
    if (own) isl.forEach(function (o) { bx0 = Math.min(bx0, o.x - o.r * 3); bx1 = Math.max(bx1, o.x + o.r * 3); bz0 = Math.min(bz0, o.z - o.r * 3); bz1 = Math.max(bz1, o.z + o.r * 3); });
    var N = q.terrain, S = clamp(Math.max(bx1 - bx0, bz1 - bz0) + 60, 400, 900), cx = own ? (bx0 + bx1) / 2 : 0, cz = own ? (bz0 + bz1) / 2 : -30, step = S / (N - 1), H = new Float32Array(N * N), i, j;
    for (j = 0; j < N; j++) for (i = 0; i < N; i++) H[j * N + i] = this._terrainHeight(cx - S / 2 + i * step, cz - S / 2 + j * step);
    var vtx = new Float32Array(N * N * 7), DIRS = [[1, 0], [0.7, 0.7], [0, 1], [-0.7, 0.7], [-1, 0], [-0.7, -0.7], [0, -1], [0.7, -0.7]];
    function hAt(a, b) { return H[clamp(Math.round(b), 0, N - 1) * N + clamp(Math.round(a), 0, N - 1)]; }
    for (j = 0; j < N; j++) for (i = 0; i < N; i++) {
      var hl = H[j * N + Math.max(i - 1, 0)], hr = H[j * N + Math.min(i + 1, N - 1)], hd = H[Math.max(j - 1, 0) * N + i], hu = H[Math.min(j + 1, N - 1) * N + i];
      var nx = -(hr - hl) / (2 * step), nz = -(hu - hd) / (2 * step), nl = Math.sqrt(nx * nx + 1 + nz * nz), o = (j * N + i) * 7, h0 = H[j * N + i], occ = 0;
      for (var dd = 0; dd < 8; dd++) for (var rr = 1; rr <= 4; rr *= 2) {   // how much of the sky the slopes around hide
        var rise = (hAt(i + DIRS[dd][0] * rr, j + DIRS[dd][1] * rr) - h0) / (rr * step);
        if (rise > 0) occ += Math.min(rise, 1.5) / rr;
      }
      vtx[o] = cx - S / 2 + i * step; vtx[o + 1] = h0; vtx[o + 2] = cz - S / 2 + j * step;
      vtx[o + 3] = nx / nl; vtx[o + 4] = 1 / nl; vtx[o + 5] = nz / nl;
      vtx[o + 6] = clamp(1 - occ * 0.16, 0.45, 1);
    }
    var idx = new Uint16Array((N - 1) * (N - 1) * 6), n = 0;
    for (j = 0; j < N - 1; j++) for (i = 0; i < N - 1; i++) {
      var i0 = j * N + i, i1 = i0 + 1, i2 = i0 + N, i3 = i2 + 1;
      idx[n++] = i0; idx[n++] = i2; idx[n++] = i1; idx[n++] = i1; idx[n++] = i2; idx[n++] = i3;
    }
    this.terrainData = { vtx: vtx, idx: idx, props: null };
    // palms and boulders
    var B = new MeshBuilder();
    isl.forEach(function (c, ii) {
      var want = Math.round(c.r / (ii === 0 ? 2.6 : 4)), placed = 0;
      for (var tries = 0; tries < want * 30 && placed < want; tries++) {
        var aa = R() * 6.2832, uu = 0.2 + R() * 0.65, px = c.x + Math.cos(aa) * c.r * uu, pz = c.z + Math.sin(aa) * c.r * uu, py = self._terrainHeight(px, pz);
        if (py < 0.7 || py > 2.5 + c.hill * 0.4) continue;
        var sl = Math.abs(self._terrainHeight(px + 1, pz) - py) + Math.abs(self._terrainHeight(px, pz + 1) - py);
        if (sl > 0.6) continue;
        addPalm(B, px, py, pz, R); placed++;
      }
      for (k = 0; k < (ii === 0 ? 7 : 2); k++) {
        var ba = R() * 6.2832, bu = 0.9 + R() * 0.25, bx = c.x + Math.cos(ba) * c.r * bu, bz = c.z + Math.sin(ba) * c.r * bu;
        addRock(B, bx, self._terrainHeight(bx, bz) + 0.2, bz, 0.8 + R() * 1.4, R);
      }
    });
    this.terrainData.props = new Float32Array(B.v);
    this._uploadTerrain();
    // floating things in the lagoon in front of the camera, each on a slack mooring
    this.floaters = []; this.trail = [];
    if (this.opts.floaters) {
      var spots = [[-6, 3, 'crate'], [3.5, 6, 'barrel'], [8, -1, 'crate'], [-2, -7, 'buoy'], [-11, -4, 'barrel'], [5, -9, 'crate']];
      spots.forEach(function (sp) {
        var fx = sp[0], fz = sp[1];
        for (var g = 0; g < 8 && self._terrainHeight(fx, fz) > -1.2; g++) { fx *= 1.15; fz += 2; }
        self.addFloater(fx, fz, { kind: sp[2] });
      });
    }
    this.boat3d = this.opts.boat ? { ang: 0.6, radius: isl[0].r * 2.25, speed: 4.2, x: 0, z: 0, y: 0, heading: 0, tilt: [0, 0] } : null;
  };
  WaterLite.prototype._uploadTerrain = function () {
    var gl = this.gl, D = this.terrainData;
    if (this.terrain) { gl.deleteBuffer(this.terrain.vb); gl.deleteBuffer(this.terrain.ib); }
    if (this.props) gl.deleteBuffer(this.props.buf);
    var vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, D.vtx, gl.STATIC_DRAW);
    var ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, D.idx, gl.STATIC_DRAW);
    this.terrain = { vb: vb, ib: ib, count: D.idx.length };
    var pb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pb); gl.bufferData(gl.ARRAY_BUFFER, D.props, gl.STATIC_DRAW);
    this.props = { buf: pb, count: D.props.length / 10 };
  };
  WaterLite.prototype._update3d = function (dt) {
    var self = this;
    this.floaters.forEach(function (f) {
      var s = self.sample(f.x, f.z), target = s.height - f.size[1] * 0.5 * (f.density * 2 - 1);
      f.vy += ((target - f.y) * 30 - f.vy * 4.5 - (f.y > s.height + 0.2 ? 9.81 : 0)) * dt;
      f.y += f.vy * dt;
      f.tilt[0] += (s.normal[2] * 1.2 - f.tilt[0]) * Math.min(dt * 4, 1);
      f.tilt[1] += (-s.normal[0] * 1.2 - f.tilt[1]) * Math.min(dt * 4, 1);
      f.vx = (f.vx || 0) + (s.normal[0] * 0.8 + (f.hx - f.x) * 0.05) * dt; f.vz = (f.vz || 0) + (s.normal[2] * 0.8 + (f.hz - f.z) * 0.05) * dt;
      f.vx *= 1 - dt * 0.5; f.vz *= 1 - dt * 0.5;
      f.x += f.vx * dt; f.z += f.vz * dt; f.yaw += (f.vx - f.vz) * dt * 0.1;
    });
    var b = this.boat3d;
    if (b) {
      var c = this.islands[0];
      b.ang += b.speed / b.radius * dt;
      b.x = c.x + Math.cos(b.ang) * b.radius; b.z = c.z + Math.sin(b.ang) * b.radius;
      b.heading = b.ang + Math.PI / 2;
      var s = this.sample(b.x, b.z);
      b.y += (s.height - b.y) * Math.min(dt * 5, 1);
      b.tilt[0] += (s.normal[2] - b.tilt[0]) * Math.min(dt * 3, 1); b.tilt[1] += (-s.normal[0] - b.tilt[1]) * Math.min(dt * 3, 1);
      this._trailT = (this._trailT || 0) + dt;
      if (this._trailT > 0.35) {
        this._trailT = 0;
        this.trail.unshift({ x: b.x - Math.cos(b.heading) * 1.8, z: b.z - Math.sin(b.heading) * 1.8, life: 1 });
        if (this.trail.length > 8) this.trail.pop();
      }
    }
    this.trail.forEach(function (t) { t.life -= dt * 0.36; });
    var cam = this.cam;
    if (cam.auto) { cam.autoT = (cam.autoT || 0) + dt; cam.yaw = 1.32 + 0.38 * Math.sin(cam.autoT * 0.07); }
  };
  function lookAt(eye, at) {
    var f = [at[0] - eye[0], at[1] - eye[1], at[2] - eye[2]], fl = Math.sqrt(f[0] * f[0] + f[1] * f[1] + f[2] * f[2]); f = [f[0] / fl, f[1] / fl, f[2] / fl];
    var r = [-f[2], 0, f[0]], rl = Math.sqrt(r[0] * r[0] + r[2] * r[2]) || 1; r = [r[0] / rl, 0, r[2] / rl];
    var u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    return { f: f, r: r, u: u, m: [r[0], u[0], -f[0], 0, r[1], u[1], -f[1], 0, r[2], u[2], -f[2], 0,
      -(r[0] * eye[0] + r[1] * eye[1] + r[2] * eye[2]), -(u[0] * eye[0] + u[1] * eye[1] + u[2] * eye[2]), f[0] * eye[0] + f[1] * eye[1] + f[2] * eye[2], 1] };
  }
  function mul(a, b) { var o = new Float32Array(16); for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; return o; }
  function persp(fov, asp, n, f) { var t = 1 / Math.tan(fov / 2); return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]; }
  function model(x, y, z, yaw, tx, tz, sx, sy, sz) {
    var cy = Math.cos(yaw), sy2 = Math.sin(yaw), cx = Math.cos(tx), sxx = Math.sin(tx), cz = Math.cos(tz), szz = Math.sin(tz);
    var Ry = [cy, 0, -sy2, 0, 0, 1, 0, 0, sy2, 0, cy, 0, 0, 0, 0, 1], Rx = [1, 0, 0, 0, 0, cx, sxx, 0, 0, -sxx, cx, 0, 0, 0, 0, 1], Rz = [cz, szz, 0, 0, -szz, cz, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    var o = mul(mul(Ry, mul(Rx, Rz)), [sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, sz, 0, 0, 0, 0, 1]);
    o[12] = x; o[13] = y; o[14] = z; return o;
  }
  var IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], MIRROR = [1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  WaterLite.prototype._eye = function () {
    var c = this.cam, cp = Math.cos(c.pitch);
    return [c.target[0] + c.dist * cp * Math.cos(c.yaw), c.target[1] + c.dist * Math.sin(c.pitch), c.target[2] + c.dist * cp * Math.sin(c.yaw)];
  };
  // terrain, props and floating things, for one of three passes: 0 the frame, 1 under the water, 2 reflections
  WaterLite.prototype._drawWorld = function (VP, eye, pass, w, h) {
    var gl = this.gl, p = this.prog.world, self = this, scen = this.opts.scenery;
    gl.useProgram(p.p); this._common(p);
    gl.uniformMatrix4fv(p.loc('uViewProj'), false, VP);
    gl.uniform1f(p.loc('uSnap'), this.style.snap ? 1 : 0); gl.uniform2f(p.loc('uRes'), w, h);
    gl.uniform1f(p.loc('uPass'), pass); gl.uniform1f(p.loc('uFlip'), pass === 2 ? 1 : 0);
    gl.uniform3fv(p.loc('uCamPos'), eye); gl.uniform1f(p.loc('uFogR'), this._fogR); gl.uniform1f(p.loc('uMaxD'), MAXD);
    gl.uniform1f(p.loc('uWaveTime'), this.time); gl.uniform1f(p.loc('uWindAmt'), clamp(this._windSpeed() / 8, 0.2, 2));
    gl.uniform4fv(p.loc('uShadows'), this._shadow3d);
    var pa = 0, pn = p.attr('aNormal'), pc = p.attr('aColor');
    if (scen) {
      gl.uniform1f(p.loc('uIsTerrain'), 1);
      gl.uniformMatrix4fv(p.loc('uModel'), false, IDENTITY);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.terrain.vb);
      gl.enableVertexAttribArray(pa); gl.vertexAttribPointer(pa, 3, gl.FLOAT, false, 28, 0);
      if (pn >= 0) { gl.enableVertexAttribArray(pn); gl.vertexAttribPointer(pn, 3, gl.FLOAT, false, 28, 12); }
      if (pc >= 0) { gl.enableVertexAttribArray(pc); gl.vertexAttribPointer(pc, 1, gl.FLOAT, false, 28, 24); }   // ambient occlusion
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.terrain.ib);
      gl.drawElements(gl.TRIANGLES, this.terrain.count, gl.UNSIGNED_SHORT, 0);
    }
    gl.uniform1f(p.loc('uIsTerrain'), 0);
    function draw(mesh, M) {
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buf);
      gl.enableVertexAttribArray(pa); gl.vertexAttribPointer(pa, 3, gl.FLOAT, false, 40, 0);
      if (pn >= 0) { gl.enableVertexAttribArray(pn); gl.vertexAttribPointer(pn, 3, gl.FLOAT, false, 40, 12); }
      if (pc >= 0) { gl.enableVertexAttribArray(pc); gl.vertexAttribPointer(pc, 4, gl.FLOAT, false, 40, 24); }
      gl.uniformMatrix4fv(p.loc('uModel'), false, M);
      gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
    }
    if (scen) draw(this.props, IDENTITY);
    this.floaters.forEach(function (f) { draw(self.meshes[f.kind] || self.meshes.crate, model(f.x, f.y, f.z, f.yaw, f.tilt[0], f.tilt[1], f.size[0], f.size[1], f.size[2])); });
    if (this.boat3d) { var b = this.boat3d; draw(this.meshes.boat, model(b.x, b.y - 0.15, b.z, -b.heading, b.tilt[0], b.tilt[1], 1, 1, 1)); }
    if (pn >= 0) gl.disableVertexAttribArray(pn);
    if (pc >= 0) gl.disableVertexAttribArray(pc);
  };
  WaterLite.prototype._render3d = function (w, h, A) {
    var gl = this.gl, c = this.cam, C = this.colors, q = this.q, scen = this.opts.scenery;
    var eye = this._eye(), L = lookAt(eye, c.target), VP = mul(persp(c.fov, w / h, 1.0, 900), L.m);   // near 1 m: depth precision where beach and sea meet
    this._fogR = 420 * (1 - 0.45 * this.rainAmt);
    var pxAng = c.fov / h;                                 // radians per low-res pixel
    this._starCell = 1 / (7 * pxAng);
    this._camRight = L.r;
    var sh = new Float32Array(40), n = 0;
    this.floaters.forEach(function (f) { if (n < 10) { sh.set([f.x, f.z, f.size[0] * 0.8, 0.55], n * 4); n++; } });
    if (this.boat3d && n < 9) {
      var b = this.boat3d, cb = Math.cos(b.heading), sb = Math.sin(b.heading);
      sh.set([b.x + cb * 0.9, b.z + sb * 0.9, 1.1, 0.6], n * 4); n++;
      sh.set([b.x - cb * 0.8, b.z - sb * 0.8, 1.0, 0.6], n * 4); n++;
    }
    this._shadow3d = sh;
    this._unbindPassTextures();
    // 1. what is under the water, with how deep it is in alpha
    var rw = Math.max(16, Math.round(w * q.refr)), rh = Math.max(16, Math.round(h * q.refr));
    var RT = this._target('layer', rw, rh, gl.LINEAR);
    gl.bindFramebuffer(gl.FRAMEBUFFER, RT.f); gl.viewport(0, 0, rw, rh);
    gl.clearColor(C.deep[0], C.deep[1], C.deep[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    this._drawWorld(VP, eye, 1, rw, rh);
    // 2. the islands mirrored in the sea
    var FT = null;
    if (q.refl && this.opts.reflections && scen && this.style.id !== 5 && !(q.auto && this._auto.scale < 0.55)) {
      var fw = Math.max(16, Math.round(w * 0.5)), fh = Math.max(16, Math.round(h * 0.5));
      FT = this._target('refl', fw, fh, gl.LINEAR);
      gl.bindFramebuffer(gl.FRAMEBUFFER, FT.f); gl.viewport(0, 0, fw, fh);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      this._drawWorld(mul(VP, MIRROR), eye, 2, fw, fh);
    }
    // 3. the frame
    gl.bindFramebuffer(gl.FRAMEBUFFER, A.f); gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    var p = this.prog.sky;
    gl.useProgram(p.p); this._quadAttrib(); this._common(p);
    gl.uniform3fv(p.loc('uRight'), L.r); gl.uniform3fv(p.loc('uUp'), L.u); gl.uniform3fv(p.loc('uFwd'), L.f);
    var ty = Math.tan(c.fov / 2); gl.uniform2f(p.loc('uTan'), ty * w / h, ty);
    var bo = this._bolt;
    gl.uniform4f(p.loc('uBolt'), bo ? c.yaw - Math.PI + (bo.pos - 0.5) * 0.9 : 0, 0.42, bo ? bo.seed : 0, bo ? 1 : 0);
    gl.uniform1f(p.loc('uPxAng'), pxAng); gl.uniform1f(p.loc('uStarCell'), this._starCell);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.enable(gl.DEPTH_TEST);
    this._drawWorld(VP, eye, 0, w, h);
    p = this.prog.sea; gl.useProgram(p.p); this._common(p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, RT.t); gl.uniform1i(p.loc('uRefr'), 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, FT ? FT.t : RT.t); gl.uniform1i(p.loc('uRefl'), 1);
    gl.uniform1f(p.loc('uHasRefl'), FT ? 1 : 0); gl.uniform2f(p.loc('uRes'), w, h);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.grid.vb); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.grid.ib);
    var facets = this.opts.style === 'lowpoly', radius = 420, cell = facets ? 6 : radius / this.grid.n;
    gl.uniformMatrix4fv(p.loc('uViewProj'), false, VP);
    gl.uniform2f(p.loc('uCenter'), Math.round(c.target[0] / cell) * cell, Math.round(c.target[2] / cell) * cell);
    gl.uniform1f(p.loc('uGridR'), radius); gl.uniform1f(p.loc('uGridPow'), facets ? 1.6 : 2.0); gl.uniform1f(p.loc('uWaveTime'), this.time);
    gl.uniform4fv(p.loc('uWA'), this.waveA); gl.uniform4fv(p.loc('uWB'), this.waveB); gl.uniform1f(p.loc('uWaveCount'), this.waves.length);
    var isl = new Float32Array(24);
    if (scen) this.islands.forEach(function (o, i) { if (i < 6) isl.set([o.x, o.z, o.r, 0], i * 4); });
    gl.uniform4fv(p.loc('uIslands'), isl);
    gl.uniform1f(p.loc('uSwash'), scen ? 0.1 * clamp(this._windSpeed() / 8, 0.4, 1.6) * Math.min(this.opts.waveHeight, 2) : 0);
    gl.uniform1f(p.loc('uSnap'), this.style.snap ? 1 : 0); gl.uniform2f(p.loc('uRes'), w, h);
    gl.uniform3fv(p.loc('uCamPos'), eye);
    gl.uniform1f(p.loc('uFoam'), this.opts.foam); gl.uniform1f(p.loc('uAmp'), this.amp); gl.uniform1f(p.loc('uFogR'), this._fogR); gl.uniform1f(p.loc('uMaxD'), MAXD);
    gl.uniform1f(p.loc('uDetailAmt'), facets ? 0 : 0.32 * clamp(this._windSpeed() / 8, 0.3, 1.6) * (this.style.bands ? 0.7 : 1));
    gl.uniform1f(p.loc('uStarCell'), this._starCell);
    gl.uniform2f(p.loc('uTexOrigin'), Math.round(c.target[0] / 1000) * 1000, Math.round(c.target[2] / 1000) * 1000);
    var tr = new Float32Array(32);
    for (var i = 0; i < this.trail.length && i < 8; i++) { var t = this.trail[i]; tr.set([t.x, t.z, Math.max(t.life, 0), 1.2 + (1 - t.life) * 2.5], i * 4); }
    gl.uniform4fv(p.loc('uTrail'), tr);
    gl.drawElements(gl.TRIANGLES, this.grid.count, gl.UNSIGNED_SHORT, 0);
    gl.disable(gl.DEPTH_TEST);
  };

  // ---- 2D side view ----------------------------------------------------------------------
  WaterLite.prototype._initSide = function () {
    var worldW = clamp(+this.opts.worldWidth || SIDE.W, SIDE.W, 20000), gl = this.gl, R = rng(this.opts.seed * 13 + 1);
    var cols = Math.min(Math.round(this.q.sim * 1.25 * worldW / SIDE.W), 2048);
    this.side = { cols: cols, h: new Float32Array(cols), v: new Float32Array(cols), viewW: SIDE.W, viewH: 270, level: 148, range: 64, bytes: new Uint8Array(cols * 2),
      worldW: worldW, camX: 0, dockX: worldW - (SIDE.W - SIDE.deckX), posts: SIDE.posts.map(function (x) { return worldW - (SIDE.W - x); }) };
    this.floaters = []; this.drops = []; this.fish = [];
    this._sideView();
    var S = this.side, self = this;
    if (this.opts.floaters) {
      [[0.25, 'crate', 22], [0.4, 'duck', 26], [0.53, 'barrel', 18], [0.66, 'boat', 56]].forEach(function (d) {
        self.addFloater(d[0] * S.viewW, S.level - 4, { kind: d[1], size: d[2] });
      });
    }
    var cols2 = [[1.0, 0.55, 0.18], [0.82, 0.88, 0.95], [1.0, 0.86, 0.25], [0.35, 0.65, 1.0]], nf = Math.min(Math.round(7 * worldW / SIDE.W), 60);
    for (var k = 0; k < nf; k++) {
      var fx = 80 + R() * (worldW - 220);
      this.fish.push({ x: fx, y: 0, depth: 0.25 + R() * 0.6, vx: (R() < 0.5 ? -1 : 1) * (9 + R() * 12), z: 0.03 + R() * 0.3, size: 14 + R() * 10, ph: R() * 6.28, flee: 0, col: cols2[k % 4] });
    }
    if (this.tex.heights) gl.deleteTexture(this.tex.heights);
    this.tex.heights = this._dataTex(cols, 1, gl.NEAREST, gl.LUMINANCE_ALPHA);
  };
  WaterLite.prototype._sideView = function () {
    var S = this.side, c = this.canvas, asp = (c.clientHeight || c.height || 270) / (c.clientWidth || c.width || 480);
    var viewH = Math.round(S.viewW * clamp(asp, 0.3, 2.5));
    if (viewH !== S.viewH || !S.levelSet || S.levelFrac !== this.opts.level) {
      var dy = viewH * this.opts.level - S.level;
      S.viewH = viewH; S.level = viewH * this.opts.level; S.levelFrac = this.opts.level; S.levelSet = true;
      this.floaters.forEach(function (f) { f.y += dy; });
    }
  };
  WaterLite.prototype._sideBottom = function (x) { return this.side.viewH - 12 - 16 * this._texB(x * 0.0019, 0.13); };
  WaterLite.prototype._cliffX = function (y) { return SIDE.cliff[0] + SIDE.cliff[1] * Math.sin(y * 0.045) + SIDE.cliff[2] * Math.sin(y * 0.11 + 1.3); };
  WaterLite.prototype._dataTex = function (w, h, filter, format) {
    var gl = this.gl, t = gl.createTexture();
    format = format || gl.RGBA;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, format, w, h, 0, format, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  WaterLite.prototype._swellAt = function (x, t) {
    var o = this.opts, a = Math.min(this._windSpeed() / 10, 2.2) * o.waveHeight;
    return a * (3.2 * Math.sin(x * 0.021 - t * 1.25) + 1.6 * Math.sin(x * 0.047 + t * 1.9 + 1.3) + 0.8 * Math.sin(x * 0.11 - t * 3.1 + 0.4));
  };
  WaterLite.prototype._sideCol = function (arr, x) {
    var S = this.side, u = clamp(x / S.worldW, 0, 1) * (S.cols - 1), i = Math.floor(u), f = u - i, j = Math.min(i + 1, S.cols - 1);
    return arr[i] * (1 - f) + arr[j] * f;
  };
  WaterLite.prototype._sideHeight = function (x) { return this._sideCol(this.side.h, x) + this._swellAt(x, this.time); };
  WaterLite.prototype._sideRate = function (x) { return this._sideCol(this.side.v, x) + (this._swellAt(x, this.time + 0.01) - this._swellAt(x, this.time)) * 100; };

  // Something that floats. Side: x, y in view units (y down). Top: world units. 3D: world x, z.
  WaterLite.prototype.addFloater = function (x, y, def) {
    def = def || {};
    var m = this.opts.mode, f;
    if (m === 'side') {
      var K = KIND2D[def.kind] || KIND2D.crate, w = def.size || 20;
      f = { kind: KIND2D[def.kind] ? def.kind : 'crate', x: x, y: y, vx: def.vx || 0, vy: def.vy || 0, a: def.angle || 0, av: 0, w: w, h: w * K.ratio, density: def.density || K.density, sub: 0 };
    } else if (m === 'top') {
      f = { kind: def.kind || 'crate', x: x, y: y, vx: 0, vy: 0, a: def.angle || 0, size: def.size || 3, bob: 0 };
    } else {
      var kind = this.meshes[def.kind] ? def.kind : 'crate';
      f = { kind: kind, x: x, z: y, hx: x, hz: y, y: def.y || 0, vy: 0, yaw: def.angle || Math.random() * 6, tilt: [0, 0], density: def.density || 0.5,
        size: def.size ? [def.size, def.size, def.size] : kind === 'buoy' ? [0.8, 1.6, 0.8] : kind === 'barrel' ? [0.7, 1.0, 0.7] : [1.1, 1.1, 1.1] };
    }
    this.floaters.push(f);
    if (this.floaters.length > 40) this.floaters.shift();
    return f;
  };
  WaterLite.prototype.clearFloaters = function () { this.floaters = []; this.drops = []; };

  WaterLite.prototype._updateSide = function (dt) {
    var S = this.side, n = S.cols, h = S.h, v = S.v, i, self = this;
    this._sideView();
    var steps = Math.max(1, Math.round(dt * 120)), d = dt / steps;
    for (var s = 0; s < steps; s++) {
      for (i = 0; i < n; i++) { v[i] += (-216 * h[i] - 2.4 * v[i]) * d; h[i] += v[i] * d; }
      for (var pass = 0; pass < 2; pass++) {
        for (i = 1; i < n - 1; i++) {
          var l = 1.68 * (h[i] - h[i - 1]), r = 1.68 * (h[i] - h[i + 1]);
          v[i - 1] += l * d * 120; v[i + 1] += r * d * 120;
        }
      }
    }
    for (i = 0; i < n; i++) h[i] = clamp(h[i], -S.range * 0.85, S.range * 0.85);
    var sub = this.q.sub + 1, sd = dt / sub;
    for (s = 0; s < sub; s++) { for (i = 0; i < this.floaters.length; i++) this._float2d(this.floaters[i], sd); this._collide2d(); }
    this._stepDrops(dt, 600);
    // fish cruise back and forth between the cliff and the dock, and dart away from splashes
    this.fish.forEach(function (f) {
      var bottom = self._sideBottom(f.x), top = S.level + 22;
      f.y = top + (bottom - 14 - top) * f.depth + Math.sin(self.time * 0.7 + f.ph) * 4;
      f.flee = Math.max(0, f.flee - dt);
      var speed = f.vx * (1 + f.flee * 2.2);
      f.x += speed * dt;
      var lo = self._cliffX(f.y) + 14, hi = S.posts[0] - 12;
      if (f.x < lo) { f.x = lo; f.vx = Math.abs(f.vx); }
      if (f.x > hi) { f.x = hi; f.vx = -Math.abs(f.vx); }
    });
    var B = S.bytes;
    for (i = 0; i < n; i++) {
      var x = i / (n - 1) * S.worldW, val = Math.round(clamp(((h[i] + this._swellAt(x, this.time)) / S.range * 0.5 + 0.5) * 65535, 0, 65535));
      B[i * 2] = val >> 8; B[i * 2 + 1] = val & 255;
    }
    var gl = this.gl; gl.bindTexture(gl.TEXTURE_2D, this.tex.heights);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, n, 1, gl.LUMINANCE_ALPHA, gl.UNSIGNED_BYTE, B);
  };
  // A rigid body in 2D: buoyancy and drag summed over sample points across the part that floats.
  WaterLite.prototype._float2d = function (f, dt) {
    var S = this.side, K = KIND2D[f.kind], g = 600, w = f.w, H = f.h;
    var hy0 = K.hull[0] * H, hy1 = K.hull[1] * H, hh = hy1 - hy0, comY = K.com * H;
    var m = f.density * w * hh, I = m * (w * w + hh * hh) / 12;
    var c = Math.cos(f.a), s = Math.sin(f.a), Fx = 0, Fy = m * g, T = 0, subSum = 0;
    var NX = 5, NY = 3, dA = w * hh / (NX * NY), cellH = hh / NY;
    for (var i = 0; i < NX; i++) for (var j = 0; j < NY; j++) {
      var lx = ((i + 0.5) / NX - 0.5) * w, ly = hy0 + (j + 0.5) / NY * hh - comY;
      var rx = c * lx - s * ly, ry = s * lx + c * ly, px = f.x + rx, py = f.y + ry;
      var ys = S.level - this._sideHeight(px), sub = clamp((py - ys) / cellH + 0.5, 0, 1);
      if (sub <= 0) continue;
      subSum += sub;
      var slope = (this._sideHeight(px + 4) - this._sideHeight(px - 4)) / 8;
      var fb = -g * dA * sub, fbx = -g * dA * sub * slope * 0.5;
      var pvx = f.vx - f.av * ry, pvy = f.vy + f.av * rx;
      var wvy = -0.35 * this._sideRate(px) * Math.exp(-Math.max(py - ys, 0) / 15);
      var fx = fbx - 2 * dA * sub * pvx, fy = fb - 2 * dA * sub * (pvy - wvy);
      Fx += fx; Fy += fy; T += rx * fy - ry * fx;
    }
    var frac = subSum / (NX * NY);
    if (f.sub < 0.03 && frac >= 0.03 && f.vy > 140) this.splash(f.x, S.level - this._sideHeight(f.x), Math.min(f.vy * w * 0.0009, 18), w * 0.9);
    f.sub = frac;
    f.vx += Fx / m * dt; f.vy += Fy / m * dt; f.av += T / I * dt;
    f.vx *= 1 - 0.05 * dt; f.av *= 1 - 0.3 * dt;
    f.x += f.vx * dt; f.y += f.vy * dt; f.a += f.av * dt;
    if (frac > 0 && frac < 0.98 && Math.abs(f.vy) > 20) this._push(f.x, -f.vy * dt * 0.06, w * 0.8);
    var hw = w * 0.5, left = this.opts.scenery ? this._cliffX(f.y) + hw : hw, right = this.opts.scenery ? S.posts[0] - 3.5 - hw : S.worldW - hw;
    if (f.x < left) { f.x = left; f.vx = Math.abs(f.vx) * 0.4; }
    if (f.x > right) { f.x = right; f.vx = -Math.abs(f.vx) * 0.4; }
    var floor = this._sideBottom(f.x) - H * 0.35;
    if (f.y > floor) { f.y = floor; f.vy = Math.min(f.vy, 0); }
  };
  // Floating things push each other apart: boxes around the part that floats (rotation ignored), separated
  // along the axis that overlaps least, with a soft, mostly inelastic exchange of speed.
  WaterLite.prototype._collide2d = function () {
    var F = this.floaters, n = F.length, i, j;
    for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) {
      var a = F[i], b = F[j], Ka = KIND2D[a.kind], Kb = KIND2D[b.kind];
      var ay0 = a.y + Ka.hull[0] * a.h - Ka.com * a.h, ay1 = a.y + Ka.hull[1] * a.h - Ka.com * a.h;
      var by0 = b.y + Kb.hull[0] * b.h - Kb.com * b.h, by1 = b.y + Kb.hull[1] * b.h - Kb.com * b.h;
      var ox = (a.w + b.w) * 0.45 - Math.abs(a.x - b.x), oy = Math.min(ay1, by1) - Math.max(ay0, by0);
      if (ox <= 0 || oy <= 0) continue;
      var ma = a.density * a.w * (ay1 - ay0), mb = b.density * b.w * (by1 - by0), ka = mb / (ma + mb), kb = ma / (ma + mb);
      if (ox < oy) {                                       // side by side: push apart in x
        var sx = a.x < b.x ? -1 : 1;
        a.x += sx * ox * ka; b.x -= sx * ox * kb;
        var rv = (a.vx - b.vx) * sx;
        if (rv < 0) { var jx = -1.3 * rv / (1 / ma + 1 / mb); a.vx += sx * jx / ma; b.vx -= sx * jx / mb; }
      } else {                                             // one on the other: push apart in y
        var sy = (ay0 + ay1) < (by0 + by1) ? -1 : 1;
        a.y += sy * oy * ka; b.y -= sy * oy * kb;
        var rvy = (a.vy - b.vy) * sy;
        if (rvy < 0) { var jy = -1.2 * rvy / (1 / ma + 1 / mb); a.vy += sy * jy / ma; b.vy -= sy * jy / mb; }
        var top = sy < 0 ? a : b, under = top === a ? b : a, side = top.x === under.x ? (i % 2 ? 1 : -1) : (top.x > under.x ? 1 : -1);
        top.vx += side * 5; top.av += side * 0.15;          // nothing balances on a floating crate for long: it tips off
      }
    }
  };
  // Top view: crates and barrels as circles; the boat shoves them aside and barely notices.
  WaterLite.prototype._collideTop = function () {
    var F = this.floaters, n = F.length, b = this.topBoat, i, j;
    for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) {
      var p = F[i], q = F[j], rp = p === b ? p.size * 0.32 : p.size * 0.5, rq = q === b ? q.size * 0.32 : q.size * 0.5;
      var dx = q.x - p.x, dy = q.y - p.y, d = Math.sqrt(dx * dx + dy * dy), ov = rp + rq - d;
      if (ov <= 0 || d < 1e-6) continue;
      var nx = dx / d, ny = dy / d, wp = p === b ? 0.05 : q === b ? 0.95 : 0.5, wq = 1 - wp;
      if (p !== b && !this._isLand(p.x - nx * ov * wp, p.y - ny * ov * wp)) { p.x -= nx * ov * wp; p.y -= ny * ov * wp; }
      if (q !== b && !this._isLand(q.x + nx * ov * wq, q.y + ny * ov * wq)) { q.x += nx * ov * wq; q.y += ny * ov * wq; }
      var pvx = p === b ? Math.cos(b.heading) * b.speed : p.vx, pvy = p === b ? Math.sin(b.heading) * b.speed : p.vy;
      var qvx = q === b ? Math.cos(b.heading) * b.speed : q.vx, qvy = q === b ? Math.sin(b.heading) * b.speed : q.vy;
      var rv = (qvx - pvx) * nx + (qvy - pvy) * ny;
      if (rv >= 0) continue;
      var imp = -rv * 0.6;
      if (p !== b) { p.vx -= nx * imp * (q === b ? 2 : 1); p.vy -= ny * imp * (q === b ? 2 : 1); }
      if (q !== b) { q.vx += nx * imp * (p === b ? 2 : 1); q.vy += ny * imp * (p === b ? 2 : 1); }
    }
  };
  WaterLite.prototype._push = function (x, amount, radius) {
    var S = this.side, n = S.cols, i0 = Math.max(0, Math.floor((x - radius) / S.worldW * (n - 1))), i1 = Math.min(n - 1, Math.ceil((x + radius) / S.worldW * (n - 1)));
    for (var i = i0; i <= i1; i++) {
      var d = Math.abs(i / (n - 1) * S.worldW - x);
      if (d < radius) S.v[i] += amount * (1 - d / radius) * 60;
    }
  };
  WaterLite.prototype._stepDrops = function (dt, gy) {
    for (var i = this.drops.length - 1; i >= 0; i--) {
      var d = this.drops[i];
      d.vy += gy * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.life -= dt;
      if (d.life <= 0 || (d.vy > 0 && d.y > this.side.level - this._sideHeight(d.x))) this.drops.splice(i, 1);
    }
  };
  WaterLite.prototype._renderSide = function (w, h, A) {
    var gl = this.gl, S = this.side, C = this.colors, self = this;
    S.camX = clamp(this.camera2d.x - S.viewW / 2, 0, S.worldW - S.viewW);
    if (this.stats.px > 1) { var upp = S.viewW / w; S.camX = Math.round(S.camX / upp) * upp; }
    var rect = [S.camX, 0, S.viewW, S.viewH];
    this._unbindPassTextures();
    var Lr = this._target('layer', w, h, gl.LINEAR);
    gl.bindFramebuffer(gl.FRAMEBUFFER, Lr.f); gl.viewport(0, 0, w, h);
    gl.disable(gl.DEPTH_TEST);
    var p = this.prog.sideBg;
    gl.useProgram(p.p); this._quadAttrib(); this._common(p); this._sideUniforms(p);
    gl.uniform4f(p.loc('uCliff'), SIDE.cliff[0], SIDE.cliff[1], SIDE.cliff[2], S.level - 62);
    gl.uniform4f(p.loc('uDock'), S.dockX, S.level - 34, 6, 3.5);
    gl.uniform3f(p.loc('uPosts'), S.posts[0], S.posts[1], S.posts[2]);
    gl.uniform2f(p.loc('uSunPos'), S.viewW * 0.74, S.level * (0.92 - 0.62 * clamp(this.sunElev / 42, 0, 1.4)));
    var bo = this._bolt, upp2 = S.viewW / w;
    gl.uniform4f(p.loc('uBolt'), bo ? S.viewW * (0.1 + 0.8 * bo.pos) : 0, S.level, bo ? bo.seed : 0, bo ? 1 : 0);
    gl.uniform1f(p.loc('uPxU'), upp2); gl.uniform1f(p.loc('uStarCell'), 7 * upp2);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    // floating things and fish go into the same layer, so the water bends and tints them
    var list = this.fish.map(function (f) {
      return { x: f.x, y: f.y, w: (f.vx < 0 ? -1 : 1) * f.size, h: f.size * 0.55, a: Math.sin(self.time * 6 + f.ph) * 0.06, kind: 6, color: f.col, color2: [0.92, 0.94, 0.95], z: f.z };
    });
    this.floaters.forEach(function (f) {
      var K = KIND2D[f.kind], cy = K.com * f.h, s = Math.sin(f.a), c = Math.cos(f.a);
      var col = f.kind === 'duck' ? [1, 0.84, 0.18] : f.kind === 'boat' ? C.paint : f.kind === 'barrel' ? [C.wood[0] * 0.8, C.wood[1] * 0.8, C.wood[2] * 0.85] : C.wood;
      list.push({ x: f.x + s * cy, y: f.y - c * cy, w: f.w, h: f.h, a: f.a, kind: { crate: 0, barrel: 1, duck: 2, boat: 3 }[f.kind], color: col, color2: [0.18, 0.18, 0.2], z: 0.03 });
    });
    this._sprites(rect, w, list, true);
    gl.bindFramebuffer(gl.FRAMEBUFFER, A.f); gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    p = this.prog.sideWater;
    gl.useProgram(p.p); this._quadAttrib(); this._common(p); this._sideUniforms(p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, Lr.t); gl.uniform1i(p.loc('uScene'), 0);
    gl.uniform1f(p.loc('uUnit'), SIDE.unit); gl.uniform1f(p.loc('uReflect'), this.opts.reflections && this.opts.scenery ? (this.style.id === 5 ? 0 : 0.32) : 0);
    gl.uniform1f(p.loc('uFoam'), this.opts.foam); gl.uniform1f(p.loc('uPxU'), S.viewW / w);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    var Fc = this._fc, gw = this.env.glow, sprayC = this.style.id === 5 ? C.paper : [0, 1, 2].map(function (i) { return C.foam[i] * Fc.light[i] * (1 - gw * 0.6) + C.glow[i] * gw * 0.8; });
    var drops = this.drops.map(function (d) { return { x: d.x, y: d.y, w: d.r, h: d.r, a: 0, kind: 5, color: sprayC }; });
    this._sprites(rect, w, drops, false);
  };
  WaterLite.prototype._sideUniforms = function (p) {
    var gl = this.gl, S = this.side;
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.tex.heights); gl.uniform1i(p.loc('uHeights'), 1);
    gl.uniform1f(p.loc('uCols'), S.cols); gl.uniform2f(p.loc('uView'), S.viewW, S.viewH); gl.uniform1f(p.loc('uLevel'), S.level); gl.uniform1f(p.loc('uRange'), S.range);
    gl.uniform1f(p.loc('uWorldW'), S.worldW); gl.uniform1f(p.loc('uCamX'), S.camX);
  };
  // 2D sprites; with zLayer they are drawn hard-edged and write their distance into alpha
  WaterLite.prototype._sprites = function (rect, lowW, list, zLayer) {
    if (!list.length) return;
    var gl = this.gl, p = this.prog.sprite, C = this.colors, crisp = this.style.id === 2 || this.style.id === 4;
    gl.useProgram(p.p); this._quadAttrib(); this._common(p);
    if (zLayer) gl.disable(gl.BLEND);
    else { gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); }
    gl.uniform4f(p.loc('uViewRect'), rect[0], rect[1], rect[2], rect[3]);
    var upp = rect[2] / lowW;
    for (var i = 0; i < list.length; i++) {
      var s = list[i], x = s.x, y = s.y;
      if (crisp) { x = (Math.round((x - rect[0]) / upp) + 0.5) * upp + rect[0]; y = (Math.round((y - rect[1]) / upp) + 0.5) * upp + rect[1]; }
      gl.uniform2f(p.loc('uCenter'), x, y); gl.uniform2f(p.loc('uSize'), s.w, s.h); gl.uniform1f(p.loc('uAngle'), s.a);
      gl.uniform1f(p.loc('uKind'), s.kind); gl.uniform3fv(p.loc('uColor'), s.color); gl.uniform3fv(p.loc('uColor2'), s.color2 || C.wood);
      gl.uniform1f(p.loc('uAA'), crisp ? 0 : 1.2 * upp * 2 / Math.max(Math.abs(s.w), Math.abs(s.h)));
      gl.uniform1f(p.loc('uZ'), zLayer ? (s.z !== undefined ? s.z : 0.03) : -1);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    gl.disable(gl.BLEND);
  };

  // ---- 2D top down ------------------------------------------------------------------------
  function chamfer(mask, W, H, target) {
    var N = W * H, d = new Float32Array(N), x, y, i, D = 1.4142;
    for (i = 0; i < N; i++) d[i] = mask[i] === target ? 0 : 1e9;
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      i = y * W + x; var v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + 1);
      if (y > 0) { v = Math.min(v, d[i - W] + 1); if (x > 0) v = Math.min(v, d[i - W - 1] + D); if (x < W - 1) v = Math.min(v, d[i - W + 1] + D); }
      d[i] = v;
    }
    for (y = H - 1; y >= 0; y--) for (x = W - 1; x >= 0; x--) {
      i = y * W + x; var u = d[i];
      if (x < W - 1) u = Math.min(u, d[i + 1] + 1);
      if (y < H - 1) { u = Math.min(u, d[i + W] + 1); if (x < W - 1) u = Math.min(u, d[i + W + 1] + D); if (x > 0) u = Math.min(u, d[i + W - 1] + D); }
      d[i] = u;
    }
    return d;
  }
  WaterLite.prototype._initTop = function () {
    var ms = this.opts.mapSize || [], mw = clamp(+ms[0] || 160, 40, 2000), mh = clamp(+ms[1] || 90, 40, 2000), area = mw * mh / 14400;
    // the map keeps the quality's density up to 9x the standard map's area, then gets coarser; the ripples
    // are only simulated around the view (see _simWindow), so a big map costs about what the view shows
    var cell = Math.min(this.q.sim / 160, Math.sqrt(this.q.sim * this.q.sim * 9 / 16 * 9 / (mw * mh)));
    var W = Math.round(mw * cell), H = Math.round(mh * cell), N = W * H, seed = this.opts.seed, R = rng(seed * 31 + 5), L = this.opts.land, x, y, i, k;
    cell = W / mw;
    var raw = new Float32Array(N);
    if (typeof L === 'function') {
      for (y = 0; y < H; y++) for (x = 0; x < W; x++) { var lv = L((x + 0.5) / W, (y + 0.5) / H); raw[y * W + x] = lv === true ? 0.5 : (+lv || 0); }
    } else if (L !== 'none') {
      var isl = [], count = Math.max(1, Math.round((3 + Math.floor(R() * 2)) * area));
      for (k = 0; k < count; k++) isl.push({ x: (0.14 + 0.72 * R()) * mw, y: (0.15 + 0.6 * R()) * mh, r: (0.07 + 0.11 * R()) * 160 });
      var WX = new Float32Array(N), WY = new Float32Array(N), EI = new Float32Array(N);
      for (y = 0; y < H; y++) for (x = 0; x < W; x++) {   // coastlines wobble: each cell looks up a warped position
        var gx = x / cell, gy = y / cell; i = y * W + x;
        WX[i] = gx + (vnoise(gx * 0.05, gy * 0.05, seed) - 0.5) * 14; WY[i] = gy + (vnoise(gx * 0.05 + 9, gy * 0.05, seed) - 0.5) * 14;
      }
      isl.forEach(function (o) {                           // each island only touches cells near it (the warp moves at most 7)
        var x0 = Math.max(0, Math.floor((o.x - o.r - 8) * cell)), x1 = Math.min(W - 1, Math.ceil((o.x + o.r + 8) * cell));
        var y0 = Math.max(0, Math.floor((o.y - o.r / 1.14 - 8) * cell)), y1 = Math.min(H - 1, Math.ceil((o.y + o.r / 1.14 + 8) * cell));
        for (var yy = y0; yy <= y1; yy++) for (var xx = x0; xx <= x1; xx++) {
          var j = yy * W + xx, ddx = WX[j] - o.x, ddy = WY[j] - o.y, e = 1 - Math.sqrt(ddx * ddx + ddy * ddy * 1.3) / o.r;
          if (e > EI[j]) EI[j] = e;
        }
      });
      for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
        var gx3 = x / cell, gy3 = y / cell; i = y * W + x;
        raw[i] = EI[i] + (vnoise(gx3 * 0.12, gy3 * 0.12, seed + 1) * 0.6 + vnoise(gx3 * 0.3, gy3 * 0.3, seed + 2) * 0.4 - 0.5) * 0.35 - 0.1;
      }
    }
    var mask = new Uint8Array(N);
    for (i = 0; i < N; i++) mask[i] = raw[i] > 0 ? 1 : 0;
    if (typeof L !== 'function') {
      for (var pass = 0; pass < 2; pass++) {
        var next = new Uint8Array(N);
        for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
          var cnt = 0;
          for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) cnt += mask[clamp(y + dy, 0, H - 1) * W + clamp(x + dx, 0, W - 1)];
          next[y * W + x] = cnt >= 5 ? 1 : 0;
        }
        mask = next;
      }
    }
    // elevation: beaches rising to grassy hills, shallows shelving to deep water, rock heads in the shallows
    var dW = chamfer(mask, W, H, 1), dL = chamfer(mask, W, H, 0), E = new Float32Array(N), rocky = new Float32Array(N);
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      i = y * W + x;
      var gx2 = x / cell, gy2 = y / cell, wd = dW[i] / cell, ld = dL[i] / cell;
      if (mask[i]) E[i] = Math.min(ld * 0.3, 0.95) + Math.max(0, raw[i] - 0.12) * 2.6 * smooth(1.5, 9, ld) + (vnoise(gx2 * 0.3, gy2 * 0.3, seed + 4) - 0.5) * 0.1;
      else E[i] = -(0.36 * wd + 6.2 * smooth(4.5, 16, wd)) + (vnoise(gx2 * 0.09, gy2 * 0.09, seed + 5) - 0.5) * 0.9 * smooth(1, 3, wd);
    }
    if (typeof L !== 'function' && L !== 'none') {
      for (k = 0, i = 0; k < Math.round(8 * area) && i < 400 * area; i++) {
        var rx = 4 + R() * (mw - 8), ry = 4 + R() * (mh - 8), ci = Math.floor(ry * cell) * W + Math.floor(rx * cell), wdd = dW[ci] / cell;
        if (mask[ci] || wdd < 2.5 || wdd > 9) continue;
        var rr = (1.1 + R() * 2.0) * cell, top = -1.7 + R() * 2.0, cxr = rx * cell, cyr = ry * cell;
        for (y = Math.max(0, Math.floor(cyr - rr * 1.5)); y <= Math.min(H - 1, Math.ceil(cyr + rr * 1.5)); y++) for (x = Math.max(0, Math.floor(cxr - rr * 1.5)); x <= Math.min(W - 1, Math.ceil(cxr + rr * 1.5)); x++) {
          var qq = ((x - cxr) * (x - cxr) + (y - cyr) * (y - cyr)) / (rr * rr), bump = top - qq * 2.2, ii = y * W + x;
          if (bump > E[ii]) { E[ii] = bump; rocky[ii] = clamp(1.4 - qq, 0, 1); }
        }
        k++;
      }
    }
    for (i = 0; i < N; i++) mask[i] = E[i] > 0 ? 1 : 0;
    dW = chamfer(mask, W, H, 1); dL = chamfer(mask, W, H, 0);
    var map = new Uint8Array(N * 4);
    for (i = 0; i < N; i++) {
      map[i * 4] = Math.round(clamp((E[i] + 12) / 16, 0, 1) * 255);
      map[i * 4 + 1] = Math.round(clamp(dW[i] / cell / 24, 0, 1) * 255);
      map[i * 4 + 2] = Math.round(clamp(dL[i] / cell / 12, 0, 1) * 255);
      map[i * 4 + 3] = Math.round(rocky[i] * 255);
    }
    var calm = new Uint8Array(N);
    for (i = 0; i < N; i++) calm[i] = 128;                // ripple height 0 everywhere to start
    this.top = { W: W, H: H, cell: cell, worldW: mw, worldH: mh, mask: mask, shore: dW, E: E, cur: new Float32Array(N), prev: new Float32Array(N), bytes: calm, acc: 0, mapBytes: map,
      win: null, DX: new Float32Array(W), DY: new Float32Array(H) };
    this._uploadTopMap();
    this.floaters = []; this.drops = []; this.fish = [];
    var oldBoat = this.topBoat;
    this.topBoat = null; this._rect = null;
    if (this.opts.boat) {
      var best = null, bd = -1;
      for (k = 0; k < 60; k++) { var cx = mw * (0.125 + R() * 0.75), cy = mh * (0.55 + R() * 0.39), dd = this._shoreDist(cx, cy); if (dd > bd) { bd = dd; best = [cx, cy]; } }
      this.topBoat = this.addFloater(best[0], best[1], { kind: 'boat', size: 9 });
      this.topBoat.heading = -Math.PI / 2; this.topBoat.speed = 0; this.topBoat.auto = true;
    }
    if (oldBoat && this.camera2d.follow === oldBoat) this.camera2d.follow = this.topBoat;
    if (this.opts.floaters) {
      for (k = 0; k < Math.min(Math.round(7 * area), 30); k++) {
        var tx = 0, ty = 0, tries = 0;
        do { tx = 8 + R() * (mw - 16); ty = 8 + R() * (mh - 16); tries++; } while ((this._shoreDist(tx, ty) < 2 || this._shoreDist(tx, ty) > 9) && tries < 80);
        this.addFloater(tx, ty, { kind: k % 3 === 2 ? 'barrel' : 'crate', size: 2.6 + R() * 0.8, angle: R() * 6 });
      }
      for (k = 0; k < Math.min(Math.round(9 * area), 40); k++) {   // fish in the shallows, seen through the water
        var fx2 = 0, fy2 = 0, t2 = 0;
        do { fx2 = 8 + R() * (mw - 16); fy2 = 8 + R() * (mh - 16); t2++; } while ((this._depthAt(fx2, fy2) < 1.2 || this._depthAt(fx2, fy2) > 6) && t2 < 80);
        this.fish.push({ x: fx2, y: fy2, dir: R() * 6.28, speed: 2 + R() * 3, turn: 0, size: 1.4 + R() * 1.1, flee: 0, ph: R() * 6.28 });
      }
    }
  };
  // The cells whose ripples are simulated: the view plus a margin. Cells that leave it are calmed, and a band
  // inside its edge soaks waves up, so nothing reflects back into view from the window's edge.
  WaterLite.prototype._simWindow = function () {
    var T = this.top, W = T.W, H = T.H, r = this._topRect(), c = T.cell, mx = r[2] * 0.25 + 6 / c, my = r[3] * 0.25 + 6 / c, x, y, i;
    var nw = [Math.max(1, Math.floor((r[0] - mx) * c)), Math.max(1, Math.floor((r[1] - my) * c)), Math.min(W - 2, Math.ceil((r[0] + r[2] + mx) * c)), Math.min(H - 2, Math.ceil((r[1] + r[3] + my) * c))];
    var ow = T.win;
    if (ow && ow[0] === nw[0] && ow[1] === nw[1] && ow[2] === nw[2] && ow[3] === nw[3]) return ow;
    if (ow) for (y = ow[1]; y <= ow[3]; y++) {
      var inside = y >= nw[1] && y <= nw[3];
      for (x = ow[0]; x <= ow[2]; x++) {
        if (inside && x >= nw[0] && x <= nw[2]) { x = nw[2]; continue; }
        i = y * W + x; T.cur[i] = 0; T.prev[i] = 0;
      }
    }
    var B = 6;
    for (x = 0; x < W; x++) T.DX[x] = clamp(Math.min(x - nw[0], nw[2] - x) / B, 0, 1);
    for (y = 0; y < H; y++) T.DY[y] = clamp(Math.min(y - nw[1], nw[3] - y) / B, 0, 1);
    return (T.win = nw);
  };
  WaterLite.prototype._uploadTopMap = function () {
    var gl = this.gl, T = this.top;
    if (this.tex.map) { gl.deleteTexture(this.tex.map); gl.deleteTexture(this.tex.sim); }
    this.tex.map = this._dataTex(T.W, T.H, gl.LINEAR);
    gl.bindTexture(gl.TEXTURE_2D, this.tex.map); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, T.W, T.H, 0, gl.RGBA, gl.UNSIGNED_BYTE, T.mapBytes);
    this.tex.sim = this._dataTex(T.W, T.H, gl.LINEAR, gl.LUMINANCE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, T.W, T.H, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, T.bytes);
  };
  WaterLite.prototype._topIndex = function (x, y) { var T = this.top; return clamp(Math.floor(y * T.cell), 0, T.H - 1) * T.W + clamp(Math.floor(x * T.cell), 0, T.W - 1); };
  WaterLite.prototype._topHeight = function (x, y) { return this.top.cur[this._topIndex(x, y)]; };
  WaterLite.prototype._isLand = function (x, y) { return this.top.mask[this._topIndex(x, y)] === 1; };
  WaterLite.prototype._shoreDist = function (x, y) { return this.top.shore[this._topIndex(x, y)] / this.top.cell; };
  WaterLite.prototype._depthAt = function (x, y) { return -this.top.E[this._topIndex(x, y)]; };
  // the visible part of the map: covers the canvas at zoom 1, centred on camera2d and kept inside the map
  WaterLite.prototype._topRect = function () {
    var T = this.top, c = this.canvas, a = (c.clientHeight || c.height) / (c.clientWidth || c.width), z = Math.max(+this.opts.zoom || 1, 1), vw, vh;
    if (a < T.worldH / T.worldW) { vw = T.worldW; vh = vw * a; } else { vh = T.worldH; vw = vh / a; }
    vw /= z; vh /= z;
    var cam = this.camera2d, cx = clamp(cam.x, vw / 2, T.worldW - vw / 2), cy = clamp(cam.y, vh / 2, T.worldH - vh / 2);
    return [cx - vw / 2, cy - vh / 2, vw, vh];
  };
  WaterLite.prototype._updateTop = function (dt) {
    var T = this.top, W = T.W, H = T.H, x, y, i, self = this, win = this._simWindow(), DX = T.DX, DY = T.DY;
    T.acc = Math.min(T.acc + dt, 0.1);
    while (T.acc >= 1 / 60) {
      T.acc -= 1 / 60;
      var cur = T.cur, prev = T.prev, mask = T.mask;
      for (y = win[1]; y <= win[3]; y++) {
        var ky = DY[y];
        for (x = win[0]; x <= win[2]; x++) {
          i = y * W + x;
          var kk = DX[x] < ky ? DX[x] : ky;
          prev[i] = mask[i] ? 0 : ((cur[i - 1] + cur[i + 1] + cur[i - W] + cur[i + W]) * 0.5 - prev[i]) * (kk >= 1 ? 0.985 : 0.985 * (0.9 + 0.1 * kk));
        }
      }
      T.cur = prev; T.prev = cur;
    }
    var b = this.topBoat;
    if (b) {
      var inp = this.input, manual = inp.up || inp.down || inp.left || inp.right, thr, steer;
      if (manual) b.auto = false;
      if (b.auto) {
        thr = 0.65; steer = 0.45 * Math.sin(this.time * 0.23) + 0.25 * Math.sin(this.time * 0.61);
        var best = 0, bestD = -1;
        for (var k = -2; k <= 2; k++) {
          var ang = b.heading + k * 0.45, ax = b.x + Math.cos(ang) * 12, ay = b.y + Math.sin(ang) * 12;
          var dd = (ax < 4 || ay < 4 || ax > T.worldW - 4 || ay > T.worldH - 4) ? 0 : Math.min(this._shoreDist(ax, ay), this._shoreDist(b.x + Math.cos(ang) * 6, b.y + Math.sin(ang) * 6));
          if (dd > bestD + 0.3 || (k === 0 && dd >= bestD)) { bestD = dd; best = k; }
        }
        if (this._shoreDist(b.x + Math.cos(b.heading) * 10, b.y + Math.sin(b.heading) * 10) < 4) steer = best === 0 ? 1 : best / 2;
      } else { thr = (inp.up ? 1 : 0) - (inp.down ? 0.5 : 0); steer = (inp.right ? 1 : 0) - (inp.left ? 1 : 0); }
      b.speed += (thr * 16 - b.speed) * Math.min(dt * 1.4, 1);
      b.heading += clamp(steer, -1, 1) * dt * 1.7 * clamp(Math.abs(b.speed) / 6, 0.3, 1);
      var nx = b.x + Math.cos(b.heading) * b.speed * dt, ny = b.y + Math.sin(b.heading) * b.speed * dt;
      if (!this._isLand(nx, ny) && nx > 2 && ny > 2 && nx < T.worldW - 2 && ny < T.worldH - 2) { b.x = nx; b.y = ny; } else b.speed *= -0.3;
      b.a = b.heading + Math.PI / 2;
      if (Math.abs(b.speed) > 1) {
        var sp = Math.abs(b.speed) / 16;
        this.splash(b.x - Math.cos(b.heading) * 3.6, b.y - Math.sin(b.heading) * 3.6, 0.55 * sp * dt * 60 * 0.12, 1.5, true);
        this.splash(b.x + Math.cos(b.heading) * 4.2, b.y + Math.sin(b.heading) * 4.2, -0.25 * sp * dt * 60 * 0.12, 1.2, true);
      }
    }
    this.floaters.forEach(function (f) {
      if (f === b) return;
      var gx = self._topHeight(f.x + 1, f.y) - self._topHeight(f.x - 1, f.y), gy = self._topHeight(f.x, f.y + 1) - self._topHeight(f.x, f.y - 1);
      var wd = self.opts.windDir * Math.PI / 180, wind = self._windSpeed() * 0.004;
      f.vx = (f.vx - gx * 30 * dt + Math.cos(wd) * wind * dt) * Math.exp(-dt * 0.8);
      f.vy = (f.vy - gy * 30 * dt + Math.sin(wd) * wind * dt) * Math.exp(-dt * 0.8);
      var nx2 = f.x + f.vx * dt, ny2 = f.y + f.vy * dt;
      if (!self._isLand(nx2, ny2) && nx2 > 1 && ny2 > 1 && nx2 < T.worldW - 1 && ny2 < T.worldH - 1) { f.x = nx2; f.y = ny2; } else { f.vx *= -0.5; f.vy *= -0.5; }
      f.a += (f.vx - f.vy) * dt * 0.3;
      f.bob = self._topHeight(f.x, f.y);
    });
    this._collideTop();
    this.fish.forEach(function (f) {                   // wander, keep to the shallows, flee the boat
      f.flee = Math.max(0, f.flee - dt);
      if (b && Math.sqrt((f.x - b.x) * (f.x - b.x) + (f.y - b.y) * (f.y - b.y)) < 9 && f.flee <= 0) { f.flee = 1.4; f.dir = Math.atan2(f.y - b.y, f.x - b.x); }
      f.turn += (Math.sin(self.time * 0.9 + f.ph) * 0.8 - f.turn) * dt;
      f.dir += f.turn * dt;
      var spd = f.speed * (1 + f.flee * 2.5), ax = f.x + Math.cos(f.dir) * 3, ay = f.y + Math.sin(f.dir) * 3, d2 = self._depthAt(ax, ay);
      if (d2 < 0.9 || d2 > 7 || ax < 3 || ay < 3 || ax > T.worldW - 3 || ay > T.worldH - 3) f.dir += dt * 3.2;
      else { f.x += Math.cos(f.dir) * spd * dt; f.y += Math.sin(f.dir) * spd * dt; }
    });
    var B = T.bytes, c2 = T.cur;
    for (y = win[1]; y <= win[3]; y++) for (x = win[0]; x <= win[2]; x++) { i = y * W + x; var v = c2[i] * 127.5 + 127.5; B[i] = v < 0 ? 0 : v > 255 ? 255 : v; }
    var gl = this.gl, y0 = Math.max(win[1] - 1, 0), y1 = Math.min(win[3] + 1, H - 1);   // only the rows the window covers
    gl.bindTexture(gl.TEXTURE_2D, this.tex.sim);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, y0, W, y1 - y0 + 1, gl.LUMINANCE, gl.UNSIGNED_BYTE, B.subarray(y0 * W, (y1 + 1) * W));
  };
  WaterLite.prototype._topUniforms = function (p, rect) {
    var gl = this.gl, T = this.top;
    gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, this.tex.map); gl.uniform1i(p.loc('uMap'), 4);
    gl.uniform2f(p.loc('uWorld'), T.worldW, T.worldH); gl.uniform4f(p.loc('uViewRect'), rect[0], rect[1], rect[2], rect[3]);
  };
  WaterLite.prototype._renderTop = function (w, h, A) {
    var gl = this.gl, T = this.top, C = this.colors, rect = this._topRect(), b = this.topBoat, self = this;
    if (this.stats.px > 1) { var ux = rect[2] / w, uy = rect[3] / h; rect[0] = Math.round(rect[0] / ux) * ux; rect[1] = Math.round(rect[1] / uy) * uy; }
    this._rect = rect;
    var sh = new Float32Array(48), n = 0;
    this.floaters.forEach(function (f) {
      if (n >= 12) return;
      if (f === b) {
        var hx = Math.cos(b.heading), hy = Math.sin(b.heading);
        [-0.32, 0, 0.32].forEach(function (o) { if (n < 12) { sh.set([f.x + hx * o * f.size, f.y + hy * o * f.size, f.size * 0.3, 0.65], n * 4); n++; } });
      } else { sh.set([f.x, f.y, f.size * 0.62, 0.6], n * 4); n++; }
    });
    this._unbindPassTextures();
    var Lr = this._target('layer', w, h, gl.LINEAR);
    gl.bindFramebuffer(gl.FRAMEBUFFER, Lr.f); gl.viewport(0, 0, w, h);
    gl.disable(gl.DEPTH_TEST);
    var p = this.prog.topBed;
    gl.useProgram(p.p); this._quadAttrib(); this._common(p); this._topUniforms(p, rect);
    gl.uniform4fv(p.loc('uShadows'), sh);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    // fish swim in the bed layer, so the water covers them
    var fishList = this.fish.map(function (f) {
      var depth = self._depthAt(f.x, f.y);
      return { x: f.x, y: f.y, w: f.size, h: f.size * 0.45, a: f.dir + Math.sin(self.time * 7 + f.ph) * 0.12, kind: 6, color: [0.2, 0.26, 0.32], color2: [0.28, 0.34, 0.4], z: clamp(depth * 0.45 / 12, 0.01, 1) };
    });
    this._sprites(rect, w, fishList, true);
    gl.bindFramebuffer(gl.FRAMEBUFFER, A.f); gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    p = this.prog.topWater;
    gl.useProgram(p.p); this._quadAttrib(); this._common(p); this._topUniforms(p, rect);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, Lr.t); gl.uniform1i(p.loc('uBed'), 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.tex.sim); gl.uniform1i(p.loc('uSim'), 1);
    gl.uniform2f(p.loc('uSimSize'), T.W, T.H); gl.uniform1f(p.loc('uFoam'), this.opts.foam); gl.uniform1f(p.loc('uWindAmt'), clamp(this._windSpeed() / 10, 0.2, 1.5));
    gl.uniform1f(p.loc('uStarCell'), 7 * rect[2] / w);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    this._sprites(rect, w, this.floaters.map(function (f) {
      if (f === b) return { x: f.x, y: f.y, w: f.size * 0.5, h: f.size, a: f.a, kind: 4, color: [0.93, 0.93, 0.91], color2: C.wood };
      var s = f.size * (1 + clamp(f.bob, -0.5, 0.5) * 0.25);
      return { x: f.x, y: f.y, w: s, h: f.kind === 'barrel' ? s * 1.15 : s, a: f.a, kind: f.kind === 'barrel' ? 1 : 0, color: f.kind === 'barrel' ? [C.wood[0] * 0.8, C.wood[1] * 0.8, C.wood[2] * 0.85] : C.wood, color2: [0.18, 0.18, 0.2] };
    }), false);
  };

  // ---- shared ----------------------------------------------------------------------------
  // Side: x, y in view units. Top: world units. 3D: world x, z (leaves foam).
  WaterLite.prototype.splash = function (x, y, power, radius, silent) {
    var m = this.opts.mode;
    if (!silent) this._emit('splash', m === '3d' ? { mode: m, x: x, z: y, power: power || 1, radius: radius || 1 } : { mode: m, x: x, y: y, power: power, radius: radius || (m === 'side' ? 20 : 2) });
    if (m === 'side') {
      this._push(x, -Math.abs(power) * 0.25, radius || 20);
      var n = Math.min(26, Math.round(4 + power * 1.2)), ys = this.side.level - this._sideHeight(x);
      for (var i = 0; i < n; i++) this.drops.push({ x: x + (Math.random() - 0.5) * (radius || 20), y: ys - 2, vx: (Math.random() - 0.5) * 140, vy: -90 - Math.random() * power * 14, r: 2 + Math.random() * 2.5, life: 1.5 });
      if (this.drops.length > 120) this.drops.splice(0, this.drops.length - 120);
      if (power > 3) this.fish.forEach(function (f) { if (Math.abs(f.x - x) < 80) { f.flee = 1.2; f.vx = (f.x > x ? 1 : -1) * Math.abs(f.vx); } });
    } else if (m === 'top') {
      var T = this.top, r = Math.max((radius || 2) * T.cell, 1), cx = x * T.cell, cy = y * T.cell, sw = T.win || [1, 1, T.W - 2, T.H - 2];
      for (var yy = Math.floor(cy - r); yy <= Math.ceil(cy + r); yy++) for (var xx = Math.floor(cx - r); xx <= Math.ceil(cx + r); xx++) {
        if (xx < sw[0] || yy < sw[1] || xx > sw[2] || yy > sw[3]) continue;   // only where ripples are simulated
        var d = Math.sqrt((xx - cx) * (xx - cx) + (yy - cy) * (yy - cy)); if (d > r) continue;
        T.cur[yy * T.W + xx] -= power * (0.5 + 0.5 * Math.cos(d / r * Math.PI));
      }
      if (power > 0.8) this.fish.forEach(function (f) { if (Math.sqrt((f.x - x) * (f.x - x) + (f.y - y) * (f.y - y)) < 12) { f.flee = 1.4; f.dir = Math.atan2(f.y - y, f.x - x); } });
    } else {
      this.trail.unshift({ x: x, z: y, life: Math.min(1, power || 1) }); if (this.trail.length > 8) this.trail.pop();
    }
  };
  WaterLite.prototype._quadAttrib = function () {
    var gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  };
  WaterLite.prototype._unbindPassTextures = function () {
    var gl = this.gl;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, null);
  };
  function fr(x) { return x - Math.floor(x); }
  WaterLite.prototype._common = function (p) {
    var gl = this.gl, C = this._fc || this.colors, E = this.env, st = this.style, wd = this.opts.windDir * Math.PI / 180, t = this.time, TAU = Math.PI * 2;
    gl.uniform4f(p.loc('uRipOff'), fr(t * 0.021), fr(t * 0.013), fr(-t * 0.017), fr(t * 0.026));
    gl.uniform4f(p.loc('uCauOff'), fr(t * 0.011), fr(t * 0.007), fr(t * 0.005), fr(-t * 0.0035));
    gl.uniform4f(p.loc('uScrl'), fr(t * 0.01), fr(t * 0.004), fr(t * 0.012), fr(t * 0.04));
    gl.uniform4f(p.loc('uScrl2'), fr(t * 0.011), fr(t * 0.006), fr(t * 0.0021), fr(t * 0.0035));
    gl.uniform4f(p.loc('uFr'), fr(t * 0.28), fr(t * 0.21), fr(t * 0.012), fr(t * 1.15));
    gl.uniform4f(p.loc('uAng'), (t * 2.7) % TAU, (t * 1.2) % TAU, (t * 2.0) % TAU, (t * 1.15) % TAU);
    gl.uniform4f(p.loc('uAng2'), (t * 0.8) % TAU, (t * 1.9) % TAU, (t * 3.7) % TAU, 0);
    gl.uniform4f(p.loc('uCells'), (t * 0.9) % 256, (t * 0.3) % 256, 0, 0);
    gl.uniform3fv(p.loc('uLight'), C.light || [1, 1, 1]); gl.uniform3fv(p.loc('uGlowCol'), C.glow); gl.uniform1f(p.loc('uGlow'), E.glow);
    gl.uniform1f(p.loc('uStars'), E.stars); gl.uniform1f(p.loc('uRain'), this.rainAmt); gl.uniform1f(p.loc('uOvercast'), E.overcast);
    gl.uniform3fv(p.loc('uSkyMid'), C.skyMid); gl.uniform1f(p.loc('uDesat'), E.desat);
    gl.uniform1f(p.loc('uStyle'), st.id); gl.uniform1f(p.loc('uTime'), t % 1800);
    gl.uniform1f(p.loc('uBands'), st.bands); gl.uniform1f(p.loc('uCrisp'), st.crisp); gl.uniform1f(p.loc('uScenery'), this.opts.scenery ? 1 : 0);
    gl.uniform3fv(p.loc('uPaper'), C.paper); gl.uniform3fv(p.loc('uInk'), C.ink); gl.uniform3fv(p.loc('uDeep'), C.deep); gl.uniform3fv(p.loc('uShallow'), C.shallow);
    gl.uniform3fv(p.loc('uSigma'), this.sigma); gl.uniform3fv(p.loc('uFoamCol'), C.foam);
    gl.uniform3fv(p.loc('uSkyTop'), C.skyTop); gl.uniform3fv(p.loc('uSkyHor'), C.skyHorizon); gl.uniform3fv(p.loc('uSunCol'), C.sun); gl.uniform3fv(p.loc('uSunDir'), this.sunDir);
    gl.uniform3fv(p.loc('uSand'), C.sand); gl.uniform3fv(p.loc('uGrass'), C.grass); gl.uniform3fv(p.loc('uRock'), C.rock); gl.uniform3fv(p.loc('uWood'), C.wood);
    gl.uniform2f(p.loc('uCloudOff'), (t * 0.0035 * Math.cos(wd)) % 1, (t * 0.0035 * Math.sin(wd)) % 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.tex.water); gl.uniform1i(p.loc('uWaterTex'), 2);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.tex.detail); gl.uniform1i(p.loc('uDetail'), 3);
  };
  WaterLite.prototype._target = function (name, w, h, filter) {
    var gl = this.gl, t = this.fbos[name];
    if (!t || t.w !== w || t.h !== h) {
      if (t) { gl.deleteFramebuffer(t.f); gl.deleteTexture(t.t); gl.deleteRenderbuffer(t.d); }
      var tex = this._dataTex(w, h, gl.NEAREST), f = gl.createFramebuffer(), d = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, d); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_STENCIL, w, h);
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, d);
      t = this.fbos[name] = { f: f, t: tex, d: d, w: w, h: h, filter: gl.NEAREST };
    }
    if (filter && t.filter !== filter) {
      gl.bindTexture(gl.TEXTURE_2D, t.t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      t.filter = filter;
    }
    return t;
  };

  WaterLite.prototype.resize = function () {
    var c = this.canvas, dpr = Math.min(root.devicePixelRatio || 1, this.q.dpr);
    var w = Math.max(2, Math.round((c.clientWidth || c.width) * dpr)), h = Math.max(2, Math.round((c.clientHeight || c.height) * dpr));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    this._dpr = dpr;
  };
  WaterLite.prototype.update = function (dt) {
    dt = clamp(dt || 0, 0, 0.1);
    this.time += dt;
    if (this.opts.mode === 'side') this._updateSide(dt);
    else if (this.opts.mode === 'top') this._updateTop(dt);
    else this._update3d(dt);
    this._updateWeather(dt);
    this._updateCamera2d(dt);
  };
  WaterLite.prototype._windSpeed = function () { return this.opts.wind * (this.env ? this.env.wind : 1); };
  WaterLite.prototype._updateWeather = function (dt) {
    var E = this.env, L = this._storm, m = this.opts.mode, i, lo = this.opts.lightning;
    var rate = lo >= 0 ? +lo : (E.lightning ? 8 : 0);       // random strikes a minute
    this._flash = 0; this._bolt = null;
    if (rate > 0 || (L && L.t >= 0)) {
      if (!L) L = this._storm = { next: Infinity, t: -1 };
      if (rate > 0 && !(L.next < Infinity)) L.next = this.time + 60 / rate * (0.2 + Math.random() * 0.6);
      if (L.t < 0 && rate > 0 && this.time >= L.next) {
        L.t = 0; L.seed = Math.random() * 97; L.pos = Math.random(); L.strength = 0.65 + Math.random() * 0.35;
        this._emit('lightning', { strength: L.strength, x: L.pos });   // x: where across the view, for panning thunder
      }
      if (L.t >= 0) {
        var seq = [1, 0.3, 0.85, 0.15, 0.55, 0.22, 0.07], k = Math.floor(L.t / 0.075);
        L.t += dt;
        if (k >= seq.length) { L.t = -1; L.next = rate > 0 ? this.time + 60 / rate * (0.4 + Math.random() * 1.2) : Infinity; if (!rate) this._storm = null; }
        else { this._flash = seq[k] * L.strength; if (k < 4 && this.opts.scenery) this._bolt = L; }
      }
    } else this._storm = null;
    var r = this.rainAmt;
    if (r <= 0.001) return;
    if (m === 'top') {                                     // drops land in the ripple simulation, in and near the view
      var R = this._rect || this._topRect(), n = r * 170 * dt * (R[2] * R[3] / 14400);
      for (i = 0; i < n || (i === 0 && Math.random() < n); i++) this.splash(R[0] + Math.random() * R[2], R[1] + Math.random() * R[3], 0.07 + Math.random() * 0.09, 0.7, true);
    } else if (m === 'side') {                             // little kicks to the surface, and spray
      var S = this.side, hits = r * 70 * dt;
      for (i = 0; i < hits || (i === 0 && Math.random() < hits); i++) {
        var x = S.camX + Math.random() * S.viewW;
        this._push(x, -(0.2 + Math.random() * 0.25), 3);
        if (Math.random() < 0.6) this.drops.push({ x: x, y: S.level - this._sideHeight(x) - 1, vx: (Math.random() - 0.5) * 40, vy: -35 - Math.random() * 45, r: 0.9 + Math.random() * 0.8, life: 0.4 });
      }
      if (this.drops.length > 160) this.drops.splice(0, this.drops.length - 160);
    }
  };
  // a lightning strike now, in any mood (storms also strike on their own); x: where across the view, 0 .. 1
  WaterLite.prototype.lightning = function (strength, x) {
    var L = this._storm || (this._storm = { next: Infinity, t: -1 });
    L.t = 0; L.seed = Math.random() * 97; L.pos = x === undefined ? Math.random() : clamp(x, 0, 1); L.strength = clamp(strength || 1, 0.1, 1.5);
    this._emit('lightning', { strength: L.strength, x: L.pos });
    return this;
  };
  WaterLite.prototype._updateCamera2d = function (dt) {
    var cam = this.camera2d, f = cam.follow, m = this.opts.mode;
    if (m === '3d') return;
    if (f && typeof f.x === 'number') {
      var k = Math.min(dt * 3.5, 1);
      cam.x += (f.x - cam.x) * k;
      if (m === 'top' && typeof f.y === 'number') cam.y += (f.y - cam.y) * k;
    }
    if (m === 'side') { var S = this.side; cam.x = clamp(cam.x, S.viewW / 2, S.worldW - S.viewW / 2); }
    else { var r = this._topRect(); cam.x = r[0] + r[2] / 2; cam.y = r[1] + r[3] / 2; }   // stay where the view really is
  };
  WaterLite.prototype._frameColors = function () {
    var C = this.colors, F = {}, f = this.style.id === 5 ? 0 : (this._flash || 0), L = this.env.light, k;
    for (k in C) F[k] = C[k];
    function add(a, v) { return [a[0] + v[0] * f, a[1] + v[1] * f, a[2] + v[2] * f]; }
    F.light = add(L, [0.85, 0.88, 1.0]);
    if (f > 0) { F.skyTop = add(C.skyTop, [0.45, 0.48, 0.58]); F.skyHorizon = add(C.skyHorizon, [0.55, 0.58, 0.68]); F.skyMid = add(C.skyMid, [0.5, 0.53, 0.63]); F.sun = add(C.sun, [0.5, 0.52, 0.62]); }
    this._fc = F;
  };
  WaterLite.prototype._drawRain = function (A, w, h) {
    var gl = this.gl, p = this.prog.rain, m = this.opts.mode, wd = this.opts.windDir * Math.PI / 180, F = this._fc, dir, len;
    if (m === 'top') { dir = [Math.cos(wd), Math.sin(wd)]; len = Math.max(2, h * 0.012); }   // seen from above: short dashes
    else {
      var r = this._camRight || [1, 0, 0], slant = m === 'side' ? Math.cos(wd) * 0.35 : (Math.cos(wd) * r[0] + Math.sin(wd) * r[2]) * 0.4 + 0.06, l = Math.sqrt(1 + slant * slant);
      dir = [slant / l, 1 / l]; len = Math.max(3, h * 0.036);
    }
    var col = this.style.id === 5 ? this.colors.ink : [0, 1, 2].map(function (i) { return (F.skyHorizon[i] * 0.5 + 0.5) * Math.min(F.light[i] * 1.2, 1); });
    gl.bindFramebuffer(gl.FRAMEBUFFER, A.f); gl.viewport(0, 0, w, h);
    gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(p.p); this._quadAttrib();
    gl.uniform2f(p.loc('uRes'), w, h); gl.uniform2f(p.loc('uRainDir'), dir[0], dir[1]); gl.uniform1f(p.loc('uRainLen'), len);
    gl.uniform1f(p.loc('uRainAmt'), this.rainAmt); gl.uniform4f(p.loc('uRainCol'), col[0], col[1], col[2], this.style.id === 5 ? 0.6 : 0.42);
    var t = this.time, FF = [], FC = [];
    [[1.8, 1], [2.5, 1.6], [1.25, 0.6]].forEach(function (L) {        // speed (screen heights a second) and streak length of each layer
      var D = t * h * L[0] / (len * L[1] * 3 + 10);
      FF.push(D - Math.floor(D)); FC.push(Math.floor(D) % 2048);
    });
    gl.uniform3f(p.loc('uFallF'), FF[0], FF[1], FF[2]); gl.uniform3f(p.loc('uFallC'), FC[0], FC[1], FC[2]);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disable(gl.BLEND);
  };
  // frame times: stats.fps, and for quality 'auto' the drawing resolution follows the GPU's load
  WaterLite.prototype._timeFrame = function () {
    var now = root.performance && root.performance.now ? root.performance.now() : Date.now(), ms = now - (this._lastT || 0), A;
    this._lastT = now;
    if (!this._auto) this._auto = { scale: 0.75, t: 0, fast: 0, drops: 0, ref: 0, budget: 1000 / 60 };
    A = this._auto;
    if (!(ms > 0 && ms < 250)) return;                     // first frame, or back from a hidden tab
    this._avgMs = this._avgMs ? this._avgMs * 0.9 + ms * 0.1 : ms;
    this.stats.fps = Math.round(1000 / this._avgMs);
    if (!this.q.auto || this.pixelSize > 1) return;
    A.t += ms;
    if (A.t < 500) return;                                 // decide twice a second
    A.t = 0;
    var avg = this._avgMs;
    if (avg > A.budget * 1.25 && A.scale > 0.4) {
      if (A.drops >= 2 && avg > A.ref * 0.93) {           // drawing less did not help: the game is CPU-bound or capped,
        A.budget = Math.max(A.budget, avg * 0.97);         // so aim for the frame rate it actually runs at
        A.scale = Math.min(1, A.scale / 0.72); A.drops = 0;
        return;
      }
      if (!A.drops) A.ref = avg;
      A.scale = Math.max(0.4, A.scale * 0.85); A.drops++; A.fast = 0;
    } else if (avg < A.budget * 1.08) {
      A.drops = 0;
      if (++A.fast >= 4 && A.scale < 1) { A.scale = Math.min(1, A.scale * 1.08); A.fast = 0; }
    } else A.fast = 0;
  };
  // Times each quality on this device (blocks for a moment; it resets the scene, so run it before play).
  // Returns { ms: { potato, low, medium, high }, recommended } where recommended leaves headroom for your game.
  WaterLite.prototype.benchmark = function (frames) {
    var gl = this.gl, saved = this.opts.quality, out = {}, px = new Uint8Array(4), self = this, best = 'potato';
    var now = function () { return root.performance && root.performance.now ? root.performance.now() : Date.now(); };
    frames = frames || 10;
    ['potato', 'low', 'medium', 'high'].forEach(function (q) {
      self.setOptions({ quality: q });
      self.update(1 / 60); self.render(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);   // compile and allocate first
      var t0 = now();
      for (var i = 0; i < frames; i++) { self.update(1 / 60); self.render(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
      var ms = (now() - t0) / frames;
      out[q] = +ms.toFixed(2);
      if (ms < 1000 / 60 * 0.6) best = q;
    });
    this.setOptions({ quality: saved });
    this._lastT = 0;
    return { ms: out, recommended: best };
  };
  WaterLite.prototype.render = function () {
    var gl = this.gl;
    if (gl.isContextLost()) return;
    this.resize();
    this._frameColors();
    this._timeFrame();
    var cw = this.canvas.width, ch = this.canvas.height, px = 1, lw, lh, sc = this.q.scale * (this.q.auto ? this._auto.scale : 1);
    if (this.pixelSize > 1) {
      px = Math.max(2, Math.round(this.pixelSize * (this._dpr || 1)));
      lw = Math.ceil(cw / px); lh = Math.ceil(ch / px); sc = 1;
    } else { lw = Math.max(16, Math.round(cw * sc)); lh = Math.max(16, Math.round(ch * sc)); }
    this.stats.lowW = lw; this.stats.lowH = lh; this.stats.px = px; this.stats.scale = +sc.toFixed(2);
    var pal = PALETTES[this.palName] || null, quant = !!pal || this.style.bits > 0;
    var A = this._target('scene', lw, lh, quant || px > 1 ? gl.NEAREST : gl.LINEAR);
    if (this.opts.mode === 'side') this._renderSide(lw, lh, A);
    else if (this.opts.mode === 'top') this._renderTop(lw, lh, A);
    else this._render3d(lw, lh, A);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    if (this.rainAmt > 0.001) this._drawRain(A, lw, lh);
    var src = A, p;
    if (quant) {
      var B = this._target('quant', lw, lh, gl.NEAREST);
      gl.bindFramebuffer(gl.FRAMEBUFFER, B.f); gl.viewport(0, 0, lw, lh);
      p = this.prog.quant; gl.useProgram(p.p); this._quadAttrib();
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, A.t); gl.uniform1i(p.loc('uTex'), 0);
      var arr = new Float32Array(48);
      if (pal) for (var i = 0; i < pal.length; i++) arr.set(hex(pal[i]), i * 3);
      gl.uniform3fv(p.loc('uPal'), arr); gl.uniform1f(p.loc('uPalN'), pal ? pal.length : 0);
      gl.uniform1f(p.loc('uDither'), this.dither); gl.uniform1f(p.loc('uBits'), this.style.bits); gl.uniform1f(p.loc('uSat'), pal ? 1.45 : 1.0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      src = B;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, cw, ch);
    p = this.prog.blit; gl.useProgram(p.p); this._quadAttrib();
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.t); gl.uniform1i(p.loc('uTex'), 0);
    gl.uniform2f(p.loc('uUvScale'), px > 1 ? cw / (lw * px) : 1, px > 1 ? ch / (lh * px) : 1);
    gl.uniform1f(p.loc('uScan'), this.style.scan); gl.uniform1f(p.loc('uPx'), px);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  // screen (CSS pixels from the canvas's top left) to the mode's world
  WaterLite.prototype.screenToWorld = function (sx, sy) {
    var c = this.canvas, u = sx / c.clientWidth, v = sy / c.clientHeight, m = this.opts.mode;
    if (m === 'side') return { x: this.side.camX + u * this.side.viewW, y: v * this.side.viewH };
    if (m === 'top') { var r = this._rect || this._topRect(); return { x: r[0] + u * r[2], y: r[1] + v * r[3] }; }
    var cam = this.cam, eye = this._eye(), L = lookAt(eye, cam.target), ty = Math.tan(cam.fov / 2), asp = c.clientWidth / c.clientHeight;
    var nx = u * 2 - 1, ny = 1 - v * 2;
    var d = [0, 1, 2].map(function (k) { return L.f[k] + L.r[k] * nx * ty * asp + L.u[k] * ny * ty; });
    if (d[1] >= -1e-3) return null;
    var t = -eye[1] / d[1];
    return { x: eye[0] + d[0] * t, z: eye[2] + d[2] * t };
  };
  WaterLite.prototype.drop = function (sx, sy) {
    var w = this.screenToWorld(sx, sy); if (!w) return;
    var m = this.opts.mode;
    if (m === 'side') {
      var kinds = ['crate', 'barrel', 'duck'];
      this.addFloater(w.x, Math.min(w.y, this.side.level - 40), { kind: kinds[Math.floor(Math.random() * 3)], size: 15 + Math.random() * 10, angle: (Math.random() - 0.5) * 0.8 });
    } else if (m === 'top') this.splash(w.x, w.y, 1.4, 2.5);
    else {
      if (this._terrainHeight(w.x, w.z) > -0.3) return;
      this.addFloater(w.x, w.z, { kind: Math.random() < 0.6 ? 'crate' : 'barrel', y: 4 });
      this.splash(w.x, w.z, 1);
    }
  };
  Object.defineProperty(WaterLite.prototype, 'boat', { get: function () {
    var m = this.opts.mode; return m === 'top' ? this.topBoat : m === '3d' ? this.boat3d : null;
  } });
  WaterLite.prototype.config = function () {
    var o = {}; for (var k in DEFAULTS) o[k] = this.opts[k];
    if (typeof o.land === 'function') o.land = 'custom';
    return o;
  };
  // events: 'splash' { mode, x, y (z in 3D), power, radius }, 'lightning' { strength }, 'contextlost', 'contextrestored'
  WaterLite.prototype.on = function (type, fn) { (this._ev[type] = this._ev[type] || []).push(fn); return this; };
  WaterLite.prototype.off = function (type, fn) {
    var L = this._ev[type];
    if (L) this._ev[type] = fn ? L.filter(function (f) { return f !== fn; }) : [];
    return this;
  };
  WaterLite.prototype._emit = function (type, e) {
    var L = this._ev[type];
    if (!L || !L.length) return;
    e.type = type; e.target = this;
    L.slice().forEach(function (fn) { fn(e); });
  };
  WaterLite.prototype._restore = function () {
    var gl = this.gl, n = this.grid ? this.grid.n : 96;
    this.grid = null; this.terrain = null; this.props = null;
    this._initGL();
    this._buildGrid(n);
    if (this.terrainData) this._uploadTerrain();
    if (this.side) this.tex.heights = this._dataTex(this.side.cols, 1, gl.NEAREST, gl.LUMINANCE_ALPHA);
    if (this.top) this._uploadTopMap();
  };
  WaterLite.prototype.dispose = function () {
    var gl = this.gl, k;
    this.canvas.removeEventListener('webglcontextlost', this._onLost, false);
    this.canvas.removeEventListener('webglcontextrestored', this._onRestored, false);
    this._ev = {};
    for (k in this._progs) gl.deleteProgram(this._progs[k].p);
    for (k in this.tex) if (this.tex[k]) gl.deleteTexture(this.tex[k]);
    for (k in this.fbos) { gl.deleteFramebuffer(this.fbos[k].f); gl.deleteTexture(this.fbos[k].t); gl.deleteRenderbuffer(this.fbos[k].d); }
    for (k in this.meshes) gl.deleteBuffer(this.meshes[k].buf);
    if (this.grid) { gl.deleteBuffer(this.grid.vb); gl.deleteBuffer(this.grid.ib); }
    if (this.terrain) { gl.deleteBuffer(this.terrain.vb); gl.deleteBuffer(this.terrain.ib); }
    if (this.props) gl.deleteBuffer(this.props.buf);
    gl.deleteBuffer(this.quad);
    this._progs = {}; this.tex = {}; this.fbos = {};
  };

  root.WaterLite = WaterLite;
  if (typeof module !== 'undefined' && module.exports) module.exports = WaterLite;
})(typeof window !== 'undefined' ? window : this);
