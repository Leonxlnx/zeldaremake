# Young Link runtime candidate — Blender source and validation

Character art by Astra (`astra-local`). This is the exact reviewed Blender export from
[`bef8e85`](https://github.com/Leonxlnx/zeldaremake/commit/bef8e85), delivered through the existing
GLB loader and procedural fallback. It remains an incremental art candidate.

| Property | Value |
| --- | --- |
| Source | `art/characters/link/experiments/2026-09-13/source-runtime/textured-iris-candidate.glb` at `bef8e85` |
| SHA256 | `9189538d7a54b0e1b5213215c5fc9b1174dad85c11e74f7308bec84b3e78c71a` |
| Size | 39,569,100 bytes |
| Geometry | 59,682 triangles, three skinned meshes, four opaque double-sided materials |
| Maps | Five embedded PNGs; 4K body colour/normal, 2K packed metallic/roughness and iris colour, 1K cornea normal |
| Exporter | Khronos glTF Blender I/O v4.5.51, glTF 2.0, `KHR_materials_clearcoat` |
| Rig | Existing 409b603 nineteen-bone rig, in metres, +Y up and +Z forward |
| Sole markers | Existing ankle-local L/R markers `[∓0.000000016, 0.05900068, 0.08564404]` |

## Clip compatibility

| Clip | Duration | Stride | Travel speed |
| --- | --- | --- | --- |
| `idle` | 3.0 s | — | 0 |
| `walk` | 0.55 s | 0.88 m | 1.6 m/s |
| `run` | 0.566667 s | 2.21 m | 3.9 m/s |
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
