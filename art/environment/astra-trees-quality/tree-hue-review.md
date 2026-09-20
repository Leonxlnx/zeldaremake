# Native tree-hue review

This is CPU evidence preparation for `00c6bac3`, integrated by the parent in `6f850599`.
No source, GPU or image pixels are changed. Run from this checkout after the native
manifest is complete:

```powershell
node art/environment/astra-trees-quality/tree-hue-evaluate.mjs E:/zeldaremake-astra-environment/art/environment/2026-09-20T16-56-01-917Z-daylight
```

The evaluator reads the manifest's `variant.uniforms.uTreeLeafWarmth`, requiring explicit
0 / .35 / .65 overrides. The candidate's unoverridden default is .35, so it cannot be
silently treated as zero. It validates matching cameras, simulation/render counts and
lighting, and rejects incomplete/error captures. A/C/F are required; sky-opening is optional
and reported missing when absent. Every captured `distance-crown-Nm` pose is evaluated
independently; the native study includes119/121, the historical preflight118–122. Existing fixed boxes are
normalized bounds: A `[.91,.025,.985,.085]`, C `[.035,.13,.22,.215]`, F `[.62,.20,.82,.33]`.

Every candidate uses exactly the pixel indices selected from its own pose's zero image.
The broad canopy measure reproduces ANALYSIS_VIDEO2 section 7: Lanczos3 320x180,
top `floor(.35*180)=62` rows, HSL H55–170 degrees, S>.12, L.06–.85. Standard HSL is computed
from encoded screenshot RGB; L=(max+min)/2. The same native core boxes also report all
pixels because much of their dark crown mass falls below the saturation cutoff. HSV
saturation and decoded-screenshot Rec709 Y accompany HSL S/L. The latter Y is a
post-tone-map proxy, not direct proof that shader radiance is conserved.

Read the original zero/.35/.65 A/C/F PNGs alongside the statistics. Prefer the smallest
strength that makes the existing crowns less green without turning their lit leaves ochre,
flattening their dark interiors or changing the scene's neutral surfaces. The reference
top-band medians differ across views; 62–65 degrees is a starting direction, not a universal
pass threshold. A reference core is obscured by HUD. C/F reference dark interiors are
poorly represented by the green mask, so their raw box hues are not leaf targets. This
evaluator makes no automatic artistic accept/HOLD decision.

The sky control fixes blue pixels inside `[.58,0,.9,.32]`; inspect its RGB MAD and maximum
channel difference for unintended spill. Surrounding leaves in sky-opening should warm,
so the entire image is not expected to be identical. Distant controls use fixed foliage
pixels within `[.08,.25,.92,.85]`. Compare each pose only with its own zero image; these
elevated diagnostic views have no matched gameplay reference and include several trees/LODs.

Historical preflight, reproducible with `--baseline-only`, is saved in `tree-hue-baseline.json`.
It uses parent `after-round49` (`fedffe49`) before the warming helper existed; warmth is
therefore recorded as null, not inferred from an unspecified default. All baseline delta
statistics are zero. For the parent's follow-up pair use the same script with `--warmth=0,.5`.

| View | Reference top H / S / L | Current top H / S / L | Current core H / S / L, all pixels |
| --- | --- | --- | --- |
| A | 63.75 / .138 / .284 | 75.90 / .180 / .255 | 78.75 / .143 / .206 |
| C | 68.57 / .143 / .288 | 76.36 / .156 / .188 | 78.00 / .109 / .171 |
| F | 60.00 / .138 / .241 | 76.00 / .172 / .206 | 78.00 / .119 / .167 |

The older whole-frame saturation figure near .23 does not describe these crown interiors.
Hue-only correction does not resolve their lower lightness. Resampling also matters:
reference F's native top mask median is 63.33 rather than the 320px mask's 60.00 degrees.

The complete native `6f850599` study passes the matched camera, time, render-count and
lighting guards, with no capture errors. Actual output is `tree-hue-native.json`.

| Native region, fixed membership | H at0 | H at.35 | H at.65 | Decoded screenshot Y change at.65 |
| --- | ---: | ---: | ---: | ---: |
| A core, all pixels | 78.75 | 70.91 | 64.62 | -0.34% |
| C core, all pixels | 78.00 | 70.91 | 60.00 | -0.15% |
| F core, all pixels | 78.00 | 70.00 | 60.00 | -0.27% |
| A top band | 75.90 | 74.00 | 73.71 | -0.04% |
| C top band | 76.36 | 69.38 | 64.29 | -0.24% |
| F top band | 76.00 | 71.54 | 69.44 | -0.10% |
| Distant119, foliage mask | 77.14 | 72.00 | 67.06 | -1.37% |
| Distant121, foliage mask | 77.14 | 72.00 | 67.06 | -1.39% |

Independent original-pixel review of A/C/F, sky-opening and f4-crown-up supports .65 as
a subtle warming step without obvious oversaturation or lost leaf relief. .35 is weaker;
it leaves native cores near70–71 degrees. .65 takes C/F dark cores to60, below the provisional
62–65 range, but they do not look conspicuously ochre. These low-saturation dark pixels have
coarse 8-bit hue steps; the precise target was also derived from a different, broad colour
mask. Parent is checking .5 before a final default choice, which is reasonable; no unmeasured
intermediate value is accepted here. The near crowns remain too dark and their broad forms
remain schematic. The owner-level quality target is not met by this small colour change.

At.65, native all-pixel core HSL saturation increases only .0057/.0049/.0029 for A/C/F;
lightness falls .00392/.00196/.00196. The blue-sky control retains exact median H/S/L;
RGB MAD is .058 of255, with5.63% of its pixels changed and a28-level isolated channel
outlier, so it is not byte-identical. Original sky colour looks stable. Distant119's
original PNG pair shows slightly warmer crowns but persistent very dark undersides;
the two distance poses have separate masks and are not compared against one another.
Visible draws/triangles are unchanged within every evaluated pair; this CPU report does
not measure the added shader's runtime cost. Parent separately owns walk/black-patch review.

The strongest remaining verified tree-shape defect is the giant lower-bole/root reset.
Parent's original 16-13-23 native pair `bole-reset-lantern-ese-in-11p85m` versus
`bole-reset-lantern-ese-out-12p15m` changes a flared, fissured buttress mass to smooth
tubular roots over 0.3 m. The near form has a hard upper cut edge; the far form does not
continue its root silhouette. NW 9.85/10.15 m shows the same class. This conflicts directly
with owner concept05's continuous tapered trunk-to-root growth and concept07's integrated
organic trunks. Colour cannot correct it. The next bounded geometry investigation should
match a cheap far lower-bole/root profile to the existing near kit while keeping thresholds
and budget fixed before considering any radius increase. Parent assigned that diagnosis
to the distance agent. Long smooth giant boughs remain a secondary issue, not part of this
hue study or a reason to replace the owner's Verdant white-bark trees.
