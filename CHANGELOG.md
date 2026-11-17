# Changelog

## 1.5.0

Physics: the gaps in storms, under water and at the shore, closed in both engines. Waves can now capsize boats.

- **Full lab and kit (JS, C++, C#)**
  - **Breaking crests.** Where the water at a crest accelerates downward faster than a threshold, the crest is breaking: its roller drives the water near the surface forward and slams into the topsides above it. `breakingAccel(share)` sets the threshold so the share of the sea breaking matches the whitecap cover for the wind (Monahan), and the FFT lab keeps it adapting to the water the bodies meet. New config: `breakSpeed`, `breakAccel`, `rollerHeight`.
  - **Depth fade.** Wave motion fades with depth as exp(-2π d / L), so sunk objects and deep keels no longer feel the full surface motion (`decayWavelength`).
  - **Wind** on the parts above water (`windX`, `windZ`, `airDrag`, `windArea`), following the visible gust fronts in the lab. With `linearDragH` lowered, flotsam drifts downwind at about 1.5 % of the wind speed.
  - **Currents** (`currentX`, `currentZ`); in the lab, *Current* and *Current heading* under Physics.
  - **Surf and rogue waves move the water,** not just its height: surf runs shoreward at η√(g/h) and breaks as a bore; a rogue wave has its own orbital motion, fading with its own wavelength.
  - **Flooding, capsizing, righting** (lab): open hulls take green water over the deck edge and float lower; a boat past 90° for 1.5 s capsizes and stays over (a hull turned over traps air). Press **R** to right her, or the autopilot's crew does after 5 s.
  - **Collisions** (lab): bodies collide as boxes with impulses at the contact point, so a knock can spin or tip them.
  - **Ships:** roll and pitch damping only in the water, and lighter, so a ship heels and rolls in a storm; on autopilot she reefs in a blow. The speedboat's keel and planing lift only work the right way up.
  - **Storm scenes carry a vessel:** Hurricane brings the speedboat (with rogue waves, so you can watch her capsize and be righted) and Pirate Storm the ship.
  - The C++ port matches the JavaScript to 7e-13 including the new terms; `tools/physics.mjs` checks the outcomes in the running lab.
- **Water Lite 2.3**
  - **3D rigid bodies:** crates, barrels, buoys and the sailing boat are point-sampled rigid bodies on the Gerstner water, with its velocity and acceleration, depth fade, breaking crests, wind, the seabed and box collisions. Floaters ride slack moorings. The boat sails her circle on an autopilot with engine, keel, rudder and a sail that heels her (she eases the sheet when she heels far).
  - **Side view:** horizontal orbital flow fading with depth, plus the flow feeding the ripples; breaking crests (faces steeper than about 22°); wind on hulls and the boat's sail, which drags when it is under water (so a boat turned over stays turtled); flooding; the seabed under each hull corner with friction, so sunk things lie flat.
  - **Top view:** the wind and current set the boat and floaters drifting, and ripples shove the boat.
  - **API:** `capsize` and `righted` events, `rightBoat()`, options `autoRight`, `current`, `currentDir`, and `water.cam.follow` for a 3D camera that glides after the boat (the demo's **Follow boat**, on from the start on a tall phone screen).
  - Crates and barrels carry their weight low, so they float the right way up (a uniform cube floats corner-up).

## 1.4.0

- **Water Lite 2.2:** the weak spots from 2.1, fixed.
  - **Top-down sunsets stay readable:** a low sun no longer leaves the map dark. The top view lights from at least about 35° up and keeps the sun's direction and long shadows, so pixel art keeps green islands at sunset.
  - **Big maps stay sharp:** full detail up to nine times the standard area. Ripples are simulated only around the view, with a soft edge, so a zoomed-in big map costs about what the standard one does. Big maps are also faster to generate.
  - **Lightning on your terms:** `lightning` sets random strikes a minute (0 turns them off, any rate in any mood).
  - **Old phones:** every animation phase is worked out on the CPU and kept small, so medium-precision GPUs keep animating smoothly. The rain overlay no longer needs large numbers. The 3D sea's texture coordinates are taken near the camera. `stats.gpu` and `stats.highp` say what the device has.
  - **Floating things collide:** in the side view they push apart and tip off each other; in the top view the boat shoves crates aside.
  - **Your own 3D islands:** `islands: [{ x, z, r, hill }]`.
  - **Steadier shoreline:** a tighter depth range doubles precision where beach meets sea.
  - **Demo on phones:** settings fold into a bottom sheet, the hint and frame counter no longer overlap, hold to steer the boat, and **Test this device** names the GPU.

## 1.3.0

- **Water Lite 2.1:** the gaps a real game hits.
  - **Moods:** `mood: 'day' | 'sunset' | 'night' | 'storm'`.
    - Sunset: a low sun, a glitter path, and a sky from indigo through rose to orange.
    - Night: moon, stars (also in the water), moonlight that drains colour, and foam, wakes and splashes that glow.
    - Storm: overcast, more wind, murkier water, rain and lightning with bolts.
    - Palette styles get gentler moods that land on palette colours; ink turns to chalk at night.
  - **Rain** (`rain`, 0 to 1): streaks at game resolution, rings on the 3D and top-down water, drops in the ripple simulation, spray in the side view.
  - **2D cameras:** a side world wider than the screen (`worldWidth`, `camera2d.x`) with parallax; bigger top-down maps (`mapSize`) with `zoom` and a camera that can follow the boat or your player. Pixel styles scroll in whole pixels.
  - **Events:** `on('splash')` and `on('lightning')` for sound; `lightning()` strikes on demand.
  - **Performance tools:** `quality: 'auto'` adjusts the drawing resolution from frame times (and notices when the game is CPU-bound or capped); `benchmark()` times each preset and recommends one; `stats.fps` and `stats.scale`.
  - **Robustness:** a lost WebGL context is rebuilt from CPU copies; shaders compile only for the view in use; the start-up textures are about 30 % faster to make (byte-identical) and shared between engines.
  - **Polish:** the 3D waterline runs up and down the beach; terrain gets ambient occlusion; top-down coastlines stay organic when zoomed in.
  - The demo gains time and weather, Auto quality, Test this device, camera controls and procedural sound.

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
