# Close moss gaps on the corrected bark mean

Baseline: `d9eee5d7` (same material as child `3df9ebc2`). This is a separate candidate after the accepted linear-mean correction;
it does not replay the held `5d9de615` moss change. Native visual acceptance is pending.

Owner sheet 05 shows warm fissured plates between moss cushions. The native mean correction
made those plates readable, but the lantern and north-west bases still carry broad smooth
green patches. This candidate changes only the near-base giant bark colour block:

- Open gaps within the existing authored mask using the already sampled moss field.
- Recover the existing bark map/material hue only in the newly exposed fraction. A bounded,
  monotonic normalization removes part of the stacked dark material value while preserving
  vertex grain/crevice ordering. Vertex values at or above one, including the already lifted
  stair-bank bark, receive no value gain. The separate vertex AO and normal relief remain.
- Use the existing `barkNearDetail` fade: full through 1.5 m, zero at 6 m. The new block is
  skipped at 6 m and beyond, and full-mask cushions retain their exact original coverage.

Distances are fragment-to-camera distances, as in the existing bark-detail shader; they are
not the near-bole pool's horizontal distance to the tree origin. This removes the new material
difference by 6 m without changing the existing geometry transition or its earlier issues.
Coarse moss wash and lichen formulas, all other materials, floors, light, texture assets,
geometry and deterministic streams stay unchanged. Colour, normal response and roughness
continue to use the same `barkMossCover`.

Actual generated near-base centroid estimates, weighted by projected area and excluding
3-D cushion meshes (not rasterized pixels):

| Surface patches with authored moss > 0.35 | Bark before | Bark after |
| --- | ---: | ---: |
| Lantern | 34.6% | 47.5% |
| North-west | 52.8% | 68.9% |
| Stair-bank | 63.6% | 75.0% |

`moss-mask-probe.mjs` and `moss-mask-summary.json` now describe this candidate; the held
candidate's earlier versions remain in Git at `5d9de615`. The probe does not account for
raster occlusion, wind, texture filtering, lighting or cushion collapse.

`moss-shader-check.mjs` runs real material hooks with texture factories stubbed. All 11 vertex
programs remain identical; resolving inactive NEAR_BASE_DETAIL blocks leaves the ten other
fragment programs identical. The near-base colour, normal and roughness retain one coverage
mask. The check executes the injected scalar coverage expressions in 660 cases, including
6/8/10/13.5 m and full-mask cushions, and checks monotonic vertex-value recovery over 401
samples. No new uniforms, texture samples or noise calls. It is not native GLSL compilation.

Typecheck/build pass (`index-CdKd5QDo.js`); CPU shader/coverage and actual geometry probes pass.
Geometry/draw/texture counts cannot increase from this shader-only change; extra arithmetic
applies only in close near-base gaps. There is no GPU timing claim. Parent must compare the
three near-bole views against its frozen mean-only capture and inspect the material boundary;
reject if exposed patches again become near-black, orange, or speckled instead of readable bark.
