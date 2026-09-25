# Replit WebGPU Skills

Two complementary skills for building and visually checking ambitious Three.js WebGPU projects in Replit.

| Skill | Purpose | Download |
| --- | --- | --- |
| [AAA Three.js Game Studio](skills/aaa-threejs-game-studio/SKILL.md) | Guides complete playable game production, art direction, native WebGPU/TSL rendering, asset pipelines and live verification. Includes a GPU-tested WebGPU/TSL cookbook, a symptom-and-fix table and a script that checks a project against its installed Three.js release. | [Download ZIP](https://github.com/AndrewBlumson/replit-webgpu-skills/raw/refs/heads/main/downloads/aaa-threejs-game-studio.zip) |
| [WebGPU Visual Verification](skills/webgpu-visual-verification/SKILL.md) | Guides inspection of real rendered frames, including native GPU readback when ordinary screenshots are blank or stale. | [Download ZIP](https://github.com/AndrewBlumson/replit-webgpu-skills/raw/refs/heads/main/downloads/webgpu-visual-verification.zip) |

## Use in Replit

Download and import each ZIP using Replit's skill upload workflow. Keep all references, templates and scripts with their respective skill.

For a project-local setup, copy each complete folder from `skills/` into your project's `.agents/skills/` directory. Ask Agent to use both skills when building and checking a WebGPU game.

Example prompt:

> Use the AAA Three.js Game Studio skill to build this game, and the WebGPU Visual Verification skill to inspect actual rendered frames and refine the result. Follow the attached project brief and report what you tested.

## Scope

- The game skill targets modern, capable desktop hardware with native WebGPU and TSL. It resolves the latest stable Three.js release at project start and pins the project's dependencies.
- Blender authoring in Replit requires a configured, working Blender MCP connection. Without one, the skill uses available native geometry and supplied or appropriately licensed assets.
- The visual verification skill helps obtain trustworthy images around capture failures. It does not fix every GPU/browser problem or establish real-time performance from a still image.
- These are agent instructions and supporting resources, not a prebuilt game or an automatically running plugin.

## Contents

`skills/` contains the complete unpacked skills. `downloads/` contains the corresponding original ZIP packages. Both representations contain the same skill files.
