# Where the near-canopy tier's slots actually land — and the price of aiming them at the frame

Lane 2, 2026-09-27. Branch `cursor/squad2-treephases-682b`, PR #210.

The near-canopy tier gives the nearest `NEAR_CANOPY_SLOTS` (64) crown parts their near geometry and
folds the far foliage behind them away. fable-4's third look call (inbox 09-26 03:15) proposes
tightening that set with distance from the plaza crowd, and I sized its drawn cost at the flight's
foot last round: 675 673 triangles in one draw. This round asks the question neither of us had asked:
**of the parts the tier shows, how many are in the frame at all?**

## 1. Almost none of them

Measured with the camera the frame was drawn with, six poses (frozen clock after 8 settle frames;
the probe is now the audit's `nearCanopy.slotsInFrame`):

| pose | draws / triangles | shown | in the frustum | **in frame, in band, no slot** | nearest starved |
| --- | --- | --- | --- | --- | --- |
| flight's foot | 545 / 9 129 877 | 79 | 18 | **9** | 17.6 m |
| plaza-west | 484 / 6 049 665 | 79 | 6 | **10** | 15.4 m |
| owner-0650-north | 457 / 8 504 699 | 79 | 5 | **4** | 22.6 m |
| clearing-north | 455 / 5 748 682 | 79 | 0 | 0 | — |
| **A_stairs** (hero) | 575 / 8 631 286 | 79 | 10 | **21** | 15.6 m |
| F_canopy (hero) | 515 / 7 836 917 | 79 | 15 | **16** | 16.7 m |

The tier is saturated at 79 parts everywhere (64 lobe slots plus the limb dressings), and **77–100 %
of them are outside the frame**. The plaza's authored boughs surround the camera, the ranking is by
distance, and most of what is nearest is therefore behind or above the view.

The column that matters is the last one. At camera A, **21 parts are inside their swap band and
inside the frame, and keep their far foliage** because the 64 nearest — 69 of which are off screen —
filled the slots first. The nearest of those 21 is **15.6 m** from the camera: well inside the tier's
26 m window and plainly in shot. That is the owner's "the trees only get detailed when I come up
close" in a specific place, with a count.

## 2. But aiming the slots at the frame is not free

It is tempting to read this as waste to reclaim. It is not, in triangles: a part the tier shows but
the frame does not contain draws **nothing** — the batch is a `BatchedMesh` with
`perObjectFrustumCulled`, so the 675 673 triangles measured at the foot are the ~18 in-view parts,
not the 79. Spending slots off screen is, by accident, the cheap option.

So the two directions cost the opposite of what they look like:

- **Aiming the slots at the frame** (in-view first, then distance) would give camera A about 21 more
  near crowns at 15.6–26 m, at roughly 37 K drawn triangles each ≈ **+0.8 M**. Camera A has 0.37 M of
  headroom under W38's 9 M line. It does not fit, and a partial version — *n* in-view promotions
  priced against the headroom — is the knob the owner would be choosing.
- **fable-4's slot cap with distance** would drop mostly parts that are already drawing nothing (69
  of 79 at A), so it saves pool memory and CPU and **little drawn cost**. My "0.68 M at the foot"
  sizing last round was the drawn cost of the in-view parts; a distance cap would not take most of
  it. That correction is the useful half of this round.

## 2b. So I built it and priced it: aiming the slots at the frame is not worth it

Estimating was not good enough, so the ranking went in behind a dev knob (`?canopyaim=<pad m>`, the
frustum grown by `pad` so a crown is promoted before it comes into shot) and both states were measured
from one build, frozen clock:

| pose | ranking | draws / triangles | in frame | starved | frame moved |
| --- | --- | --- | --- | --- | --- |
| A_stairs | distance (shipped) | 575 / 8 631 286 | 10 | 21 | — |
| A_stairs | **in frame first** | 576 / **8 820 983** | **29** | **2** | **0.46 %** |
| F_canopy | distance (shipped) | 515 / 7 836 917 | 15 | 16 | — |
| F_canopy | **in frame first** | 514 / **7 946 885** | **29** | **2** | **0.01 %** |

It does exactly what it was meant to: at camera A nineteen more crowns get their near laminae and the
starved count falls from 21 to 2. And it is **not worth it** — that costs **+189 697 triangles**, half
of A's 0.37 M of headroom under W38, and moves **0.46 % of the frame**. Side by side the two frames
are the same picture (mean 95.8 vs 95.7, top third 100.6 vs 100.3, middle third equal):

`aim-vs-shipped-A.jpg` — A shipped (8.631 M, 10 crowns in frame) | A aimed (8.821 M, 29 in frame).

So the knob came out again; the fourth rejected ranking is now recorded beside the other three in the
`NEAR_CANOPY_KEEP` comment, the way this file keeps them.

**And the negative result points somewhere useful.** If nineteen crowns at 15.6–26 m are
indistinguishable in their near form and their folded far foliage, the near form does not earn its
keep at that range — so the direction worth pricing is **down**: fable-4's slot cap should cost very
little in pixels, which is the opposite of what its 0.68 M drawn-cost sizing suggests it would save.
Both halves of that are now measured rather than guessed.

## 3. What changed in the code

Nothing that moves a pixel. The audit's near-canopy block now carries `slotsInFrame` — `shown`,
`inView`, `starved`, `starvedNearestM` for the camera the last frame used — so the table above can be
re-read on any build at any pose without a temporary hook, and so a decision about this tier can be
taken on numbers. It is computed on demand inside `audit()`, which nothing but a probe calls.

## Files

- `slots-in-frame.json` — the six-pose run behind §1, with the nearest starved parts per pose.
- `slots-saturation.json` — the earlier run that established the tier is at capacity (79 shown of
  352–366 registered) at every pose.
- `aim-off.json` / `aim-on.json` — §2b, the two rankings at A, F and the foot.
- `aim-vs-shipped-A.jpg` — §2b, camera A under both rankings, with each panel's mean and thirds.
