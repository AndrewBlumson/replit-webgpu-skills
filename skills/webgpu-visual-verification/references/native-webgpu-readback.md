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
Three.js 0.186.1 (the latest release when written) on one real GPU adapter
(Apple Metal, headless Chrome for Testing), with a smaller set repeated on
0.184.0. The checks covered a RenderPipeline with bloom or TRAA, a
DirectRenderPipeline and plain `renderer.render()`; an application loop that
kept animating during the capture; antialiasing on and off; an offscreen
session with a persistent output target, with the canvas still on the page;
repeated captures; drawing-buffer sizes that do and do not need row padding,
at pixel ratios from 0.25 to 2; transparent and opaque canvases; and 36 page
layouts with DOM HUD overlays, including a HUD before the canvas in the page,
scrolled pages and containers, a table cell, flexbox, CSS transforms, rounded
corners, `object-fit`, filters, opacity, pixel-art scaling and a CSS fade-in
on the canvas, for both in-place and scene-only captures. The same routing
code, in the previous version of this template, was also checked with FXAA, a
HUD or view-model scene drawn in a second pass (see the antialiasing case
below), a minimap rendered into its
own target, a stencil mask and a resize. Screenshots of the presented readback
were pixel-identical to screenshots of the application at the same pose,
except at antialiased edges over a transparent background in 0.184.0 (see
Transparent canvases) and in the TRAA scene, where camera jitter means no two
frames match exactly (see Why readback frames go stale). A hidden background
tab produced the timeout error. A failure at each step undid the helper's own
changes to the loop, `renderer.render`, routing and the page, although a throw
inside a pipeline pass left Three.js's own output settings changed (see
below). Not checked: the full-viewport fallback for a canvas that is not on
the page, shadows and skinned meshes (the stale-frame notes on them come from
the Three.js source), and more than one TRAA scene; a canvas inside a shadow
root was checked only in a DOM test without WebGPU. In 0.184.0 a
RenderPipeline can draw a moving object at its previous position when the
camera also moves, a Three.js defect fixed by 0.186, so use the latest
release. These were test scenes, not a full application, so this remains an
adaptation template, not a universally tested drop-in utility. Check the
installed renderer APIs before adapting it to another framework or version.

One case is known not to match the screen. With antialiasing on, Three.js
0.186 draws a `RenderPipeline`'s full-screen output to the canvas without
multisampling but a later ordinary render with it. So a scene drawn onto the
canvas after `pipeline.render()`, with `autoClear` off and without tone mapping
or colour-space conversion, replaces the pipeline's image on screen with a
nearly empty multisample buffer, while the capture draws both into one target
and shows the intended composite rather than what the player sees. Draw such
a HUD or view model inside the pipeline instead, and compare one capture with
a direct screenshot whenever a direct screenshot works.

## Required access and preparation

Use the application's authorised development environment. Obtain the actual
renderer, the application's final draw function and its synchronisation
functions.
Prefer existing development hooks. Do not expose them in production.

Run the operation inside the application page or the correct automation frame.
Do not assume the containing preview shell can access a cross-origin child.
Use supported frame automation or open the authorised application URL directly.
Never disable browser security to cross that boundary.

The helper pauses the renderer's own animation loop (the callback passed to
`renderer.setAnimationLoop()`) and keeps it paused until the capture's
`cleanup()`. Pause any other loop the application runs, such as its own
`requestAnimationFrame()` loop, timers or workers that change rendered state,
through the existing harness. The helper stops with an error if
`renderer.render()` is called outside `renderFinalFrame()` between the pause
and the readback. It cannot see timers, workers or compute passes that change
state without rendering; the second `checkPose()` after the readback is the
check for those. Call the helper from outside the application's loop callback.
For canvas-triggered device loss, establish the offscreen startup path below
before allowing any render. Complete asset loading and renderer
initialisation, then choose the intended scene before capture.

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
  The helper has already paused the renderer's animation loop when it calls
  this, so apply the state directly; do not wait for the application's loop to
  apply it, because that never happens and the capture would hang.
  Update DOM overlays such as HUD values here too, so they match the staged
  state. It must not render, and neither may `checkPose()`: the helper treats
  any `renderer.render()` call outside `renderFinalFrame()` as a competing loop.
- `checkPose()`: validates the requested state against actual rendered object
  transforms and camera position/direction. Return a plain object containing
  `valid: true` only when the relevant checks pass, plus their measured evidence.
  The helper checks it before rendering and again after the readback.

Optional: `includeOverlays` (default `true`), `settleFrames` (default 1) and
`frameTimeoutMs` (default 2000), described below.

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

The same code ships as `assets/webgpu-readback.js`, a module exporting
`stageNativeWebGPUFrame`. Copy that file into the application's
development-only QA code instead of retyping the block below; keep the two
identical when either changes.

The example shows the captured pixels in the WebGPU canvas's own place on the
page. It temporarily swaps the live canvas for a Canvas2D copy with the same
attributes (id, classes, inline style), so the page's CSS, layout, borders,
scaling and stacking apply to the copy exactly as to the game canvas. DOM
overlays such as the HUD, menus and subtitles therefore stay above it as they
do in the game. `cleanup()` swaps the live canvas back. While the copy is shown
the live canvas is out of the page: a `ResizeObserver` or
`IntersectionObserver` watching it sees it shrink to zero or leave the page
and then return, and it loses keyboard focus (a `blur` event), pointer lock and
fullscreen, none of which `cleanup()` restores. If the application reacts to
those, for example by opening a pause menu or resizing itself, stage the
capture without focus, pointer lock or fullscreen on the canvas, or adapt the
presentation. A CSS animation on the canvas element itself, such as a fade-in,
restarts on each insertion; the template jumps finite ones to their end on the
copy and on the returned canvas, but an infinite one cannot be matched.

Pass `includeOverlays: false` for a scene-only image. Every element on the page
except the canvas copy and its ancestors is then hidden until `cleanup()`: the
siblings of the canvas and of each ancestor, including across a shadow-root
boundary, get `visibility: hidden` (their number, which includes non-rendered
elements such as `<head>`, is reported as `hiddenElements`) and their
descendants inherit it, so the layout, the page backgrounds and the canvas's
own CSS stay exactly as they are. Text or pseudo-elements belonging to the
ancestors themselves, and descendants whose CSS forces `visibility: visible`,
are not hidden, so check the image. When the canvas is not attached to the page, as in some offscreen
sessions, the image fills the viewport and excludes overlays.

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

The example pauses the application's animation loop, stages the requested
state, and renders in fresh animation frames, because Three.js updates
pipeline passes and other per-frame work at most once per animation frame (see
the stale-frame notes below). It renders `settleFrames` discarded frames first
(default 1) so temporal effects can catch up with the staged pose, then reads
back the next one. It restores routing straight after each render call, before
any await. If no animation frame arrives within `frameTimeoutMs` (default
2000), for example because the page is hidden, it stops with an error instead
of returning a stale image. Only one capture per renderer can run or be on
screen at a time; a second call before `cleanup()` stops with an error.

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
const capturesInProgress = new WeakSet();

async function stageNativeWebGPUFrame({
  THREE,
  renderer,
  renderFinalFrame,
  synchroniseFrame,
  checkPose,
  includeOverlays = true,
  settleFrames = 1,
  frameTimeoutMs = 2000,
}) {
  if (typeof renderFinalFrame !== 'function') {
    throw new Error('Pass renderFinalFrame: the function that draws the application\'s final frame.');
  }
  if (typeof synchroniseFrame !== 'function' ||
      typeof checkPose !== 'function') {
    throw new Error('Application-specific synchronisation and pose checks are required.');
  }
  if (!Number.isInteger(settleFrames) || settleFrames < 0) {
    throw new Error('settleFrames must be a whole number of frames.');
  }
  if (!Number.isFinite(frameTimeoutMs) || frameTimeoutMs <= 0) {
    throw new Error('frameTimeoutMs must be a positive number of milliseconds.');
  }
  if (capturesInProgress.has(renderer)) {
    throw new Error('A capture is already running or still on screen for this renderer. ' +
      'Call cleanup() on the previous capture first.');
  }
  capturesInProgress.add(renderer);

  const previousLoop = renderer.getAnimationLoop();
  const ownRender = Object.prototype.hasOwnProperty.call(renderer, 'render');
  const render = renderer.render;
  let routing = false;
  let otherRenders = 0;
  let target = null;
  let presentation = null;

  // Count renders the helper did not make. Inside a routed frame, keep the
  // canvas behaviour: drawing to the canvas leaves no render target bound,
  // but drawing to an output target leaves that target bound. Unbinding it
  // keeps a clear() or clearDepth() between passes on the same buffer.
  renderer.render = function (...args) {
    if (!routing) {
      otherRenders += 1;
      return render.apply(this, args);
    }
    const bound = this.getRenderTarget();
    const result = render.apply(this, args);
    if (bound === null && this.getRenderTarget() === target) {
      this.setRenderTarget(null);
    }
    return result;
  };
  const restoreRender = () => {
    if (ownRender) renderer.render = render;
    else delete renderer.render;
  };
  const restoreLoop = () => {
    if (renderer.getAnimationLoop() === null) {
      renderer.setAnimationLoop(previousLoop);
    }
  };

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
    routing = true;
    try {
      renderer.setRenderTarget(null);
      renderer.setOutputRenderTarget(target);
      const result = renderFinalFrame();
      if (typeof result?.then === 'function') {
        throw new Error('renderFinalFrame() must draw synchronously. Do not pass an async function or renderAsync().');
      }
    } finally {
      routing = false;
      renderer.setOutputRenderTarget(previousOutput);
      renderer.setRenderTarget(previousTarget);
    }
  }

  try {
    await renderer.init();
    if (renderer.backend?.isWebGPUBackend !== true) {
      throw new Error('The application is not using the native WebGPU backend.');
    }

    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const width = size.x;
    const height = size.y;
    if (!Number.isInteger(width) || !Number.isInteger(height) ||
        width <= 0 || height <= 0) {
      throw new Error(`Invalid drawing-buffer dimensions (${width} x ${height}). ` +
        'If the game resizes from its canvas, ignore 0 x 0 sizes: the canvas ' +
        'leaves the page while a capture is shown.');
    }

    // Match the canvas's antialiasing, depth and stencil: some pipelines
    // draw straight into the output target, which would otherwise lack them.
    target = new THREE.RenderTarget(width, height, {
      type: THREE.UnsignedByteType,
      samples: renderer.samples,
      depthBuffer: renderer.depth,
      stencilBuffer: renderer.stencil,
    });

    // Pause the application's animation loop, so it can neither move the
    // staged state nor use up the frame that the capture renders in. It
    // stays paused until cleanup(), so DOM overlays keep the staged state.
    await renderer.setAnimationLoop(null);
    initialiseTarget();
    await synchroniseFrame();
    const staged = await checkPose();
    if (staged?.valid !== true) {
      throw new Error('Rendered transforms or camera do not match the requested state.');
    }

    // Per-frame work, including pipeline passes, runs at most once per
    // animation frame, so render at the start of fresh frames. Settle frames
    // let temporal effects catch up with the staged pose and are discarded;
    // the last frame is read back.
    for (let frame = 0; frame <= settleFrames; frame += 1) {
      await nextAnimationFrame(frameTimeoutMs);
      renderRouted();
    }
    const pixels = await renderer.readRenderTargetPixelsAsync(
      target, 0, 0, width, height,
    );
    if (otherRenders > 0) {
      throw new Error(`renderer.render() was called ${otherRenders} time(s) outside ` +
        'renderFinalFrame() during the capture. Pause any render loop the application ' +
        'runs outside renderer.setAnimationLoop(), and do not render in ' +
        'synchroniseFrame() or checkPose().');
    }
    restoreRender();
    const pose = await checkPose();
    if (pose?.valid !== true) {
      throw new Error('The application state changed during capture.');
    }

    const converted = toCanvas2DPixels(
      toTightRGBA8(pixels, width, height), renderer.alpha,
    );
    presentation = presentReadback(renderer.domElement, converted.rgba,
      width, height, includeOverlays);
    await nextAnimationFrame(frameTimeoutMs);
    await nextAnimationFrame(frameTimeoutMs);

    const shown = presentation;
    presentation = null;
    let cleaned = false;
    return {
      canvas: shown.canvas,
      metadata: {
        method: 'staged-native-webgpu-final-pipeline-readback',
        pixelWidth: width,
        pixelHeight: height,
        pose,
        settleFrames,
        presentation: shown.placement,
        includesDOMOverlays: shown.includesDOMOverlays,
        hiddenElements: shown.hiddenElements,
        canvasAlphaMode: renderer.alpha ? 'premultiplied' : 'opaque',
        nonOpaquePixels: converted.nonOpaquePixels,
        inexactAlphaPixels: converted.inexactAlphaPixels,
      },
      // Put the live canvas back and resume the application's loop.
      cleanup: () => {
        if (cleaned) return;
        cleaned = true;
        shown.remove();
        restoreLoop();
        capturesInProgress.delete(renderer);
      },
    };
  } catch (error) {
    presentation?.remove();
    restoreRender();
    restoreLoop();
    capturesInProgress.delete(renderer);
    throw error;
  } finally {
    target?.dispose();
  }
}

function nextAnimationFrame(timeoutMs) {
  return new Promise((resolve, reject) => {
    let timer = 0;
    const request = requestAnimationFrame(() => {
      clearTimeout(timer);
      resolve();
    });
    timer = setTimeout(() => {
      cancelAnimationFrame(request);
      const visible = document.visibilityState === 'visible';
      reject(new Error(`No animation frame arrived within ${timeoutMs} ms ` +
        `(page visibility: ${document.visibilityState}). ` +
        (visible
          ? 'The adapter may be too slow for this timeout: raise frameTimeoutMs. '
          : 'Bring the page to the foreground. ') +
        'Pipeline passes only refresh on animation frames.'));
    }, timeoutMs);
  });
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

// The browser shows a WebGPU canvas as premultiplied alpha, or as opaque when
// the renderer was created with alpha: false. Canvas2D expects straight alpha.
function toCanvas2DPixels(rgba, canvasHasAlpha) {
  let nonOpaquePixels = 0;
  let inexactAlphaPixels = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    const alpha = rgba[i + 3];
    if (!canvasHasAlpha) {
      rgba[i + 3] = 255;
      continue;
    }
    if (alpha === 255) continue;
    nonOpaquePixels += 1;
    // A colour channel above alpha is out of range for premultiplied alpha;
    // straight alpha cannot represent it, so such pixels are approximated.
    if (rgba[i] > alpha || rgba[i + 1] > alpha || rgba[i + 2] > alpha) {
      inexactAlphaPixels += 1;
    }
    if (alpha > 0) {
      const scale = 255 / alpha;
      rgba[i] *= scale;
      rgba[i + 1] *= scale;
      rgba[i + 2] *= scale;
    }
  }
  return { rgba, nonOpaquePixels, inexactAlphaPixels };
}

// Show the pixels in the WebGPU canvas's own place on the page: swap the live
// canvas for a Canvas2D copy with the same attributes, so layout, CSS and the
// stacking under DOM overlays such as the HUD stay exactly as in the game.
function presentReadback(source, rgba, width, height, includeOverlays) {
  const canvas = document.createElement('canvas');
  for (const { name, value } of source.attributes ?? []) {
    canvas.setAttribute(name, value);
  }
  canvas.width = width;
  canvas.height = height;
  canvas.dataset.webgpuVerification = 'native-readback';
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas2D presentation is unavailable.');
  context.putImageData(new ImageData(rgba, width, height), 0, 0);

  if (!source.isConnected) {
    // Offscreen sessions may never attach the canvas: fill the viewport.
    canvas.removeAttribute('id');
    canvas.removeAttribute('class');
    canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;' +
      'z-index:2147483647;pointer-events:none';
    document.body.appendChild(canvas);
    return {
      canvas,
      placement: 'full-viewport',
      includesDOMOverlays: false,
      hiddenElements: 0,
      remove: () => canvas.remove(),
    };
  }

  source.replaceWith(canvas);
  let overlays = null;
  try {
    finishRestartedAnimations(canvas);
    overlays = includeOverlays ? null : hideOverlays(canvas);
  } catch (error) {
    canvas.replaceWith(source);
    throw error;
  }
  return {
    canvas,
    placement: 'in-place',
    includesDOMOverlays: includeOverlays,
    hiddenElements: overlays?.count ?? 0,
    remove: () => {
      overlays?.restore();
      if (canvas.isConnected) {
        canvas.replaceWith(source);
        finishRestartedAnimations(source);
      }
    },
  };
}

// A CSS animation on the canvas, such as a fade-in, restarts whenever the
// element is inserted. Jump finite ones to their end, as on the live canvas.
function finishRestartedAnimations(element) {
  for (const animation of element.getAnimations?.() ?? []) {
    if (animation.effect?.getComputedTiming().endTime !== Infinity) {
      animation.finish();
    }
  }
}

// For a scene-only image, hide every element except the canvas copy and its
// ancestors. Layout, page backgrounds and the canvas's own CSS stay as they
// are. Text or pseudo-elements belonging to the ancestors themselves, and
// descendants that force visibility: visible, are not hidden.
function hideOverlays(canvas) {
  const hidden = [];
  for (let node = canvas; node.parentNode && node.parentNode !== document;) {
    const parent = node.parentNode;
    for (const sibling of parent.children) {
      if (sibling === node || !sibling.style) continue;
      hidden.push([
        sibling,
        sibling.style.getPropertyValue('visibility'),
        sibling.style.getPropertyPriority('visibility'),
      ]);
      sibling.style.setProperty('visibility', 'hidden', 'important');
    }
    // Step out of a shadow root to its host element.
    node = parent instanceof ShadowRoot ? parent.host : parent;
  }
  return {
    count: hidden.length,
    restore: () => {
      for (const [element, value, priority] of hidden) {
        if (value) element.style.setProperty('visibility', value, priority);
        else element.style.removeProperty('visibility');
      }
    },
  };
}
```

Retain the returned object inside the browser page, capture the screenshot,
then call its `cleanup()` in a `finally` block. `cleanup()` swaps the live
canvas back and resumes the application's animation loop; until it runs, the
game stays paused, so never skip it. Only return serialisable metadata across
an automation boundary, not the canvas or cleanup function. Delete temporary
page globals when finished.

Because the loop stays paused while the image is on screen, DOM overlays keep
whatever `synchroniseFrame()` set. The first frame after `cleanup()` can carry
a long time step, so the application should clamp its frame delta as a game
loop normally does. Loops other than `renderer.setAnimationLoop()` stay the
harness's responsibility, as does any offscreen-session teardown. If the app
uses several viewports, XR or custom renderer state, account for that state
explicitly rather than assuming this template restores it all. If
`renderFinalFrame()` throws part-way through a pipeline, Three.js itself can be
left with changed tone-mapping and colour-space settings; reload the
application before further captures.

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

## Transparent canvases

The browser shows a WebGPU canvas created with `alpha: true` (the Three.js
default) as premultiplied alpha, and one created with `alpha: false` as opaque.
Canvas2D `putImageData()` expects straight alpha, so the template divides each
transparent pixel's colour by its alpha, or makes every pixel opaque when the
canvas is opaque. A scene with an opaque background produces no transparent
pixels; in the tests, a `RenderPipeline` that added bloom to the scene pass
produced none either, but other pipelines can keep the scene's alpha.
`nonOpaquePixels` reports how many there were.

A pixel whose colour is brighter than its alpha allows is outside the
premultiplied range; Chrome composites it as light added over the page.
Canvas2D cannot show that, so the template reports such pixels in
`inexactAlphaPixels`; Three.js 0.184 wrote some at antialiased edges over a
transparent background. When that count is not zero and the edges matter, give
the scene an opaque background for the verification capture or compare it with
a direct capture.

## Why readback frames go stale

1. **Per-frame work runs once per animation frame.** In Three.js 0.184.0 to
   0.186.1, `RenderPipeline` scene passes (`pass()`), most post-processing
   effects (bloom, FXAA, TRAA and others), shadow maps, reflectors,
   skinned-mesh bone matrices and light colours update at most once per
   renderer frame, as do `rtt()` render-to-texture nodes in 0.186.1 (in 0.184.0
   they update on every render call). The renderer advances that frame only on
   its own `requestAnimationFrame()` tick, which runs every animation frame
   after `renderer.init()` whether or not an animation loop is set, and in
   `compileAsync()`; never in `render()` or `pipeline.render()`. A capture
   rendered in the same animation frame as the application's own render
   therefore reuses the loop's pass textures, shadows and bone poses, even with
   plain `renderer.render()` and even when the transforms and `checkPose()` are
   correct. The template avoids this by pausing the loop and rendering in fresh
   animation frames.
2. **Hidden or throttled pages get no animation frames.** Passes then never
   refresh. The template stops with an error after `frameTimeoutMs` instead of
   returning a stale image; bring the page to the foreground and retry. On a
   visible page, the same error means frames are slower than the timeout, as
   on a software adapter: raise `frameTimeoutMs`.
3. **Temporal effects need history at the new pose.** TRAA, motion blur and
   similar effects accumulate over frames, so a capture straight after a staged
   jump has unfinished antialiasing or ghosting. TRAA also jitters the camera
   every frame, so no two captures match exactly, even after convergence: in
   the test scene, two converged captures still differed by more than 16 of 255
   in about 0.1% of pixels, and by up to 90. Use 32 to 64 `settleFrames` for
   such effects, then compare the capture with one that used many more settle
   frames: accept it when the differences are scattered edge pixels no larger
   than those between two such long-settled captures, not when every pixel
   matches.
4. **TSL `time` keeps running while the loop is paused.** It follows the wall
   clock, so pausing does not freeze shader animation driven by `time`. Drive
   such effects from an application-owned uniform when captures must repeat.
5. **Stale presentation surface:** the bytes can be fresh while the screenshot
   still captures the prior browser surface. The template waits two animation
   frames after presenting; then examine the actual saved image.

Do not keep increasing delays. If the image still disagrees with the requested
view, diagnose the readback, state update and presentation paths separately.
Never accept a labelled but visibly incorrect image.

## Checking a newer Three.js release

The version-specific details in this reference were read from, and tested
with, Three.js 0.186.1 and 0.184.0. After upgrading Three.js, check these in
the installed package before relying on the template:

- `readRenderTargetPixelsAsync()` still returns rows padded to 256 bytes, or
  tightly packed rows; the template rejects any other length.
- `setOutputRenderTarget()` and `getOutputRenderTarget()` still exist and still
  apply tone mapping and output colour space to the output target.
- `NodeFrame.update()` is still called only by the renderer's animation tick
  (`Animation.js`) and `compileAsync()`, so rendering in fresh animation
  frames still refreshes pipeline passes, shadows and skinning.
- The renderer still has `getAnimationLoop()` and `setAnimationLoop()`.
- A manual `clear()` on a fresh output target still needs the one-time clear.

Then compare one known-colour readback with a direct capture of the same pose.
