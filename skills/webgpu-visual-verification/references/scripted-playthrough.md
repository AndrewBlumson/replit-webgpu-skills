# Scripted playthroughs

## What this adds

Readback lets an agent see a frame. A scripted playthrough lets it play the
game: reset to a known start, drive the fixed-step simulation with scripted
inputs, check the game state after each step, and capture the moments that
matter. The captures are combined into one labelled contact sheet, so a single
screenshot reports a whole run.

It needs a development-only test hook in the game, `window.__qa`. The
`aaa-threejs-game-studio` skill ships the hook as
`assets/qa-harness.template.js` and explains how to install it only in
development or QA builds; this skill ships its two helpers:

- `assets/webgpu-readback.js`: the readback template from
  [Native WebGPU readback](native-webgpu-readback.md) as a module. Keep the two
  identical.
- `assets/contact-sheet.js`: collects labelled thumbnails of captures and shows
  them as one image.

If the AAA skill is not installed, the harness template is also in the public
repository <https://github.com/AndrewBlumson/replit-webgpu-skills>, at
`skills/aaa-threejs-game-studio/assets/qa-harness.template.js`. Do not
drive a game by simulated key presses and wall-clock waits instead: those runs
do not repeat.

## Add the hook to a game that has none

Most first versions read keys, clock time and `Math.random()` inside one
render-loop function. Split that function before installing the hook:

1. Move every rule into `simulate(dt, input)`: movement, spawning, collisions,
   scoring, win and failure. It changes plain simulation data only; spawning
   adds records, not meshes.
2. Replace `Math.random()` in rules with a seeded generator owned by the game,
   and re-seed it in each scenario.
3. Turn keys into semantic actions sampled once per frame that runs a tick,
   so presses wait for a tick. Keep the previous
   tick's input in the simulation state so a press (jump, lane change, start,
   restart) counts once, and never change the `input` object inside
   `simulate()`: the hook passes a deeply frozen copy and stops with an error
   if the game tries to change it.
4. Drive `simulate()` from a fixed-step accumulator in the live loop and clamp
   the frame delta; use `THREE.Timer`, not the deprecated `THREE.Clock`.
5. Move all scene, camera and DOM updates into `present(alpha)`, including win,
   failure and title overlays, computed from the state: pooled meshes placed
   from records, and spins, blinks and shake from simulation time.
6. Make start and restart semantic actions too, so a route can check the title
   screen and restarting after failure.
7. Add `getState()` with what the route checks and steers by, as plain data,
   and scenarios that reset everything above.

The AAA skill's `references/gameplay-systems.md` shows the loop and the seeded
generator.

## The hook

| Call | What it does |
| --- | --- |
| `__qa.info()` | Version, fixed step, known actions and scenarios, current scenario and tick, whether QA has control, whether there is a live loop to resume, Three.js revision, WebGPU backend, whether capture is available. |
| `await __qa.scenario(id, { seed })` | Takes control from the live loop and resets to a named start. Returns `{ tick, state }`. Await it: a scenario may load assets. |
| `__qa.step(ticks, input)` | Advances that many fixed ticks with `input`: an object of action: value held for every tick, or a function `(index, tick) => input`, where `index` counts from 0 within this call and `tick` is the QA tick. Then updates render transforms and the HUD. Returns `{ tick, state }`. |
| `__qa.getState()` | The current `{ tick, state }`. |
| `__qa.startSheet(title)` | Starts a new contact sheet; later captures are added to it until the next `startSheet()`. |
| `await __qa.capture(label, options)` | Captures the current state with GPU readback and adds it to the sheet. `keep: true` leaves it on screen, with the real DOM HUD, until the next `scenario()`, `step()`, `capture()`, `run()`, `drawLive()`, `showSheet()` or `resume()`, or `__qa.release()`, and keeps it off the sheet unless `addToSheet: true`. `status` (`info`, `pass` or `fail`) and `note` label the sheet tile; other options, such as `includeOverlays` and `settleFrames`, go to the readback helper. Returns `{ label, tick, state, metadata }`; `metadata.frameHash` fingerprints the pixels. |
| `await __qa.drawLive()` | Draws the current QA state on the live canvas in a fresh animation frame, with QA still in control, for comparing with a capture. |
| `await __qa.run(script, { stopOnFailure })` | Runs a route: an array of `{ label, ticks, input, capture, expect }` segments. A segment without `ticks` does not advance. `capture` is `true` or an options object for `capture()`. A failed expectation does not stop the run unless `stopOnFailure` is true. Returns `{ scenario, passed, failures, results }`. |
| `__qa.showSheet({ page, perPage })` / `__qa.hideSheet()` | Shows the contact sheet over the page for a screenshot (6 tiles a page by default), then removes it. |
| `__qa.resume()` | Hands control back to the live loop from the current state and returns `info()` plus `resumedLiveLoop`, which is false when the game had no loop running when QA took control. Call `scenario()` again before more QA steps. |
| `__qa.dispose()` | Resumes and removes `window.__qa`, for a game that is torn down and installs the hook again. |

The hook stops with a clear error, naming the value involved, when something
would make a run untrustworthy: a NaN or infinite number in the state (usually
a simulation bug), Three.js objects, maps, sets or typed arrays in the state,
the state changing between QA calls (something other than QA is simulating),
`present()` changing the state, `simulate()` changing its input, a call made
while a `scenario()` or `capture()` is still running, an unknown action, or
input that is not an object. Await every `scenario()`, `capture()`, `run()` and
`drawLive()`.

Each capture checks that the tick has not changed. Give the game a
`checkPresentation()` as well when a capture must prove where objects or the
camera are drawn (grounding, framing, floating objects); without it,
`metadata.pose` holds only the tick, which is weaker than the state evidence in
the skill's section 5.

Stepping never waits for animation frames, so it works in a hidden or
throttled page, and the same scenario, seed and inputs always give the same
states. Captures still need animation frames, because they render through the
game's real pipeline; see [Native WebGPU readback](native-webgpu-readback.md).

## Check one capture against the screen

When a direct browser screenshot of the game works, check the capture route
once per game: stage a state, take `await __qa.capture(label, { keep: true })`,
screenshot it and call `__qa.release()`. Then call `await __qa.drawLive()`,
wait two animation frames and screenshot the canvas. The two should match. Do
not use `__qa.resume()` for this: the live loop advances the simulation on its
first frame. If they do not, trust the direct screenshot and see the known
limits in [Native WebGPU readback](native-webgpu-readback.md).

## Write the route from the game's QA route

Turn each beat of `docs/QA-ROUTE.md` into segments with an observable
expectation. Base tick counts on the game's fixed step (at 1/60 s, 60 ticks is
one second), and read positions from `__qa.getState()` rather than guessing.
For generated or seeded levels, steer with an input function that reads the
state, for example `(index) => ({ jump: __qa.getState().state.nextHazard < 2 })`.

```javascript
await __qa.scenario('level1-start', { seed: 1 });
__qa.startSheet('Level 1: main route (scenario level1-start, seed 1)');
const run = await __qa.run([
  { label: 'Start', ticks: 0, capture: true },
  { label: 'Up to speed', ticks: 60, input: { forward: true }, capture: true,
    expect: (s) => s.speed > 8.9 || 'did not reach top speed' },
  { label: 'Approach the gap', ticks: 75, input: { forward: true } },
  { label: 'Jump', ticks: 1, input: { forward: true, jump: true } },
  { label: 'Mid-air over the gap', ticks: 20, input: { forward: true },
    capture: true, expect: (s) => !s.grounded || 'not airborne' },
  { label: 'Lands past the gap', ticks: 30, input: { forward: true },
    capture: true, expect: (s) => (s.grounded && !s.failed) || 'did not land' },
  { label: 'Reaches the finish', ticks: 230, input: { forward: true },
    capture: true, expect: (s) => s.finished || 'finish not reached' },
]);
__qa.showSheet();   // take the screenshot now, then __qa.hideSheet()
```

`expect` returns `true`, or a short sentence saying what went wrong; that
sentence becomes the first caption line of a failed tile. When a sheet was
started, a failed expectation is captured onto it even without `capture`. An
error stops the run and is recorded with the results so far. Keep each expectation about something
a player would notice: position, grounded, health, checkpoint, lap, objective,
failure or completion.

Also write the routes that should fail: skip the jump, walk into the hazard,
run out of time. Put them on their own sheet, titled as failure routes, and
make their expectations assert the correct failure, for example
`(s) => s.failed || 'the game let the player through the gap'`. A green tile
then means the game enforced the rule; a red one means it did not. Then run
the adversarial moves from the QA route, such as backtracking, hugging edges
and retrying after failure.

## Report the run

1. Take the screenshot while the contact sheet is shown, then call
   `__qa.hideSheet()`. A long run spans several pages; show each with
   `__qa.showSheet({ page })`.
2. Sheet tiles hold the rendered scene only. Put anything the player learns
   from the DOM (HUD values, win, failure or title text) into the captions
   through the game's `describe(state)`. For HUD, menu or subtitle checks,
   capture that moment with `keep: true`, take a screenshot (it includes the
   real DOM overlays), then call `__qa.release()`. A flash or blink can hide
   the subject on the captured tick; capture a tick either side if it matters.
3. Run the same route twice from the same scenario and seed. Compare the full
   states, including the seeded world, not only pass or fail, and compare each
   capture's `metadata.frameHash`. Different states mean hidden
   nondeterminism: wall-clock time, unseeded random numbers, input read from
   devices, or a scenario that does not reset everything. Equal states with
   different fingerprints mean presentation state that a scenario does not
   reset, or animation driven by wall-clock time (temporal effects such as TRAA
   also change fingerprints). Fix these before trusting the results.
4. Call `__qa.resume()` when finished and check that the live game runs again.
   Its `resumedLiveLoop` is false when the game had no animation loop running
   when QA took control, so there was nothing to hand back.
5. Report in plain terms: the build, route, scenario and seed, each
   expectation that passed or failed with its tick, the contact sheets, and what
   the run does not establish.

## What a scripted run proves, and what it does not

It shows that the simulation does what the route says: controls move the
player, jumps clear gaps, collisions hold, triggers fire once and in order,
checkpoints, failure, restart and completion work, and the captures show the
expected moments. The same run repeats exactly, so a fix can be checked by
running it again.

It does not show how the game feels to play. These need a person at the
controls or the target device, and stay untested (`not-run` in the acceptance
ledger) until checked: feel and difficulty, input latency, bindings, pointer
lock and mouse-look, gamepad or touch, audio, and frame rate and pacing on the
target device. Scripted input bypasses the browser input layer and the game's
input controller, so check those separately.
