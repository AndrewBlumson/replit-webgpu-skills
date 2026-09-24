# Native WebGPU readback

## What this gets around

Some preview iframe and headless screenshot paths omit or retain an old
WebGPU canvas surface, even though the GPU has rendered valid pixels.

The verified capture route is:

```text
Actual application scene, camera, materials and effects
    |
Existing native WebGPU final render pipeline
    |
Readable GPU render target
    |
Awaited GPU pixel readback
    |
Temporary Canvas2D presentation of those exact pixels
    |
Browser presentation settles
    |
Screenshot, matching metadata and personal visual inspection
```

This avoids relying on the broken GPU-canvas screenshot surface. It does not
replace WebGPU with Canvas2D. It also does not repair the preview iframe for
normal users: describe it as a capture workaround, not an iframe fix.

The template below was checked in minimal known-colour test scenes with
Three.js 0.184.0 and 0.186.1 WebGPURenderer on one real GPU adapter (Apple
Metal, headless Chrome for Testing). The checks covered a RenderPipeline with
bloom or FXAA, a DirectRenderPipeline (0.186.1) and plain `renderer.render()`;
antialiasing on and off; a HUD or view-model scene drawn in a second pass; a
minimap rendered into its own target; a stencil mask; an offscreen session with
a persistent output target; repeated captures and a resize; and drawing-buffer
sizes that do and do not need row padding, including a pixel ratio of 1.5 and
2. With the application's rendering paused, every readback was pixel-identical
to the canvas. These were test scenes, not a full application, so this remains
an adaptation template, not a universally tested drop-in utility. Check the
installed renderer APIs before adapting it to another framework or version.

## Required access and preparation

Use the application's authorised development environment. Obtain the actual
renderer, the application's final draw function and its synchronisation
functions.
Prefer existing development hooks. Do not expose them in production.

Run the operation inside the application page or the correct automation frame.
Do not assume the containing preview shell can access a cross-origin child.
Use supported frame automation or open the authorised application URL directly.
Never disable browser security to cross that boundary.

Pause the ordinary render/simulation loop only when the existing harness can
restore it correctly. For canvas-triggered device loss, establish the offscreen
startup path below before allowing any render. Complete asset loading and
renderer initialisation, then choose the intended scene before capture.

The caller must supply:

- `THREE`: the application's existing Three.js WebGPU module, not a second copy.
- `renderer`: its initialised WebGPURenderer.
- `renderFinalFrame()`: synchronously draws one complete final frame exactly
  as the application's loop draws it, including post-processing and any extra
  scene passes such as a weapon view model or a HUD scene. It must only draw:
  no simulation, animation, input or camera updates (`synchroniseFrame()`
  does those). It must not be `async` or call the deprecated `renderAsync()`,
  because the helper restores routing as soon as it returns. Reuse the
  application's own draw function where it is separate from its update step.
  Typical forms: `() => pipeline.render()` for a `RenderPipeline`;
  `() => pipeline.render(scene, camera)` for a `DirectRenderPipeline`
  (Three.js 0.186 and later); `() => renderer.render(scene, camera)` when
  there is no post-processing.
  A minimap or other view rendered into its own render target is fine. Passes
  placed with `renderer.setViewport()` or `setScissor()`, such as an inset
  minimap or split screen, are not supported: those settings apply only to the
  canvas, so under output routing such a pass covers the whole capture. Leave
  them out of `renderFinalFrame()` and state their absence in the metadata, or
  adapt them explicitly.
- `synchroniseFrame()`: updates rendered transforms, world animations, effects,
  camera and matrices at the requested application state without competing loops.
- `checkPose()`: validates the requested state against actual rendered object
  transforms and camera position/direction. Return a plain object containing
  `valid: true` only when the relevant checks pass, plus their measured evidence.

## Offscreen startup after canvas-triggered device loss

Use this mode when observations indicate that rendering to the canvas triggers
device loss. A blank screenshot alone does not establish that diagnosis; record
the device-loss event and which render path preceded it.

1. Restart the page/application with a fresh renderer/device and recreate its
   GPU resources. Changing targets or calling `init()` on the lost renderer
   cannot recover that device. Do not replay the failing canvas render as a
   prerequisite for the offscreen test.
2. Configure a readable offscreen output for the real final pipeline before
   its **first render**, including startup, warm-up and automatic-loop renders.
   Keep the application's actual scene, materials and final effects. Connect
   this at application startup; a helper injected after the first failed frame
   is too late. Clear a newly created output target once as an ordinary render
   target (`setRenderTarget(target)`, `clear()`, `setRenderTarget(null)`)
   before routing to it: Three.js 0.184 to 0.186 can otherwise recurse without
   end when a frame begins with a manual `clear()`. After each render to an
   output target, Three.js leaves that target bound, so a frame that clears
   between passes should call `setRenderTarget(null)` first.
3. Keep that output active throughout the diagnostic session, including while
   awaiting assets, readbacks and browser animation-frame callbacks. Use the
   installed renderer's output-routing API: Three.js exposes
   `setOutputRenderTarget()` separately from `setRenderTarget()`. Check the
   application's pipeline and version; binding a temporary current target is
   insufficient if startup or later passes reset it to the canvas.
4. The harness owns this persistent output target and the render loop. Stop
   the loop before releasing that target and tearing down the session. Do not
   restore and resume the known-failing canvas path as capture cleanup. Normal
   operation can be checked separately in an environment where that path works.

If a fresh offscreen startup also loses the device, retain the diagnostics and
report that failure; do not retry indefinitely or claim readback can supply an
unavailable device. A successful minimal test establishes the capture route.
Then capture and personally inspect the requested application views with their
final effects before claiming those visuals have been verified.

API references: [Three.js output target](https://threejs.org/docs/pages/Renderer.html#setOutputRenderTarget)
and [WebGPU device lifetime](https://www.w3.org/TR/webgpu/#devices).

## Browser-side adaptation template

This example creates a full-viewport, scene-only inspection surface. It excludes
HTML overlays. Match it to a full-viewport application, or adapt the surface to
the exact canvas bounds if inspecting a smaller component.

The example routes the application's own final frame into a readable target
with `setOutputRenderTarget()`, so the renderer treats that target as the
screen. Tone mapping and output colour space are then applied exactly as for
the canvas, whether the application uses a `RenderPipeline`, a
`DirectRenderPipeline` or plain `renderer.render()`. Do not bind the capture
target with `setRenderTarget()` instead. The renderer applies tone mapping and
output colour space only when drawing to the screen or to the output target, so
a plain `renderer.render()` or `DirectRenderPipeline` frame drawn into an
ordinary render target comes out too dark. A `RenderPipeline` applies them in
its own output pass, which is why binding appeared to work for it.

The example restores the previous routing straight after the render call,
before any await, so an application loop that is still running cannot draw into
the capture target. This does not make a running loop safe: pause the
application's rendering, not only its simulation, before calling the helper.
`RenderPipeline` passes render at most once per animation frame and can
otherwise reuse the loop's latest frame instead of the staged pose.

The example matches the canvas's antialiasing, depth and stencil settings,
clears its new target once before use, and keeps a clear or `clearDepth()`
between passes on the same buffer as it would be on the canvas. It accepts the
row-padded layout that Three.js readback returns (see the format notes below)
and rejects any other unexpected layout instead of presenting corrupted rows.

This helper captures an already usable renderer; it does not intercept startup
or recover device loss. For offscreen-only sessions, first establish the
persistent output routing above. The helper saves and restores that
harness-owned output target around its own render and disposes only its own
capture target; it must never dispose a target owned by the harness.

```javascript
async function stageNativeWebGPUFrame({
  THREE,
  renderer,
  renderFinalFrame,
  synchroniseFrame,
  checkPose,
}) {
  if (typeof renderFinalFrame !== 'function') {
    throw new Error('Pass renderFinalFrame: the function that draws the application\'s final frame.');
  }
  if (typeof synchroniseFrame !== 'function' ||
      typeof checkPose !== 'function') {
    throw new Error('Application-specific synchronisation and pose checks are required.');
  }

  await renderer.init();
  if (renderer.backend?.isWebGPUBackend !== true) {
    throw new Error('The application is not using the native WebGPU backend.');
  }

  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const width = size.x;
  const height = size.y;
  if (!Number.isInteger(width) || !Number.isInteger(height) ||
      width <= 0 || height <= 0) {
    throw new Error('Invalid drawing-buffer dimensions.');
  }

  // Match the canvas's antialiasing, depth and stencil: some pipelines draw
  // straight into the output target, which would otherwise lack them.
  const target = new THREE.RenderTarget(width, height, {
    type: THREE.UnsignedByteType,
    samples: renderer.samples,
    depthBuffer: renderer.depth,
    stencilBuffer: renderer.stencil,
  });
  let canvas;

  // Three.js 0.184 to 0.186 can recurse without end when a frame's first
  // operation on a fresh output target is a manual clear(). Clear the target
  // once as an ordinary render target first.
  function initialiseTarget() {
    const previousTarget = renderer.getRenderTarget();
    try {
      renderer.setRenderTarget(target);
      renderer.clear();
    } finally {
      renderer.setRenderTarget(previousTarget);
    }
  }

  // Draw the application's final frame into the target as if it were the
  // screen, then restore routing before anything is awaited.
  function renderRouted() {
    const previousTarget = renderer.getRenderTarget();
    const previousOutput = renderer.getOutputRenderTarget();
    const ownRender = Object.prototype.hasOwnProperty.call(renderer, 'render');
    const render = renderer.render;
    // Drawing to the canvas leaves no render target bound, but drawing to an
    // output target leaves that target bound. Keep the canvas behaviour, so a
    // clear() or clearDepth() between passes affects the same buffer.
    renderer.render = function (...args) {
      const bound = this.getRenderTarget();
      const result = render.apply(this, args);
      if (bound === null && this.getRenderTarget() === target) {
        this.setRenderTarget(null);
      }
      return result;
    };
    try {
      renderer.setRenderTarget(null);
      renderer.setOutputRenderTarget(target);
      const result = renderFinalFrame();
      if (typeof result?.then === 'function') {
        throw new Error('renderFinalFrame() must draw synchronously. Do not pass an async function or renderAsync().');
      }
    } finally {
      if (ownRender) renderer.render = render;
      else delete renderer.render;
      renderer.setOutputRenderTarget(previousOutput);
      renderer.setRenderTarget(previousTarget);
    }
  }

  async function submitAndRead() {
    await synchroniseFrame();
    const pose = await checkPose();
    if (pose?.valid !== true) {
      throw new Error('Rendered transforms or camera do not match the requested state.');
    }
    renderRouted();
    const pixels = await renderer.readRenderTargetPixelsAsync(
      target, 0, 0, width, height,
    );
    return { pixels, pose };
  }

  try {
    initialiseTarget();
    // Discard a cold frame at the intended pose, not at the starting scene.
    await submitAndRead();
    const { pixels, pose } = await submitAndRead();
    const rgba = toTightRGBA8(pixels, width, height);

    canvas = document.createElement('canvas');
    canvas.dataset.webgpuVerification = 'native-readback';
    canvas.width = width;
    canvas.height = height;
    canvas.style.cssText =
      'position:fixed;inset:0;width:100vw;height:100vh;' +
      'z-index:2147483647;pointer-events:none';
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas2D presentation is unavailable.');
    context.putImageData(new ImageData(rgba, width, height), 0, 0);
    document.body.appendChild(canvas);

    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)));

    return {
      canvas,
      metadata: {
        method: 'staged-native-webgpu-final-pipeline-readback',
        pixelWidth: width,
        pixelHeight: height,
        pose,
        includesDOMOverlays: false,
      },
      cleanup: () => canvas.remove(),
    };
  } catch (error) {
    canvas?.remove();
    throw error;
  } finally {
    // Routing was already restored after each render, including a harness's
    // persistent output target. Dispose only the per-capture target.
    target.dispose();
  }
}

// Three.js WebGPU readback pads each row to a multiple of 256 bytes whenever
// width * 4 is not already one. Accept that layout or a tightly packed one.
function toTightRGBA8(pixels, width, height) {
  if (!ArrayBuffer.isView(pixels) || pixels.BYTES_PER_ELEMENT !== 1) {
    throw new Error('Readback is not 8 bits per channel. Adapt its layout explicitly.');
  }
  const rowBytes = width * 4;
  const alignedBytesPerRow = Math.ceil(rowBytes / 256) * 256;
  if (pixels.byteLength === rowBytes * height) {
    return new Uint8ClampedArray(
      pixels.buffer, pixels.byteOffset, pixels.byteLength,
    );
  }
  if (pixels.byteLength === (height - 1) * alignedBytesPerRow + rowBytes) {
    return unpackRGBA8Rows(pixels, width, height, alignedBytesPerRow);
  }
  throw new Error(`Unexpected readback length ${pixels.byteLength} for ` +
    `${width}x${height} RGBA8. Adapt its layout explicitly.`);
}

function unpackRGBA8Rows(source, width, height, bytesPerRow) {
  const rowBytes = width * 4;
  const requiredLength = (height - 1) * bytesPerRow + rowBytes;
  if (!Number.isInteger(width) || !Number.isInteger(height) ||
      width <= 0 || height <= 0 ||
      !Number.isInteger(bytesPerRow) || bytesPerRow < rowBytes ||
      source.byteLength < requiredLength) {
    throw new Error('Invalid readback dimensions, stride or buffer length.');
  }
  const packed = new Uint8ClampedArray(rowBytes * height);
  const bytes = new Uint8Array(
    source.buffer, source.byteOffset, source.byteLength,
  );
  for (let y = 0; y < height; y++) {
    packed.set(bytes.subarray(y * bytesPerRow, y * bytesPerRow + rowBytes),
      y * rowBytes);
  }
  return packed;
}
```

Retain the returned object inside the browser page, capture the screenshot,
then call its `cleanup()` in a `finally` block. Only return serialisable
metadata across an automation boundary, not the canvas or cleanup function.
Delete temporary page globals when finished.

Surround the entire staged inspection with the harness's own pause/resume or
offscreen-session teardown handling. This helper does not own the application
loop and cannot restore a loop it did not pause. If the app uses several
viewports, XR or custom renderer state, account for that state explicitly rather
than assuming this template restores it all.

Do not independently add tone mapping or gamma correction to the copied pixels;
output routing already applies the application's own. If a capture looks
darker or more saturated than the application normally does, check that the
final frame was routed with `setOutputRenderTarget()` rather than bound with
`setRenderTarget()`, and that `renderFinalFrame()` is the application's real
final render. Where a direct capture works, compare one readback with it
before relying on readback alone.

## Pixel format, row stride and orientation

WebGPU requires the row stride of a texture-to-buffer copy (`bytesPerRow`) to
be a multiple of 256 bytes. For an RGBA8 texture:

```javascript
const tightBytesPerRow = width * 4;
const alignedBytesPerRow = Math.ceil(tightBytesPerRow / 256) * 256;
```

Three.js 0.184.0 to 0.186.1 `readRenderTargetPixelsAsync()` returns that
padded buffer as it is. Its length is
`(height - 1) * alignedBytesPerRow + width * 4`, so rows are padded whenever
the drawing-buffer width (device pixels, not CSS pixels) is not a multiple of
64: for example 1366, 1440, 390 or 2732 (1366 CSS pixels at a pixel ratio
of 2).
The template's `toTightRGBA8()` removes the padding with `unpackRGBA8Rows()`;
do not remove it twice. Other renderers or versions may differ, so check the
returned length against both layouts rather than assuming either.

Check orientation with an asymmetric known scene. Do not blindly apply the
vertical flip often used with WebGL. Check RGBA versus BGRA, alpha behaviour,
linear versus display colour space and HDR versus byte output separately.

## The two stale-frame problems

1. **Cold GPU frame:** the first offscreen readback can contain an earlier pose,
   despite correct CPU transforms. Submit and discard a synchronised frame at
   the intended location, then read another frame and inspect its content.
2. **Stale presentation surface:** the bytes can be fresh while the screenshot
   still captures the prior browser surface. Wait for presentation after
   `putImageData`, then examine the actual saved image.

A warm-up or two animation-frame callbacks are mitigations, not guarantees.
Do not keep increasing delays indefinitely. If the image still disagrees with
the requested view, diagnose the readback, state update and presentation paths
separately. Never accept a labelled but visibly incorrect image.
