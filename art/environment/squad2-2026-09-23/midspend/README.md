# The freed headroom cannot be spent in lane 2: the mid layer's rung gate is inert in both directions

`../reviews/pr193-keepinstanced.md` found that hero A now measures **575 draws / 8.636 M** — about
**364 K of triangle headroom**, not the 30 K my notes quoted all yesterday. That reopened the question of
whether lane 2 could spend it on the thing the owner keeps asking for (a middle distance that reads). The
answer, measured, is no.

## The cleanest possible spend, tested

`MID_FAR_LOD_M` gates the mid-canopy layer (400 trees, 13–58 m): inside it a mid tree draws its near LOD
(12-sided bole, limbs, layered crown), beyond it the crossed strips. Pushing the gate out gives the trees
between the old and the new gate a rounder crown — **same trees, same positions, no placement reshuffle**,
so the comparison carries no PRNG shift, which is the cleanest A/B this layer allows.

`MID_FAR_LOD_M` **40 → 52 m**, the owner's own three poses, `broll --settle 8`, matched shots order:

| pose | pixels moved > 4 | mean | local detail | middle-distance band (mean / across-column sd) |
| --- | --- | --- | --- | --- |
| owner-0650-north | **0.003 %** | 80.6 → 80.6 | 4.26 → 4.26 | 89.7 / 30.90 → 89.7 / 30.90 |
| rec-r024-plaza-fork | **0.020 %** | 89.2 → 89.2 | 4.61 → 4.61 | 79.3 / 13.60 → 79.3 / 13.60 |
| owner-0650-west | **0.054 %** | 88.1 → 88.1 | 4.49 → 4.49 | 97.5 / 31.14 → 97.5 / 31.14 |

Cost: A_stairs 8.636 → **8.64 M** (+≈4 K triangles, 575 draws either way); D_log 484 / 8.37 M.

Both sides are zero. The 40–52 m ring holds almost nothing a camera at the plaza can see — those trees
stand behind the nearer canopy, so upgrading their rung moves three thousandths of a percent of the frame.

## What that means for the headroom

Lane 2's candidate spends are now all measured, and all inert:

| spend | measured |
| --- | --- |
| more trees in the far ring (60–215 m) | 0.06–0.22 % of the owner's frames; the fog reaches its far value at 190 m (`../farring/`) |
| a wider outer radius | only 14 trees live past 150 m at all (`../farring/RADIUS.md`) |
| a later mid rung (this note) | 0.003–0.054 % of the frame, for +4 K triangles |
| denser giant foliage | the leaves are already where the fixed cameras look (`../sweep/`, `../giantwood/BY-TREE.md`) |

So the 364 K that other lanes freed cannot be turned into visible quality by this lane: everything lane 2
owns is either in fog, occluded by nearer canopy, or already as dense as the cameras see it. The headroom
belongs to whoever owns what stands **in front** — vegetation (2.46 M of colour at A, the largest single
line), the structures, the people.

## Reverted

`MID_FAR_LOD_M` is back to 40. Nothing here is proposed for merge.
