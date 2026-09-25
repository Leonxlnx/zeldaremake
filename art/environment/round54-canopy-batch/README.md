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

Renders `/tmp/f4/r198/{base,H,B2,B3}`; dists `/tmp/f4/r198-dist-{base,batch}`. The 1280 × 720 pair follows.
