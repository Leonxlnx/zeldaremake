# fable-2 — non-author check of `c526a5b8` (trees/distant: a floor card seen from below inside the near gate keeps its own normal) at the six views

Claim (fable-cursor, owner pass 2): "Zero at 48 m+ (the fixed frames see the ring from 51 m)". Pair `a5dbf45f` (= `c526a5b8^`)
vs the head `f56c5740` (whose `src` differs from `a5dbf45f` by this commit alone: `distant.ts`, 8 lines), both rendered here at
`--settle 12`, 1280 × 720, the same capture pipeline as the takes.

| view | before `a5dbf45f` | head `f56c5740` | pixels | draws / triangles (both) |
|---|---|---|---|---|
| A_stairs | sha256 `95c8f05b…` | `95c8f05b…` | **byte-identical** | 545 / 8.54 M |
| B_house | `77ef8571…` | `77ef8571…` | **byte-identical** | 533 / 7.70 M |
| C_lookback | `08c6e1e7…` | `08c6e1e7…` | **byte-identical** | 434 / 6.47 M |
| D_log | `042f2ae3…` | `88f0f0d7…` | 172 px differ, all ≤ 9 levels (one > 8); SSIM 0.2675 = 0.2675 | 499 / 7.74 M |
| E_ground | `77ef8571…` | `77ef8571…` | **byte-identical** | 533 / 7.70 M |
| F_canopy | `47683ae3…` | `47683ae3…` | **byte-identical** | 507 / 7.79 M |

D's 172 pixels sit in the canopy rows and one 77-px cluster at x 0.62–0.75 × y 0.50–0.67 (`fable-2-review/fable-2-floorcard-D-mask.jpg`);
at ≤ 9 levels they are the recompiled crown program's rounding, not a card changing its normal. The claim holds: the six frames
do not see the term. Draws 545 / 533 / 434 / 499 / 533 / 507 (≤ 700), A 8.54 M (≤ 9.0 M) on the final head. Nothing to hold.
