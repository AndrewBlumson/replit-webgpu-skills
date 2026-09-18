# Game vertical-slice brief

## Product contract

- Working title:
- One-sentence player fantasy:
- Genre and camera:
- Original setting and conflict:
- Target platform and input:
- Supported hardware floor (latest-generation Apple Silicon or equivalent high-end PC):
- Latest-stable Three.js verification source/date and resolved project lock evidence:
- Renderer contract (strict native WebGPU/TSL; no legacy fallback):
- Frame-rate target and target device:
- Vertical-slice boundary:
- Approximate playable duration and numeric content boundary:
- Single-player/multiplayer contract:

## Reference translation

| Reference | Capability or quality signal | Original implementation decision | Excluded protected expression |
| --- | --- | --- | --- |
|  |  |  |  |

## Player verbs

List the verbs that must work in the playable build. Give each verb a responsive-input expectation and visible/audio feedback.

| Verb | Input | Simulation rule | Feedback | Acceptance check |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

## Complete playable route

Define a short authored route with a beginning, escalation, climax, and resolved ending. Every beat must change play, information, or pressure.

| Beat | Player goal | Spatial composition | Opposition or hazard | Set piece | Exit condition |
| --- | --- | --- | --- | --- | --- |
| Arrival |  |  |  |  |  |
| Teaching encounter |  |  |  |  |  |
| Escalation |  |  |  |  |  |
| Climax |  |  |  |  |  |
| Resolution |  |  |  |  |  |

## Gameplay systems

- Movement/controller:
- Camera:
- Interaction/combat:
- Enemy or hazard behaviours:
- Health, failure, restart, and checkpoints:
- Objectives and progression:
- Pause/focus-loss behaviour:
- Accessibility and control options:

## Authored presentation pillars

Choose three to five observable pillars. Avoid adjectives without a production implication.

| Pillar | Geometry/material decision | Lighting/VFX decision | Audio/UI decision | Hero shot or route beat |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

## Asset and animation plan

| Asset family | Hero/background | Source and licence | LOD/collision plan | Animation plan | Delivery format | Owner/status |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |

### Content-production capacity

- Asset lane by class (native Three.js/TSL, DCC-to-GLB, or hybrid) and measured reason:
- Configured Blender MCP connection and verified required capabilities, or `not-applicable`:
- Asset transfer from MCP host into Replit, or supplied-asset source:
- Selected available DCC/toolchain and why, if any:
- Latest-stable DCC verification source/date and connected runtime version, when used:
- Authoring mode (native code, supplied assets, or configured MCP operations):
- Versioned DCC-to-GLB export profile/script and owner:
- Hero environment production method/owner:
- Character, creature, or vehicle production method/owner:
- Rigging/animation production method/owner:
- Audio/music production or licensed-source method/owner:
- UI/type/icon production method/owner:
- Representative hero kit and final-segment review checkpoint:

## Rendering plan

- Lighting model and time/weather:
- TSL material work:
- Compute effects:
- RenderPipeline/MRT/post effects:
- Reflection and transparency strategy:
- Resolution scaling and anti-aliasing:
- Shader/pipeline warm-up route:

## Budgets

Record starting budgets as hypotheses, then replace them with measurements from the named target device and worst route beat.

| Budget | Target | Worst-case measurement | Evidence route | Action if exceeded |
| --- | --- | --- | --- | --- |
| CPU frame time |  |  |  |  |
| GPU frame time |  |  |  |  |
| Draw calls |  |  |  |  |
| Visible triangles |  |  |  |  |
| GPU memory estimate |  |  |  |  |
| Initial transfer |  |  |  |  |
| Time to controllable |  |  |  |  |

## Risks and proof spikes

| Risk | Smallest proof | Pass/fail evidence | Fallback that preserves the fantasy |
| --- | --- | --- | --- |
|  |  |  |  |

## Definition of done

Link the acceptance ledger and QA route. Name the exact URL, build command, target browser/device, seed or scenario, whether reproducibility needs an input/event trace, and required capture points.
