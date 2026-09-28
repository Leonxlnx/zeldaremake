# Every system's shade, priced — a handoff, not a lane-2 change

Lane 2, 2026-09-28. Branch `cursor/squad2-treephases-682b`, PR #210.

This lane's own depth-pass levers are spent (`depthfoot/`), the near-canopy tier is priced in both
directions and left alone (`slots/`), and the flight's foot is still 0.151 M over W38 in play. fable-4's
09-24 split said the sun's depth pass is a third of every frame and that **the solid world is 71 % of
it** — and nobody had put that 71 % under the one instrument that answers the only question worth
asking about shade: *does the frame use it?*

So `scenedepth.mjs` is `depthfoot/depthprobe.mjs` widened to the whole scene: frozen clock, switch one
system's casters off at a time, read the triangle delta and the pixel difference. The control (the same
frame twice, nothing touched) is **0.00 %** at both poses, so the numbers are the shade and nothing
else. **Nothing in this directory changes any code** — the systems below belong to other lanes.

## Camera A (575 draws / 8 631 286 — the binding hero view, 0.37 M under W38)

| system | casters | depth triangles | pixels moved when its shade goes |
| --- | --- | --- | --- |
| **trees** | 39 | **1 195 554** | **54.95 %** |
| structures | 109 | **718 994** | **0.49 %** |
| terrain | 12 | **316 800** | **0.08 %** |
| vegetation | 12 | **304 444** | **0.02 %** |
| rocks | 11 | 93 980 | 0.05 % |
| character | 17 | 86 598 | 1.39 % |
| props | 17 | 44 516 | 0.01 % |
| hardscape | 8 | 18 961 | 0.27 % |
| atmosphere | 1 | 2 304 | 0.02 % |

## The flight's foot (545 draws / 9 129 877 — the one play spot over the line)

| system | casters | depth triangles | pixels moved |
| --- | --- | --- | --- |
| **trees** | 37 | **1 155 382** | **58.74 %** |
| vegetation | 14 | 723 378 | 2.17 % |
| structures | 109 | **718 994** | **0.52 %** |
| terrain | 12 | **345 600** | **0.52 %** |
| character | 23 | 96 756 | 0.02 % |
| rocks | 11 | 93 980 | 0.11 % |
| props | 17 | 44 516 | 0.20 % |
| hardscape | 8 | 28 091 | 0.57 % |
| atmosphere | 1 | 2 304 | 0.00 % |

## What it says

**The trees' shade is the picture** — 55–59 % of pixels for 1.16–1.20 M at both poses. That is what
well-spent depth work looks like, and it is why this lane's culls were careful to take only the shade
that provably misses the frame.

The rows worth attention are the ones with a big number on the left and a small one on the right:

- **structures: 719 K of depth for 0.49 % of camera A and 0.52 % of the foot**, across 109 casters.
- **terrain: 317 K at A for 0.08 %** (346 K at the foot for 0.52 %), across 12.
- **vegetation: 304 K at A for 0.02 %** (its 723 K at the foot does earn 2.17 %).

At camera A those three spend **1.34 M of an 8.63 M frame** on shade that moves under 0.6 % of the
pixels between them, with 0.37 M of W38 headroom in the balance; at the foot structures and terrain
spend 1.06 M for about 1 %, against the 0.151 M that spot needs to clear the line.

**The honest caveat, from this lane's own numbers.** A low pixel effect does not mean all of it is
recoverable. In the trees at the foot, caster groups totalling 331 K moved 0.00 % and the geometric
cull recovered **92 K** of that — the part whose shade provably misses the frame; the rest belonged to
casters standing inside the frame whose shade happened to land where it did not matter, which no
geometric test can claim. On the same ratio structures' 719 K might yield ~200 K at A — still more than
the foot's breach.

**The mechanism is written and tested.** `trees/index.ts` has `shadowReachesGround`: the caster's
padded sphere swept down-sun, the sweep ended where the ground stops it, walked with covering spheres,
short-circuited when the caster is on screen — rejected only when the whole bound lies outside the view
frustum, so it cannot move a pixel. Whoever owns structures or terrain is welcome to it; lifting it to
a shared util is a ten-line change and this lane will do that work if it is wanted. `gates.test.mjs`
shows how to pin it.

## Files

- `scenedepth.mjs` — the probe. `<outDir> <foot|A_stairs>`; needs one temporary line exposing the scene
  root (documented in `depthfoot/depthprobe.mjs`'s header) because the capture API does not expose it.
- `A_stairs.json`, `foot.json` — the runs, with per-system caster counts and deltas.
- `scene-shade.log` — both tables as printed.
