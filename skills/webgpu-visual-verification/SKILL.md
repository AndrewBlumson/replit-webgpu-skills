---
name: webgpu-visual-verification
description: Capture and visually verify WebGPU applications using the available extended-desktop or browser view, with native final-pipeline GPU readback when preview iframe or headless screenshots are blank, black, white, incomplete or stale, or canvas rendering triggers device loss. Use for Three.js WebGPU and TSL scene inspections, graphical changes, reference comparisons, floating-object checks and incorrect screenshot locations. Distinguish compositor failures from genuine renderer failures. This is not a WebGL fallback, a browser-security bypass or a performance benchmark.
---

# WebGPU Visual Verification

## Purpose

Inspect what the application actually renders. Produce fresh screenshots of
the intended scene, examine them, and use that evidence to guide changes.

This skill includes the workaround verified in a Three.js 0.184.0 application:
render the real final WebGPU pipeline into a readable render target, read its
pixels, temporarily display them through Canvas2D, allow browser presentation
to settle, and capture that surface. Canvas2D presents the finished GPU image;
it does not render a replacement scene.

## Read the relevant reference

- Read [Native WebGPU readback](references/native-webgpu-readback.md) before
  implementing the workaround or diagnosing blank iframe captures.
- Read [Evidence and troubleshooting](references/evidence-and-troubleshooting.md)
  when validating an image, recording results, or investigating stale frames.

## 1. Establish the real application and capture environment

1. Use the confirmed application URL, not a guessed host or port. In a routed
   workspace, keep the correct application base path.
2. Identify the application frame. The preview shell and application may be
   different frames. Use the available browser or extended-desktop tools;
   do not assume a particular desktop, browser binary or automation tool exists.
3. Where authorised, opening the application directly as a top-level page can
   help isolate an embedding issue. Success there is not proof that the embedded
   preview itself works.
4. Confirm that the renderer has initialised and is using WebGPU, not WebGL.
   Record the adapter type when available. A software WebGPU adapter is still
   WebGPU, but it is not target-hardware performance evidence.
5. Record page errors, relevant console messages and unexpected navigation.
   Use GPU validation scopes when available. If unavailable, say so.

## 2. Select the least intrusive reliable capture route

Prefer a direct desktop or browser screenshot when it contains the correct,
fresh GPU canvas. If it is blank, incomplete or stale, or canvas rendering loses
the WebGPU device:

1. Check whether the application actually rendered a frame.
2. When the cause is unclear, compare a minimal known-colour WebGPU canvas with
   its native pixel readback. Correct readback with an incorrect screenshot is
   evidence of a capture/compositor problem, not proof of a broken game.
   If either test loses its device, use a fresh session for the other test.
   Do not require a known-failing canvas render before trying offscreen readback.
3. If the screenshot path is unreliable, use native final-pipeline readback
   as described in the implementation reference.
4. Do not switch to WebGL, use generated artwork, reconstruct the scene in
   Canvas2D, remove difficult scenery or silently alter the application.

If evidence points to canvas-triggered device loss, restart with a fresh
renderer/device and configure readable offscreen final output **before the
very first render**, including startup, warm-up and automatic-loop frames.
Follow [Offscreen startup after canvas-triggered device loss](references/native-webgpu-readback.md#offscreen-startup-after-canvas-triggered-device-loss).
Switching targets cannot recover an already-lost device.

The workaround provides visual evidence around a faulty screenshot path. It
does not repair the embedding infrastructure, provide an unavailable adapter,
fix broken shaders or bypass browser security and cross-origin restrictions.

## 3. Hold a stable state during capture

- Freeze application-source edits during each browser capture run. Live module
  reloads can destroy evaluations and invalidate frame evidence.
- Use one simulation and render authority. If staging a scene requires pausing
  the normal loop, do so through the existing development harness. Never start
  a competing loop or leave the application paused unintentionally.
- Set the intended scene or waypoint explicitly, including when the first
  requested waypoint is not the starting location.
- Synchronise render models, interpolation state, animated world objects,
  effects, camera and world matrices using the application's real update path.
- Allow asynchronous assets and pipeline initialisation to finish.
- Before the first saved cold-readback image, submit and discard a synchronised
  native frame at the intended pose. Then render and read the saved frame.
  Warm-up is a mitigation, not proof of freshness.

## 4. Capture the real final output

- Preserve the application's materials, camera, lighting, tone mapping and
  post-processing. Capture the final pipeline, not a diagnostic raw scene pass.
- Use a readable target appropriate to the renderer and output format.
- Await the readback operation. Respect byte offsets, row padding, orientation,
  channel order and colour conversion. Do not assume a WebGL-style vertical flip.
- Present only those GPU pixels in a temporary Canvas2D surface.
- Keep its size and aspect ratio consistent with the source. Distinguish
  device-pixel dimensions from CSS screenshot dimensions.
- Allow at least two animation-frame callbacks after presentation before
  requesting the screenshot. These callbacks do not replace GPU completion.
- Restore the previous render target, remove temporary surfaces and hooks,
  release capture-only resources, and restore any paused application state when
  the previous render path is usable. In an offscreen-only diagnostic session,
  keep its output target active until the loop is stopped; do not resume the
  known-failing canvas path during cleanup.

Keep instrumentation in development tooling. Do not add production debug
endpoints or expose privileged application state just to take screenshots.

## 5. Prove the image shows the requested scene

Check all three kinds of evidence:

1. **State:** the requested scene or waypoint, actual rendered object transforms,
   camera position and viewing direction agree.
2. **Pixels:** the readback is populated and appropriate for the expected scene.
   Checksums and pixel range can flag faults but cannot establish scene identity.
3. **Visual inspection:** open the saved image and verify its recognisable
   landmarks, viewpoint, subject and framing.

A filename, progress counter, successful render call, different checksum or
nonblank picture is not sufficient. Correct CPU transforms can accompany stale
GPU pixels. Reject and replace mislabelled or stale images, and identify any
superseded report entries.

## 6. Review the actual visual quality

Inspect the saved image, not only the diagnostic report. Check for:

- Floating objects and incomplete support chains down to actual terrain.
- Clipping, camera obstruction and intrusions into the playable route.
- Broken textures, detached details, lighting faults and poor silhouettes.
- Sparse planting, repeated assets and differences from supplied references.

For support checks, choose an unobstructed exterior camera. Do not hide foreground
geometry merely to make the scene look correct. If an inspection requires a
diagnostic cutaway, label it separately and retain normal-view evidence.

## 7. Use a bounded build-and-check loop

Make a coherent batch of changes, stop edits, capture the affected views and
inspect them. Fix concrete defects, then repeat only the checks invalidated by
those fixes. Do not repeat an entire gameplay journey for an isolated art change.

Passing automated tests, grounded geometry or clean GPU validation does not
establish reference-quality artwork. Keep functional and visual acceptance
separate. After repeated failed capture approaches, report the observed blocker
rather than accepting untrustworthy evidence.

## 8. Deliver evidence honestly

Save images with matching metadata: URL without credentials, viewport, pixel
size, scene or route position, camera, capture method and relevant diagnostics.
Do not put tokens, cookies, signed URLs or other credentials into reports.

Label each image as either:

- Direct desktop/browser capture.
- Staged native WebGPU final-pipeline readback.

State whether HTML interface overlays are included. A full-screen readback
surface normally excludes the HUD, menus and other DOM layers.

Present the inspected images. Report what improved, what failed, what was not
checked and what remains below the requested quality. A still frame does not
prove frame rate, frame pacing, input latency, audio, continuous play or the
health of the original embedded preview.
