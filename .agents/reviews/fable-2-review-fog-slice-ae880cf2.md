# fable-2 — the height-fog clarity slice alone, six views (`ae880cf2`, Astra PR #26 @ c241593e, imported tick 233) (2026-09-22 18:40 UTC)

The owner's clarity direction (15:45): less grey washout, distant trees clear. Astra's slice in `atmosphere/heightfog.ts`:
`hazeDensity` 0.018 → 0.008, `hazeFarDensity` 0.055 → 0.008, `farShadeMin` 0.3 → 0.65. take-0134 seals it together with
the far-crown atlas, the stand roof and the stand LOD; this isolates the fog's own six-view cost — built `ae880cf2^` and
`ae880cf2`, captured here (`--settle 12`, SwiftShader, `compare.mjs` against the reference frames).

| view | SSIM before → after | Δ | px > 8 | frame mean l | lum diff vs ref | sat diff vs ref | hue err (°) | sharpness ratio |
|---|---|---|---|---|---|---|---|---|
| A_stairs | 0.2263 → 0.2234 | **−0.0029** | 31.5 % | 0.378 → 0.352 | 0.047 → 0.067 | 0.004 → 0.003 | 4.36 → 4.74 | 1.71 → 1.77 |
| B_house | 0.1974 → 0.1949 | −0.0025 | 32.0 % | 0.365 → 0.339 | 0.025 → 0.045 | 0.044 → 0.039 | 5.05 → 5.37 | 1.44 → 1.50 |
| C_lookback | 0.2164 → 0.2094 | **−0.0070** | 30.8 % | 0.349 → 0.330 | 0.028 → 0.050 | 0.016 → 0.003 | 4.11 → 4.21 | 1.85 → 1.91 |
| D_log | 0.2790 → 0.2648 | **−0.0142** | 32.4 % | 0.366 → 0.342 | 0.051 → 0.075 | 0.026 → 0.021 | 4.41 → 4.41 | 1.45 → 1.48 |
| E_ground | 0.2191 → 0.2175 | −0.0016 | 32.0 % | 0.365 → 0.339 | 0.020 → 0.040 | 0.034 → 0.029 | 2.54 → 2.86 | 1.35 → 1.41 |
| F_canopy | 0.2290 → 0.2246 | **−0.0044** | 14.0 % | 0.336 → 0.322 | 0.065 → 0.077 | 0.031 → 0.039 | 2.69 → 3.53 | 1.94 → 1.93 |

Draws / triangles unchanged (A 455 / 8.78 M). What the numbers say, no lane claimed:

- **The fog alone costs every view — D −0.0142 (five times the budget), C −0.0070, F −0.0044, A −0.0029** — and the reason is
  in the tone columns: the reference frames are hazy, and our haze had been lifting our darks toward them; with it thinned
  7× every frame is 0.025 darker and its luminance gap to the reference widens (D 0.051 → 0.075). Saturation moves
  toward the reference (less grey), sharpness — already 1.4–1.9× the reference's — rises. The clarity direction and the
  reference-anchored metric pull opposite ways; the seal will book it (`fable-2-fogslice-D-C.jpg`: D and C, reference |
  before | after).
- If the intent is the owner's and the metric is to keep its meaning, the fog is the case for **naming the look change in
  the ledger** (as the timbers were) rather than reading D −0.014 as a regression — fable-cursor's call, fable-5's measure
  against the circled region is the one that matters for the owner.
- One side effect for whoever owns `compare.mjs`: `skyFraction` falls to 0.000 in every view (was 0.01–0.04) — the classifier
  keys on the haze colour, so W-checks that read sky share will move with the fog, not with the canopy.
