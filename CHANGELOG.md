# Changelog

## 1.2.0

- **Water Lite 2:** rebuilt around clear, see-through water.
  - **Layered rendering:** everything under the surface is drawn first. The water then refracts it, tints it by depth with per-colour absorption, and lights it with caustics traced through the ripples. Shoreline foam comes from the real water depth.
  - **3D:** islands with beaches, palms and rocks; a shallow lagoon calmed by the reef; reflections of the islands; shadows of floating things on the sand.
  - **Side view:** a reef, seaweed, fish, a cliff and a dock seen through the water, plus light shafts and the world above mirrored near the surface.
  - **Top view:** an elevation map with a visible seabed, waves washing up the beach, rock heads, fish in the shallows, and shadows on the bottom.
  - **New options:** `clarity`, `reflections` and a `tint` colour.
  - **Better stylized looks:** pixel art saturates before snapping to the palette; toon and pixel water comes in clean depth steps.

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
