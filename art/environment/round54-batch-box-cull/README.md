# Round 54 — the batched tree parts cull by their own boxes (fable-4)

PR #201 `agent/fable-4-nearbox` `ad40ecda` (merged with the 03:51 head as `50f2be7a`) against the
head `896c2d6d`. `src/world/trees/index.ts` only.

## How it was found — the near-canopy band as a decision card (withheld)

The trees' rows at the look-backs (INBOX 03:15) left three look calls; the third — the near canopy's
set at range — I measured before proposing, with the dev knob `?treelod=1,1,1,0.6` (the in / out
radii × 0.6: 26 → 15.6 m, 30 → 18 m), the head + #188, pose harness at t = 12.5
(`band-card-*.stats.json`):

| pose | shipped draws / M tris | × 0.6 | Δ | px > 24/255 |
|---|---|---|---|---|
| A_stairs | 575 / 8.634 | 575 / 8.624 | −10 K | 0 |
| green-west (43, 4) → plaza | 649 / 9.830 | 649 / 9.482 | **−348 K** | **0** |
| far-bank-north (4, 43) → N | 670 / 9.808 | 670 / 9.512 | −296 K | **21,760 (2.4 %)**, mean 1.5 |
| owner-0650-north | 457 / 8.624 | 456 / 8.605 | −19 K | 0 |

At the far bank the boughs' sprays at 16–26 m thin visibly (`band-card-far-bank.ship-over-0.6.jpg`,
shipped above, × 0.6 below) — the owner's "detail up close", so the card is withheld. But at the
green the near set drawn was 348 K triangles for **0 pixels**: every shown near part there was
off-screen. three culls a batch instance by its SPHERE, and a lobe's padded sphere (`CULL_PAD_M`
4 m on a 3–6 m crown lobe) passes the frustum far past its laminae. Counted on the head at camera A:
78 near parts shown, 15 pass the sphere test, **3 pass a box test**.

## What the PR does

Before each colour pass the two near-canopy batches (the giants', the columns') and the three
far-foliage batches test each part's own box — its vertices' bounds with `BATCH_BOX_PAD_M` (0.5 m,
over the giants' sway ≤ 3 cm at lobe height, the twiglets' flex ≤ 10 cm and the laminae's flutter)
— through `boxMeetsFrustum`, the round-52 group cull's SAT test; a part whose box misses the frame
is left out of the draw list. `NearCanopyBatch` keeps each resident part's box and the LOD's verdict
(`setVisible`) and applies both in `onBeforeRender`; `FarFoliageBatch` applies the fold and the box
the same way. The depth pass is untouched (the near parts do not cast; the far laminae's depth list
is #188's per-lobe sweep).

## Six fixed views — `896c2d6d` vs `ad40ecda`, 1280 × 720, `capture.mjs --settle 12`

SSIM against `reference/frames` identical to four decimals at all six; 0 px above 24/255 at all six.

| view | head draws / M tris | branch draws / M tris | Δ triangles | px differing at all |
|---|---|---|---|---|
| A_stairs | 575 / 8.64 | **575 / 8.51** | **−130 K** | 38 at ≤ 4/255 |
| B_house | 557 / 7.95 | 557 / 7.78 | −170 K | 87 (the pipeline's hazed patch, as in every one-page run) |
| C_lookback | 494 / 7.73 | 494 / 7.59 | −140 K | **0** |
| D_log | 484 / 8.37 | 484 / 8.18 | −190 K | 108 at ≤ 9/255 |
| E_ground | 557 / 7.95 | 557 / 7.78 | −170 K | 87 (the same patch) |
| F_canopy | 516 / 7.84 | **514 / 7.64** | −200 K | 34 (the same 24 × 19 px patch as before) |

**Camera A: 8.51 M, 490 K under the 9 M gate** (30 K before #171). F loses two draws: two batches
with nothing left in frame issue no call. The counts at 1–9/255 are scattered single pixels away
from the frame's edges (A: none at an edge; D: 2) — the one-page pipeline's pool-state noise seen in
every pair, not laminae clipped at the border.

## The pose harness — 1280 × 720, t = 12.5, the near-canopy batches hidden as a control

`poses-head.stats.json` / `poses-branch.stats.json`.

| pose | head draws / M tris | branch draws / M tris | Δ | near-canopy batches' triangles | px > 24/255 (> 0) |
|---|---|---|---|---|---|
| A_stairs | 575 / 8.636 | **575 / 8.510** | **−126 K** | 183 K → 94 K | 0 (6) |
| green-west | 649 / 9.832 | 649 / 9.706 | −126 K | 433 K → 333 K | **0 (0)** |
| far-bank-north | 670 / 9.810 | **670 / 9.617** | **−193 K** | 484 K → 302 K | 0 (63) |
| owner-0650-north | 457 / 8.624 | 456 / 8.508 | −116 K | 118 K → 10 K | 0 (165) |

(`far-bank.head-branch-heat.jpg`: head | branch | differences, none above 24/255.) The rest of each
Δ beyond the near batches' is the far-foliage batches' colour pass through the same box test.

## Checks

`npm run typecheck` green; `vite build` green; trees' tests 45 / 45.
