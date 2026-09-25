# fable-5 — non-author pre-merge check: `agent/squad2-lodcheck` @ `43c48259` (lane 2: the trees' high → medium rung at 32 m, paid for by the distant gate at 45 m) — 2026-09-24 19:59–20:23 UTC

## The six views — inside the budget

Head `31146062` ↔ branch, the same deterministic capture (`broll.mjs --test --settle 8 --quality high --size 1280x720`, the gauntlet's SSIM):

| view | SSIM head ↔ branch | pixels changed | vs reference head → branch | Δ |
| --- | --- | --- | --- | --- |
| A_stairs | 0.9994 | 0.25 % | 0.1730 → 0.1728 | −0.0002 |
| B_house | 0.9984 | 0.26 % | 0.1693 → 0.1690 | −0.0003 |
| C_lookback | 0.9999 | 0.03 % | 0.1776 → 0.1777 | +0.0001 |
| D_log | 0.9887 | 1.88 % | 0.2336 → 0.2335 | 0 |
| E_ground | 0.9984 | 0.27 % | 0.1902 → 0.1895 | −0.0008 |
| F_canopy | 1.0000 | 0.00 % | 0.2030 → 0.2030 | 0 |

Lane 2's "the frames do not move" holds to the budget; D moves 1.9 % of its pixels where its trees change tier. Merge-safe.

## The look-backs — the rung does not reach them

`isolate.mjs` at the four over-cap poses (`lookback-isolate-lodcheck-43c48259.json`), the trees row against the head `31146062`:

| pose | trees, head | trees, `43c48259` | Δ |
| --- | --- | --- | --- |
| the far bank | 256 / 3.60 M | 256 / 3.60 M | 0 |
| the east green | 252 / 3.62 M | 249 / **3.69 M** | −3 / **+0.07 M** |
| the east lookout | 246 / 3.80 M | 243 / 3.79 M | −3 / −0.01 M |
| the ruins' trail | 238 / 4.16 M | 240 / **4.36 M** | +2 / **+0.20 M** |

The village's trees seen from the expansions stand 35–60 m off — beyond the old rung and the new — so the row is untouched
at the far bank, and where the 45 m gate reaches (the green, the ruins' trail) it puts triangles **on** (+0.07 M, +0.20 M).
The frames: the far bank 846 draws / 10.15 M, the green 797 / 9.82 M. Row 2 of the bill (`fable-5-lane10-lookback-costs.md`)
— a far tier for crowns beyond ≈ 35 m from the eye, one draw per crown — is still open; lane 2's own README says as much
("what is left needs either vegetation density in A's frame or a cheaper medium LOD").
