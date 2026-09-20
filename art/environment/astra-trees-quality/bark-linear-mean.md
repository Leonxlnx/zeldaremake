# Bark-map linear mean correction

Accepted material baseline: `a9eccd15`. The separate moss candidate `5d9de615` was held after
native dark-bark regressions and is absent from this candidate. One production scalar changes:
`BARK_DETAIL_MEAN`, from encoded `133.29 / 255` to linear `0.2554942`.

The texture library loads `tree_bark_03/2k/color.jpg` for high/ultra and its 1K version for
low/medium. Both use `SRGBColorSpace`; the installed Three WebGL renderer selects
`SRGB8_ALPHA8`, so texture samples are linear. The former signalstats mean was encoded.

The CPU check reads every native texel with Sharp, decodes each channel with Three's sRGB
conversion, then applies the shader's Rec.709 luminance weights. It does not resize encoded
pixels first. Run `node art/environment/astra-trees-quality/bark-linear-mean-check.mjs`.

| Map | Measured linear mean | Difference from shared constant |
| --- | ---: | ---: |
| 1K | 0.2537939831 | -0.665% |
| 2K | 0.2554942058 | <0.00001% |

On 2K base texels, the fully applied fine-detail multiplier averages 0.7205 -> 1.0141 and
the touch multiplier 0.8168 -> 1.0081. Clamp bounds account for the small difference from 1.
This restores average albedo while retaining the existing map's variation, geometry, grain,
vertex AO, crevice shade, moss masks, palette, normals and shade floors.

All callers retain the same shared mean. Near-base and near-canopy bark use it in fine/touch
divisors, fading out at 6 m and 2 m respectively. Distant bark embeds `0.2555` as its contrast
centre, luminance divisor and hue scale; its existing bark blend is full inside 22 m and gone
at 38 m. Its 3-to-2 contrast gain blends over the actual `DISTANT_NEAR_BAND_M = [14, 26]`.
The old centre clipped all RGB channels to zero on 37.87% of 2K texels at gain 2, and 68.90%
at the live near gain of 3; corrected shares are 8.68% and 15.42%. These are texture statistics,
not pixels. Adjacent historical shader comments still describe an older gain/range; the check
reads the live gain constant.

Typecheck/build pass (`index-dknfQgYP.js`) and the CPU texture check passes both resolutions.
No geometry, draw calls, shader texture samples, uniforms or shader operations are added.
GPU timing and native image acceptance remain pending with parent. Compare the three
`sn-bole-*` views, `sn-lantern-limb`, w04, near distant-tree stem controls, A/F and white-bark
controls. The mean correction alone does not resolve every source of dark bark or green moss.
