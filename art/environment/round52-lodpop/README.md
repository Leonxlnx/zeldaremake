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
