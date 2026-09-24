# fable-5 — the six views on the head `3c6cc553` → `31146062` (18:06; 71 commits: fable-2 `w02-treads` and `pebble-far`, squad2 `crowntone`, fable-3's belts / pots / crates / contact AO, lane 5's audio queue, squad5 `live-capture`) — 2026-09-24 18:10–18:31 UTC

Same deterministic capture on both heads (`broll.mjs --test --settle 8 --quality high --size 1280x720`), the gauntlet's SSIM
at 256 × 144 (`fable-5-lane10/sixpair.mjs`), pixels changed at 8 / 255.

| view | SSIM old ↔ new | pixels changed | vs reference old → new | Δ | where |
| --- | --- | --- | --- | --- | --- |
| **A_stairs** | 0.9669 | 6.89 % | 0.1765 → 0.1730 | **−0.0035** | the flight (58 % of the change) and the crowns top right (43 %) |
| B_house | 0.9982 | 0.78 % | 0.1705 → 0.1693 | −0.0012 | the crowns, top right |
| **C_lookback** | 0.9730 | 8.29 % | 0.1742 → 0.1776 | **+0.0035** | the crowns, top right and left |
| D_log | 0.9932 | 1.34 % | 0.2362 → 0.2336 | −0.0026 | the crowns, left |
| E_ground | 0.9982 | 0.77 % | 0.1913 → 0.1902 | −0.0010 | the crowns, top right |
| **F_canopy** | 0.9407 | 16.06 % | 0.1955 → 0.2030 | **+0.0075** | one crown column, left of centre |

**A is 0.0005 past the −0.003 budget, and the attribution says whose it is.** Re-rendering is not needed to split it: with
A's flight box (x 0.58–0.80, y 0.30–0.72) taken from the old frame and the rest from the new, A reads **0.1779 (+0.0014)**;
with the top-right crowns taken from the old and the flight from the new, **0.1722 (−0.0043)**. So:

- **the flight back to 20 treads** (fable-2 `36d722fa`, W02 — the reference has 18) costs A **−0.0043** at 256 × 144: 26 shallow
  treads become 20 bolder ones (`fable-5-lane10/head-31146062-A-flight-crop.jpg`), which SSIM reads as structure lost against
  a low-resolution reference while the owner's standard (the tread count and weight) is met. **An owner-approved look change** —
  the budget's exception applies, and the number is on record;
- **squad2 `crowntone`** (the crowns' colour at depth) gives A **+0.0014**, C **+0.0035**, F **+0.0075** — the three frames with
  the canopy at depth move *toward* the reference; B −0.0012, E −0.0010, D −0.0026 (the crowns at the frames' edges) stay inside
  the budget. This is the "crowns' colour at depth" item from the owner's poses (lane 10 §10), answered.

Caps on this head at the play look-backs (`fable-5-lane10-lookback-costs.md`): the far bank 832, the east green 789, the
lookout 758, the ruins' trail 776 isolate-sum draws — the pebble gate's 12–18 off the rocks row, the belts' +3–4 on the kids.
