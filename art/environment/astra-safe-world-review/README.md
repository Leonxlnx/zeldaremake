# Safe-world source candidate native review

Frozen source: `4b2fe8e6d7604d45e1f47f3be0c51c2859732a08`, based on accepted root `4ad2fb50`, importing the bounded hardscape/rocks/structures/props/audio groups from partner `b510b152`. The 29-file source candidate is unchanged by this review. No root adoption, new scene pose, source tuning, formal gauntlet take, or rubric/ledger edit was made.

The seven-frame capture completed on 2026-09-23 with exit 0 and `errors: []`. It used the unchanged native capture helper through the shared `capslot`, with `CAPSLOT_STALE_MIN=Infinity`; the GPU slot is released. The helper requests ANGLE D3D11. This run did not separately record the GPU vendor string. Both runs use quality high, 1280×720, pixel ratio 1, simulation time 12.6, the original Link asset/default pose, and identical camera and global-lighting values.

The six-frame baseline is reused from `../astra-canopy-packed-integration/native/`; its manifest correctly records source `105a61d5`. Its `src`, `public`, and build inputs are byte-identical to root `4ad2fb50`; those six frames were not recaptured. All PNG hashes, the saved baseline bundle hash, and the unchanged helper hash were checked. `baseline-audit.md` records independent provenance and raw A/F review. `compare.mjs` verifies the matched inputs and writes `comparison.json`; the candidate's `native/source.diff` is empty.

| Fixed view | Baseline triangles / draws | Candidate triangles / draws | Triangle delta | Draw delta |
| --- | ---: | ---: | ---: | ---: |
| A_stairs | 8,867,001 / 479 | 8,757,903 / 484 | -109,098 | +5 |
| B_house | 8,068,261 / 466 | 7,960,753 / 472 | -107,508 | +6 |
| C_lookback | 7,112,969 / 379 | 6,927,571 / 378 | -185,398 | -1 |
| D_log | 8,253,079 / 434 | 8,122,467 / 440 | -130,612 | +6 |
| E_ground | 8,068,261 / 466 | 7,960,753 / 472 | -107,508 | +6 |
| F_canopy | 8,312,047 / 449 | 8,177,841 / 451 | -134,206 | +2 |

All six fixed views remain below the existing hero-view envelope of 9 million triangles / 700 draws. Textures and programs remain 91 / 101 in each fixed view. The inherited B/E cameras and images are identical in both runs, so they are not independent visual coverage.

Raw image review: B/D/E preserve the house, path, Link, foliage and fog composition; visible edits are local stone/lantern details. C shows the deliberate warmer brown timber and packed-earth stair treatment, replacing the pale striped appearance. Independent A/F inspection finds more natural and varied timber, a darker upper flight with less distinct step separation, and no obvious blocking displacement or new obstruction at full-frame scale; details are in `baseline-audit.md`. No restored NPC is visible. These images do not validate traversal, sound playback, animation, distant moving leaves, or reference-match completion.

The extra `s2-join-close` is copied exactly from `b510b152:art/environment/owner-2026-09-23/pass3/stair-close-poses.json`: position `[8.194,1.44,-0.417]`, target `[8.973,1.3,-1.532]`, FOV 45. Its raw image exposes dark angular notches around several timber-to-riser joins. Root requested a matched baseline to determine whether those were new. A historical search found no source-equivalent receipt: the partner's saved close-up postdates the timber rewrite. One additional baseline frame was therefore captured after coordination with the crown lane, using root's unchanged saved `index-BeSuDGjf.js` build and verified Link7f. It completed with exit 0 and no recorded errors; the GPU slot was returned to the crown lane.

The new `baseline-close/s2-join-close.png` shows the same large dark angular recesses beneath successive nosings, including the central wedges. These are preexisting close-range join limitations, not demonstrated new gap regressions. The changed log profiles alter some upper boundaries; a color image alone cannot classify every dark region as an open mesh gap. The candidate records 9,723,855 triangles / 442 draws versus the baseline's 9,841,463 / 437: -117,608 triangles and +5 draws. Both exceed the numeric 9 M hero envelope, so that diagnostic count is also preexisting; this close pose is not a hero rubric view. Camera, time, global lighting, resolution and helper hash match exactly, and both source diffs are empty. The baseline was captured directly at the close pose, whereas the candidate visited the six fixed views first; cumulative geometry/program counts therefore are not treated as a source delta. The raw close pair supports the warmer, varied timber appearance while preserving the existing join limitation.

CPU checks completed before capture: typecheck, build, diff check, and all 61 existing hardscape/rocks/structures/props/audio tests, including B3 merged pebbles and outward timber rays. No source changed afterward. Native walkability and audio listening remain outside this bounded review.

The supporting `stair-geometry-check.json` replays both immutable commits through the actual main-flight builder, production seed/RNG forks and live terrain. The 14,085 slab/riser/cheek/landing triangles have byte-identical position and normal arrays, ordering, tread noses and outlines. Timber geometry and materials differ, so their coverage and the contrast of existing joins may change; the proof does not mistake dark pixels for a classified mesh hole.
