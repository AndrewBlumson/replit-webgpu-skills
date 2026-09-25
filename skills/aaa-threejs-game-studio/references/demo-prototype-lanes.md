# Demo and prototype lanes

These lanes keep the rules that "Apply the default product contract" in `SKILL.md` lists for every lane, and the same visual ambition as production. Read every section of `SKILL.md` whose heading does not start "Production lane:". This file replaces the production paperwork (brief, asset pipeline, acceptance ledger, QA route, the scaffold script and the gates in `verification.md`) with a short agreed contract and a fixed set of evidence. Report it as `SKILL.md` "Report evidence honestly" says; in these lanes the report is the record.

## What to read

Besides `SKILL.md` and this file, read only these parts of the references `SKILL.md` lists:

- `webgpu-cookbook.md`: the opening, its first three sections, the section for each API you use, and its Version note when the installed release is not the one it was tested with; all of it for a major rebuild or an upgrade of an existing project (installing the latest release in a new project is not an upgrade);
- `renderer-tsl.md`: "Strict WebGPU bootstrap", plus "Runtime ownership and frame order" in a prototype; for work the cookbook has no section for, the section whose heading names it (world rain: "Weather and wet surfaces"; rain on glass is a camera effect and needs none);
- `visual-direction.md`: "Make VFX causal and spatial" and "Reject these common “AI demo” signatures"; a prototype adds "Treat camera as a game system" and "Keep UI subordinate but complete";
- `gameplay-systems.md`, in a prototype only: "Session state and clocks", plus the section whose heading names each system the prototype has (failure: "Objectives, triggers, checkpoints, and restart");
- `failure-modes.md` when something breaks, and `blender-production.md` only with a configured Blender MCP connection;
- `source-ledger.md` only to check a claim or provenance, to choose a dependency other than Three.js and Vite, or for an upgrade.

Skip `world-asset-pipeline.md`: the cookbook's "Loading models" and "Instancing" sections and `gameplay-systems.md` "Player controller and collision choice" cover these lanes. In this file, a demo skips the "A prototype also needs" list and "Evidence the prototype lane must deliver", a prototype skips "Give the agent a way to look (demo)", and both read "Repairs in these lanes" only for a Repair and "Moving up" only for a change of lane.

## Agree the contract in the first message

Before writing code, send one short message with:

- the lane, and how to switch ("Say 'production' for the full vertical-slice process");
- the target: desktop Chrome or Edge with WebGPU on a capable GPU, with no WebGL fallback;
- two to five "done when" lines, each something a person could see or do, such as "rain stops under the bridge", "the player can jump the gap" or "a miss loses the run and restart works";
- the provisional defaults you chose, labelled as defaults.

Each "done when" line becomes a row of the final evidence table, proved by a capture (demo) or a route expectation (prototype). Word motion as a state a still can show, such as a clear trail behind a sliding drop, or prove it with two views at different clock times. Put feel and smoothness on the check card, not in these lines; when the request is about feel, such as "the jump feels floaty", write measurable stand-ins a route can prove (peak height, airtime, fall speed, response in ticks) as the lines, label their target values as defaults, and leave the feel itself to the card. Keep building while the user reads it; stop only for a choice that is expensive to reverse.

## Build

- New project: resolve the latest stable Three.js (`npm view three version`, or the official releases page), pin it, and note where you checked. Keep one `three` in the lockfile, or one version in every import-map URL. An existing project keeps its release and reports when a newer one exists; only a major rebuild upgrades it by default, and any other change upgrades, through a tested migration, only when it needs a newer release or the user asks (`SKILL.md`, "Apply the default product contract").
- Use Vite (JavaScript or TypeScript), or a single page whose import map has all four entries (`three`, `three/webgpu`, `three/tsl`, `three/addons/`). Keep QA and capture code in its own development-only folder; the production folder layout is not required.
- Start the renderer with the cookbook's `createRenderer()`. Catch its error and show the message in the canvas's place. In development only, log one line after `init()` with `THREE.REVISION`, `renderer.backend.isWebGPUBackend`, and the adapter the renderer uses: `renderer.backend.device.adapterInfo` where the browser exposes it, otherwise `(await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' }))?.info`, labelled as a separate request. Do not change `createRenderer()` for this.
- Give the loop one owner. Drive animated effects from your own `uniform()` clock, not TSL `time`, so the agent can stage and repeat a chosen moment (cookbook "Renderer and loop"). Advance it by a clamped frame delta: create `const timer = new THREE.Timer()` once and call `timer.connect(document)`, then in the loop call `timer.update()` and add `Math.min(timer.getDelta(), 0.25)` to the clock. It then stops while the tab is hidden and moves at most a quarter second after a capture's `cleanup()`. A demo has no fixed step, so it does not need the loop skeleton in `gameplay-systems.md`. In a prototype, anything a route checks or a capture must show, such as spins, blinks, shake or effects tied to play, comes from simulation time in `present()`; only purely decorative effects may use the frame clock, because `__qa` steps the simulation, not frames.
- Warm pipelines with the cookbook's "Warming pipelines before play", behind a short loading state, when the scene has heavy materials, post-processing or compute. These lanes do not ask for proof that it worked.
- Name the source and licence of every asset you did not make, and load models through the cookbook's "Loading models" setup.
- A demo or prototype may be silent when the request does not mention sound: label that as a default and mark audio `not-applicable`.

A prototype also needs:

- its one loop playable from start to end or failure before any polish;
- a fixed-step simulation with seeded random numbers, split into `simulate`, `present`, `draw` and `getState` as `SKILL.md` "Give the agent a way to play" describes, following `gameplay-systems.md` "Session state and clocks" (its 30, 60 and 120 Hz test is production-only);
- the `__qa` hook from `assets/qa-harness.template.js`, installed in development only, with `webgpu-readback.js` and `contact-sheet.js` copied from the `webgpu-visual-verification` skill. That skill's `references/scripted-playthrough.md`, "Add the hook to a game that has none", gives the steps. In an existing prototype, before the first capture of any task, check that `__qa.info()` reports `version` 2 and a `webgpu` field and that `webgpu-readback.js` and `contact-sheet.js` are present. Outside a review, replace an outdated harness file from the current template (keeping the game's adapter) and copy only what is missing; a review changes nothing and reports the outdated or missing files and the checks they stop.

In both lanes, before the first capture, read the `webgpu-visual-verification` skill's `SKILL.md` and "Required access and preparation" in its `references/native-webgpu-readback.md`, plus its "Checking a newer Three.js release" when the installed release is newer than the one the readback template was checked with. You copy its ready-made `webgpu-readback.js` rather than implement the workaround, so the rest of that file is for a capture that fails, as is `references/evidence-and-troubleshooting.md`. A prototype also reads all of `references/scripted-playthrough.md` before writing routes. Save each capture's `metadata` next to its image; with the evidence table, that replaces the capture records that skill suggests.

## Give the agent a way to look (demo)

A demo has no rules to step, so it does not use `__qa`, whose harness needs actions and scenarios. Instead it exposes, in development only, what the readback helper needs and one named view per "done when" line:

```js
if (import.meta.env.DEV) {
  Object.assign(window, { __demo: {
    THREE, renderer,
    renderFinalFrame: () => pipeline.render(), // only draws, as the loop does (no compute, no clock); or renderer.render(scene, camera)
    views: {                                    // apply a view; never render
      opening: () => setView({ time: 0, eye: [0, 2, 8], target: [0, 1, 0] }),
      peak: () => setView({ time: 4.5, eye: [3, 1.5, 4], target: [0, 1, 0] }),
    },
    checkView: () => ({ valid: viewMatches(), time: demoTime.value,
      eye: camera.position.toArray() }),
  } });
}
```

`setView` and `viewMatches` belong to the demo. `setView` records the view it was given and sets the demo clock, camera, every animated object and any DOM text to that view's values, as the loop would, without rendering. `viewMatches` returns `true` only when the camera and clock hold the recorded values. Put the block after the loop has started. Without a bundler, `import.meta.env` does not exist, so leave the block out of the main module: let that module await `createRenderer()` and warm-up at top level, start the loop, and export `THREE`, `renderer`, `pipeline` (or `scene` when there is no pipeline), `camera`, the clock uniform, `setView` and `viewMatches`. A development-only `qa.html`, never deployed, imports them and sets the same `window.__demo`.

An effect whose state builds up frame by frame, such as compute particles or sliding drops, is not set by the clock alone. `setView` then re-runs its init dispatch and steps it with a fixed delta up to the view's time; compute dispatches are allowed there, renders are not. If that is too costly, the report says the view is not repeatable. `renderFinalFrame` only draws; it never dispatches compute or advances a clock.

Copy `webgpu-readback.js` from the `webgpu-visual-verification` skill's `assets` into the development-only folder. Demo code never imports it; the agent loads it from the page by the path the development server serves it at:

```js
const { stageNativeWebGPUFrame } = await import('/src/qa/webgpu-readback.js');
const d = window.__demo;
const shot = await stageNativeWebGPUFrame({
  THREE: d.THREE, renderer: d.renderer, renderFinalFrame: d.renderFinalFrame,
  synchroniseFrame: d.views.peak, checkPose: d.checkView,
});
// screenshot and inspect now, then:
shot.cleanup();
```

Add that skill's `contact-sheet.js` too when a demo has more than three views.

For the "Capture matches the screen" row, draw the same view on the canvas and take a direct screenshot. The screenshot happens between two separate steps, so the paused loop is kept on `window` where both can reach it, and any error resumes it at once:

```js
// Step 1: pause the loop and draw the view.
const d = window.__demo;
window.__demoLoop ??= d.renderer.getAnimationLoop();   // keep the first saved loop if step 1 runs twice
await d.renderer.setAnimationLoop(null);              // pause the loop
try {
  d.views.peak();                                      // apply the view; never render here
  if (!d.checkView().valid) throw new Error('view not applied');
  await new Promise((resolve, reject) => requestAnimationFrame(() => {   // draw in a fresh frame
    try { d.renderFinalFrame(); resolve(); } catch (error) { reject(error); }
  }));
  await new Promise(requestAnimationFrame);            // let the browser present it
  await new Promise(requestAnimationFrame);
} catch (error) {
  await d.renderer.setAnimationLoop(window.__demoLoop);   // never leave the demo paused
  window.__demoLoop = undefined;
  throw error;
}
```

Take the direct screenshot, then always run step 2, even if the screenshot failed:

```js
// Step 2: resume the loop.
await window.__demo.renderer.setAnimationLoop(window.__demoLoop);
window.__demoLoop = undefined;
```

## Evidence the demo lane must deliver

| Check | Pass means | Evidence |
| --- | --- | --- |
| Three.js version | One `three` version in the project; for a new project or a major rebuild, the latest stable on the day, with where it was checked; otherwise the installed release and whether a newer one exists | command output |
| API check | `check-three-api.mjs` lists nothing, or each hit is explained | command output |
| No legacy path | The legacy grep below prints nothing, or only comments. Each use in code is a `fail`; a Repair records it and leaves it in place unless it causes the defect or the user asks | command output |
| Build | The build command succeeds and the grep below prints nothing. A page with no build step is `not-applicable`; say how the development-only files stay out of what is deployed | command output |
| WebGPU backend | `renderer.backend.isWebGPUBackend === true` after `init()`, with the revision and the adapter where exposed | the development log line |
| Failure message | `createRenderer()`'s error appears as a readable message in the canvas's place | file and line; reading the code is enough for this row only |
| Console | After load and after the captures: no uncaught error, rejected promise, device loss, GPU validation error, `running under WebGL2 backend` warning, or deprecated, renamed or removed warning | console |
| Each "done when" line | An inspected staged readback of its view shows it (a staged readback, not a direct screenshot, because it stages the exact view and can be repeated). When the demo has DOM text or controls, take a screenshot before `cleanup()` and check the overlay matches the view | staged native WebGPU readback, with file names |
| Capture matches the screen | When direct screenshots work, one view captured both ways looks the same, checked in each prompt that reports captures (these lanes keep no record of earlier runs; a Repair may list it as not replayed) (demo: the direct steps under "Give the agent a way to look"; prototype: "Check one capture against the screen" in `scripted-playthrough.md`) | direct capture and staged readback; `blocked`, "direct screenshots unavailable", when the agent has no direct screenshot |
| Smoothness and frame rate; interaction feel when there are controls; audio when there is sound | The user's answer | `needs-user` card |

The build check, run on the deployed folder (`__demo` is safe to search for because demo code never reads it):

```bash
grep -rlE 'QA harness|staged-native-webgpu-final-pipeline-readback|contact-sheet-of-staged-readback-captures|__demo' dist
```

The legacy check, run on the project's own source and HTML (add `--exclude-dir=<folder>` for any folder holding a copied Three.js build, which is library code):

```bash
grep -rnE 'WebGLRenderer|forceWebGL|EffectComposer|ShaderMaterial|onBeforeCompile' . --include='*.[jt]s' --include='*.[jt]sx' --include='*.mjs' --include='*.html' --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=dist-qa
```

When the agent's browser has no WebGPU adapter, the backend, console and capture rows are `blocked`, not `needs-user`; in a prototype so are the hook, main route, failure route, repeat run, HUD and live-loop rows, because the game cannot start and `__qa` installs only after its loop does. Add "it renders as described" steps to the card and ask the user to paste the development log line. A user report can confirm the rendering they observed, and the development log can confirm the backend. Scripted route, repeatability and harness checks remain `blocked` until their required evidence is supplied.

## Evidence the prototype lane must deliver

The demo rows, with two differences: the scripted route's captures prove the "done when" lines, and `__qa` replaces `window.__demo` (use `__qa.drawLive()` for the screen comparison). The build grep drops `|__demo`. Add:

| Check | Pass means | Evidence |
| --- | --- | --- |
| Hook is development-only | `__qa.info().webgpu === true` on the development server, and the build grep prints nothing | page value, command output |
| Main route | Four to eight segments from gaining control, through the core action and one progress step, to the win, or for a game with no win (such as an endless runner) to a milestone, with an expectation for each "done when" line except those about losing or restarting; every expectation passes. "Done when" lines about losing or restarting are proved on the failure route | contact sheet, with scenario, seed and "N of N expectations passed" |
| Failure route | A route that should fail, on its own sheet, whose expectation asserts the failure, followed by a restart | contact sheet; `not-applicable`, with the reason, when nothing can be lost, and the report then calls it a prototype, not a game (`SKILL.md`, last paragraph) |
| Repeat run | The main route again from the same scenario and seed gives identical states and frame fingerprints | comparison result |
| HUD | One capture kept on screen with `keep: true` and screenshotted with the real DOM HUD, whose values match the state; then `release()` | direct screenshot |
| Live loop | `__qa.resume()` returns `resumedLiveLoop: true` and the game runs | page value |
| Controls feel, difficulty, input latency; pointer lock and mouse-look when used; gamepad or touch when supported; audio when present; frame rate | The user's answer | `needs-user` card |

Write the route from the "done when" lines (this lane has no `docs/QA-ROUTE.md`, so ignore that file where `scripted-playthrough.md` mentions it) and keep it in a development-only file such as `src/qa/routes.js`, so it can run again after every fix.

## Repairs in these lanes

Inspect the project first (`SKILL.md`, "Classify the request before acting"), since the lane depends on what it has. The first message names the lane and restates the defect as "done when" lines; give defaults only when the fix needs a choice. In a prototype, check that `__qa.info()` reports `version` 2 and a `webgpu` field (otherwise replace the harness file from the current template, keeping the game's adapter) and that `webgpu-readback.js` and `contact-sheet.js` are present; copy only what is missing. Replay the rows the defect touches plus, in a prototype, the main and failure routes; list the other rows as `not-run` with "not replayed for this repair". For a collision, trigger or checkpoint defect, add the moves that reproduce it, such as edge hugging, seams or backtracking, to the route. A legacy rendering branch goes on the "No legacy path" row.

## Not checked in these lanes

Name these in the report's "Not checked" line: production documents; a frame-rate target on a named device; the options baseline; adversarial routes; lifecycle cycles (repeated restart, leave and re-enter, resize and DPR); performance at the busiest moment; proof that warm-up removed first-use stutter; the deployed build. When a demo or prototype is deployed, open the deployed URL, confirm it renders with a clean console, and put "play it on the deployed URL" on the card.

## Moving up

- **Demo to prototype:** as soon as the work adds a goal, score, failure or rules. Add the fixed-step split and `__qa`, and switch to the prototype evidence.
- **Prototype to production:** when the user asks for it in their own words ("production", "make it release-ready", "polish it to AAA"), that request is the switch: do not ask again, and start with step 1. When production is only your inference, because the scope needs asset pipelines at scale, several levels, an options menu, a promised frame rate on a named device, or multiplayer, send one message that proposes production and lists what it adds, make only read-only checks, and wait for the answer; in an explicitly autonomous task, stay in the prototype lane and put the proposal in the report. Once switching:
  1. Tell the user the switch is made and what it adds: the four `docs/` documents, the production folder ownership (`app`, `game`, `render`, `world`, `assets`, `audio`, `ui`, development-only `qa`), the options baseline, a frame target on a named device, and the full gate sequence. A JavaScript prototype stays JavaScript unless the user asks for TypeScript. The same message holds what `studio-workflow.md` section 3 puts in the first production message: the pass plan, the content-blocker promise and, when its choices are clear, the pre-production checkpoint.
  2. Treat it as a major rebuild: re-check the latest stable Three.js (upgrading is right here, unlike a Repair) and run `check-three-api.mjs` before and after.
  3. Check the existing `__qa` hook as "Repairs in these lanes" describes (version 2, a `webgpu` field, both helper files), run the scaffold script and fill `docs/GAME-BRIEF.md` from the existing build and the user's goals. The existing build is the starting greybox (`studio-workflow.md`, Pass A); run the section 4 risk proofs for any risk it has not already answered.
  4. Start every gate in `docs/ACCEPTANCE.md` at `not-run`. Earlier captures and user reports are history; a production pass needs fresh evidence from the new build.
  5. Write the scripted route in `docs/QA-ROUTE.md` from the existing route script, and put the "done when" lines into the definition of done. From then on the document is the source and `src/qa/routes.js` follows it.
