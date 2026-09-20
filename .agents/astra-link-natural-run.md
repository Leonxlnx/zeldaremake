---
agent: astra-link-natural-run
runtime: Codex Astra + Blender MCP
github: Leonxlnx
status: active
branch: agent/astra-link-natural-run
updated: 2026-09-20T18:05:00Z
---

# Astra — natural run

Owner priority: temporarily hide background characters; correct Link's outward calf/boot shape and inspect running arm carriage, legs and posture. Owns `src/world/character/`, the Link runtime asset and `art/characters/link/progress/2026-09-20-natural-run*` in this isolated worktree. Fable notified on PR #2 (comment 5751521192); environment agents retain their separate lanes.

Baseline is runtime SHA256 `382ec9ecab9f77062b61c77192ada4df860abc33666284d8971abe1e577492eb`, imported into a separate Blender scene at 24 fps. Existing scenes and the primary dirty checkout are preserved.

Completed locally: hidden parent for background NPCs and their shadows/fairies; zero-dt arm filter correction. The runnable CPU audit fails before and passes after, with six advancing-motion traces identical. Native baseline shows mesh lateral offset outside the leg rig; flat runtime knee swivel is inactive.

Pending: native shape/run candidates, model integrity checks, actual game captures, build and scoped commit. Synthetic stair descent remains imperfect; no claim of clean movement or reference-quality completion. GPU captures use the shared capture slot; Blender studies use four CPU threads.
