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

## Tried: the test given to structures as it stands

Rather than leave the offer hanging, the util went in and `structures/index.ts` called it from its own
`update` and `onCameraMove` (a declared cross-lane touch), then the same three poses were measured:

| pose | baseline | with the cull | delta | pixels |
| --- | --- | --- | --- | --- |
| A_stairs | 575 / 8 631 286 | 575 / 8 631 286 | 0 | 0.00 % |
| F_canopy | 515 / 7 836 917 | 510 / **7 812 055** | **−24 862, −5 draws** | 0.00 % |
| flight's foot | 544 / 9 129 709 | 544 / 9 129 709 | 0 | 0.00 % |

Pixel-identical, as the test guarantees — and it recovers **25 K at one pose and nothing at the other
two**, against the 719 K this system's shade costs. The reason is granularity, not the test: a merged
house, a fence run or the log arch has a bounding sphere tens of metres across, and a capsule swept
from a sphere that big meets the frustum almost wherever the camera looks. What made the same test pay
in the trees was round 52's split of each sector into **one geometry group per giant**, which gave the
capsule something small enough to miss the frame — and the depth-pass cull then keyed on those groups.

So the call was taken back out (a cross-lane change earning 25 K at one pose is not worth its review),
and the recommendation to whoever owns structures or terrain is specific: **the test is free and ready
in `util/shadowReach.ts`; what it needs from you is caster granularity.** Split the big merged casters
into per-building or per-run groups (or register per-part spheres) and the 719 K becomes addressable
the way the giants' 86 K sector was.

## The contract is now under test, without a browser

Everything this branch claims about the culls — "79–193 K a pose off the depth pass and every frame
byte-identical" — is true only if the test never says *no* while some part of a caster's shadow volume
can still touch the frame. `src/world/util/shadowReach.test.mjs` asserts that as behaviour rather than
as source text (8 tests, no browser):

- a caster inside the frame always casts (its own sphere answers);
- a caster behind the camera casts when its shadow sweeps into the frame, and does not when it sweeps
  away;
- raising the ground ends the sweep early, and the floor bounds it when the ground never does;
- the wind pad only ever widens the answer;
- `cull()` arms from what the build set (`staticCasts`) and narrows, never widens — and a caster it
  switched off comes back when the sun moves;
- **no false negatives.** A dense reference walks the same sweep 400 times and asks three whether each
  step's sphere meets the frustum. Over a grid of 1053 casters around the camera it found more than a
  hundred whose shadow volume really does touch the frame, and `shadowReach` agreed on every one. The
  test is allowed to say yes where nothing is there — that costs triangles; it must never say no while
  shade can be seen.

Worth recording: two of my own expectations were wrong on the first run and the code was right. A
caster 45 m behind the camera with a 45° sun falls out of the frame faster than it approaches it, so
its capsule never crosses the view however deep the floor is; the tests use a vertical sun for that
case now, where the geometry is unambiguous.

## Files

- `scenedepth.mjs` — the probe. `<outDir> <foot|A_stairs>`; needs one temporary line exposing the scene
  root (documented in `depthfoot/depthprobe.mjs`'s header) because the capture API does not expose it.
- `A_stairs.json`, `foot.json` — the runs, with per-system caster counts and deltas.
- `scene-shade.log` — both tables as printed.
- `structures-try.json` — the three poses with the test wired into structures (the run above).
- `shadowreach-tests.log` — the contract tests as printed.
