# Existing crate wood: physical grain from the cached CC0 map

Trial on660dcac756f9095fa6b3b9c08ccd646d2bf5f499, separate from distant-house geometry and
its pending finish. Root revisited owner board06. The baseline crate uses plain vertex
pigments; separate boards/braces/nails already provide the actual geometry.

The two crate wood batches share one owned material clone. Its color-only sampler borrows
unchanged credited `public/textures/weathered_planks/color.jpg`. Four photographed interiors
avoid nail rows and board seams. UVs follow the real long axis before each board/brace's
existing rotation, at isotropic density capped400texels/m. Deterministic board ordinals
choose crops without touching RNG. End cuts keep their old pigment, with zero grain mask.

Map luminance is normalized by each interior's measured linear mean and bounded before a
.8 blend, limiting the total albedo factor to.64–1.52. This preserves existing RGB ratios;
it does not copy photographed lighting/color wholesale onto the model. Unresolved grain
fades between6–12source texels/pixel. No normal, roughness, emissive, light or postfx change.
The material keeps.map null so automatic opaque shadow depth/distance programs stay exact.
The TextureLibrary caches the existing map and retains ownership; props await its standard
promise. The world assembler already awaits either synchronous or asynchronous factories.

## Source checks and measured limits

Frozen proposal patch SHA256:
`2d2680cb9b2dba41da29fb23c78f8b611914cedcaff1a02fceebec1d814a9a16`.
It was independently checked on711; props source is unchanged through660. All38 original
attribute buffers, indices, normals, pigments, contacts, transforms and shadow flags match;
2116 traced construction RNG calls remain exact. Geometry stays16508triangles,2952 sampled
contacts,15batches and eight accepted definitions. Existing240 degenerate faces are unchanged.

Added data:2592 crate vertices ×(UVvec2+mean/maskfloat)=31104bytes.1728long-face vertices are
tagged;864end-face vertices remain neutral, with homogeneous masks per triangle. Cost is
one owned material/color program, no extra textures, draws or triangles. Thirteen non-crate
color programs and thirty depth/distance programs match in installed Three186 source-prefix
preprocessing; that is not GPU compile/appearance evidence.

The existing props geometry contract is adapted to await create and supply the map stub.
It checks actual terrain support, deterministic geometry, UV/tag scope, single shared crate
material and borrowed-map ownership. It runs in environment CI as well as local validation.

CPU sampling of the real JPEG with aligned box mips suggests a modest D benefit, weaker B:
remaining root-unoccluded samples have mean scalar1.014/std.079 in D,1.004/std.033 in B.
This covers only props/house-root occlusion, not the complete scene. It omits hardware
anisotropy8, actual illumination/fog/postfx and JPEG response. It cannot establish an image
improvement, temporal stability or a frame-time result. All source pixels/assets stay exact.

## Actual decision pending

Capture unchanged production B/D and verify all other views/controls. Retain only natural
longitudinal grain without photographed seams/nail ghosts, conspicuous four-board repetition
or noise. B should stay calm; old shadows/pigments/occlusion must remain consistent. No new
close camera or crate/root relocation is needed to manufacture a payoff. Reject a weak result
instead of boosting its light. The actual source archive and verdict follow publication.

Applied four props files match the frozen proposal bytes exactly. Existing geometry test,
typecheck/build112 and diff whitespace checks pass on the actual working source.

## Actual718 result — rejected and reverted

Source71843a28538f00bdbbd0005a65a1b588315753b5. Root personally compared originalD before/after
andB, and the independent reviewer inspected the unchanged production views. B's improvement
is effectively imperceptible; D has at most faint added grain. S01/S02 show small grain variation
on a partly hidden crate without obvious seams/nail ghosts/noisy repetition, but this does not
supply a meaningful gameplay-view gain. The predeclared weak-result gate rejects this trial.
No light boost, new close camera or crate/root relocation is used to justify it.

All16source/byte/depth/control/audit/budget checks pass, with exactly+1material/program,
textures70unchanged and0extra draws/triangles. All16have0retries/errors/warnings. Full-image
B maxchannel difference6/MAE.00121, D10/.00743 in8bit values are measurements, not quality scores.
[12 original world images](https://github.com/Leonxlnx/zeldaremake/tree/60d2bd364862af8f909b89abb28badd8fd175ddd/progress/2026-09-12_183836071-71843a2)
and [four original details](https://github.com/Leonxlnx/zeldaremake/tree/60d2bd364862af8f909b89abb28badd8fd175ddd/details/2026-09-12_184047388-71843a2)
remain archived. The four props files return exactly to660, removing the extra owned material/
program and31104static attribute bytes. The existing general geometry/contact test stays inCI;
cap-bounds and near-stone trials remain independent. The frozen proposal remains reproducible
as source718 if a future real asset/camera requirement merits revisiting it.

## Actual e6 rollback continuity

The rollback source `e6d6ac06dc8706b8b41f13b0518077f7d8c1d242` completed run 34712642317.
All 16 source, original-byte, ZIP and archive-history checks pass. Depth hashes, actor state,
other audits and submitted budgets match e706 exactly. Scene materials fall by one, programs
76 → 75, textures remain 70. C/F/L01/L02 JPEGs are exact; the remaining small differences are
the removed faint crate grain, with no meaningful quality loss in independent B/D/sign review.
One E candidate used an unchanged-state blank-buffer retry; the other fifteen used zero.
Both reports have zero final errors and warnings. This source still contains the subsequently
rejected stone shoulders; ef2100e restores those separately.

[Rollback world originals](https://github.com/Leonxlnx/zeldaremake/tree/f76103bc5fafddc53a65ba6efff403114e8b7184/progress/2026-09-12_191607744-e6d6ac0)
and [details](https://github.com/Leonxlnx/zeldaremake/tree/c42a649aa77ae84b7c8031516b11411aef92ffb6/details/2026-09-12_191859142-e6d6ac0)
remain immutable. This verifies a rollback, not a new visual improvement.
