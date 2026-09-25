# Verification and rendered acceptance

Use this sequence in the production lane for builds, major changes, defect fixes and reviews; demo and prototype projects use `demo-prototype-lanes.md` instead. Scale the breadth to the change (a review runs every gate the existing build can reach, Gate 7 only when a deployment exists (otherwise its rows are `not-run`, "no deployment"), and notes where its statuses differ from `docs/ACCEPTANCE.md`), but never replace live rendered evidence with build output, source inspection, a screenshot, a particle count, or another agent’s report.

## Evidence contract

Before testing, record:

- absolute project path, branch/commit or working-tree identifier, and active writer;
- exact build command and served artefact;
- acceptance URL, route, query flags, seed/scenario, and save-state precondition;
- Three.js and critical dependency versions;
- the official-source check showing whether those resolved versions were latest stable when the project, major rebuild or Build/change began (a Repair or review records the installed version and does not upgrade because of this check);
- browser version, OS, GPU, viewport, DPR, target input device, and audio output;
- whether the run is cold, warm-cache, development, or production;
- the acceptance requirement each capture or metric proves.

Keep deterministic QA controls behind an explicit development boundary. They may select a seed, scenario, checkpoint, enemy state, weather intensity, or overlay, but must not alter production behaviour in an accepted build. The `__qa` hook itself must be absent from the production bundle (Gate 1); a query flag may choose its scenario only in a development or QA build.

When the agent's browser has no WebGPU adapter, every gate that needs one is `blocked` (`SKILL.md`, "Report evidence honestly"). Add "it renders as described" steps to a card; the user's report then settles only what a person can see, labelled as a user report. Gates whose evidence the agent must collect (the backend check, inspected captures and their records, `renderer.info` counts, lifecycle checks) stay `blocked`.

## Gate 1 — static and build integrity

Run the repository’s existing formatter, typecheck, unit/system tests, and production build. Inspect rather than guess:

- package lock and exact `three` version;
- latest-stable Three.js verification for a new project, a major rebuild or a Build/change of an existing project; a Repair or review records the installed release, and a Repair upgrades only when that release causes the defect or the user asks;
- imports from `three/webgpu` and `three/tsl`;
- no `WebGLRenderer`, legacy `EffectComposer`, `ShaderMaterial`, `RawShaderMaterial`, `onBeforeCompile`, or other old rendering path in the product; in a build or major rebuild, migrate or remove one found in existing work rather than preserving it as a compatibility branch; a Repair records it as a `fail` with a defect and removes it only when it causes the defect or the user asks;
- asset URLs and case sensitivity;
- licences/provenance for every shipped third-party asset, font, library, and sound;
- production bundle does not expose debug cheats, source-only credentials, or intrusive telemetry;
- production bundle contains none of the `__qa` hook's files: `grep -rlE 'QA harness|staged-native-webgpu-final-pipeline-readback|contact-sheet-of-staged-readback-captures' dist` (or whichever folder is deployed) prints nothing (leave `__qa` itself out of the pattern, because game code may check `window.__qa`).

A successful gate allows browser testing; it is not completion.

## Gate 2 — cold-start runtime contract

Open the exact URL in a visible target browser with a clean navigation. Verify:

- loading/progress state appears and remains honest;
- unsupported WebGPU produces a clear product-level failure state;
- after `await renderer.init()`, the active backend is WebGPU and no silent WebGL2 fallback is accepted;
- the device is latest-generation Apple Silicon or an equivalently capable current high-end PC; unsupported and legacy hardware reaches the designed capability-failure state rather than a compatibility renderer;
- initial resize/DPR/canvas dimensions are correct;
- audio unlock and pointer-lock requests occur only after a valid user gesture;
- first controllable frame has no uncaught exception, relevant warning, missing asset, shader error, or rejected promise;
- the player, camera, objective, collision world, and required assets are ready before control is granted.

Capture console evidence and the opening frame after control is genuinely available.

## Gate 3 — complete playable route

Follow `docs/QA-ROUTE.md` with player-like input. Do not teleport past untested beats unless a separate deterministic scenario exists for focused repetition.

An agent drives the route through the development-only `window.__qa` hook (see "Give the agent a way to play" in `SKILL.md`), following the `webgpu-visual-verification` skill's `references/scripted-playthrough.md`: reset a named scenario and seed, step the fixed simulation with scripted inputs, give each segment an expectation, capture the key beats onto a contact sheet, run the routes that should fail, and repeat the route to confirm identical states and frame fingerprints. Record the scenario, seed, script, build and each expectation's result in the QA route. Scripted input follows the route like a player but bypasses bindings, the input controller and pointer lock. A scripted pass, headless or not, covers what the simulation does and what the inspected captures show; checks of feel and difficulty, input latency, bindings, pointer lock and mouse-look, gamepad or touch, audio, and frame rate and pacing on the target device stay `not-run` until their check card is handed to the user and, outside a review, kept in the "Needs-user checks" section of `docs/QA-ROUTE.md`, then `needs-user` until a person or the target device reports a result.

Verify:

- movement, look, jump/crouch/sprint or genre-equivalent verbs;
- controller behaviour on slopes, steps, doorways, corners, moving geometry, ceilings, ledges, spawn points, and out-of-bounds edges;
- camera collision, FOV/state transitions, weapon or avatar presentation;
- interaction/combat cadence, hit authority, feedback, resources, cooldowns, and repeated use;
- AI perception, navigation, attack choice, reaction, interruption, death/resolve, and loss/reacquisition;
- encounter and objective triggers cannot be skipped, double-fired, soft-locked, or completed in the wrong order;
- checkpoint, failure, restart, pause, settings, and final completion state;
- bindings, sensitivity/dead-zone/inversion, FOV/camera, subtitles, volume buses, and reduced shake/flash or motion controls required by the brief;
- the route ends visibly and audibly rather than returning to an unexplained still scene.

Replay once using an adversarial route: hug boundaries, backtrack, trigger events out of the intended timing, exhaust resources, pause during action, and retry after failure.

## Gate 4 — presentation inspection

Inspect the Textured/Surface/Base/Normal/ORM/Emissive/Wire or equivalent diagnostic views when material defects are suspected. Then judge the composite from gameplay camera and representative display conditions.

Capture at least:

- opening composition and objective readability;
- hero environment/material at close and gameplay distance;
- core interaction or combat under pressure;
- animation transition and impact reaction;
- weather/environmental interaction with surfaces and occlusion;
- peak set piece and its aftermath;
- failure/restart and completion state;
- HUD/settings at wide and narrow supported aspect ratios.

Check causal coherence: impacts originate at contacts, rain respects shelter when specified, smoke has source and wind behaviour, lights belong to fixtures/events, reflections match the local state, and audio emitters occupy plausible space.

When matching a capability reference, compare the same observable axes—camera context, screen coverage, depth, motion, surface response, interaction, and exposure. Do not compare only a source-code technique or object count.

Label each image as the `webgpu-visual-verification` skill does, and keep one capture record per image, using "Suggested capture record" in that skill's `references/evidence-and-troubleshooting.md`, next to the images in `qa-evidence/`.

## Gate 5 — performance at the worst beat

Choose a frame-rate contract before measuring: 60 fps provides 16.67 ms total frame time; 30 fps provides 33.33 ms. Define target hardware and an allowed percentile/stability policy. Separate:

- CPU frame/main-thread time;
- GPU render/compute timestamp when the optional feature is available;
- frame pacing and long-frame/hitch count;
- draw calls, visible triangles/points/lines, render/compute calls;
- tracked GPU resource sizes and counts;
- initial and streamed transfer sizes;
- time to first frame and time to controllable;
- shader/pipeline first-use stalls.

Measure a sustained worst-case route segment, not a quiet opening view. Use `renderer.info` as a diagnosis aid, browser tooling for main-thread/network/memory evidence, and backend timestamp data when supported. No single overlay number proves performance or quality.

The workload gates (draws, triangles, memory, transfer) describe the build and may pass on the agent's own adapter, as may Gate 6's warm-up checks when that adapter is a hardware GPU; frame time, pacing and time to controllable pass only on the named device. Unless the agent runs on that device, frame time is a `needs-user` check whose card asks for numbers, not smoothness: "Frame time: on <named device>, open <URL> in a fresh window and note the seconds until you have control. During <worst beat>, record a 20-second Chrome DevTools Performance trace and attach the file, or read the <brief's percentile, such as p95> frame time and the number of frames over <16.7 or 33.3> ms for those 20 seconds from the build's frame-time readout. Give your display's refresh rate, and say whether play stuttered in the first seconds after the loading screen." Offer the readout only when it reports those two numbers over a 20-second window (an FPS counter does not); when the release build has none, add one to a QA build of the same commit. Ask for the trace when the numbers miss the target. A reply without a trace or those numbers settles smoothness only, and the frame-time gate stays `needs-user`. For a racing game, the card adds the display-rate laps in `gameplay-systems.md`, "Racing and antigravity handling contract".

If over budget, diagnose before reducing fidelity:

- CPU: scripting, physics, AI, animation, scene traversal, allocations, draw submission;
- GPU geometry: vertex/fragment cost, shadows, skinning, overdraw, culling, resolution;
- GPU bandwidth: texture/target formats, MRT count, post passes, transparent layers;
- hitching: asset decode/upload, shader/pipeline creation, synchronous work, garbage collection;
- transfer/startup: unpartitioned assets, texture formats, preload policy, cache headers.

Record the change, quality cost, and before/after route measurement.

## Gate 6 — warm-up and lifecycle

Exercise every representative material, light/shadow variant, skinned/morphed character, particle/compute pipeline, and post path before the first latency-sensitive use. `compileAsync()` skips objects outside the camera view, shadow maps and post-processing, so warm up as `webgpu-cookbook.md` shows: from a view that sees the whole level, `compileAsync()` on every pass and `compileComputeAsync()` on compute kernels, real frames, then `await renderer.backend.device.queue.onSubmittedWorkDone()`. Prove the actual encounter is hitch-free: `renderer.info.memory.programs` must not rise during it (a flat count does not rule out new pipeline variants), and its first frames must not spike.

Then run at least two cycles of:

1. enter or start;
2. exercise combat/effects/audio;
3. pause and blur/focus;
4. resize or change DPR where supported;
5. fail/restart or leave/re-enter;
6. complete and return/reset.

Check that cycles do not duplicate animation loops, DOM/event listeners, physics bodies, AI entities, mixers, audio nodes, GPU buffers/textures, render targets, compute nodes, or post pipelines. Verify explicit disposal and cancelled async work cannot mutate a dead session.

## Gate 7 — release route

Test the built deployment, not only the development server. Verify deep links/base paths, caching, compressed content types, cross-origin assets, service worker if present, and a fresh browser load. Re-run the complete route on the deployment URL and compare the build identifier with the accepted local artefact.

The production bundle has no `__qa` hook, so a person plays the deployment route by hand from a `needs-user` check card. That card asks for the user's computer, GPU, browser, display refresh rate, window size, pixel ratio, input device and audio output, and its steps include a cold load of the deployment URL in a fresh window with the console open (an honest loading bar, the seconds until you have control, no "WebGPU required" screen, no red errors), the complete route, a tab switch of about ten seconds (the game pauses and resumes without a jump) and, when the user has a display with a different pixel ratio, moving the window to it. The agent still runs Gate 6 itself. A scripted route on a QA build of the same commit (for example `vite build --mode qa --outDir dist-qa`) supports it and is labelled as a QA build. Record which build each result came from.

## Defect and acceptance language

Write defects as observable mismatches:

> At [route/state/view], after [action], [observable result] occurs; expected [contract]. Reproduced [rate] on [build/device]. Evidence: [capture/trace].

Use severity based on player impact:

- **Blocker:** cannot load, control, progress, recover, or maintain the renderer contract.
- **High:** core mechanic, collision, encounter, audiovisual causality, or target-frame contract fails.
- **Medium:** visible quality/readability/lifecycle defect with a reliable route.
- **Low:** contained polish issue without route or state risk.

Accept only current passes in `docs/ACCEPTANCE.md`. Mark untested claims `not-run`, uncertain or environment-stopped results `blocked`, person or target-device checks handed to the user on a card `needs-user`, and known failures `fail`. Never convert missing evidence, or a `needs-user` check, into a pass. The release decision stays "not accepted" while any gate that is not `not-applicable` is anything other than `pass`. If the user decides to release anyway, record "released by user decision; unverified: <gates>" under Accepted limitations; those gates keep their status and never count as passes.

Documents scaffolded from older templates may lack the `needs-user` status and the "Needs-user checks" section of `docs/QA-ROUTE.md`. Add them from the current templates by editing `docs/ACCEPTANCE.md`, `docs/ASSET-PIPELINE.md` and `docs/QA-ROUTE.md`, never with `--force` and never in a review.
