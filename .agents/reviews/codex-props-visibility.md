# Props opaque geometry visibility review

Reviewed 2026-09-09 on iteration-two props with the integrated Fable terrain/structures source.
Run `node .agents/reviews/codex-props-visibility.mjs` from the repository root.

The small pot is partly occluded by actual house-root geometry in both hero views. This is a
deliberate dressing choice confirmed by Fable after reviewing the iteration-two captures. The crate's center
and upper sample are clear; the bucket's samples are clear in B, but it is outside D's frame.

| Prop | B center, normalized x/y | B rays at 30% / 50% / 70% height | D rays at 30% / 50% / 70% height |
| --- | --- | --- | --- |
| saria-small-pot | .560 / .556 | roots / roots / pot | roots / roots / pot |
| saria-crate | .588 / .543 | roots / crate / crate | roots / crate / crate |
| saria-water-bucket | .664 / .576 | bucket / bucket / bucket | bucket / bucket / bucket; outside frame |

The script invokes the unchanged terrain, hardscape, structures and props `create` functions at
quality high, builds their real triangle geometry, and uses Three.js Raycaster with original
material sidedness. It tests 153 opaque meshes and excludes eight alpha-tested or transparent
meshes, whose cards cannot be treated as fully opaque. Rays target three points along the center
of each prop's world bounding box; the first intersected mesh is reported. This is a sparse
occlusion probe, not a pixel visibility percentage.

Only texture loading and canvas rasterization are placeholders; geometry is not substituted.
No WebGL context or screenshots are involved. The script does not instantiate the trees, rocks,
vegetation, atmosphere or postprocessing systems. It cannot prove visibility through foliage,
shader displacement, wind, fog or light, nor assess material appearance. Ground samples reflect
construction order for the instantiated systems; the known terrain cache-order problem can
produce small differences from props-only tests or a complete renderer build.

Keep masks intact and preserve the authored positions. Fable confirmed partial root occlusion
fits the reference; the crate and second pot carry the cluster. The interrupted optional
placement-search code was removed without adopting a candidate.
Rerun when Fable's planned camera/layout and sampler changes land. No visual pass is claimed.
