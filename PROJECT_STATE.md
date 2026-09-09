# PROJECT_STATE

Shared state only. Update when an **integrated** milestone changes (after merge), not per commit.
Per-agent progress lives in `.agents/<agent>.md`; the live picture is the Director's Monitor.

## Phase
**Phase 1 — World.** Not complete. (Completion is declared only by a CI-attested
`gauntlet/reports/verify-exit.json` — see GAUNTLET.md §6.)

## Latest integrated milestone
`main` = empty repository (initial commit). The Phase 1 foundation is on branch
`cursor/kokiri-world-phase1-f65e` (PR pending): scaffold, contracts, rubric, gauntlet tooling,
monitor site, first content passes.

## What already works (on the foundation branch)
- Vite + Three.js r186 world boots, free dev camera, 6 saved reference viewpoints (keys 1–6).
- Authored heightfield with plateaus/terraces/stair ramps/path flattening; 18-step hero stair.
- Headless capture of every viewpoint with SwiftShader (`npm run capture`), audit rollup.
- 50-item hash-locked rubric; anti-cheat rules documented.

## Biggest visual weaknesses
Everything — all systems are placeholder massing until the content passes land. In order of
impact: stairs/flagstones geometry, trees (white-bark port + giants), grass density, house +
lanterns, god rays + haze layering, ground materials.

## Performance
Scaffold: ~130 draw calls, 0.07 M triangles at 1280×720 (meaningless until content lands).
Budget per hero viewpoint at quality=high: ≤ 700 draws, ≤ 9 M triangles (rubric W38).

## Next major priorities
1. Land the foundation PR so CI (gauntlet + hourly monitor) starts running on `main`.
2. Content passes per system (see ownership map in AGENTS.md).
3. Reference comparison loop — one take per hour, both agents.
