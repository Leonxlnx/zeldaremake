# Young Link runtime candidate — Blender source and validation

Character art by Astra (`astra-local`). This corneal geometry candidate builds on the
reviewed `bef8e85` / `9189538d` export. The source and completed local comparisons are
preserved at `57495fc`. It improves reflections in Fable's `beb8d88` world; full CI and
final character art acceptance remain separate requirements.

| Property | Value |
| --- | --- |
| Source | `art/characters/link/experiments/2026-09-13/source-runtime/corneal-candidate.glb` at `57495fc` |
| SHA256 | `6f28903df21df73c964a5863d1a84fa79fae79aed1602170bc840336f90eb889` |
| Size | 39,451,396 bytes |
| Geometry | 59,682 triangles, three skinned meshes, four opaque double-sided materials |
| Maps | 4K body colour/normal, 2K packed metallic/roughness and iris colour; no separate cornea normal map |
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
All animation channel/accessor bytes, inverse bind matrices, and body mesh attributes and
indices are identical to `9189538d`. Only the two eye surfaces and their shared material change.

## Provenance

The body and its base maps come from the original Rodin Gen-2.5 two-view character study,
conditioned on the project's own generated front/back concept views. The native Blender
work preserves the source geometry, reuses the validated rig and adds eyes, orbital
corrections, brass response on six existing boot fittings, and surface-following lashes/brows.
The original iris albedo was generated with the built-in image_gen tool and radially mapped
and baked in Blender. The pupil/iris radius ratio stays 0.557. A smooth convex bulge moves
87 front vertices per eye, up to 12 mm; iris X/Z coordinates and the outer sclera stay fixed.
The old clearcoat normal texture is removed; reflections follow the actual curved geometry.

Exact generation records, sources, Blender studies and validation are preserved at `bef8e85`:

- [Character study and provenance](https://github.com/Leonxlnx/zeldaremake/tree/bef8e85/art/characters/link/experiments/2026-09-13)
- [Iris image prompt, tool and hash](https://github.com/Leonxlnx/zeldaremake/blob/bef8e85/art/characters/link/textures/original-iris-teal-v1.json)
- [Export validation](https://github.com/Leonxlnx/zeldaremake/blob/bef8e85/art/characters/link/experiments/2026-09-13/source-runtime/textured-iris-validation.json)

These are original generated/authored assets, not Nintendo meshes. Reference video frames
are not used as model textures or scenery. Earlier CC0/MPFB/hair experiments remain separately
credited in the study archive; they should not be assumed to be inputs to this export.

## Recorded checks and remaining work

Studio `2026-09-14T04-03-42-643Z-runtime-studio` completes 18 actual WebGL views and
363 locomotion samples with no page errors. The unchanged-body/clip comparison is recorded
in `source-runtime/corneal-motion-comparison.json`. Actual world capture
`2026-09-14T04-22-07-781Z-integrated` completes six fixed views, spawn portrait, repeat and
motion with no page errors, against the unchanged `beb8d88` baseline04-02-41.
The W41 difference is0; raw maximum channel difference4 exceeds the separate two-level
diagnostic tolerance. Exact screenshot equality is not claimed. These local checks are
not CI-attested takes or a phase exit. Eye openings, facial form, hair and per-foot tread
contact remain unfinished; no final art acceptance.
