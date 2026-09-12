# Purple flower family: portable Low continuation

This directory adds the reviewed Low stage to the frozen High/Medium family in its parent
directory. Together they form the next proposed isolated flower candidate. The parent's files
remain byte-identical; its README and receipts continue to describe the earlier stage, including
its then-unchanged Low. This child supplies the subsequent correction. Neither stage is a LIVE
edit or a visual release approval.

## Exact composition

1. Parent `../source.mjs` reconstructs its frozen High/Medium candidate from published source
   `9ef903c58c3ee70eccaf919d565a1eb19cd1bef1` and its own context edits.
2. This directory's `source.mjs` uses the parent's `candidateSource` as its baseline, then applies
   four unique-context edits from `edits.json` to `src/world/vegetation/plantgeo.ts` only.
3. It verifies both source hashes. `plants.ts` remains the exact parent candidate; every other
   file is inherited through the parent resolver. No full source snapshots are packaged.

| `plantgeo.ts` identity | SHA-256 |
| --- | --- |
| Frozen parent High/Medium baseline | `8446563ea0521492a2c89fd99d0209edf51158af60ad383929393f7b4afb3cc8` |
| Composed High/Medium/Low candidate | `c83af546fc05cd063871d171a233b07f67570e01c9d411a5ce78adf8700acc20` |

The unchanged parent `plants.ts` hash is
`203c90cdbd9723bbb51866d7a99fd14a958515c125c0e0436bddfd9104897ae0`.
`provenance.json` pins all 11 existing parent files, the context edits and the original Low
receipts. The three receipt files are copied byte for byte. The required checker adaptation
reproduced the original geometry/inventory and projection receipts exactly, without writing
source or replacing evidence. `typecheck.json` preserves the previous successful pinned-source
`noEmit` result; no new typecheck suite or render was run for this packaging step.

## What Low changes

One real purple-plant definition supplies roots, stem polylines, actual leaf descriptors,
head attachments/axes/radii and named head RNGs. Low retains the same seven stems and heads
as the two actual High/Medium variants, replacing the previous five unrelated stems. It omits
leaf and rosette surfaces as before. Its stem samples at t=0, 1/3, 1 retain the original first
tangent and grounded head heights. Six open petals retain their true roots, shoulders and tips;
the same small Medium centre remains. No dome or substitute coverage shell is added.

Only the two purple cluster Low geometries change relative to the parent. All 96 other
variant/LOD geometries—including every frozen High/Medium attribute and index buffer—remain
byte-identical. All 10,297 placement records, packs, thresholds, materials, wind settings, yellow
flowers and spikes remain exact. Low uses the existing seven meaningful `head-i` names and real
plant descriptors; there are no dummy draws or effects on another RNG stream.

## Cost and remaining difference

These deltas are for the Low stage **over the frozen parent**:

| Scope | Frozen parent | Composed candidate | Delta |
| --- | ---: | ---: | ---: |
| Each actual cluster Low: triangles | 165 | 182 | **+17** |
| Each actual cluster Low: vertices | 160 | 259 | **+99** |
| Existing four-variant Low pack: triangles | 834 | 868 | +34 |
| Existing four-variant Low pack: vertices | 1,056 | 1,254 | +198 |

The vertex increase is 61.9% per cluster Low and 18.75% in the existing Low pack; the triangle
increase alone understates it. Low adds 8,916 source-buffer bytes and 9,708 packed/GPU-buffer
bytes, or 18,624 retained source-plus-pack bytes. High/Medium remain 618/436 triangles per
actual variant. Adding the parent's separately recorded costs gives 23,820 packed/GPU-buffer
bytes and 45,672 retained source-plus-pack bytes for the composed proposal over published 9ef.
Index element types, draw layout and instance capacities remain unchanged.

The Low pack also carries spike variants; all Low instances submit its extra 34 triangles and
198 vertices before unused slots collapse. Static D distance classification gives 68 Low
instances: +2,312 pack triangles/+13,464 pack vertices, including +561 selected-cluster
triangles. M11 gives +2,516/+14,652 and +629 respectively. These are existing inventory counts
before frustum culling, not measured GPU work, visibility or FPS.

At the same two existing 16 m source probes, head-union IoU improves from 0.0494/0.0750 to
0.8204/0.8105. Symmetric difference falls from 133.00/127.48 to 13.97/14.33 px². The proposed
Low heads **still occupy 17–18% less projected area than Medium**. Upper stem interpolation,
petal outlines and normals also simplify. The switch is not proven invisible.

## Proof boundary and use

The evidence composes two bounded source comparisons: the parent's published-9ef-to-High/Medium
check, followed by the Low check against that exact family. High/Medium byte identity preserves
the parent's source results; this packaging adds no new measurement. Static head projections
exclude wind, stem/leaf projection, scene occlusion, antialiasing, material response and continuous
motion. They establish neither the actual gameplay appearance of the combined candidate nor its
GPU performance, and do not validate an arbitrary later LIVE integration.

Move the **whole parent package including this child** intact. From the repository root with
its locked dependencies and pinned Git objects available, the existing focused check is:

```sh
node <parent-package>/low-continuity/check.mjs
```

For the composed in-memory source, import this child's `candidateSource` from `source.mjs`.
Importing the parent resolver alone returns only the earlier High/Medium stage. The resolver
checks unique contexts and expected hashes before returning the composed text. Root owns all
LIVE changes and the later actual capture; publishing the intermediate stage is unnecessary.
