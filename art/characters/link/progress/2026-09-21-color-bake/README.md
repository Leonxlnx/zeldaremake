# Exact colour bake — evidence, 2026-09-21

The existing one-time runtime colour correction is captured exactly in two lossless PNGs plus the brow material factor. The final delivery uses the existing image allocations and adds **no binary storage overhead**. The stairs delivery is **47,814,836 bytes**, 524 bytes smaller than its selected ungraded motion input. Independent **plain GLTFLoader** checks prove pixel/material parity against the actual production loader's graded output, plus exact decoding of all animation tracks. No production source/default asset, Blender scene, GPU renderer or animation is changed by this study.

Use `stairs-upright-delivery.glb` for the selected stairs-only integration; `torso-balanced-delivery.glb` remains the optional balanced-torso preview. Root owns their motion/contact acceptance and final adoption. Keep asset adoption and removal of the runtime grade together: a baked asset passed through the old grader would receive the colour operation again. The original Canvas outputs and append-only GLBs remain preserved as authoring evidence.

## Inputs, routing and provenance

The source is the unchanged default `ea93932d8afe02ec4bbcf3487fb20ce3f55272fb60f20998dc728cb637ae575f` (47,784,756 bytes). Capture used `glbLink.ts` SHA256 `63904e225810b56337bfaecde9fd4aef1e809248ea952e9461dcf771a9272107` and `linkColorGrade.ts` SHA256 `c24c50565c4027cbdaff8e715b0d7836c22c6d11b8de645b8edc89a7816afab1`. Exact copies are retained as `source-glbLink.ts.txt` and `source-linkColorGrade.ts.txt`; later removal of the grader does not erase its authoring provenance.

| Material | GLB route | Change |
| --- | --- | --- |
| 1, `model.036` | texture 2 → image 2, `hardware-body-color`, source view 24 | 4096² graded body colour PNG |
| 2, `Link \| orbital skin.034` | texture 4 → image 4, `face-orbital-color`, source view 41 | 1024² graded orbital skin PNG |
| 3, `Original warm brow fibres.034` | no texture | linear base colour `[0.3, 0.155, 0.04, 1]` |
| 0, clearcoat eyes | texture/image 0, `corneal-eye-color` | unchanged |
| Body normal and metal/roughness | images 1 and 3 | unchanged |

Both affected source and resulting colour atlases were visually inspected. The source images were extracted byte-for-byte before capture. `public/models/link/SOURCE.md` identifies original Rodin Gen-2.5 body/maps conditioned on the project's generated concepts, plus the separately authored/generated eye work. This bake is a deterministic colour transformation of those existing assets; it adds no new image source, paid motion, service or package. The verified CC0 Quaternius motion license is a separate provenance statement and does not assign CC0 to the generated character. `package.json` declares MIT; no root or character-specific LICENSE file was found during this bounded inspection.

## Exactness checks

`capture.mjs` first loads the ungraded GLB with plain GLTFLoader and records every mapped material. It then invokes the **real project loader once**. Its body mask comes from the actual skinned UVs/weights and the existing grading implementation, without rebuilding the HSL operation elsewhere. The graded Canvas pixels are read back and encoded as PNG.

The original Canvas PNGs match their pre-encoding RGBA digests both after a browser roundtrip and after an independent sharp/libvips decode. All alpha bytes are 255 and unchanged. The body changes 7,039,535 pixel colours; the orbital map changes 578,217. The recorded 1024² region-mask coverage is head 0.1619, torso 0.2493, arms 0.0783, legs 0.2050. Full grading statistics and original/corrected hashes are in [capture.json](capture.json).

`patch.mjs` requires the selected input's exact SHA256. It also checks the original ea939 binary prefix and the same ungraded images/materials/nodes/meshes/skins/texture routing. These checks keep the captured UV/skin-region mask applicable. It appends only two aligned PNG payloads and two bufferViews, redirects images 2/4 and updates the brow factor. It preserves **every byte of the selected input's original BIN chunk** and every undeclared JSON value, including all animation/accessor, geometry, skin, morph and rest data. Image payloads 0/1/3 remain exact.

The patcher accepts both already-tested motion compositions (`e3ef74a0…b552`, `ad0518e6…53c9`) because those authoring inputs are unchanged. The same gates apply to any later selected motion carrier. Wrong hashes, already-baked inputs and attempts to overwrite the input are rejected before output creation; [patcher-check.json](patcher-check.json) records the runnable check.

`verify.mjs` defaults to plain GLTFLoader. Its optional `production` mode also loads the adopted character through the production loader and requires `colorGrade: null`; neither mode applies the old grade. For each baked GLB, every decoded map RGBA hash and all checked material/map properties equal the captured post-grade baseline. This includes brow colour, roughness, metallic/normal/clearcoat state, UV channel, colour space, sampler filters/wrap and texture transform. Both verifications created no renderer and recorded no browser errors.

The two corrected RGBA SHA256 values, shared by both encodings, are:

- Body: `2e024fb6b314b23b06a2b31ae3ff101648f9d37e23b71c82126aab72cf63c117`
- Orbital: `aaf44bb77f90693791202d65f2ef8822399cd42a99548b338ebb0ded35415a4a`

## Lossless size comparison

`compress.mjs` verifies that every alpha byte is opaque, removes only that redundant channel, and writes true-colour RGB PNG with compression level 9, adaptive filtering and no palette/quantization. Decoding back to RGBA matches the original captured pixel hashes exactly. These are the existing sharp [PNG output options](https://sharp.pixelplumbing.com/api-output/#png) and [alpha removal operation](https://sharp.pixelplumbing.com/api-channel/#removealpha); installed versions/options are recorded in [png-compression.json](png-compression.json).

| Image | Original source view | Exact Canvas PNG | Lossless RGB PNG | Saved versus Canvas |
| --- | ---: | ---: | ---: | ---: |
| Body | 13,515,711 B | 19,585,160 B | 12,607,646 B | 6,977,514 B |
| Orbital skin | 144,927 B | 180,713 B | 101,611 B | 79,102 B |
| Total | 13,660,638 B | 19,765,873 B | 12,709,257 B | 7,056,616 B |

The earlier append-only archive method appends 12,709,260 aligned bytes and retains the original image payloads. It increases the ea939 archive by **12,708,884 bytes** after JSON serialization. The final delivery below resolves that overhead by replacing the two exclusive PNG allocations in place. No load-time or frame-rate gain is claimed.

| Evidence GLB | Bytes | SHA256 |
| --- | ---: | --- |
| `ea939-color-baked-lossless.glb` | 60,493,640 | `3cb51f3653c0519f33fe32653d7351c5ff3d7c38944cb7f00001fcb673f704c7` |
| `ea939-color-baked.glb` (original Canvas encoding) | 67,550,256 | `9ade5a3b7ab3ff63fccb228423929f7994c8dc861fc9d53ea0e49be105ee3b0b` |

Each GLB has an adjacent `.json` preservation report and `.parity.json` raw-loader parity result. The GLBs above contain the original ea939 motion, not a later motion choice.

## Final delivery with no added storage

`deliver.mjs` starts from the selected **ungraded** motion candidate, verifies its mandatory SHA256 and the same capture contract, and replaces the PNG prefixes inside original views 24 and 41. Both new PNGs are smaller than those original allocations. It shrinks only the two `bufferView.byteLength` values, keeps their indices/offsets and the total BIN/buffer length, and changes the brow factor. The remaining 908,065 body bytes and 43,316 orbital bytes are left untouched and outside the shortened views. A bufferView represents a declared byte range with a positive length; the existing offsets remain valid. [Khronos glTF 2.0 bufferView specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#reference-bufferview)

Before any output is written, each target view must have exactly one reference (`images.2.bufferView` or `images.4.bufferView`), no overlapping view, no accessor or sparse-accessor reference, and no uninspected extension that could refer to binary data. The only extension present is `KHR_materials_clearcoat`. The writer directly compares every BIN byte outside the two replacement spans, checks retained old-image tails, and restores the three allowed JSON edits to prove all other metadata exact. No view/index remapping, buffer repack, geometry quantization or extra package is involved.

For stairs-only, all **684 accessors / 696 base and sparse byte spans** are unchanged. For balanced torso, all **688 accessors / 700 spans** are unchanged. This includes geometry, skin, morphs, inverse binds and animation buffers; individual span digests are in each delivery's `.json` report. The untouched image payloads 0/1/3 also remain exact.

| Delivery and intended use | Input SHA256 | Bytes | Output SHA256 |
| --- | --- | ---: | --- |
| `stairs-upright-delivery.glb`, selected default pending integration | `e3ef74a02336b5f6952ed340e8191369284dacc92da9b5782dd9f3cb7dceb552` | 47,814,836 | `305603e92277952f345842e526216ff066b2b5888908eef054990199b6597a69` |
| `torso-balanced-delivery.glb`, optional preview | `053a1536b456a08f2e40adf813724d24c21ee60b80c900eda1d16734416172e6` | 47,820,016 | `7ea3e0f281010e43ff460ca3f6e34beb40cdf7ee46a811656284e76da9785004` |

The stairs and balanced outputs are respectively 524 and 528 bytes smaller than their selected inputs because the JSON becomes shorter. Their BIN chunks retain the same lengths and offsets. The existing append-only balanced archive in the integration directory is also left untouched.

Both deliveries pass `verify.mjs`: every decoded map pixel and checked material property equals the captured real-loader result, with zero grading calls. `verify-animation.mjs` independently loads each ungraded source and delivery with plain GLTFLoader: **idle, walk, run and stairs each preserve all 57 tracks**, including names, interpolation, duration, time-array type/bytes and value-array type/bytes. Each delivery has a complete `.animation-parity.json` report. This is exact decoded animation parity, not a new motion-quality claim.

`check-delivery.mjs` proves wrong-hash and already-baked inputs are rejected, input/output overwrite is refused, rejected invocations create no output, and all archives remain byte-identical. The existing GLB serializer was extracted from `patch.mjs` for reuse; it reproduces both archived GLBs' exact hashes.

## Reproduction and adoption handoff

Run from the repository root with the pinned ungraded ea939 source/runtime present. Outputs must be new paths because the patcher and verifier refuse overwriting their delivery/evidence files. Capture depends on the pre-removal loader; the checked-in PNGs/manifests can be patched and verified without restoring that loader.

```powershell
node art/characters/link/progress/2026-09-21-color-bake/capture.mjs
node art/characters/link/progress/2026-09-21-color-bake/compress.mjs
node art/characters/link/progress/2026-09-21-color-bake/deliver.mjs INPUT.glb NEW_OUTPUT.glb EXACT_INPUT_SHA256
node art/characters/link/progress/2026-09-21-color-bake/verify.mjs NEW_OUTPUT.glb EXACT_OUTPUT_SHA256
node art/characters/link/progress/2026-09-21-color-bake/verify-animation.mjs INPUT.glb EXACT_INPUT_SHA256 NEW_OUTPUT.glb EXACT_OUTPUT_SHA256
node art/characters/link/progress/2026-09-21-color-bake/check-delivery.mjs
```

The delivery payload is the smaller lossless RGB PNG. The retained `patch.mjs INPUT OUTPUT SHA [lossless|canvas]` reproduces the append-only archives. Its optional final `canvas` argument reproduces the original Canvas encoding. `check-patcher.mjs` and `check-delivery.mjs` expect the named evidence inputs/fixtures; they are regression checks for this study, not generic asset validators.

For the selected motion candidate, root can use the verified delivery or reproduce it from the exact hashed asset with `deliver.mjs`. Pack these same lossless PNGs into duplicated native Blender materials, assign sRGB, and apply the **linear** brow factor. Remove `gradeLinkMaterials`, its imports and its invocation when adopting the baked GLB; preserve the audit field as `colorGrade: null` if current capture consumers need it. The earlier [removal workflow](../2026-09-21-motion-research/COLOR_BAKE_WORKFLOW.md) identifies the local call site.

Remaining validation belongs to integration: verify the post-removal production loader reports no applied grade, run typecheck/build and compare one matched native/game view. This CPU result establishes exact textures/material input, not final lighting, shader/render parity, anatomy quality or license clearance of earlier generated assets. There is no production adoption or commit in this evidence task.

## Local integration result

Root adopted `305603e9` locally with the matching runtime-grader removal. `stairs-upright-delivery.glb.production-parity.json` records exact material/map RGBA parity through the current production loader, all four materials and zero page errors. The full game capture is linked from the [integration report](../2026-09-21-motion-integration/README.md). Native delivery baseline is reconstructed by `import_comparison.py` from the shipped GLB, so no duplicate 37 MB Blender archive is needed in this commit.

The original Canvas/source PNGs and duplicate full GLBs remain local authoring archives, excluded by this directory's `.gitignore`. The two lossless payload PNGs, capture contract, exact source implementation, native motion carrier and hash reports are retained for reproducibility.
