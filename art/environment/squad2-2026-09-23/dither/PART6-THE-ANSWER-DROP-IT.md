# One tree's rung swap is 0.22 % of the frame. A walking frame already changes 46 %. Drop the fade.

The third attempt at `PROPOSAL.md`'s fourth check worked, and it answers the question against the
feature. Recommendation: **drop it** — the cost to the owner's sealed frame is real and measured, the
benefit is two orders of magnitude below the motion it happens inside.

## The test that worked: park the camera, move the gate

Parallax is what defeated the first two attempts (`PART5`). This one leaves the camera at
(2, 1.75, −26.165) looking at the white-bark at (−16.94, −52.02) — 32.05 m of geometric distance — and
sweeps the rung gate through it with `?treelod=<mult>`, one boot per multiplier, hard-cut build. Frames
then differ **only** by the swap:

| gate step | pixels moving > 8 | mean abs |
| --- | --- | --- |
| 0.84 → 0.88 | **0.22 %** | 0.185 |
| 0.88 → 0.92 | 0.01 % | 0.006 |
| 0.92 → 0.96 | 0.00 % | 0.000 |

The tree crosses between 0.84 and 0.88, and crossing costs **0.22 % of the frame**. Either side of it,
nothing moves — which is also a clean confirmation that the sweep isolates the swap and nothing else.

## Against what a walker is already seeing

From `PART5`, measured on the same tree: a **0.1 m** camera step — one frame of walking at 30 fps —
changes **45.96 %** of pixels, 8.52 % of them by more than 40 levels.

So the event the fade exists to soften is **0.5 % of the change a single walking frame already carries**.
Spreading it over a 2.5 m band (about 25 frames at a walking pace) leaves roughly 0.009 % of the frame
per frame. Nothing in that is available to a player's eye.

## Correcting my own framing

`PROPOSAL.md` justified the work with 1.85 % of `owner-0650-north` changing at the rungs. That number is
real but it is not a swap event: `../lodcheck/` measures **every tree at once**, shipped rungs against
`?treelod=10` (all trees forced high), at a **fixed camera**. A player never sees that transition — trees
cross their gates one at a time, metres apart, and each crossing is the 0.22 % measured above. Quoting
the aggregate as the defect's magnitude overstated it by roughly 8×, and I should have caught that
before proposing the feature rather than after building it.

## The ledger

| | measured |
| --- | --- |
| cost: `D_log`, a sealed frame | 2.33 % of pixels, SSIM 0.4013 → 0.3979 (**−0.0034**) |
| cost: one more instanced attribute, a discard in two programs, +11 K triangles per tree mid-band | #186, #198 |
| benefit: the event it smooths | **0.22 % of one frame**, inside a frame that changes 46 % anyway |

## Recommendation

Drop it. `TREE_LOD_DITHER` stays `false`, which is how every commit in this chain shipped — #181
measured that configuration byte-identical at two poses, and nothing in #186, #191 or #198 runs with the
flag off. The code can stay inert as a documented dead end (it is ~60 lines plus 13 tests, and the
measurement chain is the value), or be removed on request; either way nothing more should be spent on it.

With this, lane 2 has no open defect: the rung pop is measured at its true per-event size and is below
the threshold of what a walking frame shows.
