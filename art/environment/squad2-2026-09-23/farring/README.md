# 276 more trees in the far ring move 0.06–0.22 % of the owner's frames: the washout is not missing trees

The owner's standing note from 2026-09-22 asks for "distant and high trees rendered clearly,
substantially less grey washout". The far ring is the cheapest geometry in the world — a far-LOD
distant tree is about **24 triangles** — so if thin density were the cause, this would be the easiest
fix in the project. It is not the cause. Recorded as a negative result with the numbers, and reverted.

## The experiment

One constant: `distantTarget` in `trees/index.ts`, **680 → 960** (+41 %), nothing else. Both builds
rendered the owner's own three poses (`art/environment/owner-2026-09-23/pass3/owner-0650-poses.json`)
at 960 × 540, settle 8, same shots order.

The trees were really placed and really drawn — this is not a no-op that failed to take:

| | head (680) | raised (960) |
| --- | --- | --- |
| `distantTrees` placed | 1,078 | **1,354** |
| `distantLod` [near, far] | [126, 952] | [117, 1,237] |
| `distant-far` submitted at hero A | — | 322 instances / 7,728 triangles |

## What it changed in the frames: nothing a viewer could find

| pose | pixels moved > 4 | mean | local detail | middle-distance band (mean / across-column sd) |
| --- | --- | --- | --- | --- |
| owner-0650-north | **0.064 %** | 80.6 → 80.6 | 4.26 → 4.26 | 89.7 / 30.90 → 89.7 / 30.89 |
| rec-r024-plaza-fork | **0.216 %** | 89.2 → 89.1 | 4.61 → 4.60 | 79.3 / 13.60 → 79.3 / 13.59 |
| owner-0650-west | **0.057 %** | 88.1 → 88.1 | 4.49 → 4.49 | 97.5 / 31.14 → (unchanged) |

Frame cost at the fixed views is unchanged at the precision `pose-counts.mjs` prints: A_stairs
614 draws / 8.97 M and D_log 523 / 8.74 M on both builds (the +2.9 K triangles the extra instances add
at A is inside the ±5 K the printed 8.97 M rounds to).

## Why

The ring spans 60–215 m and the fog reaches its far value at 190 m, so past roughly 120 m a new trunk
is the same grey as the air behind it, and inside 120 m the band is already occupied — the owner's north
pose measures an across-column sd of 30.9 there, which is a well-populated middle distance, not a wash.
Adding trees behind trees in fog buys 0.06 % of a frame.

This agrees with everything else the lane has measured today: the middle distance populates at all four
bearings (`../bearings/`), the overhead reads as leaves (`../uplooks/`, `../roofsky/`), and the flat grey
that remains at a steep up-look is the airlight overlay rather than geometry — 23 display levels of roof
against 70 in the finished frame (`../roofsky/README.md`). **The remaining "grey washout" is the air, and
the air is lane 1's.** Geometry cannot buy it back, at any density the ring can hold.

## What was reverted

`distantTarget` is back to 680. The raised value also costs 276 trees of build time and resident
arrays for no visible return, so it should not be revisited without a change to the fog or the ring's
range first.
