# Close bark albedo trace — 2026-09-20

**Recommendation after native review: replace `NEAR_BASE_FLOOR.texture: 0.75 -> 0.65` as a
small corrective rollback.** Keep lift 2.5, canopy 0.18, albedo 0.08 and chroma 0.8. It restores
the original texture share while retaining the reduced green bounce. Overall native gain is
weak; this does not resolve the owner's green-tree complaint. No source change is included
here. Both moss/gap candidates remain held.

Accepted native baseline: `d9eee5d78056b4d56d698fa404b2dd2a318ce3c7`, frozen in
`E:/zeldaremake-astra-environment/art/environment/astra-quality/after-bark-linear/`.
Relevant geometry, profile, lighting and material source match local `3df9ebc2` exactly.
Held close-moss candidate: local `37b00d91`, parent `573ada5d`; 33-view native capture is
`E:/zeldaremake-astra-environment/art/environment/2026-09-20T15-42-53-778Z-daylight/`.
Its lantern ROI darkened 31.11 -> 27.49 / 255, NW 30.74 -> 29.59; stair-bank changed only
38.101 -> 38.074. All six extra near-base boundary PNGs were byte-identical to their baseline.

The reusable CPU check casts 117 rays against each actual generated near base from its native
`sn-bole-*` camera. It uses production terrain, root/lean/profile inputs, barycentric vertex
RGB/AO and actual 2K UV samples decoded to linear RGB before bilinear filtering. The table
selects non-cushion wood with a partial moss mask (0.35, 0.96), closer than 3 m. These are
surface/albedo measurements, not predicted screenshot pixels.

| Mean linear quantity | Lantern, 85 samples | NW, 35 samples |
| --- | ---: | ---: |
| Map luminance | 0.205905 | 0.268963 |
| Map × material tint | 0.047933 | 0.062570 |
| Map × material × vertex RGB | 0.014497 | 0.023986 |
| Bare wood with corrected fine/touch detail factors | 0.016000 | 0.026535 |
| Existing absolute moss albedo | 0.193923 | 0.175325 |
| Vertex AO multiplier | 0.705301 | 0.986057 |

The giant material's `0x9b7e62` is linear RGB `[0.327778, 0.208637, 0.122139]`, luminance
0.227721. Its comment explicitly calibrates dark sunlit rims / hazy bark at about 15 m;
`giantTreeNearBase` clones this same tint. Vertex RGB already contains a brown base, soil
stain, grain/crevice variation and moss tint. Together they retain only 7.0% / 8.9% of the
sampled map luminance. Moss and lichen enter later as absolute linear colours, bypassing those
multipliers. Opening moss therefore exposes much darker wood even after the accepted mean fix.

For example, lantern screen ray `(790, 420)` hits triangle vertices `[1812,1813,2013]`, with
barycentric weights `[0.107425,0.127066,0.765509]`. Interpolated vertex RGB is
`[0.308273,0.322573,0.186963]`; UV `[0.187624,0.827994]` samples map RGB
`[0.116739,0.114010,0.041954]`. Multiplying map, material and vertex yields warm but very dark
`[0.011796,0.007673,0.000958]` (luminance 0.008065), before lighting. AO is 0.797686.
The bare hue is already warm; another hue-recovery division does not address its low value.

The near floor uses `mix(0.08, diffuseAlbedo, texture)`. Our accepted `a3aec477` increased
texture 0.65 -> 0.75, which reduced the neutral contribution 0.028 -> 0.020. This amplifies
the pre-existing dark-wood / bright-moss mismatch. Restoring only 0.65 gives:

| Floor albedo before lighting | Current 0.75 | Proposed/original texture 0.65 | Change |
| --- | ---: | ---: | ---: |
| Lantern bare wood | 0.032000 | 0.038400 | +20.0% |
| NW bare wood | 0.039901 | 0.045248 | +13.4% |
| Lantern moss | 0.165442 | 0.154050 | -6.9% |
| NW moss | 0.151494 | 0.141961 | -6.3% |

The exact difference is `0.1 * (0.08 - diffuseAlbedo)`: darker-than-0.08 surfaces rise,
brighter surfaces lower, with 0.08 unchanged. This is a reversal of our extra contrast,
not a global exposure increase. Current canopy filtering is only
`[0.975243,1.018806,0.886612]`; it is not the main cause of the missing wood value.
Keep that reduced tint. The original pre-Astra preset also had canopy 1 and chroma 0.6;
those are **not** proposed for restoration.

Limits: this scalar restores some visibility but keeps less albedo contrast, so native grain
readability must be judged. It cannot fix the underlying compounded albedo or moss placement.
The stair-bank profile already multiplies vertex RGB by `[3.2,3.6,4.2]`; its two qualifying
rays have mean vertex luminance 1.462 and bare detailed luminance 0.171. Their floor albedo
would fall 0.14822 -> 0.13912 (-6.1%). A blind shared material-colour increase would overshoot
that tree and also change near-base foliage because the material serves both wood and leaves.
Further albedo authoring must handle those deliberate compensations explicitly.

AO remains independent and valuable: lantern samples range 0.510–1.267, NW 0.909–1.174.
The existing sub-2 m facing term can additionally scale indirect light by 0.672–1.12; neither
is a reason to erase the relief. The proposed floor scalar changes neither masks, normals,
AO, geometry, sampler count nor shader operations. Runtime cost is not measured here.

Run `node art/environment/astra-trees-quality/bark-albedo-trace.mjs`; recorded output is
`bark-albedo-trace.json`. The script writes nothing and validates the floor difference.
No wind deformation, other-object occlusion, normal-map lighting, mip/anisotropic filtering
or postfx are simulated. CPU procedural noise differs from the GPU float hash, so moss
end-member values are indicative; the texture/material/vertex attenuation is direct arithmetic.
Native review should compare the three close boles, A/F, w04, white-bark controls and the six
existing near-base boundary views before accepting any production change.

The parent subsequently completed the narrow native uniform study at
`E:/zeldaremake-astra-environment/art/environment/2026-09-20T16-13-23-884Z-daylight/`, source
`fedffe49aa9fb367a8c85c1cdc8b5c1bd4feac1c`: nine poses with both 0.75 and 0.65. The variant
sets both `uNearBaseFloorTexture` and `uNearBaseFloorNearTexture`; every pair has identical
camera, simulation time and render counts, with no capture errors and an empty source diff.

| Close native ROI, encoded luminance / 255 | 0.75 | 0.65 | RGB mean absolute difference |
| --- | ---: | ---: | ---: |
| Lantern | 31.108 | 30.188 | 1.025 |
| NW | 30.737 | 30.810 | 1.030 |
| Stair-bank | 38.101 | 37.636 | 0.504 |

Visual verdict: a modest reduction in contrast between the darkest bare wood and moss, with
no obvious new artifact. Lantern remains broadly green and its bare gaps remain dark. NW
wood separates a little better; its ROI pixels below 20 fall 16.31% -> 10.43%. Stair-bank
retains its warm fissures and looks essentially unchanged. Fixed baseline brown RGB buckets
rise only 0.70 / 0.92 encoded levels at lantern/NW, while green buckets fall 1.30 / 1.15.
These buckets are a sanity check, not semantic material masks; the mixed lantern ROI gets
darker because moss occupies most of it. ROI luminance deviation falls 12.29 -> 11.56 and
12.94 -> 11.98, the expected small loss of contrast.

The near-side lantern/NW boundary ROIs change by 0.507 / 0.495 RGB levels; their outward
0.75/0.65 PNG pairs are byte-identical. Stair-bank near-side MAD is 0.138, outward full-frame
MAD 0.00253. The large existing transition from dark detailed near roots to pale smooth far
roots remains plainly visible in both variants. This study offers no boundary fix claim.
These images did not include A/F, w04 or white-bark controls; those are left to parent’s
integrated verification rather than claiming them tested here.

Native statistics and their read-only reproduction script are `bark-floor065-native.json`
and `bark-floor065-native.mjs`. Run the latter with an optional capture-directory argument.
The evidence-only commit adds no source, maps, shader work or runtime cost.
