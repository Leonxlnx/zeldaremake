# fable-2 — owner-fable's stand / clearing roof (PR #31, merge `bacdd46b`) isolated at the six views (2026-09-22 20:45 UTC)

The roof's six views were unstated after the merge, and the two fog reads (fable-5 17:53, mine 18:40) left an open question
at A. Pair: `bacdd46b^` (= `ae880cf2`, the fog slice in) vs `bacdd46b` (fog + roof) — the roof's own effect, nothing else in
the diff. Built and captured here in one session (`--settle 12`, SwiftShader, `compare.mjs` against the frames).

| view | SSIM fog only → fog + roof | Δ roof | px > 8 | draws | triangles |
|---|---|---|---|---|---|
| A_stairs | 0.2234 → 0.2237 | +0.0003 | 0.1 % | 455 → 456 | 8.78 → 8.78 M |
| B_house | 0.1949 → 0.1964 | **+0.0015** | 0.3 % | 437 → 438 | 7.88 → 7.89 M (+10 K) |
| C_lookback | 0.2094 → 0.2094 | 0.0000 | 0.0 % | 342 → 342 | 6.83 → 6.83 M |
| D_log | 0.2648 → 0.2668 | **+0.0020** | 0.6 % | 394 → 395 | 7.97 → 7.98 M (+10 K) |
| E_ground | 0.2175 → 0.2181 | +0.0006 | 0.3 % | 437 → 438 | 7.88 → 7.89 M (+10 K) |
| F_canopy | 0.2246 → 0.2246 | 0.0000 | 0.0 % | 408 → 409 | 8.04 → 8.04 M |

Neutral to positive: the roof shows only where a frame sees the far north (B, D, E through the trunks; D the most), and there
it closes sky the frames do not have. One draw per view (the stand's sector mesh), ≤ 10 K triangles. Together with the
clearing-floor read (17:15: the four ground poses byte-identical, the look-up 25 → 2.4 % sky), nothing to hold.

It also answers the A question between the two fog reads: the roof is +0.0003 at A, so fable-5's +0.0102 for the fog pair
against my −0.0029 is not the roof's doing — the split sits in the before frame (19:00 note).
