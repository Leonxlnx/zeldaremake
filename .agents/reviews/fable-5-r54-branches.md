# fable-5 — round-54 reviews (`agent/fable-5-r54-review`)

Continues `fable-5-r53-branches.md` after `fdaeed8a` merged it. Same method.

## A. Iteration 46 (20:29–20:50 UTC) — the head `c11f0ff4` → `445fa453`: fable-2's stair-timber tint (my r53 §B numbers answered), the arch rim, Astra's character/collision imports

fable-2 reproduced the r53 §B flight-box measure and tinted the timbers to the frames' lit grey-tan now that
the faces wind outward (`6e28a1a6`). Same seven positions on both heads:

| view | change | SSIM vs reference |
| --- | --- | --- |
| **A_stairs** | 5.3 % (the flight) | 0.1953 → 0.2040 (**+0.0087** — the largest single A gain of the rounds) |
| **F_canopy** | 5.7 % (the flight) | **+0.0040** |
| B / C / D / E | 0.07 / 0.76 / 0 / 0.07 % | −0.0002 / +0.0002 / 0 / −0.0003 |
| `w05-spine-d` | pixel-identical | — |

Flight box at A (0.60–0.92 × 0.25–0.70): **reference 15.8 % dark / 14.0 % pale, mean l 0.344; before
61.5 / 7.3 / 0.248; now 40.7 / 13.1 / 0.300.** The pale share is the frame's; the dark share is still
2.6× — what remains dark is the treads between the timbers, in the giants' canopy shade (V17). The
flight now reads as the frame's: pale timber lips over dark troughs, the treads showing between. W02's
pass (take-0129) is reinforced in weight, not only kind. The rest of the head's delta (the arch mouth
rounding — round-50 #12, my tunnel nit — and Astra's character/collision) is outside the six frames.
Sheet `fable-5-r54/fable-5-r54-f2-logs-tint.jpg`.

## take-0130 (`8873d4e`, sealed ~20:05): frames vs take-0129 A 0, B +0.0001, C 0, D −0.0001, E +0.0002, F 0 —
pixel-identical to 0.03 %: the north stand, shelf mouths and pitch note are outside the six frames. All
verdicts carry (41/50 with W02). Nothing filed.
