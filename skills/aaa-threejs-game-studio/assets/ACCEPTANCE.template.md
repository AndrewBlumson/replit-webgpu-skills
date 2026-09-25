# Vertical-slice acceptance ledger

Status values: `not-run`, `pass`, `fail`, `blocked`, `needs-user`, `not-applicable`. Use `not-applicable` only with a recorded reason. `needs-user` means the check needs a person or the target device, its card is under "Needs-user checks" in `docs/QA-ROUTE.md` and has been handed to the user, and the result is not yet known; it is never a pass. A pass needs current evidence from the exact build and route. Reword or add rows to fit the genre (a racing game needs its checkpoint, wrong-way and reset rows), but keep every gate covered.

A scripted `__qa` route can pass gates about what the simulation does and what its inspected captures show. A gate that also needs a person or the target device (feel and difficulty, input latency, bindings, pointer lock and mouse-look, gamepad or touch, audio, and frame rate and pacing on the target device) stays `not-run` until its card is handed over, then `needs-user` until the user reports; note the scripted evidence in its Evidence column. When the user reports, record `pass` or `fail` with "user report", the date, device and browser. The release decision stays "not accepted" while any gate that is not `not-applicable` is anything other than `pass`. If the user decides to release anyway, record "released by user decision; unverified: <gates>" under Accepted limitations; those gates keep their status and never count as passes.

## Build and runtime contract

| Gate | Status | Evidence | Defect/owner |
| --- | --- | --- | --- |
| Production build succeeds | not-run |  |  |
| The production bundle contains no QA, capture or debug code (Gate 1 grep) | not-run |  |  |
| Exact Three.js version is recorded | not-run |  |  |
| Latest-stable Three.js status was verified from official sources when this project, a major rebuild or a Build/change began (a Repair or review records the installed release instead) | not-run |  |  |
| `three/webgpu` and `three/tsl` imports are used | not-run |  |  |
| Initialised backend is WebGPU; fallback is rejected | not-run |  |  |
| Target is latest-generation Apple Silicon or an equivalently capable current high-end PC; no legacy compatibility path ships | not-run |  |  |
| No uncaught error or relevant warning on the acceptance route | not-run |  |  |

## Asset-production contract

The asset-lane decision applies to every project. Mark only DCC/GLB gates `not-applicable` when every asset is native Three.js/TSL, with a recorded reason. Mark Blender-specific gates `not-applicable` when Blender is not selected.

Blender authoring in Replit requires a configured, verified MCP connection. For supplied GLBs without access to their authoring environment, mark live DCC authoring/re-export gates `not-applicable` with a reason; provenance, delivery optimisation and browser validation still apply.

| Gate | Status | Evidence | Defect/owner |
| --- | --- | --- | --- |
| Each representative asset class has a justified native Three.js/TSL, DCC-to-GLB, or hybrid lane | not-run |  |  |
| Selected DCC connection, reported runtime version, and versioned export profile are recorded | not-run |  |  |
| Blender, when selected, is reachable through a configured MCP with the required operations and a verified asset-transfer route into Replit | not-run |  |  |
| When authoring is in scope, the representative editable master rebuilds and exports through the supported connection using checked-in automation or a recorded operation recipe | not-run |  |  |
| The checked-in raw-to-delivery recipe performs the required inspect, optimise/transform, validate, compare, and hash stages reproducibly | not-run |  |  |
| Raw and final GLB pass validator plus semantic, material, animation, and proxy checks | not-run |  |  |
| Representative final GLB loads through the project's actual Three.js loader and is accepted at the gameplay camera/lighting, including interaction, collision, LOD, animation, restart/re-entry, loading, and disposal as applicable | not-run |  |  |
| DCC delivery assets beat or justify their cost against a native alternative using route-specific transfer, load/decode/upload, memory, draw/material, geometry, animation, culling, lifecycle, and visible-quality evidence | not-run |  |  |
| Generated delivery assets are fresh, hashed, and covered by provenance/licence records | not-run |  |  |

## Complete game route

| Gate | Status | Evidence | Defect/owner |
| --- | --- | --- | --- |
| Player gains control and the scripted `__qa` route reaches the end state | not-run |  |  |
| Input is responsive on the target input device, played by hand (usually `needs-user`) | not-run |  |  |
| Traversal and collision remain valid across the route | not-run |  |  |
| Core interaction/combat loop works repeatedly | not-run |  |  |
| Enemies/hazards perceive, act, react, and resolve | not-run |  |  |
| Objectives progress without developer intervention | not-run |  |  |
| Failure, restart/checkpoint, pause, and focus loss work | not-run |  |  |
| Required controls, camera/motion, subtitle, and audio options work | not-run |  |  |
| Route has a visible and audible ending state | not-run |  |  |

## Presentation

| Gate | Status | Evidence | Defect/owner |
| --- | --- | --- | --- |
| Opening frame establishes authored place, scale, and objective | not-run |  |  |
| Hero materials hold up at gameplay distance and close inspection | not-run |  |  |
| Lighting directs the route and preserves gameplay readability | not-run |  |  |
| VFX interact with surfaces, movement, depth, and local conditions | not-run |  |  |
| Animation has transitions, reactions, and no obvious foot/weapon sliding | not-run |  |  |
| Spatial, weapon, impact, ambience, UI, and music layers are balanced (usually `needs-user`) | not-run |  |  |
| HUD communicates state without hiding the playfield | not-run |  |  |
| No placeholder, debug, provenance, or licence defect is visible | not-run |  |  |

## Performance and lifecycle

| Gate | Status | Evidence | Defect/owner |
| --- | --- | --- | --- |
| Named frame-time target holds at the worst encounter on the named device, against the brief's percentile policy (usually `needs-user`; the user's report must include a trace or the numbers) | not-run |  |  |
| Shader/pipeline warm-up prevents first-use combat stutter | not-run |  |  |
| Draw, triangle, memory, and transfer budgets are measured | not-run |  |  |
| Resize, DPR change, visibility change, and input-lock recovery work | not-run |  |  |
| Restart/re-entry does not duplicate loops, listeners, audio, or GPU resources | not-run |  |  |
| Loading and progress UI remain honest on a cold load | not-run |  |  |

## Release route

| Gate | Status | Evidence | Defect/owner |
| --- | --- | --- | --- |
| The deployment runs the accepted build (its build identifier matches the accepted local artefact) | not-run |  |  |
| The full route is played by hand on the deployment from a `needs-user` card, and the user reports the result | not-run |  |  |

## Final judgement

- Exact acceptance URL:
- Deployment URL:
- Commit/build identifier:
- Browser, OS, GPU, viewport, and input device:
- Intended target or disclosed proxy:
- Deterministic seed/scenario:
- Input/event trace and simulation version when testing replay:
- Checks handed to the user (`needs-user`) and their cards in `docs/QA-ROUTE.md`:
- Accepted limitations:
- Rejected claims:
- Release decision:
