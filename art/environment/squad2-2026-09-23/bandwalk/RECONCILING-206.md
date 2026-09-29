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

Two 28-frame strips, one per build, 0.1 m a step, clock frozen, four cells ranked by how much the mask
touches them over the strip:

| cell | mask footprint | hard cut: worst frame / median of the others / **ratio** | band: worst frame / median / **ratio** |
| --- | --- | --- | --- |
| **`2,0`** | 235.97 | **44.70 %** at step 22 / 26.21 % / **1.71** | 35.12 % at step 21 / 26.54 % / **1.32** |
| **`2,1`** | 188.05 | **39.29 %** at step 22 / 27.82 % / **1.41** | 30.17 % at step 9 / 27.30 % / **1.11** |
| `5,1` | 236.18 | 33.03 % at step 9 / 28.48 % / 1.16 | 32.03 % at step 1 / 27.87 % / 1.15 |
| `5,2` | 61.12 | 26.11 % at step 23 / 23.77 % / 1.10 | 26.32 % at step 22 / 23.70 % / 1.11 |

**One frame in the hard-cut strip changes 44.70 % of a crown cell where every neighbouring frame changes
26 %.** That is a pop, by any definition — and it lands in cells `2,0` and `2,1` at the same step 22,
which is one tree spanning two cells. With the band, `2,0`'s largest frame falls to 35.12 % and moves a
step earlier (a tree enters the band 1.25 m before the gate), and `2,1`'s step 22 falls to **25.90 %** —
the ongoing rate exactly. **1.71 → 1.32 and 1.41 → 1.11.**

Cells `5,1` and `5,2` have no crossing inside this 2.7 m window — their largest steps are 1.10–1.16× and
one of them is the strip's first frame — and the band is flat there too, which is the control this table
needed: the band acts where a crossing happens and nowhere else.

## 5. #206's arithmetic and mine are the same event; only the denominator differs

The two readings reconcile exactly, and it is worth doing because it names the error precisely rather than
just disagreeing. A grid cell is **1/64 of the frame, 1.56 %**. #206's swap costs **0.22 % of the frame**
concentrated in one crown, so as a share **of the cell that holds it** that is 0.22 / 1.56 ≈ **14 % of the
cell** — and the excess measured above is 44.70 − 26.21 = **18.5 points of the cell**. Same event, same
size, two denominators.

So the error in *"0.22 % against 46 %, therefore 0.5 % of what a walking frame carries"* is that it
divides a **concentrated** change by a **diffuse** one. The 46 % is spread over the whole screen and is
mostly ground going past underfoot; the 0.22 % is packed into about a sixtieth of the screen. Dividing
them understates the concentrated one by roughly the ratio of the two areas — here about 60×, which is
why the same event reads as "0.5 % of the motion" one way and "a 71 % excess over the local rate" the
other. **The local rate is the one an eye uses**, because a discontinuity is seen against its own
surroundings, not against the average of the screen.

## 6. And a human-scale check: the clip, at real speed

Numbers established that a discontinuity exists. Whether it is *visible* is a question for eyes, so the
28 frames of each build were rendered to a **side-by-side clip at the real 30 fps** and reviewed without
being told which side was which beyond the labels (`rung-swap-realtime.mp4`, also in the PR):

- the hard cut's pop is **"a very obvious, abrupt one-frame change… the tree crown slightly right of
  centre suddenly jumps from sparse foliage to a much denser, fuller canopy. It is a very clear and
  noticeable pop."**
- with the band **"that sudden one-frame pop is absent. Instead, the additional foliage fades in gradually
  over the frames leading up to the halfway point."**

**And a correction to my own claim from earlier today.** `gatesweep/` §2 concluded "no stipple" from the
crown's Laplacian energy moving at most +3.4 %, and `bandwalk/` §4 said the banded crown reads "fuller,
not stippled" from still crops. In motion a reviewer **does** see it: *"a subtle stipple/checkerboard
pattern is visible… but only on the new foliage during the frames where it is actively transitioning…
a mild grainy or 'fizzing' effect"*, and explicitly **not** severe or distracting swimming, helped by the
distance and the height fog. So the honest statement is **not** that there is no stipple — it is that the
stipple is small enough to sit under a static energy measurement, is confined to the foliage that is
fading and to the frames it is fading in, and is far less objectionable than the pop it replaces. My
"no stipple" phrasing was too strong and is corrected in both files.

## 7. The verdict

**The fade stays on.** #206's measurements were sound and its correction of the proposal came first, but
its decisive ratio compared a concentrated change with a diffuse one, and with the denominator an eye
actually uses the event is a 71 % excess over the local rate rather than 0.5 % of the motion — and at real
speed it is, in an independent reviewer's words, "a very clear and noticeable pop". The band removes it
for a mild transient grain on the fading foliage, three sealed frames moving 0.39–1.76 % of their pixels
at >2/255 (two of five byte-identical), `D_log` about 0.003 further from its reference, and +1 to +3 draws
with +8 K to +98 K triangles against 139 draws and 0.275 M of W38 headroom.

**What fable-cursor needs from this:** #206 is superseded and its branch can be closed — I am not closing
anyone's PR. If the owner would rather not spend a sealed frame's 1.76 % on a temporal improvement, the
way back is one line, `TREE_LOD_DITHER = false`, and `lodFade.test.mjs` already passes either way.

## Files

- `spikeratio.mjs` — §4's tool.
- `spikeratio.json` — §4's full per-step series and ratios, all four cells, both builds.
- `strip-frame-band.json`, `strip-frame-noband.json` — the two 28-frame strips at 0.1 m.
- `pop-noband.jpg`, `pop-band.jpg` — steps 21, 22, 23 either side of the crossing, on each build.
- `rung-swap-realtime.mp4` — §6's clip: the two builds side by side at 30 fps, the strip looped four
  times so a 0.9-second event is watchable without being slowed down.

## Reproducing

```bash
npm run build                                   # band on
npx vite build --outDir dist-nodither           # with TREE_LOD_DITHER = false
P="--pose art/environment/owner-2026-09-23/pass3/owner-0650-poses.json --poseName owner-0650-north --steps 30 --stride 0.1 --settle 8"
node art/environment/squad2-2026-09-23/bandwalk/walkstrip.mjs dist          /tmp/frame-band   $P
node art/environment/squad2-2026-09-23/bandwalk/walkstrip.mjs dist-nodither /tmp/frame-noband $P
node art/environment/squad2-2026-09-23/bandwalk/spikeratio.mjs --band /tmp/frame-band --noband /tmp/frame-noband --cells 4
```

`--from <metres>` on `walkstrip.mjs` starts a fine strip where a coarse one found the crossing. Two Chrome
jobs at once and no more; each 28-frame strip is about 40 minutes on SwiftShader.
