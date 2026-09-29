# The weak-device tier re-read after the atlas change, and a note on CI cadence

Lane 2, 2026-09-29, head `ecffbcae`. **No code changed.** Two gaps closed, both about verification
rather than the world.

## 1. `quality=low` had not been re-read since the atlas stamp change

The far-crown atlas is shared by **both** tiers, and the 64 px stamp (`atlascost/`) was proved at four
poses **at `quality=high` only**. The low tier's own crown-band figures in the PR came from an earlier
round, before that change. So the weak-device experience was carrying an unverified change.

Same protocol as `atlascost/`: two builds differing only in `STAMP`, the same views, clock frozen,
`frozen.mjs --quality low`.

| view, `quality=low` | draws | triangles | SSIM | pixels > 2/255 | mean Δ | max Δ |
| --- | --- | --- | --- | --- | --- | --- |
| A_stairs | 495 → 495 | 6 441 178 → same | **1.00000** | 0.031 % (163 px) | 5.4/255 | 21 |
| F_canopy | 449 → 449 | 5 493 128 → same | **1.00000** | 0.068 % (351 px) | 5.4/255 | 28 |

And the crown band is **identical to two decimals** at both (`band.mjs`, y 0.10–0.45):

| view | mean | across-columns sd | within-column sd |
| --- | --- | --- | --- |
| A_stairs, before **and** after | 95.3 | 24.35 | 26.90 |
| F_canopy, before **and** after | 71.6 | 15.67 | 21.59 |

**So the change is as invisible on a weak device as on a strong one** — and slightly *more* invisible at
F_canopy, 0.068 % against the 0.090 % the same view moved at high quality, which is what lower-resolution
textures should do to a texture change. A_stairs at low also confirms the tier's recorded cost to the
triangle: **495 / 6 441 178**, the number the PR has carried since `tiers/`.

## 2. A note for whoever waits on this branch's CI

Looking at the branch's run history for the first time today: **almost every gauntlet run is
`cancelled`**, because each push cancels the run in flight. A successful run takes about **41 minutes**
(14:32:43 → 15:13:34 on `3961630f`), and this branch has been pushed roughly hourly all day, several
times within an hour.

The consequence is not a red gauntlet — the runs that were allowed to finish passed (`3961630f`,
`faafac9b`, `c91a9bbe` all succeeded) — but that **the newest head frequently has no completed run**,
which is exactly what an integrator looks for before merging. Two things follow, and the second is the
one this lane changes:

- the branch is CI-healthy; the gaps in its history are cancellations, not failures;
- **a push cadence tighter than the gauntlet's 41 minutes guarantees the head is never green**, so this
  round holds its push until the run in flight completes rather than restarting the clock for the sake
  of landing evidence twenty minutes sooner.

## Files

- `low-before/`, `low-after/` — the two builds' frames and counts at `quality=low`.
