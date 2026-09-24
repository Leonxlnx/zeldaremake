# fable-2 non-author check — squad3's analytic bark grain + sun-side far bark (`agent/squad3-near-bark` @ `b788f598`)

The claim (`art/environment/squad3-2026-09-23/README.md` round 53): shader-only — an analytic bark grain in over 5–9 m and out over
38–55 m, the giants' far bark taking the sun's side, the moss fields expanded about their mean; "hero cost A 0.19, B 0.36, C 0.62,
D 0.42, F 0.15 mean levels"; no draw, no triangle.

Measured with the renderer, the tip against its merge-base `6d145e90` (both built and captured here, sequential, settle 12; the
SSIM is against the sealed take, read the deltas):

| view | draws / tris (both) | SSIM base → tip | px > 8 levels | px > 40 | mean Δ level |
|---|---|---|---|---|---|
| A_stairs | 695 / 8.95 M | 0.1820 → 0.1812 (−0.0008) | 0.83 % | 0.01 % | −0.08 |
| B_house | 685 / 8.19 M | 0.1765 → 0.1759 (−0.0006) | 1.64 % | 0.05 % | −0.14 |
| C_lookback | 527 / 6.77 M | 0.1864 → 0.1763 (**−0.0101**) | 3.28 % | 0.00 % | −0.06 |
| D_log | 561 / 8.49 M | 0.2476 → 0.2451 (−0.0025) | 1.83 % | 0.12 % | −0.11 |
| F_canopy | 648 / 7.89 M | 0.2032 → 0.2031 (−0.0001) | 0.77 % | 0.01 % | −0.03 |

Read: the counts hold (identical draws and triangles at every view, as a fragment-only change must). The mean-level numbers hold too
— and they are the wrong instrument for this change: **C moves −0.0101 SSIM**, three times the −0.003 rule, with a mean shift of
0.06 levels. What SSIM sees is structure: the giant that fills C's right half goes from a smooth pale ramp with faint streaks to a bole
with vertical cords and a lit sun side (`review-sq3-nearbark-CD.jpg`, middle row). That is the change the round set out to make and,
to my eye, the better bole; but it is a look change at a hero view by the loop's rule, so it is fable-cursor's to name (or the owner's
to nod), not a claim of "under the eye". D (−0.0025) is at the edge of the rule; A / B / F are clear.

If the C frame is to be spared while the 15 m far base (the owner's 20:08) still gets its grain: C's bole stands inside the grain's
5–9 m fade-in, so starting `BARK_GRAIN_M` at ≈ 10 m would leave C's giant to the map's own fissures and keep the fix where it was
aimed. squad3's three far-base poses (`poses-farbase.json`), tip vs base: 1.0 / 1.7 / 1.1 % of pixels > 8 levels, ≤ 0.06 % > 40 —
the 20 m bole in `l3-nwnear-20m` shows the cords, subtly (`review-sq3-nearbark-poses.jpg`).

Renders `/tmp/cap-sq4base`, `/tmp/cap-sq4base-c`, `/tmp/cap-sq3tip`, `/tmp/f2/sq3-{base,tip}`. Not measured: E.
