# Round 54 — the giants' folded far foliage leaves the frame (fable-4)

PR #171 `agent/fable-4-farfold` (`5392cb5d`) against its parent `617bbb5a` (= PR #151's tip, the
20:18 head `af644f01` merged in). `src/world/trees/index.ts`, `src/world/trees/lodPool.test.mjs`.

## The item

squad2's `FOLD-NOT-WORTH-IT` (PR #159, `art/environment/squad2-2026-09-23/shadowcost/`): when a
lobe's near-canopy part is shown, the colour pass folds the lobe's far laminae to a point in the
vertex shader (`materials.ts`, the `aRoot.w` slot test) but still submits them — **119 K triangles
at camera A, 138 K at the plateau look-back** — four times the 30 K of headroom camera A had under
W38's 9 M gate. Geometry groups per lobe would cost a draw per group (+100 at A); their note asks for
"a batched path for the giants' leaf bands, where per-part visibility costs no draw call".

## What the PR does

- At sector assembly each giant's tagged far laminae (`aRoot.w = 3 + group`, or a flat lobe's
  `1000 + group + share`; a triangle moves only when all three vertices name one group —
  `extractTaggedFoliage` / `subsetGeometry`) leave `asset.geometry` for one sub-geometry per lobe
  group. The sectors keep their wood and untagged leaves; the round-52 bands and group cull are
  unchanged. It turned out every giant's leaves are tagged (every lobe has a near part), so the
  sectors are wood now — one geometry group per giant instead of three.
- One static `BatchedMesh` per sector (`giant-far-foliage-<s>-…`, `mats.giantTree` /
  `mats.giantTreeDepth`, identity instances, world-space geometry like the sectors'), sized exactly;
  100 / 100 / 105 instances, 596 K vertices, 1.45 M indices (484 K triangles) in all. Each batch takes
  **its sector's own attribute layout** (`narrowLayout` over the members' full geometries — what the
  end-of-build compaction decided with the laminae still inside: sector 1 keeps Float32 colours and
  wind for its relief bole's bark AO, 0 and 2 compact), applied to the kept sector geometry too and
  kept from the end-of-build pass, so every lamina is quantised exactly as before. The vertex arrays
  go with the first upload; the index stays (three reads its element size when it lays out the
  multi-draw starts each frame): **5.5 MB of heap for all three**.
- **The fold, exactly as today.** `nearCanopyUpdate` hands the batches the shown lobes that hold a
  slot (`shownLobes`, ≤ 64) — the only parts the shader folds — and those instances are hidden in the
  colour pass (`onBeforeRender`) and shown again for the depth pass (`onBeforeShadow`), because the
  depth programs get an empty slot set today and the shadows are the far foliage's at every distance.
  Persistent parts, limbs, the cards and the columns' instanced laminae keep the shader fold.
- Per-instance frustum culling by each lobe group's padded sphere (`GROUP_PAD_M`), finer than the two
  height bands; `castShadow` armed by `shadowReaches` per sector as the sector meshes' is. Gated on
  `WEBGL_multi_draw` — without it the fold stays the shader's (three would draw the visible groups
  one by one, squad2's +100 calls).

## Six fixed views — `617bbb5a` vs `5392cb5d`, 1280 × 720, `capture.mjs --settle 12`

SSIM against `reference/frames` identical to four decimals at all six; `A_stairs.det` 0.00 % on both.

| view | base draws / M tris | branch draws / M tris | Δ draws | Δ triangles | px differing at all |
|---|---|---|---|---|---|
| A_stairs | 614 / 8.97 | **575 / 8.76** | **−39** | **−210 K** | **0** |
| B_house | 596 / 8.29 | 557 / 8.13 | −39 | −160 K | 0 |
| C_lookback | 533 / 7.96 | 494 / 7.85 | −39 | −110 K | 0 |
| D_log | 523 / 8.74 | 484 / 8.56 | −39 | −180 K | 0 |
| E_ground | 596 / 8.29 | 557 / 8.13 | −39 | −160 K | 87 at ≤ 4/255 |
| F_canopy | 555 / 8.10 | 516 / 7.94 | −39 | −160 K | 0 |

Camera A stands **240 K under the 9 M gate** (was 30 K). E's 87 pixels are the same hazed patch behind
the plaza's column trunk (bbox 175, 20 → 1090, 399, ≤ 4/255) that turned up at B in #151's six-view
run and at neither pose in a fresh page: the one-page A → F pipeline's pool state at that frame, not
the batch's rendering — its twin B, the same pose four minutes earlier, is 0 px here.
(`six-views.pixel-diff.txt`; `A_stairs.base-branch-heat.jpg`: head | branch | differences, none.)

Where the −39 draws come from: every giant's leaves were tagged, so each sector mesh lost its two
leaf bands per giant in both passes (12 giants × 2 bands, less the bands the group cull already
zeroed), and each sector's laminae are one multi-draw call in each pass. Where the triangles come
from: the fold's 88 K at A (the colour pass no longer submits the folded lobes) plus the per-lobe
culling of crowns half out of frame (a band partly in view drew all of itself).

## The pose harness — A and the plateau look-back, 1280 × 720, t = 12.5

`_f4hidekind.mjs` (scratch): a frame as drawn and one with the three batches moved off the camera's
layer, with the audit's `nearCanopy.farBatches`. `quick-base.stats.json` / `quick-branch.stats.json`.

| pose | base draws / M tris | branch draws / M tris | Δ | batches' own draws / K tris (colour + depth) | folded instances / triangles | px > 24/255 (> 0) |
|---|---|---|---|---|---|---|
| A_stairs | 614 / 8.967 | **575 / 8.756** | −39 / −211 K | 5 / 608 K | 61 / 88,140 | **0** (6) |
| plateau-lookback-south | 576 / 9.073 | **538 / 8.879** | −38 / −194 K | 6 / 652 K | 50 / 91,460 | **0** (365) |

(`plateau-lookback.base-branch-heat.jpg`: head | branch | differences, none.)

## Look-backs, the owner's north pose, under the north seats — and the small pool tier

The same harness, t = 12.5. `lookbacks-*.stats.json`, `small-*.stats.json`.

| pose | base draws / M tris | branch draws / M tris | Δ | batches' draws / K tris (both passes) | folded instances / triangles | px > 24/255 (> 0) |
|---|---|---|---|---|---|---|
| green-west (43, 4) → plaza | 687 / 9.923 | **649 / 9.850** | −38 / −73 K | 6 / 870 K | 35 / 47,220 | **0 (0)** |
| lookout-fence-west (47.5, 8) → plaza | 684 / 9.966 | **646 / 9.924** | −38 / −42 K | 6 / 916 K | 17 / 23,036 | **0 (0)** |
| owner-0650-north (1.4, −10.2) → N | 497 / 9.013 | **457 / 8.878** | −40 / −135 K | 4 / 480 K | 56 / 132,676 | 0 (165) |
| north-seats (2, −18 → −3.5, −28) | 335 / 5.861 | **296 / 5.631** | −39 / −230 K | 5 / 507 K | 50 / 133,356 | 2 (627) |
| small tier: A_stairs | 611 / 8.881 | 572 / 8.670 | −39 / −211 K | 5 / 608 K | 61 / 88,140 | **0 (0)** |
| small tier: plateau-lookback-south | 574 / 9.008 | 536 / 8.814 | −38 / −194 K | 6 / 652 K | 50 / 91,460 | 0 (5) |

The green's look-back — 704 on the 17:27 head, 687 with #151 — is **649** with both; the batches' own
triangles at the look-backs are large (870–916 K over both passes) because from the green the whole
plaza's crowns are in frame and in the shadow box, and every lamina is drawn once per pass exactly as
the sector bands drew them. north-seats' 2 pixels above 24/255 are two adjacent pixels at the
frame's top edge (1090, 8–9), a gap in the crown against the sky; the 627 at 1/255 are the two
sessions' 1-level noise seen in every pose harness pair (`green-west.base-branch-heat.jpg`: head |
branch | differences, none). On the small tier (`?pool=small`, evictions live) the static batches are
untouched by the pool; the fold follows the shown set as on the large tier.

fable-5 (lane 10) measured the same `5392cb5d` independently (INBOX 23:50, `.agents/reviews/fable-5-lane10-farfold.md`):
pixel-identical A–F, −39 draws at every fixed view, A 8.967 → 8.756 M, the play look-backs' trees
row 218 → 164 draws at the green and 200 → 162 at the far bank; PASS for merge.

## Two things the first cut got wrong, kept here so the record is honest

1. **One layout for all three sectors.** The first cut compacted every batch's colours and wind
   (all parts were in range); sector 1's mesh keeps them Float32 because its relief bole's bark AO is
   a negative wind term. Its laminae, quantised, differed from the head's by 1–3 levels wherever they
   stood. Now each batch follows its sector's decision (`narrowLayout`), the kept sector geometry is
   compacted to the same decision, and the end-of-build pass leaves both alone.
2. **The folded lobes cast nothing.** three's `BatchedMesh.onBeforeShadow` builds the depth list by
   calling `this.onBeforeRender` — which, on the instance, was the colour hook that hides the folded
   lobes. Their shadows vanished and the whole plateau frame was 1–2 levels brighter in the dapple
   (`plateau-first-cut.diff-x40.jpg`: 288 K pixels at 1–23/255). `onBeforeShadow` now shows the
   folded instances and calls the prototype's `onBeforeRender` with the shadow camera itself; the
   depth pass draws 100 / 100 / 105 instances at the plateau (every one inside the shadow box), the
   colour pass 2 / 32 / 80.

## Checks

`npm run typecheck` green; `vite build` green; `node --test` over the 57 test files: **223 / 223**
(three new: the fold-group decode, the kept / extracted partition with attributes travelling and a
mixed triangle staying, the untagged giant keeping its geometry object; `farFoliage` supplied to
the `nearCanopyUpdate` sandbox).
