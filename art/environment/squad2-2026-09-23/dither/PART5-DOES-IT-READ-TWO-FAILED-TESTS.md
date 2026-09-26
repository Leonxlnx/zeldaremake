# Does the fade read in motion? Two attempts, both inconclusive — and exactly why, so the third is right

`PROPOSAL.md`'s fourth check is the one that decides whether the band is worth its cost to `D_log`
(2.33 % of that frame, −0.0034 SSIM — `PART4`). This iteration tried to answer it twice and failed
twice. Both failures are informative, so they are written down rather than buried.

## Attempt 1: walk toward a white-bark in 1.0–1.5 m steps

Six poses along the north path at x 2, looking at the white-bark at (−16.94, −52.02), camera distances
34.2 → 33.0 → 32.0 → 31.1 → 30.1 m, rendered on both builds. Frame-to-frame differences:

| step | hard cut | with the band |
| --- | --- | --- |
| 34.2 → 33.0 m | 77.30 % of pixels, mean abs 30.31 | 77.28 %, 30.31 |
| 33.0 → 32.0 m | 77.23 %, 31.53 | 77.23 %, 31.53 |
| 32.0 → 31.1 m | 78.74 %, 32.44 | 78.73 %, 32.38 |
| 31.1 → 30.1 m | 83.43 %, 36.52 | 83.40 %, 36.46 |

**Inconclusive because the step is too big.** A metre of walking moves 77–83 % of the frame on its own,
so a rung swap inside that step is 0.06 of a mean-absolute level — unmeasurable. At 30 fps a walker
covers about 0.1 m a frame, so this test overstated the parallax roughly twelvefold.

## Attempt 2: one 0.1 m step straddling the gate

Two poses 0.125 m apart, at geometric distances 32.05 m and 31.95 m from the same tree, both builds:

| | one 0.1 m step |
| --- | --- |
| hard cut | 45.96 % of pixels move > 8, 8.52 % move > 40, mean abs 14.208 |
| with the band | 45.96 %, 8.52 %, mean abs **14.208** |

Identical to three decimals — and that is the tell. **The poses were not at the gate.** `bucketFamily`
measures

```ts
const d = Math.hypot(p.x - cam.x, p.z - cam.z) - w.lods[0].radius * p.scale * 0.5;
```

i.e. the distance **less half the tree's crown radius**. For a white-bark with a 6 m crown that is ~3 m,
so the rung gate at `lodDist[0]` = 32 m sits at about **35 m of geometric distance**, not 32. Both frames
were on the same side of it, in the same rung, with no band weight on anything — so the two builds could
only agree.

(The second reading is worth keeping too: a 0.1 m camera move at 32 m already changes 46 % of pixels and
8.5 % of them by more than 40 levels. Foliage, wind and the alpha-tested cards make the frame that
sensitive to the smallest walking step, which is the same reason attempt 1 drowned.)

## How the third attempt has to be set up

* Take the tree's own `lods[0].radius * scale` from the audit (or add the geometric gate distance to
  `giantWoodByTree`'s neighbours) and place the camera pair around **that**, not around `lodDist[0]`.
* Better, remove parallax entirely: park the camera and sweep the gate instead, with `?treelod=<mult>`
  moving `lodDist` through the tree's fixed distance. One boot per multiplier is the cost (≈ 80 s each),
  and the frames then differ only by the swap.
* Judge it on the pair either side of the crossing: the hard cut should show one step much larger than
  its neighbours, and the band should spread that excess across the multipliers whose gate falls within
  half a band of the tree.

## Where this leaves the decision

The cost side is measured (`D_log` 2.33 % / −0.0034). The benefit side is **still unproven**, and two
careful attempts have not been able to show the swap above the noise a single walking frame already
carries. That asymmetry is itself an argument for the third option in `PART4` — drop it, leave the code
inert behind `TREE_LOD_DITHER = false`, and spend the hours elsewhere — unless the owner wants the
stationary-camera sweep run to settle it properly.

The shipped build is unchanged throughout: the flag is false, the band 2.5 m, and #181 measured that
configuration byte-identical at two poses.
