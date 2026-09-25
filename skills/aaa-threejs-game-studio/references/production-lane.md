# Production lane

These sections belong to `SKILL.md` and apply only in the production lane. They sit here to keep `SKILL.md` within Replit's 40 KB skill limit; read them with `SKILL.md`, whose rules still apply. A quoted section name such as "Report evidence honestly" refers to `SKILL.md` unless another file is named.

## Bind the vertical-slice brief

Create or update the durable game brief before expensive implementation; the demo and prototype lanes use their "done when" lines instead. It must define:

- one-sentence player fantasy and original setting;
- genre, camera, target hardware/browser/input, and frame contract;
- exact vertical-slice boundary and non-goals;
- approximate playable duration, encounter/race/route count, and numeric content boundary;
- player verbs and their visible/audio feedback;
- an authored route with arrival, teaching, escalation, climax, and resolution;
- opposition/hazards, objective graph, failure, checkpoint/restart, pause, and ending;
- three to five observable presentation pillars;
- asset/animation/provenance plan;
- content-production capacity and method for hero environment, characters/vehicles, animation, audio, UI, and VFX;
- renderer/TSL/compute/post plan;
- starting budgets, worst route beat, risks, and proof spikes;
- exact definition of done, URL, build, and QA route.

Translate “PS4-era quality” into observable gates rather than claiming hardware equivalence: authored composition and assets, stable responsive play, complete animation/reaction states, coherent materials/lighting/VFX/audio/UI, deliberate set pieces, robust lifecycle, and measured target-device frame time.

Before scaling final art, require one representative hero kit and route segment to prove the content plan: silhouette, modelling, UV/material work, rig/animation or vehicle motion, audio, licences/provenance, delivery recipe, and target-camera quality. If required content cannot be created or sourced within the user-authorised tools/budget, report that concrete production blocker; do not silently fill the route with procedural primitives and still claim the target quality.

If scope is too large, shorten the route or reduce variety while preserving a complete arc and final quality. Do not preserve breadth by making a still scene, autoplay camera, free-roam effect viewer, procedural placeholder field, or disconnected mechanic test.

## Build the game in passes

Follow this order and retain a playable full route after each pass:

1. **Risk proofs:** test the three assumptions most likely to invalidate the fantasy with representative APIs/assets and target-device evidence, then delete or isolate each proof's code once it is adopted or rejected.
2. **Playable greybox:** control, camera, collision, core loop, opposition, objectives, failure/restart, and end state across the whole route.
3. **Authored environment:** modular kit, hero landmarks, cover/traversal, collision/nav/proxy data, sight lines, readable route lighting, and zone identity.
4. **Representative final segment:** finish every department together on one route segment before scaling the recipe.
5. **Full slice and set pieces:** expand the proven recipe; make spectacle causal, readable, interactive, and state-changing.
6. **Hardening:** warm pipelines, tune LOD/streaming/quality tiers, remove hitches/leaks, validate cold load/restart/re-entry, and complete the live acceptance route.

Do not spend the quality budget on post-processing before the controller, route, asset silhouettes, materials, lighting, animation, interaction, and audio work.

## Author the world and delivery pipeline

Keep DCC masters separate from generated delivery assets. Export authored cells/prefabs rather than a monolithic world GLB. Preserve gameplay metadata through a typed sidecar or owned schema; destructive geometry tools must not silently erase objectives, spawns, triggers, sockets, or collision semantics.

Use explicit, pinned per-asset recipes:

1. validate/inspect raw glTF;
2. deduplicate/prune under the metadata contract;
3. create error-aware LODs and prepare animation;
4. choose measured Meshopt or Draco compression;
5. encode textures with content-aware KTX2 presets and mips;
6. revalidate, visually compare, and emit a manifest with hashes/bounds/budgets/tool versions.

Configure and reuse one GLTFLoader service and one post-init KTX2Loader/worker pool. Batch/instance only within compatible cells, materials, visibility, shadows, and lifetime ownership. Stream through bounded priority queues with cancellation and byte-aware disposal when the level size requires it.

## Verify the rendered product

This is the production lane's verification; the demo and prototype lanes deliver the evidence in `references/demo-prototype-lanes.md`. Use the exact served route as acceptance. Record project/build identity, URL, seed/scenario, browser/OS/GPU, viewport/DPR, input, and cold/warm state.

Run in order:

1. formatter/typecheck/tests/production build;
2. cold-start strict-backend, asset, pointer-lock, audio, and console checks;
3. complete player-like route from gaining control through failure/restart and ending, driven through the `__qa` hook as a scripted route with expectations and a contact sheet, and by a person through a `needs-user` check card;
4. adversarial collision, trigger, backtracking, pause/focus, resource, and recovery paths;
5. visual/material/animation/VFX/audio/UI inspection from the gameplay camera;
6. sustained worst-encounter CPU, optional GPU timestamp, frame-pacing, workload, memory, transfer, and warm-up checks;
7. two lifecycle cycles covering resize/DPR, blur/focus, restart, leave/re-entry, and teardown;
8. the same route on the production deployment when release is in scope, played by a person from a `needs-user` check card, because the production bundle has no `__qa` hook; a scripted run on a QA build of the same commit supports it but is not the release artefact.

Keep `docs/ACCEPTANCE.md` current, with the statuses in "Report evidence honestly". A pass needs fresh evidence from the exact build and route. Mark missing evidence `not-run`, not pass. Do not accept the slice solely from headless tests, static screenshots, counters, or agent status. A scripted `__qa` route with passing expectations and inspected captures, headless or not, can pass the gates about what the simulation does and what the captures show. Gates for feel and difficulty, input latency, bindings, pointer lock and mouse-look, gamepad or touch, audio, and frame rate and pacing on the target device stay `not-run` until their check card is handed to the user, then `needs-user` until a person or the target device reports a result. The release decision stays "not accepted" while any gate that is not `not-applicable` is anything other than `pass`. If the user decides to release anyway, record "released by user decision; unverified: <gates>" under "Accepted limitations"; those gates keep their status and never count as passes.
