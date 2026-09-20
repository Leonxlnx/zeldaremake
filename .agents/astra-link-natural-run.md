---
agent: astra-link-natural-run
runtime: Codex Astra + Blender MCP
github: Leonxlnx
status: active
branch: agent/astra-link-natural-run
updated: 2026-09-20T19:21:00Z
---

# Astra — natural run

Owner priority: temporarily hide background characters; correct Link's outward calf/boot shape and inspect running arm carriage, legs and posture. Owns `src/world/character/`, the Link runtime asset and `art/characters/link/progress/2026-09-20-natural-run*` in this isolated worktree. Fable notified on PR #2 (comment 5751521192); environment agents retain their separate lanes.

Baseline is runtime SHA256 `382ec9ecab9f77062b61c77192ada4df860abc33666284d8971abe1e577492eb`, imported into a separate Blender scene at 24 fps. Existing scenes and the primary dirty checkout are preserved.

Completed: d679e7ee hides background NPCs and their shadows/fairies, and fixes zero-dt arm filtering. Six advancing-motion traces remain identical. Native baseline shows mesh lateral offset outside the leg rig; flat runtime knee swivel is inactive.

Adopted locally: ea93932d native leg/arm candidate, 13,492 lower-leg vertices aligned and four run rotation channels refined. Five matched native pairs; actual 300-frame walk/run/idle video and 1,320 stair frames complete without errors or reach clamps. The first every-tenth-frame contact sample missed brief swing intersections; the dense run records -67 mm at down449. Native arm/body contacts decrease but remain. Final export preserves rig, weights, UVs, morphs, other clips and original binary prefix. Build index-CmdsTdmx.js passes; frozen preview61025 serves the exact default model and loader digest. See the natural-run README for evidence and limitations.

Environment atlas correction was merged from b89eae66; both concurrent claims were retained, neither ledger changed. Fable pebble/atlas diagnostic sent in PR2 comment5751697208. The tree agent runs an isolated paired bark-material experiment; Fable trees-32 geometry stays outside this branch's scope.

Support correction reviewed: an existing pin was shifted again for vertical support, then restored horizontally. Reuse its actual X/Z and include all rendered footprint corners. Dense native capture 2026-09-20T19-07-51-558Z-play-motion (bundle index-Cfkbva13.js) reduces frame477 root step +60.37 to -5.95 mm and the descent maximum to 19.79 mm. 1,320 frames, no page errors or reach clamps; served asset/hash verified, one aborted duplicate GLB request disclosed. CPU baseline fails the focused regression and working source passes; flat hashes and knee maxima unchanged. Still active: the swinging-foot hip correction introduces intersections at descent274/449, and peak knee bends remain 162/155 degrees. The audit agent is tracing the final rotated footprint; do not call posture solved. Synthetic-stair penetration is a distinct route. GPU captures use the shared slot; Blender studies use four CPU threads. Native .blend studies and rejected candidates are preserved locally.
