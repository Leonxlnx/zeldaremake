# fable-5 — round-49 lane branches, measured before/after (non-author)

Continues `fable-5-r48-branches.md` (§A–§O) on a fresh branch after `714fcd98` merged iterations 9–11.
Method unchanged: the lane's commits cherry-picked onto the current head in a worktree, the same shot
list rendered on head and union at identical positions (`broll.mjs`, 1280×720, settle 8, `--test`),
SSIM at the gauntlet's 256×144 (`fable-5-tools/ssim-pair.mjs`), crops at the poses where the defect
was named. Sheets in `fable-5-r49/`.

## A. Iteration 12 (10:25–11:10 UTC) — fable-4 `5fe58488` (`agent/fable-4-r49b`), the round-48 vertex-colour bands and chevrons retire

Head `0990b2c7` (tick 192: fable-4's budget branch with the low boughs merged, my §M–§O merged) +
`5fe58488` cherry-picked; `whitebark.ts` only (−54/+5, vertex colours only, geometry identical);
tsc + build + `lodPool` test green. Nine views: the six fixed ones plus `wb-grove-10m`,
`sn-whitebark-base` (opus-07's pose) and `x-arch-tunnel-n` (the young white-barks through the arch).

| view | head → head + 5fe58488 | SSIM vs reference |
| --- | --- | --- |
| A_stairs, B_house, D_log, E_ground, F_canopy | pixel-identical | Δ 0 |
| C_lookback | 0.06 % (the survey stem's upper bark) | 0.2259 → 0.2259 (Δ 0) |
| `wb-grove-10m` | 0.51 % — four stems, 84 % of it on the main stem at x 0.49–0.53 | — |
| `sn-whitebark-base` | 0.09 % (543 px, upper bark only) | — |
| `x-arch-tunnel-n` | 0.12 % (the right young stem) | — |

**What changed, and it is the right thing.** On the grove's main stem the head carries a soft dark
gradient across the pale bark between the tile's crisp torn bands — the round-48 vertex-colour "broad
band" — and after `5fe58488` that smudge is gone: pale bark up to the crisp band, as a birch has it
(sheet `fable-5-r49/fable-5-r49-f4-marks-retire.jpg`, top row with the diff heat). The chevron scars
went with it. What stays is what reads: the texel-resolution torn bands (`cfcd4f4d`), the 6–14 cm
bands, the sooty foot — at `sn-whitebark-base` the 2 m read is unchanged to the eye (543 px).

**IMPROVED, small and clean — merge.** No budget cost anywhere; W08 at C unaffected (Δ 0); the "soft
zone above a crisp band" I noted is what retired. fable-4's next (lean/taper, measured first) is the
remaining half of W08 at C and #6 of the round-49 list.

## B. Iteration 13 (11:31–12:15 UTC) — fable-4 `ea86f8c1` (with `5fe58488`), lean 5–10° turned across camera C

Head `e54a74ed` (tick 193: fable-2's pebble looks + envelope merged, my §A merged) + `5fe58488` +
`ea86f8c1` cherry-picked (`whitebark.ts` only); tsc + build + `lodPool` test green. Same nine views.

First the head itself: `0990b2c7` → `e54a74ed` at the same positions is the two pebble commits —
A +0.0003, B +0.0004, C +0.0006, D −0.0003, E +0.0004, F +0.0001, the whitebark poses ≤ 0.3 % px —
the numbers of §O, as expected; nothing else moved.

| view | head → head + fable-4 | SSIM vs reference |
| --- | --- | --- |
| A_stairs | 0.01 % | Δ 0 |
| B_house | 0.04 % | +0.0002 |
| C_lookback | **3.27 %** — the survey tree at the right edge leans across the frame (foot at x ≈ 0.95, top at ≈ 0.89 of the frame) instead of standing plumb | 0.2265 → 0.2259 (**−0.0006**) |
| D_log | 0.05 % | −0.0004 |
| E_ground | 0.03 % | Δ 0 |
| F_canopy | pixel-identical | −0.0001 |
| `wb-grove-10m` | 22.5 % — every stem leans more and differently, the soft bands gone | — |
| `sn-whitebark-base` | 10.8 % — the 2 m stem tilts a few degrees; marks unchanged | — |
| `x-arch-tunnel-n` | 9.0 % — the young stems through the arch lean | — |

**IMPROVED — the second of W08's three halves.** At C the trunk now reads as a tree that grew, not a
post: the bough (`d914268f`, merged) gives it a limb, the lean gives it a direction; the grove at 10 m
loses the "poles under crowns" read that opus and I both named. Inside the budget (C −0.0006, worst
D −0.0004). Boughs stay attached (the offset was reduced with the lean); nothing floats at the base.
What W08 still lacks: **taper** — the C stem is the same width at the top of the frame as at the foot.
Sheet `fable-5-r49/fable-5-r49-f4-lean-C.jpg`. Merge.

## Summary for fable-cursor

- fable-4 `5fe58488`: merge; six views Δ 0 (five pixel-identical).
- fable-4 `ea86f8c1`: merge; C −0.0006 for a survey tree that leans across the frame; taper is the last W08 half.
