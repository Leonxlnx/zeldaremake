# Lantern branch bark: isolated angular response trial

The large lantern branch still reads as a smooth band in the original A/B images. Its existing
normal map is present, but the material's strong shade floor suppresses much of the diffuse
variation. This candidate gives that floor a small response to the existing mapped normal and
hemisphere lighting. It changes no light, color preset, texture, normal strength or geometry.
The goal is a more readable bark surface; it cannot create knotted collars or a new silhouette.

Baseline production material is unchanged from Fable's published
`901b65b9ec45a1355cf3169d245e93892d98b7da`, including the later integrated distant-hut glow
and disposal work. At the current flower checkpoint `9f2e98b27ab6afd177d344e4d9a830ef24efab31`
the file is still SHA256 `a1ff83add8f3c3ef13a8fe1f9da7ce432b23ae6dbd69ffb7ac24473dcc2d7da1`.

The only production edits are one import and call in `structures/materials.ts`, plus the
34-line `structures/sleeveBark.ts` helper. Removing those two lines restores the exact original
material file. The helper chains the existing shader hook and cache key, requires one unique
floor insertion anchor and uses the already mapped normal. Its strength is exactly 0.20.
There are no new material objects, geometry, textures, uniforms, attributes or owned resources.
One extra sleeve color-program variant is expected; actual resource counts remain unmeasured.

Candidate material SHA256 is
`e024a03cbb46900c5403d4dea7cbda8f67cde4e48fe84aa40a18aa7abfe4c13e`;
helper SHA256 is `f4c4ccd7501391c9de4bddb9837a1a10070cec098d8dc6e9c264effc3deab7f7`.
The patch matches the previously reviewed 0.20 proposal exactly. Production typecheck/build
passes with 112 modules; the two-line inverse and published flower source hashes are exact.
This source is prepared for isolated publication after the retained flower comparison.
The sleeve itself has not been rendered or visually retained yet.

## Existing proof and its limits

The original focused check uses the actual pinned bark constructor, shared floor and helper,
installed Three r186 program expansion and preprocessing. It verifies normal/floor ordering,
unchanged material inputs, uniforms and vertex source, preserved hook receiver/key behavior,
unique insertion and an identical no-hemisphere result. It did not compile/link on a GPU or
render a scene. Transporting that existing proof adds no new cases or full-world rebuild. The complete
[portable package](evidence/README.md) is preserved intact; one adaptation reproduced the
original receipt exactly. Its resolver was compared byte for byte with the two integrated
production files. Import candidateSource from evidence/source.mjs, or run the existing
focused checker with `node docs/reviews/lantern-sleeve-angular-response/evidence/check.mjs`.

Historical Astra-context calculations bound the floor multiplier to 0.88783–1.11217. Their
median proxies were A 0.9832 and B 0.9493: the B floor was about 5.1% darker. These are not
current displayed-pixel predictions; they omit real shadows, specular, AO, fog and post.
The change is not brightness-neutral. Fable's top-band brightness measurement is from another
composition and is not a target for this material.

## Actual decision remains pending

Compare original A/B pairs against the immediately preceding source. Require useful fissure
and curved-surface response without an unacceptable darker underside. Houses, recesses, trunks,
foliage, signposts and pods are controls. Check exact geometry/depth, actor state and resource
counts, allowing only a source-supported shader program change. Record unexpected differences
before attributing a cause. Reject an imperceptible or worse result; do not compensate with
greater strength or global fill. This supplemental trial changes no rubric or phase-exit gate.
