# Two verdicts from this lane on the same feature, three days apart — reconciled

Lane 2, 2026-09-29. Branch `cursor/squad2-treephases-682b`.

**Read this before merging either branch.** On 2026-09-26 this lane opened **PR #206**
(`cursor/squad2-ditherverdict-682b`, evidence `dither/PART5` and `PART6` on that branch) with the
recommendation **"drop the fade"** and left `TREE_LOD_DITHER = false`. On 2026-09-29 this lane turned the
same flag **on** (`gatesweep/`, `bandwalk/`) without having found #206. That is my error: I searched
`art/environment/squad2-2026-09-23/` and `INDEX.md` for a prior verdict and found only `PROPOSAL.md` and
`PART1`–`PART3`, because `PART5` and `PART6` live on a branch I never fetched. **The lane's own open pull
requests are part of "read the file before proposing a change to it", and I did not read them.**

This file reconciles the two. It does not pretend one round simply beat the other.

## 1. Where #206 is right, including about me

**Its correction of the proposal is the same correction I made independently.** `PROPOSAL.md` justified
the work with "1.85 % of `owner-0650-north` changes at the rungs, in one step". #206 says that is
`lodcheck/`'s aggregate — every tree at once, shipped rungs against all trees forced high, at a fixed
camera — and not a swap event, so quoting it as the defect's magnitude "overstated it by roughly 8×".
`gatesweep/` §1 reached the identical conclusion from the other side. **Two rounds agree, and #206 got
there first.**

**The method I used was #206's, prescribed before I wrote it.** `gatesweep.mjs` parks the camera and
sweeps the gate. `PART5`'s closing section says, in as many words: *"remove parallax entirely: park the
camera and sweep the gate instead, with `?treelod=<mult>` moving `lodDist` through the tree's fixed
distance."* My contribution there is an implementation detail — mutating the live `lodSwapM.tree` array so
the whole sweep is one page load instead of `PART5`'s "one boot per multiplier (≈ 80 s each)" — not the
idea. The idea should be credited to #206.

**Its cost figure is not superseded by mine; it is the same number at a different threshold.** #206's
ledger reads *"`D_log`, a sealed frame: 2.33 % of pixels"*; `gatesweep/` §3 reads **0.600 %**. Those are
not in conflict — mine counts pixels differing by more than **8**/255 and #206's counts more than
**2**/255. On this head, `D_log` reads **1.76 % at >2/255** and 0.600 % at >8/255. The residual 1.76
against 2.33 is the different head (this branch also carries `forceSinglePass` and the atlas change).
**I should not have described #206's cost term as four times too large; it is right.**

And #206's SSIM is a different quantity from mine, also legitimately: its *"SSIM 0.4013 → 0.3979
(−0.0034)"* is `D_log`'s similarity **to its reference frame** getting worse, where my 0.99632 is the two
builds' similarity **to each other**. The rubric cares about the first. Both belong in the ledger.

## 2. What is new since #206, and is not in its ledger

- **It does not crawl.** #206 never tested this, and it is the one thing that could have made the feature
  actively worse than the cut: the mask is a `gl_FragCoord` hash with no temporal pass behind it.
  `bandwalk/` measures the frame-to-frame churn inside the cells the mask works in, on a walked approach,
  and it is **lower with the band at all eight steps** of a 4 m strip.
- **The whole feature's cost at a hero view is +1 to +3 draws and +8 K to +98 K triangles**, worst case
  `A_stairs` **561 / 8 724 803** — 139 draws and 275 197 triangles under W38. #206's ledger had the
  per-tree figure (+11 K mid-band) but not the per-view total, which is what the budget line cares about.
- **Two of the five distinct sealed frames are byte-identical** (`C_lookback`, `F_canopy`), which narrows
  the cost to three frames rather than all of them.
- **The hard cut's step sequence has zeros in it.** #206 measured **one** crossing in isolation (0.22 %,
  then 0.01 %, then 0.00 %) and could not see this: over a 6 m gate sweep at a populated pose the cut
  gives 0.298, 0.038, **0.000**, 0.252, **0.000**, **0.811 %** and the band gives 0.038, 0.005, 0.194,
  0.138, 0.239, 0.190 %. Two metres of walking that change nothing followed by one that changes
  everything is the signature of a pop; six small even steps is not.

## 3. The one argument that decides it, and why neither round has settled it

#206's case rests on a ratio: **0.22 % of the frame for the swap, against 45.96 % for a single 0.1 m
walking step**, so *"the event the fade exists to soften is 0.5 % of the change a single walking frame
already carries"*.

The numerator is sound. **The denominator is the whole screen**, and `bandwalk/` §2 measured what
dominates it: walking half a metre changes **91–95 %** of the pixels in the **bottom row** of an 8×8 grid
— ground and grass one to three metres away — while every cell the rung band touches is in the **top
three rows**. So the 46 % is mostly smooth parallax of the ground underfoot, and a crown-local change in
shape is not perceptually masked by it. "0.22 % of 46 %" divides two quantities that are not in the same
currency.

But that objection is **reasoning, not measurement**, and my own side has the mirror-image weakness:
`gatesweep/` argues the fade reads because the step *sequence* loses its zeros, which is also an inference
about perception from a changed-pixel series. **Neither round has measured whether the pop is visible.**
#206 inferred "no" from a ratio of whole-frame shares; I inferred "yes" from the shape of a sequence.

## 4. The denominator that does decide it, measured

A discontinuity shows when the change **at that place** jumps far above what that place was already
doing. So the denominator should be the crossing crown's own ongoing rate of change, not the screen's.
`spikeratio.mjs` builds the per-step churn series inside the cells the band works in — at **0.1 m a step,
one frame of walking at 30 fps**, which is #206's own stride and avoids the coarse-stride problem that
made `PART5`'s first attempt and this lane's 0.5 m strip both blind to the crown — and reports

> **spike ratio = the largest single step ÷ the median of that cell's other steps**

on each build. A hard cut should spike; a working fade should flatten it.

Two 30-frame strips, one per build, are rendering as this is written — about 40 minutes each on
SwiftShader. **The numbers and the verdict land in the next commit on this branch.** This file is
committed first so the conflict between #206 and this branch is on the record immediately rather than
waiting on a render: a merger reading either branch today needs to know the other exists.

## Files

- `spikeratio.mjs` — §4's tool.
- `spikeratio.json` — §4's series and ratios.
- `strip-frame-band.json`, `strip-frame-noband.json` — the two 30-frame strips at 0.1 m.
