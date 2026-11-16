# Water Lite

Clear, stylized real-time water for low-end browser games. It is one JavaScript file with no dependencies, and it runs on WebGL 1 without extensions.

![Water Lite in three views and six art styles](../media/lite-grid.jpg)

The water is see-through. Everything under the surface is drawn first: the seabed, rocks, seaweed, fish, and the sunken half of anything floating. The water is then drawn from that picture:

- bent by the waves (refraction)
- tinted by how much water the light passes through, with red fading first, so shallow water over sand turns turquoise and deep water turns blue
- lit by moving caustics on the bottom
- marked with foam where it meets the shore
- shading the bottom under boats and crates

The simulation is identical in every art style; only the drawing changes. A pixel-art game gets the same clear shallows, buoyancy, wakes and ripples as a realistic one.

## Views

- **`3d`: islands in a lagoon.**
  - Beaches, palms and rocks.
  - Shallow water you can see the sand through, then a reef edge dropping to deep blue.
  - Gerstner waves from a wind spectrum, calmed inside the reef. The CPU reads the same heights, so objects float on the waves you see.
  - Reflections of the sky and of the islands.
- **`side`: a 2D side view for platformers.**
  - The surface is a row of springs on top of a swell.
  - Through it you see a reef, seaweed swaying, fish that dart away from splashes, a cliff and dock posts reaching the seabed, and light shafts.
  - Crates, barrels, ducks and boats float, tip, right themselves and splash when they drop in.
  - Near the surface the water also mirrors the world above it.
- **`top`: a 2D top-down view for RPGs and strategy games.**
  - The seabed shows through the shallows.
  - Ripples follow a wave equation and bounce off coastlines.
  - Waves wash up the beach and leave wet sand. Rock heads poke out with foam around them.
  - Fish swim in the shallows, and a boat leaves a wake. Floating things cast shadows on the bottom.

## Art styles

`realistic`, `toon`, `pixel`, `lowpoly`, `retro` (PS1-style: 15-bit colour, dithering, vertex wobble, scanlines) and `ink` (pen on paper, with hatching and map-style coastlines).

- **Pixel art:** the scene renders at low resolution and is scaled up in whole pixels. Palettes are PICO-8, Sweetie 16, Game Boy, Ocean 8 and 1-bit. Colour is saturated before it snaps to the palette, and dithering only appears where two palette colours meet.
- **Toon and pixel:** water colour comes in clean steps of depth, with crisp foam and caustics.

## Try it

Open `lite/index.html` in a browser. The demo has every option, and **Copy code** gives you the exact `new WaterLite(...)` call for what you see.

## Use it

```html
<canvas id="water" style="width: 100%; height: 100%"></canvas>
<script src="water-lite.min.js"></script>
<script>
  var water = new WaterLite(document.getElementById('water'), { mode: 'top', style: 'pixel' });
  var last = performance.now();
  function frame(now) {
    water.update((now - last) / 1000);   // seconds; capped at 0.1 internally
    water.render();                      // sizes the canvas from its CSS size
    last = now;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
</script>
```

### In an existing game

- **Water as a layer.** Create the engine with `{ transparent: true, scenery: false }` and put its canvas above or below your game canvas.
  - 3D: draws the sea alone.
  - Side view: the sky is transparent and the water is a translucent tint over whatever is behind it.
  - Top view: the land is transparent.
- **Your own physics.** `water.sample(x, z)` returns the surface at a point:
  - 3D: `{ height, normal }` at world `x, z`.
  - Side view: `{ height }` at `x` in view units (up is positive).
  - Top view: the ripple height at world `x, y`.
- **Things floating.** `water.addFloater(x, y, { kind, size, density })` adds a body that the engine simulates and draws.
  - Side view: `crate`, `barrel`, `duck`, `boat`.
  - Top view: `crate`, `barrel`.
  - 3D: `crate`, `barrel`, `buoy`.
- **Splashes.** `water.splash(x, y, power, radius)` makes waves, ripples or foam, and scares nearby fish.
- **Your own map.** `land: function (u, v) { return isLand(u, v); }` gives the top view your tilemap, with `u` and `v` running from 0 to 1 across the map. The function can also return a height. Beaches, the shelving seabed, coastline foam and depth colours all come from it.
- **Steering the boat.** In the top view, set `water.input.up`, `.down`, `.left` and `.right` to true or false. The demo maps WASD and the arrow keys to these.

### Coordinates

| View | Units | Size |
| --- | --- | --- |
| `3d` | metres, y up, sea level 0 | an island at (0, −42); the camera looks at `water.cam.target` |
| `side` | view units, y down | 480 wide, height from the canvas aspect; water line at `level` × height |
| `top` | world units (about a metre), y down | 160 × 90, fitted to the canvas without stretching |

`water.screenToWorld(x, y)` converts CSS pixels on the canvas into these units.

## Options

Pass options to the constructor, or change them later with `water.setOptions({...})`.

| Option | Default | What it does |
| --- | --- | --- |
| `mode` | `'3d'` | `'3d'`, `'side'` or `'top'` |
| `style` | `'realistic'` | `'realistic'`, `'toon'`, `'pixel'`, `'lowpoly'`, `'retro'`, `'ink'` |
| `quality` | `'low'` | `'potato'`, `'low'`, `'medium'`, `'high'` |
| `clarity` | `1` | how far you see into the water; 2 sees twice as deep |
| `reflections` | `true` | islands mirrored in the 3D sea (from `low` up); the world above mirrored near the surface in the side view |
| `palette` | `'auto'` | `'none'`, `'pico8'`, `'sweetie16'`, `'gameboy'`, `'ocean8'`, `'mono'`; `'auto'` uses the style's own |
| `pixelSize` | `0` | size of one game pixel in CSS pixels; 0 uses the style's own (4 for pixel, 3 for retro) |
| `dither` | `-1` | 0 to 1, how much of each colour transition is dithered; -1 uses the style's own |
| `wind` | `7` | wind speed in m/s, which sets wave size and length |
| `windDir` | `30` | wind direction in degrees |
| `waveHeight` | `1` | multiplies wave height |
| `choppiness` | `0.7` | 0 to 1, how sharp the crests are (3D) |
| `foam` | `1` | multiplies foam; 0 turns it off |
| `colors` | `null` | override any theme colour; see below |
| `sunElevation`, `sunAzimuth` | `42`, `215` | sun position in degrees |
| `scenery` | `true` | false draws only the water |
| `level` | `0.55` | side view: water line as a fraction of the height |
| `land` | `'islands'` | top view: `'islands'`, `'none'`, or `function (u, v)` that returns true or a height |
| `seed` | `7` | changes waves, islands and the top-view map |
| `floaters`, `boat` | `true` | the built-in floating objects and boat |

Colours you can override:

- **Water:**
  - `deep`: the colour of deep water.
  - `shallow`: lit shallow water.
  - `tint`: the colour water gives to what you see through it. It sets how fast each colour is absorbed, and defaults to `shallow`.
  - `foam`.
- **Sky:** `skyTop`, `skyHorizon` and `sun`.
- **Land and objects:** `sand`, `grass`, `rock`, `wood` and `paint`.
- **Ink style:** `paper` and `ink`.

Constructor only: `transparent` (default false) gives the canvas an alpha channel; `preserveDrawingBuffer` (default false) lets you read pixels back after a frame.

Other methods: `resize()`, `config()` (current options as JSON), `clearFloaters()`, `drop(x, y)` (the demo's click), `dispose()`.

## How it stays cheap

- **Textures made once, at start.** The ripple normals, foam lace, caustics, clouds and noise are made once (about 0.2 s) as tileable 256 × 256 textures. The shaders sample these instead of computing noise per pixel.
  - The caustics come from tracing light through the ripples onto a floor, and are sampled with a slow warp so they wobble like real ones.
- **Low resolution.** Each frame is drawn at low resolution: 75 % of the canvas width at `low`, and one sixteenth of the pixels in the `pixel` style. The palette and dither pass runs at that resolution too, then one cheap pass scales it up.
- **A few passes per frame.**
  - 2D views draw two full-screen passes plus a few sprites.
  - 3D draws the island scene into an under-water picture (half size at `potato`, three quarters at `low`, full size above), a half-size reflection picture (from `low` up), then the frame.
  - The terrain mesh has 81 × 81 to 201 × 201 vertices, depending on quality.
- **No heavy features.** No floating-point textures, no depth textures, no multiple render targets, no shadow maps. Shadows of floating things on the seabed are worked out per pixel from their positions.
- **Small simulations, on the CPU.**
  - Side view: up to 360 spring columns.
  - Top view: a ripple grid of 112 × 63 (`potato`) to 288 × 162 (`high`).
  - Ripples run at a fixed 60 steps a second and the springs at about 120, so they behave the same at 30 fps and 144 fps.
- **Device pixel ratio.** It is capped per preset (1, 1, 1.5, 2).

If a device struggles, try `quality: 'potato'` or a pixel style: both cut the pixels drawn by four or more.

About 130 KB of source, 94 KB minified, 32 KB gzipped. Most of that is shader text.

## Honest limits

- **3D**
  - The sea is a sum of Gerstner waves, not an FFT ocean. For that, use the main lab in this repository.
  - The island layout comes from `seed` and cannot be edited yet.
  - Floating objects use a spring float, not full rigid-body physics.
  - At a distance the beach and the sea can flicker where they meet, from depth-buffer precision.
- **Side view**
  - The surface is a height field, so waves cannot curl over.
  - Bodies collide with the cliff, the dock posts and the seabed, not with each other.
  - The scenery (cliff, dock, reef) is fixed. Turn `scenery` off to draw your own.
- **Top view**
  - Ripples are a wave equation, not shallow-water flow, so there are no currents.
  - The map is 160 × 90 world units with no scrolling camera.
- **All views**
  - Built-in objects are simple shapes. For your own sprites, use `sample()` and draw them yourself.
  - On very old phones whose GPUs have only medium precision in fragment shaders, fine texture detail can look blocky.
  - Without `OES_standard_derivatives`, low poly falls back to smooth shading and ink lines get a fixed width.
- **Testing.** It was tested in headless Chromium with a software renderer (see `tools/lite-smoke.mjs` and `tools/lite-shots.mjs`), not yet on a range of real low-end phones. Reports are welcome.

## Building

```sh
node lite/build.mjs          # lite/dist/water-lite.min.js and a single-file lite/dist/index.html
node tools/lite-shots.mjs    # screenshots of every view and style into media/shots/
node tools/lite-smoke.mjs    # API, physics and rendering checks
```

`build.mjs` minifies with esbuild when it is installed; set `ESBUILD=/path/to/esbuild/lib/main.js` to point it at one. Without esbuild it copies the source unminified.

MIT License, like the rest of Ocean Water Lab.
