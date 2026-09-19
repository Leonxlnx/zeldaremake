---
agent: fable-4
runtime: Cursor Cloud Agent (Claude Fable 5.1)
github: Cursor Agent <cursoragent@cursor.com>
status: active
branch: agent/fable-4-whitebark
updated: 2026-09-19T11:40:00Z
---

# fable-4 — work log

White-bark tree lane (Verdant Forest port), onboarded 2026-09-19 from
`docs/ONBOARDING_FABLE_CHATS.md` (Chat 3). Base: `origin/cursor/kokiri-world-phase1-f65e` at
`d06e275` (world tree = take-0116's `973a21e`). Draft PR #15 targets that branch; fable-cursor /
the owner merge and seal — I do not merge, do not touch `gauntlet/ledger.json` or
`gauntlet/rubric.json`.

## Current task
Delivered (PR #15, `80fab20`) and waiting for fable-cursor's merge / review: survey-2 #31
(`sn-whitebark-base`: painted birch tiling, ~1 m repeat, no root flare) and the onboarding
block's crown item (layered leaf silhouettes at 3–10 m). Targets W08 (≥ 8 real variants, better
than Verdant's), W11 (laminae), W12 (bases within 3 cm), W37/W38 budgets. Evidence with per-pose
verdicts: `art/environment/round47-whitebark/README.md`.

Verdicts (round-46 rule): #31 **PASS** at the survey pose; toes seated on the terrain **PASS**
(`f4-mature-relief`, where the round-46 buttresses hung in the air); crown item **marginal** —
more per-leaf tone variation, sd of the lobe region unchanged (21.2 → 21.0); the from-below level
is the material's (see Known issues).

## Files / systems being touched
`src/world/trees/whitebark.ts`, `src/world/trees/bark-texture.ts` (the lane). One line + one
import in `src/world/trees/index.ts` (the hook that adds the terrain-seated root mesh under the
`white-bark` group) — asked for in the INBOX, kept in its own commit so fable-cursor can drop or
re-add it. Nothing else in `src/world/trees/` (giant, column, bole, distant, placement,
nearCanopy, materials, index otherwise) is edited.

## Completed work (branch `agent/fable-4-whitebark`, PR #15)
- `bark-texture.ts`: the tile is 512 × 2048 and spans `WHITE_BARK_TILE_M` = 2.4 m along the stem
  (was 1 m — the survey's "~1 m vertical repeat" was the tile itself). Second octave: 0.5–1.5 m
  tonal zones, paper seams with a lifted edge / shadow line / warm inner bark, 4–5 dark lenticel
  bands (clustered scars over a ragged wrap-safe underlay, cracks across), lens-shaped lenticels,
  6 skewed ragged knots with a callus rim and a moustache smear. The painter is pure
  (`paintWhiteBark`, no DOM) so the tile can be rendered offline; mean sRGB luminance 203/255.
- `whitebark.ts`:
  - dense trunk rings (18 cm below 3 m) on the SAME polyline — `sample(trunk, t)` for every
    branch is untouched; a sharp butt flare (+88 % at the ground line, e-fold 14 cm × girth) and
    fluting: each toe continues up the foot as a ridge (+21 %), hollows −10 % shaded;
  - bark tile mapping per variant: v rescaled to the 2.4 m tile with a 0.92–1.08 stretch and an
    offset, u offset + spiral shear (0.10–0.17 wraps/m) so no mark stacks above itself; the side
    leaders share the tile at the trunk's scale;
  - per-vertex sooty foot (near-black, ragged margin, 0.35–0.65 m × girth) and 2–4 dark lenticel
    bands (6–14 cm, wandering ± 6 cm around the stem) in the vertex colour;
  - peeling paper curls (near LOD): 1–17 scrolled strips at 0.9–4.2 m read off the finished
    rings, in the ring's own tinted colour turning to the warm inner bark, free edge quivering
    (flutter 0.003–0.007, a third of a leaf's);
  - `whiteBarkToeSpecs(p)` / `whiteBarkTileMapping(p)`: pure functions of the params shared by
    the instanced trunk (fluting) and the root mesh;
  - `createWhiteBarkRoots(...)`: ONE merged mesh of every placed tree's 3–6 toes, each section's
    bed on `terrain.height` under it (−4 cm at the flare, −10 cm a metre out, diving at the end;
    flanks 3 cm under), low and broad (2:1), wandering with knuckles and a gnarled dome, the tile
    magnified ten-fold so the vertex colour carries the root; aRoot.xyz = the tree's origin so
    the tree material's sway anchor and moss ring work per tree. +2 draws (+ shadow), ≈ +0.09 M
    tris on A;
  - crown layering (`80fab20`): per leaf, the share of the shade fill is written through
    `leafShade` (writer.ts aRoot.w) = a structured shell × top-lit term × a 0.75–1.25 per-leaf
    draw (fork), clamped 0.3–1; the lit rim/top tone × 1.12. Measured at `f4-crown-up`: the
    vertex-tone route alone moved the lobe's sd 21.2 → 21.5; a structured leafShade alone only
    lowered the level (107 → 99.5, sd unchanged — from below one sees the bottom shell); the
    per-leaf draw gives neighbouring laminae 0.55–1.0 of the fill (mean 107 → 103, sd 21.0).
- Verification: `variants.mjs` fingerprint (scratch, /tmp) — LOD-0 `radius` identical on all 10
  variants, `height` identical except ± 4 µm on the two saplings (the trunk-top ring's azimuth
  after the denser frame transport), leaf vertex hashes identical on 7 of 10 (the 3 mature
  variants with epicormic shoots: the shoot shoulder reads the trunk radius, ~6 shoot leaves each
  moved ≤ 1 cm); the exact `placeWhiteBark` replica (real terrain + layout + seed chain) gives
  the SAME 80 placements (variant, x, y, z, yaw, scale; 9 reseated) before and after.
- Six views at settle 6, baseline `d06e275` (take-0116 within ± 0.001) → `80fab20`:
  A 0.2249 → 0.2249, B 0.2029 → 0.2029, C 0.2359 → 0.2362, D 0.2779 → 0.2780, E 0.2135 → 0.2135,
  F 0.2634 → 0.2634; draws +2 on every view (max 523); +0.12 M tris; leafCount 288,607
  unchanged; W12 161/161 (maxGap 0); determinism 0; console clean. Tests 9/9 (trees) + 32/32;
  anti-cheat green (86 checks).
- Evidence: `art/environment/round47-whitebark/` — nine BEFORE | AFTER sheets (`poses.json`)
  and the README with per-pose verdicts.

## Important decisions
- **Placement must not reshuffle.** `placeWhiteBark` and the LOD bucketing read each variant's
  LOD-0 `height`/`radius`; the variant RNG stream feeds the crown after the trunk. Every new
  feature draws from `createRng('whitebark/<seed>').fork('base-47')…`; the five legacy buttress
  draws a root are still taken (and dropped) so the crown stream is where it was.
- **Toes are per instance, not per variant.** The variants are InstancedMeshes, so a toe in the
  variant geometry cannot know the ground under each instance. Measured on the exact placements:
  the terrain drops > 0.15 m within a 1.6 m toe reach under 39 of 80 trees (p90 0.46 m, max
  1.36 m — local relief, not trunk slope; the trunk slopes are ≤ 0.23). Flat toes float there;
  the merged mesh seats every section on `terrain.height`.
- Evidence rule (round 46): before/after at the exact survey pose; an after that looks like its
  before is reported as a FAIL.

## Known issues
- **Crown from below is still pale and flat-ish** (`f4-crown-up`): the level of a lamina's
  underside is set by the standard hemisphere/environment indirect (not scaled by `vLeafShade`)
  and the leaf shade floor in `materials.ts` — trees-30's lane. Suggestion: scale that indirect
  by `vLeafShade` too, or darken laminae whose geometric normal faces down. The geometry side
  (smaller leaves in greater numbers, more vertical blades) would move the crown envelope and
  therefore the placements — not done for that reason.
- Per-INSTANCE bark UV offsets need the vertex shader (materials.ts, trees-30's lane): the
  per-variant offset + spiral + the shader's world-position tone noise break the repeat, but two
  instances of one variant still share the scar layout. Suggested one-liner for trees-30, in
  `WIND_VERTEX_BODY` after `vTreeUv = uv;`: `#ifdef USE_INSTANCING vMapUv.y += fract(instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.61) * step(leafW, 0.5); #endif`
  (and the same for `vNormalMapUv` / `vRoughnessMapUv`).
- The whitebark near the survey pose stands in ferns; the toes are best judged at
  `f4-mature-relief` (−57.7, 11.7) and `f4-base-low`. A sapling's toes (R 0.06 → 0.26–0.37 m
  long) are under the grass.
- The root mesh is one draw over the whole 12–60 m ring (always submitted; ≈ 55 k triangles,
  no LOD). If it ever matters for W38, split it into quadrant meshes for frustum culling.

## Recommended next work
- vegetation: survey-2 #10 — the forest floor right under the whitebarks is still bare olive.
- trees-30 (materials.ts): the per-instance UV offset above; a near-detail second bark octave
  for the white-bark program like the giants' `BARK_NEAR_DETAIL` (the tile is 1.2 mm a texel,
  soft at 0.5 m).

## Last updated
2026-09-19T11:40:00Z
