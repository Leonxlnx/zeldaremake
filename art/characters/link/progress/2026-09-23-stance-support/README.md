# Planted boot support after final ground tilt

The September23 timber profile exposed a small missing support check: the left boot penetrated the timber by up to **0.829 mm** through descent frames146–166. `footConfig` planned its support using yaw and nosing pitch; later `groundTilt` changed the planted boot's plane. The existing final oriented-plane scan covered swing feet only.

The source correction reuses that scan for a **stance foot with a nonzero ground-induced tilt**. It leaves the pin, all existing swing conditions, contact guards, root policy, asset and animation curves unchanged. It introduces no fixed clearance offset. The severe stair knee folding remains unresolved.

At frame146 the planned marker height is4.377330307m, while its final oriented plane requires4.381884935m. The additional4.555mm clears the measured point. Body primitive vertex56492 is93.3043% ankleL and6.6957% toeL, and belongs to both existing contact sets. Its actual height4.370343513m is below the exact timber surface4.371172880m; the sampled grid at that point is4.370552540m. Thus there is also a0.620mm grid approximation difference, but the larger omitted orientation correction is sufficient here. This does not establish exact continuous mesh collision.

## Paired actual-player result

Both variants use root integration `b221732b`, production Link `7f406e40…`, identical current stone/timber/paving/endpoint geometry, fresh player input and660frames per direction. The existing CPU player harness checks **537 low-sole and4,701 fully owned shoe vertices every frame**, totaling708,840 sole and6,205,320 shoe samples per variant. No WebGL renderer is created. Compact receipts, geometry hashes and derivative results are in [comparison.json](comparison.json).

| Measurement | Before | Narrow correction |
| --- | ---: | ---: |
| Ascent minimum shoe gap | +1.187mm | +1.187mm |
| Descent minimum shoe gap | −0.829mm | +1.218mm |
| Descent negative frames | 21 | 0 |
| Reach clamps | 0 | 0 |
| Maximum knee flexion, up/down |164.291° /166.131° | unchanged |
| Maximum ankle displacement from control | — | 0mm up /4.559mm down |
| Maximum knee displacement from control | — | 0mm up /15.432mm down |

All660 ascent rows are exactly equal. Descent has569 exactly equal rows; its roots, player state and pins remain exactly equal in all660. The nearly straight stance knee moves more than the ankle: at145→146 its flexion changes19.346→19.861° instead of the old19.346→11.714°. At166→167 the ankle rises0.0099mm instead of4.5685mm. Route ankle/knee speed, acceleration and jerk maxima and95th percentiles are exactly preserved. These comparisons do not make the existing large motion derivatives natural.

The original predicted-support hypothesis was rejected by direct observation: at current ascent353, CLEAR3.550852m already dominates predicted endpoint support3.472490m; at descent375, LIP2.461042m dominates2.362147m. This contact repair therefore does not alter that separate swing-posture problem.

## Portable check and limits

Run `node art/characters/link/progress/2026-09-23-stance-support/check.mjs` from the repository root. It extracts and executes the actual source branch against the real generated timber, compares the old gate as an explicit negative control, and checks300flat frames each for idle/walk/run/stairs. All1,200 paired bone-matrix samples and2,114,722 surface-query counts match exactly; zero-dt residual is1.11e−15. Existing complete-foot/heel/hip-slack and curved-support regressions, typecheck and build also pass.

An early flat-test result was invalid because its two variants shared mutable gait-chain state. An identical-source control exposed that harness error. The corrected check creates a fresh `hardChain` and locomotion object per variant. No flat-motion regression is attributed to that invalid result. An earlier broader all-stance trial is retained locally but is not the delivered source; the final gate limits extra work to ground-tilted stance feet.

The extra left-foot plane scan uses432surface queries when selected; flat locomotion adds none. A separate counter replay verifies all original pose fields against the full contact reports and measures the following actual route cost:

| Surface queries per pose | Before mean | Candidate mean | Mean increase | Largest per-frame increase |
| --- | ---: | ---: | ---: | ---: |
| Ascent |3682.541 |3694.445 |+11.905 /0.323% |837 |
| Descent |3625.662 |3760.539 |+134.877 /3.720% |432 |

The counter replay samples no shoe vertices; clearance evidence comes from the separate full-contact pair. This is operation-count evidence, not a frame-time or FPS claim. GPU player validation remains a separate integration step. Full player traces and observational harness variants remain local in the sibling `2026-09-21-stair-posture/resume-*` directories; their hashes are retained in the compact report. The portable check requires no untracked trace or historical commit.
