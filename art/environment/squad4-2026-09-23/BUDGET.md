# squad4 — where lane 4's triangles are, and the first give-back (2026-09-23)

fable-5's 13:43 note, relayed twice in the squad log: *"A's 9.15 M triangles are lane 4's vegetation
(+0.57 M), not the tree layers — lane 4, the turf's density or reach where A does not resolve it."*
This is the answer, measured.

## The tool

`veg-budget.mjs` builds the field, the blade tiles, the carpet and the plants the way the vegetation
system does, runs each set's `update()` and `cull()` at a fixed viewpoint, and reads the same
`stats()` the system reports — **about 30 seconds, no renderer**. The browser route (hiding a group
and re-reading `renderer.info`) costs a world load and twenty minutes a pass, which is why the cut
had never been aimed.

```
node art/environment/squad4-2026-09-23/veg-budget.mjs --pose A_stairs
```

Read it as shares and deltas: the renderer also runs three's own per-mesh cull and the shadow pass.

## Where the vegetation's triangles are at camera A

```
pose A_stairs: vegetation submits 3.351 M triangles in 145 draws
  grass-tiles            1.041 M    51 draws  (607928 submitted of 652051 blades)
  ferns                  1.163 M    16 draws  (1681 placed)
  bushes                 0.276 M    10 draws  (167 placed)
  flowers                0.238 M     7 draws  (763 placed)
  weeds                  0.145 M     7 draws  (6014 placed)
  hero-ferns             0.097 M     7 draws  (18 placed)
  tufts                  0.086 M    12 draws  (5601 placed)
  … everything else under 0.07 M
```

Two items are the lane, and the second is the surprise:

- **the blade tiles, 1.04 M** — 608 K blades submitted, mostly at the 3-triangle mid LOD;
- **the ferns, 1.16 M from 1 681 placed plants.** Their near LOD is a bipinnate frond of
  ≈ 3 400 triangles that reaches **12 m** and **casts from that same geometry**
  (`castShadowLods: 1`). At A that is 114 near instances: ≈ 0.38 M in the colour pass and about as
  much again in the shadow pass — call it 0.77 M, a fifth of the whole vegetation budget, from a
  hundred plants.

## What this change does

The walked verge's extra blades (`grass.ts VERGE_EXTRA`) are a **near** detail: standing in the band
they close the fringe at the slabs, and at the far end of the mid LOD's 26 m a blade is well under a
pixel wide, where the carpet's cards, the base turf and the verge's own violets, leaves and fronds
carry the read on their own. A tile whose near edge is further than `VERGE_NEAR_M` = 14 m now drops
the verge pass's blades from its submitted stream — the cell cull's own rewrite with one more
filter, so nothing inside the band changes.

| pose | grass-tiles, tier off | tier on |
| --- | --- | --- |
| A_stairs | 1.041 M | 0.987 M (−54 K) |
| B_house | 1.212 M | 1.147 M (−65 K) |
| D_log | 1.310 M | 1.280 M (−30 K) |
| F_canopy | 1.217 M | 1.217 M (none — no verge tile is past the tier in its frame) |

Draw calls are unchanged at every pose.

### What it costs to look at

The same two walk poses rendered with the tier off and on (960×540, `--settle 6`):

| pose | SSIM | pixels changed > 8/255 |
| --- | --- | --- |
| the owner's north pose (`p1-owner-north`) | 0.99944 | 0.058 % |
| the corridor past the hollow (`p4-north-floor`) | 1.00000 | 0.000 % |

`p4` is byte-identical; at the owner's pose six pixels in ten thousand move.

## The contract that changed

`grass.ts cull()` was a **lossless** submission cull: every blade it dropped could reach no pixel,
and `grass.test.mjs` asserted exactly that. The verge tier is a distance LOD riding the same
rewrite, so the test now says: a dropped blade either misses the frustum **or** is a verge blade of
a tile past the tier — and two new assertions keep the tier honest (a tile inside it drops no blade
for being a verge blade; a tile past it submits none of them). The test also matches kept blades by
**stream index** now rather than by millimetre position: two blades of a tile can share a position,
which made a dropped blade look kept.

## Three things I measured and did not keep

Each of these looked like the obvious next cut. The numbers are here so nobody spends the evening
on them again.

**1. The verge's fronds in their own set, on a shorter ladder, casting nothing.** Saved 20 K
triangles at A for **+7 draw calls**. With A at 695 of the 700 cap that is the wrong currency.

**2. Thinning the verge's fronds to 55 % and giving the difference to broad leaves** (which cost
30–350 triangles against a near frond's 3 400, and are what his verges are mostly made of). A's
ferns 1.163 → 1.134 M — only 29 K, because `minSpacing` was already the binding constraint on that
pass, so 45 % fewer candidates placed only 77 fewer plants, and most of those sit behind the
cameras. 29 K of colour and about as much shadow, against thinning the verge the owner asked to
have thickened twelve hours earlier. Not worth it.

**3. Casting the ferns' near tier from the mid geometry.** This is the big one — ≈ 0.38 M of shadow
at A from a hundred plants — and **stock three cannot do it.** The shadow pass skips an object when
`object.visible === false` or `material.visible === false`, and both are checked in the colour pass
too, so a shadow-only proxy is not expressible that way; the layer test in `WebGLShadowMap` uses the
*scene* camera's layers, so layers do not separate the passes either; and `onBeforeShadow` fires
after three has already read `objects.update(object)`, so swapping the geometry in the hook is too
late. What is left is a second `InstancedMesh` on the mid geometry sharing the bucket's attributes
with `colorWrite`/`depthWrite` off — it still rasterises in the colour pass, so it turns 0.38 M of
shadow into ≈ 0.11 M of shadow plus ≈ 0.11 M of wasted colour, for extra draws. Marginal, and
invasive; it needs a real decision, not a patch.

## Still on the table

The violets' **far tier** is 487 instances × 330 triangles = **161 K at A alone**, and the `flowers`
set has no `maxDistance`, so a clump keeps drawing at 40 m where it covers a few pixels. `fernsNorth`
and the other corridor sets already use `maxDistance` for exactly this. The reason I have not done
it is a contract, not a doubt: `plants.test.mjs` asserts that every disc set except a named list has
`maxDistance === undefined` ("no far cut"), and camera D's scored violet patches sit at 10–20 m, so
a cut at ~32 m is safe but wants whoever owns that contract to agree first.
