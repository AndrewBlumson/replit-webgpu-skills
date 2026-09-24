# Evidence and troubleshooting

## Classify the problem before changing the app

| Observation | Interpretation and next step |
| --- | --- |
| Direct screenshot is blank, but a known-colour native readback is correct | Likely capture/compositor fault. Use native readback presentation and label it. |
| Both normal output and readback are blank | Investigate application initialisation, camera, render submission, resources and validation errors. Do not assume an iframe-only problem. |
| Image is nonblank but shows the starting location instead of the requested waypoint | Reject it. Check state advancement, interpolation, rendered transforms, camera, whether every render loop was paused, and presentation freshness. |
| CPU state and transforms are correct but pixels show an older scene | Metadata cannot prove GPU freshness. Three.js updates pipeline passes, most effects, shadow maps and skinned-mesh bones at most once per animation frame, so a capture rendered in the same frame as the application's loop shows the loop's pose, even without post-processing. Pause the loop and render in a fresh animation frame, as the template does. |
| The helper reports that `renderer.render()` was called outside `renderFinalFrame()` | A render loop outside `renderer.setAnimationLoop()` is still running, such as the application's own `requestAnimationFrame()` loop, or `synchroniseFrame()` or `checkPose()` renders. Pause the loop through the harness, move the rendering out of those functions and retry. |
| No animation frame arrives within the timeout | If the page is hidden or in a background tab, pipeline passes cannot refresh: bring it to the foreground. If it is visible, frames are slower than the timeout, as on a software adapter: raise `frameTimeoutMs`. Do not accept an image rendered without fresh frames. |
| The helper reports that a capture is already running or on screen | A previous capture was not cleaned up, or two captures overlapped. Call the earlier capture's `cleanup()` and capture again one at a time. |
| The HUD in an in-place readback shows values from a different moment than the scene | Set overlay values for the staged state in `synchroniseFrame()` and take the screenshot before `cleanup()` resumes the application. |
| The HUD is missing from a readback | Check `includesDOMOverlays`: scene-only captures and the full-viewport fallback exclude overlays by design. |
| Edges over a transparent background differ from the application, or `inexactAlphaPixels` is not zero | Those pixels add light over the page, which Canvas2D cannot reproduce exactly. Use an opaque scene background for the verification capture or compare with a direct capture. |
| Browser evaluation is destroyed during a source update | Inconclusive capture, not a proven GPU crash. Freeze edits and retry the affected view. |
| Application works at its direct URL but not embedded | Investigate embedding separately. Do not claim the preview iframe is fixed. |
| No usable WebGPU adapter/device can be obtained | Report the actual capability failure. Pixel readback cannot supply a missing renderer. |
| Device loss follows rendering to the canvas | Record the loss and render sequence. Retry in a fresh renderer/device with readable final output configured before the first render; keep startup, warm-up and cleanup offscreen. Follow the [offscreen startup procedure](native-webgpu-readback.md#offscreen-startup-after-canvas-triggered-device-loss). |
| A fresh offscreen startup also loses its device | Retain diagnostics and report the observed failure. Stop repeating the same attempt; do not infer that switching targets revives a lost device. |
| Canvas belongs to a cross-origin frame | Use authorised browser frame access or the application's permitted direct URL. Do not bypass the same-origin policy. |
| Readback is much darker or more saturated than the application | Tone mapping and output colour space were skipped. Route the final frame with `setOutputRenderTarget()`, not `setRenderTarget()`, and render it with the application's real final render function. |
| Colours are washed out, channels swapped or rows corrupted | Check final-output selection, colour space, channel order, byte format and actual row stride. Three.js 0.184 to 0.186 readback pads each row to a multiple of 256 bytes when the drawing-buffer width is not a multiple of 64 pixels; remove the padding once, as the template does. |
| The subject is hidden behind foreground geometry | Select a clearer inspection camera. Do not treat an occluded image as visual proof. |
| No GPU validation facility is available | Report validation as unavailable, not passed. |

## Three independent acceptance gates

### Functional state

Check that the application is in the correct scene and state. For staged driving
views, compare the intended waypoint with the actual rendered player's world
position and camera position/direction, not merely a progress counter.

Use tolerances appropriate to the application's scale. A threshold from one
game is not a universal requirement.

### Render validity

Confirm native WebGPU is active. Gather relevant page errors, console messages,
navigation events and scoped validation results. A scoped result describes only
the operations within that scope.

Pixel statistics can detect obviously empty output where a varied scene is
expected. A legitimately uniform view is not automatically broken. Different
checksums do not prove that either view shows the right subject.

### Visual quality

Open and inspect the saved image. Recognise the intended location through
landmarks, camera framing and object arrangement. Compare it with references
where provided.

For grounding, examine the complete support chain. A tree touching a planter
does not prove that the planter reaches the pavement. A building touching a
platform does not prove that the platform reaches the terrain.

Passing the first two gates does not establish the third.

## Suggested capture record

Save one matching record per image, or an unambiguous entry in a combined report.

```text
Image:
Capture date and time, with timezone:
Application URL, stripped of credentials and signed query strings:
Capture method:
Source state identifier:
Browser viewport in CSS pixels:
Readback dimensions in device pixels:
Device pixel ratio:
Application scene:
Requested camera or route position:
Actual rendered object position:
Actual camera position and viewing direction:
Pose checks and tolerances:
WebGPU backend confirmed:
Adapter classification, if available:
Loops paused, and settle frames rendered:
Presentation (metadata.presentation: in-place / full-viewport; an in-place capture with includesDOMOverlays false is scene-only):
DOM overlays included:
Transparent pixels (non-opaque / inexact):
Relevant page/console/navigation diagnostics:
GPU validation: passed / failed / unavailable / not run
Pixel sanity checks:
Personally inspected: yes / no
Recognisable scene evidence:
Visible defects:
Comparison with requested reference:
What this capture does not establish:
Supersedes:
Verdict: accepted / rejected / inconclusive
```

Use the user's preferred date and time format and include the timezone. Avoid
storing secrets, session tokens, cookies or credential-bearing URLs.

## Examples

### Acceptable evidence

The requested coastal bend is visible, including the pavilion on the expected
side. Rendered player and camera poses agree with the requested route state.
The image came from the final native pipeline and was personally inspected.
The report labels it as staged readback, states whether the HUD is included,
and makes no performance claims.

### Rejected evidence

A file labelled as a mid-route view shows the start gantry. It is nonblank and
has a checksum different from another image. Reject it anyway: its visible
content contradicts the label. Keep the failure record or mark it as superseded
when producing a corrected image and report.

### Limited evidence

An unobstructed building-base view shows its foundation reaching the terrain.
This supports that local grounding claim. It does not establish every building's
support, collision safety, target-hardware frame rate or reference-quality art.

## Avoid misleading conclusions

- A title-screen illustration is not evidence of the in-game renderer.
- Staged fixed-step advancement is not a continuous gameplay test.
- Software-adapter output is not a target-hardware benchmark.
- A scene-only readback is not proof that the HUD or menus are correct.
- An in-place readback shows the HUD as the page shows it while the capture is
  on screen, with the application paused. It does not prove that the HUD
  updates correctly during play.
- A successful direct page is not proof that the iframe works.
- Passing tests and GPU checks is not proof of visual quality.
- A skill documents a workflow. It cannot guarantee that every browser,
  framework or future renderer version exposes the same capture APIs.
