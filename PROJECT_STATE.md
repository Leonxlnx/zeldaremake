# PROJECT_STATE

Shared state only. Update when an **integrated** milestone changes (after merge), not per commit.
Per-agent progress lives in `.agents/<agent>.md`; the live picture is the Director's Monitor.

## Phase
**Phase 1 — World** (not complete; completion is declared only by a CI-attested
`gauntlet/reports/verify-exit.json` — see GAUNTLET.md §6) with **Phase 2 (Link) and Phase 3
(HUD) content landed in parallel** since take-0025 so the frames can be compared whole.

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

Round six (`… 9c747d0`) thinned the hollow air so the far arch silhouettes against a luminous
wall, exported the trees' shaft columns to the ray mask, cleared C's stair foot with a
camera-derived wedge, added F's beams and a reference-matched softening. Phase 2/3
(`5b3dc01`, `8774d21`, `8928b71`, `1c864e1`, take-0025): procedural Young Link (tunic, cap, Deku
Shield, Kokiri Sword, 9k tris) with idle/walk/run/stairs gaits, Navi with light and trail, three
Kokiri kids, per-view placement onto the reference's feet marks, play mode (`?mode=play`, P)
with a follow camera; HUD hearts / item slot / hand-drawn minimap and the equipment screen
(`?screen=equipment`, Tab). All six cameras dropped to the reference's child eye height
(1.45–1.5 m), which is what makes Link's screen size match.

## What already works (on the foundation branch, take-0025 @ 1c864e1)
- Whole world renders in real time: authored terrain (lattice-consistent sampler, 6-layer splat),
  18-slab hero stairway + 6-step bank stairs + 4-step house stairs, 669 anisotropic Voronoi
  flagstones with soil joints and sprouts, 3 stratified hero boulders + 2.8k pebbles, 10 white-bark
  variants × 80 instances + 11 giants (authored profiles) + 726 distant trees, ~490k grass blades +
  ferns/flowers/bushes/litter in reference-driven zones, 2 Kokiri houses + 10 pod lanterns +
  signpost + fences + ridged hollow log arch, village props, height fog, ground mist, volumetric
  god rays, falling leaves, motes, HDR post chain with reference-matched softening; Link, Navi
  and three Kokiri kids placed per view; HUD overlay + equipment screen.
- Gauntlet: `take.mjs` end-to-end with hash-chained ledger (25 takes), anti-cheat (36 checks
  green), CI workflows green through `7d41e40`; Director's Monitor live at
  https://rawcdn.githack.com/Leonxlnx/zeldaremake/monitor/index.html with the walkable build
  under `play/`.
- Score: **22/50 (Phase 1: 19/42)**; SSIM A 0.230 / B 0.208 / C 0.253 / D 0.249 / E 0.225 /
  F 0.216; 27 items pending cross-review (C01, C02, U01–U03 among them), 1 failing (W37).

## Biggest visual weaknesses
1. Shot similarity (W37, SSIM 0.21–0.25 vs 0.42): compositions and now the cast are on the
   reference; what is left is texture — plaza slabs are regular ~1 m tiles with thin pale joints
   where the reference has irregular rounded 0.5–0.9 m stones in dark mossy joints; Link reads
   toy-like beside the reference (smooth cap, no fringe/undershirt, small shield swirl).
2. F: top-left shows Saria's roof where the reference has canopy (box lum 0.57 vs 0.46); the
   right bank is sunlit pale grass (0.52 vs 0.31) where the reference has a shaded fern bank and
   an edge trunk. D: the left verge is lavender-pink (hue 11° vs 55°) where the reference has big
   fern fronds. Round seven sub-agents (trees, vegetation, hardscape, character) are on each.
3. One broad F beam where the reference has four; the arch body/haze 0.895 vs 0.746.

## Performance
Hero viewpoints at quality=high: 330–390 draw calls, 5.8–6.7 M triangles (budget ≤ 700 /
≤ 9 M). Capture on 4-core SwiftShader ≈ 8 s/frame; a full take (6 views + det/motion, settle 6)
≈ 8 min locally when the box is idle.

## Next major priorities
1. Owner: merge PR #2 to `main` so the hourly cron + Pages deploy run; enable Pages once;
   decide `gauntlet/RUBRIC_PROPOSALS.md` (W04 house-terrace probe).
2. Round seven (running): F canopy cover + bank shade + edge trunk (trees), D hero ferns + F
   bank cover + joint tufts (vegetation), irregular rounded slabs + tone (hardscape), Link fidelity
   + contact shadows + Navi sparkle (character).
3. Cross-reviews (codex ↔ fable) to convert the 27 pending items.
4. One take per hour until `gauntlet:verify-exit` passes; Phase 2/3 polish continues alongside.
