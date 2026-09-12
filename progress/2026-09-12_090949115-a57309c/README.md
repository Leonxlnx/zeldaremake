# Environment lighting comparison

Actual game renders from [a57309c](https://github.com/Leonxlnx/zeldaremake/commit/a57309caced7e8b759bc87aa5d21287b0d8d50dd), captured 2026-09-12T09:09:49.115Z.

Both columns use this same built source, saved camera, scene time (12.5 s), geometry and fog. The baseline is a set of historical light/post controls, not a render of a separate historical build. Candidate controls are listed in environment.json. This supplemental study does not score or replace the locked gauntlet.

Baseline controls attributed to source: f11517e424cf333468c325885fe121245b54f756.

Baseline: Previous f115 production fill and contact contrast; current shared sky and geometry. Candidate: Adopted near-shadow refinement, current production without runtime overrides.

Raw audits and requested controls are retained. Requested overrides are checked against the actual light objects and composer settings used by the last render; this is not an independent GPU measurement of irradiance or color.

## A_stairs

| Baseline | Candidate |
| --- | --- |
| ![A_stairs baseline](A_stairs-baseline.jpg) | ![A_stairs candidate](A_stairs-candidate.jpg) |

## B_house

| Baseline | Candidate |
| --- | --- |
| ![B_house baseline](B_house-baseline.jpg) | ![B_house candidate](B_house-candidate.jpg) |

## C_lookback

| Baseline | Candidate |
| --- | --- |
| ![C_lookback baseline](C_lookback-baseline.jpg) | ![C_lookback candidate](C_lookback-candidate.jpg) |

## D_log

| Baseline | Candidate |
| --- | --- |
| ![D_log baseline](D_log-baseline.jpg) | ![D_log candidate](D_log-candidate.jpg) |

## E_ground

| Baseline | Candidate |
| --- | --- |
| ![E_ground baseline](E_ground-baseline.jpg) | ![E_ground candidate](E_ground-candidate.jpg) |

## F_canopy

| Baseline | Candidate |
| --- | --- |
| ![F_canopy baseline](F_canopy-baseline.jpg) | ![F_canopy candidate](F_canopy-candidate.jpg) |
