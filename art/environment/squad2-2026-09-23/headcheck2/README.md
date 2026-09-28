# The head re-verified after the one change that moves pixels

Lane 2, 2026-09-28 21:40 UTC. Branch `cursor/squad2-treephases-682b`, head `5117c3d0`.

Everything else on this branch is byte-identical, so the six-view table in the PR had stood since the
depth culls. `outlook/` §5 then set `forceSinglePass` on the distant crown material, which moves pixels
(SSIM 0.9975–0.9994) and changes every count — so the branch's own "checked end to end" numbers were stale.
This is them, re-run with the **gauntlet's own tools** rather than this lane's.

## The six fixed views (`gauntlet/scripts/pose-counts.mjs`)

| view | draws | triangles | W38 (≤ 700 / ≤ 9 M) |
| --- | --- | --- | --- |
| **A_stairs** | **559** | 8 626 622 | 141 draws and 0.37 M spare |
| B_house | 541 | 7 903 532 | pass |
| C_lookback | 479 | 7 679 745 | pass |
| D_log | 465 | 8 242 550 | pass |
| E_ground | 541 | 7 903 532 | pass |
| F_canopy | 500 | 7 831 095 | pass |

**All six inside W38 on both lines**, and every draw count is 10–17 lower than the same view before §5
(A_stairs was 575, F_canopy 515).

## Behaviour (`gauntlet/scripts/playtest.mjs --only look,walk,perf`)

- **walk: 11 routes, 11 reached, 0 stuck points.**
- **look: 10 spots, 0 flagged.**
- **0 page errors.**

| play-mode spot | draws | triangles | js step ms | render ms |
| --- | --- | --- | --- | --- |
| plaza | 528 | 7 677 516 | 17.3 | 15.2 |
| **stairs2-base (the flight's foot)** | 535 | **9 151 000** | 23.5 | 20.0 |
| saria-side | 502 | 8 508 917 | 23.7 | 14.8 |
| west-house | 411 | 4 908 289 | 10.7 | 7.9 |

The play-mode draws came down with the fixed views (plaza 539 → 528, the foot 555 → 535, saria-side
519 → 502, west-house 426 → 411). **The one number still over a line is the flight's foot at 9.151 M
triangles**, 0.151 M over the 9 M gate — unchanged in kind by this branch and vegetation-dominated, which
is the look call `lookbacks/` and fable-4's row-by-row both hand to the owner.

The `jsMs` figures are SwiftShader's, not a player's: `render` 8–20 ms here is software rasterisation.
What transfers is the draw and triangle counts and the behaviour.

## Files

- `six-view-counts.json` — `pose-counts.mjs` output, verbatim.
- `playtest-summary.json` — the walk/look/perf summary from `playtest.mjs`'s own JSON.
