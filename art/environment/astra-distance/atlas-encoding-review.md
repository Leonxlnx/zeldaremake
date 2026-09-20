# Authored atlas color encoding review

Pinned source: **64d5b7c9**, 2026-09-20. CPU-only diagnosis; no production source changes or GPU capture.

The four `Color`-to-CSS helpers write linear working-space components into CSS RGB, which is encoded sRGB. The textures are correctly marked `SRGBColorSpace`, so texture sampling decodes those already-linear values again. `ColorManagement` is enabled by default in the installed Three package, and world source contains no override. The installed `WebGLTextures.js:234` chooses `SRGB8_ALPHA8` for these unsigned-byte RGBA textures. This is consistent with the [Three Color documentation](https://threejs.org/docs/pages/Color.html): hexadecimal inputs become linear working-space values, and color getters can convert back to sRGB.

For a plain authored canopy color, `#5e764a` should be written as bytes `(94,118,74)`. The current helper writes `(29,46,17)`. Its sampled linear luminance is **0.02256 instead of 0.15831**, retaining only 14.25% of the intended signal. The sun color retains 35.96%. Real atlases have mixed brush colors, white highlights and alpha compositing, so the actual atlas loss differs from these simple swatches.

The diagnostic executes the actual pinned painters with `WORLD.seed`, the production RNG forks and palette. It changes only the four brush conversions **in memory**, using Three's installed `LinearToSRGB`, then decodes raster RGB bytes as the GPU does. It measures pixels above each material's actual alpha test, excluding the solid white corner patch. `@napi-rs/canvas` is the bundled CPU rasterizer; antialiasing can differ slightly from Chrome. These are texture measurements, not predicted final screenshot brightness.

| Painter / material | Covered mean linear luminance: current → corrected | Ratio |
| --- | --- | --- |
| `createLeafClusterTexture`, 512, alpha ≥ .42 | .06501 → .22877 | 3.52× |
| `createLeafClusterDetail`, 1024, alpha ≥ .42 | .06847 → .22778 | 3.33× |
| `createLeafClusterDetail`, 512 | .06740 → .22710 | 3.37× |
| `createFarCrownAtlas`, 1024, alpha ≥ .30 | .03862 → .20517 | 5.31× |
| `createRoofAtlas`, 1024, alpha ≥ .40 | .03244 → .16246 | 5.01× |
| `createRoofAtlas`, 512 | .03196 → .16132 | 5.05× |

Alpha bytes are identical in all six cases. Both near normal/thickness maps and both roof overlap/depth maps are byte-identical. Sizes, texture color-space labels, sampling and mipmap settings are unchanged. A separate isolation proves that encoding only the internal 128px tuft's RGB leaves the entire far atlas byte-identical: `destination-in` uses only that tuft's alpha. The nested painter does not multiply its color into the far atlas.

## Affected rendering paths and existing controls

- **All distant crown cards**, in both near and far LODs, use `createDistantCrownMaterial` and the far atlas (`distant.ts:334`, `index.ts:2515`). Their diffuse and sun-rim lighting scale with the atlas. Existing radial core darkness .6, underside darkening .72 × .38 within 36m (fading out at 48m), and underside vertex tint .42 remain intentional independent factors. The crown card vertex tints are linear `(.62,.66,.60)` / `(.90,.95,.72)`, not the dark palette-based wood color. There is no neutral shade floor in this crown material. The accepted warmth helper preserves linear luminance and cannot recover the missing signal.
- **Six overhead canopy-roof sector meshes** use `createRoofAtlas` (`canopy/index.ts:129`). Their .16 underside lift and .42 fringe transmission also multiply the textured albedo. They have no neutral shade floor. Their vertex tint separately includes the canopy palette, so even correctly encoded texture samples remain dark green after vertex multiplication. Correcting encoding does not remove the authored overlap, depth or silhouette.
- **Ordinary giant cluster cards** use the 512 cluster map (`materials.ts:1271`). Beyond 10m their floor is `6 × mix(.15, diffuseColor, .4)`, so its neutral component limits response to an albedo change. In the simplified floor-only case with the current canopy palette as vertex tint and achromatic light/filter, the measured correction increases that floor by about **11.4%**, not 3.52×. This is an explanatory calculation, not a frame prediction: real vertex tints, direct light, transmission, floor blend, fog and grade differ.
- **Giant cards inside 2.5–6m** blend to the near pair. Their `nearDetail = clamp(nearColor / .8, .45, 1.9)` is applied after the floor (`materials.ts:1322,1368`). At full near detail, its mean luminance factor changes only **.45407 → .46559 (+2.54%)**. All channels are lower-clamped for 96.44% of current pixels and still 87.78% after encoding correction. The fixed .8 divisor is not the measured mean of either map. This explains weak near-card response; changing that shader normalization would be a separate, visually significant proposal.
- **Flat giant cards** replace atlas RGB with .8 at distance, so only their near-detail factor responds. **Physical white-bark leaves, ordinary cupped near leaves and the new flat inner cupped backing** do not sample atlas RGB and are unaffected. Flat core lighting/floor fidelity is therefore preserved by this correction.
- The cluster texture is also bound to the distant wood material, but all vertices in that material group are remapped to the opaque white patch before the crown group is appended (`distant.ts:430,578,633,643`). Its bark and distant strips do not change. Giant depth/shadow material uses alpha only, which stays identical.

## Smallest compatible correction and visual risk

Encode only the four Color-derived CSS brush helpers (`leaf-cluster-texture.ts:34,141,413`, `canopy/atlas.ts:64`). Use `Color.getStyle(SRGBColorSpace)` for the opaque helper or `getRGB(scratchColor, SRGBColorSpace)` before the existing RGBA formatting; preserve alpha rounding. Keep literal CSS highlights, scalar normal/depth encoders, texture `SRGBColorSpace`, palette, current floors, geometry and RNG unchanged. Changing the texture tag to linear is inappropriate because literal CSS colors and canvas compositing are already sRGB.

There are no added draws, triangles, texture bytes, passes or per-frame operations. This is nevertheless a substantial visible change for roof and distant cards, whose actual pre-fog diffuse signal increases roughly fivefold. Current darkness may conceal card intersections, and the corrected crowns may lose too much of the accepted dark mass against the sky. Native review should cover C/F, sky-opening, w19-spine-u, the actual 119/121m tree pair and a 2.5–6m ordinary-card approach, with all current floors fixed. Fog and the physical leaf/bark paths are unchanged, so this cannot by itself explain or cure every grey surface in the owner's screenshot.

Runnable local diagnosis: `node gauntlet/tmp/atlas-color-encoding.mjs 64d5b7c9`.

Evidence in this worktree: `gauntlet/tmp/atlas-color-encoding/report.json` and `cpu-atlas-encoding.png`.
