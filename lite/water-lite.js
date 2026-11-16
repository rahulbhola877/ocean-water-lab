/*!
 * Water Lite: stylized real-time water for low-end browser games.
 * Part of Ocean Water Lab, MIT License. https://github.com/rahulbhola877/ocean-water-lab
 *
 *   modes:  '3d'    an ocean in perspective (Gerstner waves, CPU-exact heights for buoyancy)
 *           'side'  2D side view for platformers (spring surface + swell, floating bodies)
 *           'top'   2D top-down for RPGs (ripple simulation, shores, a boat that leaves a wake)
 *   styles: realistic, toon, pixel, lowpoly, retro, ink
 *
 * The simulation is the same in every style; only the drawing changes. WebGL 1, no extensions
 * required (OES_standard_derivatives is used when present), no dependencies, ES5.
 *
 *   var water = new WaterLite(canvas, { mode: 'side', style: 'pixel' });
 *   function frame(dt) { water.update(dt); water.render(); }
 *   water.sample(x, z)            surface height (and normal in 3D) for your own physics
 *   water.splash(x, y, power, r)  disturb the surface
 *   water.addFloater(x, y, def)   something that floats: { kind, size, density }
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
  // per style: pixel size (CSS px), palette, dither, colour bits per channel (0 = full), scanlines, vertex snap
  var STYLES = {
    realistic: { id: 0, pixel: 1, palette: 'none', dither: 0, bits: 0, scan: 0, snap: 0 },
    toon: { id: 1, pixel: 1, palette: 'none', dither: 0, bits: 0, scan: 0, snap: 0 },
    pixel: { id: 2, pixel: 4, palette: 'sweetie16', dither: 0.25, bits: 0, scan: 0, snap: 0 },
    lowpoly: { id: 3, pixel: 1, palette: 'none', dither: 0, bits: 0, scan: 0, snap: 0 },
    retro: { id: 4, pixel: 3, palette: 'none', dither: 0.6, bits: 5, scan: 0.28, snap: 1 },
    ink: { id: 5, pixel: 1, palette: 'none', dither: 0, bits: 0, scan: 0, snap: 0 }
  };
  var QUALITY = {
    potato: { scale: 0.5, grid: 56, waves: 4, sim: 112, dpr: 1, sub: 2 },
    low: { scale: 0.75, grid: 88, waves: 8, sim: 160, dpr: 1, sub: 2 },
    medium: { scale: 1, grid: 128, waves: 12, sim: 224, dpr: 1.5, sub: 3 },
    high: { scale: 1, grid: 180, waves: 16, sim: 288, dpr: 2, sub: 3 }
  };
  var THEMES = {
    realistic: { deep: '#062a4a', shallow: '#1b8fa8', foam: '#f2f7f6', skyTop: '#3d79c7', skyHorizon: '#cfe3ee', sun: '#fff1d6', sand: '#d8c08c', grass: '#5d8f3a', wood: '#9a6a3a', paint: '#b8322a', paper: '#f3efe4', ink: '#1d2740' },
    toon: { deep: '#1557a6', shallow: '#33c2e6', foam: '#ffffff', skyTop: '#5fb4ff', skyHorizon: '#c9f1ff', sun: '#fff6b0', sand: '#f3d78a', grass: '#6cc24a', wood: '#c8833f', paint: '#e0453a', paper: '#f3efe4', ink: '#1a2238' },
    pixel: { deep: '#29366f', shallow: '#41a6f6', foam: '#f4f4f4', skyTop: '#3b5dc9', skyHorizon: '#73eff7', sun: '#ffcd75', sand: '#ffcd75', grass: '#38b764', wood: '#ef7d57', paint: '#b13e53', paper: '#f4f4f4', ink: '#1a1c2c' },
    lowpoly: { deep: '#11406b', shallow: '#2fa3b8', foam: '#e9f6f3', skyTop: '#f28f6b', skyHorizon: '#ffd8a8', sun: '#fff1c1', sand: '#e7c48a', grass: '#7aa95c', wood: '#b07a48', paint: '#c2453a', paper: '#f3efe4', ink: '#1d2740' },
    retro: { deep: '#123f6e', shallow: '#3a93bf', foam: '#e6f2ee', skyTop: '#3a5aa0', skyHorizon: '#b9cfe0', sun: '#fff0c0', sand: '#d4b478', grass: '#5c8a3e', wood: '#9a6a3a', paint: '#b8322a', paper: '#f3efe4', ink: '#1d2740' },
    ink: { deep: '#1d2740', shallow: '#6d86a8', foam: '#f3efe4', skyTop: '#f3efe4', skyHorizon: '#f3efe4', sun: '#f3efe4', sand: '#efe6d2', grass: '#e6e1d0', wood: '#f3efe4', paint: '#f3efe4', paper: '#f3efe4', ink: '#1d2740' }
  };
  var DEFAULTS = {
    mode: '3d', style: 'realistic', quality: 'low',
    palette: 'auto', pixelSize: 0, dither: -1,          // 'auto' / 0 / -1 = use the style's own
    wind: 8, windDir: 30, waveHeight: 1, choppiness: 0.8, foam: 1,
    colors: null,                                         // override any THEMES key, e.g. { deep: '#002244' }
    sunElevation: 35, sunAzimuth: 200,
    scenery: true,                                        // false: no sky, hills or land (transparent with { transparent: true })
    level: 0.58,                                          // side view: water line, fraction of the height from the top
    land: 'islands',                                      // top view: 'islands', 'none' or function (u, v) -> true/height
    seed: 7, floaters: true, boat: true
  };
  // 2D bodies: height / width, the part that floats (top and bottom, in heights from the centre, y down),
  // centre of mass (heights below the centre) and density relative to water
  var KIND2D = {
    crate: { ratio: 1, hull: [-0.5, 0.5], com: 0, density: 0.55 },
    barrel: { ratio: 1.15, hull: [-0.5, 0.5], com: 0, density: 0.6 },
    duck: { ratio: 0.9, hull: [-0.1, 0.36], com: 0.16, density: 0.35 },
    boat: { ratio: 0.8, hull: [0.18, 0.42], com: 0.3, density: 0.45 }
  };

  function hex(h) { var n = parseInt(String(h).slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function rng(seed) { var s = (seed >>> 0) || 1; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  var G = 9.81;

  // ======================================================================================
  // Shaders. Fragment shaders get the derivatives extension when the device has it.
  // ======================================================================================
  var FS_HEAD = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n';
  var VS_HEAD = 'precision highp float;\n';
  var COMMON = [
    'uniform float uStyle; uniform float uTime; uniform vec3 uPaper; uniform vec3 uInk;',
    'bool isStyle(float s) { return abs(uStyle - s) < 0.5; }',
    'bool smoothStyle() { return uStyle < 0.5 || abs(uStyle - 4.0) < 0.5; }      // realistic and retro shade continuously',
    'float hash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }',
    'float noise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y); }',
    'float fbm(vec2 p) { return 0.5 * noise(p) + 0.25 * noise(p * 2.03 + 7.1) + 0.125 * noise(p * 4.01 + 3.7); }',
    'float band(float x, float n) { return floor(clamp(x, 0.0, 0.999) * n) / (n - 1.0); }',
    // ink: screen-space hatching, single where it is a little dark, crossed where it is very dark
    'float hatch(float dark, vec2 fc) {',
    '  float a = step(fract((fc.x + fc.y) * 0.2), 0.22) * step(0.4, dark);',
    '  float b = step(fract((fc.x - fc.y) * 0.2), 0.22) * step(0.72, dark);',
    '  return max(a, b);',
    '}',
    // a line where d = 0, about px pixels wide (fb: width in value units without derivatives)
    'float lineAA(float d, float v, float px, float fb) {',
    '#ifdef HAS_DERIV',
    '  float w = max(fwidth(v), 1e-5) * px;',
    '#else',
    '  float w = fb;',
    '#endif',
    '  return 1.0 - smoothstep(w * 0.5, w, abs(d));',
    '}',
    'float iso(float v, float spacing, float px, float fb) { return lineAA((fract(v / spacing + 0.5) - 0.5) * spacing, v, px, fb); }'
  ].join('\n') + '\n';

  var VS_QUAD = 'attribute vec2 aPos; varying vec2 vUv; void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }';

  // ---- 3D sky ---------------------------------------------------------------------------
  var FS_SKY = [
    'varying vec2 vUv;',
    'uniform vec3 uRight, uUp, uFwd; uniform vec2 uTan; uniform vec3 uSunDir;',
    'uniform vec3 uSkyTop, uSkyHor, uSunCol; uniform float uScenery;',
    'void main() {',
    '  if (uScenery < 0.5) { gl_FragColor = vec4(0.0); return; }',
    '  vec2 n = vUv * 2.0 - 1.0;',
    '  vec3 d = normalize(uFwd + uRight * n.x * uTan.x + uUp * n.y * uTan.y);',
    '  float h = max(d.y, 0.0), mu = dot(d, uSunDir);',
    '  vec2 cp = d.xz / max(d.y, 0.05) * 0.3 + vec2(uTime * 0.008, 0.0);',
    '  float cl = fbm(cp * 1.3) * smoothstep(0.0, 0.2, d.y);',
    '  vec3 c;',
    '  if (isStyle(5.0)) {',
    '    float ang = acos(clamp(mu, -1.0, 1.0));',
    '    float ink = max(lineAA(ang - 0.05, ang, 1.2, 0.004), lineAA(cl - 0.62, cl, 0.8, 0.006) * step(0.02, d.y) * (1.0 - smoothstep(0.25, 0.45, d.y)) * 0.85);',
    '    ink = max(ink, lineAA(d.y, d.y, 1.3, 0.002));',
    '    c = mix(uPaper, uInk, ink);',
    '  } else if (smoothStyle()) {',
    '    c = mix(uSkyHor, uSkyTop, pow(h, 0.55));',
    '    c += uSunCol * pow(max(mu, 0.0), 60.0) * 0.35;',
    '    c = mix(c, uSunCol, smoothstep(0.9993, 0.9997, mu));',
    '    vec3 cloud = mix(vec3(1.0), uSkyHor, 0.25) * (0.85 + 0.25 * pow(max(mu, 0.0), 4.0));',
    '    c = mix(c, cloud, smoothstep(0.5, 0.8, cl) * 0.85);',
    '  } else {',
    '    c = mix(uSkyHor, uSkyTop, band(pow(h, 0.6), 4.0));',
    '    c = mix(c, uSunCol, step(0.9985, mu));',
    '    c = mix(c, vec3(1.0), step(0.6, cl));',
    '    c = mix(c, mix(vec3(1.0), uSkyHor, 0.45), step(0.6, cl) * (1.0 - step(0.64, fbm(cp * 1.3 + vec2(0.0, 0.08)) * smoothstep(0.0, 0.2, d.y))));',
    '  }',
    '  gl_FragColor = vec4(d.y < 0.0 ? (isStyle(5.0) ? uPaper : uSkyHor) : c, 1.0);',
    '}'
  ].join('\n');

  // ---- 3D sea ---------------------------------------------------------------------------
  var VS_SEA = VS_HEAD + [
    'attribute vec2 aGrid;',
    'uniform mat4 uViewProj; uniform vec2 uCenter; uniform float uGridR; uniform float uGridPow; uniform float uWaveTime;',
    'uniform vec4 uWA[16]; uniform vec4 uWB[16]; uniform float uWaveCount;',
    'uniform float uSnap; uniform vec2 uRes;',
    'varying vec3 vWorld; varying vec3 vNormal; varying float vJac; varying float vHeight;',
    'void main() {',
    '  vec2 p = sign(aGrid) * pow(abs(aGrid), vec2(uGridPow)) * uGridR + uCenter;     // denser under the camera',
    '  float fade = 1.0 - smoothstep(uGridR * 0.55, uGridR * 0.95, length(p - uCenter));',
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
    '  vWorld = pos; vNormal = n; vJac = jxx * jzz - jxz * jxz; vHeight = pos.y;',
    '  vec4 cp = uViewProj * vec4(pos, 1.0);',
    '  if (uSnap > 0.0) cp.xy = floor(cp.xy / cp.w * uRes * 0.5 + 0.5) / (uRes * 0.5) * cp.w;   // PS1-style wobble',
    '  gl_Position = cp;',
    '}'
  ].join('\n');
  var FS_SEA = [
    'varying vec3 vWorld; varying vec3 vNormal; varying float vJac; varying float vHeight;',
    'uniform vec3 uCamPos, uSunDir, uDeep, uShallow, uFoamCol, uSkyTop, uSkyHor, uSunCol;',
    'uniform float uFoam, uAmp, uFogR, uScenery; uniform vec4 uTrail[8];',
    'vec3 skyRefl(vec3 d) { float h = max(d.y, 0.0);',
    '  return smoothStyle() ? mix(uSkyHor, uSkyTop, pow(h, 0.55)) : mix(uSkyHor, uSkyTop, band(pow(h, 0.6), 3.0)); }',
    'void main() {',
    '  vec3 N = normalize(vNormal);',
    '#ifdef HAS_DERIV',
    '  if (isStyle(3.0)) { N = normalize(cross(dFdx(vWorld), dFdy(vWorld))); if (N.y < 0.0) N = -N; }   // one normal per facet',
    '#endif',
    '  vec3 toCam = uCamPos - vWorld; float dist = length(toCam); vec3 V = toCam / dist;',
    '  float nv = max(dot(N, V), 0.0), fres = 0.02 + 0.98 * pow(1.0 - nv, 5.0);',
    '  vec3 R = reflect(-V, N); R.y = abs(R.y);',
    '  float diff = max(dot(N, uSunDir), 0.0), rs = max(dot(R, uSunDir), 0.0);',
    '  float tilt = dot(N, uSunDir) - uSunDir.y;                         // + facing the sun, - facing away',
    '  float crest = clamp(vHeight / max(uAmp, 0.05) * 0.5 + 0.5, 0.0, 1.0);',
    '  float glow = pow(max(dot(-V, uSunDir), 0.0), 3.0) * crest;       // light through the crests',
    '  float foam = smoothstep(0.55, 0.2, vJac) * uFoam;',
    '  foam *= smoothstep(0.35, 0.65, noise(vWorld.xz * 0.7) * 0.6 + noise(vWorld.xz * 2.3) * 0.4 + foam * 0.4);',
    '  for (int i = 0; i < 8; i++) {                                   // a wake: foam along the recent track',
    '    vec4 t = uTrail[i]; if (t.w <= 0.0) continue;',
    '    float d = length(vWorld.xz - t.xy);',
    '    foam = max(foam, (1.0 - smoothstep(t.w * 0.45, t.w, d)) * t.z * (0.55 + 0.45 * noise(vWorld.xz * 3.0)));',
    '  }',
    '  vec3 col;',
    '  if (smoothStyle()) {',
    '    vec3 body = mix(uDeep, uShallow, 0.15 + 0.55 * glow + 0.25 * crest) * (0.55 + 0.45 * diff);',
    '    col = mix(body, skyRefl(R), fres) + uSunCol * pow(rs, 250.0) * 4.0;',
    '    col = mix(col, uFoamCol * (0.75 + 0.25 * diff), clamp(foam, 0.0, 1.0));',
    '  } else if (isStyle(5.0)) {',
    '    float near = 1.0 - smoothstep(uFogR * 0.03, uFogR * 0.14, dist);',
    '    float strokes = lineAA(crest - 0.72, crest, 1.0, 0.03) * step(0.4, noise(vWorld.xz * 0.12 + 3.0)) * (1.0 - smoothstep(uFogR * 0.12, uFogR * 0.4, dist));',
    '    float dark = clamp(-tilt * 5.5 - 0.2, 0.0, 0.6) * near;',
    '    float row = floor(gl_FragCoord.y / 4.0);                            // engraved dashes towards the horizon',
    '    float mid = smoothstep(uFogR * 0.04, uFogR * 0.12, dist) * (1.0 - smoothstep(uFogR * 0.35, uFogR * 0.8, dist));',
    '    strokes = max(strokes, step(fract(gl_FragCoord.y / 4.0), 0.26) * step(0.66 - crest * 0.12, noise(vec2(gl_FragCoord.x * 0.035 + row * 7.0, row))) * mid * 0.7);',
    '    float glint = step(0.975, rs) * step(0.5, fract(gl_FragCoord.x * 0.18 + floor(gl_FragCoord.y * 0.5) * 0.37));',
    '    col = mix(uPaper, uInk, max(max(strokes * 0.9, hatch(dark, gl_FragCoord.xy) * 0.6), glint * 0.7));',
    '    col = mix(col, uPaper, step(0.5, foam));',
    '  } else {',
    '    float light = clamp(0.42 + 0.5 * (crest - 0.5) + (isStyle(3.0) ? 3.2 : 1.8) * tilt + 0.25 * glow, 0.0, 1.0);',
    '    col = mix(uDeep, uShallow, isStyle(3.0) ? light : band(light, 3.0));',
    '    float hor = isStyle(3.0) ? smoothstep(0.2, 0.9, fres) : band(smoothstep(0.15, 0.9, fres), 3.0);',
    '    col = isStyle(2.0) ? mix(col, skyRefl(R), step(0.6, hor)) : mix(col, skyRefl(R), hor * 0.7);',
    '    col = mix(col, uSunCol, step(0.996, rs) * step(0.45, noise(vWorld.xz * 2.5)));',
    '    if (isStyle(1.0)) foam = max(foam, step(0.9, crest) * step(0.45, noise(vWorld.xz * 1.3)));    // white caps',
    '    col = mix(col, uFoamCol, step(0.45, foam));',
    '  }',
    '  float fog = smoothstep(uFogR * 0.35, uFogR * 0.9, dist);',
    '  if (isStyle(1.0) || isStyle(2.0)) fog = band(fog, 4.0);',
    '  vec3 fogC = isStyle(5.0) ? uPaper : uSkyHor;',
    '  gl_FragColor = uScenery > 0.5 ? vec4(mix(col, fogC, fog), 1.0) : vec4(col, 1.0 - fog);',
    '}'
  ].join('\n');

  // ---- 3D floating objects (vertex coloured) --------------------------------------------
  var VS_OBJ = VS_HEAD + [
    'attribute vec3 aPos; attribute vec3 aNormal; attribute vec3 aColor;',
    'uniform mat4 uViewProj; uniform mat4 uModel; uniform float uSnap; uniform vec2 uRes;',
    'varying vec3 vN; varying vec3 vC; varying vec3 vW;',
    'void main() { vec4 w = uModel * vec4(aPos, 1.0); vW = w.xyz; vN = mat3(uModel) * aNormal; vC = aColor;',
    '  vec4 cp = uViewProj * w; if (uSnap > 0.0) cp.xy = floor(cp.xy / cp.w * uRes * 0.5 + 0.5) / (uRes * 0.5) * cp.w; gl_Position = cp; }'
  ].join('\n');
  var FS_OBJ = [
    'varying vec3 vN; varying vec3 vC; varying vec3 vW;',
    'uniform vec3 uSunDir; uniform vec3 uSkyHor; uniform vec3 uCamPos; uniform float uFogR; uniform float uScenery;',
    'void main() {',
    '  vec3 N = normalize(vN); float diff = max(dot(N, uSunDir), 0.0);',
    '  vec3 col;',
    '  if (isStyle(5.0)) col = mix(uPaper, uInk, max(hatch(step(diff, 0.45) * 0.5, gl_FragCoord.xy) * 0.7, 0.08 + 0.5 * step(diff, 0.08)));',
    '  else if (smoothStyle()) col = vC * (0.35 + 0.65 * diff) + vC * uSkyHor * 0.15;',
    '  else col = vC * (0.5 + 0.5 * band(diff, 3.0));',
    '  float fog = smoothstep(uFogR * 0.35, uFogR * 0.9, length(uCamPos - vW));',
    '  gl_FragColor = uScenery > 0.5 ? vec4(mix(col, isStyle(5.0) ? uPaper : uSkyHor, fog), 1.0) : vec4(col, 1.0 - fog);',
    '}'
  ].join('\n');

  // ---- 2D side view: sky, hills, the water body and seabed in one pass ---------------------
  var FS_SIDE = [
    'varying vec2 vUv;',
    'uniform sampler2D uHeights; uniform float uCols; uniform vec2 uView; uniform float uLevel; uniform float uRange;',
    'uniform float uPxU; uniform float uScenery;',
    'uniform vec3 uDeep, uShallow, uFoamCol, uSkyTop, uSkyHor, uSunCol, uSand, uGrass;',
    'float hRaw(float x) {',
    '  float u = clamp(x / uView.x, 0.0, 1.0) * (uCols - 1.0), i0 = floor(u), f = u - i0;',
    '  vec4 a = texture2D(uHeights, vec2((i0 + 0.5) / uCols, 0.5));',
    '  vec4 b = texture2D(uHeights, vec2((min(i0 + 1.0, uCols - 1.0) + 0.5) / uCols, 0.5));',
    '  float ha = (a.r * 65280.0 + a.a * 255.0) / 65535.0, hb = (b.r * 65280.0 + b.a * 255.0) / 65535.0;',
    '  return (mix(ha, hb, f) * 2.0 - 1.0) * uRange;',
    '}',
    'float surf(float x) {                                                 // surface height at x, up is positive',
    '  if (isStyle(3.0)) { float k = floor(x / 16.0) * 16.0; return mix(hRaw(k), hRaw(k + 16.0), (x - k) / 16.0); }',
    '  return hRaw(x);',
    '}',
    'float ridgeAt(float x, float s, float base, float amp) { return base - amp * fbm(vec2(x * s, s * 17.0)); }',
    'float ridge(float x, float s, float base, float amp) {',
    '  if (isStyle(3.0)) { float K = 0.3 / s, k = floor(x / K) * K; return mix(ridgeAt(k, s, base, amp), ridgeAt(k + K, s, base, amp), (x - k) / K); }',
    '  return ridgeAt(x, s, base, amp);',
    '}',
    'void main() {',
    '  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uView;                          // view units, y down',
    '  float hs = surf(p.x), ys = uLevel - hs;',
    '  vec3 col; float alpha = 1.0;',
    '  if (p.y < ys) {',
    '    if (uScenery < 0.5) { gl_FragColor = vec4(0.0); return; }',
    '    float t = clamp(p.y / uLevel, 0.0, 1.0);',
    '    vec2 sp = vec2(uView.x * 0.78, uLevel * 0.3);',
    '    float sd = length(p - sp) / (uView.y * 0.07);',
    '    float cl = fbm(vec2(p.x * 0.012 + uTime * 0.02, p.y * 0.03)) * smoothstep(uLevel * 0.6, uLevel * 0.1, p.y);',
    '    float far = ridge(p.x + uTime * 1.5, 0.006, uLevel - uView.y * 0.03, uView.y * 0.2);',
    '    float near = ridge(p.x + uTime * 4.0 + 300.0, 0.011, uLevel + 2.0, uView.y * 0.12);',
    '    if (isStyle(5.0)) {',
    '      col = uPaper;',
    '      float ink = max(lineAA(sd - 1.0, sd, 1.3, 0.05), lineAA(cl - 0.6, cl, 1.2, 0.01));',
    '      if (p.y > far) { ink = step(0.93, hash(floor(gl_FragCoord.xy))) * 0.6; }',
    '      if (p.y > near) { ink = hatch(0.5, gl_FragCoord.xy) * 0.5; }',
    '      ink = max(ink, max(lineAA(p.y - far, p.y, 1.2, 0.8), lineAA(p.y - near, p.y, 1.4, 0.9)));',
    '      col = mix(uPaper, uInk, ink);',
    '    } else if (smoothStyle()) {',
    '      col = mix(uSkyTop, uSkyHor, t * t);',
    '      col = mix(col, uSunCol, clamp(smoothstep(1.05, 0.95, sd) + 0.3 * exp(-sd * 1.1), 0.0, 1.0));',
    '      col = mix(col, mix(vec3(1.0), uSkyHor, 0.2), smoothstep(0.55, 0.78, cl) * 0.85);',
    '      if (p.y > far) col = mix(uSkyHor, uGrass, 0.35);',
    '      if (p.y > near) col = mix(uSkyHor, uGrass, 0.75) * (0.92 + 0.12 * noise(p * 0.15));',
    '    } else {',
    '      col = mix(uSkyTop, uSkyHor, band(t, 4.0));',
    '      col = mix(col, uSunCol, step(sd, 1.0));',
    '      col = mix(col, vec3(1.0), step(0.6, cl));',
    '      vec3 farC = mix(uSkyHor, uGrass, 0.4), nearC = uGrass;',
    '      if (p.y > far) col = farC;',
    '      if (p.y > near) col = nearC;',
    '      if (isStyle(1.0)) col = mix(col, uGrass * 0.55, lineAA(p.y - near, p.y, 2.0, 1.0));',
    '      if (isStyle(3.0) && p.y > far && p.y <= near) col *= 0.94 + 0.08 * hash(vec2(floor((p.x + uTime * 1.5) * 0.006 / 0.3 * 1.0), 1.0));',
    '    }',
    '  } else {',
    '    float d = p.y - ys;                                               // depth below the surface',
    '    float bottom = uView.y - 9.0 - 7.0 * fbm(vec2(p.x * 0.02, 1.0));',
    '    float k = 1.0 - exp(-d / (uView.y * 0.25));',
    '    float slope = surf(p.x + 2.0) - surf(p.x - 2.0);',
    '    float cap = smoothstep(uRange * 0.16, uRange * 0.4, hs) + smoothstep(1.4, 3.0, abs(slope)) * 0.7;',
    '    float edge = 1.0 - step(isStyle(2.0) ? uPxU : 1.6, d);',
    '    if (isStyle(5.0)) {',
    '      col = mix(uPaper, uInk, hatch(0.25 + k * 0.7, gl_FragCoord.xy) * 0.5);',
    '      float row = floor((d - 4.0) / 6.0);',
    '      float dash = step(0.55, noise(vec2(p.x * 0.06 + row * 13.0 - uTime * 0.4, row))) * step(row, 1.5) * step(0.0, row);',
    '      col = mix(col, uInk, lineAA(fract((d - 4.0) / 6.0) - 0.5, d / 6.0, 1.0, 0.08) * dash * 0.8);',
    '      col = mix(col, uInk, lineAA(d, d, 1.6, 1.0));',
    '      col = mix(col, uPaper, clamp(cap, 0.0, 1.0) * step(0.6, d) * (1.0 - step(4.0, d)));',
    '      if (p.y > bottom) col = mix(uPaper, uInk, max(step(0.85, hash(floor(gl_FragCoord.xy))) * 0.7, lineAA(p.y - bottom, p.y, 1.2, 0.8)));',
    '    } else if (smoothStyle()) {',
    '      col = mix(uShallow, uDeep, k);',
    '      float rays = smoothstep(0.55, 0.9, noise(vec2((p.x + p.y * 0.45) * 0.035 - uTime * 0.2, 1.0))) * (1.0 - k);',
    '      float caust = smoothstep(0.62, 0.8, noise(vec2(p.x * 0.09 + uTime * 0.6, p.y * 0.09 - uTime * 0.3))) * exp(-d / 25.0);',
    '      col += (rays * 0.12 + caust * 0.18) * uSunCol;',
    '      vec2 bq = vec2(p.x * 0.06, p.y * 0.06 + uTime * 1.2), bi = floor(bq);',
    '      float bub = step(0.93, hash(bi)) * (1.0 - smoothstep(0.12, 0.2, length(fract(bq) - 0.5))) * step(4.0, d);',
    '      col = mix(col, uFoamCol, bub * 0.5);',
    '      col = mix(col, mix(uShallow, uFoamCol, 0.6), edge);',
    '      col = mix(col, uFoamCol, clamp(cap, 0.0, 1.0) * (1.0 - step(5.0, d)) * step(0.4, noise(vec2(p.x * 0.3, uTime * 2.0))));',
    '      if (p.y > bottom) col = mix(uSand, uDeep, 0.35 + 0.3 * noise(p * 0.2)) + caust * 0.1 * uSunCol;',
    '    } else {',
    '      if (isStyle(3.0)) {                                               // triangle facets',
    '        vec2 q = vec2(p.x, d) / 22.0, c0 = floor(q), f = fract(q); float tri = step(1.0, f.x + f.y);',
    '        vec2 cen = (c0 + mix(vec2(1.0 / 3.0), vec2(2.0 / 3.0), tri)) * 22.0;',
    '        col = mix(uShallow, uDeep, 1.0 - exp(-max(cen.y, 0.0) / (uView.y * 0.25))) * (0.95 + 0.1 * hash(c0 + tri * 7.3));',
    '      } else {',
    '        col = mix(uShallow, uDeep, band(k, isStyle(2.0) ? 4.0 : 3.0));',
    '        float shaft = step(0.78, fract((p.x + p.y * 0.6) / 70.0 - uTime * 0.04)) * (1.0 - k);',
    '        col = mix(col, uShallow, step(0.5, shaft) * (isStyle(2.0) ? 1.0 : 0.45));',
    '      }',
    '      vec2 bq = vec2(p.x * 0.05, p.y * 0.05 + uTime * 1.0), bi = floor(bq);',
    '      vec2 bf = abs(fract(bq) - 0.5);',
    '      float bub = step(0.95, hash(bi)) * step(max(bf.x, bf.y), isStyle(2.0) ? 0.5 * uPxU * 0.05 + 0.04 : 0.12) * step(6.0, d);',
    '      col = mix(col, uFoamCol, bub * 0.8);',
    '      col = mix(col, isStyle(2.0) ? uFoamCol : mix(uShallow, uFoamCol, 0.75), edge);',
    '      col = mix(col, uFoamCol, step(0.5, cap) * (1.0 - step(isStyle(2.0) ? uPxU * 2.0 : 4.0, d)));',
    '      if (p.y > bottom) col = mix(uSand, uDeep, isStyle(2.0) ? 0.45 : 0.35 + 0.12 * step(0.6, noise(p * 0.15)));',
    '    }',
    '  }',
    '  gl_FragColor = vec4(col, alpha);',
    '}'
  ].join('\n');

  // ---- 2D top down: land and water in one pass ------------------------------------------
  var FS_TOP = [
    'varying vec2 vUv;',
    'uniform sampler2D uSim; uniform sampler2D uMap;',
    'uniform vec2 uSimSize; uniform vec4 uViewRect; uniform vec2 uWorld; uniform vec2 uWind; uniform float uScenery;',
    'uniform vec3 uDeep, uShallow, uFoamCol, uSunCol, uSand, uGrass, uSunDir;',
    'float simH(vec2 uv) { return texture2D(uSim, uv).r * 2.0 - 1.0; }',
    'float landAt(vec2 w) { return clamp((texture2D(uMap, w / uWorld).r - 0.5) * 2.0, -1.0, 1.0); }',
    'void main() {',
    '  vec2 w = uViewRect.xy + vec2(vUv.x, 1.0 - vUv.y) * uViewRect.zw;    // world units, y down',
    '  float facet = 0.0;',
    '  if (isStyle(3.0)) {                                                 // sample everything at triangle centres',
    '    vec2 q = w / 2.4, c0 = floor(q), f = fract(q); float tri = step(1.0, f.x + f.y);',
    '    facet = hash(c0 + tri * 7.3);',
    '    w = (c0 + mix(vec2(1.0 / 3.0), vec2(2.0 / 3.0), tri)) * 2.4;',
    '  }',
    '  vec2 uv = w / uWorld;',
    '  vec4 m = texture2D(uMap, uv);',
    '  float dist = m.g * 24.0, ldist = m.b * 8.0;                        // distance to land / to water, world units',
    '  vec3 col;',
    '  if (m.r > 0.25) {',
    '    if (uScenery < 0.5) { gl_FragColor = vec4(0.0); return; }',
    '    float h = clamp((m.r - 0.5) * 2.0, 0.0, 1.0), n = fbm(w * 0.4);',
    '    float g = h + (n - 0.5) * 0.15;                                   // grass above about 0.18',
    '    vec2 tc = floor(w / 4.0), tp = (tc + 0.3 + 0.4 * vec2(hash(tc), hash(tc + 9.1))) * 4.0;',
    '    float tr = 1.2 + 0.5 * hash(tc + 3.3), td = length(w - tp) / tr;',
    '    float tree = step(0.55, hash(tc + 5.7)) * step(0.4, landAt(tp)) * step(0.4, landAt(tp + vec2(tr, 0.0))) * step(0.4, landAt(tp - vec2(tr, 0.0)));',
    '    float inTree = tree * step(td, 1.0);',
    '    float shadow = tree * step(length(w - tp - vec2(0.45, 0.55) * tr) / tr, 1.0) * (1.0 - inTree);',
    '    if (isStyle(5.0)) {',
    '      float ink = max(lineAA(ldist - 0.15, ldist, 1.6, 0.3), lineAA(g - 0.18, g, 1.0, 0.02) * 0.6);',
    '      ink = max(ink, step(0.18, g) * step(0.9, hash(floor(gl_FragCoord.xy))) * 0.6);',
    '      ink = max(ink, tree * lineAA((td - 1.0) * tr, td * tr, 1.3, 0.25));',
    '      ink = max(ink, shadow * hatch(0.5, gl_FragCoord.xy) * 0.6);',
    '      col = mix(uPaper, uInk, ink);',
    '      if (inTree > 0.5 && td < 0.97) col = mix(uPaper, uInk, step(0.75, hash(floor(gl_FragCoord.xy))) * 0.5);',
    '    } else if (smoothStyle()) {',
    '      col = mix(uSand, uGrass, smoothstep(0.15, 0.24, g)) * (0.86 + 0.28 * n);',
    '      col = mix(col, uSand * 0.72, (1.0 - smoothstep(0.0, 1.0, ldist)) * (1.0 - step(0.2, g)));     // wet sand',
    '      col *= 1.0 - shadow * 0.28;',
    '      col = mix(col, uGrass * (0.5 + 0.35 * smoothstep(1.0, 0.0, length(w - tp + vec2(0.35, 0.4) * tr) / tr)), inTree);',
    '    } else {',
    '      col = step(0.18, g) > 0.5 ? uGrass : uSand;',
    '      if (isStyle(3.0)) {                                               // hill shading per facet',
    '        vec2 gr = vec2(landAt(w + vec2(1.2, 0.0)) - landAt(w - vec2(1.2, 0.0)), landAt(w + vec2(0.0, 1.2)) - landAt(w - vec2(0.0, 1.2)));',
    '        col *= 0.8 + 0.35 * max(dot(normalize(vec3(-gr.x * 3.0, 1.0, -gr.y * 3.0)), uSunDir), 0.0) + 0.08 * facet;',
    '      }',
    '      col = mix(col, uSand * 0.8, (1.0 - step(isStyle(2.0) ? 0.6 : 0.5, ldist)) * (1.0 - step(0.18, g)));',
    '      col *= 1.0 - shadow * 0.25;',
    '      col = mix(col, uGrass * (length(w - tp + vec2(0.3, 0.35) * tr) / tr < 0.55 ? 0.85 : 0.62), inTree);',
    '      if (isStyle(1.0)) col = mix(col, vec3(0.08, 0.12, 0.2), max(lineAA(ldist - 0.12, ldist, 1.8, 0.25), tree * lineAA((td - 1.0) * tr, td * tr, 1.6, 0.25)) * 0.7);',
    '    }',
    '  } else {',
    '    vec2 e = 1.0 / uSimSize;',
    '    float hc = simH(uv);',
    '    float hx = simH(uv + vec2(e.x, 0.0)) - simH(uv - vec2(e.x, 0.0)), hy = simH(uv + vec2(0.0, e.y)) - simH(uv - vec2(0.0, e.y));',
    '    vec2 wp = w * 0.6 + uWind * uTime;                                // wind ripples on top of the simulation',
    '    float r1 = noise(wp) - noise(wp + vec2(0.6, 0.0)), r2 = noise(wp * 1.7 + 3.0) - noise(wp * 1.7 + vec2(3.0, 0.6));',
    '    vec3 N = normalize(vec3(-(hx * 2.5 + r1 * 0.3), 1.0, -(hy * 2.5 + r2 * 0.3)));',
    '    float depth = smoothstep(0.0, 12.0, dist);',
    '    float diff = max(dot(N, uSunDir), 0.0);',
    '    float spec = pow(max(dot(N, normalize(uSunDir + vec3(0.0, 1.0, 0.0))), 0.0), 140.0);',
    '    float caust = smoothstep(0.6, 0.85, noise(w * 0.5 + vec2(uTime * 0.4, -uTime * 0.3)) * 0.6 + noise(w * 0.9 - uTime * 0.5) * 0.4) * (1.0 - depth);',
    '    float phase = fract(dist * 0.3 + uTime * 0.25);                   // swells running in to the beach',
    '    float shore = (1.0 - smoothstep(0.0, 5.0, dist)) * smoothstep(0.8, 0.95, phase) * step(0.3, noise(w * 0.7 + uTime * 0.2));',
    '    float rim = 1.0 - smoothstep(0.2, 0.8, dist);',
    '    float churn = smoothstep(0.22, 0.5, abs(hc));                      // a wake or a splash',
    '    float ring = hx + hy;',
    '    if (isStyle(5.0)) {',
    '      float ink = 0.0;',
    '      for (int i = 0; i < 4; i++) {                                    // map-maker\'s water lines along the coast',
    '        float fi = float(i), r = 0.9 + fi * 1.5 + fi * fi * 0.35 + 0.15 * sin(uTime * 0.8 + fi);',
    '        ink = max(ink, lineAA(dist - r, dist, 1.1, 0.22) * (1.0 - fi * 0.2));',
    '      }',
    '      ink = max(ink, iso(hc, 0.18, 1.0, 0.02) * smoothstep(0.04, 0.12, abs(hc)));',
    '      ink = max(ink, step(0.997, spec) * 0.8);',
    '      col = mix(uPaper, uInk, ink * 0.9);',
    '    } else if (smoothStyle()) {',
    '      col = mix(uShallow, uDeep, depth) * (0.72 + 0.38 * diff) + caust * 0.25 * uSunCol + spec * 0.8 * uSunCol;',
    '      col = mix(col, uFoamCol, clamp(shore + rim + churn * 0.85, 0.0, 1.0));',
    '    } else if (isStyle(3.0)) {',
    '      col = mix(uShallow, uDeep, depth) * (0.8 + 0.32 * diff) * (0.93 + 0.14 * facet);',
    '      col = mix(col, uFoamCol, step(0.5, shore + rim + churn));',
    '    } else {',
    '      float px = isStyle(2.0) ? 1.0 : 0.0;',
    '      col = mix(uShallow, uDeep, band(smoothstep(0.0, 18.0, dist), 3.0));',
    '      col = mix(col, isStyle(2.0) ? uShallow : uShallow * 1.15, step(0.5, caust) * mix(0.45, 1.0, px));',
    '      col = mix(col, mix(col, uFoamCol, mix(0.45, 1.0, px)), step(0.12, ring));',
    '      col = mix(col, mix(col, uDeep, mix(0.5, 1.0, px)), step(ring, -0.12));',
    '      col = mix(col, uFoamCol, max(step(0.5, spec), step(0.5, shore + rim + churn)));',
    '    }',
    '  }',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  // ---- 2D sprites: crates, barrels, ducks, boats, spray ------------------------------------
  var VS_SPRITE = VS_HEAD + [
    'attribute vec2 aPos;',
    'uniform vec4 uViewRect; uniform vec2 uCenter; uniform vec2 uSize; uniform float uAngle;',
    'varying vec2 vL;',
    'void main() { vL = aPos; vec2 q = aPos * uSize * 0.5; float c = cos(uAngle), s = sin(uAngle);',
    '  vec2 w = uCenter + vec2(c * q.x - s * q.y, s * q.x + c * q.y) - uViewRect.xy;',
    '  gl_Position = vec4(w.x / uViewRect.z * 2.0 - 1.0, 1.0 - w.y / uViewRect.w * 2.0, 0.0, 1.0); }'
  ].join('\n');
  var FS_SPRITE = [
    'varying vec2 vL; uniform float uKind; uniform vec3 uColor; uniform vec3 uColor2; uniform float uAA;',
    'float edge(float d) { return uAA > 0.0 ? 1.0 - smoothstep(-uAA, uAA, d) : step(d, 0.0); }',
    'float box(vec2 p, vec2 b) { vec2 d = abs(p) - b; return max(d.x, d.y); }',
    'void main() {',
    '  vec2 p = vL; float k = uKind; vec3 col = uColor; float d = 1.0; float line = 0.0;   // p.y > 0 is down',
    '  if (k < 0.5) {                                                       // crate',
    '    d = box(p, vec2(0.94));',
    '    float frame = step(0.7, max(abs(p.x), abs(p.y))) + step(abs(p.x - p.y), 0.14) + step(abs(p.x + p.y), 0.14);',
    '    col = mix(uColor, uColor * 0.62, clamp(frame, 0.0, 1.0));',
    '  } else if (k < 1.5) {                                                // barrel',
    '    d = max(box(p, vec2(0.82, 0.95)), length(p * vec2(0.85, 0.55)) - 0.9);',
    '    col = mix(uColor * (1.0 - 0.25 * abs(p.x)), uColor2, step(abs(abs(p.y) - 0.5), 0.1));',
    '  } else if (k < 2.5) {                                                // rubber duck',
    '    float body = (length((p - vec2(-0.05, 0.25)) * vec2(1.0, 1.6)) - 0.75) * 0.8;',
    '    float head = length(p - vec2(0.38, -0.38)) - 0.36;',
    '    float beak = box(p - vec2(0.82, -0.32), vec2(0.18, 0.08));',
    '    d = min(min(body, head), beak);',
    '    col = beak < 0.0 ? vec3(1.0, 0.45, 0.1) : uColor;',
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
    '    col = deck < 0.0 ? uColor2 : uColor;',
    '    if (box(p - vec2(0.0, 0.38), vec2(0.2, 0.16)) < 0.0) col = vec3(0.92);',
    '  } else {                                                             // a drop of spray',
    '    d = length(p) - 0.9;',
    '  }',
    '  float a = edge(d);',
    '  if (a <= 0.01) discard;',
    '  line = smoothstep(-0.16, -0.06, d);',
    '  if (isStyle(5.0)) col = mix(uPaper, uInk, max(line, k > 4.5 ? 0.0 : hatch(0.45, gl_FragCoord.xy) * 0.35));',
    '  else if (isStyle(1.0) && k < 4.5) col = mix(col, vec3(0.06, 0.08, 0.14), line);',
    '  gl_FragColor = vec4(col, a);',
    '}'
  ].join('\n');

  // ---- post: palette + ordered dithering at low resolution, then a crisp upscale ----------
  var FS_QUANT = [
    'varying vec2 vUv; uniform sampler2D uTex;',
    'uniform vec3 uPal[16]; uniform float uPalN; uniform float uDither; uniform float uBits;',
    'float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }',
    'float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }',
    'vec3 ycc(vec3 c) { return vec3(dot(c, vec3(0.299, 0.587, 0.114)), c.r - c.b, c.g - 0.5 * (c.r + c.b)) * vec3(1.4, 0.7, 0.9); }',
    'void main() {',
    '  vec4 src = texture2D(uTex, vUv); vec3 c = src.rgb;',
    '  float b = bayer4(gl_FragCoord.xy);                                  // 0 .. 15/16',
    '  if (uBits > 0.0) { float lv = exp2(uBits) - 1.0; c = floor(c * lv + 0.5 + (b - 0.47) * uDither) / lv; }',
    '  if (uPalN > 0.0) {',
    '    vec3 q = ycc(c), c1 = uPal[0], c2 = uPal[0]; float d1 = 1e9, d2 = 1e9;',
    '    for (int i = 0; i < 16; i++) {',
    '      if (float(i) >= uPalN) break;',
    '      vec3 e = ycc(uPal[i]) - q; float dd = dot(e, e);',
    '      if (dd < d1) { d2 = d1; c2 = c1; d1 = dd; c1 = uPal[i]; } else if (dd < d2) { d2 = dd; c2 = uPal[i]; }',
    '    }',
    // how far towards the second-nearest colour (0 .. 0.5); dither only the middle of each transition
    '    float t = sqrt(d1) / max(sqrt(d1) + sqrt(d2), 1e-5);',
    '    t = clamp((t - 0.5) / max(uDither, 1e-3) + 0.5, 0.0, 1.0);',
    '    t = floor(t * 4.0 + 0.5) / 4.0;                                     // clean patterns: none, 1 in 4, checkerboard',
    '    c = (b < t) ? c2 : c1;',
    '  }',
    '  gl_FragColor = vec4(c, src.a);',
    '}'
  ].join('\n');
  var FS_BLIT = [
    'varying vec2 vUv; uniform sampler2D uTex; uniform vec2 uUvScale; uniform float uScan; uniform float uPx;',
    'void main() {',
    '  vec4 c = texture2D(uTex, vUv * uUvScale);',
    '  if (uScan > 0.0) {                                                  // a dark line under every low-res row, and an aperture grille',
    '    float row = uPx > 1.5 ? step(fract((gl_FragCoord.y - 0.5) / uPx), 0.34) : step(0.5, fract(gl_FragCoord.y * 0.5));',
    '    c.rgb *= 1.0 - uScan * (0.45 * row + 0.12 * step(0.66, fract(gl_FragCoord.x / 3.0)));',
    '  }',
    '  gl_FragColor = vec4(c.rgb * c.a, c.a);',
    '}'
  ].join('\n');

  // ======================================================================================
  function WaterLite(canvas, opts) {
    opts = opts || {};
    this.canvas = canvas;
    var attrs = { antialias: false, alpha: !!opts.transparent, depth: true, stencil: false, powerPreference: 'low-power', preserveDrawingBuffer: !!opts.preserveDrawingBuffer };
    var gl = canvas.getContext('webgl', attrs) || canvas.getContext('experimental-webgl', attrs);
    if (!gl) throw new Error('WebGL is not available');
    this.gl = gl;
    this.deriv = !!gl.getExtension('OES_standard_derivatives');
    this.opts = {};
    for (var k in DEFAULTS) this.opts[k] = DEFAULTS[k];
    this.time = 0;
    this.cam = { yaw: 0.6, pitch: 0.22, dist: 24, target: [0, 0, 0], fov: 55 * Math.PI / 180, auto: true };
    this.floaters = []; this.drops = []; this.trail = [];
    this.input = { up: false, down: false, left: false, right: false };
    this.stats = { lowW: 0, lowH: 0, px: 1 };
    this._initGL();
    this.setOptions(opts);
  }
  WaterLite.PALETTES = PALETTES; WaterLite.STYLES = STYLES; WaterLite.QUALITY = QUALITY; WaterLite.THEMES = THEMES; WaterLite.DEFAULTS = DEFAULTS;
  WaterLite.version = '1.0.0';

  WaterLite.prototype._prog = function (vs, fsBody, name, isFragFull) {
    var gl = this.gl;
    var fs = isFragFull ? fsBody : (this.deriv ? '#extension GL_OES_standard_derivatives : enable\n#define HAS_DERIV 1\n' : '') + FS_HEAD + COMMON + fsBody;
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

  WaterLite.prototype._initGL = function () {
    var gl = this.gl;
    this.prog = {
      sky: this._prog(VS_QUAD, FS_SKY, 'sky'),
      sea: this._prog(VS_SEA, FS_SEA, 'sea'),
      obj: this._prog(VS_OBJ, FS_OBJ, 'objects'),
      side: this._prog(VS_QUAD, FS_SIDE, 'side'),
      top: this._prog(VS_QUAD, FS_TOP, 'top'),
      sprite: this._prog(VS_SPRITE, FS_SPRITE, 'sprite'),
      quant: this._prog(VS_QUAD, FS_HEAD + FS_QUANT, 'quantize', true),
      blit: this._prog(VS_QUAD, FS_HEAD + FS_BLIT, 'blit', true)
    };
    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    this.tex = {}; this.fbos = {};
    this.meshes = {
      crate: this._boxMesh([0.62, 0.43, 0.24]),
      barrel: this._boxMesh([0.2, 0.4, 0.62]),
      buoy: this._boxMesh([0.9, 0.22, 0.14]),
      boat: this._boatMesh()
    };
  };

  WaterLite.prototype._mesh = function (pos, nrm, col) {
    var gl = this.gl, b = gl.createBuffer(), n = pos.length / 3, data = new Float32Array(n * 9);
    for (var i = 0; i < n; i++) for (var j = 0; j < 3; j++) { data[i * 9 + j] = pos[i * 3 + j]; data[i * 9 + 3 + j] = nrm[i * 3 + j]; data[i * 9 + 6 + j] = col[i * 3 + j]; }
    gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return { buf: b, count: n };
  };
  WaterLite.prototype._boxMesh = function (c) {
    var pos = [], nrm = [], col = [];
    [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].forEach(function (n) {
      var u = [n[1], n[2], n[0]], v = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
      var tone = n[1] > 0 ? 1.1 : 1;
      [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]].forEach(function (q) {
        for (var j = 0; j < 3; j++) pos.push(0.5 * (n[j] + q[0] * u[j] + q[1] * v[j]));
        nrm.push(n[0], n[1], n[2]); col.push(c[0] * tone, c[1] * tone, c[2] * tone);
      });
    });
    return this._mesh(pos, nrm, col);
  };
  WaterLite.prototype._boatMesh = function () {
    var pos = [], nrm = [], col = [];
    function tri(a, b, c, color) {
      var e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      var n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], l = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]) || 1;
      [a, b, c].forEach(function (p) { pos.push(p[0], p[1], p[2]); nrm.push(n[0] / l, n[1] / l, n[2] / l); col.push(color[0], color[1], color[2]); });
    }
    var hull = [0.85, 0.85, 0.82], red = [0.7, 0.12, 0.1], deck = [0.55, 0.38, 0.22], sail = [0.95, 0.94, 0.88];
    var B = [2.2, 0.5, 0], S1 = [-1.6, 0.5, 0.8], S2 = [-1.6, 0.5, -0.8], K = [1.0, -0.4, 0], K2 = [-1.5, -0.3, 0], M1 = [0.3, 0.5, 0.9], M2 = [0.3, 0.5, -0.9];
    tri(B, M1, K, hull); tri(B, K, M2, hull); tri(M1, S1, K2, red); tri(M1, K2, K, red); tri(M2, K, K2, red); tri(M2, K2, S2, red);
    tri(S1, S2, K2, hull);
    tri(B, M2, M1, deck); tri(M1, M2, S2, deck); tri(M1, S2, S1, deck);
    tri([0.2, 0.5, -0.05], [0.2, 4.2, 0], [0.2, 0.5, 0.05], deck); tri([0.2, 0.5, 0.05], [0.2, 4.2, 0], [0.2, 0.5, -0.05], deck);
    tri([0.25, 0.9, 0], [0.25, 4.0, 0], [-1.4, 0.9, 0], sail); tri([0.25, 0.9, 0], [-1.4, 0.9, 0], [0.25, 4.0, 0], sail);
    return this._mesh(pos, nrm, col);
  };

  // ---- options ---------------------------------------------------------------------------
  WaterLite.prototype.setOptions = function (o) {
    o = o || {};
    var prev = {}, k;
    for (k in this.opts) prev[k] = this.opts[k];
    for (k in o) if (o[k] !== undefined && k in DEFAULTS) this.opts[k] = o[k];
    var op = this.opts, st = STYLES[op.style] || STYLES.realistic, th = THEMES[op.style] || THEMES.realistic, c = op.colors || {};
    this.style = st;
    this.colors = {};
    for (k in th) this.colors[k] = hex(c[k] || th[k]);
    this.pixelSize = op.pixelSize > 0 ? op.pixelSize : st.pixel;
    this.palName = op.palette === 'auto' ? st.palette : op.palette;
    this.dither = op.dither >= 0 ? op.dither : st.dither;
    var el = op.sunElevation * Math.PI / 180, az = op.sunAzimuth * Math.PI / 180;
    this.sunDir = [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)];
    this.q = QUALITY[op.quality] || QUALITY.low;
    var waveKeys = ['quality', 'wind', 'windDir', 'waveHeight', 'choppiness', 'seed'];
    if (!this.waves || waveKeys.some(function (key) { return prev[key] !== op[key]; })) this._buildWaves();
    var gridKey = op.quality + (op.style === 'lowpoly' ? '/facets' : '');
    if (this._gridKey !== gridKey) { this._gridKey = gridKey; this._buildGrid(op.style === 'lowpoly' ? 46 : this.q.grid); }
    var fresh = !this._ready, modeChanged = prev.mode !== op.mode || fresh, qChanged = prev.quality !== op.quality;
    if (op.mode === 'side' && (modeChanged || qChanged || prev.floaters !== op.floaters)) this._initSide();
    if (op.mode === 'top' && (modeChanged || qChanged || prev.seed !== op.seed || prev.land !== op.land || prev.boat !== op.boat || prev.floaters !== op.floaters)) this._initTop();
    if (op.mode === '3d' && (modeChanged || prev.boat !== op.boat || prev.floaters !== op.floaters)) this._initThree();
    this._ready = true;
    return this;
  };

  // A few Gerstner waves drawn from a Pierson-Moskowitz spectrum for the wind speed.
  WaterLite.prototype._buildWaves = function () {
    var o = this.opts, n = this.q.waves, R = rng(o.seed * 7919 + 13), U = Math.max(o.wind, 0.5);
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
      wv.q = chop / Math.max(wv.k * wv.a * n, 1e-4);      // steepness shared out so crests never loop over
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
    var t = this.time, W = this.waves, px = x, pz = z, i, wv, th;
    for (var it = 0; it < 3; it++) {                       // undo the sideways motion to find the source point
      var ox = 0, oz = 0;
      for (i = 0; i < W.length; i++) { wv = W[i]; th = wv.k * (wv.dx * px + wv.dz * pz) - wv.w * t + wv.ph; var c = Math.cos(th) * wv.q * wv.a; ox += wv.dx * c; oz += wv.dz * c; }
      px = x - ox; pz = z - oz;
    }
    var h = 0, nx = 0, nz = 0, ny = 1;
    for (i = 0; i < W.length; i++) {
      wv = W[i]; th = wv.k * (wv.dx * px + wv.dz * pz) - wv.w * t + wv.ph;
      var s = Math.sin(th), cc = Math.cos(th), wa = wv.k * wv.a;
      h += wv.a * s; nx -= wv.dx * wa * cc; nz -= wv.dz * wa * cc; ny -= wv.q * wa * s;
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
  WaterLite.prototype._initThree = function () {
    this.floaters = []; this.trail = [];
    if (this.opts.floaters) {
      var R = rng(this.opts.seed + 3), kinds = ['crate', 'crate', 'barrel', 'crate', 'buoy', 'barrel'];
      for (var i = 0; i < kinds.length; i++) {
        var a = i / kinds.length * 6.283 + R(), r = 5 + R() * 9;
        this.addFloater(Math.cos(a) * r, Math.sin(a) * r, { kind: kinds[i] });
      }
    }
    this.boat3d = this.opts.boat ? { x: 0, z: -16, heading: 0, speed: 4.5, y: 0, tilt: [0, 0] } : null;
  };
  WaterLite.prototype._update3d = function (dt) {
    var self = this;
    this.floaters.forEach(function (f) {
      var s = self.sample(f.x, f.z), target = s.height - f.size[1] * 0.5 * (f.density * 2 - 1);
      f.vy += ((target - f.y) * 30 - f.vy * 4.5 - (f.y > s.height + 0.2 ? 9.81 : 0)) * dt;   // springy float, falls when airborne
      f.y += f.vy * dt;
      f.tilt[0] += (s.normal[2] * 1.2 - f.tilt[0]) * Math.min(dt * 4, 1);
      f.tilt[1] += (-s.normal[0] * 1.2 - f.tilt[1]) * Math.min(dt * 4, 1);
      f.x += s.normal[0] * dt * 0.8; f.z += s.normal[2] * dt * 0.8;           // drifts down the slopes
    });
    var b = this.boat3d;
    if (b) {
      b.heading += dt * 0.22;
      b.x += Math.cos(b.heading) * b.speed * dt; b.z += Math.sin(b.heading) * b.speed * dt;
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
    if (this.cam.auto) this.cam.yaw += dt * 0.04;
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
  function model(x, y, z, yaw, tx, tz, sx, sy, sz) {     // translate * Ry(yaw) * Rx(tx) * Rz(tz) * scale
    var cy = Math.cos(yaw), sy2 = Math.sin(yaw), cx = Math.cos(tx), sxx = Math.sin(tx), cz = Math.cos(tz), szz = Math.sin(tz);
    var Ry = [cy, 0, -sy2, 0, 0, 1, 0, 0, sy2, 0, cy, 0, 0, 0, 0, 1], Rx = [1, 0, 0, 0, 0, cx, sxx, 0, 0, -sxx, cx, 0, 0, 0, 0, 1], Rz = [cz, szz, 0, 0, -szz, cz, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    var o = mul(mul(Ry, mul(Rx, Rz)), [sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, sz, 0, 0, 0, 0, 1]);
    o[12] = x; o[13] = y; o[14] = z; return o;
  }
  WaterLite.prototype._eye = function () {
    var c = this.cam, cp = Math.cos(c.pitch);
    return [c.target[0] + c.dist * cp * Math.cos(c.yaw), c.target[1] + c.dist * Math.sin(c.pitch), c.target[2] + c.dist * cp * Math.sin(c.yaw)];
  };
  WaterLite.prototype._render3d = function (w, h) {
    var gl = this.gl, c = this.cam, C = this.colors, self = this;
    var eye = this._eye(), L = lookAt(eye, c.target), VP = mul(persp(c.fov, w / h, 0.3, 2000), L.m);
    var radius = 420, fogR = 420, snap = this.style.snap ? 1 : 0;
    var p = this.prog.sky;
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(p.p); this._quadAttrib(); this._common(p);
    gl.uniform3fv(p.loc('uRight'), L.r); gl.uniform3fv(p.loc('uUp'), L.u); gl.uniform3fv(p.loc('uFwd'), L.f);
    var ty = Math.tan(c.fov / 2); gl.uniform2f(p.loc('uTan'), ty * w / h, ty);
    gl.uniform3fv(p.loc('uSunDir'), this.sunDir); gl.uniform3fv(p.loc('uSkyTop'), C.skyTop); gl.uniform3fv(p.loc('uSkyHor'), C.skyHorizon); gl.uniform3fv(p.loc('uSunCol'), C.sun);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    p = this.prog.sea; gl.useProgram(p.p); this._common(p);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.grid.vb); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.grid.ib);
    var facets = this.opts.style === 'lowpoly', cell = facets ? 6 : radius / this.grid.n;
    gl.uniformMatrix4fv(p.loc('uViewProj'), false, VP);
    gl.uniform2f(p.loc('uCenter'), Math.round(c.target[0] / cell) * cell, Math.round(c.target[2] / cell) * cell);
    gl.uniform1f(p.loc('uGridR'), radius); gl.uniform1f(p.loc('uGridPow'), facets ? 1.6 : 2.0); gl.uniform1f(p.loc('uWaveTime'), this.time);
    gl.uniform4fv(p.loc('uWA'), this.waveA); gl.uniform4fv(p.loc('uWB'), this.waveB); gl.uniform1f(p.loc('uWaveCount'), this.waves.length);
    gl.uniform1f(p.loc('uSnap'), snap); gl.uniform2f(p.loc('uRes'), w, h);
    gl.uniform3fv(p.loc('uCamPos'), eye); gl.uniform3fv(p.loc('uSunDir'), this.sunDir);
    gl.uniform3fv(p.loc('uDeep'), C.deep); gl.uniform3fv(p.loc('uShallow'), C.shallow); gl.uniform3fv(p.loc('uFoamCol'), C.foam);
    gl.uniform3fv(p.loc('uSkyTop'), C.skyTop); gl.uniform3fv(p.loc('uSkyHor'), C.skyHorizon); gl.uniform3fv(p.loc('uSunCol'), C.sun);
    gl.uniform1f(p.loc('uFoam'), this.opts.foam); gl.uniform1f(p.loc('uAmp'), this.amp); gl.uniform1f(p.loc('uFogR'), fogR);
    var tr = new Float32Array(32);
    for (var i = 0; i < this.trail.length && i < 8; i++) { var t = this.trail[i]; tr.set([t.x, t.z, Math.max(t.life, 0), 1.2 + (1 - t.life) * 2.5], i * 4); }
    gl.uniform4fv(p.loc('uTrail'), tr);
    gl.drawElements(gl.TRIANGLES, this.grid.count, gl.UNSIGNED_SHORT, 0);

    p = this.prog.obj; gl.useProgram(p.p); this._common(p);
    gl.uniformMatrix4fv(p.loc('uViewProj'), false, VP); gl.uniform1f(p.loc('uSnap'), snap); gl.uniform2f(p.loc('uRes'), w, h);
    gl.uniform3fv(p.loc('uSunDir'), this.sunDir); gl.uniform3fv(p.loc('uSkyHor'), C.skyHorizon); gl.uniform3fv(p.loc('uCamPos'), eye); gl.uniform1f(p.loc('uFogR'), fogR);
    var pa = p.attr('aPos'), pn = p.attr('aNormal'), pc = p.attr('aColor');
    function draw(mesh, M) {
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buf);
      gl.enableVertexAttribArray(pa); gl.vertexAttribPointer(pa, 3, gl.FLOAT, false, 36, 0);
      if (pn >= 0) { gl.enableVertexAttribArray(pn); gl.vertexAttribPointer(pn, 3, gl.FLOAT, false, 36, 12); }
      if (pc >= 0) { gl.enableVertexAttribArray(pc); gl.vertexAttribPointer(pc, 3, gl.FLOAT, false, 36, 24); }
      gl.uniformMatrix4fv(p.loc('uModel'), false, M);
      gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
    }
    this.floaters.forEach(function (f) { draw(self.meshes[f.kind] || self.meshes.crate, model(f.x, f.y, f.z, f.yaw, f.tilt[0], f.tilt[1], f.size[0], f.size[1], f.size[2])); });
    if (this.boat3d) { var b = this.boat3d; draw(this.meshes.boat, model(b.x, b.y - 0.15, b.z, -b.heading, b.tilt[0], b.tilt[1], 1, 1, 1)); }
    if (pn >= 0) gl.disableVertexAttribArray(pn);
    if (pc >= 0) gl.disableVertexAttribArray(pc);
  };

  // ---- 2D side view ----------------------------------------------------------------------
  WaterLite.prototype._initSide = function () {
    var cols = Math.round(this.q.sim * 1.25), gl = this.gl;
    this.side = { cols: cols, h: new Float32Array(cols), v: new Float32Array(cols), viewW: 480, viewH: 270, level: 157, range: 64, bytes: new Uint8Array(cols * 2) };
    this.floaters = []; this.drops = [];
    this._sideView();
    if (this.opts.floaters) {
      var S = this.side, self = this;
      [[0.2, 'crate', 22], [0.38, 'duck', 26], [0.55, 'barrel', 18], [0.74, 'boat', 56], [0.9, 'crate', 16]].forEach(function (d) {
        self.addFloater(d[0] * S.viewW, S.level - 4, { kind: d[1], size: d[2] });
      });
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
  WaterLite.prototype._dataTex = function (w, h, filter, format) {
    var gl = this.gl, t = gl.createTexture();
    format = format || gl.RGBA;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, format, w, h, 0, format, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  // a slow swell under the simulated ripples, so the sea is never dead flat
  WaterLite.prototype._swellAt = function (x, t) {
    var o = this.opts, a = Math.min(o.wind / 10, 2.2) * o.waveHeight;
    return a * (3.2 * Math.sin(x * 0.021 - t * 1.25) + 1.6 * Math.sin(x * 0.047 + t * 1.9 + 1.3) + 0.8 * Math.sin(x * 0.11 - t * 3.1 + 0.4));
  };
  WaterLite.prototype._sideCol = function (arr, x) {
    var S = this.side, u = clamp(x / S.viewW, 0, 1) * (S.cols - 1), i = Math.floor(u), f = u - i, j = Math.min(i + 1, S.cols - 1);
    return arr[i] * (1 - f) + arr[j] * f;
  };
  WaterLite.prototype._sideHeight = function (x) { return this._sideCol(this.side.h, x) + this._swellAt(x, this.time); };
  WaterLite.prototype._sideRate = function (x) {    // how fast the surface rises at x (up positive)
    return this._sideCol(this.side.v, x) + (this._swellAt(x, this.time + 0.01) - this._swellAt(x, this.time)) * 100;
  };

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
      f = { kind: kind, x: x, z: y, y: def.y || 0, vy: 0, yaw: def.angle || 0, tilt: [0, 0], density: def.density || 0.5,
        size: def.size ? [def.size, def.size, def.size] : kind === 'buoy' ? [0.8, 1.6, 0.8] : kind === 'barrel' ? [0.7, 1.0, 0.7] : [1.1, 1.1, 1.1] };
    }
    this.floaters.push(f);
    if (this.floaters.length > 40) this.floaters.shift();
    return f;
  };
  WaterLite.prototype.clearFloaters = function () { this.floaters = []; this.drops = []; };

  WaterLite.prototype._updateSide = function (dt) {
    var S = this.side, n = S.cols, h = S.h, v = S.v, i;
    this._sideView();
    // columns on springs that pull back to rest and spread to their neighbours
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
    for (s = 0; s < sub; s++) for (i = 0; i < this.floaters.length; i++) this._float2d(this.floaters[i], sd);
    this._stepDrops(dt, 600);
    var B = S.bytes;
    for (i = 0; i < n; i++) {
      var x = i / (n - 1) * S.viewW, val = Math.round(clamp(((h[i] + this._swellAt(x, this.time)) / S.range * 0.5 + 0.5) * 65535, 0, 65535));
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
      var fb = -g * dA * sub, fbx = -g * dA * sub * slope * 0.5;          // buoyancy, and the push of a sloping surface
      var pvx = f.vx - f.av * ry, pvy = f.vy + f.av * rx;                  // this point's velocity
      var wvy = -0.35 * this._sideRate(px) * Math.exp(-Math.max(py - ys, 0) / 15); // water near the top moves with the surface
      var fx = fbx - 2 * dA * sub * pvx, fy = fb - 2 * dA * sub * (pvy - wvy);
      Fx += fx; Fy += fy; T += rx * fy - ry * fx;
    }
    var frac = subSum / (NX * NY);
    if (f.sub < 0.03 && frac >= 0.03 && f.vy > 140) this.splash(f.x, S.level - this._sideHeight(f.x), Math.min(f.vy * w * 0.0009, 18), w * 0.9);
    f.sub = frac;
    f.vx += Fx / m * dt; f.vy += Fy / m * dt; f.av += T / I * dt;
    f.vx *= 1 - 0.05 * dt; f.av *= 1 - 0.3 * dt;
    f.x += f.vx * dt; f.y += f.vy * dt; f.a += f.av * dt;
    if (frac > 0 && frac < 0.98 && Math.abs(f.vy) > 20) this._push(f.x, -f.vy * dt * 0.06, w * 0.8);   // a bobbing body sends out ripples
    var hw = w * 0.5;
    if (f.x < hw) { f.x = hw; f.vx = Math.abs(f.vx) * 0.4; }
    if (f.x > S.viewW - hw) { f.x = S.viewW - hw; f.vx = -Math.abs(f.vx) * 0.4; }
    if (f.y > S.viewH - 14 - H * 0.3) { f.y = S.viewH - 14 - H * 0.3; f.vy = Math.min(f.vy, 0); }
  };
  WaterLite.prototype._push = function (x, amount, radius) {
    var S = this.side, n = S.cols, i0 = Math.max(0, Math.floor((x - radius) / S.viewW * (n - 1))), i1 = Math.min(n - 1, Math.ceil((x + radius) / S.viewW * (n - 1)));
    for (var i = i0; i <= i1; i++) {
      var d = Math.abs(i / (n - 1) * S.viewW - x);
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
  WaterLite.prototype._renderSide = function (w, h) {
    var gl = this.gl, S = this.side, C = this.colors, p = this.prog.side, self = this;
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(p.p); this._quadAttrib(); this._common(p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex.heights); gl.uniform1i(p.loc('uHeights'), 0);
    gl.uniform1f(p.loc('uCols'), S.cols); gl.uniform2f(p.loc('uView'), S.viewW, S.viewH); gl.uniform1f(p.loc('uLevel'), S.level); gl.uniform1f(p.loc('uRange'), S.range);
    gl.uniform1f(p.loc('uPxU'), S.viewW / w);
    this._colorUniforms(p, ['deep', 'shallow', 'foam', 'skyTop', 'skyHorizon', 'sun', 'sand', 'grass']);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    var list = this.floaters.map(function (f) {
      var K = KIND2D[f.kind], cy = K.com * f.h, s = Math.sin(f.a), c = Math.cos(f.a);
      var kind = { crate: 0, barrel: 1, duck: 2, boat: 3 }[f.kind];
      var col = f.kind === 'duck' ? [1, 0.84, 0.18] : f.kind === 'boat' ? C.paint : f.kind === 'barrel' ? [C.wood[0] * 0.8, C.wood[1] * 0.8, C.wood[2] * 0.85] : C.wood;
      return { x: f.x + s * cy, y: f.y - c * cy, w: f.w, h: f.h, a: f.a, kind: kind, color: col, color2: [0.18, 0.18, 0.2] };
    });
    this.drops.forEach(function (d) { list.push({ x: d.x, y: d.y, w: d.r, h: d.r, a: 0, kind: 5, color: self.style.id === 5 ? C.paper : C.foam }); });
    this._sprites([0, 0, S.viewW, S.viewH], w, list);
  };
  WaterLite.prototype._sprites = function (rect, lowW, list) {
    var gl = this.gl, p = this.prog.sprite, C = this.colors, crisp = this.style.id === 2 || this.style.id === 4;
    gl.useProgram(p.p); this._quadAttrib(); this._common(p);
    gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform4f(p.loc('uViewRect'), rect[0], rect[1], rect[2], rect[3]);
    var unitsPerPx = rect[2] / lowW;
    for (var i = 0; i < list.length; i++) {
      var s = list[i], x = s.x, y = s.y;
      if (crisp) { x = (Math.round((x - rect[0]) / unitsPerPx) + 0.5) * unitsPerPx + rect[0]; y = (Math.round((y - rect[1]) / unitsPerPx) + 0.5) * unitsPerPx + rect[1]; }
      gl.uniform2f(p.loc('uCenter'), x, y); gl.uniform2f(p.loc('uSize'), s.w, s.h); gl.uniform1f(p.loc('uAngle'), s.a);
      gl.uniform1f(p.loc('uKind'), s.kind); gl.uniform3fv(p.loc('uColor'), s.color); gl.uniform3fv(p.loc('uColor2'), s.color2 || C.wood);
      gl.uniform1f(p.loc('uAA'), crisp ? 0 : 1.2 * unitsPerPx * 2 / Math.max(s.w, s.h));
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    gl.disable(gl.BLEND);
  };

  // ---- 2D top down ------------------------------------------------------------------------
  function chamfer(mask, W, H, target) {               // distance (cells) from each cell to the nearest cell where mask == target
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
    var W = this.q.sim, H = Math.round(W * 9 / 16), N = W * H, cell = W / 160, R = rng(this.opts.seed * 31 + 5), L = this.opts.land, x, y, i, k;
    var height = new Float32Array(N);
    if (typeof L === 'function') {
      for (y = 0; y < H; y++) for (x = 0; x < W; x++) { var v = L((x + 0.5) / W, (y + 0.5) / H); height[y * W + x] = v === true ? 0.6 : (+v || 0); }
    } else if (L !== 'none') {
      var isl = [], count = 3 + Math.floor(R() * 2), off = R() * 100;
      for (k = 0; k < count; k++) isl.push({ x: (0.14 + 0.72 * R()) * W, y: (0.15 + 0.6 * R()) * H, r: (0.07 + 0.11 * R()) * W });
      var vn = function (px, py) {
        var ix = Math.floor(px), iy = Math.floor(py), fx = px - ix, fy = py - iy;
        var hh = function (a, b) { var s = Math.sin(a * 127.1 + b * 311.7 + off) * 43758.5453; return s - Math.floor(s); };
        var u = fx * fx * (3 - 2 * fx), w = fy * fy * (3 - 2 * fy);
        return (hh(ix, iy) * (1 - u) + hh(ix + 1, iy) * u) * (1 - w) + (hh(ix, iy + 1) * (1 - u) + hh(ix + 1, iy + 1) * u) * w;
      };
      for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
        var gx = x / cell, gy = y / cell, e = 0;
        var wx = gx + (vn(gx * 0.05, gy * 0.05) - 0.5) * 14, wy = gy + (vn(gx * 0.05 + 9, gy * 0.05) - 0.5) * 14;   // domain warp
        for (k = 0; k < count; k++) e = Math.max(e, 1 - Math.sqrt(Math.pow(wx * cell - isl[k].x, 2) + Math.pow((wy * cell - isl[k].y) * 1.15, 2)) / isl[k].r);
        var nz = vn(gx * 0.12, gy * 0.12) * 0.6 + vn(gx * 0.3, gy * 0.3) * 0.4;
        height[y * W + x] = e + (nz - 0.5) * 0.35 - 0.1;
      }
    }
    var mask = new Uint8Array(N);
    for (i = 0; i < N; i++) mask[i] = height[i] > 0 ? 1 : 0;
    if (typeof L !== 'function') {                       // smooth away single-cell specks
      for (var pass = 0; pass < 2; pass++) {
        var next = new Uint8Array(N);
        for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
          var cnt = 0;
          for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) { var xx = clamp(x + dx, 0, W - 1), yy = clamp(y + dy, 0, H - 1); cnt += mask[yy * W + xx]; }
          next[y * W + x] = cnt >= 5 ? 1 : 0;
        }
        mask = next;
      }
    }
    var dW = chamfer(mask, W, H, 1), dL = chamfer(mask, W, H, 0), map = new Uint8Array(N * 4);
    for (i = 0; i < N; i++) {
      map[i * 4] = mask[i] ? Math.round((0.5 + clamp(height[i] * 1.2, 0.02, 1) * 0.5) * 255) : 0;
      map[i * 4 + 1] = Math.round(clamp(dW[i] / cell / 24, 0, 1) * 255);
      map[i * 4 + 2] = Math.round(clamp((dL[i] - 0.5) / cell / 8, 0, 1) * 255);
      map[i * 4 + 3] = 255;
    }
    var gl = this.gl;
    if (this.tex.map) { gl.deleteTexture(this.tex.map); gl.deleteTexture(this.tex.sim); }
    this.tex.map = this._dataTex(W, H, gl.LINEAR);
    gl.bindTexture(gl.TEXTURE_2D, this.tex.map); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, map);
    this.tex.sim = this._dataTex(W, H, gl.LINEAR, gl.LUMINANCE);
    this.top = { W: W, H: H, cell: cell, worldW: 160, worldH: 90, mask: mask, shore: dW, cur: new Float32Array(N), prev: new Float32Array(N), bytes: new Uint8Array(N), acc: 0 };
    this.floaters = []; this.drops = [];
    this.topBoat = null;
    if (this.opts.boat) {
      var best = null, bd = -1;                          // start in the most open water near the bottom
      for (k = 0; k < 60; k++) {
        var cx = 20 + R() * 120, cy = 50 + R() * 35, dd = this._shoreDist(cx, cy);
        if (dd > bd) { bd = dd; best = [cx, cy]; }
      }
      this.topBoat = this.addFloater(best[0], best[1], { kind: 'boat', size: 9 });
      this.topBoat.heading = -Math.PI / 2; this.topBoat.speed = 0; this.topBoat.auto = true;
    }
    if (this.opts.floaters) {
      for (k = 0; k < 7; k++) {
        var tx = 0, ty = 0, tries = 0;
        do { tx = 8 + R() * 144; ty = 8 + R() * 74; tries++; } while (this._shoreDist(tx, ty) < 3 && tries < 60);
        this.addFloater(tx, ty, { kind: k % 3 === 2 ? 'barrel' : 'crate', size: 2.8 + R() * 0.8, angle: R() * 6 });
      }
    }
  };
  WaterLite.prototype._topIndex = function (x, y) { var T = this.top; return clamp(Math.floor(y * T.cell), 0, T.H - 1) * T.W + clamp(Math.floor(x * T.cell), 0, T.W - 1); };
  WaterLite.prototype._topHeight = function (x, y) { return this.top.cur[this._topIndex(x, y)]; };
  WaterLite.prototype._isLand = function (x, y) { return this.top.mask[this._topIndex(x, y)] === 1; };
  WaterLite.prototype._shoreDist = function (x, y) { return this.top.shore[this._topIndex(x, y)] / this.top.cell; };
  WaterLite.prototype._topRect = function () {
    var T = this.top, c = this.canvas, a = (c.clientHeight || c.height) / (c.clientWidth || c.width);
    if (a < T.worldH / T.worldW) { var vh = T.worldW * a; return [0, (T.worldH - vh) / 2, T.worldW, vh]; }
    var vw = T.worldH / a; return [(T.worldW - vw) / 2, 0, vw, T.worldH];
  };
  WaterLite.prototype._updateTop = function (dt) {
    var T = this.top, W = T.W, H = T.H, x, y, i;
    T.acc = Math.min(T.acc + dt, 0.1);
    while (T.acc >= 1 / 60) {                            // the classic two-buffer ripple equation, land holds still
      T.acc -= 1 / 60;
      var cur = T.cur, prev = T.prev, mask = T.mask;
      for (y = 1; y < H - 1; y++) for (x = 1; x < W - 1; x++) {
        i = y * W + x;
        prev[i] = mask[i] ? 0 : ((cur[i - 1] + cur[i + 1] + cur[i - W] + cur[i + W]) * 0.5 - prev[i]) * 0.985;
      }
      T.cur = prev; T.prev = cur;
    }
    var b = this.topBoat, self = this;
    if (b) {
      var inp = this.input, manual = inp.up || inp.down || inp.left || inp.right;
      if (manual) b.auto = false;
      var thr, steer;
      if (b.auto) {
        thr = 0.65; steer = 0.45 * Math.sin(this.time * 0.23) + 0.25 * Math.sin(this.time * 0.61);
        var best = 0, bestD = -1;                         // steer towards open water
        for (var k = -2; k <= 2; k++) {
          var ang = b.heading + k * 0.45, ax = b.x + Math.cos(ang) * 12, ay = b.y + Math.sin(ang) * 12;
          var dd = (ax < 4 || ay < 4 || ax > 156 || ay > 86) ? 0 : Math.min(this._shoreDist(ax, ay), this._shoreDist(b.x + Math.cos(ang) * 6, b.y + Math.sin(ang) * 6));
          if (dd > bestD + 0.3 || (k === 0 && dd >= bestD)) { bestD = dd; best = k; }
        }
        if (this._shoreDist(b.x + Math.cos(b.heading) * 10, b.y + Math.sin(b.heading) * 10) < 4) steer = best === 0 ? 1 : best / 2;
      } else {
        thr = (inp.up ? 1 : 0) - (inp.down ? 0.5 : 0); steer = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
      }
      b.speed += (thr * 16 - b.speed) * Math.min(dt * 1.4, 1);
      b.heading += clamp(steer, -1, 1) * dt * 1.7 * clamp(Math.abs(b.speed) / 6, 0.3, 1);
      var nx = b.x + Math.cos(b.heading) * b.speed * dt, ny = b.y + Math.sin(b.heading) * b.speed * dt;
      if (!this._isLand(nx, ny) && nx > 2 && ny > 2 && nx < 158 && ny < 88) { b.x = nx; b.y = ny; } else b.speed *= -0.3;
      b.a = b.heading + Math.PI / 2;
      if (Math.abs(b.speed) > 1) {                       // the wake: a push of water behind the stern, and a bow wave
        var sp = Math.abs(b.speed) / 16;
        this.splash(b.x - Math.cos(b.heading) * 3.6, b.y - Math.sin(b.heading) * 3.6, 0.55 * sp * dt * 60 * 0.12, 1.5);
        this.splash(b.x + Math.cos(b.heading) * 4.2, b.y + Math.sin(b.heading) * 4.2, -0.25 * sp * dt * 60 * 0.12, 1.2);
      }
    }
    this.floaters.forEach(function (f) {
      if (f === b) return;
      var gx = self._topHeight(f.x + 1, f.y) - self._topHeight(f.x - 1, f.y), gy = self._topHeight(f.x, f.y + 1) - self._topHeight(f.x, f.y - 1);
      var wd = self.opts.windDir * Math.PI / 180, wind = self.opts.wind * 0.004;
      f.vx = (f.vx - gx * 30 * dt + Math.cos(wd) * wind * dt) * Math.exp(-dt * 0.8);
      f.vy = (f.vy - gy * 30 * dt + Math.sin(wd) * wind * dt) * Math.exp(-dt * 0.8);
      var nx2 = f.x + f.vx * dt, ny2 = f.y + f.vy * dt;
      if (!self._isLand(nx2, ny2) && nx2 > 1 && ny2 > 1 && nx2 < 159 && ny2 < 89) { f.x = nx2; f.y = ny2; } else { f.vx *= -0.5; f.vy *= -0.5; }
      f.a += (f.vx - f.vy) * dt * 0.3;
      f.bob = self._topHeight(f.x, f.y);
    });
    var B = T.bytes, c2 = T.cur;
    for (i = 0; i < W * H; i++) { var v = c2[i] * 127.5 + 127.5; B[i] = v < 0 ? 0 : v > 255 ? 255 : v; }
    var gl = this.gl; gl.bindTexture(gl.TEXTURE_2D, this.tex.sim);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W, H, gl.LUMINANCE, gl.UNSIGNED_BYTE, B);
  };
  WaterLite.prototype._renderTop = function (w, h) {
    var gl = this.gl, T = this.top, C = this.colors, p = this.prog.top, rect = this._topRect();
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(p.p); this._quadAttrib(); this._common(p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex.sim); gl.uniform1i(p.loc('uSim'), 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.tex.map); gl.uniform1i(p.loc('uMap'), 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform2f(p.loc('uSimSize'), T.W, T.H); gl.uniform2f(p.loc('uWorld'), T.worldW, T.worldH);
    gl.uniform4f(p.loc('uViewRect'), rect[0], rect[1], rect[2], rect[3]);
    var wd = this.opts.windDir * Math.PI / 180, ws = this.opts.wind * 0.05;
    gl.uniform2f(p.loc('uWind'), -Math.cos(wd) * ws, -Math.sin(wd) * ws);
    var sd = [this.sunDir[0], Math.max(this.sunDir[1], 0.3), this.sunDir[2]], sl = Math.sqrt(sd[0] * sd[0] + sd[1] * sd[1] + sd[2] * sd[2]);
    gl.uniform3f(p.loc('uSunDir'), sd[0] / sl, sd[1] / sl, sd[2] / sl);
    this._colorUniforms(p, ['deep', 'shallow', 'foam', 'sun', 'sand', 'grass']);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    var b = this.topBoat;
    this._sprites(rect, w, this.floaters.map(function (f) {
      if (f === b) return { x: f.x, y: f.y, w: f.size * 0.5, h: f.size, a: f.a, kind: 4, color: [0.92, 0.92, 0.9], color2: C.wood };
      var s = f.size * (1 + clamp(f.bob, -0.5, 0.5) * 0.25);
      return { x: f.x, y: f.y, w: s, h: f.kind === 'barrel' ? s * 1.15 : s, a: f.a, kind: f.kind === 'barrel' ? 1 : 0, color: f.kind === 'barrel' ? [C.wood[0] * 0.8, C.wood[1] * 0.8, C.wood[2] * 0.85] : C.wood, color2: [0.18, 0.18, 0.2] };
    }));
  };

  // ---- shared ----------------------------------------------------------------------------
  // Side: x, y in view units. Top: world units. 3D: world x, z (leaves foam).
  WaterLite.prototype.splash = function (x, y, power, radius) {
    var m = this.opts.mode;
    if (m === 'side') {
      this._push(x, -Math.abs(power) * 0.25, radius || 20);
      var n = Math.min(26, Math.round(4 + power * 1.2)), ys = this.side.level - this._sideHeight(x);
      for (var i = 0; i < n; i++) this.drops.push({ x: x + (Math.random() - 0.5) * (radius || 20), y: ys - 2, vx: (Math.random() - 0.5) * 140, vy: -90 - Math.random() * power * 14, r: 2 + Math.random() * 2.5, life: 1.5 });
      if (this.drops.length > 120) this.drops.splice(0, this.drops.length - 120);
    } else if (m === 'top') {
      var T = this.top, r = Math.max((radius || 2) * T.cell, 1), cx = x * T.cell, cy = y * T.cell;
      for (var yy = Math.floor(cy - r); yy <= Math.ceil(cy + r); yy++) for (var xx = Math.floor(cx - r); xx <= Math.ceil(cx + r); xx++) {
        if (xx < 1 || yy < 1 || xx >= T.W - 1 || yy >= T.H - 1) continue;
        var d = Math.sqrt((xx - cx) * (xx - cx) + (yy - cy) * (yy - cy)); if (d > r) continue;
        T.cur[yy * T.W + xx] -= power * (0.5 + 0.5 * Math.cos(d / r * Math.PI));
      }
    } else {
      this.trail.unshift({ x: x, z: y, life: Math.min(1, power || 1) }); if (this.trail.length > 8) this.trail.pop();
    }
  };
  WaterLite.prototype._quadAttrib = function () {
    var gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  };
  WaterLite.prototype._common = function (p) {
    var gl = this.gl;
    gl.uniform1f(p.loc('uStyle'), this.style.id); gl.uniform1f(p.loc('uTime'), this.time % 1800);   // wrapped: mediump-safe
    gl.uniform3fv(p.loc('uPaper'), this.colors.paper); gl.uniform3fv(p.loc('uInk'), this.colors.ink);
    gl.uniform1f(p.loc('uScenery'), this.opts.scenery ? 1 : 0);
  };
  var COLOR_UNIFORM = { deep: 'uDeep', shallow: 'uShallow', foam: 'uFoamCol', skyTop: 'uSkyTop', skyHorizon: 'uSkyHor', sun: 'uSunCol', sand: 'uSand', grass: 'uGrass' };
  WaterLite.prototype._colorUniforms = function (p, keys) {
    var gl = this.gl, C = this.colors;
    keys.forEach(function (k) { gl.uniform3fv(p.loc(COLOR_UNIFORM[k]), C[k]); });
  };
  WaterLite.prototype._target = function (name, w, h, filter) {
    var gl = this.gl, t = this.fbos[name];
    if (!t || t.w !== w || t.h !== h) {
      if (t) { gl.deleteFramebuffer(t.f); gl.deleteTexture(t.t); gl.deleteRenderbuffer(t.d); }
      var tex = this._dataTex(w, h, gl.NEAREST), f = gl.createFramebuffer(), d = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, d); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, d);
      t = this.fbos[name] = { f: f, t: tex, d: d, w: w, h: h, filter: gl.NEAREST };
    }
    if (filter && t.filter !== filter) {
      gl.bindTexture(gl.TEXTURE_2D, t.t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      t.filter = filter;
    }
    return t;
  };

  // canvas pixels = CSS size x device pixel ratio (capped by quality)
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
  };

  WaterLite.prototype.render = function () {
    var gl = this.gl;
    if (gl.isContextLost()) return;
    this.resize();
    var cw = this.canvas.width, ch = this.canvas.height, px = 1, lw, lh;
    if (this.pixelSize > 1) {                             // whole low-res pixels on screen: each one is px x px canvas pixels
      px = Math.max(2, Math.round(this.pixelSize * (this._dpr || 1)));
      lw = Math.ceil(cw / px); lh = Math.ceil(ch / px);
    } else { lw = Math.max(16, Math.round(cw * this.q.scale)); lh = Math.max(16, Math.round(ch * this.q.scale)); }
    this.stats.lowW = lw; this.stats.lowH = lh; this.stats.px = px;
    var pal = PALETTES[this.palName] || null, quant = !!pal || this.style.bits > 0;
    var A = this._target('scene', lw, lh, quant || px > 1 ? gl.NEAREST : gl.LINEAR);
    gl.bindFramebuffer(gl.FRAMEBUFFER, A.f); gl.viewport(0, 0, lw, lh);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (this.opts.mode === 'side') this._renderSide(lw, lh);
    else if (this.opts.mode === 'top') this._renderTop(lw, lh);
    else this._render3d(lw, lh);
    gl.disable(gl.DEPTH_TEST);
    var src = A, p;
    if (quant) {                                          // palette and dithering at low resolution: cheap even on old phones
      var B = this._target('quant', lw, lh, gl.NEAREST);
      gl.bindFramebuffer(gl.FRAMEBUFFER, B.f); gl.viewport(0, 0, lw, lh);
      p = this.prog.quant; gl.useProgram(p.p); this._quadAttrib();
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, A.t); gl.uniform1i(p.loc('uTex'), 0);
      var arr = new Float32Array(48);
      if (pal) for (var i = 0; i < pal.length; i++) arr.set(hex(pal[i]), i * 3);
      gl.uniform3fv(p.loc('uPal'), arr); gl.uniform1f(p.loc('uPalN'), pal ? pal.length : 0);
      gl.uniform1f(p.loc('uDither'), this.dither); gl.uniform1f(p.loc('uBits'), this.style.bits);
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

  // screen (CSS pixels from the canvas's top left) to the mode's world: 3D sea plane { x, z },
  // side view { x, y } in view units, top view { x, y } in world units
  WaterLite.prototype.screenToWorld = function (sx, sy) {
    var c = this.canvas, u = sx / c.clientWidth, v = sy / c.clientHeight, m = this.opts.mode;
    if (m === 'side') return { x: u * this.side.viewW, y: v * this.side.viewH };
    if (m === 'top') { var r = this._topRect(); return { x: r[0] + u * r[2], y: r[1] + v * r[3] }; }
    var cam = this.cam, eye = this._eye(), L = lookAt(eye, cam.target), ty = Math.tan(cam.fov / 2), asp = c.clientWidth / c.clientHeight;
    var nx = u * 2 - 1, ny = 1 - v * 2;
    var d = [0, 1, 2].map(function (k) { return L.f[k] + L.r[k] * nx * ty * asp + L.u[k] * ny * ty; });
    if (d[1] >= -1e-3) return null;
    var t = -eye[1] / d[1];
    return { x: eye[0] + d[0] * t, z: eye[2] + d[2] * t };
  };
  // the demo's click: drop a crate in 3D, a body in the side view, ripples from above
  WaterLite.prototype.drop = function (sx, sy) {
    var w = this.screenToWorld(sx, sy); if (!w) return;
    var m = this.opts.mode;
    if (m === 'side') {
      var kinds = ['crate', 'barrel', 'duck'], kind = kinds[Math.floor(Math.random() * 3)];
      this.addFloater(w.x, Math.min(w.y, this.side.level - 40), { kind: kind, size: 15 + Math.random() * 10, angle: (Math.random() - 0.5) * 0.8 });
    } else if (m === 'top') this.splash(w.x, w.y, 1.4, 2.5);
    else {
      this.addFloater(w.x, w.z, { kind: Math.random() < 0.6 ? 'crate' : 'barrel', y: 4 });
      this.splash(w.x, w.z, 1);
    }
  };
  // plain settings for new WaterLite(canvas, config); a land function is reported as 'custom'
  WaterLite.prototype.config = function () {
    var o = {}; for (var k in DEFAULTS) o[k] = this.opts[k];
    if (typeof o.land === 'function') o.land = 'custom';
    return o;
  };
  WaterLite.prototype.dispose = function () {
    var gl = this.gl, k;
    for (k in this.prog) gl.deleteProgram(this.prog[k].p);
    for (k in this.tex) if (this.tex[k]) gl.deleteTexture(this.tex[k]);
    for (k in this.fbos) { gl.deleteFramebuffer(this.fbos[k].f); gl.deleteTexture(this.fbos[k].t); gl.deleteRenderbuffer(this.fbos[k].d); }
    for (k in this.meshes) gl.deleteBuffer(this.meshes[k].buf);
    if (this.grid) { gl.deleteBuffer(this.grid.vb); gl.deleteBuffer(this.grid.ib); }
    gl.deleteBuffer(this.quad);
    this.prog = {}; this.tex = {}; this.fbos = {};
  };

  root.WaterLite = WaterLite;
  if (typeof module !== 'undefined' && module.exports) module.exports = WaterLite;
})(typeof window !== 'undefined' ? window : this);
