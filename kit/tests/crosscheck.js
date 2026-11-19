// Diffs the C++ port against the JS reference: node crosscheck.js < output-of-crosscheck.cpp
const K = require('../js/water_waves.js');
const cpp = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const winds = [2.5, 9.0, 14.0, 21.0];
let worst = 0, worstName = '', worstF = 0;
function cmp(name, a, b) { for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i] - b[i]) / Math.max(1, Math.abs(a[i])); if (name.startsWith('gpu')) { if (!(d <= worstF)) worstF = d; } else if (!(d <= worst)) { worst = d; worstName = name + '[' + i + ']'; } } if (a.length !== b.length) { worst = Infinity; worstName = name + ' length'; } }
for (let c = 0; c < 4; c++) {
  const w = new K.WaveSet(40, 24);
  w.generate({ windSpeed: winds[c], windDirection: 0.61, choppiness: 0.9 + 0.03 * c, swellHeight: 0.3 + c * 0.7, swellLength: 60 + c * 40, swellDirection: 1.4, foamAmount: 1.0 + 0.2 * c, seed: 1337 + c });
  w.setTime(123.456 + c); w.advance(0.25); w.packForGpu(1234.5, -987.25);
  const o = cpp[c];
  for (const key of ['dirX', 'dirZ', 'k', 'amp', 'ampH', 'omega', 'phase', 'timePhase', 'tailVariance']) cmp(key, Array.from(w[key]), o[key]);
  cmp('gpuA', Array.from(w.gpuA), o.gpuA); cmp('gpuB', Array.from(w.gpuB), o.gpuB);
  cmp('scalars', [w.significantHeight, w.peakPeriod, w.peakWavelength, w.foamThreshold, w.foamGain, w.windStreaks, w.slopeVariance], o.scalars);
  const s = {};
  for (let i = 0; i < 40; i++) {
    w.sample(-300 + i * 17.3, 120 - i * 9.1, i % 3 === 0 ? 1.0 : 6.0, i % 4 === 0 ? 3.0 : 1e9, s);
    cmp('sample' + i, [s.height, s.nx, s.ny, s.nz, s.vx, s.vy, s.vz, s.ax, s.ay, s.az, s.jacobian], o.samples[i]);
  }
  const f = new Float64Array(12);
  const wet = w.buoyancy(new Float64Array([0, -0.2, 0, 1, 0.1, 0.5, -2, 0.4, 3, 5, -1.0, -4]), new Float64Array([0.1, -0.5, 0, 0, 0, 0, 1, 2, -1, 0, 0.3, 0]), 4,
    { pointVolume: 0.05, pointRadius: 0.18, pointArea: 0.13, waterDensity: 1025, linearDrag: 1.1, quadDrag: 1.0, minWavelength: 1.3 }, null, f);
  cmp('buoyancy', [wet, ...f], o.buoyancy);
  const fs = new Float64Array(12);
  const wetS = w.buoyancy(new Float64Array([0, 0.3, 0, 1, 0.9, 0.5, -2, 0.1, 3, 5, -0.4, -4]), new Float64Array([0.1, -0.5, 0, 0, 0, 0, 1, 2, -1, 0, 0.3, 0]), 4,
    { pointVolume: 0.05, pointRadius: 0.18, pointArea: 0.13, waterDensity: 1025, linearDrag: 1.1, quadDrag: 1.0, minWavelength: 1.3,
      breakSpeed: 6, breakAccel: 0.05, windX: 12, windZ: -5, currentX: 0.4, currentZ: 0.2, linearDragH: 0.2, airDrag: 1.1 }, null, fs);
  cmp('storm', [w.breakingAccel(0.4 * K.whitecapCoverage(winds[c]), 2), wetS, ...fs], o.storm);
  const sp = K.impactSplash(0.02 + 0.3 * c, 0.012 + 0.02 * c, 6 + 3 * c, 0.3 + 0.35 * c), sk = [0, 0, 0];
  const skips = K.skipBounce(12 - c, -1.5 - 0.8 * c, 3 + c, 0.1, 0.04, 0.2 + 0.1 * c, sk);
  const bl = K.underwaterBlast(0.2 * (c + 1), 0.5 + 1.2 * c);
  cmp('impacts', [sp.energy, sp.cavityRadius, sp.cavityDepth, sp.collapseTime, sp.jetHeight, sp.jetSpeed, sp.crownHeight, sp.crownRadius, sp.bubbleFrequency, sp.droplets, ...sp.pulses,
    skips ? 1 : 0, ...sk, bl.bubbleRadius, bl.bubblePeriod, bl.plumeHeight, bl.plumeRadius, bl.domeRadius, bl.domeSpeed, bl.energy, bl.vents ? 1 : 0,
    K.blastPressure(0.2, 1.5 + c), K.blastImpulse(0.2, 1.5 + c), K.spallSpeed(0.2, 1 + c, 2.5)], o.impacts);
  console.log(`case ${c}: wind ${winds[c]} m/s, Hs ${w.significantHeight.toFixed(3)} m, foam threshold ${w.foamThreshold.toFixed(4)}`);
}
console.log('largest relative difference C++ vs JS, double-precision outputs:', worst.toExponential(2), worstName ? 'at ' + worstName : '');
console.log('largest relative difference, float32 GPU tables (printed to 9 digits):', worstF.toExponential(2));
process.exit(worst < 1e-10 && worstF < 1e-6 ? 0 : 1);
