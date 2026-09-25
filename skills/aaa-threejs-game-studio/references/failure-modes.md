# Symptom, cause and fix

Check this table before debugging a Three.js WebGPU problem from scratch. It
covers the failures agents hit most often with the latest release; verify
anything version-specific with `scripts/check-three-api.mjs` and the installed
source. See `webgpu-cookbook.md` for working code.

## Nothing, or the wrong thing, on screen

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Black canvas, no errors | A camera inside geometry, facing away, or with `near`/`far` that excludes the scene; objects hidden or on layers the camera does not render; no lights and no environment | Log the camera position, target, `near` and `far`; check `visible` and `layers`; add lights and `scene.environment`. |
| Error: `... called before the backend is initialized` | `render()`, `hasFeature()`, `initTexture()` or `PMREMGenerator.from*()` ran before `init()` finished | `await renderer.init()` first. |
| Works, but `renderer.backend.isWebGPUBackend` is false; console warns `WebGPU is not available, running under WebGL2 backend` | WebGL2 fallback: no adapter, a blocked GPU, or `requiredLimits` asking for more than the GPU has | Show the designed WebGPU-required screen; check `chrome://gpu`; lower `requiredLimits`. |
| Anti-aliasing or bloom quietly missing on some devices | The device has only compatibility-mode WebGPU (`renderer.backend.compatibilityMode` is `true`): no MSAA and no per-channel MRT blending | The cookbook's `createRenderer()` refuses such devices before `init()`. If yours does not, record the adapter and treat the device as below the strict target. |
| Canvas freezes and stays frozen; console shows `Device Lost` | The GPU device was lost (driver reset, memory pressure); later renders do nothing | Keep the default handler and add yours: `const lost = renderer.onDeviceLost.bind(renderer); renderer.onDeviceLost = (info) => { lost(info); showDeviceLost(info); };`, where `showDeviceLost` shows the designed failure screen with a reload button. |
| Blank or stale screenshots while the game looks fine to the player | The screenshot path cannot capture the WebGPU canvas | Use the `webgpu-visual-verification` skill's readback. |
| Metal and glossy surfaces almost black | No environment map, so no image-based light | Set `scene.environment` (see the cookbook's environment section). |
| Scene lit but flat and grey | Ambient light doing all the work, no environment, no shadows | Environment map plus one shadow-casting key light; lower ambient. |
| A point or spot light seems to do nothing | Physical units: intensity is in candela and falls off with distance squared | Use tens to thousands, or move the light closer. |
| Shadows missing or cut off | Shadow camera box too small (±5 m by default) or `renderer.shadowMap.enabled` not set | Fit `shadow.camera` to the play area and call `updateProjectionMatrix()`; enable shadows on renderer, light, casters and receivers. |
| Warning: `PCFSoftShadowMap has been removed` | Deprecated shadow type | `PCFShadowMap` with `shadow.radius`. |
| Image too dark and saturated after adding FXAA | `pipeline.outputColorTransform = false` without `renderOutput()` | `fxaa(renderOutput(scenePass))`, then `pipeline.needsUpdate = true`. |
| Edges still jagged with FXAA | FXAA was given linear HDR colours | Set `pipeline.outputColorTransform = false` and use `fxaa(renderOutput(scenePass))`. SMAA is the opposite: `smaa(scenePass)` with the transform left on. |
| Post-processing (bloom, AO) has no effect | The loop still calls `renderer.render()` | Call `pipeline.render()` instead. |
| Textures look pale and washed out | A colour texture without `colorSpace = THREE.SRGBColorSpace` (`GLTFLoader` sets it; `TextureLoader` does not) | Set `SRGBColorSpace` on colour and emissive maps only, never on normal, roughness or metalness maps. |
| Stripes or speckles in lit surfaces (shadow acne) | `shadow.bias` and `shadow.normalBias` default to 0 | Raise `shadow.normalBias` (about 0.02 to 0.1 at metre scale); too much detaches shadows from their casters. |
| Screen goes red and black after adding ambient occlusion | The GTAO texture has one (red) channel, multiplied as colour | Use its `.r`, or the `builtinAOContext` pattern. |
| Particles invisible or 1 pixel | `THREE.Points` draws 1-pixel points on WebGPU | `SpriteNodeMaterial` on a `Sprite` with `count`. |
| Round particles have hard, jagged edges | `shapeCircle()` relies on `alphaToCoverage`, which needs MSAA, and MSAA is off (TRAA, or `antialias` false) | Use a soft edge: `opacityNode = float(1).sub(smoothstep(0.7, 1, uv().mul(2).sub(1).length()))` (cookbook). |
| Displaced surface lit as if flat | `positionNode` moved vertices but normals are unchanged | Compute normals from displaced neighbours (cookbook). |
| Displaced or instanced mesh disappears near the screen edge | Bounding sphere does not include the displacement or moved instances | `computeBoundingSphere()` after moving instances, or `frustumCulled = false`. |
| Glow missing behind a transparent or additive effect | The effect writes no emissive into the bloom channel and covers the glow | Give the effect an `emissiveNode`. |
| Old SSR reflections stopped working after an upgrade | `ssr()` now takes an options object; the old positional arguments are ignored | `ssr(color, depth, normal, { metalnessNode, roughnessNode, camera })`. |

## Values and timing

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Changing a shader value does nothing | It was built with `float()`, `vec3()` or `color()` and baked in | Use `uniform()` and set `.value`. |
| A shader decision always goes the same way | A JavaScript `if` ran once while building the shader | Use TSL `If` or `select()` inside `Fn()`. |
| Shader animation keeps running while the game is paused, differs between runs, or jumps after the tab was hidden | TSL `time` is wall-clock time since `init()`; after a hidden tab it jumps and `deltaTime` spikes | Drive it from a `uniform()` set from the game clock. |
| Warning: `Clock: This module has been deprecated` | `THREE.Clock` replaced | `THREE.Timer`, updated once per frame. |
| Game runs faster on a 120 Hz screen | Movement uses frame count, not time | Fixed-step simulation with a clamped accumulator. |

## Hitches and stutter

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Hitch the first time an object, effect or area appears | Pipeline compiled on first use | Warm up behind the loading screen: every pass's `compileAsync()` from a view that sees the whole level, compute kernels, real frames, then a GPU wait (cookbook `warmUp()`). |
| Freeze of up to a second just after the loading screen closes, though nothing compiles during play and `render()` is fast | The warm-up's frames created pipelines the GPU was still building when play began | End the warm-up with `await renderer.backend.device.queue.onSubmittedWorkDone()`; test with a cold shader cache. |
| Several-frame stall when a light turns on or off | Adding, removing or hiding lights, or toggling `castShadow`, recompiles every lit material | Keep lights and switch them with intensity, or use `DynamicLighting`. |
| Regular stutter every few seconds | Garbage collection from allocations in the loop | No `new` in the loop; reuse scratch vectors and matrices. |
| Frame rate collapses as particles grow | Particle positions rewritten on the CPU every frame | Compute or shader-driven motion. |
| Frame rate collapses on high-DPR or large screens | Every pass renders at the full drawing-buffer size | Cap the pixel ratio, lower `setResolutionScale()` on costly passes, or use the `taau` or `fsr1` upscalers. |
| Draw calls jump after a new feature | One mesh per object | `InstancedMesh`, `BatchedMesh` or pooling; compare with the baseline. |
| Stutter that the numbers do not explain | Unknown | Profile with the browser's performance panel on the deployed URL before changing code. |

## Upgrades and imports

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `does not provide an export named ...` or `... is not a constructor` after an upgrade | A renamed or removed API | Run `scripts/check-three-api.mjs`, which lists imports the release no longer exports; the cookbook's renamed-and-removed tables give the replacements. Otherwise search `node_modules/three/src` and `examples/jsm` for the name. |
| Warning: `"PostProcessing" has been renamed to "RenderPipeline"` | Old name | `THREE.RenderPipeline`. |
| Warning: `"renderAsync()" has been deprecated` | Old async API | `await renderer.init()` once, then `render()`. |
| Environment map fails or errors with `WebGPURenderer` | `PMREMGenerator` imported from `'three'`, which is the WebGL one | Import everything from `'three/webgpu'`. |
| `instanceof` checks failing, materials ignored, a warning about multiple instances of Three.js | Two copies of Three.js: two installed versions, or a CDN import mixed with the npm package | One `three` version in the lockfile and one source for every import. |
| Import map errors for `three/tsl` or addons | Missing import map entries | All four entries: `three`, `three/webgpu`, `three/tsl`, `three/addons/`. |
| Model load never finishes and nothing is logged, or a `blob:` worker throws `Unexpected token '<'` | The decoder URL returns the page's `index.html` (default paths in the Vite 5 to 7 development server, or a wrong path) | Copy `libs/draco` and `libs/basis` into the public folder, set the decoder and transcoder paths, and give loads a timeout (cookbook). |
| `KTX2Loader` throws on `detectSupport` | Called before `renderer.init()` | Call it after `init()`. |

## Replit and the browser

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Slow or broken only in the Replit preview | The preview iframe throttles and misreports | Judge on the deployed or development URL in a full browser tab. |
| No sound | Audio started before a user gesture | Start audio from the first click or key press. |
| Pointer lock never engages in automated tests | Pointer lock needs a real user gesture | Drive tests through the `__qa` hook; put mouse-look on the user's check card (`needs-user`). |
