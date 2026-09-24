---
agent: vertical-jitter
runtime: Codex subagent; CPU-only locomotion diagnostics
github: Leonxlnx
status: finished
branch: codex/walk-arms-sept24
updated: 2026-09-24T18:47:30Z
---

Root delegated the walking/running body shiver. Owns only the deterministic
pelvis-height correction in `glbLink.ts` and evidence under
`art/characters/link/progress/2026-09-24-run-jitter/`. Root retains Blender,
the GLB, arm constants, speeds, captures and integration. Coordination is through
the parent agent; no branch switch, commits, pushes or GPU captures by this agent.

Authored pelvis translation contains narrow handover notches. The phase-based
lower envelope removes those notches before the existing IK while keeping ankle
targets. Typecheck passed; matched CPU flat/slope/uneven checks passed, with
idle/stair traces exact and zero-dt unchanged. Gait transitions and 128 jump
boundaries pass; jump entry/exit has no added height discontinuity (5.55e-17 m).
Independent review found the jump boundary issue, now repaired by a continuous
crouch/landing taper. Final tested runtime SHA is
`992071967117baaa5d4db18ae4e6e2af3b546c955cb19e66be341f96fe19bc69` against
final composite GLB `aa0520e0d7aaedcc452103ad14c81113866ff3c5adbd5307fdcedf711a248c89`.
The final-asset replay passes all assertions with identical measured body-step
and jump-boundary values. Source was not edited during this replay.
See the study README and regression.json for measured limits. The steep-slope
support transitions are still visible; no claim of complete motion acceptance.
