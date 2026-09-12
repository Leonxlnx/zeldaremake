# Cooler upper air with coherent indirect light

The owner boards separate warm sunlight from cool, layered forest depth. Actual d755/d41 upper
A/F views still read largely olive-gray. This is a separate color study after the hedge-light
checkpoint `2e9c19f`: two scene-linear endpoints change, with their original luminance preserved.
PR2 comment 5646848710 records the scope; Fable's roof and hardscape work remain independent.

| Endpoint | Previous linear RGB | Candidate linear RGB |
| --- | --- | --- |
| Upper sky gap | .372, .368, .285 | .315, .3670755, .462 |
| Open upper-air haze | .32, .33, .29 | .29, .33185123, .36 |

The rounded constants preserve their respective linear luminances .3628578 and .324986 within
3×10⁻⁹. The sky becomes blue-gray, with a milder cool gray in the open-air haze. All extinction
density, distance/height ranges, lower/horizon/closed fog and mist colors remain exact. Direct
sun direction/color/intensity, warm shafts, hemisphere, environment intensity/tint, material
palettes, geometry, camera and time are unchanged. No global exposure or saturation adjustment.

## Why the sky and haze change together

Of 1,200 coarse depth probes in the upper 240 pixels, actual d755 A/F have only 1/6 pure sky
probes. Most of the apparent sky is fogged distant geometry. A dome-only tint would mainly
change indirect lighting while missing the broad gray upper layer. The source fog calculation
finds a hazeLit contribution above .10 at 276 A / 268 F probes, and above .25 at 213 / 255.
Some far open-air surfaces have contributions around .85; nearby and closed-direction surfaces
usually have zero. These sparse depth probes are not a full-resolution material mask.

The visible sky and lighting PMREM use the same createSkyDome source. A fresh page builds both
from this endpoint, retaining the existing .34 environment intensity and environment tint.
Changing only a live visible-dome uniform would leave stale indirect illumination and is not
the method used here. Shared horizontal/closed horizon endpoints remain unchanged, and the
upper interpolation is smooth. The open-air haze endpoint does not affect rays wholly below
the model's 8 m uniform canopy layer.

## Expected scope and limits

A 64×192 angular quadrature of the actual sky formula, including cirrus/halo and environment
tint, estimates upper PMREM-input luminance .341525 → .341046 (−.14%). It redistributes channels:
R −14.1%, G −.23%, B +55.7%. This intentional blue shift can change shaded material appearance
through indirect light even though their authored palettes and total input brightness stay
fixed. It is **not** a PMREM convolution, BRDF evaluation or predicted screenshot.

The first actual review must check cool depth separation without a cyan veil, clear warm sunlit
stone, plausible shaded paving/roof/skin, and no horizon seam or lifted foreground blacks.
If broad gray structure remains, do not automatically increase blue or exposure; much of it is
closed fog and distant geometry, with separate silhouette/shading causes.

## Comparison and validation

Build a fresh page for every captured source. The current within-source comparison still tests
local canopy gain 1 versus 3; it is not an old-sky versus new-sky toggle. Judge this color change
by comparing the same named **candidate** images from 2e9c19f and this later source, with matched
camera, geometry, time, light and gain settings. Preserve both immutable galleries and metadata.

Typecheck/build and a source-boundary check cover the two endpoint changes; no new renderer
resources, draw calls or texture assets are introduced. The CPU angular/depth analysis is
recorded in scratch `gauntlet/tmp/cool-upper-air-review/`. Actual CI appearance remains pending.
The locked footage rubric is unchanged; this is owner-board art direction, not a self-awarded
quality score or phase completion.


## Actual 84ec result — retained

Source 84ecde9, tree e74c8a872071ba25334026bfbbd841f9ff297cec, CI 34702832368 succeeded.
All 12 world and four detail captures pass with zero retries/errors/warnings. Root reviewed
A/B/F and L01; independent review covered every distinct world/detail view. The upper air is
cooler gray; shaded paving is less yellow; sunlit stone stays warm. No obvious cyan veil or
horizon seam. The roof remains yellow/smooth and broad distant gray layers remain unfinished.

Matching candidate A/F upper rectangles change mean RGB by (-2.37,+.08,+4.87) and
(-2.57,+.06,+5.55) on the 0–255 display scale, with mean luma about -.10/-.11. B shaded paving
blue/red rises .831 to .939; lit A paving .631 to .666. These are fixed JPEG regions containing
mixed surfaces, not irradiance or isolated PMREM measurements. Geometry/depth/cameras/gain,
resources/programs and budgets remain exact; only the two source-derived atmosphere audit
endpoints differ. B/E remains 8,714,720 triangles / 650 calls; maximum calls A659.

World gallery: `progress/2026-09-12_155249299-84ecde9`; details:
`details/2026-09-12_155535503-84ecde9`, both on `captures/astra-environment`. Archive bytes,
all eight latest previews, history and source/image ZIPs verified. Later post-light changes are
absent from these control images. This is a retained color improvement, not phase completion.
