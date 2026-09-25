# Gameplay architecture for a complete vertical slice

Build gameplay as authoritative state plus presentation. The renderer may interpolate, anticipate, and embellish; it must not be the only source of truth for damage, collision, objectives, checkpoints, or completion.

## Session state and clocks

Use an explicit application/session state machine, for example:

```text
Boot → Loading → Ready → Playing ↔ Paused
                              ├→ Failed → Restarting → Playing
                              └→ Completed → Results/Exit
```

State transitions own input mode, pointer lock, simulation, audio buses, UI, save/checkpoint behaviour, and allowed async work. Do not scatter `isPlaying` booleans across systems.

Run authoritative gameplay at a fixed step, commonly 1/60 s, from an accumulator owned by the single renderer animation loop. Clamp long frame deltas, cap catch-up work, and interpolate previous/current transforms for high-refresh rendering. Test at 30, 60, and 120 Hz. Fixed stepping improves consistency; it does not automatically provide cross-platform deterministic replay.

Maintain named clocks for simulation, real/UI, animation/presentation, cinematics, and visual effects. Pause and focus-loss policy must stop or continue each clock deliberately.

Keep the live loop thin, so it and the development-only `__qa` hook share the same `simulate`, `present` and `draw` (see "Give the agent a way to play" in `SKILL.md`). `THREE.Clock` is deprecated; use the core `THREE.Timer`. Seed random numbers in game code, not in the QA files, because the simulation needs them in production too:

```js
const FIXED_STEP = 1 / 60;
const timer = new THREE.Timer();
timer.connect(document);          // no delta while the page is hidden
let accumulator = 0;

renderer.setAnimationLoop(() => {
  timer.update();
  const frameDelta = Math.min(timer.getDelta(), 0.25);   // clamp long gaps
  accumulator += frameDelta;
  if (accumulator >= FIXED_STEP) {
    const input = inputController.sample();          // semantic actions; presses wait for a tick
    while (accumulator >= FIXED_STEP) {
      simulate(FIXED_STEP, input);
      accumulator -= FIXED_STEP;
    }
  }
  present(accumulator / FIXED_STEP);                 // interpolation factor
  updateEffects(frameDelta);                         // visual-only GPU effects, such as particles
  draw();
});

// Seeded random numbers (mulberry32); re-seed in every scenario reset.
function createRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

## Input ownership

Create one `InputController` that converts browser/device events into semantic actions. Track:

- held state for movement/aim;
- edge queues for jump, interact, fire, reload, dodge, pause, restart;
- analog values with dead zones, sensitivity, inversion, and device source;
- pointer-lock/visibility/focus state;
- rebindable display names for UI;
- complete listener teardown.

The latest stable Three.js `PointerLockControls` supplies camera rotation, pitch limits, lock/unlock events, and disposal, but it is not a complete input system. Confirm its current API against the resolved project release. Clear held and buffered actions on unlock, blur, hidden document, device disconnect, restart, and state transition. Treat unexpected unlock as pause unless the game contract says otherwise. Request pointer lock and audio unlock from an intentional user gesture.

Input events should never mutate physics or objective state directly. Sample or enqueue commands; consume them in deterministic simulation order. Pass the sampled commands into the simulation step as one semantic input object, so the development-only `__qa` hook can drive the same step with scripted input (see "Give the agent a way to play" in `SKILL.md`).

## Player controller and collision choice

Author a simple collision representation separate from the visual world. Choose one authoritative backend for each responsibility.

### Mostly static authored level

Use either:

- Three’s example `Octree` + `Capsule` for a lightweight dependency-free static triangle world; or
- `three-mesh-bvh` for accelerated static collision, raycast, closest-point, shelter/exposure, and custom spatial queries.

Do not maintain Octree and BVH copies of the same world without a measured, documented reason. Direct BVH queries are normally in collider-local space; transforms and rebuild/refit rules must be explicit.

### Dynamic bodies and moving platforms

Use Rapier when rigid bodies, pushable props, dynamic obstacles, moving platforms, joints, sensors, or a richer kinematic controller are actual scope. Configure fixed stepping and render interpolation. Its kinematic controller supports slide, autostep, slopes, ground snap, collision reporting, and optional impulses, but platform descent and edge cases still require route tests. Free WASM-owned resources and do not use raw physics snapshots as the permanent save schema.

For either path, the controller contract must define:

- capsule/shape dimensions and camera/avatar offset;
- acceleration, braking, air control, jump buffering/coyote time if used;
- slope limit, step height, ground snap, ceiling, wall slide, and depenetration;
- moving-surface velocity transfer;
- spawn-overlap and out-of-bounds recovery;
- crouch/stand clearance, ladders, mantles, doors, water, and hazards in scope;
- collision layers/masks and query policy.

Test curbs, stairs, slopes, seams, thin walls, corners, ceilings, ledges, high speed, camera cuts, restart, and the exact authored route. Use the same authoritative world semantics for closely related systems such as shelter and line of sight so visuals and gameplay cannot disagree.

## Interaction and combat pipeline

Represent every action as a stateful rule, not a visual callback:

```text
input command
  → action/weapon state gate
  → authoritative query or projectile step
  → hit/contact result
  → damage/status/objective events
  → animation, camera, VFX, decal, audio, UI presentation
```

For weapons/actions, define ready, start/anticipation, active/fire/contact, recovery/cooldown, reload/resource, interruption, swap, failure, and empty/out-of-range states as appropriate. Bind cadence to simulation time. Separate ballistic direction/spread from camera animation and visual recoil.

Hitscan needs range, layers, penetration/occlusion, surface material, hit zones, friendly rules, deterministic spread, and ordering. Projectiles need continuous/swept collision or sufficient substeps, ownership, lifetime, pooling, gravity/drag, impact resolution, and out-of-bounds cleanup.

Make feedback layered and causal: muzzle/action event, camera/animation response, tracer/trail where useful, contact VFX/decal, target reaction, spatial audio, controller feedback when available, HUD confirmation, and world state. Pool transient objects and enforce concurrency limits.

Never make an animation `finished` event the sole authority for damage or progression. Use simulation markers/events; animation consumes them and may provide presentation timing within explicit rules.

## Enemy and hazard AI

An enemy is complete only when it can perceive, decide, move or position, act, react, lose/reacquire, resolve, and participate in encounter/objective state. Use an explicit state/goal model such as:

```text
Idle/Patrol → Suspicious/Investigate → Engage
     ↑                 ↓                ├→ Reposition/Cover
     └──────── Search/Lost ←────────────┤
                                        ├→ Stagger/Disabled
                                        └→ Dead/Resolved
```

Separate:

- perception samples (vision cone, line of sight, hearing/events, damage source);
- short-term memory and last-known positions;
- tactical decision cadence;
- navigation/path and local steering;
- action/combat state;
- animation/presentation state.

Do not raycast every sensor for every enemy every frame. Stagger and budget perception, path refresh, and expensive tactical queries. Keep close/engaged enemies at full fidelity, distant/off-route enemies at reduced cadence, and sleeping enemies event-driven.

Use a navmesh only when navigation scope justifies it. Recast/Detour can provide offline/worker generation, tiled meshes, crowds, and obstacles, but navmesh does not replace collision or bespoke traversal. Doors, ladders, jumps, mantles, elevators, and authored transitions need explicit links and action states. Yuka is an optional source of state/goal, steering, perception, and navigation patterns; do not add a library when a small typed state machine is clearer.

Author encounter logic separately from individual AI. The encounter owns spawn/activation, reinforcement rules, pressure curve, objective relation, set-piece coordination, fail-safe resolution, and cleanup. It must not soft-lock if an actor falls out of world, becomes unreachable, or dies before a trigger.

## Animation state and events

Use one `AnimationMixer` per controlled root, cache actions, and select/blend them from gameplay state. Three’s mixer/action APIs supply blending, fading, time scaling, stop, and uncache; they do not design the locomotion graph.

Define:

- locomotion direction/speed and transition policy;
- grounded/airborne/landing layers;
- upper-body/additive actions where overlap is needed;
- action priority, interruption, and recovery;
- root-motion policy and controller reconciliation;
- deterministic markers for footsteps, contacts, magazines, muzzle events, and state handoff;
- hit reaction, stagger, death, ragdoll/physics handoff if scoped;
- distance/visibility update tiers.

Prepare/retarget/resample/compress clips offline whenever possible. Runtime retargeting is a proof path, not the default content pipeline. On entity unload, stop actions and uncache the action, clip, and root according to ownership.

## Objectives, triggers, checkpoints, and restart

Model progression as an explicit directed state graph or ordered objective data. A trigger sends an event; the objective system decides whether it is valid. Give events stable IDs and make one-shot transitions idempotent.

Each route beat needs:

- entry preconditions and activation;
- objective/player-facing instruction;
- encounter/hazard/set-piece dependencies;
- completion and fail conditions;
- checkpoint/save policy;
- cleanup and next transition;
- recovery if a required actor or asset fails.

Restart must restore an authored spawn/checkpoint, clear velocity and buffered input, reset transient projectiles/VFX/audio/camera state, restore or deliberately preserve objective/enemy/resource state, and regain pointer lock only through a fresh gesture. Test repeated restart and backtracking.

## Persistent state

Persist only durable, versioned data transfer objects:

- settings and bindings;
- completed/unlocked objectives;
- checkpoint ID and compact route variables;
- player inventory/resources if the slice requires them;
- schema version and migration metadata.

Use stable semantic IDs, validation, migrations, controlled hydration, corruption fallback, and an explicit clear/reset path. Never serialize Three objects, materials/textures, animation actions, Web Audio nodes, DOM listeners, workers, physics handles, or transient entity references.

## Audio gameplay integration

Create one listener on the active camera and structured buses for master/music/ambience/dialogue/effects/weapons/UI. Pool spatial emitters and set distance, rolloff, direction, and concurrency by event family. Gameplay publishes semantic audio events; audio chooses variants and presentation.

Unlock from a user gesture. Pause/duck/resume buses by session state. Stop/disconnect route-owned sources and nodes on restart/exit. Test rapid repeated actions, many emitters, focus loss, pause, indoor/outdoor or zone transitions, and completion.

## ECS and multithreading decision

Start an authored vertical slice with typed modules/domain objects. Introduce an ECS when many uniform entities and cross-cutting systems make data-oriented queries materially simpler. bitECS is capable, but its current API differs from older examples and it does not make thread synchronisation automatic.

Keep simulation/render on the main thread initially unless profiling identifies a real bottleneck. A worker game/physics thread with SharedArrayBuffer/triple buffering can provide stable simulation, but it adds cross-origin isolation, synchronisation, debugging, ownership, and teardown cost. Adopt it only after a representative route proves the need.

## Optional multiplayer

Do not add networking to a single-player request. If multiplayer is commissioned:

- make the server authoritative over gameplay state;
- send sequenced inputs/intents, never trust client transforms or damage claims;
- define fixed server tick, snapshot/patch cadence, interpolation buffer, prediction/reconciliation, lag compensation, interest management, and reconnect;
- separate reliable state/events from intentionally unreliable high-rate data where the transport supports it;
- test latency, jitter, loss, ordering, host migration/restart policy, and cheat boundaries.

Colyseus supplies rooms, authoritative state/schema patches, lifecycle, and a fixed-step context, but prediction, reconciliation, lag compensation, and interest management remain game-specific.

## Genre completeness adapters

Apply the common architecture, then bind the relevant completeness set:

- **First-person shooter:** pointer lock, capsule/controller, weapon state, hit authority, enemy combat loop, cover/sight lines, damage/failure, checkpoint, objective, weapon/impact/audio layers, complete mission beat.
- **Third-person action:** camera collision/shoulder policy, locomotion/turning, target/aim model, animation layering, traversal, enemy telegraph/reaction, encounter resolve.
- **Driving/racing:** fixed physics, controls, reset/recovery, checkpoints/laps/timing, camera modes, surface/tyre feedback, opponent/ghost rules, finish/results.
- **Platform/traversal:** buffered/coyote inputs as designed, moving surfaces, ledge/ceiling/hazard rules, checkpoint/restart, readable landing and animation contacts.
- **Flight/arcade:** 3D bounds, orientation/control assists, projectile/hazard rules, spawning/waves, camera readability, score/objective, failure/restart.
- **Exploration/horror:** interaction grammar, inventory/state, scripted triggers with recovery, AI perception/search, spatial audio, save/checkpoint, authored tension arc and ending.

In every genre, a scene becomes a game only when the player can act, state changes in response, opposition/constraints create decisions, progression resolves, failure/recovery works, and the route has a clear ending.

### Racing and antigravity handling contract

For a racing request, bind the race rules and vehicle model before final art. Default to gamepad-first analogue control plus a complete keyboard path unless the user chooses otherwise. Define:

- point-to-point, lap, time-trial, opponent, or hybrid format; start/countdown, splits, placement, finish, results, best time, restart, and replay/ghost scope;
- an ordered checkpoint graph with direction, missed-gate/wrong-way detection, shortcut/exploit prevention, safe reset poses, time penalties, and finish validation;
- track coordinate/gravity frame, surface normals, banking, crests, jumps, gaps, tunnel transitions, and world-up discontinuities;
- vehicle authority: spline-constrained arcade motion, kinematic controller, or dynamic rigid body;
- for hover physics, probe count/placement, target height, spring/damping, adhesion/downforce, thrust, lateral grip, yaw/roll, independent airbrakes, boost, airborne control, and stability limits;
- high-speed continuous/swept collision or sufficient substeps, wall/glancing response, integrity/damage if used, out-of-bounds detection, and recovery that cannot respawn into traffic or geometry;
- rival path/line representation, overtaking, avoidance/contact rules, rubber-banding policy, checkpoint truth, failure recovery, and finish ordering;
- chase-camera look-ahead, banking/horizon policy, speed/FOV response, collision, shake, occlusion, reverse/recovery, and alternate camera options;
- propulsion/airbrake/boost/load audio, speed readability, surface/impact effects, wake/trails, countdown/checkpoint/wrong-way/finish UI, and accessibility controls.

Test the handling proof on flats, long banks, rapid bank changes, crests, compressions, jumps, narrow gaps, walls, moving hazards, reverse/wrong-way, missed checkpoints, shortcuts, hard impacts, fall/recovery, and rival contact. Present the same fixed simulation at 30, 60, and 120 Hz and compare lap/segment time, path, energy/speed, recovery, and camera stability. A craft that only looks smooth on one frame rate or an unopposed free-drive scene is not an accepted racing game.
