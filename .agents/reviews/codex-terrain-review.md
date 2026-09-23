# Codex terrain foundation review

Source snapshot: `deb5272` foundation. Fable's active terrain pass may supersede these findings; rerun before changing anything. This is a CPU geometry review, not a visual verdict or gauntlet score. No world files were changed.

Run from repository root after `npm ci`:

```sh
node .agents/reviews/codex-terrain-review.mjs
```

1. **Height cache depends on query order.** `heightfield.ts` rounds coordinates to a 5 cm cache cell but computes `rawHeight` at the original coordinates. The first caller determines all later heights within the cell. Sampling `(16.04, -8.35)` before `(16.055, -8.335)` changes the latter result by approximately 6.6 cm compared with a fresh terrain instance. Changes to another system's sampling order can therefore move grounded assets. Use exact coordinate keys, or compute fixed lattice samples and interpolate them consistently.

2. **Adjacent terrain LOD chunks have open seams.** `terrain/index.ts` changes spacing from 0.5 to 1.25 m without stitching boundaries. A vertical ray at `(60, 9)` intersects chunk `6-5` at y=5.139274 and neighboring chunk `7-5` at y=5.013531: a 12.57 cm boundary gap. Match edge subdivisions/heights or implement transition geometry; independently computed normals also need consistent boundary handling.

3. **Ground sampling does not match the rendered triangles.** At `(14.82, -3.88)`, `terrain.height` returns 5.229585 but a raycast against the actual terrain returns 5.044937, a difference of 18.46 cm. Even assets following the mandatory sampler can float. Use the same triangulated interpolation for contact queries as the mesh (ideally a shared grid specification), or refine geometry until measured contact error meets the required tolerance. Fixing cache order alone does not fix this mismatch.

These are implementation defects with numeric reproduction, not requests to replace the terrain art direction or ownership.
