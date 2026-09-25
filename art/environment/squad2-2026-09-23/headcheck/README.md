# squad2 — lane 2's merged work re-measured on the head the owner will play next

The owner recorded his video on `b9993008` (squad log 22:20) and lane 2's two branches merged after it:
`roofhole` (`daad1dae` — the canopy closes over the open north, the south exit and the grove shelf) and
`lodcheck` (`c570dfa9` — the high→medium rung at 32 m, paid for by the distant gate at 45 m). His standing
instruction is "make it ready, keep working and CHECK EVERYTHING" (10:24), so this is that check for this
lane, on `c3c446be`, with **no code change** — it is a verification record.

The constants arrived intact: `HERO_TOP_KEEP = 0.18`, `ROOF_STAND_GRIDS` with all three rectangles
(north, south, grove), `TREE_LOD_NEAR_M = 32`, `DISTANT_NEAR_M = 45`.

## The three canopy gaps are still closed

Each pose as it read on the branch that fixed it, against the merged head:

| pose | as fixed (mean / top third) | merged head |
| --- | --- | --- |
| `u-open-up` (the open north) | 71.9 / 74.4 | **72.1 / 74.4** |
| `s-logmouth-up` (the south exit) | 98.4 / 120.3 | **96.9 / 116.3** |
| `grove-shelf-up` (the north grove) | 57.9 / 43.0 | **57.9 / 43.4** |

Nothing has re-opened; the south reads marginally darker (more canopy, from other lanes' merges) and the
other two are identical within a fifth of a level. The frames are in this directory
(`head-open-north-up.png`, `head-logmouth-up.png`, `head-grove-shelf-up.png`).

## The LOD pop is at its lowest measured value

The same measure as the 18:20 health check — a pose with the shipped rungs against the same pose with every
tree forced to its highest LOD (`?treelod=10`), both rendered on this head:

| pose | the 28 m rung (18:20) | the 32 m rung on its branch | **the merged head** |
| --- | --- | --- | --- |
| `owner-0650-north` | 2.06 % | 1.85 % | **1.70 %** |
| `owner-0650-west` | 2.24 % | 1.92 % | **1.82 %** |

Lower than this lane left it, which other lanes' work explains — #65 landed "the understory's medium LOD
keeps every lamina" the same evening, and less LOD-dependent detail anywhere in the frame shows up in this
measure. Either way the owner's "the trees … only get detailed when I come up close" is now under two per
cent of the frame at both of his walking poses, from 5.57 % at the 20 m rung when this lane started on it.

## Tests

The lane's four test files on the head: canopy roof 1, LOD pool 18, crown veil 4, leaf colour 3 — all pass.
