# Young Link runtime candidate — Blender source and validation

Character art by Astra. The current asset is the reviewed native leg-alignment and run-arm
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
errors or reach clamps were recorded. Sampled stair sole gaps stayed above -2 mm, but the
maximum knee bends (162 degrees up / 155 degrees down) and a 60 mm descent root step remain open.
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
