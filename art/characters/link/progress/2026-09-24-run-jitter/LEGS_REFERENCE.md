# Running leg diagnosis — September 24

Read-only research and CPU comparison for the user's rejection of the leg movement after the arms/hands repair. This is a diagnosis and an authoring proposal, not acceptance of a new animation. No Blender, browser, GPU, runtime or public asset was changed by this inspection.

## Inputs and actual visual inspection

- Current measured GLB: `run-torso-hands.glb`, SHA256 `aa0520e0d7aaedcc452103ad14c81113866ff3c5adbd5307fdcedf711a248c89`.
- Existing CC0 `Jog_Fwd_Loop`: `reference/animations/quaternius-standard/AnimationLibrary_Godot_Standard.gltf`, SHA256 `0ff075c7ad6855c5c2c37a171592ee8f0d6ab2f58259e2be77a9b63dd8027765`. Its companion binary is `6e65377d81558333c4093dbb144a48fd19019343d82b1a3a7992a98ec0e0543c`. The existing `SOURCE.json` and `LICENSE` apply. This is the already-owned pinned 2025 Standard release, not a new 2026 download. See [the source diagnosis](../2026-09-22-cc0-run-source/README.md).
- Inspected actual final native image `torso-final-run-0.38-side.png` and gameplay contact sheet `run-cycle-game.png`. These show the current boot/leg silhouette, not the proposed replacement. No reference video was claimed as watched.
- CPU skeleton diagrams were also generated and inspected at `gauntlet/out/sept24-leg-phases.png`. The hip-aligned diagram compares joint shape, not floor contact.

## Measured defect

The existing Three.js CPU skeleton inspector was reused and extended locally to sample 241 phases, including the repeated endpoint. It retains the original hierarchy and animation tracks; only meshes/images are omitted. +Z is forward, +Y up, knee flexion is zero when straight. Full sampled joints and input hashes are in `gauntlet/out/sept24-legs-source-current.json`; local reproduction helpers are `extend-leg-inspect.mjs`, generated `inspect-legs.mjs`, `leg-events.mjs`, `leg-phase.mjs` and `plot-leg-phases.mjs` in that output folder. They are diagnostic scratch files, not production dependencies.

| Raw clip measurement | Current run | CC0 Jog |
| --- | ---: | ---: |
| Leg length, thigh + shin | 0.4113 m | 0.8298 m |
| Stored cycle | 0.466667 s | 0.916667 s |
| Left knee flexion | 9.7–80.4° | 0.3–128.3° |
| Right peak knee flexion | 80.4° | 123.1° |
| Left ankle vertical range | 45.4 mm / 11.0% leg length | 415.0 mm / 50.0% leg length |
| Left thigh world pitch | −20.0…+60.4° | −40.3…+76.7° |
| Left thigh mean pitch | +31.8° | +20.8° |
| Pelvis vertical range | 6.74 mm | 231.0 mm |

The present foot return is nearly horizontal and close to the ground. It folds the knee substantially less than the donor and holds the thigh forward for much of the cycle. That explains the shuffling silhouette better than the prior lateral-alignment checks. The old sideways-leg audit did not establish natural sagittal movement.

## Contact and source limitations

Current ankle or toe within 1 mm of its own minimum: L phase `0.99583 → 1.20833`, R `0.49583 → 0.70833`, about **21.25% of the cycle per foot**. This matches the authored 20% duty with interpolation tolerance. Current near-floor toe velocity is about −3.900 m/s in the stored clip, giving the known 1.82 m stride. These are raw joint-marker intervals, not deformed-mesh force/contact measurements.

The donor is not an unmodified realistic-jog replacement. Its toe within 20 mm of its minimum is only L `0.05417 → 0.18333`, R `0.56250 → 0.68750`. Smaller tolerances split the near-floor window because the toe oscillates. Median near-floor toe velocity is approximately −5.84 m/s: about 5.35 m implied source stride, or **2.65 m after leg-length scaling**, not 1.2–1.5 m. Its scaled pelvis bob would be 114.5 mm. Both are inappropriate to copy directly here.

Crucially, those donor intervals include its pelvis movement. Transferring only leg rotations while retaining the present nearly fixed pelvis changes the contact schedule. The target's actual shoe sole must be sampled after retargeting before deriving runtime pin intervals.

The best phase shift from current to source for both left thigh and upper-arm pitch is **+0.05833** (correlations .930 and .995). Historical +0.078125 also matches the retained arm phase closely (.986). Knee and ankle best shifts differ (+0.01667 and +0.02917), so a single offset cannot repair all trajectory differences. Use the retained arm relationship as the phase anchor, then author support and recovery deliberately.

## Primary human movement references

[Hamner and Delp's measured running study](https://nmbl.stanford.edu/publications/pdf/Hamner2012.pdf) reports 3 m/s adult running with mean support 40.4% of a cycle, 0.715 s cycle time, and 0.068 s flight per gap. The body lowers during early support and rises toward toe-off. This supports a distinct loading, push-off and brief-flight sequence. These adult measurements guide ordering and scale relationships; they are not a prescribed cadence or amplitude for this stylized child.

[Chumanov et al.'s measured high-speed study](https://pmc.ncbi.nlm.nih.gov/articles/PMC3057086/) identifies swing from toe-off to peak knee flexion, followed by recovery toward the next contact. Its high-speed amplitudes are not the jog target. The useful visual sequence is heel folding behind, the thigh coming through, then the lower leg opening before touchdown rather than carrying the boot forward at almost constant height.

## Concrete authoring recommendation

1. Keep the repaired arm/hand tracks and use calibrated donor leg orientations as a starting shape reference. Preserve bone roll and armature world bases. Do not import donor pelvis bob, speed, support fraction or full thigh amplitude wholesale.
2. Give swing a visible folded recovery: a first target is roughly 100–115° peak knee flexion, with the heel raised behind the body before the lower leg opens toward contact. This is an artistic target requiring native boot/tunic review, not a published human norm. The source's near-horizontal rear leg and +77° thigh peak are excessive for this jog.
3. Fit stride and contact together. With a 0.411 m leg and approximately 0.360 m hip-to-ankle height, the straight-leg geometric planted span is only about 0.398 m. The previously rejected 2.05 m stride × .27 duty required .554 m and drove an approximately 79 mm crouch; see [the recorded rejection](../2026-09-19-run-contact/README.md). More support cannot be obtained by stretching that trajectory.
4. For a deliberately slower 2.4 m/s jog, start around **1.30 m stride, 0.30–0.31 support fraction**, giving a 0.542 s cycle, about 222 steps/min and a .390–.403 m planted span. A 1.20 m stride with .34 support gives .408 m span and 240 steps/min. Choose between these in the actual character view; do not label the shorter child cadence inherently wrong by adult standards. At the existing 3.3 m/s, 1.30 m stride would instead produce 305 steps/min and repeat the rapid-feet problem.
5. Keep landing and toe-off velocities continuous. Derive pin intervals from the target sole and stance travel after retargeting. Rebuild the run stride contract and foot tables together. Check the actual post-IK game motion: a good native clip can still be flattened or distorted by runtime grounding. Review a side-on continuous cycle as well as selected poses, including acceleration, stop, and a slope; smoothing alone cannot fix an incorrect recovery path.

These recommendations were sent to the native/runtime owners during their work. No proposed candidate is declared accepted in this document.
