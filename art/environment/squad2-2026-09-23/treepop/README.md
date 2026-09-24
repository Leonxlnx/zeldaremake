# squad2 — "why don't the trees immediately spawn instead of needing me to get close"

The owner, 2026-09-23 20:08. `39e63437` (fable-cursor) fixed the near-**base** half: his red-circled
root sat on a smooth far base at 15 m because the small near-LOD tier was the default and its bands
were 10–17 m. This is the other half — the instanced tree LOD ladder — measured rather than guessed.

> **fable-cursor: this file is the PR description for `agent/squad2-treepop`.** The squad chat's
> pull-request tool is still refused by GitHub on this repository (`Validation Failed …
> "must be a collaborator"`, POST `/pulls`) on every attempt, so no draft PR could be opened. The
> branch is pushed and complete; please open it (base `cursor/kokiri-world-phase1-f65e`) or merge it.

## How the pop was measured

Two new things, both in lane 2's files:

* **`?treelod=<near>,<mid>,<distant>`** (`trees/index.ts`) — a dev multiplier on the instanced tree
  LOD gates, the same shape as the existing `?pool=large|small`: the white-barks' and columns'
  high→medium rung, their medium→low rung, and the distant / mid layers' near→far gate. `1` is
  shipped and the take / CI path never sets it, so one build can render any configuration and nothing
  else can differ between two frames.
* **`diffmap.mjs`** (this directory's parent) — the changed share of a frame and the `grid`×`grid`
  cells ranked by it, plus a three-panel sheet with the changed pixels tinted red.

At the owner's 06:50 north pose (`art/environment/owner-2026-09-23/pass3/owner-0650-poses.json`,
960 × 540, character hidden, settle 6), pixels differing by more than 8 levels:

| what is moved out | share of the frame that changes | cost at camera A |
| --- | --- | --- |
| every gate (each tree at its highest LOD) | **5.57 %** | — |
| only the high→medium rung, 20 → 60 m | **5.57 %** | — |
| only the medium→low rung, 44 → 132 m | **0.00 %** | +0.27 M triangles, −21 draws |
| only the distant near gate, 120 → 72 m (inward) | **0.04 %** | −15 draws |

So the **first rung owns the entire visible pop**, the second owns none of it, and the distant
layer's near LOD between 72 and 120 m buys nothing. The changed pixels are the crowns at 20–45 m and
the shade they drop: cells x 0.25–0.38 and 0.63–0.75, y 0–0.25, 28–44 % of their pixels changed at a
mean Δ of 20–29 levels. Pulling the medium rung IN (44 → 26 m) is *not* free — 1.38 % of the frame,
and the residual gets worse — so the low LOD does earn its keep from 26 m out. It is only the rung
past 44 m that is invisible.

## The change

Two constants in `trees/index.ts`, and the second pays for the first:

* `TREE_LOD_NEAR_M` 20 → **28 m**. A white-bark's high LOD is ≈ 150 K triangles, so every tree
  promoted is expensive and camera A sits 0.05 M under W38's 9 M gate: at 34 m A reaches 9.27 M, which
  is why 28 is the number.
* `DISTANT_NEAR_M` 120 → **72 m**, which frees it. The mid grove's own 40 m gate and the north stand's
  50 m gate are both below the new value, so neither moves.

**Residual pop at the owner's pose, against an all-high reference rendered in the same session:
6.37 % → 1.82 % of the frame** (SSIM 0.9463 → 0.9843).

## Cost

`pose-counts.mjs --settle 6`, one build with the knob selecting configurations. **Re-measured on the
merged head `67c2e241`** (the first reading was on `6d145e90`, before lane 7's skinned kids, lane 1's
corridor air and lane 6's log joint landed):

| pose | before (20 / 44 / 120) | after (28 / 44 / 72) | Δ draws | Δ triangles |
| --- | --- | --- | --- | --- |
| A_stairs | 628 draws / 8.98 M | 640 / **8.93** | +12 | **−0.05 M** |
| D_log | 546 / 8.54 | 561 / 8.60 | +15 | +0.06 M |
| owner-0650-north | 510 / 8.79 | 532 / 8.80 | +22 | +0.01 M |
| rec-r024-plaza-fork | 624 / 8.08 | 639 / 8.07 | +15 | −0.01 M |

**Correction to the first reading.** On `6d145e90` this change *reduced* draws (A 695 → 680) because
the old draw counts were near the 700 gate and emptying LOD meshes saved calls. On the merged head the
baseline is 628 at A — lane 7's skinning removed ~80 — and the sign flips: the change now costs **+12
to +22 draws**, peak 640 of the 700 gate. Triangles are flat to slightly better, and at camera A —
the binding pose, 0.02 M under the gate on the head — they **fall** 8.98 → 8.93 M. Nothing here is
close to either gate.

## What the frames show

`owner-0650-north.jpg`, `A_stairs.jpg`, `D_log.jpg` — before | after | what changed, from
`poses.json`. Changed share: the owner's pose 4.92 %, A 2.45 %, D 12.23 %. In every one the crowns at
20–28 m gain their fine laminae and drop dapple on the path; nothing is hidden or removed. D moves
most because its composition looks straight down the band the rung sits in.

## Also in this change

* `systems.trees.lodSwapM` — every gate as a build resolved it (quality and the dev multiplier
  applied), so a review never has to infer them.
* `systems.trees.whiteBarkLodTriangles` / `columnLodTriangles` — mean per-instance triangles of each
  rung, so the cost of moving a rung is arithmetic.

## Lever (c), the cross-fade at the crown swap — measured before building it

fable-cursor's 22:05 INBOX note offers lane 2 two levers on top of the 1.5 s prebuild: (b) a larger
build budget while the frame has room, and (c) a cross-fade at the giants' near-canopy swap band
(`NEAR_LOD_TIERS.large.canopySwapM`, 26 / 30 m). The knob's fourth component scales that band, so the
same measurement applies. At the owner's 06:50 north pose and at `rec-r024-plaza-fork`, widening it to
41.6 / 48 m changes **0.00 % of the frame — every cell exactly zero.**

That is not "the swap is invisible", and the audit says why. With the band at 26 m and at 41.6 m the
shown set is byte-identical: 426 parts exist, 79 are shown (67 lobes), `shownTriangles` 692 909 and
`foldedTriangles` 119 166 in both, and **every shown part sits between 4.5 m and 16.4 m of the
camera**. There is nothing between 16.4 m and the 26 m in-radius to swap, so a cross-fade over 26–30 m
would have nothing to fade at the pose the owner complained about. `audit-canopy-band-26.json` and
`audit-canopy-band-41.json` are the two reads.

Where the band *would* bind is a walker crossing open ground toward a giant whose lobes sit at 26–30 m
— the arch approach and the north clearing are the candidates. So lever (c) is worth building for
those, not for his pose; I would rather spend the next iteration on something he sees.

One thing the same audit did flag: **67 lobes wanted inside 16.4 m against `NEAR_CANOPY_SLOTS` = 64.**
That turned out to be the real mechanism — next section.

## The slot cap is what decides, and it had no hysteresis

`canopy-walk.mjs` (new, in this directory's parent) walks Link from the plaza to the north clearing in
1 m steps and reads the trees audit at each one. It runs in **play mode** on purpose: a walk
re-buckets with `reset = false`, which is where the selection's hysteresis lives, while the capture
harness's `setPose` goes through `onCameraMove` → `reset = true`. `__ZR_PLAY__.step(n, dt, false)` steps
the simulation without drawing, so a 44 m walk costs no rasterisation at all.

On the head, over 44 m:

| | |
| --- | --- |
| lobes ACTIVE (eligible) per step | **135 – 218** |
| slots (`NEAR_CANOPY_SLOTS`) | 64 |
| lobes turned away | **71 – 154, at every one of the 45 steps** |
| parts shown | 79, saturated at every step |
| farthest shown part | **16.3 m at the plaza, rising to 42.2 m in the clearing** |
| admissions + evictions | **270 over 44 m = 6.14 a metre** |

Two things were true at once. The shown set is simply "the 64 nearest" and nothing damped it: six crown
parts a metre flipped between their near laminae and their folded far foliage, all within 17 m of the
camera. And the **effective** swap boundary was never the nominal 26 m — it is wherever the 64th-nearest
lobe happens to fall, which is exactly why widening the 26 / 30 band changed 0.00 %.

**The fix — `NEAR_CANOPY_KEEP` = 0.25:** an incumbent ranks as if it were a quarter nearer than it is, so
a challenger must be meaningfully nearer to take its slot. Both parts are inside their own in-radius
either way, so the frame is as correct as before and stops changing under the walker; the pool also stops
paying for the rebuilds the evictions caused. **Churn 6.14 → 4.55 admissions + evictions a metre, −26 %**
(`canopy-walk-base.json`, `canopy-walk-hysteresis.json`).

It is **not** applied on `reset`, so every capture of a pose is unbiased and the six fixed frames cannot
move. Rendered both ways at the owner's pose, A and D to prove it: **0.0015–0.0060 % of pixels differ at
any tolerance at all, SSIM 0.999999–1.000000** — SwiftShader's own run-to-run noise. `lodPool.test.mjs`
pins both halves: an incumbent holds its slot against a challenger 18 % nearer and loses it to one four
times nearer, and a re-pose ignores the bias.

## The shortage behind it: the cap and its ranking are both already right

At the owner's pose 214 lobes are active and 64 draw their near laminae, so most crowns around him stay
on far foliage whatever the hysteresis does. I expected the next win to be raising the cap (the previous
note guessed a group-range or bitmask slot encoding would make the uniform array go further). **That was
the wrong guess, and the measurement says so before any shader was written.** The audit now reports
`shownCoverage / activeCoverage` — the share of the crown mass around the player, by apparent area
Σ r²/d², that draws near laminae — and three rankings were tried at his pose:

| ranking | shown lobes | lobe triangles | coverage | share of active | coverage per 100 K triangles |
| --- | --- | --- | --- | --- | --- |
| **distance (shipped)** | 67 | 560 405 | 12.02 | **57.6 %** | **2.144** |
| apparent size, `dist / radius` | 67 | 617 388 | 12.80 | 61.3 % | 2.073 |
| coverage per triangle | 3 | 65 440 | 0.32 | 1.5 % | 0.491 |

- **The cap is a triangle budget, not a uniform-array limit.** Uncapped, those 214 lobes would draw
  ≈ 1.81 M triangles of near foliage against 0.56 M now — and camera A sits 0.07 M under W38's 9 M gate.
  A cleverer slot encoding would have bought nothing it could afford to use.
- **Size-weighting buys more, not better.** +3.7 points of coverage for +10 % triangles is 3 % *worse*
  per triangle, and it pushes the shown set out to 19.1 m, away from where a near version earns its keep.
- **Cost-efficiency ranking starves itself.** Preferring cheap far crowns picks parts the pool has not
  built — it prefetches by distance — so `resident` filters them out and 3 lobes survive. Any ranking
  that disagrees with the prefetch collapses.

Distance agrees with the prefetch and puts the detail nearest the eye. It stays, and the finding is
recorded on the rank in `index.ts` so the next person does not re-run it. What is left of the crown
churn after the hysteresis is intrinsic to 64 slots for 214 lobes.

## What is left of the pop

The 1.82 % that remains is the rung itself, now at 28 m instead of 20 m. Removing it entirely needs
either triangles that do not exist at camera A or a *smaller step* between the rungs — `writer.ts
addLeaf` keeps every 4th lamina at medium and enlarges it 1.8×, and that ratio, not the distance, is
what a walker sees change. Narrowing it (a fourth rung, or a gentler `mediumEvery` / `mediumScale` for
the white-barks) is `writer.ts` / `whitebark.ts` — shared infrastructure and fable-4's asset, not
lane 2's to change unilaterally. The numbers above are the case for doing it.
