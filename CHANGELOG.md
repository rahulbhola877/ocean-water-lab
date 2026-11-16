# Changelog

## 1.1.0

- **Water Lite** (`lite/`): a separate, single-file engine for low-end and stylized browser games.
  - Views: a 3D ocean, a 2D side view and a 2D top-down view.
  - Art styles: realistic, toon, pixel art, low poly, retro and ink.
  - Retro palettes with clean ordered dithering, and four quality presets.
  - Transparent water-only output and a custom land map for the top view.
  - A demo page that copies the exact setup code.

## 1.0.0

First public release.

- **Waves:** FFT ocean (4 cascades) with an analytic Gerstner fallback, sharing shading and physics.
- **Light:** physical sky and volumetric clouds, sun shadows, planar reflections, refraction, caustics, crest glow.
- **Shore:** breaking surf with streaky breaker foam, tides, wet sand, reef patches.
- **Weather:** heavy rain (streaks, splashes, curtains, lens drops), gust fronts, spindrift, lightning, rogue waves, slicks, bioluminescence.
- **Vessels:** a planing speedboat and a sailing pirate ship with cannons, chase camera and driving HUD.
- **Lab:** nine game-look scenes, an advanced panel with about 100 parameters, and export to JSON, kit uniforms, Unity, Unreal and Godot.
- **Media:** cinematic tour, a built-in 1080p video recorder, procedural sound.
- **Ports:** HLSL generated from GLSL; C++ and C# buoyancy and analytic sea.
