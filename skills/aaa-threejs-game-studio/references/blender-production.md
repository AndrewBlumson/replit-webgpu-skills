# Blender production through MCP for Replit

Read this reference only when someone has configured a Blender MCP connection for Replit Agent. Verify that the connection works and exposes the operations needed for the chosen asset class before selecting Blender. A local installation, Python API, or desktop GUI on the user's computer is not sufficient access for Replit Agent. All agent-operated Blender work in this variant goes through the configured MCP tools.

Without a working connection, continue with native Three.js/TSL and supplied or appropriately licensed assets. Importing and optimising existing GLBs does not require Blender. Do not install Blender, launch its command line, use desktop-computer control, or ask for MCP setup as a routine prerequisite to making the game.

Do not use Blender merely because it is available. Compare its delivery result with native Three.js/TSL or a hybrid composition at the real camera and workload. Reject an asset that misses transfer, decode/upload, GPU-memory, draw/material, deformation, culling, or lifecycle budgets. Raw GLB is build input; only the validated, optimised, hashed output may ship. Record the accepted per-asset recipes in `docs/ASSET-PIPELINE.md` and implement them as checked-in project automation rather than a remembered sequence of GUI clicks. In the demo and prototype lanes, which keep no `docs/` documents and no delivery pipeline, record the connection, Blender version, export settings and asset sources in the report instead of `docs/ASSET-PIPELINE.md` or an asset manifest, run the Khronos glTF validator on the exported GLB, and check it at the real camera through the cookbook's "Loading models" setup; the checked-in scripts, delivery pipeline, hashes and the rest of the round trip below start if the project moves to production.

## Verify the configured connection before authoring

Inspect the actual MCP tool inventory; do not invent tool names or assume every Blender MCP server supports Python execution, export, screenshots, or file transfer. Make a bounded read-only query through the connection to confirm the Blender version and reachable scene/session. Record the connection, runtime version/build, supported operations, and export profile in the project's asset manifest without credentials.

Verify how a finished asset will reach the Replit project: supported download/transfer or a user-supplied export. Paths returned by an MCP server belong to its host and are not automatically readable inside Replit. Confirm the required modelling, baking, rigging, animation, and export capabilities before committing to that asset lane.

For a new project or major asset-pipeline rebuild that selects Blender, compare the connected runtime with the latest stable release from official sources and record the resolved project version. Do not freeze a release in this skill or silently install/upgrade the user's MCP server. Record an unavailable required capability and choose another viable asset lane when possible.

If an MCP operation fails or times out, retain the operation, available diagnostics, runtime version and input asset identity. Before retrying a state-changing operation, inspect whether it completed; do not duplicate an uncertain authoring/export action. Make at most one materially different diagnostic retry, then report the Blender-specific blocker and continue independent game work. Do not fall back to local shell launches.

## Choose the right execution mode

When the configured MCP exposes Blender Python execution, prefer checked-in scripts submitted through that tool for deterministic and repeatable work such as:

- collection and metadata validation;
- transform, naming, pivot, UV, and topology checks;
- procedural generation whose parameters belong in source control;
- baking, LOD preparation, collision/proxy generation, and batch processing;
- versioned GLB export and manifest emission;
- fixed-camera preview renders used for asset comparisons.

Otherwise use the MCP's supported operations and retain a reproducible operation recipe. Do not assume a generic Python or shell tool in Replit can reach Blender. Use explicit server-side input/output paths, preserve editable masters, and write generated artefacts only to owned build directories. Scripts should be idempotent where practical and return a compact result that can be retained as evidence.

Use previews returned by the MCP, when available, for intermediate visual judgement. Replit Agent does not directly operate Blender's desktop GUI. If an essential manual authoring step is outside the connection's capabilities, use a supplied asset or state the specific user handoff needed. Save or retain the `.blend` master through the connection where supported, and verify the exported result in the actual Three.js scene.

Do not require Cycles or a particular compute device for ordinary GLB export. Select and verify CPU/GPU rendering or baking only when the authored recipe actually needs it.

## Bind a Blender-to-GLB export profile

Use glTF/GLB as the runtime interchange unless the project has measured evidence for another format. Store export settings in checked-in Python or a versioned project recipe; do not rely on remembered GUI state.

For every asset class, decide and test:

- export scope: named collection, selected objects, visibility, and whether children are included;
- evaluated modifiers, Geometry Nodes realisation, curves/text conversion, transforms, units, axes, origins, and pivots;
- normals, tangents, hard edges, UV sets, vertex colours/attributes, morphs, skins, and influence limits;
- a supported Principled metal/rough PBR graph, alpha mode, double-sided state, emissive strength, texture transforms, and required glTF material extensions;
- baking or TSL re-authoring for Blender procedural nodes and other unsupported material behaviour;
- animation mode, named actions/NLA tracks, frame ranges, sampling, looping, root motion, shape keys, and event metadata;
- schema-owned custom properties exported as `extras`, with stable semantic IDs rather than fragile display names;
- whether cameras, lights, unused data, GPU instances, and compression are included; default them off unless the runtime contract consumes them;
- embedded versus external textures and the raw-to-KTX2 delivery stage;
- exactly one measured geometry-compression path so Blender export and later offline transforms do not accidentally double-compress or destroy metadata.

Export a structurally simple raw GLB first, then run the checked-in browser-delivery pipeline. Let the broader asset recipe own Meshopt/Draco selection, KTX2 conversion, LOD transformation, validation, comparison, hashing, and final delivery. Preserve an unmodified DCC master and raw export so destructive transforms are reproducible and reversible.

## Retain production evidence

Keep, as applicable:

- editable `.blend` master and linked-library dependencies;
- checked-in generation, validation, baking, and export scripts;
- MCP connection identity, reported Blender/tool versions, supported operations, export configuration, and asset-transfer method;
- raw GLB, final delivery asset, schema sidecar, provenance/licence entry, and content hashes;
- validator output and fixed-camera or diagnostic comparisons;
- target-camera Three.js import capture and workload/load evidence.

A repeated export must preserve semantic IDs, bounds, materials, animation clips, and gameplay proxies. Do not demand a byte-identical GLB unless the tested exporter is deterministic; compare semantic manifests and rendered output, then record the produced hash.

## Require a Three.js round trip

A successful Blender save or export is not acceptance. For each representative asset class:

1. open or build the `.blend` through the configured MCP using the recorded toolchain;
2. export through the MCP using the checked-in script or versioned profile, then transfer the result into Replit;
3. run the Khronos glTF validator and the project's semantic checks;
4. inspect materials, normals/tangents, UV density, bounds, origin/pivot, hierarchy, animation/skin/morphs, extras, and collision/navigation proxies;
5. load the final asset through the project's actual latest-stable Three.js loader configuration;
6. compare it at the real gameplay camera and lighting, plus diagnostic material and wire/proxy views;
7. exercise animation, interaction, collision, LOD, restart/re-entry, loading, and disposal where applicable.

Only the live Three.js result can prove that a Blender-authored asset serves the game. A viewport render, successful script, valid GLB, or attractive turntable is supporting evidence rather than product acceptance.
