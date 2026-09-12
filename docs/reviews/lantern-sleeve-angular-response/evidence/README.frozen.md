# Lantern sleeve angular response: frozen 901b adaptation, proposed only

This is the previously held **0.20** hemisphere-angle trial, adapted to the integrated
Fable material file. The earlier hold was an art-review decision, not a discovered bug.
Fable's top-band p50 comes from a different composition and is not a target for this material.
The purpose is one controlled actual-image experiment after the grass, huts and flowers
checkpoints, with no compensating light or color change.

The reproducible source baseline is published Fable
`901b65b9ec45a1355cf3169d245e93892d98b7da`. The checker reads its Git objects directly.
Astra's unpublished local integration `6a4338356e0650d57b9bf48d1d3bca2df5186cf6`
was the original preparation context; its material file was byte-identical, but that local
commit is not needed to reproduce this check. The original proposal was pinned to
`e6d6ac06dc8706b8b41f13b0518077f7d8c1d242`; the first later adaptation used
`eadb660cc6757863a4acb332d6d7c334fb76ad06`. Both prior helpers and this helper are
byte-identical. No production file was written by this preparation.

| Item | SHA256 |
| --- | --- |
| Baseline `materials.ts` | `a1ff83add8f3c3ef13a8fe1f9da7ce432b23ae6dbd69ffb7ac24473dcc2d7da1` |
| Candidate `materials.ts` | `e024a03cbb46900c5403d4dea7cbda8f67cde4e48fe84aa40a18aa7abfe4c13e` |
| Unchanged original helper `sleeveBark.ts` | `f4c4ccd7501391c9de4bddb9837a1a10070cec098d8dc6e9c264effc3deab7f7` |
| Apply this `sleeve-angular.patch` | `37a1076ff9427977ea5b1add329b1473199c809f79166c76743914fc335b7955` |

## Minimal scope and preserved inputs

The patch adds only one import and one call after
`applyShadeFloor(sleeveBark, LIMB_BARK_FLOOR, new Color(LIMB_BARK_TINT))`, plus the
original 34-line helper. Apply the patch, not the whole snapshot. Removing those two lines
reconstructs the exact current material bytes, preserving Fable's distant-lamp improvements
and generated-texture ownership. The shared shade floor is unchanged from the original
proposal, so its single insertion anchor remains valid.

The existing sleeve is still a clone of the bark material, using the same borrowed
`bark_brown_02` color, normal and roughness textures, normal scale `(1.5, 1.5)`, vertex colors,
material tint and independent limb floor. The helper chains the previous hook and cache key.
Its fragment expression follows mapped-normal evaluation and floor tint/desaturation and
precedes the floor accumulation. It uses only the already-present hemisphere direction,
sky/ground colors and mapped normal. Its strength is exactly `0.20`; the cache suffix remains
`|sleeve-hemi-angular-020-v1`. The `NUM_HEMI_LIGHTS` guard is retained.

No new material object, geometry, draw, texture, sampler, uniform, attribute, listener or
disposal responsibility is introduced. One additional sleeve color-program variant is
expected; this focused check confirms a separate cache key, not a fresh whole-scene program
inventory. Every other material/resource input remains exact by the two-line source inverse.
Shared `shadeFloor.ts` and `lanternBranch.ts` are byte-identical to the original proposal.
The published 901b config, lighting and structures index differ from the combined Astra
scene. The checker uses published 901b source objects; this does not adopt Fable's lighting
or reinterpret the historical Astra image/normal measurements. Both sets of hashes are
recorded separately in `pin.json`, with the unpublished integration marked as observation
only. The explicit sleeve floor and tint passed to the helper are identical in both sources.

## Focused proof

From the repository root:

```sh
node gauntlet/tmp/sleeve-angular-901b/check.mjs
```

The original run and the source-identity correction to published 901b both passed. It extracts the real pinned bark constructor without invoking the whole
material factory, loads the actual floor/helper chain, and compiles one ordinary primitive's
shader source through installed Three r186 `WebGLPrograms`/`WebGLProgram` and `cpp`.
It confirms unchanged material values and borrowed-map identities, unchanged uniforms and
vertex program, mapped-normal ordering, the exact 0.20 term, separated cache key, previous
hook receiver/renderer preservation, and missing/duplicate-anchor rejection. With no
hemisphere the preprocessed fragment is byte-identical to baseline. A single TypeScript
no-emit check with the two candidate files overlaid in memory passed. The reproducible
receipt is `evidence.json`.

There was no world/56-mesh/RNG rebuild, browser, GPU compile/link, render, new asset, or
production write. The program uses inert texture fixtures for source validation; it does
not claim new visual or current whole-scene draw-count evidence.

## Image gate and honest darkening risk

The technical diagnosis remains the original
`gauntlet/tmp/lantern-sleeve-surface-review/README.md`: when the existing floor is active,
only about 0.23% of pre-floor diffuse variation survives in its sampled regime. The angular
trial restores a small response to the existing normal map instead of increasing normal
strength or adding a new illumination term.

For the historical Astra hemisphere colors, unchanged at the local preparation checkpoint,
the multiplier's mathematical bounds remain
**0.88783–1.11217**. Historical mapped-normal CPU samples gave floor-multiplier medians
**A 0.9832, B 0.9493**. Thus the B floor proxy was roughly **5.1% darker**; this is not
brightness-neutral. These are Astra-context values, not a Fable 901b lighting target. Those medians have not
been recomputed for the latest scene and exclude
real shadows, specular/PMREM, AO, fog and post. They are not displayed-pixel predictions.

Root should judge actual paired A/B originals for useful fissure and curved-surface response,
checking the underside remains acceptable and houses, recesses, trunks, foliage and pods
remain stable controls. This cannot create knotted collars or a stronger bark silhouette.
Reject an imperceptible or worse result. Do not raise strength, add color fill, or retune
global light to compensate.
