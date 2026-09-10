# PROJECT_STATE

Shared state only. Update when an **integrated** milestone changes (after merge), not per commit.
Per-agent progress lives in `.agents/<agent>.md`; the live picture is the Director's Monitor.

## Phase
**Phase 1 — World.** Not complete. (Completion is declared only by a CI-attested
`gauntlet/reports/verify-exit.json` — see GAUNTLET.md §6.)

## Latest integrated milestone
`main` = empty repository (initial commit). Everything below is on branch
`cursor/kokiri-world-phase1-f65e` (PR #2, draft): foundation + five content rounds on every
world system + gauntlet tooling + Director's Monitor + walkable build. Second agent (`codex`)
contributed via PRs #3 (props) and #4 (vegetation) targeting that branch; offline since
2026-09-09 12:23 UTC.

Round five (`d058c08` … `2d40a2d`, 2026-09-10) re-laid the world to the six reference frames
themselves: every camera is now a matched composition (E = the held B camera of frame 24 s,
F = eye level dead up the stair axis of frame 8 s), the log arch sits 47 m out on a 5.6 m rise
at the reference's screen span, the north path runs level through the misty hollow with the small
steps climbing a boulder bank west of it, two giants supply the reference's edge trunks and
centre tree, Saria's roof is a leaf-shrouded crown with a dark vestibule doorway, the plaza got
its eastern paved lobe, the hedge no longer hides the door, and the atmosphere renders
single-scattering god rays with a darker anti-sun haze.

## What already works (on the foundation branch, take-0021 @ ca263ff)
- Whole world renders in real time: authored terrain (lattice-consistent sampler, 6-layer splat),
  18-slab hero stairway + 6-step bank stairs + 4-step house stairs, 669 anisotropic Voronoi
  flagstones with soil joints and sprouts, 3 stratified hero boulders + 2.8k pebbles, 10 white-bark
  variants × 80 instances + 11 giants (authored profiles) + 726 distant trees, ~490k grass blades +
  ferns/flowers/bushes/litter in reference-driven zones, 2 Kokiri houses + 10 pod lanterns +
  signpost + fences + ridged hollow log arch, village props, height fog, ground mist, volumetric
  god rays, falling leaves, motes, fairy, HDR post chain.
- Gauntlet: `take.mjs` end-to-end with hash-chained ledger (21 takes), anti-cheat (30 checks
  green), CI workflows green through `7d41e40`; Director's Monitor live at
  https://rawcdn.githack.com/Leonxlnx/zeldaremake/monitor/index.html with the walkable build
  under `play/`.
- Score: **19/50 (Phase 1: 19/42)**, 26 items pending cross-review, 5 failing
  (W37 + the four Phase 2/3 items).

## Biggest visual weaknesses
1. Shot similarity (W37, SSIM 0.17–0.25 vs 0.42): compositions are on the reference; what is
   left is tone/texture — our shafts are soft slabs where the reference has 3–5 crisp beams, the
   far log arch reads as a pale ghost instead of a dark silhouette (haze at 47 m too dense), the
   plaza lacks the full lit/shadow split — plus the reference's Link/Kokiri/HUD occupying
   10–15 % of every frame (Phase 2/3).
2. Shot C's stair foot still hidden by foreground ferns 1–3 m from the camera (vegetation fix
   running); F's top-left is Saria's roof where the reference has canopy.
3. Slab outlines straight-edged (reference lobed); stone shadow cast cooler in the reference.

## Performance
Hero viewpoints at quality=high: 330–390 draw calls, 5.8–6.7 M triangles (budget ≤ 700 /
≤ 9 M). Capture on 4-core SwiftShader ≈ 8 s/frame; a full take (6 views + det/motion, settle 6)
≈ 8 min locally when the box is idle.

## Next major priorities
1. Owner: merge PR #2 to `main` so the hourly cron + Pages deploy run; enable Pages once;
   decide `gauntlet/RUBRIC_PROPOSALS.md` (W04 house-terrace probe).
2. Round six (running): F shaft corridors + plaza sun cores + D path light (trees), far-arch
   silhouette contrast and crisper beams (atmosphere), C foreground + F flank grass (vegetation).
3. Cross-reviews (codex ↔ fable) to convert the 26 pending items.
4. One take per hour, both agents, until `gauntlet:verify-exit` passes; then Phase 2 (Link).
