# Authored visual, VFX, UI, and audio direction

Premium presentation comes from coordinated decisions across the playable route. High polygon count, compute particles, bloom, and a cinematic camera do not create authored quality by themselves.

## Start from the player camera and route

For every route beat, define:

- dominant silhouette and focal hierarchy;
- near, mid, and far depth layers;
- intended movement line and optional exploration pocket;
- combat sight lines, cover rhythm, and readable exits;
- landmark revealed before it is reached;
- lighting contrast and colour-temperature transition;
- ambient bed, directional cue, and anticipated set-piece sound;
- what changes after the player acts.

Inspect from gameplay eye height and FOV. An attractive editor orbit or autoplay angle is not acceptance evidence.

## Compose place before decorating it

Use large masses to establish geography, then architecture and route, then secondary storytelling, then surface detail. Each zone needs a distinct silhouette, scale cue, and material family. Repeated modular pieces should vary through composition, damage state, attachment sets, decals, and lighting—not random rotation alone.

Give every hero vista at least one foreground occluder or frame, a readable mid-ground route, and a far landmark. Use reveal, compression, release, vertical contrast, and controlled occlusion to pace the level.

## Build a material hierarchy

Author material response around the world’s story and gameplay:

- reserve the strongest reflectance, emission, or colour accent for focal objects and interactables;
- vary roughness and normal frequency by material scale, not as universal noise;
- use macro variation, edge history, decals, leaks, dust, wear, and contact darkening where causes support them;
- protect albedo values and avoid making every surface black, wet, emissive, or mirror-like;
- use detail maps and trim sheets for reuse, while hero assets retain unique silhouette and authored texture information;
- inspect base colour, normals, ORM channels, UV density, tangent quality, and colour space independently before judging the composite.

Wetness is a state, not a blue tint. Coordinate roughness change, darker diffuse response, coherent puddle placement, moving highlights/reflections, drip/runoff cues, footprints or tyre disturbance when relevant, and local splash/ripple response.

## Light for route, volume, and state

Choose a motivated key, ambient/sky model, and local practical-light language. Light must:

- guide the next decision without flattening exploration;
- preserve silhouettes for enemies, hazards, pickups, and cover edges;
- separate layers through value, colour temperature, haze, and shadow;
- change with gameplay state when a set piece, alarm, weather front, or destruction changes the space;
- retain stable exposure through bright effects and dark interiors.

Budget shadow-casting lights and update cadence explicitly. Use baked or authored ambient information when it improves stability, and dynamic shadows where movement or interaction makes them matter. Verify shadow acne, peter-panning, cascade transitions, thin geometry, alpha-tested foliage, and moving characters in the final camera range.

## Make VFX causal and spatial

Every effect needs an emitter cause, world-space behaviour, collision or occlusion rule where visible, lifetime, lighting/material interaction, audio relationship, and performance tier. Organise effects into layers:

- **primary:** readable gameplay event or hero set piece;
- **secondary:** debris, smoke, sparks, splashes, trails, and impact response;
- **ambient:** dust, insects, drizzle, vapour, distant traffic, embers;
- **surface:** decals, scorch, wetness, ripples, footprints, bullet marks;
- **camera/UI:** restrained shake, exposure response, damage/readability feedback.

For precipitation, model screen coverage and depth distribution separately from world count. Give drops plausible velocity, wind, streak scale, near/far density, shelter or volume collision, impact-derived splashes/ripples, and wet-surface response. Use independent background rain only as a deliberate cheap layer; do not present random timed splashes as proof of physical drop impacts.

Use transparent particles cautiously: overdraw, sorting, alpha noise, and post-processing can dominate cost. Prefer opaque or alpha-tested debris where appropriate, spatial bins or culled emitters, pooled lifetimes, and quality tiers based on measured worst-case concurrency.

## Animate intention and reaction

Gameplay animation needs more than idle/run clips:

- locomotion transitions that match controller acceleration and direction;
- upper/lower-body separation or additive layers when actions overlap;
- weapon/hand alignment and camera-relative recoil without visible sliding;
- anticipation, contact, follow-through, recovery, hit reaction, stagger, death, and interruption rules;
- foot placement or authored contact corrections where the camera exposes mismatch;
- deterministic event markers for footsteps, muzzle events, impacts, and state changes.

Drive gameplay truth from simulation. Let animation present and predict it; do not allow a late animation callback to become the only authority for damage or objective state.

## Treat camera as a game system

Define FOV, sensitivity, acceleration, damping, head motion, recoil, shake, collision, and state transitions. Effects must not steal control or obscure necessary information. Keep camera shake frequency and amplitude tied to distance and event weight. Provide reduced-motion or shake scaling when appropriate.

For first person, inspect weapon silhouette, hand pose, clipping, depth conflict, muzzle exposure, reload framing, sprint transitions, and the relationship between camera recoil and ballistic direction. For third person, inspect shoulder swaps, occlusion, camera collision, target visibility, and aim reticle/parallax.

## Build audio in buses and layers

At minimum separate master, music, ambience, dialogue, effects, weapons, and UI buses. Unlock audio from an intentional user gesture and expose mute/volume controls. Author:

- a continuous ambient identity for each zone;
- near/far and indoor/outdoor variants where the route requires them;
- spatial one-shots with sensible rolloff and concurrency limits;
- weapon/action transients, body, tail, reflection/environment layer, and mechanical detail;
- material-aware impacts and footsteps;
- objective, damage, danger, and completion cues that remain legible without looking at the HUD;
- silence and dynamic-range changes before and after major beats.

Test with headphones and speakers. Verify focus loss, pause, restart, repeated entry, and overlapping emitters do not duplicate or leak audio.

## Keep UI subordinate but complete

Use a small, coherent typography and colour system. The HUD must communicate objective, health/resource state, reticle/context, damage direction or threat where required, interaction prompts, pause/settings, failure, and completion. Avoid debug telemetry in the player composition. Development overlays should be opt-in and visually distinct.

Scale and test at multiple aspect ratios and DPR values. Pointer-lock instructions, capability failures, loading progress, and audio-unlock states are product UI, not temporary scaffolding.

## Reject these common “AI demo” signatures

- a still hero image with no playable route;
- an autoplay camera used to imply a game;
- procedural primitives repeated without authored hierarchy;
- uniform neon, bloom, wetness, fog, or particles applied everywhere;
- large counters presented as visual-quality proof;
- dense scenery with no readable navigation or encounter function;
- generic enemies with no perception, reaction, or resolved state;
- effects that pass through roofs, floors, and characters without a deliberate rule;
- debug panels occupying the composition;
- a technically successful build accepted without live interaction and route evidence.

