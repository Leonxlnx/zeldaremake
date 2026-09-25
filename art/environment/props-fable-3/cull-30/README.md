# Locality cull 45 → 30 m (owner 10:24 "check everything"; the south far-bank look-back over budget) — fable-3, 2026-09-24

`b143fab8` on `agent/fable-3-south-props`. fable-cursor's 11:20 full check put the south far-bank look-back at
818 draws / 9.30 M ("exp-south2 owns it; lanes welcome"). The props' share: the village locality's bounding sphere
(centre (6.6, 5.0, −5.6), radius 18.3) has its near edge 33 m from a camera on the far bank, so at the old 45 m the
whole village dressing — 6 meshes, 5 casting — was drawn there as a few dozen pixels. At 30 m it is culled; every fixed
view and owner pose stands within 25 m of that sphere (A −2.5 m inside it, B −7.6, C −12.4), so none of them changes.
The south exit's locality (radius 9.9) is 35 m from camera C and now culls there too — C's frame already hid those
props behind `plaza-south`'s trunk (asserted in `geometry.test.mjs`).

Measured with `gauntlet/scripts/pose-counts.mjs` on the same merged head (`3c6cc553` + this branch), one world load per
build, the far bank approximated by `farbank-pose-approx.json` (on the far path at (4.3, 45.2), 1.6 m up, looking north
to the fork — fable-cursor's exact pose is not in the repo, so the absolute numbers differ from their 818 / 9.30 M; the
delta is the props'):

| pose | 45 m | 30 m | Δ |
| --- | --- | --- | --- |
| A_stairs | 641 / 8.87 M | 641 / 8.87 M | 0 |
| C_lookback | 574 / 7.93 M | 565 / 7.91 M | −9 draws, −0.02 M |
| south far-bank look-back (approx) | 853 / 10.18 M | 842 / 10.09 M | −11 draws, −0.09 M |

B / D / E / F: the 30 m build read 630 / 563 / 630 / 601 — equal to the head's own counts with PR #40's butterflies
(+1 on the pre-merge numbers), which is the head's change, not this one. The clearing's cull assertions and the
south exit's per-camera visibility assertions pass unchanged (140 / 140).

Pop-in: walking back from the far bank, the village pots appear when the camera comes within 30 m of the sphere's
edge — at z ≈ 42 on the far path — as specks a few pixels wide, where at 45 m they appeared at z ≈ 57, off the map.
