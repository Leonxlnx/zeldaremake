# Shrub crown placement review

Reviewed `34250d2` on `agent/codex-vegetation`, using the actual plant builder, placement field, high-detail geometry and stored instance transforms. The current builder contains 134 bushes: 113 original placements followed by 21 new ledge/house clusters. This is a CPU geometry review, not a rendered visibility or gauntlet verdict. No source files changed.

## Findings

Most new clusters are within at least one hero camera's projected bounds. Their crown vertices also leave substantial horizontal space around the authored approach paths and stairs. This does not justify moving or removing the clusters before seeing the integrated capture.

| Camera | New clusters with projected bounds intersecting viewport | Of 21 |
| --- | ---: | ---: |
| A stairs | 12 | 57% |
| B house | 14 | 67% |
| D log | 9 | 43% |
| Any A/B/D | 18 | 86% |

Counts require both a frustum/world-box intersection and an intersection between the viewport and the projected bounds of the actual high-detail vertices. The latter rejects two false positives from the looser world-axis-aligned box in B. Bounds intersection is still a conservative test; an opaque house, tree or hill may hide the shrub entirely.

The three clusters outside all three projected viewports are bush IDs 114, 119 and 122 (one-based IDs in the full bush set): roots approximately `(-8.66,2.46,-10.45)`, `(-8.94,2.49,-5.14)` and `(-7.36,1.20,-7.36)`. They remain useful during exploration. They are a small minority, so there is no evidence that the whole added pass misses the saved cameras.

## Approach clearances

After transforming every vertex of each new high-detail shrub, the smallest horizontal vertex-to-landmark distances were:

| Authored landmark | Minimum distance | Closest bush |
| --- | ---: | ---: |
| Any path edge | 2.163 m | 120 |
| Any stair footprint | 2.530 m | 116 |
| Any house trunk footprint | 1.099 m | 133 |

These are vertex distances, not a continuous triangle collision solver, and exclude wind. They are comfortably larger than the default shrub wind envelope. No crown-vertex overhang into the authored path/stair/house footprints was found. This is stronger than checking only root positions, but does not measure visual crowding, the future character's navigation collision volume, or exact structure meshes.

Useful capture landmarks: bush 116 at `(17.15,4.86,-6.73)` projects to A x=0.663–0.726, y=0.330–0.426 and sits closest to a stair footprint. Bush 118 at `(4.61,1.25,-20.90)` appears in all three projected bounds and gives a central-distance comparison: A x=0.188–0.243/y=0.549–0.614, B x=0.395–0.445/y=0.489–0.553, D x=0.508–0.573/y=0.490–0.574. Coordinates are normalized, origin top left. Verify these against Fable's next actual capture, especially whether intervening houses or terrain hide the intended added density.

## Reproduction and limits

Run `node .agents/reviews/codex-shrub-placement-review.mjs` from the repository root. It builds only the real non-grass plants plus the placement field, then prints per-cluster bounds, clearances and camera projections. It checks the reviewed 134-instance count before interpreting the 113/21 split; regenerate the comparison after future placement changes. It completed in about 1.5 seconds here. No full-world build, browser, shader evaluation, opaque occlusion test, postprocessing, screenshot or frame-time measurement was used.
