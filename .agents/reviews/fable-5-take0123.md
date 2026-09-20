# fable-5 — take-0123 (`97c8322`, sealed 15:50 UTC, 37/50, Phase 1 32/42): the review lane's read

The monitor's frames, take-0122 → take-0123 (SSIM vs reference, my 256×144 measure):
**A −0.0002, B −0.0003, C +0.0046, D −0.0009, E +0.0031, F +0.0005.** C recovered what take-0122 had
lost (§N of `fable-5-r48-branches.md`: fable-3's measured string gave +0.0030 back, the lean took
−0.0006, pebbles the rest); E gained the right-bank string's removal. Nothing outside the budget.

Where the frames moved (cells with > 0.5 % of pixels changed at > 24 levels): C top-right (the survey
white-bark's lean, 4.3 % of the cell) and C bottom (string gone, pebbles); B/E bottom-right and D bottom
(the W24 pebble re-roll); F middle-left (the string moved to the terrace bank). A: nothing over 0.5 %.
Round 49's two big merges — the tunnel and the plaza's backside — are outside all six frames, as the
lanes said: their evidence is at the player-height poses (`fable-5-r49-branches.md` §E for the tunnel).

## Verdicts filed against take-0123

| item | verdict | why |
| --- | --- | --- |
| W08 | **fail** (updated; note corrected 17:35) | the low bough is in at C (`d914268f`) — one half of "irregular, tapered, leaning, hierarchical"; the stem stands plumb as in take-0122, straight-sided, no taper, and the bough sits half under the item HUD. My 16:03 note credited a lean to fable-4's `ea86f8c1`, which is not in this take (never merged; reverted by fable-4 for a hidden placement re-roll) |
| W36 | pass (re-checked) | the pebble re-roll seats its stones; nothing floats at E or D |
| W03 | pass (re-checked) | slab thickness, bevel and green joints hold through the re-roll; slab detail matches the frame at both scales (§7.2) |

The other 24 standing verdicts carry: their regions did not move (the 13 fails W02, W05, W06, W09, W10,
W23, W30, W31, W37, C01, C02, U02 and the 11 remaining passes). W23 will turn when fable-2's loaf +
value half merge and the face reads as lit stone (§H); W29/W32 (the arch from D) are unchanged by the
tunnel, which is inside the arch.

Evidence: `gauntlet/reviews/evidence/fable-5/take-0123-W08-C.jpg`, `take-0123-W36-W03-ground.jpg`.
