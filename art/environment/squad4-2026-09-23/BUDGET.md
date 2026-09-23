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

## Next lever, for whoever takes it

The ferns' near tier is worth ~0.5 M at A on its own and the shadow pass is half of it. Cutting the
12 m ring is a measured decision someone already made twice (11 → 12 m in round 31; 14 m was
rejected at +1.51 M on F), so the shadow is the part to attack: a caster that uses the **mid**
geometry (≈ 1 000 triangles) instead of the near one would be invisible through a filtered shadow
map and give back ≈ 0.27 M at A. That needs a mechanism in `lodset.ts` — a shadow-only mesh per
near bucket sharing the bucket's instance attributes — so it deserves its own measured pass rather
than being folded in here.

I tried the cheaper version first — the verge's own fronds in a separate set on a shorter ladder
with no shadow — and **backed it out**: it saved 20 K triangles for **+7 draw calls**, and with A at
695 of the 700 cap that is the wrong currency.
