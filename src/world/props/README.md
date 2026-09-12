# Village props integration

Owned leaf module: `src/world/props/**`. No shared layout, assembler, terrain, vegetation,
structures, assets or renderer changes. All meshes and pigments are original procedural work. Only the two crate wood batches borrow
the existing credited CC0 `weathered_planks/color.jpg`, unchanged; no new raster assets are added.

Fable should add `import * as props from './props';` in `src/world/index.ts` and register
`{ name: 'props', create: props.create }` in the existing `SYSTEMS` list.
The asynchronous `create(ctx)` awaits the cached wood map and returns a standard `WorldSystem`;
no animation update is required.
Its `dispose()` releases owned geometries/materials and detaches meshes. The borrowed texture
remains owned by the shared texture library and is never modified or disposed by props.

`layout.ts` contains small authored domestic details, with a bounded 1.05 m placement search.
Footprint probes reject path, stair, structure and cliff masks, giant trunks, and close existing
prop origins. If no safe local position exists the prop is skipped, and reported as skipped.
Counts come from instantiated props, not requested definitions. Current terrain produces three
pots, two crates, two buckets, one raised platform, one ladder and three rope railing sections
in fifteen material batches, 16,508 triangles on the current terrain. All eight definitions
are accepted. Counts can change with terrain updates.

Pottery has lathed inner/outer walls and a closed floor, rolled lips and open loop handles.
Crates have separate planks, braces and nail heads. Buckets have hollow wedge staves, hoops,
floor and a rope handle. The platform has individual ground-sampled supports, planking,
cross bracing, five ladder rungs, sagging rail ropes and lashings.

For small props the root follows the terrain normal, with the underside additionally conformed
to the actual sampled heightfield (8 mm embed) to remove tangent-plane gaps on curved terrain.
Platform feet use individual ground heights. Platform yaw is currently zero, so those support
samples use authored X/Z offsets; rotate their sampling if changing its yaw in future.

Verification: `node src/world/props/geometry.test.mjs` under Node 20+ (including Fable’s Node 22), then `npm run typecheck`
and `npm run build`. Tests exercise real terrain, all categories, forbidden masks, deterministic
geometry, finite vertices/normals, geometry budget, footprint support and disposal.

Visual verification: Fable captured the integrated first pass and confirmed contact and scale.
Iteration 2 addresses muted pigment and hero-view placement; its recapture is pending.
This is not a reference-match or visual-pass claim. Pigments are vertex colors, not fine wood-grain textures;
joinery and clay silhouettes carry the detail. Placement must be reviewed in integrated shots
B/D, especially vegetation overlap and platform visibility. No rubric items are claimed passed.

Iteration2 legal cluster: small pot(6.75,-11.6), crate(7.7,-11.7), bucket(7.6,-7.2).
Current B_house projected centers are approximately(.559,.551),(.589,.540),(.665,.570).
Projection tests do not establish occlusion or final visual quality. Recheck after Fable camera/terrain changes.
Clay uses dusty brown#8d6a55 with soil/moss at contact; wood darkens near ground.

Crate grain trial: each plank and diagonal brace uses lengthwise UVs into four board interiors
of the existing weathered wood color map. A bounded scalar modulation uses its linear luminance
to retain the existing vertex pigments, per-board values and darker end cuts. End cuts receive
no added pattern. Mipmap/derivative filtering fades unresolved detail; there is no procedural
cosine grain, extra normal/roughness map, lighting change, new geometry or additional draw call.
Actual B/D comparison is required before claiming useful visual improvement.
