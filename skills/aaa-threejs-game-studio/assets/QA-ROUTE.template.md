# Rendered QA route

## Reproduction contract

- URL:
- Build/commit:
- Browser/device/GPU:
- Intended target or disclosed proxy:
- Viewport and DPR:
- Input device:
- Seed/scenario/query flags:
- Input/event trace and simulation version when testing replay:
- Clean-load or save-state precondition:

## Route script

Each step must state an action and an observable result. Capture evidence after the interaction that produces the state, not before it.

| Step | Player action | Expected game state | Visual/audio evidence | Performance checkpoint |
| --- | --- | --- | --- | --- |
| 1 | Cold load |  |  |  |
| 2 | Gain control |  |  |  |
| 3 | Traverse first authored beat |  |  |  |
| 4 | Exercise the core loop |  |  |  |
| 5 | Trigger escalation/set piece |  |  |  |
| 6 | Reach the worst-case encounter |  |  |  |
| 7 | Fail and restart/checkpoint |  |  |  |
| 8 | Complete the route |  |  |  |
| 9 | Pause, blur/focus, resize, resume |  |  |  |
| 10 | Restart or re-enter |  |  |  |

## Scripted route (`window.__qa`)

- Build (development server, or QA build of the same commit):
- Scenario and seed:
- Script (segments with ticks, input and expectation):
- Result of each expectation, with its tick:
- Routes that should fail, and their results:
- Repeat run gave identical states and frame fingerprints: yes / no
- Contact sheet(s):
- Checks this run cannot make (see "Needs-user checks" below):

## Needs-user checks

Checks that need a person or the target device: feel and difficulty, input latency, bindings, pointer lock and mouse-look, gamepad or touch, audio, frame rate and pacing on the target device, and the deployment route played by hand. Each card follows "Report evidence honestly" in the aaa-threejs-game-studio skill, and the frame-time and deployment-route cards follow Gates 5 and 7 of its `references/verification.md`. Hand over as many cards as the checks need, one row each. A card's gates are `needs-user` in `docs/ACCEPTANCE.md` from the moment it is handed over.

| Card | URL and build | Steps (action: what should happen) | Gates covered | Handed over | User report (date, device, browser, result) |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |

## Inspection shots

- Opening composition:
- Hero asset/material close-up:
- Core gameplay under pressure:
- Environmental interaction or weather:
- Worst-case effects frame:
- Completion/end state:
- Debug/performance overlay at the worst beat:

## Defect log

| Severity | Route step | Defect | Reproduction | Evidence | Owner/status |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |
