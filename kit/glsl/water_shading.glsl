// ============================================================================
//  WATER KIT - surface shading (GLSL 3.30+ / GLSL ES 3.00)
// ----------------------------------------------------------------------------
//  Pure functions, no textures, no engine state. Your material supplies the
//  inputs it already has (sun, a reflection sample, the scene colour behind the
//  surface) and gets radiance back, in linear HDR.
//
//  Units: sunColor is the sun's irradiance on a surface facing it. A white
//  diffuse surface in full sun then has radiance sunColor / PI.
// ============================================================================

#ifndef WATER_PI
#define WATER_PI 3.14159265359
#endif
#define WATER_F0 0.02                    // reflectance of water at normal incidence (n = 1.333)

struct WaterMaterial {
    vec3 extinction;      // per metre, how fast each colour dies under water
    vec3 scatterColor;    // colour deep water sends back up (its "albedo")
    vec3 sssColor;        // tint of sunlight shining through wave crests
    float sssStrength;
    float roughness;      // GGX alpha of the ripples below the smallest simulated wave
    vec3 foamColor;
    float specular;       // sun glitter gain, 1 = physical
};

float waterSaturate(float x) { return clamp(x, 0.0, 1.0); }

// Fresnel reflectance of a surface whose unresolved slopes have std-dev 'sigma'.
// Schlick, with the rough-sea correction from Bruneton, Neyret & Holzschuch 2010:
// a wavy horizon never becomes a perfect mirror.
float waterFresnel(float NdotV, float sigma) {
    float f = pow(1.0 - NdotV, 5.0 * exp(-2.69 * sigma)) / (1.0 + 22.7 * pow(sigma, 1.5));
    return WATER_F0 + (1.0 - WATER_F0) * f;
}

// GGX alpha^2 for this pixel: base ripples plus everything the wave LOD filtered out.
float waterAlpha2(float baseRoughness, float lostSlopeVariance) {
    return clamp(baseRoughness * baseRoughness + lostSlopeVariance, 0.00004, 0.5);
}

// Direction to look up in the sky / reflection probe. Rays that would dive back
// into the sea are lifted to the horizon, and rough distant water looks a little
// above the mirror direction (visible facets tilt towards the viewer), which is
// what draws the darker band under the horizon on a real sea.
vec3 waterReflectDir(vec3 N, vec3 V, float sigma) {
    vec3 R = reflect(-V, N);
    R.y = max(R.y, 0.0) + sigma * 0.9 + 0.01;
    return normalize(R);
}

// Sun glitter: Cook-Torrance with a GGX lobe.
vec3 waterSunSpecular(vec3 N, vec3 V, vec3 L, vec3 sunColor, float alpha2) {
    vec3 H = normalize(V + L);
    float NdotL = waterSaturate(dot(N, L));
    float NdotV = max(dot(N, V), 1e-3);
    float NdotH = waterSaturate(dot(N, H));
    float VdotH = waterSaturate(dot(V, H));
    float d = NdotH * NdotH * (alpha2 - 1.0) + 1.0;
    float D = alpha2 / (WATER_PI * d * d);
    float gv = NdotL * sqrt(NdotV * NdotV * (1.0 - alpha2) + alpha2);
    float gl = NdotV * sqrt(NdotL * NdotL * (1.0 - alpha2) + alpha2);
    float Vis = 0.5 / max(gv + gl, 1e-5);
    float F = WATER_F0 + (1.0 - WATER_F0) * pow(1.0 - VdotH, 5.0);
    return sunColor * min(D * Vis * F * NdotL, 60.0);
}

// Light coming up out of the water body.
//   refraction  scene colour seen through the surface (sea bed, hulls)
//   thickness   metres of water the view ray crosses before hitting that scene
//   crest       0..1, how high this point sits on its wave (thin water = more glow)
vec3 waterBody(vec3 refraction, float thickness, vec3 N, vec3 V, vec3 L,
               vec3 sunColor, vec3 skyAmbient, float crest, WaterMaterial m) {
    vec3 T = exp(-m.extinction * thickness);
    vec3 lightIn = sunColor * (max(L.y, 0.0) / WATER_PI) + skyAmbient;
    vec3 deep = m.scatterColor * lightIn;
    // sunlight entering the back of a wave and leaving towards the eye
    vec3 Lb = normalize(L + N * 0.4);
    float through = pow(waterSaturate(dot(V, -Lb)), 3.0);
    float facing = 0.15 * waterSaturate(L.y * 3.0);
    float sss = (through + facing) * crest * m.sssStrength;
    // daylight from the sky behind a wave shining through its thin crest: the green glow of a
    // storm sea, which the sun alone cannot give once clouds have hidden it
    vec3 Ls = normalize(vec3(-V.x, 0.35, -V.z) + N * 0.4);
    float behind = pow(waterSaturate(dot(V, -Ls)), 2.0);
    vec3 skyGlow = m.sssColor * skyAmbient * (behind * crest * crest * m.sssStrength * 0.35);
    vec3 scatter = deep + m.sssColor * sunColor * (sss / WATER_PI) + skyGlow;
    return refraction * T + scatter * (1.0 - T);
}

// Full surface: body + reflection + sun glitter, then foam on top.
//   reflection  sky / probe radiance along waterReflectDir(...)
//   foam        0..1 coverage after the foam pattern has been applied
vec3 waterShade(vec3 N, vec3 V, vec3 L, vec3 sunColor, vec3 skyAmbient,
                vec3 reflection, vec3 refraction, float thickness,
                float crest, float foam, float lostSlopeVariance, WaterMaterial m) {
    float alpha2 = waterAlpha2(m.roughness, lostSlopeVariance);
    float sigma = sqrt(alpha2);                    // every unresolved slope, the base ripples included, dulls the mirror
    float NdotV = max(dot(N, V), 1e-3);
    float F = waterFresnel(NdotV, sigma);
    vec3 body = waterBody(refraction, thickness, N, V, L, sunColor, skyAmbient, crest, m);
    vec3 col = body * (1.0 - F) + reflection * F + waterSunSpecular(N, V, L, sunColor, alpha2) * m.specular;
    // foam: a matte, slightly translucent white mass. Thick foam is near white; thin foam takes on the
    // colour of the water under it and lets its light through; foam on the shadowed side of a wave is darker.
    float thick = smoothstep(0.15, 0.95, foam);
    vec3 foamAlbedo = m.foamColor * mix(vec3(0.66, 0.78, 0.84), vec3(0.9), thick);
    float wrapL = waterSaturate(dot(N, L) * 0.5 + 0.5);
    vec3 foamLit = foamAlbedo * (sunColor * (wrapL * waterSaturate(L.y * 4.0 + 0.1) / WATER_PI) + skyAmbient * (0.7 + 0.3 * waterSaturate(N.y)));
    foamLit += body * (1.0 - thick) * 0.6;
    return mix(col, foamLit, foam);
}

// ---------------------------------------------------------------------------
//  Procedural foam: domain-warped noise for the patches, cellular noise for the lace
//  at their edges. Swap waterFoamLace() for a real foam texture if you have one.
// ---------------------------------------------------------------------------
vec2 waterHash22(vec2 p) {
    uvec2 q = uvec2(ivec2(floor(p)));
    q = q * uvec2(1597334673u, 3812015801u);
    uint n = (q.x ^ q.y) * 1597334673u;
    uvec2 r = uvec2(n, n * 48271u);
    return vec2(r) * (1.0 / 4294967295.0);
}

// distance to the nearest and second-nearest cell centre
vec2 waterCells(vec2 p) {
    vec2 ip = floor(p), fp = fract(p);
    vec2 d = vec2(8.0);
    for (int y = -1; y <= 1; y++)
        for (int x = -1; x <= 1; x++) {
            vec2 g = vec2(float(x), float(y));
            vec2 r = g + waterHash22(ip + g) - fp;
            float e = dot(r, r);
            if (e < d.x) { d.y = d.x; d.x = e; } else if (e < d.y) d.y = e;
        }
    return sqrt(d);
}

float waterNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = waterHash22(i).x, b = waterHash22(i + vec2(1.0, 0.0)).x;
    float c = waterHash22(i + vec2(0.0, 1.0)).x, d = waterHash22(i + vec2(1.0, 1.0)).x;
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Octaves of value noise for foam, roughly 0..1 around 0.5. 'scale' is the frequency of the
// first octave in cycles per metre; each octave fades to its mean once its features get
// smaller than about two pixels, so distant foam averages out instead of shimmering.
float waterFoamFbm(vec2 p, float footprint, float scale) {
    float s = 0.0, norm = 0.0, a = 1.0, f = scale;
    for (int i = 0; i < 4; i++) {
        float keep = clamp(0.5 / (footprint * f) - 0.5, 0.0, 1.0);
        s += a * keep * (waterNoise(p * f) - 0.5);
        norm += a;
        p = vec2(0.8 * p.x - 0.6 * p.y, 0.6 * p.x + 0.8 * p.y) + 13.7;     // turn each octave, so they never line up
        f *= 2.13; a *= 0.55;
    }
    return 0.5 + 1.7 * s / norm;
}

// Foam lace: the walls between the bubbles of a foam sheet. 1 on a wall, falling to 0 in
// the middle of a hole and spread fairly evenly in between, so a threshold on it picks out
// thin threads (high threshold), a sheet with holes (middle) or nearly solid foam (low).
// Bubbles of several sizes, the large ones 25-45 cm and the small ones about 12 cm,
// with the mix and the wall thickness changing from place to place, all bent by noise,
// so it never reads as a net. Returns 0.5, its mean, once the walls are below a pixel.
float waterFoamLace(vec2 q, float footprint) {
    float w1 = clamp(0.08 / footprint - 0.5, 0.0, 1.0);                   // fades out before the walls get thinner than a pixel
    if (w1 <= 0.0) return 0.5;
    vec2 bend = vec2(waterNoise(q * 1.3 + 4.0), waterNoise(q * 1.3 + 19.0)) - 0.5;
    bend += (vec2(waterNoise(q * 3.1 + 11.0), waterNoise(q * 3.1 + 23.0)) - 0.5) * 0.5;
    float big = smoothstep(0.3, 0.7, waterNoise(q * 0.45 + 51.0));        // large bubbles in some places, smaller in others
    float tw = 0.4 + 0.35 * waterNoise(q * 0.7 + 7.0);                    // walls of every thickness
    vec2 ca = waterCells(q * 2.2 + bend * 1.8);
    vec2 cb = waterCells(q * 3.9 + bend * 2.4 + 17.0);
    float l1 = mix(1.0 - smoothstep(0.0, tw * 0.9, cb.y - cb.x), 1.0 - smoothstep(0.0, tw, ca.y - ca.x), big);
    float w2 = clamp(0.025 / footprint - 0.5, 0.0, 1.0);
    float l2 = 0.5;
    if (w2 > 0.0) {
        vec2 c2 = waterCells(q * 8.1 + bend * 3.7 + 31.0);
        l2 = mix(0.5, 1.0 - smoothstep(0.0, 0.5, c2.y - c2.x), w2);
    }
    return mix(0.5, 0.65 * l1 + 0.35 * l2, w1);
}

// Foam density 0..1 in, foam opacity 0..1 out, with wind streaks (a density from
// waterWindStreaks) laid in along the wind.
//   p          rest position in metres (so the foam rides the waves)
//   windDir    unit vector; foam is drawn out along it (the wind, or the way surf travels)
//   footprint  metres of sea per pixel; detail smaller than that fades to its mean
// Foam is a sheet of bubbles. How full the sheet is comes from the density, varied from
// patch to patch by domain-warped noise; the sheet is cut from the lace above, so fresh
// foam is nearly solid with a few holes, older foam is a sheet with holes, and the oldest
// is loose threads, and the edge of every patch comes apart the same way. Thin foam lets
// the water show through. Far away only the average whiteness is left, so nothing shimmers.
float waterFoamMaskStreaks(vec2 p, vec2 windDir, float density, float streak, float footprint) {
    float d = max(density, streak);
    if (d <= 0.01) return 0.0;
    vec2 side = vec2(-windDir.y, windDir.x);
    vec2 q = vec2(dot(p, windDir) * 0.55, dot(p, side));                       // drawn out along the wind
    vec2 warp = vec2(waterFoamFbm(q + 5.2, footprint, 0.16), waterFoamFbm(q + 41.3, footprint, 0.16)) - 0.5;
    q += warp * 3.2;                                                           // organic, not grid-like
    float n = waterFoamFbm(q, footprint, 0.5);                                 // patches, 2 m down to 20 cm
    float C = smoothstep(0.0, 0.75, d);                                        // how full the sheet is, on average
    float fill = clamp(C + (n - 0.5) * 1.3, 0.0, 1.0);                         // ... and here
    float lace = waterFoamLace(q * vec2(1.4, 1.0), footprint);
    lace += (waterFoamFbm(q * 1.7 + 77.0, footprint, 2.0) - 0.5) * 0.35;      // ragged, uneven threads
    float sharp = min(0.06 + 2.5 * footprint, 0.5);                            // edges a pixel or so wide, never stair-stepped
    float cover = smoothstep(1.0 - fill - sharp, 1.0 - fill + sharp, lace);
    cover = mix(cover, fill, smoothstep(0.05, 0.16, footprint));              // bubbles too small to see: just how full
    cover = mix(cover, C, smoothstep(0.6, 3.0, footprint));                   // far away, only the average is left
    return cover * mix(0.5, 1.0, fill);                                        // thin foam lets the water show through
}

float waterFoamMask(vec2 p, vec2 windDir, float density, float footprint) {
    return waterFoamMaskStreaks(p, windDir, density, 0.0, footprint);
}

// Strong wind draws old foam out into long streaks along the wind (Beaufort 7 and up).
// Returns a streak density for waterFoamMaskStreaks(); amount = 0 below ~11 m/s, ~0.6 in a
// gale, up to 0.9 in a hurricane, where the streaks crowd together until the sea is white.
float waterWindStreaks(vec2 p, vec2 windDir, float amount, float footprint) {
    amount *= 1.0 - smoothstep(1.5, 5.0, footprint);
    if (amount <= 0.0) return 0.0;
    vec2 q = vec2(dot(p, windDir), dot(p, vec2(-windDir.y, windDir.x)));
    q.y += 7.0 * waterNoise(q * vec2(0.012, 0.06));                        // streaks wander a little
    float n = waterNoise(q * vec2(0.02, 0.6)) * 0.5 + waterNoise(q * vec2(0.05, 1.6) + 13.0) * 0.32
            + waterNoise(q * vec2(0.11, 4.3) + 29.0) * 0.18;               // a broad band, and fine lines beside it
    float lo = 0.66 - 0.18 * amount;
    return amount * smoothstep(lo, lo + 0.2, n);
}

// Rain: rings spreading from random drops. Returns a slope to subtract from the
// normal (n.xz -= slope * n.y). amount 0..1; fades out once rings are sub-pixel.
vec2 waterRainRipples(vec2 p, float time, float amount, float footprint) {
    amount *= 1.0 - smoothstep(0.03, 0.12, footprint);
    if (amount <= 0.0) return vec2(0.0);
    vec2 slope = vec2(0.0);
    for (int layer = 0; layer < 3; layer++) {
        float fl = float(layer);
        vec2 q = p * (1.15 + 0.45 * fl) + fl * 17.3;               // one drop per cell, cells 0.5 to 0.9 m
        vec2 cell = floor(q);
        vec2 h = waterHash22(cell + fl * 7.0);
        float clock = time * (0.9 + 0.5 * h.x) + h.y * 13.0;      // every cell drips on its own clock
        float t = fract(clock);
        vec2 centre = 0.36 + 0.28 * waterHash22(cell + floor(clock) * 3.0 + 91.0);
        vec2 d = fract(q) - centre;
        float r = length(d);
        float ring = r - t * 0.34;
        float wave = sin(ring * 42.0) * exp(-ring * ring * 130.0) * (1.0 - t) * (1.0 - t);
        slope += d * (wave / max(r, 1e-3));
    }
    return slope * (0.5 * amount);
}
