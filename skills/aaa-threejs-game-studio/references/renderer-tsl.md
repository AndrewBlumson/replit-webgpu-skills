# Latest stable Three.js WebGPU and TSL production contract

Resolve the latest stable Three.js release from official sources when a new project or major rebuild begins, then pin the exact resolved release in that project's lockfile and evidence. Never preserve a release number in this reusable skill. TSL, node materials, compute, post-processing, and WebGPU internals change between releases; inspect the matching source and migration guidance before implementation or upgrade.

## Strict WebGPU bootstrap

`WebGPURenderer` may support a non-WebGPU backend depending on the current release. A renderer class or wrapper flag does not prove the active backend. A strict high-end game must check the actual backend after asynchronous initialisation and fail closed when it is not WebGPU. Re-check the exact introspection API against the resolved stable release; the following is a pattern, not an evergreen copy-paste guarantee.

```js
import * as THREE from 'three/webgpu';

export async function createStrictRenderer(canvas) {
  if (!navigator.gpu) throw new Error('This experience requires WebGPU.');

  const renderer = new THREE.WebGPURenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: 'high-performance',
  });

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight, false);

  await renderer.init();
  if (renderer.backend?.isWebGPUBackend !== true) {
    renderer.dispose();
    throw new Error('WebGPU initialisation failed; WebGL fallback is disabled.');
  }

  return renderer;
}
```

Show capability/init failure as a designed UI state with requirements and recovery advice. Do not leave a blank canvas or quietly lower the renderer contract. Keep the pixel-ratio cap and antialiasing choice in a quality profile; measure them on the target device.

Use `renderer.setAnimationLoop()` rather than a separate `requestAnimationFrame()` owner. Initialise before code that needs backend state, compute, compilation, or feature inspection.

## Runtime ownership and frame order

Give exactly one runtime owner responsibility for start, stop, pause, resize, frame scheduling, render pipeline, resource registry, and teardown. Recommended order:

1. sample browser/device input into commands;
2. accumulate a bounded real delta;
3. run zero or more fixed simulation steps;
4. derive presentation transforms and animation from authoritative state;
5. update view-dependent fields, lights, shadows, probes, and reflections at their own cadences;
6. upload event batches and update stable TSL uniforms;
7. dispatch required GPU simulations in explicit dependency order;
8. render through the single `RenderPipeline`;
9. sample development telemetry at a non-disruptive cadence.

Use a fixed simulation step such as 1/60 s for controller, combat, AI, objectives, and deterministic event order. Cap accumulated catch-up after stalls to prevent a spiral. Interpolate visual transforms between simulation states. Visual-only particles may use a bounded render delta, but their rate must not change with frame rate.

Pause simulation intentionally on menu/focus loss according to the game contract. Do not resume with the full hidden-tab delta. Keep input sampling, simulation time, animation time, VFX time, and cinematic time as named clocks rather than one ambiguous global time.

## TSL and node-material practice

Import renderer/material classes from `three/webgpu` and node functions from `three/tsl`. WebGPURenderer does not support the old custom-shader paths built around `ShaderMaterial`, `RawShaderMaterial`, or `onBeforeCompile()`; port custom work to node materials and TSL.

Prefer extending the PBR model through specific node slots:

- `colorNode`, `normalNode`, `roughnessNode`, `metalnessNode`;
- `emissiveNode`, `opacityNode`, `alphaTestNode`;
- `positionNode`/`geometryNode` for controlled deformation;
- shadow, lighting, output, and MRT nodes where the effect requires them.

Replacing the full vertex or fragment stage bypasses more built-in behaviour and should be reserved for effects that cannot retain the standard lighting/material contract.

Build node graphs and TSL functions once during construction. Create uniform nodes once and mutate their values. Do not reconstruct graphs, materials, compute nodes, render targets, or closures every frame. Graph-shape changes create new shader/pipeline variants; value changes should not.

Maintain a small material-family layer rather than modifying anonymous loaded materials ad hoc. Each family should own:

- source material semantics and colour spaces;
- node graph and optional feature flags;
- quality tiers;
- animation/wetness/damage inputs;
- compile/warm-up identity;
- disposal and diagnostic views.

Use authored asset metadata for material classification. Hard-coded material-name guesses are acceptable in an import proof, not a production pipeline.

## Compute and storage data

Use GPU compute for large, regularly updated data-parallel workloads: particles, flocking, fields, procedural deformation, visibility/indirect data, or spatial effects. Keep branching gameplay authority, objectives, sparse event logic, and debug-friendly rules on the CPU unless a measured need justifies moving them.

Production compute rules:

- allocate storage buffers and compute nodes once;
- define a compact data layout and account for alignment/padding;
- initialise deterministic seeds/state in a named init dispatch;
- pass bounded delta/fixed time explicitly rather than advancing by “one amount per frame”;
- batch sparse CPU events into a buffer rather than reading the entire simulation back;
- avoid synchronous/per-frame GPU readback;
- declare dispatch order and which render stage consumes each result;
- cull, pool, or reuse dead elements instead of allocating effects at impact time;
- dispose compute nodes and attributes when their session ends.

Camera-local simulation domains are powerful for dense weather and fields, but movement must preserve spatial continuity. Recycle cells/particles deterministically as the domain moves; prevent visible popping at domain edges. Separate world-state coverage from screen-space coverage and near-camera presentation.

## RenderPipeline, MRT, and post

Create one `RenderPipeline` and give it the full output graph. Once post is active, call `renderPipeline.render()` in the loop rather than `renderer.render()`. Construct the graph outside the frame loop. Set `renderPipeline.needsUpdate = true` only when its output graph or relevant transform contract changes. Dispose the pipeline.

Use semantic outputs and MRT only when downstream effects need them. Typical attachments include beauty/output, normal, velocity, emissive, metal/rough, and depth. Every attachment consumes memory and bandwidth; pack data and lower formats deliberately. For example, normal or metal/rough attachments may tolerate unsigned-byte formats when their reconstruction and visible error are verified.

Order colour transforms deliberately. `RenderPipeline` normally applies tone mapping and output conversion at the end. Effects such as FXAA or LUT work that require display-space input need explicit `renderOutput()` placement and `outputColorTransform = false`.

Treat post effects as costed systems:

- **Selective bloom:** feed a semantic emissive attachment rather than thresholding the entire image. Scale bloom independently and inspect the current stable implementation before budgeting its blur/composite chain.
- **AO/GTAO:** run at reduced resolution when acceptable; supply explicit normals/velocity where the temporal mode requires them. It cannot recover off-screen information and does not replace contact lighting or shadows.
- **Temporal AA/upscaling:** motion vectors, history validity, disocclusion, camera cuts, animated material motion, particles, transparency, and reset rules are part of the feature—not optional polish.
- **DoF:** reserve the expensive high-quality path for an authored cinematic/photo state or high tier. Do not blur routine gameplay or hide weak composition.
- **Lens effects, grain, vignette, chromatic shift:** tie them to authored camera/optic or state decisions. They are not a default “cinematic” stack.
- **Reflections:** choose per surface class among probes, SSR, authored planar reflection, or an approximation. Give planar/probe updates an explicit cadence and quality scale.

Expose raw beauty, depth, normal, velocity, emissive, AO, reflection, and key material views in development so an attractive composite cannot hide broken inputs.

## Lighting and shadows

Choose a lighting architecture for the route rather than adding lights until it looks bright:

- environment/sky and motivated primary light;
- authored local practicals with limited dynamic shadow casters;
- baked or static contribution where interaction does not require updates;
- 3–4 measured cascades for long outdoor directional-shadow ranges when justified;
- independent update cadence for static, slow, and per-frame shadow data;
- fog/atmosphere integrated with exposure, depth, and material response.

Cascaded shadows multiply shadow rendering. Fit their distance and split strategy to the playable camera range, stabilise to texels, and inspect transitions under movement. A single huge shadow map is not a general substitute for a moving route.

## Weather and wet surfaces

Build rain as coordinated layers, not one particle emitter:

1. far atmospheric precipitation for volume and depth;
2. near streaks with camera-relative coverage and motion;
3. camera-local collision/exposure representation for roofs and surfaces;
4. actual impact events that drive splashes/ripples;
5. surface wetness state with accumulation, exposure, drainage, and material response;
6. runoff/drips and moving-object interaction where the route exposes them;
7. audio layers for open rain, shelter, surfaces, vehicles, and impacts.

A useful reference implementation may fake or decouple these layers. Adopt the architecture only after identifying the shortcut. Randomly timed splashes are not collision evidence. Low roughness alone is not wetness. A fullscreen droplet distortion is a window/camera state, not world precipitation.

For a camera-local height/depth field, restore renderer state with `try/finally`, define unsupported geometry and dynamic-update behaviour, include surface orientation if impact response needs it, and measure the extra render pass. Exclude rain itself and other feedback objects from reflection/collision passes deliberately.

## Pipeline warm-up

Call `await renderer.compileAsync(scene, camera)` only after representative lights, environment, material features, and target scene context are configured. It reduces first-use shader/pipeline stutter but does not prove every hidden/dynamic material, compute dispatch, layer camera, render target, or post node has compiled.

Maintain a warm-up manifest containing:

- critical scene/camera/light combinations;
- skinned, morphed, instanced, alpha-tested, transparent, and shadow variants;
- weapon/impact/enemy states first used during combat;
- each compute init/update pipeline;
- reflection/probe/auxiliary cameras;
- the final post graph and quality tier.

Block control on genuinely critical compilation and preload. Defer noncritical variants in small idle slices. Keep progress UI honest about asset decode/upload and compilation. Validate the first real encounter for hitches; a resolved compile promise alone is not the gate.

## Measurement and adaptive quality

Use the current stable release's `renderer.info` and backend diagnostics for available draw/primitive and tracked GPU-resource evidence. They do not turn an FPS counter into GPU time. Collect separately:

- CPU/rAF frame time and p50/p95/p99 or long-frame distribution;
- optional GPU render/compute timestamps when the adapter/browser supports timestamp queries;
- render/compute calls, draws, visible primitives, render targets, buffers, textures, and estimated memory;
- decode/upload/network timing and garbage-collection/long-task evidence.

Resolve GPU timestamps periodically in development; asynchronous readback has cost and finite query capacity. Do not synchronously read back every frame.

Create several reversible quality tiers with independent knobs such as internal resolution, AO, bloom, reflection cadence/resolution, shadow distance/cascades, volumetric steps, particle concurrency, animation distance, and far-detail density. Use frame-time percentiles, hysteresis, cooldown, thermal/visibility awareness, and recovery. Never permanently drop quality after two noisy FPS samples.

## Resize, failure, and disposal

On resize, update camera projection, renderer size, internal-resolution policy, post/auxiliary targets, history validity, and any screen-space uniforms. Throttle expensive rebuilds during a live resize. Reset temporal history on camera cuts, large resolution changes, teleport, and relevant scene discontinuities.

Teardown must stop the animation loop and dispose or detach:

- geometries, materials, textures, skeleton/mixer ownership, and cloned resources;
- render targets, history textures, post pipeline, reflection/probe targets;
- compute nodes and storage/indirect attributes;
- physics bodies/controllers, AI entities, workers, timers, and async loaders;
- audio sources/nodes and buses owned by the session;
- DOM and input listeners, preferably through an `AbortController`;
- renderer last, after owned resources and pending work are contained.

Guard async completions with session identity or abort signals so a dead route cannot receive late assets or callbacks.
