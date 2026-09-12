# Sky light through the near hedge leaves

The actual d755 F image shows several broad right-bank leaves as almost-black silhouettes.
The owner's first environment board calls for green, translucent foliage with readable folds.
This follow-up preserves the plant shapes and real shadowing while adding the missing diffuse
sky response of thin leaf undersides. Coordination is recorded in PR2 comment 5646766590.
Fable retains house roof foliage, support geometry and hardscape lawn work.

## Diagnosis against actual source and images

Recorded camera/time rays identify hedge items 10 and 11, high-LOD variants 0 and 1, using the
existing refined hedgeLeaf surfaces. Their matrices, variants and instance colors remain exact
through Fable's 3dc foreground pass. In 43 selected leaf probes, 17 show the correctly flipped
underside of DoubleSide geometry: sampled actual median RGB (12,15,7), versus (31.5,34.5,18.5)
for selected upper faces. These are sparse diagnostic probes, not an image-wide segmentation.

All 846 high-LOD laminae / 10,152 triangles pass winding and degeneracy checks. The source
normal Y range is +0.438…+1.000; sampled normals agree with their actual triangles. There is no
extra dark underside texture, repeated color conversion or failed world-zone gate. The west
verge's fill zone correctly does not include these two right-bank hedge roots.

The current material transmits only directional sunlight. Thirty of the 43 sampled leaves have
geometric blockers in the same hedge at 0.022–0.985 m, below the far-canopy shadow leak threshold.
The view/sun forward-scattering term is zero in these samples. Meanwhile their downward-facing
normals mostly receive the darker ground hemisphere, with only 0.02 × albedo extra ambient.
This combines with the inherited dark bank tint to produce the nearly black leaf undersides.
CPU shadow rays do not reconstruct filtered PCSS, and the shading model omits IBL/AO/fog/post.

## Bounded candidate

Only the hedge material opts in, through `leafSkyTransmission: 0.65`. A normalized Uint8
`aLeafSurface` attribute marks exactly the existing emitted lamina vertices in all three LODs:
255 for leaves, 0 for solid stems/twigs. No UV/color heuristic is used. Original geometry, leaf
shape, normals, indices, plant placement, deterministic RNG and LOD packing are retained.

The shader evaluates existing hemisphere irradiance on both sides of the visible normal. It
adds 0.65 of the **positive opposite-minus-facing difference**, multiplied by the existing
leaf diffuse Lambert response. Thus wood is opaque; upper sky-facing leaves retain their
response; undersides receive some of the brighter sky-side illumination. Equal hemisphere
colors or disabled hemisphere light add nothing. Direct sun, its actual shadow visibility,
point lights, world exposure/fill and the existing ambient term are unchanged.

This is an artistic thin-leaf approximation using available light contrast, not a measured
physical transmittance. In the diagnostic underside samples, the explicitly modeled shaded
diffuse contribution rises about 1.80× (range 1.57–1.93×), toward the upper-face shade response.
That is a CPU bound, not a predicted screenshot brightness or a quality claim.

The new material path has a distinct cache suffix. Other families and disabled/non-finite
options keep the original generated programs; no new environment sample, texture, material or
draw is introduced. The one-byte vertex attribute and one scalar/varying are the added data.
Color, sun-shadow and point-shadow passes retain their shared original position/wind behavior.

## Verification and actual acceptance

Existing vegetation material tests now cover opt-in versus original cache keys, disabled-option
shader equivalence, unchanged projection and exact shadow programs/live wind references. The
supplemental capture workflow runs this suite before screenshots. Typecheck/build (107 modules) pass. Independent replay against d41 preserves every original
attribute/index byte and bounds of all 98 generated variant geometries, every placement/pack
and the exact 781,427-event RNG trace. Every leaf vertex is tagged and every tube vertex is zero
in all nine hedge variant/LOD geometries; every triangle has a homogeneous tag. Packed tags
preserve normalized Uint8 payloads. Six-camera CPU submissions are exact.

Cost is 14,256 source bytes plus 14,256 packed bytes (28,512 resident CPU attribute bytes);
14,256 packed bytes across all LODs are available for GPU upload. Zero new draws, triangles,
vertices, geometry objects, material objects or textures; one extra color program is expected.
The existing shadow hook copies the shared uniform dictionary, so it includes an unused scalar
metadata entry; its actual shader source and cache key are unchanged.

Installed Three r186 getParameters→WebGLProgram→cpp preprocessing verifies the new path with
one/two hemispheres and its exclusion with none. Expanded depth/distance sources and keys stay
exact. The 26 sampled sky-facing leaves and solid wood have zero added response; the 17 underside
samples have positive response; disabled hemisphere light adds zero. This is generated-source
and CPU algebra validation, not GPU compile/link or screenshot acceptance.

The actual d41 world images pass independent source/control/budget checks; root reviewed all
five distinct candidate views and both new pod details. Grain now activates, foreground paths
remain legible and individual sepals are visible. B/E renders 8,714,720 triangles / 650 calls,
with all views below 9M / 700. Fine pod veins and bright edge/tie highlights remain. Compare the next actual same-camera F/A hedge with d41, looking for readable
undersides without bright stems, flattened self-shadow or a pale glow. All other material,
geometry and renderer-budget controls must remain unchanged. No screenshot is recolored, and
no historical capture bytes or metadata are replaced.
