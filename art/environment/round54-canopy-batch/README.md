# Round 54 (fable-4) — the giants' near-canopy lobes as one BatchedMesh (PR #101 `agent/fable-4-canopybatch` `3a339a0a`)

The round54-lookback-draws attribution put 45 / 32 of the trees' draws at the plateau's look-backs — and up to 64 under the
plaza's giants — in the near-canopy lobes: each a pooled geometry and a `Mesh` of its own, one draw per shown lobe. They all share
`mats.giantTreeNearCanopy` and sit in world space, so a `BatchedMesh` takes them: the pool's `install` / `uninstall` become
`addGeometry` / `deleteGeometry`, `mesh.visible` becomes `setVisibleAt`, each part keeps its padded cull sphere, the fold slots ride
in `aRoot`. The columns' lobes stay meshes (yaw and scale through `modelMatrix`). `NEAR_CANOPY_BATCHED = false` restores the old path.

## Measured (896 × 776, clock frozen, 8 settle frames; base `d367cfbf` vs the branch)

| pose | draws base → branch | triangles (equal) | pixels > 8 / 255 |
|---|---|---|---|
| A_stairs | 606 → **594** (−12) | 7.964 M | 0 |
| B_house / E_ground | 593 → **578** (−15) | 7.805 M | 0 |
| C_lookback | 517 → **502** (−15) | 6.949 M | 0 |
| D_log | 514 → **493** (−21) | 8.173 M | 0 |
| F_canopy | 522 → **496** (−26) | 7.451 M | 2 |
| the east green (43, 4) → the plaza | 701 → **657** (−44) | 8.807 M | 0 |
| owner-0650-north | 478 → **469** (−9) | 8.115 M | 0 |

The near-canopy audit at A: parts 426, resident 379, pinned 79, wanted 355, 146,291,811 bytes in the pool — the same on both
builds (the batched parts report the bytes the compaction would have left, so the pool admits exactly what it did).

## What the seam needed (three fixes, each found by a render)

1. **The pool takes a first build as already installed** (`add(item, built)` only counts its bytes — a mesh holds its own first
   geometry). A batched part must install its first build itself, or it is resident and never drawn: the first run had every
   view's triangles down 50–150 K with the residency identical, and 0 px at poses whose shown lobes happened to be deferred ones.
2. **One attribute layout.** `compactAttributes` is conditional per part (colours to Uint8 only if all ≤ 1, wind to Uint16 only if
   in [0, 1]), so the parts' layouts differed and three refused them. Normals compact for every part (always in range) — so the
   shading matches the per-mesh parts to the bit — and colours / wind stay Float32; the pool's accounting uses the bytes the full
   compaction would have left.
3. **The end-of-build pass** that compacts and drops the CPU arrays of every tree geometry must skip the batch: three copies new
   parts into those arrays, and the compaction had turned the batch's layout into the one the next part could not match.

One false alarm: B / E differed by 0.9 % against an *older* head build — a Kokiri girl's hair colour, another lane's change between
the two heads; against the exact base, 0 px.

## Cost

The batch keeps a CPU copy of its buffers (300 K vertices reserved, grown × 1.5 on demand): ~35 MB heap for the plaza's resident
set on the large tier. With `WEBGL_multi_draw` (the capture browser and Chrome have it) the batch is one draw; without it three
falls back to one draw per visible part, as before.

Renders `/tmp/f4/r198/{base,H,B2,B3}`; dists `/tmp/f4/r198-dist-{base,batch}`.

## The six fixed views at 1280 × 720 (`capture.mjs --settle 12`; base `d367cfbf` vs the merged `3a339a0a`; SSIM vs `reference/frames`)

| view | base draws → batch | triangles (equal) | SSIM, base and batch |
|---|---|---|---|
| A_stairs | 628 → **614** | 8.97 M | 0.1953 |
| B_house / E_ground | 615 → **596** | 8.29 M | 0.1764 / 0.1991 |
| C_lookback | 552 → **533** | 7.96 M | 0.1855 |
| D_log | 549 → **523** | 8.74 M | 0.2511 |
| F_canopy | 584 → **555** | 8.10 M | 0.2192 |

Identical to four decimals at every view. (fable-5's pairing: pixel-identical at all six; the far bank 774 → 718, the green 736 → 701.)

## The eviction path — a five-pose walk on the small pool tier (`?pool=small`, cap 64 MB)

A → the owner's north pose → the arch's north approach → the east green → A again, 12 settle frames each, the page kept between
poses so the pool churns (161 parts resident at A of 426, 228 evictions and 219 synchronous builds over the walk on the batch build).
Base vs batch: **0 px at all five poses**, triangles equal at each, draws −12 / −9 / −2 / −28 / −12; no page errors. The
`deleteGeometry` / `optimize` / growth paths the plaza's large-tier renders never hit are exercised here.

## The heap, measured (`nearCanopy.batch.heapBytes`)

| tier | pose | parts in the batch / vertices | reserve | heap of the batch's CPU copy | the pool's accounted bytes |
|---|---|---|---|---|---|
| large (cap 256 MB) | A, 24 frames | 258 / 1.91 M | 2.28 M vertices | **171 MB** | 146 MB (all resident parts, columns included) |
| small (cap 64 MB) | A again after the walk | 148 / 1.12 M | 1.43 M | **107 MB** | 67 MB |

The design note's "~35 MB" was the shown set; the batch mirrors the pool's RESIDENT set. It is 1.6 × the pool's accounted bytes
because the batch keeps colours and wind Float32 (72 of the ~300 parts built on the walk have values outside the compaction's
ranges, so one uniform layout cannot narrow them) and the reserve carries 1.25 × slack. Two batches by layout — a narrow one for
the parts that compact, a wide one for the 72 — would put the heap near the pool's own bytes at the cost of a second draw; that is
the follow-up. A trim that compacts and gives the reserve back after evictions (commit `b0a05eb5`) did not fire on this walk (the
live set stayed over half the reserve) and is kept for longer walks.

## The two-layout split, measured and reverted (11:25)

Two batches by attribute layout — a narrow one for the parts whose colours and wind compact, a wide one for the 72 that do
not — at camera A on the large tier: narrow 249 parts / 1.85 M vertices / 134 MB + wide 37 / 285 K / 35 MB = **169 MB against
171 MB with one batch**. The index (Uint32, a third of the bytes) and the reserve's slack are the weight, not the two Float32
attributes. Reverted (`3eaa576b`); the trim stays (PR #117). The batch's heap is inherent: ~1.2–1.5 × the giants' resident bytes.

## The page's memory, the way fable-2 measures it (`performance.memory` after a forced GC, 24 settle frames) — 12:35

The head `905d55ea` built twice, `NEAR_CANOPY_BATCHED` on and off:

| tier | pose | batch off (used MB) | batch on | **delta** | the batch's own arrays (`batch.heapBytes`) |
|---|---|---|---|---|---|
| large (cap 256 MB) | A_stairs | 1332.3 | 1420.0 | **+88 MB** | 199.8 MB |
| large | owner-0650-north | 1305.7 | 1395.8 | **+90 MB** | 199.8 MB |
| small (cap 64 MB) | A_stairs | 1276.7 | 1323.1 | **+46 MB** | 102.3 MB |

The page grows by less than the batch's arrays because the per-mesh path is not free of them either: a resident part that has not
yet been drawn keeps its own arrays on the heap until its first upload (`releaseAfterUpload` fires then), and at A most of the
379 resident parts are not in view. The batch replaces those with its one copy. So the cost of the merged batch, in the units of
fable-2's #115 (which gave 46 MB back): **+88 MB on the large tier, +46 MB on the small, at the plaza** — for −12…−26 draws at the
six views and −44 at the look-backs.

## The trees' CPU arrays at A, by group (`systems.trees.cpuArrays`, fable-2's #119 shape, on the head with the flag off / on) — 12:50

| group | batch off | batch on |
|---|---|---|
| giants | 134.1 MB | **226.8 MB** (the batch's arrays, kept by design) |
| columns | 52.1 MB | 52.1 MB |
| white-bark | 32.2 MB | 32.2 MB |
| understory / detached boughs / distant | 1.2 MB | 1.2 MB |
| **total** | **219.5 MB** | **312.2 MB** (+92.7) |

With the batch off the trees still hold 219 MB of arrays at A, and almost all of it is meshes no camera has drawn yet (three uploads
on the first draw and `onUpload` frees the array then): the giants' resident near-canopy parts out of view, the columns' LODs and
near parts, the white-barks' LOD meshes not yet used. fable-2's warm-up pass (#119: one render with every gated mesh visible before
the overlay fades) would free most of those ~200 MB in the per-mesh path — and none of the batch's, which needs its copy to add
parts. So the batch's cost against a warmed-up per-mesh path is its whole copy, ~200 MB on the large tier, ~100 on the small;
against today's head it is +88 MB on the page. That is the number to weigh against −12…−26 draws at the six views and −44 at the
look-backs; on the owner's machine a draw is tens of microseconds of CPU, so the look-backs' 44 are one to two milliseconds a frame.
