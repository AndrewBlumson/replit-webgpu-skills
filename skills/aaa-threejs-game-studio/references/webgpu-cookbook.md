# WebGPU and TSL cookbook

Working patterns for the parts of a Three.js WebGPU game that agents most
often get wrong from memory. Every snippet was run on a real WebGPU adapter
with Three.js 0.186.1, the latest release when written, and in a Vite
project; see the version note at the end. The rules these patterns follow
are in `renderer-tsl.md`; the demo and prototype lanes read only the parts
of it that `demo-prototype-lanes.md` names.

Each code block is written as its own module: it uses `THREE` from
`import * as THREE from 'three/webgpu'` and lists only its other imports.
Add that import and an `export` to each file. When combining blocks in one
file, merge their `three/tsl` import lines, or the file fails to parse with
"Identifier has already been declared".

In a TypeScript project, keep these blocks in `.js` files with
`"allowJs": true`, as for the QA harness. `@types/three` 0.186 types
`renderer.backend` as the generic `Backend`, so `backend.isWebGPUBackend` and
`backend.device` fail strict type-checking. In TypeScript code, cast once
instead of deleting the check or the GPU wait:

```ts
type WebGPUBackendInfo = { isWebGPUBackend?: boolean; compatibilityMode?: boolean | null;
  device: { queue: { onSubmittedWorkDone(): Promise<unknown> } } };
const backend = renderer.backend as unknown as WebGPUBackendInfo;
```

## Check the installed release first

The WebGPU and TSL API changes between releases, and training data lags
behind it. Before writing or upgrading Three.js code:

1. Read the installed version from `node_modules/three/package.json`.
2. Run `node <skill folder>/scripts/check-three-api.mjs <absolute project path>`.
   It prints the installed version, then imports and `THREE.` names the
   release no longer has, then uses of removed calls that now do nothing,
   then deprecated names that still work but warn, with replacements. It
   cannot see changed arguments or option objects; the tables at the end of
   this file list the common ones.
3. Before using an API you have not used in this project, find it in
   `node_modules/three/src` or `node_modules/three/examples/jsm` and read its
   signature and JSDoc. Prefer the patterns in the official `webgpu_*`
   examples for that release over anything remembered. The npm package does
   not include the example pages; read them at
   `https://github.com/mrdoob/three.js/blob/r186/examples/webgpu_postprocessing_bloom.html`,
   replacing `r186` with the installed minor version (0.186.1 is `r186`).

## Imports

```js
import * as THREE from 'three/webgpu';                 // core, renderer, node materials
import { Fn, uniform, pass } from 'three/tsl';         // TSL functions
import { bloom } from 'three/addons/tsl/display/BloomNode.js';  // addons
```

Import everything from `'three/webgpu'`. Plain `'three'` shares the core
classes but adds WebGL-only ones, including a `PMREMGenerator` that fails
with `WebGPURenderer`. Without a bundler, an import map needs all four
entries: addons import `three`, and the TSL build imports `three/webgpu`.
Point them at files the server really serves. The paths below work when the
development server serves `node_modules`; for a deployed site, copy
`node_modules/three/build` and `node_modules/three/examples/jsm` into the
published folder, or use CDN URLs pinned to the exact installed version.

```json
{ "imports": {
  "three": "/node_modules/three/build/three.webgpu.js",
  "three/webgpu": "/node_modules/three/build/three.webgpu.js",
  "three/tsl": "/node_modules/three/build/three.tsl.js",
  "three/addons/": "/node_modules/three/examples/jsm/" } }
```

## Renderer and loop

```js
// cookbook: renderer
async function createRenderer(canvasParent) {
  if (!navigator.gpu || (await navigator.gpu.requestAdapter()) === null) {
    throw new Error('This needs a browser and GPU with WebGPU.');
  }
  const renderer = new THREE.WebGPURenderer({ antialias: true, powerPreference: 'high-performance' });   // 4x MSAA
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;   // default is none
  renderer.shadowMap.enabled = true;                    // PCFShadowMap by default
  canvasParent.appendChild(renderer.domElement);
  await renderer.init();                                // before render, PMREM, loaders
  if (renderer.backend.isWebGPUBackend !== true) {
    renderer.dispose();
    renderer.domElement.remove();
    throw new Error('WebGPU failed to start; the WebGL fallback is not allowed.');
  }
  return renderer;
}
```

- `WebGPURenderer` falls back to WebGL2 when WebGPU fails, including when
  `requiredLimits` asks for more than the GPU has, with only a console warning
  (`WebGPU is not available, running under WebGL2 backend`). Check
  `renderer.backend.isWebGPUBackend` after `await renderer.init()`.
- `navigator.gpu.requestAdapter()` asks for a full (core) WebGPU adapter, so
  a device with only compatibility-mode WebGPU is refused before `init()`. If
  you change that check, read `renderer.backend.compatibilityMode` after
  `init()`: when it is `true`, Three.js turns MSAA off and ignores per-channel
  MRT blending, which the bloom pipeline below uses. Treat that device as
  below the strict target and record its adapter; do not add a lower tier.
- `render()`, `hasFeature()`, `initTexture()` and the `PMREMGenerator`
  `from*()` methods throw before `init()`.
- MSAA is either 4 samples or none; `samples: 2` gives none.
- `THREE.Clock` is deprecated; use `THREE.Timer` (see the loop skeleton in
  `gameplay-systems.md`). TSL's `time` node is wall-clock time since
  `init()`: it cannot be paused or scaled, and after a hidden tab it jumps
  forward while `deltaTime` spikes for one frame. Drive game-time effects and
  compute from your own `uniform()`: the fixed step for anything the
  simulation owns, the clamped frame delta for visual-only effects.
- Resize by updating the camera aspect and calling `renderer.setSize()`;
  pipeline passes resize themselves. Moving the window to a screen with a
  different pixel ratio fires no `resize` event: listen with
  `` matchMedia(`(resolution: ${devicePixelRatio}dppx)`) ``, re-apply
  `setPixelRatio()` when it fires, then create the query again with the new
  value.

## Environment lighting

```js
// cookbook: environment
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

function addRoomEnvironment(renderer, scene) {
  const pmrem = new THREE.PMREMGenerator(renderer);     // after renderer.init()
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, 0.04).texture;
  scene.environmentIntensity = 1;
  room.dispose();
  pmrem.dispose();                                      // the texture stays valid
}
```

- Without `scene.environment` (or a material `envMap`), physically based
  materials get no image-based light, so metals render almost black and rough
  surfaces look flat. Every scene needs an environment.
- An HDR sky works too: load it with `HDRLoader` (`RGBELoader` is
  deprecated), set `mapping = THREE.EquirectangularReflectionMapping` and
  assign it to `scene.environment`; WebGPU converts it on first use. After
  repainting a canvas texture used as the environment, set both
  `needsUpdate` and `needsPMREMUpdate` to `true`.
- `SkyMesh` (`three/addons/objects/SkyMesh.js`) gives a physical sky with
  clouds on by default. To light the scene from it, capture it with
  `fromScene()` from one kept `PMREMGenerator`. Each call returns a new render
  target, so dispose the previous one first, as the official
  `webgpu_lights_sunlight` example does, and re-capture only when the sun has
  moved noticeably: each capture renders six faces.

## Lights and shadows

```js
// cookbook: sun
function addSun(scene) {
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.position.set(30, 50, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);                   // default 512
  const box = sun.shadow.camera;                        // default covers only ±5 m
  box.left = -30; box.right = 30; box.top = 30; box.bottom = -30;
  box.near = 1; box.far = 150;
  box.updateProjectionMatrix();
  sun.shadow.radius = 4;                                // soft PCF
  sun.shadow.normalBias = 0.05;
  scene.add(sun, sun.target);
  return sun;
}
```

- Lights use physical units. Point and spot lights fall off with distance
  squared (`decay` 2) and take intensity in candela, so values in the tens to
  thousands are normal; intensity 1 looks like no light. A directional light
  of about 3 and a hemisphere or ambient light of 0.5 to 2 suit most scenes.
- `PCFSoftShadowMap` is deprecated and replaced by `PCFShadowMap` with a
  warning; soften with `shadow.radius`.
- A directional shadow covers only its shadow camera's box. Fit the box to
  the play area, or use `CSMShadowNode` (`three/addons/csm/CSMShadowNode.js`)
  or the `SunLight` addon for large worlds. `SunLight` must be registered
  first, or it is skipped with a warning:
  `renderer.library.addLight(SunLightNode, SunLight)`, importing both from
  `three/addons/lights/`. It has no target; it shines from its position
  towards the origin.
- Adding, removing or hiding lights, or changing a light's `castShadow`,
  recompiles every lit material, which hitches. Create lights up front and
  switch them off with intensity 0, or set
  `renderer.lighting = new DynamicLighting()` from
  `three/addons/lighting/DynamicLighting.js` for lights that come and go
  (shadow-casting lights still recompile).

## TSL essentials

```js
// cookbook: tsl
import { Fn, uniform, float, If, Loop, positionLocal, mx_noise_float } from 'three/tsl';

const gameTime = uniform(0);          // set gameTime.value each frame from the game clock
const glowStrength = uniform(1.5);    // glowStrength.value = 3 later: no recompile
const detail = float(2);              // compile-time constant: changing it later does nothing

const pulse = Fn(([position]) => {
  const value = float(0).toVar();     // toVar() before assign/addAssign
  Loop(3, ({ i }) => {
    const scale = float(i).add(1);
    value.addAssign(mx_noise_float(position.mul(scale).add(gameTime)).div(scale));
  });
  If(value.lessThan(0), () => {
    value.assign(0);
  });
  return value.mul(detail);
});

function glowingMaterial() {
  const material = new THREE.MeshStandardNodeMaterial({ color: 0x223344, roughness: 0.4 });
  material.emissiveNode = uniform(new THREE.Color(0xff6a00))
    .mul(pulse(positionLocal)).mul(glowStrength);
  return material;
}
```

- A JavaScript `if` or `for` runs once while the shader is built. Use `If`,
  `Loop` and `select()` for decisions inside the shader, inside `Fn()`.
- Anything changed at run time must be a `uniform()`; change it through
  `.value`. Values built with `float()`, `vec3()` or `color()` from plain
  numbers are baked into the shader.
- Call a `Fn` to use it. Changing a material's node graph after its first
  render needs `material.needsUpdate = true`; changing a uniform never does.
- `positionLocal`, `normalLocal`, `positionWorld`, `normalView` and
  `positionViewDirection` are the usual inputs; `transformedNormalView` is
  deprecated in favour of `normalView`.
- Use the built-in noise (`mx_noise_float`, `mx_fractal_noise_float`,
  `mx_worley_noise_float`) and `triplanarTexture` instead of writing noise.

## Displacement with correct lighting

Moving vertices in `positionNode` does not update the normals, so lighting
stays as if the surface were flat. Compute a normal from two displaced
neighbours in the vertex stage:

```js
// cookbook: displacement
import { Fn, uniform, vec3, varying, positionLocal, transformNormalToView, mx_fractal_noise_float } from 'three/tsl';

function displacedTerrainMaterial() {
  const amplitude = uniform(4), frequency = uniform(0.15), offset = uniform(0.01);
  const height = Fn(([xz]) => mx_fractal_noise_float(vec3(xz.mul(frequency), 0), 4).mul(amplitude));
  const surfaceNormal = varying(vec3());
  const material = new THREE.MeshStandardNodeMaterial({ color: 0x5f8f4f, roughness: 0.9 });
  material.positionNode = Fn(() => {
    const position = positionLocal.xyz.toVar();
    const alongX = positionLocal.xyz.add(vec3(offset, 0, 0)).toVar();
    const alongZ = positionLocal.xyz.add(vec3(0, 0, offset.negate())).toVar();
    position.y.addAssign(height(positionLocal.xz));
    alongX.y.addAssign(height(alongX.xz));
    alongZ.y.addAssign(height(alongZ.xz));
    surfaceNormal.assign(alongX.sub(position).normalize().cross(alongZ.sub(position).normalize()));
    return position;
  })();
  material.normalNode = transformNormalToView(surfaceNormal);   // local to view space
  return material;
}
// Use with a plane in the XZ plane: new THREE.PlaneGeometry(100, 100, 256, 256).rotateX(-Math.PI / 2)
```

- `normalNode` is in view space; convert with `transformNormalToView()`.
- Shadows reuse `positionNode` automatically.
- The bounding sphere ignores the displacement: enlarge it or set
  `frustumCulled = false` on the mesh.

## Post-processing with selective bloom

```js
// cookbook: bloom
import { pass, mrt, output, emissive, vec4 } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';

function createBloomPipeline(renderer, scene, camera) {
  const scenePass = pass(scene, camera, { samples: renderer.samples });  // so warm-up compiles for this target
  const channels = mrt({ output, emissive: vec4(emissive, output.a) });
  channels.setBlendMode('emissive', new THREE.BlendMode(THREE.NormalBlending));
  scenePass.setMRT(channels);
  const glow = bloom(scenePass.getTextureNode('emissive'), 1.5, 0.4, 0);  // strength, radius, threshold
  const pipeline = new THREE.RenderPipeline(renderer);
  pipeline.outputNode = scenePass.getTextureNode().add(glow);
  return { pipeline, scenePass, glow };                 // loop: pipeline.render()
}
```

- `PostProcessing` was renamed `RenderPipeline`; `renderAsync()` is
  deprecated: `await renderer.init()` once, then call `render()`.
- Only emissive light blooms. Give every glowing material an `emissiveNode`
  (it works on basic materials too), including additive effects, which
  otherwise write no emissive and cut holes in the glow behind them. Emissive
  is also added to the visible colour, so an effect with
  `emissiveNode = colorNode` looks twice as bright: lower its colour or
  opacity to compensate.
- After replacing `pipeline.outputNode` or changing
  `pipeline.outputColorTransform`, set `pipeline.needsUpdate = true`.
- FXAA needs display colours: set `pipeline.outputColorTransform = false` and
  use `fxaa(renderOutput(scenePass))`. Setting `outputColorTransform = false`
  without a `renderOutput()` leaves the image untone-mapped and too dark. SMAA
  works the other way: `smaa(scenePass)` with `outputColorTransform` left on.
- TRAA (`traa(output, depth, velocity, camera)`) needs a `velocity` channel
  in the MRT and MSAA off: create the renderer without `antialias`, or use
  `pass(scene, camera, { samples: 0 })`.
- Ambient occlusion: the current official pattern renders a depth and normal
  pre-pass for `ao()` (GTAO) or the cheaper `ssao()` and applies it with
  `scenePass.contextNode = builtinAOContext(...)`, so it darkens only ambient
  light; that renders the scene twice. The GTAO texture has one channel: use
  `.r` when compositing it yourself.
- `ssr()` now takes an options object:
  `ssr(color, depth, normal, { metalnessNode, roughnessNode, camera })`. The
  old positional form silently loses those arguments.
- The stock effects live in `three/addons/tsl/display/`: bloom, GTAO and
  SSAO, SSR, SSGI, TRAA, FXAA, SMAA, depth of field (`dof`), motion blur,
  god rays, lens flare, outline, LUTs, chromatic aberration, film, sharpen,
  the `taau` and `fsr1` upscalers and more. Use them before writing your own.

## GPU particles

```js
// cookbook: particles
import { Fn, If, uniform, vec3, hash, shapeCircle, instancedArray, instanceIndex, uv } from 'three/tsl';

function createParticles(renderer, count = 100000) {
  const positions = instancedArray(count, 'vec3');
  const velocities = instancedArray(count, 'vec3');
  const gravity = uniform(-9.8);
  const delta = uniform(1 / 60);                        // set to the frame's delta before each dispatch
  const init = Fn(() => {
    const position = positions.element(instanceIndex);
    position.x = hash(instanceIndex).sub(0.5).mul(20);
    position.y = hash(instanceIndex.add(3)).mul(10);
    position.z = hash(instanceIndex.add(7)).sub(0.5).mul(20);
    velocities.element(instanceIndex).assign(vec3(0, 0, 0));   // so init can also reset the effect
  })().compute(count);
  const update = Fn(() => {
    const position = positions.element(instanceIndex);
    const velocity = velocities.element(instanceIndex);
    velocity.y.addAssign(gravity.mul(delta));
    position.addAssign(velocity.mul(delta));
    If(position.y.lessThan(0), () => {
      position.y = 0;
      velocity.y = velocity.y.negate().mul(0.6);
    });
  })().compute(count);

  const material = new THREE.SpriteNodeMaterial();
  material.positionNode = positions.toAttribute();
  material.colorNode = uv().mul(vec3(1, 0.6, 0.2));
  material.scaleNode = uniform(0.08);
  material.opacityNode = shapeCircle();
  material.alphaToCoverage = true;                      // needs MSAA
  const sprites = new THREE.Sprite(material);
  sprites.count = count;                                // one draw call for all
  sprites.frustumCulled = false;
  renderer.compute(init);                               // after renderer.init()
  return { sprites, init, update, delta };              // each frame: delta.value = dt; renderer.compute(update)
}
```

- Dispatch visual-only particles once per frame, with `delta.value` set to
  the clamped frame delta, from `updateEffects()` in the loop skeleton in
  `gameplay-systems.md`; pass `update` to `warmUp()`. A GPU simulation that
  gameplay reads belongs to the fixed-step simulation instead: dispatch it
  once per tick with the fixed step.
- `THREE.Points` draws 1-pixel points on WebGPU whatever the size. Use a
  `Sprite` with `count`, as above.
- Move particles in compute or in the shader, not by rewriting attribute
  arrays on the CPU each frame.
- `vec3` storage buffers are padded to four floats on the GPU; reading one
  back (`await renderer.getArrayBufferAsync(buffer.value)`) returns four
  floats per element.
- Read storage buffers in the vertex stage through `toAttribute()`, as
  above. Reading them directly works on full WebGPU devices; the official
  examples add `requiredLimits: { maxStorageBuffersInVertexStage: N }`, with
  N the number of buffers read, only for compatibility-mode devices.
- `shapeCircle()` with `alphaToCoverage` needs MSAA; without it (TRAA, or
  `antialias` off) the edges are hard. Use a soft edge instead:
  `material.opacityNode = float(1).sub(smoothstep(0.7, 1, uv().mul(2).sub(1).length()))`,
  importing `float` and `smoothstep` from `three/tsl`.

## Instancing

```js
// cookbook: instancing
import { hash, instanceIndex } from 'three/tsl';

function createInstancedRocks(geometry, count, place) {
  const material = new THREE.MeshStandardNodeMaterial({ color: 0x888888 });
  material.roughnessNode = hash(instanceIndex).mul(0.5).add(0.4);   // per-instance variation
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < count; i++) mesh.setMatrixAt(i, place(i, matrix));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();                         // again after moving instances
  return mesh;
}
```

- One `InstancedMesh` or `BatchedMesh` per material replaces thousands of
  meshes and draw calls. `setColorAt()` colours are applied automatically.

## Warming pipelines before play

`renderer.compileAsync(scene, camera)` compiles for the renderer's current
target, skips objects outside the camera's view and never builds shadow-map
or post-processing pipelines. A pass's `compileAsync(renderer)` does the same
for that pass's target and MRT channels, but ignores its `contextNode` (used
by ambient occlusion), `overrideMaterial` and layers. So warm up from a camera
position that sees everything, compile every pass and compute kernel, render
real frames, then wait for the GPU to finish building what they created:

```js
// cookbook: warmup
async function warmUp(renderer, pipeline, passes, camera, overview, computeNodes = []) {
  const saved = { position: camera.position.clone(), quaternion: camera.quaternion.clone(), far: camera.far };
  camera.position.copy(overview.position);              // a view that sees the whole level
  camera.quaternion.copy(overview.quaternion);
  camera.far = overview.far;                            // far enough to include all of it
  camera.updateProjectionMatrix();
  for (const pass of passes) await pass.compileAsync(renderer);   // after setMRT and getTextureNode calls
  if (computeNodes.length > 0) await renderer.compileComputeAsync(computeNodes);
  pipeline.render();                                    // builds the real variants, shadows and post
  pipeline.render();
  camera.position.copy(saved.position);
  camera.quaternion.copy(saved.quaternion);
  camera.far = saved.far;
  camera.updateProjectionMatrix();
  pipeline.render();                                    // leaves the game's own view on screen
  await renderer.backend.device.queue.onSubmittedWorkDone();   // the GPU finishes building them
}
// await warmUp(renderer, pipeline, [scenePass], camera, overviewCamera, [particles.update]);
```

- Do this behind the loading screen, with every material, effect and pooled
  object visible once.
- Create every `pass()` with `{ samples: renderer.samples }`, as
  `createBloomPipeline()` does for the scene pass. Otherwise `compileAsync`
  compiles materials without MSAA and the warm-up's own frames compile them
  again, which makes the warm-up longer. Shadow-receiving materials are always compiled again by
  the first real frame, which is one reason the warm-up renders.
- `render()` returns before the GPU has built the pipelines it created. The
  last line waits for that; without it, on a machine that has not compiled
  these shaders before, play froze for 0.3 to 1 second just after the loading
  screen closed, with nothing compiling in JavaScript.
- Pass every `pass()` in the pipeline, including an ambient-occlusion
  pre-pass, and every compute kernel the game dispatches.
- `overview` is a second camera, aimed with `lookAt()` (a plain `Object3D`
  aimed with `lookAt()` faces the opposite way, and the warm-up then compiles
  almost nothing, with no error). Set its `far` to reach the whole level. The
  game camera keeps its own `fov`, `aspect` and `near`, so place the overview
  where the whole level fits that view. If the game camera is parented to a
  player rig, give the overview in the rig's local space.
- An `LOD` compiles only the level its distance selects. When levels use
  different materials, set `lod.autoUpdate = false`, make every level
  visible for the warm-up, then set `autoUpdate` back to `true`.
- Also call `renderer.initTexture(texture)` for large textures.
- Without a `RenderPipeline`, move the camera the same way,
  `await renderer.compileAsync(scene, camera)` and
  `await renderer.compileComputeAsync([...])`, render one frame with
  `renderer.render(scene, camera)` for the shadow pipelines, and wait with
  `onSubmittedWorkDone()` as above.
- Never call `warmUp()` or a pass's `compileAsync()` while the animation loop
  is rendering: stop it with `renderer.setAnimationLoop(null)` first.
- Check it worked (production lane only; the demo and prototype lanes skip
  this bullet and the next), on a cold shader cache: change a shader constant or use
  a machine that has not run the game, because the browser caches compiled
  shaders across restarts. Record the time between animation frames for the
  first seconds after the loading screen, at normal vsync; every interval
  should be about one frame (16.7 ms at 60 Hz). `pipeline.render()` CPU time
  cannot show this freeze. Also log `renderer.info.memory.programs` then and
  after the first encounter: a rise means shaders compiled during play, but a
  flat count does not rule out new pipelines for existing shaders. In a QA
  build you can count every new pipeline by wrapping the renderer's internal
  `renderer._pipelines._getRenderPipeline` (0.186; check it still exists).
- Tested on a scene with bloom, shadows, 20,000 compute particles and an
  object behind the start camera, with a cold shader cache at 60 Hz: without
  a warm-up the first frames stalled for up to 650 ms and 17 pipelines were
  created during play. With the warm-up but without its final wait, nothing
  was created during play, yet one frame still took 300 ms (0.8 to 1 second
  in a larger Vite project). With this `warmUp()`, no frame took longer than
  16.8 ms.

## Loading models

```js
// cookbook: loaders
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

function createModelLoader(renderer, decoderBase = null) {   // once, after renderer.init()
  const draco = new DRACOLoader();                      // decoders from node_modules/three by default
  const ktx2 = new KTX2Loader();
  if (decoderBase) {                                    // a folder holding copies of libs/draco and libs/basis
    draco.setDecoderPath(`${decoderBase}draco/`);
    ktx2.setTranscoderPath(`${decoderBase}basis/`);
  }
  ktx2.detectSupport(renderer);
  return new GLTFLoader().setDRACOLoader(draco).setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
}

function loadModel(loader, url, stallMs = 20000) {     // a stuck decoder never settles on its own
  return new Promise((resolve, reject) => {
    let timer;
    const arm = () => {                                 // restarted by every progress event
      clearTimeout(timer);
      timer = setTimeout(() => reject(new Error(`${url}: no progress for ${stallMs} ms`)), stallMs);
    };
    arm();
    loader.loadAsync(url, arm).then(
      (gltf) => { clearTimeout(timer); resolve(gltf); },
      (error) => { clearTimeout(timer); reject(error); });
  });
}
// const loader = createModelLoader(renderer, import.meta.env.BASE_URL);   // Vite; reuse for every model
// const gltf = await loadModel(loader, `${import.meta.env.BASE_URL}models/level.glb`);
// scene.add(gltf.scene) before warmUp(), which compiles it with everything else.
```

- Create one loader and reuse it: every `KTX2Loader` starts its own worker
  pool, and a second one warns.
- `KTX2Loader.detectSupport()` must run after `renderer.init()`.
- In a Vite project, copy the decoders into Vite's public folder and pass
  `import.meta.env.BASE_URL` as `decoderBase`, as in the comment above. The
  default paths work in Vite 8 but not in the Vite 5 to 7 development
  server, where the decoder files come back as the page's `index.html`, a
  `blob:` worker throws `SyntaxError: Unexpected token '<'`, and the load
  never resolves or rejects; copying works in every Vite version tested. Add
  the copy as a script that runs before `dev` and `build`, so it is redone
  after a Three.js upgrade (npm runs `pre` scripts itself; with pnpm or Yarn,
  call it from the `dev` and `build` scripts instead):

  ```json
  "scripts": {
    "copy-decoders": "mkdir -p public && cp -R node_modules/three/examples/jsm/libs/draco node_modules/three/examples/jsm/libs/basis public/",
    "predev": "npm run copy-decoders",
    "prebuild": "npm run copy-decoders"
  }
  ```

  The public folder is `public/` inside the Vite `root`: when `vite.config`
  sets `root: 'client'`, use `client/public`. In the browser's network
  panel, the decoder files must arrive as JavaScript or WebAssembly, not
  `text/html`. Without a bundler, the default paths work.
- Load every model the level needs before `warmUp()`. To add a new model
  during play, `renderer.compileAsync(model, camera, scene)` does not prevent
  the hitch, because it compiles for the canvas rather than the pipeline's
  scene pass. Add it behind a loading moment instead: stop the loop with
  `renderer.setAnimationLoop(null)`, add the model, run `warmUp()` again, then
  restart the loop.

## Renamed and removed

| Old | Use instead | Since |
| --- | --- | --- |
| `THREE.PostProcessing` | `THREE.RenderPipeline` | r183 |
| `renderer.renderAsync()`, `pipeline.renderAsync()` | `await renderer.init()` once, then `render()` | r181 |
| `renderer.waitForGPU()` (now only logs an error) | `await renderer.backend.device.queue.onSubmittedWorkDone()` | by r186 |
| `hasFeatureAsync()`, `initTextureAsync()`, `clear*Async()` | the synchronous versions after `init()` | r181 |
| `PMREMGenerator.from*Async()` | `fromScene`, `fromEquirectangular`, `fromCubemap` after `init()` | r181 |
| `KTX2Loader.detectSupportAsync()` | `detectSupport()` after `init()` | r181 |
| `THREE.Clock` | `THREE.Timer` | r183 |
| `PCFSoftShadowMap` | `PCFShadowMap` with `shadow.radius` | r186 |
| `PassNode.setResolution()` | `setResolutionScale()` | r181 |
| `reflector({ resolution })` | `reflector({ resolutionScale })` | r180 |
| TSL `label()` | `setName()` | r179 |
| TSL `cache()` | `isolate()` | r181 |
| `directionToColor()`, `colorToDirection()` | `packNormalToRGB()`, `unpackRGBToNormal()` | r185 |
| `transformedNormalView`, `transformedNormalWorld` | `normalView`, `normalWorld` | r178 |
| TSL `PI2` | `TWO_PI` | r181 |
| `RGBELoader` | `HDRLoader` | r180 |
| `Source` | `TextureSource` | r186 |

These were removed or changed with no warning left in the release. The
script reports the imported names among them as missing, but not changed
arguments, options or properties. They fail at import, fail when the shader
builds, or quietly do nothing:

| Old | Use instead |
| --- | --- |
| `from 'three/nodes'`, `examples/jsm/nodes/Nodes.js` | `three/webgpu` and `three/tsl` |
| `WebGPURenderer` from `'three'` or an addons path | `import * as THREE from 'three/webgpu'` |
| `tslFn`, `cond`, `loop` | `Fn`, `select`, `Loop` |
| `timerLocal()`, `timerGlobal()`, `timerDelta()` | `time`, `deltaTime` (not called), or your own `uniform()` |
| `append(node)` | `Stack(node)` or `node.toStack()` |
| `rangeFog()`, `densityFog()` | `fog(color, rangeFogFactor(near, far))`, `fog(color, densityFogFactor(density))` |
| `viewportTopLeft`, `viewportBottomLeft`, `viewportResolution` | `screenUV`, `screenSize` |
| `uniforms([...])` | `uniformArray([...])` |
| `storageObject(attribute, type, count)` | `storage(attribute, type, count)`, or `instancedArray(count, type)` for a new buffer |
| `lightsNode` | `lights([...])` |
| `InstancedPointsNodeMaterial` | `SpriteNodeMaterial` on a `Sprite` with `count` |
| `TiledLighting`, `TiledLightsNode` | `ClusteredLighting` or `DynamicLighting`, set as `renderer.lighting` |
| `ssr(color, depth, normal, metalness, roughness, camera)` | `ssr(color, depth, normal, { metalnessNode, roughnessNode, camera })`; the old arguments are silently ignored |
| `Timer` from `three/addons/misc/Timer.js` | core `THREE.Timer` |
| `.temp()`, `If().else()`, `.elseif()` | `.toVar()`, `.Else()`, `.ElseIf()` |
| `sRGBEncoding`, `outputEncoding`, `texture.encoding` | `SRGBColorSpace`, `outputColorSpace`, `texture.colorSpace` |
| `useLegacyLights`, `physicallyCorrectLights` | nothing: lights always use physical units |
| `material.shadowPositionNode` | `receivedShadowPositionNode` |
| `copyTextureToTexture(position, src, dst)` | `copyTextureToTexture(src, dst, srcRegion, dstPosition)` |
| `TextGeometry({ height })` | `depth` (`height` is ignored and depth defaults to 50) |
| `ShaderMaterial`, `RawShaderMaterial`, `onBeforeCompile` | node materials and TSL |

`scripts/check-three-api.mjs` reports the deprecations the installed release
still warns about, and imports of names it no longer exports.

## Version note

The patterns above were checked against the Three.js 0.186.1 source and its
official `webgpu_*` examples, and each snippet was run on an Apple Metal
WebGPU adapter. When the installed release is newer, run
`scripts/check-three-api.mjs` and re-check any snippet you use against that
release's examples before relying on it.

When the installed release is older, as in any task that keeps the project's release, run the same script and check each snippet against the installed source before using it. In "Renamed and removed", a replacement whose "Since" release is later than the installed one does not exist there yet, and one marked "by" may not; keep the old name when the installed source lacks the new one. Do not upgrade just to make a snippet fit. In 0.184.0, and possibly 0.185.x (the fix is in 0.186), a `RenderPipeline` can draw a moving object at its previous position when the camera also moves. In any task that keeps the installed release, treat a capture that shows this as a known limit of that release, confirm it with a direct screenshot, and report it rather than upgrading, unless it is the defect being repaired or the user asks.
