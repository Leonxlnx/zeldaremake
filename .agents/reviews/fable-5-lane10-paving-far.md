# `agent/fable-2-paving-far` `b3f677a0` — the plaza paving's far LOD beyond 30 m — non-author read (fable-5, lane 10)

**Read 2026-09-26 06:48–07:35 UTC, against its base, the head `2b15f687`** (visually `896c2d6d`; the one commit, 170 lines in `hardscape/`, is
the difference). Beyond `FLAGSTONE_FAR_M` 30 m (planar, from the paving's footprint — the stones alone, not the dais) every stone draws as one
top fan (`flagstones-far`) instead of its walls, rolled shoulder and dished rings; the full mesh is byte-identical and stays what
`character/ground.ts` reads. On the walk the swap has a 3 m hysteresis; on a pose jump the threshold alone decides, so a capture at a pose
does not depend on the pose before.

## The six views — pixel-identical, and the counts identical to the triangle

| view | head | paving-far |
| --- | --- | --- |
| A_stairs | 575 / 8.636 M | 575 / 8.636 M |
| B_house | 557 / 7.954 M | 557 / 7.954 M |
| C_lookback | 494 / 7.725 M | 494 / 7.725 M |
| D_log | 484 / 8.368 M | 484 / 8.368 M |
| E_ground | 557 / 7.954 M | 557 / 7.954 M |
| F_canopy | 516 / 7.840 M | 516 / 7.840 M |

1.0000 / 0.00 % at all six: every hero camera stands inside 30 m of the paving, so the near mesh — byte-identical — is what they draw.

## In play

| pose | head → branch | Δ | frame pair |
| --- | --- | --- | --- |
| the east green (43, 4) → W, the paving 46 m off | 652 / 9.815 M → 652 / **9.645 M** | −170 K (the hardscape row 16 / 0.30 → 0.13 M) | SSIM 1.0000, 0.00 % |
| the far bank (4.06, 42.8) → N, ≈ 41 m | 680 / 9.810 M → 680 / **9.639 M** | −171 K | 1.0000, 0.00 % |
| the plaza (0.5, 3) → S | 494 / 6.904 M → 494 / 6.904 M | 0 (inside 30 m) | 1.0000, 0.00 % |
| the flight's foot (5.8, 0.5) → E | 490 / 8.833 M → 490 / 8.833 M | 0 | 1.0000, 0.00 % |
| the bridge's north sill (4, 20) → N, ≈ 18 m | 636 / 9.574 M → 636 / 9.581 M | +6 K (the wind's phase; no pixel over 8/255) | 0.9969, 0.00 % |
| the bridge at (4, 32.7) and (4, 29.5) → N, the camera 27–31 m from the nearest stones | identical counts and frames | — | 1.0000, 0.00 % |

The far mesh is drawn from the far bank and the green — the two look-backs where the hardscape row was 0.30 M — and **no pixel over
8/255 moves in either frame**: at 40 m a flagstone's shoulder and its rings are under a pixel, the joint lines are the fan edges' and stay.
The two bridge poses fell inside the line (the footprint's south end runs further than the plaza proper), so the swap's own nearest engaged
distance I have is the far bank's ≈ 41 m; the transition band 30–40 m is not in my frames — at 41 m it is 0.00 %, and the 3 m hysteresis
keeps a walk from dithering on it.

## Verdict

**PASS for merge.** Pixel-identical at the six views and at six play poses, −0.17 M at both far look-backs, the hero cameras unaffected by
construction. The hardscape row at the far bank is now 0.13 M where the first bill had 0.30 M — the fourth of the bill's small rows
(rocks, props, hardscape, character) to be paid without a pixel.
