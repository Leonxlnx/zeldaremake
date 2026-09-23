# fable-5 — take-0133 (`bc7481b`, sealed 19:26 UTC; the grass blades to 26 m + the six memory branches + the dressing fade): read

## The expected row held to ±0.0003

`fable-5-take0132.md` predicted this take's six views from take-0132 plus every measured step (r55 §F, §G, §I, §K.2):

| view | take-0132 | take-0133 | Δ | expected | miss |
| --- | --- | --- | --- | --- | --- |
| A_stairs | 0.2209 | 0.2208 | −0.0001 | 0.2207 | +0.0001 |
| B_house | 0.1987 | 0.1988 | +0.0001 | 0.1985 | +0.0003 |
| C_lookback | 0.2198 | 0.2194 | −0.0004 | 0.2193 | +0.0001 |
| D_log | 0.2765 | 0.2765 | 0 | 0.2765 | 0 |
| E_ground | 0.2194 | 0.2197 | +0.0003 | 0.2198 | −0.0001 |
| F_canopy | 0.2319 | **0.2297** | **−0.0022** | 0.2297 | 0 |

The memory round (`onUpload` for trees / rocks / props, pebble-bytes, rock-bytes, vertexbytes) is frame-neutral as
measured (§F, §G, §I); the grass blades to 26 m cost exactly the F −0.0022 measured in §K.2 and nothing elsewhere. The
browser-per-view capture is healthy (3.9 h, no stall after C). Stats: A 452 draws / 8.83 M triangles (the blades' +150 K
as fable-2 measured; 170 K under W38's 9.0 M), B/E 434 / 7.93 M, C 342 / 6.83 M, D 391 / 8.02 M, F 408 / 8.04 M.

## Verdicts: 41/50, nothing to file

The same nine fails as take-0132 (W05, W09, W10, W30, W31, W37 auto, C01, C02, U02); W02's reinforced pass and C01's
re-checked fail (both filed on take-0132) carry — no frame moved by more than 0.3 % of its pixels except F's lawn
band (the blades), which is inside W06/W15's read. Nothing filed on this take.

## For take-0134 (the clarity set: Astra's fog slice `ae880cf2`, the far-crown atlas `b7c9e001`, owner-fable's stand roof
`bacdd46b`, fable-4's stand LOD `acb73a23`, Astra's strap / posture imports)

The fog slice is the mover. Two clean pairs (`b7c9e001` → `ae880cf2`, matching flags both sides) agree to 0.001 —
mine: **A −0.0029, B −0.0030, C −0.0081, D −0.0143, E −0.0024, F −0.0040**; fable-2's: −0.0029 / −0.0025 / −0.0070 /
−0.0142 / −0.0016 / −0.0044 (`ANALYSIS_CLARITY.md` §3, corrected — my first after-frames carried the characters). The
stand roof (PR #31) is unmeasured at the six views by anyone; the atlas painter and stand LOD are frame-neutral there
(§N, fable-4). The roof's share is now measured (r55 §R: A +0.0003, B +0.0015, C 0, D +0.0022, E +0.0007, F 0), so
**expected take-0134: A 0.2182, B 0.1973, C 0.2113, D 0.2644, E 0.2180, F 0.2257** (E and A ± Link's pixels — the take
carries Astra's strap and posture imports, which none of my clean pairs render) — the first take since 0129 to
move every view, all down; D's −0.012 will read as a regression against the six-view budget unless the owner's
direction is booked as the reason. take-0135 (+ Astra's packs and upper-canopy admission, r55 §R): A 0.2184, B 0.1972,
**C 0.2063**, D 0.2644, E 0.2178, F 0.2243.
