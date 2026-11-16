#!/usr/bin/env python3
"""Generates kit/hlsl/*.hlsl from kit/glsl/*.glsl so the two cannot drift apart."""
import re, os
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'kit')

def to_hlsl(src, guard, header, uniforms):
    out = src.replace('''#ifndef WATER_WAVE_A
uniform vec4 uWaveA[WATER_TOTAL_WAVES];
uniform vec4 uWaveB[WATER_TOTAL_WAVES];
#define WATER_WAVE_A(i) uWaveA[i]
#define WATER_WAVE_B(i) uWaveB[i]
#endif''', uniforms)
    # HLSL has no single-scalar vector constructors
    out = re.sub(r'\bvec([234])\((0\.0|8\.0)\)', lambda m: 'float%s(%s)' % (m.group(1), ', '.join([m.group(2)] * int(m.group(1)))), out)
    out = re.sub(r'\buvec2\b', 'uint2', out)
    out = re.sub(r'\bivec([234])\b', r'int\1', out)
    out = re.sub(r'\bvec([234])\b', r'float\1', out)
    out = re.sub(r'\bmix\(', 'lerp(', out)
    out = re.sub(r'\bfract\(', 'frac(', out)
    out = re.sub(r'^(\s*)for \(', r'\1WATER_LOOP for (', out, flags=re.M)
    body = out[out.index('\n\n') + 2:]          # drop the GLSL banner
    loop = '#ifndef WATER_LOOP\n#define WATER_LOOP [loop]            // these loops exit early on data; do not let the compiler unroll them\n#endif\n\n'
    return header + '#ifndef %s\n#define %s\n\n' % (guard, guard) + loop + body.rstrip() + '\n\n#endif // %s\n' % guard

H1 = '''// ============================================================================
//  WATER KIT - wave core (HLSL: Direct3D 11/12, Unity, Unreal custom nodes)
// ----------------------------------------------------------------------------
//  Generated from glsl/water_waves.glsl - same functions, same names, same math.
//  Y is up and waves travel in the XZ plane. In a Z-up engine pass world.xy as
//  the position and swizzle the results (displacement.xzy, normal.xzy).
//
//  Per wave i the CPU uploads two float4 (see WaterPhysics.h / WaterPhysics.cs):
//    A = (dir.x, dir.z, wavenumber k, amplitude a)
//    B = (phase now, horizontal amplitude, wavelength, tail slope variance)
//  Positions passed to these functions are RELATIVE TO THE WAVE ORIGIN.
// ============================================================================
'''
U1 = '''#ifndef WATER_WAVE_A
float4 _WaterWaveA[WATER_TOTAL_WAVES];     // Unity: Shader.SetGlobalVectorArray("_WaterWaveA", ...)
float4 _WaterWaveB[WATER_TOTAL_WAVES];
#define WATER_WAVE_A(i) _WaterWaveA[i]
#define WATER_WAVE_B(i) _WaterWaveB[i]
#endif'''
H2 = '''// ============================================================================
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
'''
U3 = '''#ifndef WATER_DISP
Texture2DArray _WaterDisp;      // (Dx, Dy, Dz, foam) per cascade, mip-mapped
Texture2DArray _WaterDeriv;     // (dh/dx, dh/dz, dDx/dx, dDz/dz)
Texture2DArray _WaterMom;       // (dDx/dz, (dh/dx)^2, (dh/dz)^2, dh/dx * dh/dz)
SamplerState sampler_WaterDisp; // trilinear, anisotropic, repeat
#define WATER_DISP(uv, c, lod) _WaterDisp.SampleLevel(sampler_WaterDisp, float3(uv, float(c)), lod)
#define WATER_DISP_AUTO(uv, c) _WaterDisp.Sample(sampler_WaterDisp, float3(uv, float(c)))
#define WATER_DERIV(uv, c) _WaterDeriv.Sample(sampler_WaterDisp, float3(uv, float(c)))
#define WATER_DERIV_LOD(uv, c, lod) _WaterDeriv.SampleLevel(sampler_WaterDisp, float3(uv, float(c)), lod)
#define WATER_MOM(uv, c) _WaterMom.Sample(sampler_WaterDisp, float3(uv, float(c)))
#define WATER_MOM_LOD(uv, c, lod) _WaterMom.SampleLevel(sampler_WaterDisp, float3(uv, float(c)), lod)
#endif'''
GLSL_TEX = '''#ifndef WATER_DISP
uniform sampler2DArray uWaterDisp;
uniform sampler2DArray uWaterDeriv;
uniform sampler2DArray uWaterMom;
#define WATER_DISP(uv, c, lod) textureLod(uWaterDisp, vec3(uv, float(c)), lod)
#define WATER_DISP_AUTO(uv, c) texture(uWaterDisp, vec3(uv, float(c)))
#define WATER_DERIV(uv, c) texture(uWaterDeriv, vec3(uv, float(c)))
#define WATER_DERIV_LOD(uv, c, lod) textureLod(uWaterDeriv, vec3(uv, float(c)), lod)
#define WATER_MOM(uv, c) texture(uWaterMom, vec3(uv, float(c)))
#define WATER_MOM_LOD(uv, c, lod) textureLod(uWaterMom, vec3(uv, float(c)), lod)
#endif'''
H3 = '''// ============================================================================
//  WATER KIT - FFT ocean, sampling for materials and physics (HLSL)
// ----------------------------------------------------------------------------
//  Generated from glsl/fft/water_cascades.glsl - same functions, same names.
//  Bind the three Texture2DArrays the FFT passes produce (one layer per
//  cascade) and set _WaterCascade / _WaterOffset from the host
//  (WaterFFT.Ocean.bind() shows the values). Y up, metres, positions relative
//  to the wave origin.
// ============================================================================
'''
H4 = '''// ============================================================================
//  WATER KIT - FFT ocean, pass logic (HLSL: compute shaders or blits)
// ----------------------------------------------------------------------------
//  Generated from glsl/fft/water_fft.glsl - same functions, same names.
//  Each pass is a function of one texel: call it from a compute kernel
//  ([numthreads(8,8,1)], one thread per cell) or a full-screen pixel shader.
//  The GLSL wrappers in glsl/fft/fft_*.frag show the fetches each pass needs.
// ============================================================================
'''

H5 = '''// ============================================================================
//  WATER KIT - breaking surf on a sloping shore (HLSL)
// ----------------------------------------------------------------------------
//  Generated from glsl/water_surf.glsl - same functions, same names, same math.
//  Define WATER_SURF_DEPTH(p) (water depth in metres at world xz) before
//  including; set _WaterSurf = (height m, period s, breaker index, foam gain).
// ============================================================================
'''
H6 = '''// ============================================================================
//  WATER KIT - sea-surface weather (HLSL): rogue waves, gust fronts, slicks
// ----------------------------------------------------------------------------
//  Generated from glsl/water_weather.glsl - same functions, same names, same math.
//  Set _WaterRogueA/B, _WaterGust and _WaterSlick from the host (see the GLSL
//  header for what each component means).
// ============================================================================
'''
os.makedirs(os.path.join(ROOT, 'hlsl'), exist_ok=True)
for src, dst, guard, head, uni in [('water_waves.glsl', 'WaterWaves.hlsl', 'WATER_WAVES_HLSL', H1, U1),
                                   ('water_shading.glsl', 'WaterShading.hlsl', 'WATER_SHADING_HLSL', H2, ''),
                                   ('fft/water_fft.glsl', 'WaterFFT.hlsl', 'WATER_FFT_HLSL', H4, ''),
                                   ('fft/water_cascades.glsl', 'WaterCascades.hlsl', 'WATER_CASCADES_HLSL', H3, ''),
                                   ('water_surf.glsl', 'WaterSurf.hlsl', 'WATER_SURF_HLSL', H5, ''),
                                   ('water_weather.glsl', 'WaterWeather.hlsl', 'WATER_WEATHER_HLSL', H6, '')]:
    raw = open(os.path.join(ROOT, 'glsl', src)).read()
    if 'cascades' in src:
        assert GLSL_TEX in raw, 'texture block changed in water_cascades.glsl'
        raw = raw.replace(GLSL_TEX, U3)
        raw = raw.replace('uniform vec4 uWaterCascade[WATER_CASCADES];', 'float4 _WaterCascade[WATER_CASCADES];')
        raw = raw.replace('uniform vec4 uWaterOffset[WATER_CASCADES];', 'float4 _WaterOffset[WATER_CASCADES];')
        raw = re.sub(r'\buWaterCascade\b', '_WaterCascade', raw)
        raw = re.sub(r'\buWaterOffset\b', '_WaterOffset', raw)
    if 'weather' in src:
        for nm in ['RogueA', 'RogueB', 'Gust', 'Slick']:
            raw = raw.replace('uniform vec4 u%s;' % nm, 'float4 _Water%s;' % nm)
            raw = re.sub(r'\bu%s\b' % nm, '_Water' + nm, raw)
    if 'surf' in src:
        raw = raw.replace('uniform vec4 uSurf;', 'float4 _WaterSurf;')
        raw = raw.replace('uniform vec4 uSurfFoam;', 'float4 _WaterSurfFoam;')
        raw = re.sub(r'\buSurf\b', '_WaterSurf', raw)
        raw = re.sub(r'\buSurfFoam\b', '_WaterSurfFoam', raw)
    text = to_hlsl(raw, guard, head, uni)
    code = re.sub(r'//[^\n]*', '', text)
    left = re.findall(r'\b(?:vec[234]|mix|fract|uniform|ivec\d|uvec\d|mat[234])\b', code)
    assert not left, left
    open(os.path.join(ROOT, 'hlsl', dst), 'w').write(text)
    print('wrote', dst, len(text.splitlines()), 'lines')
