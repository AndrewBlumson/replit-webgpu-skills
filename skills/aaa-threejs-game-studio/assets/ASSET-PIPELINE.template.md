# Browser asset-production ledger

This is a per-project production record, not a universal optimisation preset. Preserve source masters and raw exports; only validated delivery assets may ship.

Status values: `not-run`, `pass`, `fail`, `blocked`, `needs-user`, `not-applicable`. `needs-user` means the check needs a person or the target device, its card is under "Needs-user checks" in `docs/QA-ROUTE.md` and has been handed to the user, and the result is not yet known; it is never a pass. The asset-lane decision and native-runtime costs apply to every project. Mark GLB-specific gates `not-applicable` with a recorded reason for a fully native Three.js/TSL asset lane; mark Blender-specific fields `not-applicable` when Blender is not selected.

Replit Agent may operate Blender only through a configured, verified MCP connection. Without it, use native code or supplied/licensed assets. For supplied GLBs without source-authoring access, mark live DCC authoring/re-export fields `not-applicable`; retain provenance, delivery optimisation and runtime validation.

## Toolchain contract

- Latest-stable sources checked on:
- Three.js release resolved and project lock evidence:
- Configured Blender MCP identity and verified operations, when used:
- Connected DCC runtime version and asset-manifest evidence, when used:
- MCP export-to-Replit transfer method or supplied-asset source:
- Geometry optimiser and exact project-resolved version:
- Texture encoder and exact project-resolved version:
- glTF validator and exact project-resolved version:
- Checked-in build command/script:
- Raw asset directory:
- Generated delivery directory:
- Manifest/hash output:

## Asset-lane decisions

Choose per asset class. A DCC-to-GLB lane must justify its browser cost against a native Three.js/TSL or hybrid alternative.

| Asset class | Native / DCC-to-GLB / hybrid | Visible requirement | Why this lane wins | Representative acceptance route |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

## Delivery recipes

Use one row per asset class or materially different recipe. Never run destructive transforms without preservation and comparison gates.

| Asset/recipe ID | Raw source/hash | Geometry/instancing/LOD operation | Texture/mip/KTX2 preset | Material/PBR contract | Animation operation | Compression lane | Metadata/proxy preservation | Final hash |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |  |  |

Rules:

- Choose exactly one measured geometry-compression lane; do not stack compression accidentally.
- Use material-aware texture presets and complete mip chains. Treat colour, normals, ORM/masks, alpha, emissive, HDR, decals, and UI as different data classes.
- Preserve silhouette-critical topology, UV/hard-edge seams, tangents, rigs, morphs, sockets, semantic IDs, collision/navigation/raycast proxies, and authored LOD boundaries.
- Keep world partition and culling ownership. Do not merge a playable level into one monolithic GLB.
- Treat raw DCC export as build input, never the final browser asset.

## Before/after evidence

Record both raw and final values from the same representative asset and target route.

| Metric | Budget | Raw | Final | Pass/fail | Evidence |
| --- | --- | --- | --- | --- | --- |
| Transfer bytes |  |  |  |  |  |
| Cold load |  |  |  |  |  |
| Parse/decode/transcode |  |  |  |  |  |
| GPU upload / time to visible |  |  |  |  |  |
| GPU memory estimate |  |  |  |  |  |
| Vertices / visible triangles |  |  |  |  |  |
| Primitives / materials / draw calls |  |  |  |  |  |
| Texture dimensions / mip residency |  |  |  |  |  |
| Animation / skin / morph cost |  |  |  |  |  |
| Culling and LOD behaviour |  |  |  |  |  |
| Unload / disposal recovery |  |  |  |  |  |

## Quality and semantic gates

| Gate | Status | Evidence | Defect/owner |
| --- | --- | --- | --- |
| Raw and final GLB pass the current Khronos validator | not-run |  |  |
| Bounds, pivots, scale, hierarchy, semantic IDs, extras, and proxies survive | not-run |  |  |
| Materials, colour spaces, normal/tangent basis, alpha, and emissive behaviour survive | not-run |  |  |
| Rigs, animation clips, morphs, root motion, events, and looping survive as applicable | not-run |  |  |
| LOD changes preserve silhouette and gameplay truth without objectionable popping | not-run |  |  |
| Final assets load through the project's actual Three.js configuration | not-run |  |  |
| Gameplay-camera comparisons at representative lighting show no unacceptable loss | not-run |  |  |
| Interaction, collision, restart/re-entry, streaming, cancellation, and disposal pass as applicable | not-run |  |  |
| Worst-beat route remains inside the frame, memory, and loading contracts | not-run |  |  |

## Adoption decision

- Accepted delivery recipes:
- Rejected recipes and why:
- Assets moved back to native Three.js/TSL or hybrid representation:
- Open risks and owners:
