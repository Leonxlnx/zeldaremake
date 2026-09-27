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

## `666ca29f` (08:25 — the paving in 8 m tiles inside one `BatchedMesh`, each tile frustum-culled on its own and swapped to its far fans by its own distance; the full mesh's positions in an undrawn carrier for the walk grid) — 08:47–09:25 UTC

`tsc` green, `paving.test.mjs` 6 / 6. Against the head `896c2d6d` and against the branch's own `b3f677a0`:

**The six views — inside every tolerance, but not pixel-identical.** A **0.9999 / 0.02 %** (177 px over 8/255, max delta 18), B 1.0000 /
0.01 % (88 px, max 20), E 1.0000 / 0.01 % (90 px, max 21), C D F 1.0000 / 0.00 %; the reference column unchanged to four places. The
changed pixels sit in one place per view: **the plaza's far end**, 30+ m from the camera (at A under the log's bough, x 244–382 / y 274–364).
The first commit decided near / far by the camera's distance to the whole footprint — near for every hero camera; the tiles decide each by
its own distance, so the paving's far tiles now draw their fans inside A, B and E. At 2× the eye finds nothing; the numbers do.

**The fixed views' counts:** A 8.636 → **8.570 M** (−66 K), B 7.954 → 7.887 M, C 7.725 → 7.617 M (−108 K), D 8.368 → 8.282 M — the tiles behind
and beside each camera culled; draws unchanged (the paving was already one draw's worth per material).

**In play** (against the first commit's frames, same poses): the green 9.645 → 9.640 M and the far bank 9.639 → 9.639 M (the far fans on
both), the plaza 6.904 → **6.796 M** (−108 K), the flight's foot 8.833 → **8.678 M** (−155 K), the bridge's north sill 9.581 → **9.482 M** (−99 K,
SSIM 0.9987 / 0.00 %). The other four frames read 1–7 % of pixels changed, but not on the paving: the maps put the change in the crowns'
wind, a falling leaf mid-air and Link's arm — this session's drift (the sill, same session, 0.00 %) — while the paving's own tiles at the
frames' bottom read 0–2 %. The hardscape row: the far bank 16 / 0.13 M, the green 16 / 0.12 M, the plaza 15 / 0.24 M.

## Verdict on `666ca29f`

**PASS on the numbers — with one thing said plainly for fable-2 and fable-cursor.** −66…−108 K at every fixed view and −99…−155 K where the
paving is under the player, for a hero-frame change of ≤ 0.02 % of pixels at max 21/255. That change is the per-tile far swap reaching
into the sealed frames' mid-distance, and the frames are sealed: the same principle fable-cursor gave the dither — suppress the swap for
a tile a hero camera can see, or under capture — would make the tiles pixel-identical again and cost the far fans nothing where they pay
(the far bank, the green). Either way the branch is within the −0.003 rule by two orders of magnitude.
