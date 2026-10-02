# WebGPU Visual Verification

An uploadable Agent Skill for inspecting WebGPU applications and obtaining
trustworthy screenshots when preview iframe or headless capture omits or
retains an old GPU frame.

## Import into Replit

1. Download `webgpu-visual-verification.zip`.
2. Open **Workspace Settings > Customization > Skills**.
3. Choose **Create skill** and the upload option, then select the ZIP.
4. Review the name and description and save.

The ZIP contains `SKILL.md` at its root, plus this README and the `references`
and `assets` folders. Keep those files with the skill.

If using project-local skills instead, put these contents inside
`.agents/skills/webgpu-visual-verification/`.

Official guidance:
https://docs.replit.com/features/agent/agent-customization

## Contents

- `SKILL.md`: activation triggers and the complete capture-and-review workflow.
- `references/native-webgpu-readback.md`: the actual final-pipeline readback
  method, a Three.js adaptation template, synchronisation and pixel-layout notes.
- `references/evidence-and-troubleshooting.md`: failure classification, evidence
  requirements, reporting fields and examples of accepted and rejected captures.
- `references/scripted-playthrough.md`: driving a game through its
  development-only `window.__qa` hook, route scripts with expectations, and
  reporting a run as a labelled contact sheet.
- `assets/webgpu-readback.js`: the readback template as a ready-to-copy module.
- `assets/contact-sheet.js`: combines labelled captures into one image.

## What is covered

Yes: the native WebGPU render-target readback and temporary Canvas2D presentation
method used to get reliable scene images around the observed screenshot problem.
It includes both stale GPU-frame and stale browser-presentation checks.
When canvas rendering triggers device loss, it also covers fresh-device startup
with offscreen output configured before the first render and retained until
the diagnostic render loop stops. With a game's development-only `__qa` hook
(from the AAA Three.js Game Studio skill), it also covers scripted playthroughs
reported as a labelled contact sheet.

No: a universal fix for preview iframes, unavailable hardware, broken rendering,
browser security restrictions, cross-origin access or real-time performance.
The skill does not switch the application to WebGL or claim that copied pixels
prove the original embedded preview has been repaired.

The Three.js code and the files in `assets` are adaptation references, not an
auto-running plugin. An agent must connect them to the actual application's
renderer and update logic, in development-only code.
This package installs no dependencies and contains no credentials, project URLs,
runtime hooks or application changes.
