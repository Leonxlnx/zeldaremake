# squad2 — the LOD rungs re-measured, and where the last of the pop lives

Lane 2's other half (`trees/index.ts`, the LOD and the pools) had not been re-measured since the treepop
round at 04:00, and the head has since grown the south expansion, two vegetation passes, more props and a
third mist tier. This is the health check, and it ends with the residual attributed to one rung.

## The rungs have not regressed

The measure is the owner's own complaint made quantitative — "the trees … only get detailed when I come up
close": render a pose with the shipped rungs and again with **every tree forced to its highest LOD**
(`?treelod=10`), and diff. What changes is exactly the detail that appears only when he walks in.

| pose | shipped rungs vs every tree high |
| --- | --- |
| `owner-0650-north` | **2.06 %** of the frame |
| `owner-0650-west` | **2.24 %** |

The treepop round left 1.82 % at these rungs on a smaller world, so nothing has regressed. The diff puts
almost all of it in two columns at the corridor's mid-distance tree line (`north-close-only-detail.jpg`):
the crowns of trees at roughly 30–40 m, which fill out as he approaches.

![the close-only detail at the owner's north pose](north-close-only-detail.jpg)

## Which gate owns it — measured by elimination, not argued

Each gate has its own multiplier in `?treelod=<near>,<mid>,<distant>,<canopy>`, so each can be opened on
its own and the frame compared against every-tree-high:

| gate opened | `owner-0650-north` vs every tree high |
| --- | --- |
| none (shipped) | 2.06 % |
| the medium→low rung, 44 → 59 m | 2.06 % |
| the distant / mid near gate, 72 → 720 m | 2.03 % |
| **the high→medium rung, 28 → 40.6 m** | **0.10 %** |

**The whole of the residual pop is the high→medium rung at 28 m.** A tree between 28 and 41 m is on its
medium LOD and takes its detail as the walker closes to 28 m; the medium and high LODs of a tree past 44 m
read the same, which is why the rung I tried first bought nothing.

## The 59 m rung: tried, priced, backed out

Before the elimination above I moved the medium→low rung to 59 m, priced first with `pose-counts.mjs`: the
walking poses take +0.51 % and +0.75 % of their triangles (+45 k, +51 k) and the six hero views +1.4 k (A)
through +54 k (D), leaving 123 k of headroom at the tightest and rising by at most four draws
(`counts-walking-shipped.json`, `counts-hero-mid59.json`). Then the frames came back **identical to the
second decimal**, so it is out; nothing that costs 50 k triangles and moves no pixels should ship. The
constant's comment carries the measurement so the next reader does not repeat it.

## What is next, with its number

Moving the high→medium rung from 28 m to ≈ 40 m removes 95 % of the remaining pop (2.06 % → 0.10 %). It
also buys the most expensive LOD for every tree in a 28–40 m ring, so it needs the same pricing the 59 m
rung got — `pose-counts.mjs` on the six hero views first, because A sits 123 k triangles under the 9 M cap
and lane 4's vegetation already owns most of that headroom. That pricing is the first thing for the next
hour; the treepop round's own trade (the near rung 20 → 28 m paid for by pulling the distant gate 120 → 72 m)
is the pattern to follow if the ring proves too expensive on its own.
