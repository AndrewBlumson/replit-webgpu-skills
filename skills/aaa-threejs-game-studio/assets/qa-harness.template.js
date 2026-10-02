// Development-only QA harness template: lets an agent reset, drive and inspect
// the game without a person at the controls, through `window.__qa`.
//
// Copy into the game's development-only QA folder (for example src/qa/harness.js)
// and install it only in development or QA builds, so production never loads it.
// With Vite, a dynamic import behind a build-time flag keeps it out of the
// production bundle. Install it after the game has started its loop with
// renderer.setAnimationLoop(), and avoid top-level await, which the default
// build target of older Vite versions rejects:
//
//   if (import.meta.env.DEV || import.meta.env.VITE_QA === '1') {
//     Promise.all([import('./qa/harness.js'), import('./qa/webgpu-readback.js'),
//       import('./qa/contact-sheet.js')])
//       .then(([{ installQaHarness }, { stageNativeWebGPUFrame }, { createContactSheet }]) =>
//         installQaHarness({ ...game adapter..., capture: stageNativeWebGPUFrame,
//           createContactSheet }));
//   }
//
// Set VITE_QA only for a separate QA build written to its own folder (for
// example `vite build --mode qa --outDir dist-qa` with VITE_QA=1 in .env.qa),
// never as a workspace secret or environment variable that the release build
// also reads, and never gate the hook on a URL parameter or other runtime
// setting in a deployed page. Without a bundler, install it from a separate
// development-only page (for example qa.html) that is not deployed. In a
// TypeScript project, set "allowJs": true in the tsconfig that includes the
// game's source (tsconfig.app.json in Vite's default layout).
//
// webgpu-readback.js and contact-sheet.js come from the webgpu-visual-verification
// skill's assets. Without them, drop those two imports: the harness still resets,
// steps and reports state; only capture() and the contact sheet need them.
//
// The adapter functions are the game's own code, not copies:
//   renderer   the WebGPURenderer; its setAnimationLoop() callback is the live loop
//   THREE      the game's own three/webgpu module (needed for capture)
//   fixedStep  seconds per simulation tick, for example 1 / 60
//   actions    the semantic input actions the game understands
//   scenarios  { id: (seed) => void or Promise } each resets world, simulation,
//              clocks, seeded random numbers, input, pooled effects and HUD to a
//              known start, already in the playing state (no pointer-lock or
//              audio-unlock gesture needed)
//   simulate(dt, input)  advances the authoritative simulation one tick,
//              reading only `input` (an object of action: value), never devices,
//              wall-clock time or unseeded random numbers, and never changing
//              `input`; keep the previous tick's input in simulation state to
//              detect presses
//   present(alpha)  updates render transforms, animation, camera and DOM HUD
//              from simulation state without rendering; alpha is the
//              interpolation factor, and QA always passes 1 (the current state).
//              It must depend only on simulation state and alpha.
//   draw()     draws one final frame exactly as the live loop draws it
//   getState() returns a JSON-serialisable snapshot for assertions, computed
//              only from simulation state (no wall-clock time, no DOM layout)
//   describe(state)  optional: an array of short text lines for contact-sheet
//              captions
//   checkPresentation()  optional: compares rendered objects and camera with
//              simulation state before a capture; returns { valid, ...evidence }

const HARNESS_VERSION = 2;

export function installQaHarness(game) {
  for (const name of ['simulate', 'present', 'draw', 'getState']) {
    if (typeof game[name] !== 'function') {
      throw new Error(`QA harness: the game adapter needs ${name}().`);
    }
  }
  if (!game.renderer || !(game.fixedStep > 0)) {
    throw new Error('QA harness: the game adapter needs renderer and a positive fixedStep.');
  }
  if (!Array.isArray(game.actions) || game.actions.length === 0) {
    throw new Error('QA harness: the game adapter needs actions, a list of its semantic input actions.');
  }
  if (!game.scenarios || Object.keys(game.scenarios).length === 0) {
    throw new Error('QA harness: the game adapter needs at least one scenario.');
  }
  if (window.__qa) {
    throw new Error('QA harness: window.__qa is already installed. Call window.__qa.dispose() when the game ' +
      'is torn down (for example in a React effect cleanup) before installing it again.');
  }
  const actions = new Set(game.actions);
  const scenarios = game.scenarios;

  let authority = false;
  let savedLoop = null;
  let tick = 0;
  let scenarioId = null;
  let sheet = null;
  let kept = null;
  let shownSheet = null;
  let busy = null;        // the asynchronous call in progress
  let lastState = null;   // the state as QA last left it, as JSON
  let loopRestarted = false;   // the game started its loop again while QA had control

  // Take control from the live loop, and take it again if the game starts its
  // loop while QA has control (a Play button, an asynchronous load). Stepping
  // never depends on requestAnimationFrame, so runs repeat exactly and work in
  // hidden pages.
  function takeAuthority() {
    const loop = game.renderer.getAnimationLoop();
    if (authority && loop !== null) loopRestarted = true;
    if (!authority || loop !== null) savedLoop = loop;
    if (loop !== null) game.renderer.setAnimationLoop(null);
    authority = true;
  }

  function assertIdle(call) {
    if (busy !== null) {
      throw new Error(`QA harness: ${call}() was called while ${busy} is still running. ` +
        'Await each scenario() and capture() before the next call.');
    }
  }

  // Only QA may change the simulation while QA has control.
  function assertUnchanged(call) {
    if (lastState === null) return;
    const now = stateText();
    if (now === lastState) return;
    const difference = firstDifference(JSON.parse(lastState), JSON.parse(now));
    const cause = loopRestarted
      ? 'The game started its animation loop again while QA had control (a timer, a Play button or a finished ' +
        'load called renderer.setAnimationLoop()), and that loop simulated. '
      : 'Something other than QA changed it: a loop outside renderer.setAnimationLoop(), a timer, an input event ' +
        'handler, an unawaited load, code editing the state directly, present() changing simulation state, or ' +
        'getState() reporting something that is not simulation state (wall-clock time, frame rate, DOM layout). ';
    lastState = null;
    scenarioId = null;   // the run can no longer be reproduced
    throw new Error(`QA harness: the game state changed between QA calls (before ${call}() at tick ${tick}): ` +
      `${difference}. ${cause}Stop it while QA has control, then call scenario() again.`);
  }

  function checkInput(input) {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) {
      throw new Error('QA harness: input must be an object of action: value, or a function returning one.');
    }
    for (const name of Object.keys(input)) {
      if (!actions.has(name)) {
        throw new Error(`QA harness: unknown action "${name}" at tick ${tick}. Known: ${[...actions].join(', ')}.`);
      }
    }
    // A fresh, deeply frozen copy each tick: held input stays held for every
    // tick, and a simulate() that tries to change its input fails loudly
    // instead of editing the script.
    return frozenCopy(input);
  }

  function simulateTick(input) {
    try {
      game.simulate(game.fixedStep, input);
    } catch (error) {
      if (error instanceof TypeError &&
          /read only|read-only|not extensible|Cannot delete|Cannot add property/.test(error.message)) {
        throw new Error(`QA harness: simulate() tried to change its input at tick ${tick} (${error.message}). ` +
          'Input is read-only: keep what later ticks need, such as the previous tick\'s input, in simulation state.',
        { cause: error });
      }
      throw error;
    }
  }

  // JSON would silently turn NaN and Infinity into null, which compares like
  // 0 and lets a broken simulation pass its expectations.
  function stateText() {
    const state = game.getState();
    if (state === null || typeof state !== 'object') {
      throw new Error('QA harness: getState() must return an object.');
    }
    const paths = new WeakMap();
    let text;
    try {
      text = JSON.stringify(state, function (key, value) {
        const parent = paths.get(this) ?? 'state';
        const path = key === '' ? 'state' : Array.isArray(this) ? `${parent}[${key}]` : `${parent}.${key}`;
        const raw = this[key];   // before toJSON(), which Three.js objects have
        if (raw?.isObject3D === true || raw?.isBufferGeometry === true || raw?.isMaterial === true || raw?.isTexture === true) {
          throw new Error(`QA harness: getState() returned a Three.js ${raw.type ?? 'object'} at ${path}. ` +
            'Report the simulation values it stands for (position, health, state) instead.');
        }
        if (typeof value === 'bigint' || value instanceof Map || value instanceof Set || ArrayBuffer.isView(value)) {
          throw new Error(`QA harness: getState() returned a ${typeof value === 'bigint' ? 'BigInt' : value.constructor.name} ` +
            `at ${path}, which JSON cannot represent. Convert it to plain data, for example [...set], ` +
            'Object.fromEntries(map) or Array.from(typedArray).');
        }
        if (typeof value === 'number' && !Number.isFinite(value)) {
          throw new Error(`QA harness: getState() returned ${value} at ${path}. This is usually a simulation bug; ` +
            'report a deliberate non-finite value explicitly, for example as null.');
        }
        if (value !== null && typeof value === 'object') paths.set(value, path);
        return value;
      });
    } catch (error) {
      if (error.message.startsWith('QA harness:')) throw error;
      throw new Error('QA harness: getState() must return plain data (numbers, strings, booleans, arrays, ' +
        `objects), not Three.js objects or other class instances: ${error.message}`);
    }
    if (!text.startsWith('{')) throw new Error('QA harness: getState() must return an object.');
    return text;
  }

  // present() must only read simulation state: calling it twice changes nothing.
  function presentAndSnapshot() {
    game.present(1);
    const presented = stateText();
    game.present(1);
    const again = stateText();
    if (again !== presented) {
      lastState = null;
      throw new Error(`QA harness: present() changed the simulation state (${firstDifference(JSON.parse(presented), JSON.parse(again))}). ` +
        'present() must only read simulation state; move gameplay timers and counters into simulate().');
    }
    lastState = again;
    loopRestarted = false;
    return JSON.parse(again);
  }

  function snapshot() {
    lastState = stateText();
    loopRestarted = false;
    return JSON.parse(lastState);
  }

  function captionLines(state) {
    if (typeof game.describe === 'function') {
      const lines = game.describe(state);
      if (!Array.isArray(lines)) {
        throw new Error('QA harness: describe(state) must return an array of short text lines.');
      }
      return lines.map(String);
    }
    // Without describe(), show the first few values, one level deep.
    const format = (value) => (typeof value === 'number' ? +value.toFixed(2) : value);
    const lines = [];
    for (const [key, value] of Object.entries(state)) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        lines.push(`${key} ${Object.entries(value)
          .filter(([, inner]) => inner === null || typeof inner !== 'object')
          .map(([innerKey, inner]) => `${innerKey} ${format(inner)}`).join('  ')}`);
      } else if (value === null || typeof value !== 'object') {
        lines.push(`${key} ${format(value)}`);
      }
      if (lines.length === 4) break;
    }
    return lines;
  }

  function releaseKept() {
    kept?.cleanup();
    kept = null;
  }

  function requireScenario(call) {
    if (scenarioId === null) {
      throw new Error(`QA harness: call scenario() before ${call}().`);
    }
  }

  const api = {
    version: HARNESS_VERSION,

    info() {
      return {
        version: HARNESS_VERSION,
        fixedStep: game.fixedStep,
        actions: [...actions],
        scenarios: Object.keys(scenarios),
        scenario: scenarioId,
        tick,
        qaHasControl: authority,
        liveLoopToResume: savedLoop !== null,
        three: game.THREE?.REVISION ?? null,
        webgpu: game.renderer.backend?.isWebGPUBackend === true,
        canCapture: typeof game.capture === 'function',
      };
    },

    // Reset to a named starting point. The same scenario and seed must always
    // produce the same state; that is what makes runs comparable. Await it:
    // a scenario may load assets.
    async scenario(id, { seed = 1 } = {}) {
      assertIdle('scenario');
      if (typeof scenarios[id] !== 'function') {
        throw new Error(`QA harness: unknown scenario "${id}". Known: ${Object.keys(scenarios).join(', ')}.`);
      }
      releaseKept();
      api.hideSheet();
      takeAuthority();
      lastState = null;
      scenarioId = null;
      tick = 0;
      busy = `scenario("${id}")`;
      // Hold any loop the scenario starts until resume(), so it cannot run
      // while the scenario awaits a load.
      const renderer = game.renderer;
      const ownSetLoop = Object.prototype.hasOwnProperty.call(renderer, 'setAnimationLoop');
      const setAnimationLoop = renderer.setAnimationLoop;
      renderer.setAnimationLoop = (callback) => { savedLoop = callback; return Promise.resolve(); };
      try {
        await scenarios[id](seed);
      } finally {
        if (ownSetLoop) renderer.setAnimationLoop = setAnimationLoop;
        else delete renderer.setAnimationLoop;
        busy = null;
        takeAuthority();   // a loop started some other way
      }
      scenarioId = id;
      return { tick, state: presentAndSnapshot() };
    },

    // Advance `ticks` fixed simulation steps. `input` is an object of
    // action: value held for every tick, or a function (index, tick) => input,
    // where index counts from 0 within this call and tick is the QA tick.
    step(ticks = 1, input = {}) {
      assertIdle('step');
      requireScenario('step');
      if (!Number.isInteger(ticks) || ticks < 0) {
        throw new Error('QA harness: ticks must be a whole number of 0 or more.');
      }
      releaseKept();
      api.hideSheet();
      takeAuthority();
      assertUnchanged('step');
      try {
        for (let i = 0; i < ticks; i += 1) {
          const frameInput = typeof input === 'function' ? input(i, tick) : input;
          simulateTick(checkInput(frameInput ?? {}));
          tick += 1;
        }
        return { tick, state: presentAndSnapshot() };
      } catch (error) {
        lastState = null;   // stopped part-way: the next call carries on from here
        throw error;
      }
    },

    getState() {
      return { tick, state: JSON.parse(stateText()) };
    },

    // Draw the current QA state on the live canvas at the start of a fresh
    // animation frame, for comparing a capture with a direct screenshot.
    async drawLive() {
      assertIdle('drawLive');
      requireScenario('drawLive');
      releaseKept();
      api.hideSheet();
      takeAuthority();
      assertUnchanged('drawLive');
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
      game.present(1);
      game.draw();
      return { tick };
    },

    // Start a new contact sheet; later captures are added to it until the next
    // startSheet().
    startSheet(title) {
      assertIdle('startSheet');
      if (typeof game.createContactSheet !== 'function') {
        throw new Error('QA harness: install with createContactSheet from contact-sheet.js.');
      }
      api.hideSheet();
      sheet = game.createContactSheet({ title });
      return { title };
    },

    // Capture the current state with GPU readback. The capture is added to the
    // contact sheet, if one was started, with `note` as its first caption line.
    // With `keep: true` it stays on screen, with the real DOM HUD, until the
    // next scenario(), step(), capture(), run(), drawLive(), showSheet() or
    // resume(), or release(), and is not added to the sheet unless
    // `addToSheet` is true. Sheet tiles hold the rendered scene only.
    async capture(label, { keep = false, addToSheet = !keep, status = 'info', note, ...options } = {}) {
      assertIdle('capture');
      if (typeof game.capture !== 'function') {
        throw new Error('QA harness: install with capture from webgpu-readback.js.');
      }
      requireScenario('capture');
      releaseKept();
      api.hideSheet();
      takeAuthority();
      assertUnchanged('capture');
      // Read the state and captions before the capture replaces the canvas.
      const state = snapshot();
      const lines = sheet && addToSheet ? captionLines(state) : [];
      const capturedTick = tick;
      busy = `capture("${label}")`;
      let result;
      try {
        result = await game.capture({
          THREE: game.THREE,
          renderer: game.renderer,
          renderFinalFrame: () => game.draw(),
          synchroniseFrame: () => game.present(1),
          checkPose: async () => {
            let presentation = { valid: true };
            if (typeof game.checkPresentation === 'function') {
              presentation = await game.checkPresentation();
              if (presentation === null || typeof presentation !== 'object' || typeof presentation.valid !== 'boolean') {
                throw new Error('QA harness: checkPresentation() must return { valid: true or false, ...evidence }.');
              }
              if (!presentation.valid) {
                throw new Error(`QA harness: checkPresentation() found that the rendered scene does not match the state at tick ${tick}: ` +
                  JSON.stringify(presentation).slice(0, 400));
              }
            }
            return { ...presentation, valid: tick === capturedTick && presentation.valid, tick };
          },
          ...options,
        });
      } finally {
        busy = null;
      }
      let hash;
      try {
        hash = frameHash(result.canvas);
        if (sheet && addToSheet) {
          sheet.add({ canvas: result.canvas, label, status,
            lines: note ? [`>> ${note}`, ...lines] : lines });
        }
      } catch (error) {
        result.cleanup();
        throw error;
      }
      if (keep) kept = result;
      else result.cleanup();
      return { label, tick, state, metadata: { ...result.metadata, frameHash: hash } };
    },

    release() {
      releaseKept();
    },

    // Run a scripted route: [{ label, ticks, input, capture, expect }]. A
    // segment without `ticks` does not advance. `expect` is (state) => true, or
    // a string describing the failure. A failed expectation is recorded and,
    // when a sheet was started, captured onto it even without `capture`; the
    // run goes on unless `stopOnFailure` is true. An error stops the run and is
    // recorded with the results so far.
    async run(script, { stopOnFailure = false } = {}) {
      assertIdle('run');
      if (!Array.isArray(script)) {
        throw new Error('QA harness: run() needs an array of segments.');
      }
      requireScenario('run');
      const results = [];
      for (const [index, segment] of script.entries()) {
        const label = segment.label ?? `segment ${index + 1}`;
        let stepped = null;
        let verdict = null;
        let captured = null;
        try {
          stepped = api.step(segment.ticks ?? 0, segment.input ?? {});
          if (typeof segment.expect === 'function') {
            const outcome = segment.expect(stepped.state);
            if (typeof outcome?.then === 'function') {
              throw new Error(`expect for "${label}" must return true or a string, not a promise.`);
            }
            verdict = outcome === true ? 'pass'
              : typeof outcome === 'string' && outcome ? outcome
              : `expectation returned ${String(outcome)}, not true`;
          }
          const failed = verdict !== null && verdict !== 'pass';
          if (segment.capture || (failed && sheet)) {
            const options = typeof segment.capture === 'object' && segment.capture !== null ? segment.capture : {};
            const status = verdict === null ? (options.status ?? 'info') : failed ? 'fail' : 'pass';
            try {
              captured = (await api.capture(label, { ...options, status,
                note: failed ? verdict : options.note })).metadata;
            } catch (error) {
              if (segment.capture) throw error;
              // Only the automatic capture of a failure failed: keep the failure and go on.
              captured = { error: error.message };
            }
          }
        } catch (error) {
          // The game is in an unknown state: record the error, and the failed
          // expectation if there was one, and stop.
          const failedFirst = verdict !== null && verdict !== 'pass';
          results.push({ label, tick, state: stepped?.state ?? null,
            verdict: failedFirst ? `${verdict} (then error: ${error.message})` : `error: ${error.message}`, captured });
          break;
        }
        results.push({ label, tick: stepped.tick, state: stepped.state, verdict, captured });
        if (verdict !== null && verdict !== 'pass' && stopOnFailure) break;
      }
      const failures = results.filter((result) =>
        result.verdict !== null && result.verdict !== 'pass');
      return { scenario: scenarioId, passed: failures.length === 0, failures, results };
    },

    // Show the contact sheet for a screenshot; call hideSheet() afterwards.
    showSheet(options) {
      assertIdle('showSheet');
      if (!sheet) throw new Error('QA harness: call startSheet() first.');
      releaseKept();
      api.hideSheet();
      shownSheet = sheet.present(options);
      return shownSheet.metadata;
    },

    hideSheet() {
      shownSheet?.cleanup();
      shownSheet = null;
    },

    // Hand control back and remove window.__qa, for a game that is torn down
    // and created again (a framework remount or hot reload).
    dispose() {
      api.resume();
      if (window.__qa === api) delete window.__qa;
    },

    // Hand control back to the live loop, from the current QA state. The live
    // loop should clamp its first frame delta. Call scenario() again before
    // more QA steps. `resumedLiveLoop` is false when the game had no loop
    // running when QA took control, so there was nothing to hand back.
    resume() {
      assertIdle('resume');
      releaseKept();
      api.hideSheet();
      const resumedLiveLoop = authority && savedLoop !== null;
      if (authority) {
        game.renderer.setAnimationLoop(savedLoop);
        authority = false;
      }
      savedLoop = null;
      scenarioId = null;
      tick = 0;
      lastState = null;
      return { ...api.info(), resumedLiveLoop };
    },

  };

  window.__qa = api;
  return api;
}

function frozenCopy(value) {
  if (value === null || typeof value !== 'object') return value;
  const copy = Array.isArray(value) ? value.map(frozenCopy)
    : Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, frozenCopy(inner)]));
  return Object.freeze(copy);
}

// The first path at which two JSON states differ, for error messages.
function firstDifference(before, after, path = 'state') {
  if (Object.is(before, after)) return null;
  if (before === null || after === null || typeof before !== 'object' || typeof after !== 'object' ||
      Array.isArray(before) !== Array.isArray(after)) {
    const show = (value) => (value === undefined ? 'missing' : JSON.stringify(value).slice(0, 60));
    return `${path} changed from ${show(before)} to ${show(after)}`;
  }
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const found = firstDifference(before[key], after[key],
      Array.isArray(before) ? `${path}[${key}]` : `${path}.${key}`);
    if (found) return found;
  }
  return null;
}

// A short fingerprint of a capture's pixels. Equal states that give different
// fingerprints on repeat runs point to presentation state a scenario does not
// reset, or to wall-clock animation. Temporal effects such as TRAA jitter also
// change it.
function frameHash(canvas) {
  const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  const words = new Uint32Array(data.buffer, data.byteOffset, data.byteLength >> 2);
  let hash = 0x811c9dc5;
  for (let i = 0; i < words.length; i += 1) {
    hash = Math.imul(hash ^ words[i], 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
