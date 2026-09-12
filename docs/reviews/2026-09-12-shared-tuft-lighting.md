# Correct the dark back faces of joint tufts

Separate lighting change on debe21530c9085bf67ec2b25586a2d13ba61889b, after integrating
Fable's stable source-jitter streams and reverting the rejected broad canopy shade trial.
Fable released this exact shared-material scope in PR2 comment5647471072. Structures and
his new distant houses remain separate. Character work is paused for local Blender.

Actual9eb B/L02 shows a dense near-black jagged lawn despite ordinary olive blade albedo.
The vegetation grass correction does not reach these hardscape sprouts. Their buildTuft
normals strongly favor up, but Three's double-sided face flip also turns that up component
down on back faces. This changes both hemisphere and direct-light response.

Packed TUFT_A/B/C vertices now carry a normalized Uint8 semantic mask. The material transports
their authored instance-up axis into view space. Immediately after the standard face flip,
it reflects only a negative up component and updates nonPerturbedNormal before roughness
and lighting. The horizontal face direction remains intact. It adds no light, shadow factor,
emissive floor or exposure term. Material roughness stays .85 and metalness0.

| Variant | Hardscape instances | Boulder instances | Corrected |
| --- | ---: | ---: | --- |
| Tuft A | 1445 | 10 | Yes |
| Tuft B | 483 | 10 | Yes |
| Tuft C | 1097 | 0 | Yes |
| Clover | 576 | 0 | No |
| Moss cushion | 446 | 0 | No |
| Fern | 0 | 10 | No |
| Grit | 1695 | 0 | No |

The semantic IDs are independent of pack slots. Every triangle has a constant mask, so
interpolation cannot leak the change into another variant. A focused regression checks the
actual hardscape/boulder packs and reordered packs that put grit or fern in slot0 and tufts
later. It passes this candidate and rejects both a missing mask and an incorrect slot mask.
Run `node src/world/materials/sprouts.test.mjs`; the environment CI includes this check.

## Independent implementation evidence

Frozen candidate SHA256:
`a7571d03aea7c4bb0e53cadb4aa0efd8d2a16dd76f922b982890864ac07e14f6`.
Baseline Fable sprouts.ts SHA256:
`6a9e028df67a6d80a74ecad7fad2f7a224c40a1dad575c8a7bab2e39916291da`.
Patch SHA256:
`62612b3681c9030667e08f0a9c844b857cee56ddd6574bd55c8a7f5eade204f8`.

Independent same-source CPU hardscape/rocks rebuild preserves every original packed position,
normal, color, UV, wind and variant attribute; all instance matrices/colors, bounds, indices,
counts, spots, audits, visibility and shadow flags remain exact. All3,179,761 draws across1211
observed streams and the root RNG tail match. The stream digest is
`ade62c2d8ab72eecb59ddb0d3186d8a9f4825b5fd3f40de9809518cea9115841`.
The full Fable jitter API/body stays exact apart from passing existing variant IDs to the
packer. No seed, source label, traversal, geometry, wind or placement change is introduced.

The installed Three186 WebGLProgram prefix/include/light expansion and active preprocessing
place the correction after face flip and before roughness/lighting. Removing the additive
mask/up transport and normal block recovers the entire original shader sources. Wind, variant
collapse, LOD and projection remain byte-exact; uniforms remain bound to live wind references.
This checks emitted shader code with a recording GL stub, not GPU compilation or execution.

CPU evaluation of actual instance transforms keeps20107 front normals exact and reflects20107
back normals;80884 unmasked face normals stay exact. Maximum horizontal-component error is
5.36e-16 and unit-length error3.34e-16 in double precision, not a GPU error bound. Both direct
diffuse and specular/IBL change, as can the normal-derived roughness term. This is not merely
ambient fill. Real shadowing, AO, albedo and postfx determine the final pixel response.

Cost is1218 static attribute bytes (714 hardscape,504 boulders), one attribute location and
one vec4 varying. No new uniforms, textures, materials, meshes, draws or triangles. The shader
cache key replaces the old program; a fresh load is expected to retain program count. Extra
transport applies to all shared packs, including unmasked/collapsed vertices. GPU timing is
unmeasured. Sprouts still receive shadows and do not cast them.

## Actual acceptance gate

Typecheck/build (110 modules), semantic-mask regression and exact source boundary pass.
Compare matching production images against debe, especially B/L02 lawn, joint tufts and
boulder plants. Require clearer blades with retained shape/shade, no uniformly overbright
green carpet or sparkle, and unchanged excluded-family behavior. Check actual geometry,
depth, deterministic audits, cameras, global lighting, resources and submitted budgets.
No actual appearance or moving-camera stability verdict is claimed before that capture.

Current tufts use positive scale and yaw, with no tangent/object normal map. Future normal
maps or differently oriented geometry require reconsidering the authored-up convention and
injection order. Existing world layouts and materials remain the basis of this correction.
