# Authored world and asset-production pipeline

The runtime cannot manufacture AAA presentation from weak or unstructured source assets. Treat DCC masters, export contracts, optimisation, delivery, streaming, and visual validation as one versioned pipeline.

For this Replit skill, Blender authoring requires a configured, working Blender MCP connection. Read `blender-production.md` to verify that connection before selecting Blender. Without it, use native Three.js/TSL or supplied/licensed delivery assets; importing a GLB does not require Blender access.

## Choose the asset lane before authoring

Three.js is the runtime; Blender and other DCCs are optional content-production tools. Do not introduce a DCC or GLB by habit. Choose a lane for each asset class and record why:

GLB and Three.js are not competing runtimes. Blender stays offline, and `GLTFLoader` turns a delivery asset into Three.js runtime objects. Choose according to authored quality and measured delivery/runtime cost, not the filename alone.

- **Native Three.js/TSL:** prefer code-built `BufferGeometry`, instancing, GPU storage/compute, signed-distance or node-driven forms, and procedural placement for parametric structures, large repeated sets, terrain/detail fields, particles, weather, and content whose runtime variation matters more than unique authored topology.
- **DCC-authored delivery asset:** use supplied or appropriately licensed assets for bespoke silhouettes, sculpted/baked detail, authored modular architecture, rigs, skinning, morphs, and animation. Create or re-export them in Blender only through a verified Blender MCP connection; do not assume Replit can operate a local DCC.
- **Hybrid:** keep gameplay layout, repetition, variation, LOD choice, effects, and material state under Three.js while instancing or composing small validated DCC-authored modules.

Compare representative candidates at the real gameplay camera. Measure transfer bytes, cold load, parse/decode/transcode, GPU upload, triangles/vertices, texture residency, draw/material count, animation/skin cost, culling granularity, and disposal. Include authoring speed and visible quality in the decision. Reject a GLB when a native representation is visibly equivalent and materially cheaper, or when it cannot meet the route budget after optimisation.

Do not assume code-built geometry is free. Apply the same gates to native assets, including JavaScript/data payload, generation time, main-thread stalls, allocations, GPU upload, draw submission, shader warm-up, memory, culling, and disposal.

## Asset contract and provenance

Maintain an asset registry or generated manifest with:

- stable semantic ID and asset class;
- source/master path and export path;
- author/source URL, licence, attribution, and modification permission;
- units, coordinate/orientation contract, bounds, pivot, and intended scale;
- render LODs and screen/error thresholds;
- collision, raycast, navigation, shelter/exposure, audio, and interaction proxies;
- material/texture family, colour spaces, UV/tangent requirements;
- skeleton, animation clips, root-motion/event conventions;
- dependencies, zone/cell membership, priority, and unload ownership;
- byte size, triangle/vertex/material/draw estimates, texture dimensions/mips;
- content hash and exact tool/version/recipe that produced the delivery asset.

Do not ship assets with unknown or incompatible rights. A public demo or repository without a licence is study material, not reusable source. Keep proprietary reference assets out of the project.

## DCC authoring rules

For authoring through an available tool connection, bind and validate the following. When importing supplied assets without access to their authoring environment, inspect the exported result and record unavailable source-authoring evidence rather than requiring Blender setup:

- metres as the gameplay unit, consistent world up/forward, and applied scale where the rig/pipeline allows it;
- meaningful origin/pivot for placement, doors, weapons, wheels, interactions, and LOD swaps;
- stable names/IDs for sockets, spawn points, collision proxies, light anchors, audio emitters, and gameplay markers;
- clean normals/tangents, deliberate hard edges, non-degenerate topology, and no accidental duplicate faces;
- UV0 for surface textures and explicit additional UV sets only where their consumer is defined;
- texel-density bands by hero/standard/background asset class;
- modular seams, grid/kit rules, trim sheets, decal policy, and damage/variation attachments;
- separate render, collision, raycast, nav, occluder, and shelter/exposure geometry;
- animation clip ranges, skeleton identity, root bone, looping, additive/reference pose, and event metadata;
- transform/hierarchy rules that survive glTF export and offline optimisation.

Export authored cells and prefabs, not one monolithic world file. Partition by route, visibility, ownership, streaming, and iteration needs. Keep dynamic gameplay/highlight content separate from the mostly static base layer.

## Metadata must survive destructive tools

Geometry optimisers may merge, prune, reorder, quantise, resample, rename, or discard unknown data. Do not key gameplay state by vertex order or fragile mesh names. Keep objectives, spawns, triggers, cover, checkpoints, streaming bounds, shelter volumes, and other authoritative gameplay data in a typed schema-validated sidecar or a deliberately owned glTF extension/extras schema.

After every transform, test semantic round-trip as well as glTF validity. Preservation flags are part of a recipe, not proof that the gameplay contract survived.

## Reproducible offline transform graph

Use glTF/GLB as the runtime interchange for assets that genuinely need a DCC-authored lane unless the project has a measured reason for another format. Do not turn that recommendation into a requirement that every object or level be a GLB. Keep editable DCC masters separate from generated delivery assets, and never treat a raw authoring export as the shippable file.

Build explicit per-asset-class recipes rather than one global “optimise” command. A typical graph is:

1. export and validate raw glTF;
2. inspect counts, bounds, materials, animations, extensions, and metadata;
3. deduplicate/prune only under the preservation contract;
4. resample/compress animation where visual comparison permits;
5. create or import authored LODs with protected seams/attributes;
6. reorder/quantise/compress geometry with a pinned tool;
7. resize/channel-pack/encode textures with material-aware presets;
8. validate the result and semantic sidecars;
9. compare visuals, animation, collision, and LOD transitions;
10. emit the versioned manifest and content hashes.

Pin Node/npm and native encoder versions or use a controlled build image. A lockfile does not pin external native tools by itself. Keep clean-build manifests comparable in CI.

## Geometry compression and optimisation

For a new current-release pipeline, evaluate Meshopt as the integrated default because it can retain GPU-friendly ordering and cover geometry, morph, animation, and instance data. Confirm the latest stable Three.js `GLTFLoader` extension support against the resolved project release; compression-extension ecosystem constraints still require testing with the exact toolchain and distribution targets.

Treat Draco as an alternative measured size/compatibility lane, not an automatic second compression layer. Draco is geometry-focused and may change vertex identity/order. Compare compressed size, decode/startup time, memory, visual error, and compatibility before choosing.

Do not optimise only for file size. Also measure:

- vertex-cache and fetch efficiency;
- draw/material splitting;
- decode/transcode and upload time;
- runtime GPU memory;
- shader/material variation;
- collision and raycast representation;
- LOD transition quality.

GPU mesh baking or atlas baking is valuable for static hero props, scans, background assemblies, and authored LODs when it reduces geometry/material cost within a surface-error target. It destroys hierarchy/rig/animation semantics and may emit uncompressed textures. Do not bake characters, interactive assemblies, or the whole playable world into one asset. Run the baked output through the same texture/delivery gates.

## LOD, instancing, batching, and culling

Create LODs from screen-space or normalised geometric error and the gameplay camera envelope, not arbitrary triangle percentages or distance alone. Protect borders, normals/UV seams, silhouette-critical features, sockets, and deformation quality. Record error and bounds in the manifest.

At runtime:

- use hysteresis or transition blending to prevent flicker/pop;
- prevent LOD changes from altering collision, objective, or cover truth;
- load a low-detail proxy first where it improves time to controllable;
- retain hero silhouettes and animation readability longer than background detail;
- test rapid approach, retreat, strafing, camera cuts, and high-contrast edges.

Use instancing for genuinely repeated geometry/material variants. Batch only within compatible cells, visibility groups, material families, shadow behaviour, and lifetime ownership. World-wide merging or batching damages culling, streaming, iteration, and interaction.

Three.js frustum culling works at object bounds, so object granularity matters. Use `three-mesh-bvh` or a dedicated spatial structure for accelerated static collision/raycast/spatial queries where needed; dynamic skinned/deforming geometry needs a different strategy or measured refit. Do not assume a BVH automatically provides occlusion culling or dynamic physics.

## Texture and material delivery

Track texture semantics explicitly: base colour/emissive use colour-space metadata; normals, roughness, metalness, occlusion, masks, and data fields remain linear. Validate tangent basis and channel packing after every transform.

Use KTX2/Basis with material-aware recipes and complete mip chains:

- ETC1S is a strong starting point for many colour textures where artefact checks pass;
- UASTC is a strong starting point for normals, ORM/masks, hero detail, and artefact-sensitive data, accepting larger delivery cost;
- alpha, gradients, decals, UI, HDR/environment, and high-frequency masks need their own tests;
- size/dimension tiers should follow visible texel density, not source-file habit.

These are starting recipes, not universal truths. Compare decoded appearance, block artefacts, normal length/direction, banding, colour, memory, transcode time, and supported GPU format on target devices.

Configure one shared `KTX2Loader` after `await renderer.init()`, call `detectSupport(renderer)`, set a measured worker limit, and dispose it at app teardown. Each extra active KTX2 loader brings another transcoder/worker pool. Configure one shared `GLTFLoader` service with the KTX2, Meshopt, and optional Draco decoders before any asset requests.

## Streaming and world partition

A compact authored level may only need staged preload plus zone cells; a large traversable world needs a real scheduler. Separate:

- **critical set:** player, controller, first vista, collision, first encounter, essential audio/UI;
- **near-future set:** next cells and encounter assets prefetched from route/velocity/portal knowledge;
- **background set:** distant visual proxies;
- **optional set:** quality-tier detail and rare variants.

Use independent bounded queues for download, decode/transcode, GPU upload, and activation. Prioritise by visibility, projected error/screen density, route prediction, and gameplay urgency. Track bytes as well as item count. Support abort/cancellation and explicit unload/disposal.

For a large hierarchy, adopt proven ideas from tiled renderers: hierarchical bounds, screen-space-error traversal, request/parse queues, byte-aware LRU cache, backpressure, and starvation telemetry. Do not import a geospatial 3D Tiles dependency into a compact level unless its data model is actually needed.

Progressive glTF/texture delivery is promising, including Needle’s screen-density approach and low-detail raycast proxies. Reject packages that require a WebGL runtime path. Treat other prerelease candidates as prototypes behind a flag until current stable native WebGPU, worker, teardown, poor-network, cache, and memory tests pass.

## Collision, navigation, and gameplay proxies

Do not derive runtime gameplay truth from full visual meshes by default. Author low-complexity, stable proxies for:

- static/dynamic collision and character traversal;
- bullets/raycast/line of sight;
- navigation and off-mesh links;
- triggers, objectives, checkpoints, hazards, ladders, mantles, doors;
- cover slots and tactical anchors;
- shelter/exposure, reflection eligibility, audio zones, and effects surfaces.

Give proxies visible development views and schema validation. Test them after optimisation because transform/pivot/scale mistakes can separate proxies from visuals.

## Lighting and reflection production

Use baked/static/environment contribution as the stable base where interaction does not require live updates. Add a measured dynamic sun/CSM, selective character/set-piece shadows, and a limited practical-light vocabulary. Every moving shadow caster and cascade consumes real route budget.

Planar reflection is another scene render with target, sample, and mip costs. Reserve it for a few hero surfaces or one carefully composed plane. Use probes/environment/SSR/rough approximations elsewhere. Wetness must still exist in albedo/roughness/normal/state; do not make a reflector the entire wet-surface model.

## Asset QA and release delivery

For each recipe and representative asset class, retain:

- glTF validator output before and after;
- semantic-contract/schema result;
- fixed-camera image comparisons and diagnostic channel views;
- animation/skin/morph comparison;
- collision/nav/raycast alignment;
- LOD transition capture and error thresholds;
- cold and warm load/decode/upload timing;
- CPU/GPU memory and renderer workload deltas;
- tool versions, command/config, hash, licence/provenance.

Serve production builds with content-hashed imported assets and immutable caching. Give HTML/manifests and unhashed public assets an explicit version/cache policy. Verify content types, range/CORS behaviour where needed, base/deep paths, cold network, cache update, and the complete deployed gameplay route. A dev or preview server is not deployment proof.
