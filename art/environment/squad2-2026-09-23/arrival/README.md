# "Make all the trees load in ASAP so it doesn't look bad" — measured in pixels, and it holds

The owner's standing priority sentence has been checked with pool counters (`pool-check.mjs` prints
wanted / resident / pending parts) but never on the screen. `walkpop.mjs` (this lane's, in
`art/environment/squad2-2026-09-23/`) does that: the camera cuts to a walker's eye, one frame is
drawn and saved, the world then runs 12 more frames standing still and a second frame is saved. What
differs between them is what the LOD pools brought in **late**. A cut is harsher than a walk — walking
in gives the pools the whole approach — so the number is an upper bound on what a walker meets.

## The result: nothing arrives late

Head `905d55ea`, 960 × 540, two poses on the owner's north walk:

| pose | pixels differing > 8 | > 40 | draws (arriving → settled) | triangles (arriving → settled) |
| --- | --- | --- | --- | --- |
| north path (2.0, 1.6, −12) looking north | **0.02 %** | 0.01 % | 496 → 496 | 9.18 → 9.18 M |
| clearing (4.4, 4.0, −52) looking north | **0 %** | 0 % | 409 → 409 | 5.27 → 5.27 M |

The first frame after the cut already draws exactly what the settled frame draws — same draw calls,
same triangle count, and a pixel difference of two hundredths of a percent. On this build the trees a
walker sees are not arriving after him.

## The control that makes the number mean anything

The same measurement with the clock running (`dt = 1/30` for every frame instead of 0) reads:

| pose | pixels differing > 8 | > 40 | draws | triangles |
| --- | --- | --- | --- | --- |
| north path | 10.11 % | 0.57 % | 496 → 496 | 9.18 → 9.18 M |
| clearing | 0.74 % | 0.05 % | 409 → 409 | 5.27 → 5.27 M |

Ten percent of the frame moves in 12 frames — and the draw and triangle counts are identical, so not
one of those pixels is geometry. It is the wind in the leaves, the god rays and the grass. Any "pop"
measurement that lets the clock run is measuring the wind; `walkpop.mjs` therefore renders with
`dt = 0`, which still updates the pools (they follow the camera, not the clock) while the animation
holds still.

## A number for whoever owns the play-mode budget

`north-path` at a walker's eye counts **9.18 M triangles / 496 draws** — over the 9.0 M line, like the
flight's foot at 9.60 M in `../playcost/README.md`. The draws are comfortable; the triangles are not,
and the attribution there put the excess in vegetation rather than trees.

## What this does not measure

A pool that builds synchronously when the camera asks for it shows no missing geometry and pays in
frame time instead. That side is `pool-check.mjs`'s (`syncBuilds`) and the perf lane's; this tool only
answers "did the walker see it".
