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

The procedure was verified with Three.js 0.184.0, its WebGPURenderer and its
existing final RenderPipeline. The reference below is an adaptation template,
not a universally tested drop-in utility. Check the installed renderer APIs
before adapting it to another framework or version.

## Required access and preparation

Use the application's authorised development environment. Obtain the actual
renderer, final pipeline and application-specific synchronisation functions.
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
- `pipeline`: its existing final pipeline, including post-processing.
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
   is too late.
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

The example deliberately rejects padded or non-RGBA8 output instead of silently
presenting corrupted rows. See the format notes below for other layouts.

This helper captures an already usable renderer; it does not intercept startup
or recover device loss. For offscreen-only sessions, first establish the
persistent output routing above. Keep that harness-owned target alive when this
helper restores its temporary render-target state and disposes its own target.
Confirm the final pass writes into the same target that is read below. If the
pipeline overrides the temporary current target, adapt the capture to read its
persistent output target or temporarily route final output to the capture
target. Restore a usable offscreen output before releasing any temporary target;
the helper must not dispose a target owned by the harness.

```javascript
async function stageNativeWebGPUFrame({
  THREE,
  renderer,
  pipeline,
  synchroniseFrame,
  checkPose,
}) {
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

  const previousTarget = renderer.getRenderTarget();
  const target = new THREE.RenderTarget(width, height, {
    type: THREE.UnsignedByteType,
  });
  let canvas;

  async function submitAndRead() {
    await synchroniseFrame();
    const pose = await checkPose();
    if (pose?.valid !== true) {
      throw new Error('Rendered transforms or camera do not match the requested state.');
    }
    renderer.setRenderTarget(target);
    // Use the real final pipeline. Do not substitute renderer.render(scene, camera).
    pipeline.render();
    const pixels = await renderer.readRenderTargetPixelsAsync(
      target, 0, 0, width, height,
    );
    return { pixels, pose };
  }

  try {
    // Discard a cold frame at the intended pose, not at the starting scene.
    await submitAndRead();
    const { pixels, pose } = await submitAndRead();

    if (!ArrayBuffer.isView(pixels) ||
        pixels.BYTES_PER_ELEMENT !== 1 ||
        pixels.byteLength !== width * height * 4) {
      throw new Error('Readback is not tightly packed RGBA8. Adapt its layout explicitly.');
    }

    const rgba = new Uint8ClampedArray(
      pixels.buffer, pixels.byteOffset, pixels.byteLength,
    );
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
    // In offscreen-only sessions, the harness keeps its persistent output
    // target active; this restores and disposes only per-capture state.
    renderer.setRenderTarget(previousTarget);
    target.dispose();
  }
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

Do not treat the example as a universal colour-management configuration:
confirm its render-target output matches the application's normal final output.
Do not independently add tone mapping or gamma correction to the copied pixels.

## Pixel format, row stride and orientation

For raw WebGPU texture-to-buffer readback, the buffer row stride often needs
256-byte alignment. For an RGBA8 texture:

```javascript
const tightBytesPerRow = width * 4;
const alignedBytesPerRow = Math.ceil(tightBytesPerRow / 256) * 256;
```

Use the actual stride supplied to the copy operation. Some high-level renderer
APIs already remove padding; do not remove it twice. Where padding is present,
copy only the image bytes from each row:

```javascript
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
