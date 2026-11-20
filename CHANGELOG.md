# Changelog

## 1.6.2

The grenade, with the violence of a blast under water.

- **The shock arrives strong over a wide circle.** Water barely compresses, so an underwater blast carries its pressure much further than one in air. The surface is torn into spray wherever the shock throws it up faster than 1.5 m/s: about 6 m around for a grenade 2.4 m down, at 15 m/s over the charge. It flashes up white all at once.
- **A plume that bursts.** Its water leaves at 20 to 40 m/s and drag on the fine spray stops it within metres, so the column is up in a fraction of a second, then hangs and falls, the heavy water first. Spray particles now each have their own drag: fine spray stalls, big drops carry. A base surge of water is thrown out low around its foot, and the falling water pocks the surface.
- **A jolt.** The camera shakes when a blast goes off close by.
- Test clips can now take the lab's own sound with them (`soundTrack()` in the test hook).

## 1.6.1

The grenade, reworked.

- **The water heaves.** The shock lifts a dome of water over the charge, about 1 to 2 m for a grenade 2 to 3 m down. It rises in 0.2 s, then falls back and runs out as a ring of waves, carried by the ripple simulation; its heights are now allowed up to ±3 m (kit `ripple_sim.frag`). Anything floating on the dome rides it up, because the buoyancy now sees the dome.
- **A plume that reads as water.** A translucent core and a dozen or more slanted jets, drawn as streaks of drops rather than puffs: spray particles are now stretched along their motion, as in a short exposure, and water drops no longer swell as they fly (smoke and mist still do). Each drop catches the light a little differently.
- Fine spray from the torn surface, a white dome, the bubble's collapse, and a wider patch of white water when the column comes down.
- The grenade goes off 2.6 s after the throw, so it is 2 to 3 m down, where a grenade throws the most water.

## 1.6.0

Throw things in the water.

- **Pebble and stone.** Click the sea to throw one from where you stand (T throws at the middle of the view). It opens a cavity, throws up a crown of drops, and the cavity closing throws up a Worthington jet. You hear the plop of the bubble it leaves, and rings spread across the water. Then it sinks at its terminal speed and rests on the bottom.
- **Skimming stone.** It comes in low and flat from your side and skips while it meets the water at a shallow enough angle and fast enough, after Clanet, Hersen and Bocquet (2004). Each skip leaves a ring; five to nine skips is usual, then it sinks.
- **Grenade.** It sinks and goes off 3.2 s after the throw. The shock tears the surface into a white dome of spray and shoves everything floating nearby, by its impulse on the hull, no faster than the water under it. The gas breaks out as a ragged plume of jets a few metres high, its bubble collapses into rings of waves, and the column falls back as a patch of white water. A deep thump, the plume's roar and the hiss of it coming down follow, each delayed by its distance. Charge, bubble size and period, plume and shock follow Cole's similitude laws (1948, via Swisdak 1978).
- **Kit:** `impactSplash`, `skipBounce`, `underwaterBlast`, `blastPressure`, `blastImpulse` and `spallSpeed` in JavaScript, C++ and C# (`WaterImpacts`), cross-checked: C++ against JavaScript to 7e-13, C# against C++ to 3e-16. The C# file now compiles with Mono's `mcs`.
- The ripple and foam windows move over a splash that lands away from the middle of the view, for a while.
- Spray particles are launched fast enough to reach their heights against the particles' air drag.
- `tools/physics.mjs` checks the throws.

## 1.5.2

Demo videos, and what making them showed up.

- **Videos.** A one-minute look at what is new in the lab (`media/ocean-lab-whats-new.mp4`) and a live demo of Water Lite with every button (`media/water-lite-demo.mp4`), both rendered frame by frame in the browser on an ordinary laptop GPU.
- **The speedboat no longer sinks in a hurricane.** Her cockpit bails itself and a pump runs while she is upright, and water aboard costs at most 40 % of her lift (was 60 %), so in a storm she settles awash and keeps riding instead of slowly going under. A boat turned over still floods and stays over until she is righted.
- **Storm foam in streaks along the wind,** as at Beaufort 8 and up, instead of a sheet with round holes in it (kit `waterFoamMask`, GLSL and HLSL). Hurricane has a little less foam (0.8) that lasts 2.8 s.
- **What's new tour:** the breaking-crest shot looks down from higher, so the boat stays in view over the crests.
- **Film rendering keeps going in a background tab.** *Render film* in the lab no longer stalls when the page is hidden. The Water Lite demo page can render its tour to a 1080p MP4 too: `waterFilm()` in the console (`waterTour()` plays it live).

## 1.5.1

Storm lighting, made for a game rather than for footage through a wet camera.

- **No camera artefacts in the storms.** Raindrops on the lens are off (the setting stays, as *Camera lens drops*, for anyone who wants it), and film grain and the heavy vignette are gone from Hurricane and Pirate Storm. Rain no longer smears long streaks across the screen right in front of the eye.
- **Lightning lights the storm instead of whitening the screen.** A strike lights the cloud around it from inside, brightest low in the deck, and the rest of the sky catches only a little. The sea catches the strike on its side: glints on the waves and lit foam. All of it is scaled to the scene's exposure, so a dark storm no longer washes out to white; the screen-wide brightening is down from 50 % to 4 %, and the sky's frame smoothing stands aside during a strike so the light comes and goes with it.
- **Green light through the crests.** Daylight from the sky behind a wave now shines through its thin crest (kit `waterBody`, GLSL and HLSL), so an overcast sea gets the teal glow of real storm water even with the sun hidden.
- **Foam that reads as foam.** Old foam turns into lace along the walls between bubbles, in patches and with threads of every thickness, instead of a grey sheet full of dark holes; foam is drawn out along the wind, thin old foam lets the water through, and wind streaks are long thin lines. Hurricane and Pirate Storm keep their foam for 3.5 s instead of 5–6 s, at normal strength.
- **A graded storm, not a grey one:** more colour and less crush in Hurricane and Pirate Storm, and Pirate Storm shows the shape of its clouds (88 % cover) with a lighter band on the horizon.

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
