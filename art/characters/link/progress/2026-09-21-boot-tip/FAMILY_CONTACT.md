# Shorter boot: reassessment with the complete foot

The frozen shorter-tip asset passes the same 537-vertex contact replay after correcting the missing-toe support measurement. The earlier 272.7 mm root-height regression was specific to the incomplete ankle-only footprint. This pair uses identical corrected source, ground, terrain/stair meshes, phases and input route; only the asset changes. The subsequent native shape review and actual-player capture accepted this incremental art edit; runtime is now `4dcf89c5`.

The actual-player capture `../2026-09-21T21-18-40-093Z-play-motion/manifest.json` checks 708,840 sole queries across 1,320 frames, including walk/stairs transitions. All 537 vertices have geometry hits; there are zero negative gaps, reach clamps or page errors. Minima are +1.186768 mm uphill / +1.264448 mm downhill, with peak knees 167.224319° / 168.349557°. This supersedes the held status in the earlier CPU JSON. The animation itself is not accepted as finished.

| Corrected family source, 470 poses each direction | Previous `89df38f2` | Shorter tip `4dcf89c5` |
| --- | ---: | ---: |
| Ascent minimum clearance | +1.188 mm | +1.188 mm |
| Descent minimum clearance | +2.092 mm | +2.068 mm |
| Intersections / reach clamps | 0 / 0 | 0 / 0 |
| Ascent peak knee fold | 169.090° | 167.224° |
| Descent peak knee fold | 168.604° | 168.349° |
| Maximum root step, up / down | 31.105 / 25.101 mm | unchanged |
| Maximum foot-target speed, up / down | 11.381 / 9.192 m/s | 9.402 / 9.192 m/s |
| Instrumented sampler calls, up | 1,802,737 | 1,707,166 (−5.301%) |
| Instrumented sampler calls, down | 1,776,388 | 1,711,291 (−3.665%) |

The maximum paired root-height difference is now −0.180 mm uphill and −2.090 mm downhill. Flat idle/walk/run motion hashes, clip phases, stance timing and maximum planted drift remain exact. All 537 selected low-band vertices hit actual reference geometry in all 940 poses, including terrain at the route's lower end. Exact triangle queries agree with native raycasts within 1.78e−15 m; full-selection native rays also agree at the 18 retained critical poses.

Local poses still differ. The largest uphill target change is 65.853 mm at frame 441 L, and the largest same-pose knee increase is 12.220° at frame 287 R (119.823° → 132.044°), despite the improved overall knee peak. These are reasons to inspect motion, not grounds for claiming the animation is solved. The global speeds remain high; this was a bounded geometry comparison, not new gait tuning. The 0.024 mm reduction in descent clearance remains positive and is reported rather than hidden.

[family-contact-comparison.json](family-contact-comparison.json) contains the source, asset, geometry and raw-result hashes plus paired measurements. The immutable local raw result is `family-candidate-cpu/stair-swing-working.json`; the control is `../2026-09-21-complete-foot/family-terrain/stair-swing-working.json`. They use normalized source `a9e2005ea405ce1ffaa05d5093cf608407868b45d878cb1acc2dd25ca9653b37` and ground `4683ac00dd98e0a055655773e61f4df608df289d67ec30d25edb8cc02c7fd292`.

The paired CPU study is a local forensic replay, not a fresh-clone test fixture. The prior export parity and old-source failure reports remain historical evidence; their raw measurements were not rewritten. Coverage is limited to the measured routes and 537 rest-low-band sole vertices. Flat hashes prove motion invariance, not an independent flat-ground vertex sweep. No arbitrary route, upper boot triangle, side collision or jump acceptance is implied. [Portable verification](PORTABLE_CHECKS.md) covers asset preservation separately from runtime contact.
