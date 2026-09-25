# Lane 2's evidence, indexed

`README.md` in this directory is the mid-canopy PR's description, not a map. This is the map: 26
measurement directories and 11 tools, with the headline of each, so another lane can find a number
without opening all of them. Newest first within each group.

## Cost and budget

| where | the headline |
| --- | --- |
| `sweep/` | "Check everything" on head `e438c6e5`: all six fixed views inside W38 (A the binding one at **614 draws / 8.97 M**, 30 K of headroom), 11 walk routes with 0 stuck, 10 look spots unflagged, no page errors; play mode still **9.59 M at the flight's foot**. |
| `shadowcost/` | The sun's depth pass is **32 % of hero A's triangles** (174 draws / 2.91 M). `DEPTH-SPLIT.md`: of it, trees 19 %, vegetation 10 %, **the solid world 71 %** — and the grass barely casts (thinning it removes 1.46 M of colour and 0.30 M of depth). The giants' wood contributes **zero**. |
| `giantwood/` | The giants' mesh family draws **1.36 M at hero A, flat with distance** (72 draws). `BY-TREE.md`: it is **18 % wood / 53 % leaves / 29 % foldable far foliage**, and every giant's relief bole is 0. `CORRECTION.md` withdraws the trunk-arc proposal — `heroDistance` already gates it twice. |
| `lookbacks/` | The two views a climbing player gets are 25 % over the triangle ceiling: plateau look-back **745 draws / 11.15 M**, ledge look-back 673 / 11.23 M. Vegetation is 59 % of the overage, trees 8 %. |
| `playcost/` | Play mode at the main flight's foot is **611 draws / 9.60 M** (now 585 / 9.59 M), over the 9.0 M line; vegetation +1.0 M against hero A, trees −0.2 M. |
| `lodcheck/` | The LOD rungs' pop measured against `?treelod=10`; `TREE_LOD_NEAR_M` 32 m and `DISTANT_NEAR_M` 45 m are what the budget pays for. |
| `play/` | The pool's behaviour on the owner's walks (residency, prefetch). |

## Look

| where | the headline |
| --- | --- |
| `roofsky/` | Backlog item 4: the dark flat mass overhead in the open north was the **canopy roof's underside** (98.5 % of its pixels under level 30). `ROOF_SKY_THROUGH` lights it with the sky the layer transmits; the roof's own render goes 12.8 → 23.1 mean with local detail 2.90 → 4.66, and **all five distinct fixed frames are byte-identical**. |
| `uplooks/` | Looking up under the log arch, at the bridge mid-span and on the grove shelf: local detail 5.71–6.39, no bald patch — the overhead complaint narrows to the one view already fixed. |
| `bearings/` | The middle distance populates east, west and south too (band sd 15–23, no haze wash), so the north was not a special case. |
| `clearing/` | Backlog item 2: after the steps there is a signposted, lit trail to the grove hamlet; the ledge top is 84.6 % crown and trunk in its top band. |
| `crowntone/`, `softedge/`, `lookup/`, `treepop/`, `upring/`, `roofhole/`, `roofcover/`, `headcheck/`, `northgrove/` | The crown veil's rounds: the ray-climb gate, the floor-card fade, the roof's hero-top keep and the stand bands that closed the north, south and grove voids. |
| `fake/`, `brownwood/` | "The trees show the brown": tree wood is 2.2–2.4 % of the frame; the brown is the columns' boles and the giants' trunks (fable-4's attribution agrees). |
| `backlog3/`, `farhut/` | Backlog item 3 measured: the west house's wall 0.199 and the far hut's 0.075 against 0.502–0.537 on the reference huts — structures' near-field bounce, not trees. |
| `arrival/` | "Trees load in ASAP" on screen: **0.02 % of pixels** arrive late with the clock frozen, and the 10 % that moves with the clock running is the wind, not geometry. |

## Reviews

| where | the headline |
| --- | --- |
| `reviews/pr30-persistent-fold-audit.md` | PR #30's claim is right but the head already carries the fix (`b6452e22`); close rather than merge. Also flags my own superseded #36 and #41. |

## Tools (all take `<dist>` and write JSON beside their output)

| tool | what it answers |
| --- | --- |
| `playcost.mjs` | Who owns the triangles at a pose — `__ZR__.isolate` per top-level system, for broll poses or `{"viewpoint": "A_stairs"}`. |
| `treeaudit.mjs` | The trees system's own audit at a pose, including `submission.byFamily` and `giantWoodByTree`. |
| `isolateshots.mjs` | One saved frame per system, so a suspect region can be attributed by eye as well as by count. |
| `sixcheck.mjs` | What a change did to the fixed frames: pixels moved, mean, local detail, and SSIM against `reference/frames`. |
| `walkpop.mjs` | What arrives late on screen (renders at `dt = 0`, so the wind cannot be mistaken for geometry). |
| `band.mjs` | Is the middle distance trees or haze (band mean and across-column sd). |
| `diffmap.mjs` | What changed and where, between two frames. |
| `compare.mjs` | Labelled side-by-side sheets. |
| `cutout.mjs` (in `lookup/`) | Boundary hardness and lace density — flat cards versus foliage. |
| `skyline.mjs` | Skyline statistics (is the tree line uniform). |
| `barkshare.mjs` | The brown share of a band by hue/saturation/lightness rule. |
| `canopy-walk.mjs` | The canopy's read along a walk. |

## Standing method notes

* Compare only runs with the **same shots order**: pool residency carries over between poses inside one
  `broll` run (a fresh-run A against an A captured third showed a spurious 19.5 % of pixels moved).
* Render at `dt = 0` when the question is geometry: with the clock running, wind moves 10 % of a frame.
* `isolate()` bypasses the composer, so its frames carry no post pass — its numbers are the material's
  own output, not the finished image.
* `?shadow=0` prices the whole depth pass; `?veg=<lodScale>,<grassDensity>` prices the ground cover.
