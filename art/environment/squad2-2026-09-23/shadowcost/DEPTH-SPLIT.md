# What is actually in the sun's depth pass: two thirds is the solid world, not the foliage

`README.md` in this directory priced the depth pass by difference (`?shadow=0`): **32 % of hero A's
triangles and 33 % of the plateau look-back's**. This splits that pass by what casts into it, which
decides whose lane can cut it. Head `ca75ccbf`, 960 × 540, `pose-counts.mjs --only NONE --settle 8`.

## The measurement matrix

| configuration | hero A | plateau look-back |
| --- | --- | --- |
| head, shadows on | 614 draws / 8.97 M | 745 / 11.15 M |
| head, `?shadow=0` | 440 / 6.06 M | 529 / 7.45 M |
| trees not casting (temporary `?nocast=trees`) | 587 / 8.41 M | 719 / 10.56 M |
| grass thinned `?veg=0.05,0`, shadows on | 518 / 7.21 M | 661 / 8.41 M |
| grass thinned, shadows off | 354 / 4.60 M | 458 / 5.31 M |

The depth pass is the first row minus the second. A family's share of it is the drop when that family
stops casting (trees), or the shrink of the whole depth delta when that family is thinned
(vegetation: 2.91 → 2.61 M at hero A, 3.70 → 3.10 M at the look-back).

## The split

| | hero A | plateau look-back |
| --- | --- | --- |
| **the whole depth pass** | **2.91 M** (174 draws) | **3.70 M** (216 draws) |
| trees | 0.56 M (19.1 %) | 0.59 M (16.0 %) |
| vegetation | 0.30 M (10.3 %) | 0.61 M (16.3 %) |
| **everything else** | **2.05 M (70.6 %)** | **2.51 M (67.7 %)** |

Two thirds of the sun's depth pass is the solid world — structures, terrain, rocks, hardscape — not
the trees and not the grass. The grass barely casts at all: thinning it to nothing removes 1.46 M from
the **colour** pass at hero A (6.06 → 4.60 M) and only 0.30 M from the depth pass.

## What that means per lane

* **Lane 2 (mine): nothing left to cut here.** The trees' 0.56 M is what remains *after* the two culls
  already in place — `cullShadowCasters` drops casters whose shadows cannot land in frame, and the
  giants' wood contributes exactly zero (`README.md`). What is left casts shadows a player sees, so
  trimming it would delete visible shadow, not waste.
* **For whoever owns structures / terrain / rocks:** ~2.05–2.51 M of triangles per frame go into the
  depth map from the solid world, about a quarter of the entire budget. The usual lever is a
  cast-only proxy (a coarse mesh that casts while the detailed one does not) or dropping small props
  and thin detail from the caster set; neither changes the colour pass at all.
* **Vegetation (lane 3):** its colour-pass line remains the biggest single cost (the 1.46 M that
  thinning removes at hero A, and the +1.29 M it gains at elevated views in `../lookbacks/`), but it
  is not a shadow problem.

## Method notes

* `?nocast=<family>` was a temporary probe in `trees/index.ts` (clears `castShadow` on the matched
  meshes at build); it is reverted and not proposed for merge. Its effect is visible in the counts:
  hero A 614 → 587 draws.
* `?veg=<lodScale>,<grassDensity>` is the shipped perf flag, so that row needs no patch.
* Every configuration was read twice with identical numbers, so the shares are not noise.
