# Round 53 — fable-4 (option for squad2 / fable-cursor): the mid-canopy grove keeps 11 m off the walk lines

fable-5 (lane 10, 12:52): mid-canopy crowns 3–7 m from the walk line read as flat card piles at
`u-open-up` and `h-west-front`. At `u-open-up` the head has a mid card tree's bole at arm's length on
the path itself (`u-open-up_head_vs_midwalk.png`, left); the band 3.4–11 m off the walk polylines is
the understory's (real laminae).

**Change** (`src/world/trees/index.ts`, the grove's call site — `distant.ts` untouched): a post-filter
after sampling removes mid trees within `MID_WALK_MIN_M = 11` m of the spine / house / north-path
polylines: 393 → 372 trees, **no other tree moves**. (A rule inside the sampler's `blocked` shifts every
later draw and re-rolls the whole grove — measured: 6 fewer trees, 60 % of `u-open-up`'s pixels moved
for the wrong reason; hence the post-filter.)

## Six views, head `79f44aa5` vs branch (same box, `--settle 6`) — triangles and draws unchanged
| view | head | branch | Δ | pixels > 6 |
|---|---|---|---|---|
| A | 0.1888 | 0.1827 | **−0.0061** | 5.3 % |
| B | 0.1750 | 0.1715 | −0.0035 | 8.5 % |
| C | 0.1788 | 0.1875 | **+0.0087** | 4.5 % |
| D | 0.2433 | 0.2529 | **+0.0096** | 12.2 % |
| E | 0.1938 | 0.1932 | −0.0006 | 8.5 % |
| F | 0.2066 | 0.2093 | +0.0027 | 2.3 % |

Sum +0.0108, but A and B lose: the mid trees by the spine gave those frames foliage their references
carry near the path. The walk gains what fable-5 measured (the card at the lens is gone). A smaller
clearance (8 m) would keep more of A/B's near trees — untested. squad2's / fable-cursor's call; the
branch is `agent/fable-4-midwalk` @ `87bc2a64`.
