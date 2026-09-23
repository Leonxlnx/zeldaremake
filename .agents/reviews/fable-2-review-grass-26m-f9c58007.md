# fable-2 — non-author check of fable-cursor's grass blades to 26 m (`f9c58007`, tick 229) (2026-09-22 14:10 UTC)

The owner's "patches in the grass where it's not full": the mid blade LOD runs to 26 m (was 16) — `vegetation/grass.ts`
`lodDistances` [6, 16, 16] → [6, 26, 26], the plants test updated. Built `f97676d2` (before) and `c7379f98` (after) here;
A / E / C captured on both (`--settle 12`, SwiftShader).

| view | SSIM before → after | px > 8 (> 40) | draws | triangles |
|---|---|---|---|---|
| A_stairs | 0.2261 → 0.2261 (0.0000) | 1 267 (0.14 %) (118) | 444 → 452 (+8) | **8.68 → 8.83 M (+150 K)** |
| E_ground | 0.2183 → 0.2188 (+0.0005) | 2 412 (0.26 %) (15) | 425 → 434 (+9) | 7.80 → 7.93 M (+130 K) |
| C_lookback | 0.2165 → 0.2160 (−0.0005) | 1 608 (0.17 %) (43) | 335 → 342 (+7) | 6.69 → 6.83 M (+140 K) |

Frame-neutral at the fixed views (E's 16–26 m lawn band is at the hazed far edge — `fable-2-grass26-E.jpg`, the densest
change cell, before | after: the eye finds nothing); the change is for the walks across the lawn, which the frames do
not measure. **The cost is W38's:** A 8.68 → 8.83 M, 170 K under the 9.0 M ceiling — the blades to 26 m spend most of
what the pebble tiles / LOD (−110 K) and shadowlod (−60 K) had given back this morning, and +7–9 draws per view (the
extra blade chunks in the mid ring). Verdict: mergeable as merged; the headroom is thin again — if the next canopy or
grass item needs triangles at A, the matching cut has to come first (the shadow pass and the trees' laminae are where
the map says they are).
