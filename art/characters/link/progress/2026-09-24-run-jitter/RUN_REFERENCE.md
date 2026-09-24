# Running arm reference — September 24

Read-only diagnosis for the owner's correction: **running hands**, plus hurried movement. No production asset, runtime, Blender scene, or GPU capture was changed by this review.

## Current input and visible defect

Current GLB SHA256 `46dcbcc36490ee5c86f6d9eb28d58d1743f60cfab02bb0c899b8388b6eda3de0`. Its run is unchanged from accepted `7f406e40`. The existing CPU `2026-09-22-cc0-run-source/inspect.mjs` was rerun against this exact asset. Measurements sample 241 phases; negative upper-arm angle is rearward relative to the hips-to-neck axis. These are raw clip measurements, not runtime or skinned-surface measurements.

| Current native run | Left | Right |
| --- | ---: | ---: |
| Upper arm relative to torso | −26.47…+8.26° | −27.16…+8.26° |
| Upper arm behind torso fraction | 72.1% | 75.8% |
| Elbow flexion, zero straight | 72.20…87.13° | 71.68…87.37° |
| Wrist ahead of shoulder | −27.9…+97.2 mm | −30.9…+95.2 mm |
| Wrist ahead of torso plane | +13.9…126.5 mm | +11.8…122.7 mm |
| Wrist outward from shoulder | 80.6…107.1 mm | 90.8…114.8 mm |

The four arm quaternion channels have no abrupt sample jump: maximum adjacent rotation is 0.67° per 1/240 cycle. Mean torso lean is 12.32°. The old September 22 review's 5° torso figure describes an earlier asset and must not be reused for current Link.

I inspected the actual accepted native side phase 0.91 and three-quarter phase 0.38 images in `2026-09-21-motion-integration/sept23-accepted-7f-*`. The conspicuous problem is the open, spread-finger hand silhouette and outward held wrists. The upper arm is not simply pointing forward throughout the cycle. A hand behind its shoulder is also different from a hand behind the tilted torso at the same height.

## Timing and smallest useful changes

The authored run cycle is 0.466667 s with a 1.82 m stride. At player speed 4.6 m/s, distance-driven playback yields a 0.395652 s cycle, **303.3 steps/minute**. That produces a hurried hand/arm presentation even with continuous rotations. A first bounded game-speed candidate is 3.4 m/s: 0.535294 s per cycle, **224.2 steps/minute**. This is an art-directed child-character starting point, not a clinical norm. Keep the shared distance clock; do not independently slow the arms or alter `GAIT_SPEED`, which describes the stored clip contract.

`ARM_SCALE.run=1.15` and `ARM_TAU.run=0.02` add gain and phase lag after the authoring. The prior same-clock check established that removing gain alone slightly reduces both front and rear excursions; it cannot create rearward carriage. If authoring a new run, evaluate it with gain 1 and tau 0 so the approved authored timing reaches the screen.

For the native fit, preserve the existing opposite-leg phase and try only a small rearward shoulder bias (approximately 4–6°) with a modest elbow opening on the rear half (approximately 5–8°). Those are candidate bounds, not approved parameters. Retain the neutral wrist roll and established bend plane; the previous complete donor axial transfer visibly turned the palms down and generated outfit problems. Judge all four quarter phases and the back-view run at game speed. If pack contacts rise, reject the pose instead of compensating with arbitrary outward abduction. Existing `-38°` shoulder and 3D roll studies are already rejected; do not repeat them.

For the hands themselves, a relaxed curved finger silhouette is needed; wrist rotation cannot curl a rigid spread-finger mesh. Reuse the existing validated hand-region study rather than altering arbitrary vertices or introducing a new rig. The earlier 18° distal study was held as too subtle, not shipped. Any stronger native candidate still needs thumb separation, finger overlap, cuff and gait review.

## Primary references and available licensed motion

The [Quaternius author page](https://quaternius.com/packs/universalanimationlibrary.html) identifies the library as CC0. The already pinned `Jog_Fwd_Loop` is available locally and carries the recorded source/license hashes; no new asset is necessary. Existing source inspection shows Jog shoulders roughly −56…+28°, elbows 79–94°, with substantial rearward drive. `Sprint_Loop` is not more rearward: it has more torso lean and a more forward mean wrist position. Do not transfer either donor's uncalibrated rest rotations directly into Link's lowered-arm rest pose.

[Arellano and Kram's running experiment](https://journals.biologists.com/jeb/article/217/14/2456/12120/The-metabolic-cost-of-human-running-is-swinging) supports arm/torso coordination rather than independently timed hand motion. Their observed participants swung bent arms back and forth with slight front crossover. [Pontzer et al.](https://pubmed.ncbi.nlm.nih.gov/19181900/) likewise measured coupled arm, shoulder and pelvis motion in treadmill running. Neither paper provides universal shoulder angles for this stylized child.

[World Athletics coaching guidance](https://worldathletics.org/news/series/advice-runners-beginners) favors symmetric, restrained upper-body movement sufficient to balance the legs. This supports avoiding oversized arm pumping, not freezing the elbows or wrists. The paper text, source clips through the CPU skeleton, and the existing native images were inspected; no online running video was watched in this review.

The separate walking vertical jitter needs actual runtime root/hips/support traces. Nothing in this read-only arm inspection proves its cause or repair.

## Located hand study and bounded 35° preparation

The exact existing files are `2026-09-23-hand-curl/prepare.py`, `native.py`, `hand-curl-plan.json`, `hand-curl-native-rows.json`, `hand-curl-native.json`, and `hand-curl-study.blend`. They are local/ignored study files, so ordinary tracked-file searches miss them. The native study copies scene `Link | September22 chest posture both straps` from `E:/zeldaremake-native-checkpoints/2026-09-22-posture-both-straps.blend`; its output scene is `Link | September23 loose fingers study` in `hand-curl-study.blend`.

The confirmed anatomical region evidence lives in `2026-09-23-character-review/inspect_hand_regions.py`, `hand-{L,R}-regions.json`, and the matching palm/outward PNGs. Both palm PNGs were inspected again: magenta is the thumb and stays excluded; cyan/yellow/orange/purple are index/middle/ring/pinky.

| Side | Index seed | Middle seed | Ring seed | Pinky seed | Excluded thumb |
| --- | ---: | ---: | ---: | ---: | ---: |
| L | 75512 | 75592 | 78323 | 76365 | 78587 |
| R | 78136 | 78015 | 77299 | 76829 | 76152 |

`prepare.py` identifies each distal connected component in hand-local coordinates, includes coincident aliases, freezes the proximal boundary, and bends each finger toward its own palm axis. Its centerline angle varies quadratically from zero at the boundary to the target angle at the tip; this is a curve deformation, not a rigid rotation of the hand. Normals use the inverse-transpose Jacobian. All selected rows have exactly one rigid hand weight. The mask contains 2,221 rows / 1,167 unique positions; 318 boundary rows remain fixed and 1,548 rows actually move.

A CPU-only 35° trial reused that exact preparation in memory against immutable `2026-09-24-natural-walk/baseline-7f.glb`. All original checks passed: maximum displacement 7.659 mm (18°: 3.930 mm), minimum Jacobian determinant 0.5295, minimum affected face-normal cosine 0.8218, zero alias error, exact boundary/outside rows, and numerical Jacobian error below 1.6e−10. Runner and compact receipt are `gauntlet/out/sept24-hand35-readonly.py` and `.json`. No native scene, GLB, or production source was changed. This proves local deformation validity, **not** clearance between fingers or against the body.

For the native trial, copy the old script to a new study location and new scene/output names; retain its source/selection/preservation assertions. Its exact-plan and angle-18 assertions must point to the newly computed 35° plan, not be deleted. Preserve the old study. Since these fingers have rigid hand weights, this is a rest-geometry improvement visible in every gait; it is not run-only animation. Review relaxed idle and walking hands alongside the run before adopting it.

The requested adapters are now prepared:

- `hand_native.py` reuses the old selection and full native mutation/check body on exact `46dcbcc3`, copying `Link | September24 run repair baseline` into `Link | September24 relaxed hands35`. Root supplies the confirmed seed dictionary. It creates `hand35-plan.json`, `hand35-study.blend`, `hand35-native.json`, and `hand35-native-rows.json`. This review did not execute Blender.
- `hand_export.py SOURCE.glb EXPECTED_SHA256 CANDIDATE.glb` composes hands after an append-only arm candidate. It reuses the prior boot writer with a full 3×3 Jacobian normal/tangent adaptation. Only body primitive 0's POSITION/NORMAL/TANGENT accessors may be rebound; the entire original binary prefix, all clips and other metadata, UVs, weights, unselected geometry rows and blink data must remain exact. It verifies native correspondence with failing 100 µm negative controls, positive Jacobians, complete aliases, no flipped affected triangles, and unit orthogonal shading vectors. It writes only a new candidate in this study directory.

These adapters depend on the existing `2026-09-23-hand-curl/{prepare,native}.py`, `2026-09-22-rear-carriage/patch_pack.py`, `2026-09-21-boot-tip/{preview,check}.py`, `2026-09-20-run-arms/boots.py`, and the native helper functions named in the original hand script. Preserve/package those authoring dependencies if publishing the adapters. The input geometry fixture is exact `baseline-46.glb`; production may already have newer arm rotations, but its original 46d binary prefix and mesh/skin/rest metadata must still match.

Both adapters compile. The CPU export check confirms a full non-diagonal Jacobian's transformed normal against the actual transformed triangle, coordinate round-trip, wrong-source hash rejection and source-overwrite rejection. Root subsequently reviewed the native35 study and executed the final composition: `run-torso-hands.json` records candidate `aa0520e0d7aaedcc452103ad14c81113866ff3c5adbd5307fdcedf711a248c89`, with all preservation and correspondence checks passing. Blink POSITION deltas on these fingers are zero; existing sparse NORMAL deltas include rounding residue up to `1.1920928955078125e-7`, which is preserved and reported rather than falsely called zero.

The final run fit measures shoulder reach relative to the leaning torso, preserving the rearward extrema while reducing both forward upper-arm peaks from 8.26° to 2.26°. The earlier world-axis gate did not produce the intended reduction and is superseded. The delivered play-speed choice is 3.3 m/s, approximately 218 steps/minute. These final choices and the remaining game-replay status are documented in [the study README](README.md); the 3.4 m/s and angle bounds above remain the initial proposals, not the final receipt.
