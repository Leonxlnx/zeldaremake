# Round 54 (fable-4) — the north stand's 50 m far-LOD rule retired (PR #81 `agent/fable-4-standlod-retire` `a7006e1f`, merged 02:56)

Round 51's `STAND_FAR_LOD_M` = 50 put the band-only poles north of the clearing (z < −62) on the far LOD from 50 m while the
distant layer's gate was 120 m, then 72 m. squad2's lodcheck pulled `DISTANT_NEAR_M` to 45 m, under the 50, so the
`Math.min(distantNear, 50 …)` the rule sat in always took the gate. The rule, `isStandPole` and the audit's `lodSwapM.standPole`
go (−17 / +8 lines); the comment above `DISTANT_NEAR_M` that still called the stand's gate "under this" is corrected.

| pose (896 × 776, clock frozen) | draws / triangles, head `5f8a6738` and branch alike | pixels differing at > 1 / 255 |
|---|---|---|
| the clearing (0, −55) → north to the stand (0, −90) | 407 / 4.866 M | 0 |
| the arch's north approach (2, −36) → (0, −75) | 501 / 6.421 M | 0 |
| A_stairs | 607 / 7.963 M | 1 |
| D_log | 514 / 8.173 M | 3 |

Pixel-identical by construction and measured so: byte-identical where the stand is seen, 1 / 3 pixels of noise at A / D at the
strictest threshold, draws and triangles equal everywhere. `npm run typecheck`, `vite build`, trees' tests 25 / 25 green.

Renders `/tmp/f4/r196/{H,R}`; dists `/tmp/f4/r196-dist-{head,standretire}`.
