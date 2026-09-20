---
agent: fable-4
runtime: Cursor Cloud Agent (Claude Fable 5.1)
github: Cursor Agent <cursoragent@cursor.com>
status: active
branch: agent/fable-4-budget
updated: 2026-09-20T10:40:00Z
---

# fable-4 — work log

White-bark tree lane (Verdant Forest port), onboarded 2026-09-19 from
`docs/ONBOARDING_FABLE_CHATS.md` (Chat 3). Base: `origin/cursor/kokiri-world-phase1-f65e` at
`d06e275` (world tree = take-0116's `973a21e`). Draft PR #15 targets that branch; fable-cursor /
the owner merge and seal — I do not merge, do not touch `gauntlet/ledger.json` or
`gauntlet/rubric.json`.

## Current task
**Goal mode** (`docs/GOAL_MODE.md`; timer `goal-mode-fable-4`, hourly). PR #15 (round 47) is merged
(`084d007`). Branch `agent/fable-4-r48` off the head `3d50f6c`; evidence with per-pose verdicts in
`art/environment/round48-whitebark/README.md`.
- Iteration 1 (done): four young white-barks on the north clearing's banks (GOAL_MODE #1 / the
  round-47 handoff) — `a0f55cd` + hook `f9b6c32`.
- Iteration 2 (done): the trunk read at 5–20 m — broad near-black bands + chevron branch scars
  per variant, tonal zones ± 6 % (GOAL_MODE #3) — `e3f50cd`, `9ee2c7c`, `1812a6f`. PASS at 2/8 m,
  soft at 16–25 m; the first cut was a FAIL by the rule (gamma ate a 42 % linear drop) and is
  reported as such in the README.
- Iteration 3 (done, branch `agent/fable-4-crowns` `c46081f`): crowns layered by a per-leaf
  bimodal occlusion draw + structured albedo (GOAL_MODE #2) — IMPROVED, not closed; the
  `materials.ts` one-liner (hemisphere irradiance × mix(0.5, 1, vLeafShade) on white-bark leaves)
  asked of trees-30/31 in the INBOX.
- Iteration 4 (done, same branch, `cfcd4f4`): the marks at texel resolution — two broad
  near-black bands + two chevrons per tile in `bark-texture.ts`, toes confined to the tile's plain
  zone (GOAL_MODE #3 second half, fable-5's 1.9:1 → 3.7:1 at 2 m; PASS at `x-arch-tunnel-n`).
- Tried and reverted (05:30): clumpier lobes (sd 22.3 → 16.1 at `f4-crown-up`, a FAIL) and the
  `materials.ts` hemisphere line (0.7 % px, no leverage — ask withdrawn). GOAL_MODE #2 stands at
  IMPROVED; the darkness at 7 m is bounded by the shafts/haze at that pose, not the trees.
- 06:00: head `41d5970` merged into the branch (`e03ccc3`); the medium-LOD thinning judged not
  worth it (−50 K at A against a density pop at the 20 m swap and C's white-barks at 15–40 m).
- 06:45: `agent/fable-4-crowns` merged (`be27f4e`). New branch `agent/fable-4-budget` `119a7b4`:
  W38 give-back — medium twigs skipped (draws kept), one leaf in 6/12 at constant coverage;
  measured A −25 K / C −110 K / F −56 K, SSIM within ±0.0001, high LOD identical.
- Iteration 6 (`d914268`, `29b9ed1`): a real low bough on every young/mature stem at 22–34 %
  height (fable-5's W08 at C) — PASS at 8 m / 12–20 m, C only slightly (azimuth away from the
  camera). On the sealed head (`acec321`): A −7 K … C −91 K, SSIM within ±0.0003. Ready @ `7bf30a5`.
- 10:40: fable-2's review answered — the main bough already points into C's frame (local 0.80 rad →
  world +0.42); its leaves merge with the far stem's crown behind; W08 at C stays IMPROVED. Branch
  merged up to `5e525de` (`7ed102e`), green.
- 10:15: take-0122's C −0.0046 measured NOT mine (reverting my merged commits on the sealed head
  moves C 0.2336 → 0.2334); correction posted.
- Next: expansion-2's backside banks (young white-barks) if positions come; otherwise reviews.
- Blocked: PR creation for this identity ("must be a collaborator", twice); reported in the INBOX;
  fable-cursor merges from the branch; retried every iteration.

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
2026-09-20T10:40:00Z

## 2026-09-20 18:25 UTC — tick: W08's taper and irregularity at C; my lean commit's re-roll found and reverted

- take-0123 sealed (37/50); fable-5 re-filed W08 FAIL: lean + bough in, "a straight-sided cylinder with
  no taper and no irregularity". Measured C's stem: 27 → 21 px over the visible 1–5 m (the flare is spent
  by 2 m, the foot under the flowers).
- `agent/fable-4-taper` (`3b15fbd9`, off the seal): shoulder +22–34 % (toes' crest → 0.36 H) and a bow/S
  of 0.3–0.55 R over the lower half, on the swept surface only. First cut let the limbs follow the bend →
  the crown moved → `TreeAsset.radius` moved → 18 placements re-rolled (replica). Second cut: crown,
  leaves, bounds byte-identical; placements 80/80. Six views: C +0.0021, D +0.0005, B −0.0002, A/F =;
  draws D +1; A 8.62 M. Evidence in `art/environment/round50-whitebark/`.
- The same replica showed `ea86f8c1` (the lean, on r49b) re-rolls placements 62–79: `growthPath`'s
  frame is world-anchored for a near-vertical stem, so an azimuth turn reshapes the crown's bounds
  (± 0.3 m). fable-5's pair missed it (the outer ring is out of frame). Reverted (`78a71f47`), r49b is
  marks-retire only; correction posted to fable-cursor + fable-5. Lesson: any change that can move a
  crown must be checked with the placement replica before it is called "no re-roll".
- fable-cursor routed the cull to trees-32 at 16:15 (before my knoll note); told them the white-bark
  half is on `agent/fable-4-knoll`.
- Branches: taper (ready), knoll (ready), r49b (ready, marks only), leafnear (Astra's go).

## 2026-09-20 18:50 UTC — tick: knoll merged; merge check of the three pending branches

- `agent/fable-4-knoll` merged (`d6f5f35f`). Round-50 list (fable-5, by the owner's order) has white-bark
  taper at #9 — `agent/fable-4-taper` covers it, awaiting fable-cursor's next pass.
- Astra adopted the `leafNear` line (their branch, line 474) and runs a leaf-warmth pass on the white-bark
  program — the crown hue shift (#2) reaches my crowns through their material; nothing for me to rotate.
- Test-merged r49b + taper + leafnear on the head: code auto-merges, tsc/build/tests green, docs-only
  conflicts. Asked fable-cursor whether r49b is blocked.
- Next candidates: the survey stem's bough half under C's HUD (fable-5's nit) — a lower main bough
  would need the placement replica first (a lobe can set `TreeAsset.radius`); the epicormic stubs on the
  bent sweep; else reviews.

## 2026-09-20 19:35 UTC — tick: W08's lean at C by the instance matrix

- fable-5 re-filed W08's take-0123 note: the C stem is plumb (my lean was never in the take and is
  reverted). The lean half re-opened; a geometry lean re-rolls seats (bounds), so the hero stem leans by
  its instance matrix: `HERO_WHITE_BARK_TILTS` (variant 7 at (−7.39, 12.87), 5.5°, top toward (0.9, 0.43)
  = into C's frame), `seatFamily` takes an optional tilt. Measured: C 0.2380 → 0.2373 (branch +0.0014 over
  the seal), other views pixel-identical; at 3× the top sits 22 px left of the foot. `6537e21a` on
  `agent/fable-4-taper`.
- Direction check was needed: the first eyeball read of the crop was wrong; the 3× zoom showed the
  top left of the foot as intended (camera-left at that spot is world +x).
- Branches: taper (ready, now taper + bow + tilt), r49b (ready, marks only), leafnear (Astra adopted).
