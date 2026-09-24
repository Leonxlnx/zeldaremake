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

## What is left of the pop

The 1.82 % that remains is the rung itself, now at 28 m instead of 20 m. Removing it entirely needs
either triangles that do not exist at camera A or a *smaller step* between the rungs — `writer.ts
addLeaf` keeps every 4th lamina at medium and enlarges it 1.8×, and that ratio, not the distance, is
what a walker sees change. Narrowing it (a fourth rung, or a gentler `mediumEvery` / `mediumScale` for
the white-barks) is `writer.ts` / `whitebark.ts` — shared infrastructure and fable-4's asset, not
lane 2's to change unilaterally. The numbers above are the case for doing it.
