---
name: webgpu-visual-verification
description: Capture and visually verify WebGPU applications using the available extended-desktop or browser view, with native final-pipeline GPU readback when preview iframe or headless screenshots are blank, black, white, incomplete or stale, or canvas rendering triggers device loss. Use for Three.js WebGPU and TSL scene inspections, graphical changes, reference comparisons, floating-object checks, incorrect screenshot locations and scripted gameplay playthroughs reported as a labelled contact sheet. Distinguish compositor failures from genuine renderer failures. This is not a WebGL fallback, a browser-security bypass or a performance benchmark.
---

# WebGPU Visual Verification

## Purpose

Inspect what the application actually renders. Produce fresh screenshots of
the intended scene, examine them, and use that evidence to guide changes.

This skill includes a workaround first verified in a Three.js 0.184.0
application and since checked in 0.186.1 (the latest release when written) and
0.184.0 test scenes: pause the application's render loop, route its real final
frame into a readable render target in a fresh animation frame, read its
pixels, temporarily show them through Canvas2D in the WebGPU canvas's place,
allow browser presentation to settle, and capture that surface. Canvas2D
presents the finished GPU image; it does not render a replacement scene. After
a Three.js upgrade, re-check the version-specific points listed in the
reference.

## Read the relevant reference

- Read [Native WebGPU readback](references/native-webgpu-readback.md) before
  implementing the workaround or diagnosing blank iframe captures.
- Read [Evidence and troubleshooting](references/evidence-and-troubleshooting.md)
  when validating an image, recording results, or investigating stale frames.
- Read [Scripted playthroughs](references/scripted-playthrough.md) when checking
  gameplay rather than a single view: controls, jumps, collisions, triggers,
  checkpoints, failure, restart or completion.

The readback template also ships as `assets/webgpu-readback.js`, and
`assets/contact-sheet.js` combines captures into one labelled image. Copy them
into the application's development-only QA code rather than retyping them.

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
- Use one simulation and render authority. The readback helper pauses the
  renderer's own animation loop until its `cleanup()`, which runs after the
  screenshot; pause any other loop through the existing development harness.
  Never start a competing loop or leave the application paused unintentionally.
- Set the intended scene or waypoint explicitly, including when the first
  requested waypoint is not the starting location.
- Synchronise render models, interpolation state, animated world objects,
  effects, camera and world matrices using the application's real update path.
- Allow asynchronous assets and pipeline initialisation to finish.
- Render the saved frame in a fresh animation frame while the application
  loop is paused: Three.js updates pipeline passes, most effects, shadow maps
  and skinned-mesh bones at most once per animation frame, so a frame
  rendered alongside the loop's own shows the loop's pose, even without
  post-processing. Use settle frames for temporal effects. A hidden or
  throttled page gets no animation frames; bring it to the foreground rather
  than accepting a possibly stale image.
- Set DOM overlay values, such as the HUD, for the staged state too, and keep
  the application paused until the screenshot is saved.

## 4. Capture the real final output

- Preserve the application's materials, camera, lighting, tone mapping and
  post-processing. Capture the application's final render, including its
  post-processing pipeline when it has one, not a diagnostic raw scene pass.
- Use a readable target appropriate to the renderer and output format. Route
  the final frame to it as screen output (Three.js: `setOutputRenderTarget()`),
  so tone mapping and output colour space are applied.
- Await the readback operation. Respect byte offsets, row padding, orientation,
  channel order and colour conversion. Do not assume a WebGL-style vertical flip.
- Present only those GPU pixels in a temporary Canvas2D surface that takes the
  WebGPU canvas's place on the page, so its CSS and the DOM overlays such as
  the HUD above it stay as in the game. For a scene-only image, hide the other
  page elements while the surface is shown (the template's
  `includeOverlays: false`) and label the image accordingly. Convert
  premultiplied canvas alpha to the straight alpha Canvas2D expects.
- Keep its size and aspect ratio consistent with the source. Distinguish
  device-pixel dimensions from CSS screenshot dimensions.
- Allow at least two animation-frame callbacks after presentation before
  requesting the screenshot. These callbacks do not replace GPU completion.
- Restore the previous render target and output render target, remove
  temporary surfaces and hooks,
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

## 8. Play the game with a scripted route

When the task involves gameplay, drive the game through its development-only
`window.__qa` hook (the `aaa-threejs-game-studio` skill's
`assets/qa-harness.template.js`) as described in
[Scripted playthroughs](references/scripted-playthrough.md). If the game has no
hook yet, first follow "Add the hook to a game that has none" in that
reference.

- Reset to a named scenario and seed, then step the fixed simulation with
  scripted inputs. Do not rely on simulated key presses and wall-clock waits.
- Give each route segment an expectation a player would notice, and also run
  routes that should fail, with expectations that assert the failure.
- Capture the moments that matter onto a contact sheet and screenshot it; keep
  individual captures on screen when the HUD must be seen. Await every
  scenario, capture and run.
- Check one capture against a direct screenshot (through `__qa.drawLive()`)
  whenever direct screenshots work.
- Run the route twice from the same scenario and seed and compare the states
  and frame fingerprints; differences mean hidden nondeterminism to fix first.
- Hand control back with `__qa.resume()` and confirm the live game runs.

A scripted run proves what the simulation does. Feel and difficulty, input
latency, bindings, pointer lock and mouse-look, gamepad or touch, audio, and
frame rate and pacing on the target device still need a person or the target
device; report them as untested rather than passed.

## 9. Deliver evidence honestly

Save images with matching metadata: URL without credentials, viewport, pixel
size, scene or route position, camera, capture method and relevant diagnostics.
Do not put tokens, cookies, signed URLs or other credentials into reports.

Label each image as one of:

- Direct desktop/browser capture.
- Staged native WebGPU final-pipeline readback.
- Contact sheet of staged readback captures from a scripted route, with the
  scenario, seed and pass/fail of each expectation.

State whether HTML interface overlays are included. An in-place readback
includes the HUD, menus and other DOM layers; a scene-only capture, or a
full-viewport fallback when the canvas is not on the page, excludes them.

Present the inspected images. Report what improved, what failed, what was not
checked and what remains below the requested quality. A still frame does not
prove frame rate, frame pacing, input latency, audio, continuous play or the
health of the original embedded preview.
