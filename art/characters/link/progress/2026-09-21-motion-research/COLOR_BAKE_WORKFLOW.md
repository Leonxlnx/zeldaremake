# Exact colour bake and runtime removal: read-only handoff

Implementation follow-up: [the completed colour-bake evidence](../2026-09-21-color-bake/README.md) now contains the exact captured PNGs, lossless compression, independent pixel/animation parity and `deliver.mjs`. Final delivery replaces the two original exclusive image allocations because the new PNGs are smaller; this removes the append-only storage overhead while preserving every offset/index and all non-image bytes. The append-only approach below remains the original authoring/archive proposal.

Smallest exact workflow: capture the **already graded RGBA pixels from the existing loader**, encode them losslessly, replace just those two GLB images plus the brow factor, and remove the runtime grade in the same adoption. No Blender shader rebake or new HSL implementation is needed.

Inspected source: `src/world/character/linkColorGrade.ts`, all callers in `glbLink.ts`, `linkColorGrade.test.mjs`, and the existing native bake/export/check scripts in the primary workspace. `node src/world/character/linkColorGrade.test.mjs` passes. This handoff creates no textures, assets, Blender changes or production code changes.

## Exact existing behaviour

`gradeLinkMaterials` finds the first skinned primitive with both a normal and colour map. It rasterizes its dominant skin-joint regions into a 1024² UV mask, using the existing triangle order and seam tolerance. The head/cap mask restricts the hair band. It grades body and orbital skin from **sRGB-encoded RGBA8** through the shared HSL table, using Float32 intermediate values and byte rounding. The orbital map receives region-free entries. Alpha is untouched, clearcoat eye materials are skipped, and brows receive a **linear** RGB factor. Reimplementing any of these decisions in Blender would require extra pixel-parity work.

For the pinned `ad0518e6…53c9` candidate, the GLB routing is:

| Edited input | Exact current routing | Required bake |
| --- | --- | --- |
| Body colour | material 1 `model.036` → texture 2 → image 2 `hardware-body-color` | the already graded 4096² canvas PNG |
| Orbital skin colour | material 2 `Link \| orbital skin.034` → texture 4 → image 4 `face-orbital-color` | the already graded 1024² canvas PNG |
| Brows | material 3 `Original warm brow fibres.034` | `pbrMetallicRoughness.baseColorFactor = [0.3, 0.155, 0.04, 1]` |

Retain eye image 0, normal image 1 and metal/roughness image 3 byte-for-byte, along with all geometry, UVs, weights, morphs, binds, animation, texture samplers, material roughness and clearcoat. The existing colour images are PNG already; use lossless PNG for the replacements too.

## Implementation sequence

1. Pin the source GLB SHA and both `glbLink.ts` and `linkColorGrade.ts` digests. On a CPU-only Vite page, load the source once with the existing `loadGlbLink`. Traverse unique materials and read the two resulting `HTMLCanvasElement` maps. Save their `getImageData` RGBA digests, dimensions, grade audit statistics and PNG output (`toBlob`/`toDataURL`). Save the actual linear brow colour too. Keep the original RGBA digest before encoding; decode the saved PNG in the same browser and assert identical RGBA bytes, including alpha.
2. Reuse the append-only GLB pattern from `progress/2026-09-19-run-contact/export_candidate.py`: verify the source hash, preserve the original binary prefix, append the two PNG blobs at four-byte-aligned offsets, append bufferViews, point **images 2 and 4** at them, and change only the brow `baseColorFactor`. Update GLB chunk lengths and its single buffer length. This is a small image-specific patcher; do not run a whole Blender GLB export just to replace pixels.
3. Independently inspect the patched GLB with plain `GLTFLoader`, which does not call the project's grade function. Its decoded body/orbital RGBA hashes and linear brow factor must equal step 1. Check exact JSON invariants for every unselected value, unchanged image bytes 0/1/3 and the original binary prefix. The patcher should require the pinned **ungraded** input hash so a repeated invocation cannot grade a baked input again.
4. In a duplicate native study, load and pack those exact PNG files into the two existing material image nodes, set their colour space to sRGB, and set the brow Principled base colour to the stated linear factor. Copy shared material/image data before changing it so older study scenes remain intact. No mesh, UV, armature, keyframe, normal or PBR rebake is required. This keeps the editable `.blend` aligned with the delivered GLB.
5. Adopt the baked GLB and remove the runtime grade together. Remove the `linkColorGrade` import, `gradeLinkMaterials` function, its call, and the now-unused Three.js `MeshStandardMaterial` import from `glbLink.ts`. No external source caller reads `colorGrade`; preserve that audit field as `colorGrade: null` for old capture consumers, or remove it and its obsolete interface coherently. Keep the grading table/test as authoring provenance until the exported-pixel check and source-bake documentation replace its maintenance role. Add no permanent toggle or second grading path.
6. Verify the post-removal production loader's decoded pixels/material factors match the current-runtime baseline, and that it reports no applied runtime grade. Then run the relevant typecheck/build and one matched native game view under identical renderer/camera/light/clip conditions. Do not claim a load-time or frame-rate gain without a timed comparison.

The current source calls grading only once in `loadGlbLink`; its helper has no other callers. Its output field is populated only for the audit. Removal can therefore be local to that file. Existing motion checks should stay equal because the baked change touches only two image payloads and one material factor.

## Existing tools: reuse and limits

- `linkColorGrade.ts` is the sole authoritative grading implementation and already has a runnable math/mask check. Reuse its actual loader output; no new package is needed. Vite, Puppeteer, Three.js and optional `sharp` are already installed.
- `progress/2026-09-19-run-contact/export_candidate.py` supplies verified GLB parsing, alignment, append-only composition and untouched-data checks. It currently assumes animation accessors, so use its small pattern for image blobs rather than broadening it into a generic asset framework.
- The primary workspace's `bake_runtime.py` is a selected-to-active Cycles PBR bake for an earlier procedural asset. It is not an exact replacement for the current runtime HSL grade.
- `experiments/2026-09-13/bake_face_colour.py` demonstrates packing an image and preserving native state, but also edits UVs and exports the whole model. Those changes are unnecessary here.
- `experiments/2026-09-13/check_hand_bake.py` demonstrates image-byte, bind and animation preservation checks. The new image-only patch can use simpler exact comparisons because it need not renumber geometry.

The append-only patch retains now-unused original image bytes in the GLB, so file size will increase. That known tradeoff buys exact preservation and reviewability for this bounded change; binary compaction is separate work only if measured transfer size warrants it.
