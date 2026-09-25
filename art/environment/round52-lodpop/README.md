# Round 52 — fable-4: do the white-barks' LOD switches pop? (owner rubric row 28, "culling / LOD without sudden gaps")

Head `a5dbf45f`. The hero variant 7 at (−7.4, 12.9), approached along +x with the camera at eye 1.6 m
looking at its crown. The switch distances come from the audit (`whiteBarkLodInstances` /
`whiteBarkLeafCount` while stepping the pose): **high ↔ medium at 25.848 m**, **medium ↔ low at 46.270 m**
(20 / 44 m plus half the crown radius × scale).

Method: two frozen-clock frames 4 cm apart *across* each switch, against a control pair 4 cm apart on
one side of it. Camera parallax alone (grass at 1–3 m) moves a lot of pixels over 4 cm, so the pop is
the excess over the control.

| switch | pair across it (pixels > 12) | control pair (no switch) | excess |
|---|---|---|---|
| high → medium, 25.85 m | 7.61 % | 7.79 % | **none** |
| medium → low, 46.27 m | 8.30 % | 8.29 % | **none** |

`hero-high-vs-medium-at-25.85m.jpg` (medium left, high right, crop): the same crown. The medium LOD's
1.8× laminae at 1-in-4 and the low's 2.53× at 1-in-8 (round 51's lodthin) match the high LOD at their
switch distances to within parallax noise — there is no white-bark contribution to row 28's "sudden
gaps", and no crossfade is needed. The consecutive-frame approach (24 → 16 m in 0.5–1 m steps) showed
no spike at the switch either (34–47 % per step, all camera motion).

Tools (not committed): `_f4switch.mjs` — bracket a LOD switch by the audit's counts along a line,
then shoot and diff frozen pairs across it and beside it.

## Postscript — the near-canopy swap (owner 20:08, "why don't the trees immediately spawn")
The owner's red circle was the lantern tree's root drawn as its smooth far base at 15 m on the small
near-LOD tier — fable-cursor's `39e63437` makes the large tier the default and draws every near base
inside 40 m. The other approach-triggered swap is the near-canopy lobes (`NEAR_CANOPY_IN_M` 26 /
`OUT_M` 30 from a lobe's centre). Head `39e63437`, the plateau oak approached from the north at x 19,
eye 1.7 m looking at its crown: lobes swap in one after another (18 shown at 44 m from the trunk, 38 at
36 m); the first lobe's swap bracketed to 43.805 m from the trunk. Frozen frames 4 cm apart across it
vs a control pair beside it: **15.86 % vs 16.84 %** of pixels > 12 — the swap adds nothing above the
camera's own parallax; the pool had the part resident (prefetch 42 m, no synchronous build at the swap).
No tree-side pop remains for a walker after the base fix.

## Postscript 2 — does the crown pool keep up with a walk? (fable-cursor's levers b / c, 22:05)
Head `94d96536` (the first radius pre-built at load) plus an audit field `nearCanopy.late` = parts inside
their swap-in radius whose near buffers are not resident (`agent/fable-4-latecount`). The camera walks the
north path from the spawn (z −5) north, one rendered frame per step, reading the pool each frame:

| step per frame | speed vs walking (1.4 m/s at 60 fps) | frames | late parts (max / frames with any) | synchronous builds | built |
|---|---|---|---|---|---|
| 1.0 m (to z −68) | ≈ 20× | 64 | 25 / 36 of 64 | **15** | 35 |
| 0.25 m (to z −30) | ≈ 5× | 101 | **3 / 7 of 101** (z −19.5…−21, the columns' lobes) | **0** | 40 |

Builds cost p50 ≈ 7 / p95 12–14 ms a part on this box's CPU (JS, not SwiftShader), so the 6 ms budget
builds about one part a frame; at walking speed that is ≈ 40 parts per metre against a plaza backlog of
38 after the pre-build. Lever (b), a larger budget while the frame has room, is not needed for a walker —
the builder keeps up with five times his speed with three parts briefly late and no hitch; it would matter
for a teleport or a sprint camera. Lever (c), a cross-fade at the swap, is answered by the first postscript:
with the part resident the swap does not pop (15.86 % vs a 16.84 % parallax control).
