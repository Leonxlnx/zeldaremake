# Proposed path-mask trim for joint fill

**Pinned proposal evidence; applied in Astra’s environment integration.** No GPU appearance
verdict is implied. The adjacent evidence retains the status of its original verification
snapshot. Current adoption and actual-render review are tracked in `.agents/astra-environment.md`. This patch removes the six pale
triangular turf teeth identified by CPU rays through the actual `141082b` F capture. It changes
only `src/world/hardscape/joints.ts`; no terrain, slab, stair, vegetation, material, camera,
scoring, or locked gauntlet definitions are changed.

The existing fill admits a whole 20 cm quad when any corner passes the paving callback.
At the sloping F verge, that extends the pale fill from one paved corner over three unpaved
corners. The proposed builder retains that original admission, then clips each of its original
triangles against `surfaceMask.path >= 0.38`. Crossings are shared across adjacent faces; position,
colour, UV and soil weight are interpolated on the original triangle edges. Terrain parity,
8 mm surface lift, and the original stair/structure/isolated-disc exclusions remain in place.
There is no recursive refinement and no runtime refinement exception.

## Reproduce

From the repository root after installing its normal dependencies:

```sh
node docs/proposals/astra-joint-boundary/check.mjs
```

The check loads committed source `141082bae8a2b0064ec826e3908aececdc5b9e44`, reconstructs the
candidate from the patch **in memory**, verifies the exact hashes, builds the actual CPU meshes
with null texture loaders, and writes `gauntlet/tmp/joint-boundary-mask-evidence.json`.
It does not modify production source, the index, or the committed evidence.

After the owning agent reviews the proposal, applicability can be checked without applying it:

```sh
git apply --check docs/proposals/astra-joint-boundary/mask-only-joints.patch
```

The baseline joint builder also matches Astra `a600f52` and Fable `bb11762`; those commits do not
change this file. Render the integrated patch from the same F camera before accepting appearance.

## Verified results

- All six recorded pixels change their closest hit from `flagstone-joints` to the terrain:
  `(929,527)`, `(963,535)`, `(1000,542)`, `(1036,550)`, `(1074,557)`, `(1113,580)`.
- Zero degenerate or downward triangles. Geometry changes from 20,826 to 21,556 triangles.
- Target-bank samples outside the full paving predicate decrease from 100 to 0. The largest
  measured deviation from terrain +8 mm there is 0.000000165 m.
- All 21,556 candidate faces map inside individual baseline faces within float32 precision;
  none increases its source face's projected area. Maximum plane/interpolation error is
  0.000001479 m. This is the exclusion non-expansion check, not just a comparison of sample counts.
- Position, colour, UV and soil-weight interpolation checks pass. The original 321 slabs remain
  unchanged. A semantic TypeScript check using an in-memory production-file override also passed.

## Deliberate limitations

This is a narrow overhang correction. The baseline's whole-cell approximation around stairs,
structures and isolated discs is retained as a subset; existing slivers in those exclusions
are not repaired here. A straight clipped chord also approximates the curved/discontinuous path
mask: 25 of 86,224 centroid/edge-midpoint samples outside the target bank still fail the path
threshold, down from 3,456 of 83,304 before. Some involve gaps inside an original triangle.
This is not an exact continuous-mask tessellation claim.

Raw exclusion sample counts cannot establish expansion because triangulation changes the sample
locations. The per-face containment/area checks establish that this patch does not expand the
baseline footprint, within float32 precision. Clipping and recomputed vertex normals still need
an actual rendering review. The earlier generic refinement candidate remains rejected and is
not part of this handoff.

## SHA-256

| Input | Digest |
| --- | --- |
| Baseline `joints.ts` | `1ceef0c1606547dde859d1cb85d436678eb4ce8d6240af25716a4541cde35df4` |
| Reconstructed candidate | `6cc3bac71e60a71086ca05c07e31848cf0e1b10deba32ce0acc46c24a9ea4beb` |
| Proposed patch | `05def77fce660236aeb47f93e44b4f1093b69cc35998f559f5448f049e4363c5` |

The adjacent `evidence.json` retains the six ray hits, counts, numerical checks, source commit,
mask limitations and exact hashes. It contains no screenshots or synthetic appearance evidence.
