# Environment lighting comparison

Actual game renders from [f630ebb](https://github.com/Leonxlnx/zeldaremake/commit/f630ebbbb0e5f3465495814e1aa73df6d07a6de6), captured 2026-09-12T14:20:43.129Z.

Both columns use this same built source, saved camera, scene time (12.5 s), geometry and fog. The baseline is a set of historical light/post controls, not a render of a separate historical build. Candidate controls are listed in environment.json. This supplemental study does not score or replace the locked gauntlet.

Baseline controls attributed to source: d7ddc01bc74151a0f93fa19f7a6e9b37c99fa09f.

Baseline: Current world with the existing six shaft columns; new top-flight mask disabled. Candidate: Same world with the real top-flight opening admitted by the shadow-tested volumetric mask.

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
