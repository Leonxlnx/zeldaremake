# Combined foreground and individual lantern leaves

The owner prioritizes environment detail while the character waits for a local Blender workflow.
This checkpoint deliberately merges Fable's foreground source `3dc217d1b687fe04c47a0c7055250f74bb536e54`
onto Astra's `d7552ee`, keeping our finer hedge geometry, and narrows the two post-lantern leaf wraps.
Fable retains the house roof/support and queued hardscape lawn-pocket work. PR2 comments
5646616508, 5646649074 and 5646701325 record the handoff and review.

## Fable foreground, retained exactly

The adopted files are `vegetation/field.ts`, `grass.ts`, `lodset.ts`, `plants.ts` and
`plants.test.mjs`; all five match Fable's commit byte for byte. The automatic merge inserted the
identical hedge PACKS entry at two table positions. After verifying that sole discrepancy,
Astra retained Fable's complete newer plants file, including his credited hedge entry. Our
`plantgeo.ts` SHA256 remains b577b39b6b8ecf4e7662cad4b6b27af7f24e89dcde7bb546e153432c50dc980a.

The pass adds foreground violets, ferns, broad leaves, clover and low lawn detail, while
rebalancing several LOD packs. Existing plant count rises from 9,779 to 10,297 roots. The combined
CPU plant submission model adds five calls in each named world view but removes 156,058–288,423
submitted triangles, including a sun pass before frustum culling. This excludes grass and is
not an actual renderer budget. The hedge savings were already in Astra's baseline and must not
be counted again.

The focused grass replay compares exact d755 dependencies with only the adopted field/grass
files changed. All **497,594 original blades outside the feathered lawn band** have byte-exact
16-float matrices and complete phase/stiffness/tint/type attributes. All original roots,
terrain contacts and accepted order remain intact. Exactly 640 additional blades occur inside
the feathered band; the total becomes 499,880, still 120 tiles. An interior 2.16 m² sample rises
from 131 to 199 blades/m² while its median height falls from 19.0 to 14.0 cm. Unit geometry and
world RNG continuation are unchanged. This addresses the callback refactor risk directly.

All five existing vegetation suites passed in the combined scratch stage. Actual world
captures are the remaining acceptance step for placement, silhouette, ground readability and
full renderer budget. In particular, B's broad green coverage and C's near planting need review;
source metrics do not replace that judgment.

## Six distinct post-lantern sepals

The old actual L01/L02 wraps read as a smooth hood. The owner boards show individual pointed
leaves around an amber seed. Only the existing sepal surface changes: its mid-blade angular
width drops from 79.8 to 50.0 degrees against 60-degree spacing, and the last 38% curls an extra
6 mm upward and 6/4 mm outward for the outer/inner whorls. The existing veins follow the curve.

Body, calyx, neck, cord, bindings, tie, shell ribs, colors, UVs, indices, lights, swing, RNG and
all non-pod post geometry remain exact. The two pods retain 10,546 and 10,418 triangles: zero
added vertices, triangles, draws, maps or materials. The source patch SHA256 is
`ead6f019892d2f314441d397b9ccaa6b5192b337fcc81e3cf10bd5724235878a`.

A 1,560-ray attachment check keeps every root embedded at least 0.320 mm; 48,918 interpolated
triangle probes retain at least 7.803/8.762 mm clearance from the body envelope. Existing collapsed
calyx-pole faces are unchanged. An isolated CPU projection at the real L01/L02 cameras opens
15/12-pixel and 10-pixel amber gaps respectively, with 24.8%/16.6% more exposed amber area.
These projections omit world occlusion and shading and are **not screenshots or visual approval**.

The separate bright-edge diagnosis found no broad cap-emission fault: non-body UVs sample the
black emissive-map region. The existing unshadowed internal point lamp and dielectric specular
can illuminate thin bindings/edges strongly. Shape is the only change in this trial; actual
L01/L02 will determine whether further material/light work is warranted.

## Visible archive and verification

The screenshot archive's root and details indexes now show four latest actual images each,
labelled with source and capture time. Historical folders, JPEG bytes and capture metadata stay
immutable. Existing publication/history/idempotence checks pass; a separate check using actual
561/640 metadata confirms all eight preview targets exist and selects the newest checkpoint.

The same gain 1-versus-3 controls continue for this combined source; historical same-variant
comparisons identify geometry/material changes. This checkpoint also corrects the independently
identified tree fragment-instancing defect documented in the column review. Actual CI images,
source hashes and renderer audit will be reviewed before claiming visible improvement.
