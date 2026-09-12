# Keep grass lighting normals above the terrain

Independent candidate after roof source 5ea5b6d9be4c8c9e3e6f7ff7348f04961aac34ca.
PR2 comment 5647251867 announces this grass-only material scope; W15 is claimed. Fable retains
hardscape and active structures. His 6128726 lawn source is deliberately not included here.

## Problem and correction

The authored grass normal blends blade facing with terrain up at weight .55. Installed Three
r186 then flips the entire normal on back faces, including that upward bias. This is an
interaction with our authored normal, not a Three bug or a reason to change all DoubleSide
materials. It creates dark strokes even on otherwise light middle portions of blades.

The fragment shader receives the existing instance terrain-up direction in view space. After
Three's face flip, a negative component along this up direction is reflected to positive;
horizontal facing is preserved. nonPerturbedNormal is kept coherent. Grass alone gains a
terrain-up-v1 cache suffix. Front faces and single-sided shaders retain their former behavior.

Geometry, positions, density, RNG, palette, root gradients, wind, vertex deformation and shadow
coordinates are unchanged. Other vegetation families and their depth/distance programs, hedge
sky transmission and veins are exact. The ordinary canopy shadow map remains authoritative.
Grass receives shadows but does not cast them; blade self-shadow is not the diagnosed cause.

## Evidence and limits

Pinned actual F source ab7796ef928defa0e2beec5150ffcf0ba6de398c has repeated neighboring
CPU grass correspondences at pixels (1140,444) and (1206,510), RGB (20,22,0) / (32,28,0).
These are around 8.4 / 8.6 cm above terrain, UV height .44 / .43, albedo luminance .167 / .170,
normal Y -.916 / -.977. Thus they are plausible middle-blade examples, not simply dark roots.
CPU reconstruction uses actual source/camera/time/wind but does not include every world
occluder or GPU floating-point arithmetic. It supports the diagnosis, not exact full-world
first-surface attribution or a replacement for the actual image comparison.

The two sample hemisphere diffuse terms rise from .00644 / .00608 to .01786 / .01747. More
importantly, their sun dots become approximately .997, changing direct light substantially.
IBL and specular directions change too. This is not an indirect-only lift, and no world-light,
exposure, AO or colour adjustment is mixed into this experiment to compensate.

Primary background sources describe upward-oriented grass lighting as a practical vegetation
technique: [GPU Gems grass chapter](https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-7-rendering-countless-blades-waving-grass)
and [GPU Gems 2 virtual botany](https://developer.nvidia.com/gpugems/gpugems2/part-i-geometric-complexity/chapter-1-toward-photorealism-virtual-botany).
The concrete diagnosis and correction above come from installed source and our own evidence.

## Cost, validation and actual gate

Cost is one vec3 varying, one vertex matrix multiply, and fragment normalize/dot/conditional
reflection. No added geometry, attributes, uniforms, textures, materials, draws or triangles.
One colour program replaces the old grass program; fresh-load total should remain unchanged.
Actual GPU timing is unmeasured.

The frozen proposal follows real installed getParameters/cache and WebGLProgram include/prefix
expansion, then cpp preprocessing: all unrelated programs/keys/uniforms remain exact, 231
sampled fronts are exact and 277 backs reflect with horizontal error below 1e-15. This is a
CPU shader check, not GPU compilation. Existing material suite, typecheck/build and exact
source-boundary hash pass. Material SHA256:
7f11c56c2347bd2a247ebf48f72f14c199c615cd1fe5e73c663948c1c839d48b.

Actual six-camera historical comparison against 5ea is still required before retention.
Inspect isolated blades and whole lawns for reduced dark strokes, clear clump/ground
separation and retained canopy dapple/contact shade, without a pale or uniformly glowing
lawn. Exact geometry/depth/audits/resources/budgets are required. Same-source world pairs
still compare canopy gain 1 / 3; only matching historical variants isolate this normal change.
Static images cannot establish moving-camera stability.

## Actual 2c4a8c0 result — retained

All 12+4 contracts pass at 2c4a8c0cc9831568236afd2c7602ef8a4d6455b5. Root inspected A/B/F;
the capture reviewer all distinct worlds/details. Black middle-blade strokes visibly reduce,
with olive light-catching blades on the bank, retained dark bases/hedge shade and no obvious
pale lawn wash. Some blades remain bright and coarse in closeup. Keep this correction.

Every historical camera/control, geometry/depth, deterministic audit, material/texture inventory
and draw/triangle count matches 5ea. Programs/textures stay 74/70; zero retries/errors/warnings.
The two original F anchors change RGB (20,22,0)/(32,28,0) to (113,112,58)/(137,134,65). Fixed
lit-grass display Y is 81.19 to 87.27, under-hedge mixed shade 31.28 to 32.64; the near-stone
control is pixel-exact. These JPEG measurements do not isolate irradiance or prove material
attribution at every pixel. Direct sun/specular/IBL change together as expected.

Actual progress/2026-09-12_170146264-2c4a8c0 and details/2026-09-12_170431000-2c4a8c0
are pinned to archives 9fbd0227c03fccf00cff298c45756e2f56607273 /
369da7fce14ee30096e14964fa1c885d1298458b. All history/eight previews and ZIP CRC/bytes pass;
source ZIP has 369 exact tracked files. Static images do not establish motion stability or FPS.

Shared hardscape/boulder tuft materials are a separate system and remain unchanged here. Their
authored-up-normal interaction is under read-only investigation while Fable corrects shared RNG.
