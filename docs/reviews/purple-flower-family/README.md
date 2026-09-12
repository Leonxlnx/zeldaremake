# Coherent purple flowers across three detail levels

This isolated candidate replaces the two purple cluster variants' solid domed heads with
six cupped petals and a small recessed centre. High and Medium share their head contours;
Low retains the same seven actual stems and heads instead of rearranging them into five
different plants. The yellow flower builder and purple spike variants retain their geometry.
All 10,297 plant placement records, materials, wind and distance thresholds remain unchanged.

The integration baseline is `f56d0d22548a85ef776e9cc8c36644c3af8fb56f`. Its two affected
source files are identical to the published 9ef baseline used by the original source proof.
Only `src/world/vegetation/plantgeo.ts` and `plants.ts` change in production. The final hashes
are `c83af546fc05cd063871d171a233b07f67570e01c9d411a5ce78adf8700acc20` and
`203c90cdbd9723bbb51866d7a99fd14a958515c125c0e0436bddfd9104897ae0`, respectively.
The integrated files were checked byte for byte against the composed portable resolver;
production typecheck and build pass (111 modules). Actual image approval is still pending.

## Preserved evidence and composition

The entire [evidence package](evidence/README.md) is copied intact. Its parent files describe
the earlier High/Medium stage and its then-unchanged Low. The
[Low continuation](evidence/low-continuity/README.md) follows that stage and verifies every
parent-file hash before composing its four context edits. Both frozen stages are retained;
their intermediate forms were never published as production candidates.

The parent's first, rejected High-only experiment is also preserved: its 9 m head silhouette
agreement worsened. Sharing the petal family with Medium improved that source comparison.
The Low continuation then resolves the separate seven-to-five plant rearrangement at 16 m.
No evidence file is rewritten to make an earlier failure disappear.

To reconstruct the complete candidate in memory, import `candidateSource` from
`evidence/low-continuity/source.mjs`. The parent resolver alone returns only the earlier stage.
The existing focused receipt checker is:

```sh
node docs/reviews/purple-flower-family/evidence/low-continuity/check.mjs
```

It needs the pinned Git objects and locked dependencies. It does not rewrite production or
frozen evidence. Packaging adaptations already reproduced the original receipts; integration
only compared the two resulting source files rather than repeating the full studies.

## Cost and limits

Six variant/LOD geometries change over the original source; the other 92 remain exact.
High and Medium keep 618 and 436 triangles per actual cluster variant. Each Low variant grows
from 165 to 182 triangles and 160 to 259 vertices. The existing four-variant Low pack gains
34 triangles and 198 vertices; spike instances also submit those slots before unused geometry
collapses. There are no new draw groups, materials, textures, uniforms or instance capacities.
Combined retained source-plus-packed buffers grow by 45,672 bytes, including 23,820 GPU bytes.
Camera-dependent submitted costs must be measured in the actual capture.

At the existing 9 m static probes, mean head silhouette IoU improves from 0.7764 to 0.8655.
At the two 16 m probes, it improves from 0.0494/0.0750 to 0.8204/0.8105. Low still covers
17–18% less projected head area than Medium. These source projections omit wind, scene
occlusion, antialiasing, material response and stem/leaf changes; they do not establish a
seamless switch, continuous playback, actual screenshot quality or FPS.

Judge the real A/D flower groups for distinct petals and centres without noisy starbursts,
holes, obvious floating heads or excessive loss of their flower-bed mass. Check the other
saved views and details for unintended effects. The existing automatic hedge sweep remains
a hedge regression capture; it is not evidence of the flower's 9 m or 16 m transition.
Retain or reject the appearance separately from source-test success. No gauntlet score or
exit criterion is changed by this supplemental study.
