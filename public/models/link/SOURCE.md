# Young Link runtime candidate — Blender source and validation

## September 24 running leg replacement

Current delivery: **8d7efa783d4bbc97d053c0a627a28c3c163351d7828124e1bf10c8232f06cedd**, 54,439,952 bytes. The original Blender-authored run replaces the low, nearly horizontal boot return with a rear heel recovery, forward passage and extension into contact. Each leg supports approximately 30% of the cycle. Pelvis translation uses a smooth 12 mm two-step rise/fall below the leg reach limit. Only six leg rotation channels and run hips translation change; the original mesh, materials, weights, repaired arms/hands, other clips and original binary prefix are preserved.

The paired runtime stride is **1.20 m**, stored cycle remains **28/60 seconds**, authored speed is `1.2 / (28/60)` m/s, and play-mode run speed is **2.2 m/s** (220 steps/minute). Walking stays at 1.2 m/s. The prior 1.82 m / 3.3 m/s run was rejected for its leg motion. Quaternius CC0 Jog and measured human running informed the recovery sequence; the direct donor-leg transplant was rejected for poor ground contact. This delivery uses the original fitted Blender trajectory, with no new downloaded model.

[Native source, reproducible export, actual runtime video, checks and limitations](../../../art/characters/link/progress/2026-09-24-natural-legs/README.md). The final source script reproduces the delivered GLB byte-for-byte. The paired runtime also enforces the measured boot floor before leg IK: this removes a 13.8 mm startup-blend penetration and 2.73 mm steady-run corner penetration without changing the body's motion. Pre-existing downhill clearance remains about 9.7 mm; the evidence does not claim perfect terrain contact or photoreal anatomy.

## September 24 running hands and body-height repair

Previous delivery: **aa0520e0d7aaedcc452103ad14c81113866ff3c5adbd5307fdcedf711a248c89**, 54,422,264 bytes. This composes the run channels below with the reviewed Blender finger geometry. Its final game replay was completed in `2026-09-24T18-46-15-558Z-play-motion`; the owner subsequently rejected the remaining leg motion, replaced above.

Native run export **7e907dd06a7a0cbce48ae157441832a834eb505305a38f3d53cfe33a75ef2692** changes only four shoulder/elbow rotation tracks on `46dcbcc3`. Shoulder correction is measured relative to the leaning torso: peak forward upper-arm angle drops from 8.26° to 2.26° on both sides, retaining the original rearward extrema. The elbow opens by up to 4° during the rearward half. It preserves the Quaternius CC0-derived run's leg phase, wrist tracks, body/leg animation, 28/60-second cycle and 1.82 m stride, with no outward arm offset. The same 113-pose native arm-contact census improves 1269 to 1266 total; peak 24 and below-armpit 21 remain unchanged. Residual contacts are not eliminated.

The accompanying Blender hand study curves the four long fingers toward each palm by up to 35°, preserving the thumbs and finger bases. Exactly 1548 position rows move, by at most 7.659 mm; topology, weights, UVs, textures and blink data remain unchanged. Normals and tangents follow the deformation Jacobian. This rest-shape edit affects every gait. `run-torso-hands.json` verifies final composition after the run-track candidate, retaining the complete input binary prefix and unrelated metadata. Native review images are `torso-final-run-*`; earlier `04e6a86e` is an intermediate study, not this delivery.

The paired runtime reduces play-mode run speed to 3.3 m/s (about 218 steps/minute), preserves the authored arm timing, and removes narrow pelvis-height notches before foot IK. The retained walk speed is 1.2 m/s. Stored clip timing and `GAIT_SPEED` remain unchanged. [Implementation, measured jitter reduction, references and native evidence](../../../art/characters/link/progress/2026-09-24-run-jitter/README.md).

## September 24 walking arms and pace

Prior walk delivery: **46dcbcc36490ee5c86f6d9eb28d58d1743f60cfab02bb0c899b8388b6eda3de0**, 51,125,832 bytes. Four walk shoulder/elbow rotation channels are derived from Quaternius Universal Animation Library Standard `Walk_Loop` (CC0), phase-aligned to the retained legs and fitted in Blender to this rig's arm bend plane. The donor's elbow variation replaces the fixed elbow pose; carriage is less forward. Right sleeve clearance is 2.5 degrees; the left retains its original plane because the strap is asymmetric. Wrist tracks, other clips, body motion, geometry, materials and the original binary prefix are preserved.

The paired controller walks at 1.2 m/s instead of 1.6 m/s: the retained 0.88 m stride takes 0.733 s in play, approximately 164 steps/minute. Walk arm scaling and filtering are removed so the authored motion retains its timing relative to the feet. Stored clip duration and `GAIT_SPEED.walk` remain 0.55 s and 1.6 m/s for capture/grounding compatibility. Native contact checks improve 34 to 11 total, peak 4 to 2, below-armpit 1 to 0 over 113 poses. CPU runtime comparisons preserve protected body, root and foot/IK traces at matched pace. [Source, reproduction and game evidence](../../../art/characters/link/progress/2026-09-24-natural-walk/README.md).

## September 22 run posture and shoulder straps

Previous delivery: **7f406e40e65430ed3c11bd045e2e9482dae8cee8122e9869ed62a2c3cfecbbda**, 51,113,876 bytes. Running gains 10 degrees of forward chest lean, with the head, arms and pack moving together. Only the run chest rotation channel changes; original arm cycles, leg motion, stride, other clips, geometry and textures remain exact. A second incorrectly head-owned shoulder strap is reassigned to the chest through exactly 100 joint-index bytes. The two edits commute byte for byte. [Composition and default-asset check](../../../art/characters/link/progress/2026-09-22-right-strap/COMPOSITION.md).

The posture passes 600 flat runtime frames, 300 gait-transition frames, gaze and zero-dt checks. A matched 300-frame native game replay preserves every root/hip/foot/IK sample and shows the less upright carriage. The original 113-phase native contact census improves 1289 to 1269 total, with below-armpit count 21 unchanged; peak count rises from 21 to 24. Residual clothing contact and difficult stair posture remain unfinished. [Posture evidence](../../../art/characters/link/progress/2026-09-22-body-posture/DELIVERY.md) · [Five game comparisons and videos](../../../art/characters/link/progress/2026-09-22-run-posture-game/README.md).

Previous delivery: **1873fc17861455ac7b4e9cf624301039872e9d23dd7923bac3a2dc23851853d5**, 51,111,284 bytes. Exactly 243 active joint-index bytes attached the left strap to the chest; every other byte of `4dcf89c5` was preserved. All 243 points matched four native Blender poses within 0.0625 micrometres. The original 113-phase contact census improved 1316 to 1289, peak 22 to 21, with below-armpit count 21 unchanged. [Left strap selector and check](../../../art/characters/link/progress/2026-09-22-head-owned-patch/README.md).

## September 21 shorter boot tips

Previous delivery: **4dcf89c5c10391981289e2583152c26fb4ac93047c6fcb4bb0959e246805d850**, 51,111,284 bytes. A native Blender edit shortens only the distal boot tips, by at most 11.39 mm (about 4.1% of total sole length). Width, sole height, heels, ankles and cuffs remain unchanged. The source is 89df below; all original BIN bytes, rig, clips, weights, UVs, textures and morphs are preserved. Only body POSITION/NORMAL/TANGENT references change to appended arrays.

The earlier ankle-only327-point footprint omitted210 low toe vertices. Runtime source06552ded fixes that shared measurement. With the complete537-point footprint, the shorter model passes1,320actual player stair frames and708,840surface queries, including transitions and endpoint terrain: no negative samples/reach clamps/page errors, minimum+1.187mmup/+1.264mmdown. Peak knees167.22/168.35degrees and thigh/tunic intrusion remain unfinished. This is an incremental shape improvement, not completed locomotion.

Native pairs, exact deformation checks, provenance and fresh-clone verification: `art/characters/link/progress/2026-09-21-boot-tip/README.md`. Appended geometry adds3,286,068bytes; no added triangles or textures. Existing source/provider and CC0 animation provenance below are unchanged.

## September 21 repaired run delivery

Current local delivery: **89df38f255e47afbcbb28a60555fb4a4a20091741d427ef1d7b8ea1ac33f306b**, 47,825,216 bytes. It replaces only four run shoulder/elbow rotation channels on the colour-baked stairs delivery below. Historical native actions retained 32 unwanted fractional keys; the new carrier reconstructs the already-reviewed carriage from the smooth, hash-pinned `24591126` CC0-derived motion using fresh selected curves. Current calves, boot dimensions, geometry, materials, textures, morphs, hands' local channels, idle/walk/stairs, run hips/legs, stride and cycle are preserved exactly.

Continuity, native contact checks, matched images and reproduction: `art/characters/link/progress/2026-09-21-run-carriage/README.md` and `art/characters/link/progress/2026-09-21-motion-integration/README.md`. Native contact totals improve1452→1316 (peak99→22); intersections are not eliminated. Actual stair testing covers327sole vertices across1320frames with no negative samples on that route; extreme knee poses remain a separate limitation.

## September 21 colour/stairs base

Prior local integration base: **305603e92277952f345842e526216ff066b2b5888908eef054990199b6597a69**, 47,814,836 bytes. It composes the reviewed native upright-stairs channels onto ea939 calves/arms, then bakes Fable's exact colour grade into the existing body/orbital image allocations and brow factor. The paired loader removes its canvas grading pass; the audit reports `colorGrade: null` because no runtime grade is applied. Texture decode parity is exact; rig, geometry, UVs, morphs and all animation tracks are preserved through the colour bake. Idle/walk/run clips remain those of ea939.

Stairs change hips translation plus thigh/knee/ankle channels, adding the previously reviewed 40 mm mid-stance pelvis rise while retaining authored ankle paths. Phase/cycle/stride remain unchanged. Ground now reads new timber lips; curved-crown contact and natural posture are being validated separately. This is not a claim of final stair-animation acceptance or an adoption by the canonical Fable world branch. The optional torso-balanced preview remains a study because its upper-clothing contact count increased.

Reproduction and exact image/animation parity: `art/characters/link/progress/2026-09-21-color-bake/README.md`; native composition and paired images: `art/characters/link/progress/2026-09-21-motion-integration/README.md`. Image replacements fit inside their original allocations, with every other binary byte preserved; no delivery-size increase.

## Prior ea939 baseline


Character art by Astra. The prior asset is the reviewed native leg-alignment and run-arm
candidate `ea93932d`, derived from the previously adopted `382ec9ec` asset. The lower calves
and boots sit closer to their joints; the running arms have less forward carriage, more open
elbows and modest clearance from the side pouches. This is an incremental art improvement;
face detail, hand shape and stair posture remain unfinished.

| Property | Value |
| --- | --- |
| Source | `382ec9ec` at `d679e7ee`, patched by `art/characters/link/progress/2026-09-20-natural-run/export_candidate.py` using its native vertex record and `run-arms-native.glb`. The study README includes five matched comparisons and exact reproduction commands. |
| SHA256 | `ea93932d8afe02ec4bbcf3487fb20ce3f55272fb60f20998dc728cb637ae575f` |
| Size | 47,784,756 bytes; selected buffers are appended after the preserved original binary prefix. |
| Geometry | Existing 70,442 triangles, three skinned meshes/five primitives, four materials. 13,492 lower-leg vertices move inward below 0.40 m, by at most 45 mm at the sole. Height/depth, topology, skin weights, UVs, maps and blink position deltas are preserved. Normals/tangents follow the deformation shear; translations preserve their frames exactly. |
| Animation | Only run rotations of shoulderL/R and elbowL/R change: backward carriage, slightly open elbows and pouch clearance. Native 240 fps carrier, 113 samples, same 28/60-second cycle and 1.82 m stride. All unselected channels and clips are preserved. |
| Maps | Existing embedded body colour, normal, metallic/roughness, face/orbital and corneal textures, unchanged. |
| Exporter | Blender 4.5 glTF native animation carrier plus the checked standard-library Python patcher. Original binary prefix and every unselected JSON value are retained. |
| Rig and contact markers | Existing skeleton, rest transforms and ankle-local sole markers, unchanged. |

## Clip compatibility

| Clip | Duration | Stride | Travel speed |
| --- | --- | --- | --- |
| `idle` | 3.0 s | — | 0 |
| `walk` | 0.55 s | 0.88 m | 1.6 m/s |
| `run` | 0.466667 s (28/60) | 1.82 m | 3.9 m/s |
| `stairs` | 0.733333 s | 0.806667 m | 1.1 m/s |

The bone hierarchy, clips, strides and sole markers retain the production loader's contract.
No playback, head-look, grounding or terrain-IK logic changes are required for this asset.

## Provenance

The body and its base maps come from the original Rodin Gen-2.5 two-view character study,
conditioned on the project's own generated front/back concept views. The native Blender
work preserves the source geometry, reuses the validated rig and adds eyes, orbital
corrections, brass response on six existing boot fittings, and surface-following lashes/brows.
The original iris albedo was generated with the built-in image_gen tool and radially mapped
and baked in Blender. The pupil/iris radius ratio stays 0.557; reflections come from the
corneal clearcoat material.

Exact generation records, sources, Blender studies and validation are preserved at `bef8e85`:

- [Character study and provenance](https://github.com/Leonxlnx/zeldaremake/tree/bef8e85/art/characters/link/experiments/2026-09-13)
- [Iris image prompt, tool and hash](https://github.com/Leonxlnx/zeldaremake/blob/bef8e85/art/characters/link/textures/original-iris-teal-v1.json)
- [Export validation](https://github.com/Leonxlnx/zeldaremake/blob/bef8e85/art/characters/link/experiments/2026-09-13/source-runtime/textured-iris-validation.json)

These are original generated/authored assets, not Nintendo meshes. Reference video frames
are not used as model textures or scenery. Earlier CC0/MPFB/hair experiments remain separately
credited in the study archive; they should not be assumed to be inputs to this export.

## Adopted builds (fable-cursor)

| Adopted | SHA256 | From | What changed against the previous adoption |
| --- | --- | --- | --- |
| 2026-09-14 | `9189538d…c71a` | `bef8e85` | Textured iris candidate: eyes, orbital corrections, brass boot fittings, lashes/brows |
| 2026-09-16 | `0c28cb62…b707` | `1c06b00` (PR #10) | Her retained chain bdcb9ec7 → d5213ba7 → e5882cc5 → 322c3433 → 9344a2b0 → 844cb82b → 0646f2e9 → 39a55c95 → 75f42cd2 → 0c28cb62: pupil proportion, brow placement, rear-hem / sleeve / belt / shoulder skin-weight repairs, `blink` + `blinkHalf` morphs (character-8 drives them), lower run arc, neutral mouth and nose shading. Rig, clips, strides and sole markers unchanged; the loader's contract holds as is |
| 2026-09-16 | `3f6cb6f3…eadf` | `9c66fa8` (PR #10) | Alert eyelid opening: 774 orbital vertices, aperture 19.93 → 23.23 mm, closed and half-blink positions rebased; clips, textures, UVs, weights, binds preserved (0c28cb62 is its parent) |
| 2026-09-16 | `4741cf3e…1768` | `73ccdc0` (PR #10) | Via 17d18d15 (animated orbital normals smoothed — closed-lid ridges reduced): 17-vertex inner-corner separation (≤ 0.096 mm) so all 41 sampled blink phases clear self/eye contacts; rest geometry, textures, rig, clips unchanged (3f6cb6f3 is its parent) |
| 2026-09-16 | `24591126…bfa4` | `b1f2008` (PR #10) | Via 55cc8ef3 (shoulder weights), 1c08dec3 (lower-tunic weights), ace15add (run stride 2.21 → 1.82 m, cycle 34 → 28 frames at 60 fps, same 3.9 m/s), 611c4425 (stance 0.25 → 0.20, flight bounce 45 → 12 mm, 120 fps bake): run arms retimed from Quaternius Universal Animation Library Standard `Jog_Fwd_Loop` (CC0), phase-aligned in Blender. Paired loader change: `CLIP_SPEC.run` = stride 1.82 m, cycle 28/60 s, heroClipTime (15/60)·(28/34). Geometry, textures, blink, idle/walk/stairs unchanged (4741cf3e is its parent) |
| 2026-09-20 | `382ec9ec…92eb` | `0dfd3601` (PR #21), regenerated from `24591126` by her `export_candidate.py relaxed-run` + `boots.py` | Owner's "natural running legs, arms, smaller boots" pass. Run clip only: shoulder carriage rotated 0.10 rad inward (elbow, wrist and torso channels — the CC0 Quaternius `Jog_Fwd_Loop` retime — untouched, same timing); leg swing from her 3218b164 study (faster shoe clearance after toe-off — 8.9 → 36.6 mm near the first 60 Hz frame after toe-off — continuous endpoint velocity, ≤ 7 mm fore/aft overshoot; hips byte-exact); stride 1.82 m, cycle 28/60 s, duty 0.20 unchanged, so `CLIP_SPEC` is unchanged. Boots 10 % narrower and 12 % shorter below 0.10 m fading to the unchanged cuff at 0.20 m (11,244 vertices; rest sole height, sole markers, rig, skin weights, UVs, textures, blink morphs, idle/walk/stairs clips unchanged; 24591126 is its parent). Paired runtime change (same PR, adoptable separately): the play-mode run grounding fades to the run cycle's sampled floor by the run action's weight instead of grounding the lowest sole every frame, and a swing's take-off anchor is the foot's last rendered stance sole (`Locomotion.offX/offZ`) for both the sole and the hip of its frozen clip pose |

The 2026-09-20 natural-run revision above was adopted locally by Astra after the five native
comparisons, a 300-frame actual walk/run/idle test and 1,320 actual stair frames. No browser
page errors or reach clamps were recorded. The initial every-tenth-frame stair contact samples
missed brief intersections. A subsequent every-frame run finds a -67 mm minimum in a swinging
shoe; this and the maximum knee bends (162 degrees up / 155 degrees down) remain open. The
separate stance-support correction reduces the worst descent root step from 60 to 20 mm.
Its dense native manifest records one aborted GLB request alongside the successful HTTP 200
load and verified served asset; no fallback model was used.
Native arm/body triangle contacts decreased from 1,666 to 1,452 across the sampled loop; they
are not eliminated. See `art/characters/link/progress/2026-09-20-natural-run/README.md`.

Astra's per-build records (`Retained …` entries and their evidence folders) are in the
SOURCE.md on `agent/astra-local-link-grounding`; only the adopted build is copied here.

## Recorded checks and remaining work

Studio `2026-09-14T00-19-06-205Z-runtime-studio` completes 18 actual WebGL views and
363 locomotion samples. The full Fable a98e9ea world comparison
`2026-09-14T00-22-20-662Z-integrated` completes six fixed views, a separate spawn portrait,
repeat and motion with no page errors. Existing W41 difference is 0; the raw maximum channel
delta is 4, above the separate two-level diagnostic tolerance. Exact screenshot equality is
not claimed. These local checks are not CI-attested takes or a phase exit.

The new file is larger than the prior delivered 409b603 asset (20.5 MB / 24,108 triangles).
C_lookback records 431 draws and 8,830,004 rendered triangles for the full world. Eye openings,
facial form, hair and per-foot tread contact remain unfinished; no final art acceptance.
