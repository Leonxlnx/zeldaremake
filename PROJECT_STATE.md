# PROJECT_STATE

Shared state only. Update when an **integrated** milestone changes (after merge), not per commit.
Per-agent progress lives in `.agents/<agent>.md`; the live picture is the Director's Monitor.

## Phase
**Phase 1 — World.** Not complete. (Completion is declared only by a CI-attested
`gauntlet/reports/verify-exit.json` — see GAUNTLET.md §6.)

## Latest integrated milestone
`main` = empty repository (initial commit). Everything below is on branch
`cursor/kokiri-world-phase1-f65e` (PR #2, draft): foundation + first full content pass on every
world system + gauntlet tooling + Director's Monitor. Second agent (`codex`) contributes via
PRs #3 (props) and #4 (vegetation) targeting that branch.

## What already works (on the foundation branch, take-0002 @ 73a9fdf)
- Whole world renders in real time: authored terrain (318k verts, 6-layer splat), 18-slab hero
  stairway + 474 Voronoi flagstones, 3 hero boulders + 2.8k pebbles, 10 white-bark variants ×
  80 instances + 9 giants + 680 distant trees, 500k grass + ferns/flowers/bushes/litter, 2 Kokiri
  houses + 10 pod lanterns + signpost + fences + hollow log arch, village props, height fog,
  ground mist, volumetric god rays, 96 falling leaves, 180 motes, fairy, HDR post chain.
- Gauntlet: `take.mjs` end-to-end with hash-chained ledger, anti-cheat (20 checks green on
  take-0002), CI workflows; Director's Monitor live at
  https://rawcdn.githack.com/Leonxlnx/zeldaremake/monitor/index.html
- Score: **19/50 (Phase 1: 19/42)**, 24 items pending cross-review, 7 failing
  (W01/W02/W10/W32/W37 + Phase 2/3 items).

## Biggest visual weaknesses
1. Shot similarity (W37, SSIM 0.12–0.18 vs 0.42): composition still differs — stairs sit
   further left/wider than the reference in A, log arch mostly hidden in D, upper third darker
   than the reference's bright haze. (Shot A's centre is now the hedge the reference shows,
   not Saria's doorway — fixed at `0755390`.)
2. Far hills untextured grey; only 2 far depth layers in D (W32).
3. Grade cooler/flatter than the reference's olive/khaki + deep cool shadows; shafts soft.
4. Canopy cards read as large flat leaves near the camera; stone tones too uniform.

## Performance
Hero viewpoints at quality=high: 350–390 draw calls, 5.9–6.3 M triangles (budget ≤ 700 /
≤ 9 M). Capture on 4-core SwiftShader ≈ 8 s/frame; a full take (6 views + det/motion, settle 8)
≈ 8 min locally.

## Next major priorities
1. Owner: merge PR #2 to `main` so the hourly cron + Pages deploy run; enable Pages once.
2. Landed: terrain sampler = rendered mesh, atmosphere GLSL fixes, canopy/limb composition,
   shot-A hedge. Next: stair placement/width for A, brighter upper haze, log arch visibility
   in D, canopy crowns darker under haze from F.
3. Cross-reviews (codex ↔ fable) to convert the 24 pending items.
4. One take per hour, both agents, until `gauntlet:verify-exit` passes.
