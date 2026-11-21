// ============================================================================
//  WATER KIT - surface shading (HLSL: Direct3D 11/12, Unity, Unreal custom nodes)
// ----------------------------------------------------------------------------
//  Generated from glsl/water_shading.glsl - same functions, same names, same math.
//  Pure functions, no textures, no engine state. Your material supplies the
//  inputs it already has (sun, a reflection sample, the scene colour behind the
//  surface) and gets radiance back, in linear HDR.
//
//  Units: sunColor is the sun's irradiance on a surface facing it. A white
//  diffuse surface in full sun then has radiance sunColor / PI.
// ============================================================================
#ifndef WATER_SHADING_HLSL
#define WATER_SHADING_HLSL

#ifndef WATER_LOOP
#define WATER_LOOP [loop]            // these loops exit early on data; do not let the compiler unroll them
#endif

#ifndef WATER_PI
#define WATER_PI 3.14159265359
#endif
#define WATER_F0 0.02                    // reflectance of water at normal incidence (n = 1.333)

struct WaterMaterial {
    float3 extinction;      // per metre, how fast each colour dies under water
    float3 scatterColor;    // colour deep water sends back up (its "albedo")
    float3 sssColor;        // tint of sunlight shining through wave crests
    float sssStrength;
    float roughness;      // GGX alpha of the ripples below the smallest simulated wave
    float3 foamColor;
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
float3 waterReflectDir(float3 N, float3 V, float sigma) {
    float3 R = reflect(-V, N);
    R.y = max(R.y, 0.0) + sigma * 0.9 + 0.01;
    return normalize(R);
}

// Sun glitter: Cook-Torrance with a GGX lobe.
float3 waterSunSpecular(float3 N, float3 V, float3 L, float3 sunColor, float alpha2) {
    float3 H = normalize(V + L);
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
float3 waterBody(float3 refraction, float thickness, float3 N, float3 V, float3 L,
               float3 sunColor, float3 skyAmbient, float crest, WaterMaterial m) {
    float3 T = exp(-m.extinction * thickness);
    float3 lightIn = sunColor * (max(L.y, 0.0) / WATER_PI) + skyAmbient;
    float3 deep = m.scatterColor * lightIn;
    // sunlight entering the back of a wave and leaving towards the eye
    float3 Lb = normalize(L + N * 0.4);
    float through = pow(waterSaturate(dot(V, -Lb)), 3.0);
    float facing = 0.15 * waterSaturate(L.y * 3.0);
    float sss = (through + facing) * crest * m.sssStrength;
    // daylight from the sky behind a wave shining through its thin crest: the green glow of a
    // storm sea, which the sun alone cannot give once clouds have hidden it
    float3 Ls = normalize(float3(-V.x, 0.35, -V.z) + N * 0.4);
    float behind = pow(waterSaturate(dot(V, -Ls)), 2.0);
    float3 skyGlow = m.sssColor * skyAmbient * (behind * crest * crest * m.sssStrength * 0.35);
    float3 scatter = deep + m.sssColor * sunColor * (sss / WATER_PI) + skyGlow;
    return refraction * T + scatter * (1.0 - T);
}

// Full surface: body + reflection + sun glitter, then foam on top.
//   reflection  sky / probe radiance along waterReflectDir(...)
//   foam        0..1 coverage after the foam pattern has been applied
//   foamN       the normal the foam is lit with: N bumped by WaterFoam.height (waterBumpNormal), or N
//   foamShade   how much light the foam's own surface catches (WaterFoam.shade; 1 = flat)
float3 waterShadeFoam(float3 N, float3 foamN, float3 V, float3 L, float3 sunColor, float3 skyAmbient,
                    float3 reflection, float3 refraction, float thickness,
                    float crest, float foam, float foamShade, float lostSlopeVariance, WaterMaterial m) {
    float alpha2 = waterAlpha2(m.roughness, lostSlopeVariance);
    float sigma = sqrt(alpha2);                    // every unresolved slope, the base ripples included, dulls the mirror
    float NdotV = max(dot(N, V), 1e-3);
    float F = waterFresnel(NdotV, sigma);
    float3 body = waterBody(refraction, thickness, N, V, L, sunColor, skyAmbient, crest, m);
    float3 col = body * (1.0 - F) + reflection * F + waterSunSpecular(N, V, L, sunColor, alpha2) * m.specular;
    // foam: a matte, slightly translucent white mass that stands a little proud of the water. Thick foam
    // is near white; thin foam takes on the colour of the water under it and lets its light through;
    // foam on the shadowed side of a wave or of its own lumps is darker, and so are its hollows.
    float thick = smoothstep(0.15, 0.95, foam);
    float3 foamAlbedo = m.foamColor * lerp(float3(0.66, 0.78, 0.84), float3(0.9), thick) * foamShade;
    float wrapL = waterSaturate(dot(foamN, L) * 0.5 + 0.5);
    float3 foamLit = foamAlbedo * (sunColor * (wrapL * waterSaturate(L.y * 4.0 + 0.1) / WATER_PI) + skyAmbient * (0.4 + 0.6 * waterSaturate(foamN.y)));
    foamLit += body * (1.0 - thick) * 0.6;
    return lerp(col, foamLit, foam);
}

float3 waterShade(float3 N, float3 V, float3 L, float3 sunColor, float3 skyAmbient,
                float3 reflection, float3 refraction, float thickness,
                float crest, float foam, float lostSlopeVariance, WaterMaterial m) {
    return waterShadeFoam(N, N, V, L, sunColor, skyAmbient, reflection, refraction, thickness, crest, foam, 1.0, lostSlopeVariance, m);
}

// A normal bumped by a height field, from screen-space derivatives (Mikkelsen 2010, "Bump
// mapping unparametrized surfaces on the GPU"): dpdx, dpdy = dFdx/dFdy of the world position,
// dhdx, dhdy = dFdx/dFdy of the height in metres. Used to light foam with its own lumps.
float3 waterBumpNormal(float3 N, float3 dpdx, float3 dpdy, float dhdx, float dhdy) {
    float3 r1 = cross(dpdy, N), r2 = cross(N, dpdx);
    float det = dot(dpdx, r1);
    float3 g = (det < 0.0 ? -1.0 : 1.0) * (dhdx * r1 + dhdy * r2);
    return normalize(abs(det) * N - g);
}

// ---------------------------------------------------------------------------
//  Procedural foam: domain-warped noise for the patches, cellular noise for the lace
//  at their edges. Swap waterFoamLace() for a real foam texture if you have one.
// ---------------------------------------------------------------------------
float2 waterHash22(float2 p) {
    uint2 q = uint2(int2(floor(p)));
    q = q * uint2(1597334673u, 3812015801u);
    uint n = (q.x ^ q.y) * 1597334673u;
    uint2 r = uint2(n, n * 48271u);
    return float2(r) * (1.0 / 4294967295.0);
}

// distance to the nearest and second-nearest cell centre
float2 waterCells(float2 p) {
    float2 ip = floor(p), fp = frac(p);
    float2 d = float2(8.0, 8.0);
    WATER_LOOP for (int y = -1; y <= 1; y++)
        WATER_LOOP for (int x = -1; x <= 1; x++) {
            float2 g = float2(float(x), float(y));
            float2 r = g + waterHash22(ip + g) - fp;
            float e = dot(r, r);
            if (e < d.x) { d.y = d.x; d.x = e; } else if (e < d.y) d.y = e;
        }
    return sqrt(d);
}

float waterNoise(float2 p) {
    float2 i = floor(p), f = frac(p);
    float2 u = f * f * (3.0 - 2.0 * f);
    float a = waterHash22(i).x, b = waterHash22(i + float2(1.0, 0.0)).x;
    float c = waterHash22(i + float2(0.0, 1.0)).x, d = waterHash22(i + float2(1.0, 1.0)).x;
    return lerp(lerp(a, b, u.x), lerp(c, d, u.x), u.y);
}

// Octaves of value noise for foam, roughly 0..1 around 0.5. 'scale' is the frequency of the
// first octave in cycles per metre; each octave fades to its mean once its features get
// smaller than about two pixels, so distant foam averages out instead of shimmering.
float waterFoamFbm(float2 p, float footprint, float scale) {
    float s = 0.0, norm = 0.0, a = 1.0, f = scale;
    WATER_LOOP for (int i = 0; i < 4; i++) {
        float keep = clamp(0.5 / (footprint * f) - 0.5, 0.0, 1.0);
        s += a * keep * (waterNoise(p * f) - 0.5);
        norm += a;
        p = float2(0.8 * p.x - 0.6 * p.y, 0.6 * p.x + 0.8 * p.y) + 13.7;     // turn each octave, so they never line up
        f *= 2.13; a *= 0.55;
    }
    return 0.5 + 1.7 * s / norm;
}

// Foam lace: the walls between the bubbles and holes of a foam sheet. 1 on a wall, falling
// to 0 in the middle of a hole and spread fairly evenly in between, so a threshold on it
// picks out thin threads (high threshold), a sheet with holes (middle) or nearly solid foam
// (low). Cells of two sizes (20-30 cm, with the mix and the wall thickness changing from
// place to place) give the bubble walls; blobs of noise of every size from 40 cm down
// give holes of every size and shape, so the walls never tile into a net or a honeycomb;
// fine 9 cm cells give the smallest bubbles. Returns 0.5, its mean, once the walls are
// below a pixel.
float waterFoamLace(float2 q, float footprint) {
    float w1 = clamp(0.055 / footprint - 0.5, 0.0, 1.0);                  // fades out before the walls get thinner than a pixel
    if (w1 <= 0.0) return 0.5;
    float2 bend = float2(waterNoise(q * 1.3 + 4.0), waterNoise(q * 1.3 + 19.0)) - 0.5;
    bend += (float2(waterNoise(q * 3.1 + 11.0), waterNoise(q * 3.1 + 23.0)) - 0.5) * 0.5;
    float big = smoothstep(0.3, 0.7, waterNoise(q * 0.45 + 51.0));        // larger bubbles in some places, smaller in others
    float tw = 0.4 + 0.35 * waterNoise(q * 0.7 + 7.0);                    // walls of every thickness
    float2 ca = waterCells(q * 3.2 + bend * 0.8);
    float2 cb = waterCells(q * 5.5 + bend * 1.1 + 17.0);
    float l1 = lerp(1.0 - smoothstep(0.0, tw * 0.9, cb.y - cb.x), 1.0 - smoothstep(0.0, tw, ca.y - ca.x), big);
    float blobs = waterFoamFbm(q + 23.0, footprint, 2.5);                 // holes of every size and shape
    float w2 = clamp(0.018 / footprint - 0.5, 0.0, 1.0);
    float l2 = 0.5;
    if (w2 > 0.0) {
        float2 c2 = waterCells(q * 11.0 + bend * 1.6 + 31.0);
        l2 = lerp(0.5, 1.0 - smoothstep(0.0, 0.5, c2.y - c2.x), w2);
    }
    return lerp(0.5, 0.35 * l1 + 0.45 * blobs + 0.2 * l2, w1);
}

// A layer of foam: how much it covers, how much light its own surface catches, and how far
// it stands proud of the water (for lighting its lumps, see waterBumpNormal).
struct WaterFoam {
    float cover;   // opacity 0..1
    float shade;   // ~0.7..1.15: clumps and lines of foam catch the light, the hollows between them are darker
    float height;  // metres above the water, 0 to 6 cm; flattens out with distance
};

// Foam density 0..1 in, a foam layer out, with wind streaks (a density from waterWindStreaks)
// laid in along the wind.
//   p          rest position in metres (so the foam rides the waves)
//   windDir    unit vector; foam is drawn out along it (the wind, or the way surf travels)
//   footprint  metres of sea per pixel; detail smaller than that fades to its mean
// Foam is a sheet of bubbles. How full the sheet is comes from the density, varied from
// patch to patch by domain-warped noise; the sheet is cut from the lace above, so fresh
// foam is nearly solid, older foam is a sheet with holes, and the oldest is loose threads,
// and the edge of every patch comes apart the same way. The holes in a sheet still hold a
// veil of finer bubbles, and thin foam lets the water show through. Far away only the
// average whiteness is left, so nothing shimmers.
WaterFoam waterFoamLayer(float2 p, float2 windDir, float density, float streak, float footprint) {
    WaterFoam f;
    f.cover = 0.0; f.shade = 1.0; f.height = 0.0;
    float d = max(density, streak);
    if (d <= 0.01) return f;
    float2 side = float2(-windDir.y, windDir.x);
    float2 q = float2(dot(p, windDir) * 0.55, dot(p, side));                       // drawn out along the wind
    float2 warp = float2(waterFoamFbm(q + 5.2, footprint, 0.16), waterFoamFbm(q + 41.3, footprint, 0.16)) - 0.5;
    q += warp * 2.2;                                                           // organic, not grid-like
    float n = waterFoamFbm(q, footprint, 0.5);                                 // patches, 2 m down to 20 cm
    float C = smoothstep(0.0, 0.65, d);                                        // how full the sheet is, on average
    float fill = clamp(C + (n - 0.5) * 1.3, 0.0, 1.0);                         // ... and here
    float lace = waterFoamLace(q * float2(1.4, 1.0), footprint);
    float grain = waterFoamFbm(q * 1.7 + 77.0, footprint, 2.0);
    lace += (grain - 0.5) * 0.35;                                              // ragged, uneven walls
    float sharp = min(0.1 + 2.5 * footprint, 0.5);                             // soft bubble edges, never stair-stepped
    float cover = smoothstep(1.0 - fill - sharp, 1.0 - fill + sharp, lace);
    cover = lerp(fill * 0.3, 1.0, cover);                                       // a veil of finer bubbles in the holes
    cover = lerp(cover, fill * (1.3 - 0.3 * fill), smoothstep(0.035, 0.11, footprint));   // bubbles too small to see: just how full
    cover = lerp(cover, C * (1.3 - 0.3 * C), smoothstep(0.6, 3.0, footprint));             // far away, only the average is left
    // even thick foam is not flat white: it is thicker in clumps and in lines drawn out along the
    // flow, thinner between them, where the water shows through, and its hollows are darker
    float lines = lerp(0.5, waterNoise(q * float2(0.9, 5.0) + 61.0), clamp(0.05 / footprint - 0.5, 0.0, 1.0));
    float body = smoothstep(0.2, 0.8, grain * 0.6 + lines * 0.4);
    f.cover = cover * lerp(0.5, 1.0, fill) * lerp(0.62, 1.0, body);              // thin foam lets the water show through
    f.shade = lerp(0.8, 1.08, grain) * lerp(0.88, 1.06, lines);
    f.height = (cover * 0.5 + body * 0.5) * 0.06 * (1.0 - smoothstep(0.05, 0.4, footprint));
    return f;
}

float waterFoamMaskStreaks(float2 p, float2 windDir, float density, float streak, float footprint) {
    return waterFoamLayer(p, windDir, density, streak, footprint).cover;
}

float waterFoamMask(float2 p, float2 windDir, float density, float footprint) {
    return waterFoamLayer(p, windDir, density, 0.0, footprint).cover;
}

// Strong wind draws old foam out into long streaks along the wind (Beaufort 7 and up).
// Returns a streak density for waterFoamMaskStreaks(); amount = 0 below ~11 m/s, ~0.6 in a
// gale, up to 0.9 in a hurricane, where the streaks crowd together until the sea is white.
float waterWindStreaks(float2 p, float2 windDir, float amount, float footprint) {
    amount *= 1.0 - smoothstep(1.5, 5.0, footprint);
    if (amount <= 0.0) return 0.0;
    float2 q = float2(dot(p, windDir), dot(p, float2(-windDir.y, windDir.x)));
    q.y += 7.0 * waterNoise(q * float2(0.012, 0.06));                        // streaks wander a little
    float n = waterNoise(q * float2(0.02, 0.6)) * 0.5 + waterNoise(q * float2(0.05, 1.6) + 13.0) * 0.32
            + waterNoise(q * float2(0.11, 4.3) + 29.0) * 0.18;               // a broad band, and fine lines beside it
    float lo = 0.66 - 0.18 * amount;
    return amount * smoothstep(lo, lo + 0.2, n);
}

// Rain: rings spreading from random drops. Returns a slope to subtract from the
// normal (n.xz -= slope * n.y). amount 0..1; fades out once rings are sub-pixel.
float2 waterRainRipples(float2 p, float time, float amount, float footprint) {
    amount *= 1.0 - smoothstep(0.03, 0.12, footprint);
    if (amount <= 0.0) return float2(0.0, 0.0);
    float2 slope = float2(0.0, 0.0);
    WATER_LOOP for (int layer = 0; layer < 3; layer++) {
        float fl = float(layer);
        float2 q = p * (1.15 + 0.45 * fl) + fl * 17.3;               // one drop per cell, cells 0.5 to 0.9 m
        float2 cell = floor(q);
        float2 h = waterHash22(cell + fl * 7.0);
        float clock = time * (0.9 + 0.5 * h.x) + h.y * 13.0;      // every cell drips on its own clock
        float t = frac(clock);
        float2 centre = 0.36 + 0.28 * waterHash22(cell + floor(clock) * 3.0 + 91.0);
        float2 d = frac(q) - centre;
        float r = length(d);
        float ring = r - t * 0.34;
        float wave = sin(ring * 42.0) * exp(-ring * ring * 130.0) * (1.0 - t) * (1.0 - t);
        slope += d * (wave / max(r, 1e-3));
    }
    return slope * (0.5 * amount);
}

#endif // WATER_SHADING_HLSL
