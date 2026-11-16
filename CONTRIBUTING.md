# Contributing

Thanks for helping. Issues and pull requests are both welcome.

## Ground rules

- **Shaders are written once.** Edit `kit/glsl/*.glsl`, then run `npm run hlsl` to regenerate `kit/hlsl/`. Do not edit the HLSL by hand.
- **The demo is built.** Edit `demo/src/` and `demo/shaders/`, then run `npm run build`. Commit the rebuilt `demo/dist/index.html` so people can open it without a build.
- **New parameters live in one table.** Add them to `PARAMS` in `demo/src/params.js` and use them in `main.js`. The advanced panel, presets and exports pick them up from there.
- **Keep it physical where it can be.** When something is artistic (a gain or a tweak), say so in a comment and keep 1 as the physical value.
- **Say what you verified.** In the pull request, list what you checked and how: browser and GPU, screenshots, `npm test`, HLSL check.

## Good first contributions

- Frame-rate numbers on real GPUs (fps, resolution, browser, GPU model)
- A Unity, Unreal or Godot sample project using `kit/`
- Compiling the HLSL with DXC/FXC and fixing what it finds
- Compiling and testing `kit/csharp/WaterPhysics.cs`
- New scene looks in `SCENES` (`demo/src/params.js`)

## Code style

Plain JavaScript (ES5-compatible inside the demo), 2-space indent, no build-time dependencies for the demo itself. Comments explain why, not what.
