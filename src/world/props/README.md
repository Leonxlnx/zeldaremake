# Village props integration

Owned leaf module: `src/world/props/**`. No shared layout, assembler, terrain, vegetation,
structures, assets or renderer changes. All meshes and pigments are original procedural work;
there are no downloaded, Nintendo or generated-image assets.

Fable should add `import * as props from './props';` in `src/world/index.ts` and register
`{ name: 'props', create: props.create }` in the existing `SYSTEMS` list.
The synchronous `create(ctx)` returns a standard `WorldSystem`; no animation update is required.
Its `dispose()` releases owned geometries/materials and detaches meshes.

`layout.ts` contains small authored domestic details, with a bounded 1.05 m placement search.
Footprint probes reject path, stair, structure and cliff masks, giant trunks, and close existing
prop origins. If no safe local position exists the prop is skipped, and reported as skipped.
Counts come from instantiated props, not requested definitions. Current terrain produces three
pots, one crate, two buckets, one raised platform, one ladder and three rope railing sections
in thirteen material batches, approximately 16k triangles. The Saria crate currently has no
safe local footprint and is skipped intentionally. Counts can change with terrain updates.

Pottery has lathed inner/outer walls and a closed floor, rolled lips and open loop handles.
Crates have separate planks, braces and nail heads. Buckets have hollow wedge staves, hoops,
floor and a rope handle. The platform has individual ground-sampled supports, planking,
cross bracing, five ladder rungs, sagging rail ropes and lashings.

For small props the root follows the terrain normal, with the underside additionally conformed
to the actual sampled heightfield (8 mm embed) to remove tangent-plane gaps on curved terrain.
Platform feet use individual ground heights. Platform yaw is currently zero, so those support
samples use authored X/Z offsets; rotate their sampling if changing its yaw in future.

Verification: `node src/world/props/geometry.test.mjs` under Node 24, then `npm run typecheck`
and `npm run build`. Tests exercise real terrain, all categories, forbidden masks, deterministic
geometry, finite vertices/normals, geometry budget, footprint support and disposal.

Visual limitations: no browser capture was available in this environment. This is not a
reference-match or visual-pass claim. Pigments are vertex colors, not fine wood-grain textures;
joinery and clay silhouettes carry the detail. Placement must be reviewed in integrated shots
B/D, especially vegetation overlap and platform visibility. No rubric items are claimed passed.
