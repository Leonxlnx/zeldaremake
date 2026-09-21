# Independent native review — atlas colour recovery

**Verdict: accept `181986ba8d6f1213ff8e03aa5109116c80157dfe` as a bounded colour-encoding correction.** The actual improvement is clear in the distant-crown and sky-opening views. It does not resolve the coarse bank-canopy geometry or make the environment visually complete.

I inspected the untouched before/after PNGs for A/B/C/D/F, W05, sky-opening, f4-crown-up, and both distance views. Base: `5f587c7f0cc9644470c75cc8846252ec7107f2a9`. Both manifests are complete, have no capture errors, and identify the same native AMD Radeon 780M/ANGLE renderer. Capture settings, per-view cameras and reported draw statistics match. The diff changes only the four existing Canvas CSS colour helpers, with no silhouette or placement edit. No GPU/capture was started for this review.

## What the raw images show

- **Distance 119/121 m:** the main visible gain. Lit crown faces recover green/olive colour and their smaller clumps separate better; previously much of the foliage read near-black. Dark undersides and gaps remain, so the colour lift does not flatten every crown to one bright tone. The two after views look consistent. I found no new white, neon or anomalously saturated patch. Repeated rounded silhouettes, crossed-sheet edges and very dark lower faces remain obvious; the stronger upper colour can make those existing construction cues easier to see. This is improved albedo/readability, not a resolved geometry problem.
- **Sky opening:** foliage around the blue opening, especially the middle/right canopy, has more readable green variation and overlap. Bright leaves on the left remain integrated with the existing shafts. No new solid bright panel or closed sky opening is apparent.
- **A/B/C/D/F:** the overall change is small. Foreground stone, houses, trunks and character remain visually stable. C/F should not be presented as a substantial canopy-quality improvement.
- **f4-crown-up:** the large nearby laminae retain their veins, dark faces and shape; background foliage changes are slight. Existing oversized/angular leaf presentation is still visible. I found no new bright flat patch introduced by this patch.
- **W05 floor guard:** visually unchanged, independently verified as zero changed RGB pixels; the PNG SHA-256 is identical. The accepted floor moss is preserved.

## Exact limits, checked against the raw pixels

The large F bank cores remain coarse at **(840,205), (990,159), (667,70)**. Their before/after RGB values are exactly `[48,51,41]`, `[48,52,47]`, `[58,61,48]` respectively. C's core at (160,133) is also unchanged. Their smooth oval interiors are still the most conspicuous local tree defect.

The previous CPU atlas intersections are **not evidence of meaningful rendered improvement**: F (252,42) changes only `[104,112,115] → [104,113,115]`; C (837,208) remains `[62,70,39]`. CPU geometry/texture coverage cannot establish which rendered contribution dominates a pixel through the full shading, wind and atmosphere.

Independent raw RGB checks support the visible scope:

| View | Pixels changing by more than 3/255 in any RGB channel | Mean display luma before → after |
| --- | ---: | ---: |
| distance 119 m | 564,433 / 921,600 (61.25%) | 0.2393 → 0.3085 |
| distance 121 m | 563,066 / 921,600 (61.10%) | 0.2414 → 0.3106 |
| sky-opening | 182,094 / 921,600 (19.76%) | 0.4371 → 0.4424 |
| F | 3,048 / 921,600 (0.33%) | 0.3252 → 0.3254 |
| C | 15,016 / 921,600 (1.63%) | 0.3457 → 0.3465 |
| W05 | 0 | 0.4695 → 0.4695 |

Luma here is Rec.709-weighted **display RGB**, not linear radiance. These figures describe colour change and do not score quality.

Evidence coverage caveat: `E_ground` is byte-identical to `B_house` in each side of this pair (same respective hashes), so it does not add an independent ground viewpoint. W05 provides the actual separate floor guard. The still pair does not verify temporal LOD popping or frame-time behaviour.

Only this review file was written; production source and the parent's other evidence files were retained.
