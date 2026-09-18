# survey-2 — player-height walk audit of take-0115 (75911f9 / world tree 2e00415)

Before = survey-1 frames of take-0113 (`/tmp/survey1/frames/`). After = the same 181 unique poses
(survey-1's manifest lists 183 rows; `sn-house-door` and `sn-house-trunk` are duplicated) re-rendered
from a detached worktree at 75911f9 with
`broll.mjs --size 1280x720 --fps 12 --test --settle 12`. Rendered manifest: `/tmp/survey2/manifest.json`
(source poses: `/tmp/survey1/manifest.json`). After frames: `/tmp/survey2/frames/<name>.png`.

## A. Survey-1 defects — before/after verdicts (36)

FIXED 6 · IMPROVED 16 · UNCHANGED 13 · WORSE 1

| # | survey-1 defect | pose | verdict | why |
|---|---|---|---|---|
| 01 | giant-bole-orange-smooth | w17-spine-r | FIXED | NE giant is now dark fissured bark with a bark root skirt |
| 02 | giant-bole-camo-moss-holes | w07-spine-l | UNCHANGED | same flat camo decal at 4 m; both black notches still at the skirt foot |
| 03 | giant-bole-touch-distance-blur | sn-bole-lantern-tree | WORSE | bark still a blurred green smear at 0.5 m, and a hard-edged flat octagonal moss disc now cuts across the frame |
| 04 | column-trees-grey-cylinders | w19-spine-r | IMPROVED (marginal) | slight base taper + grass tufts hide the seam; still a smooth untextured grey cone |
| 05 | column-trees-under-arch | sn-arch-outside | UNCHANGED | identical pale smooth cylinders in haze under the arch |
| 06 | logarch-jagged-end | w19-spine-r | IMPROVED | grain streaks and tone variation on the end; sawtooth silhouette remains |
| 07 | logarch-underside-wet-clay | sn-arch-inside | IMPROVED | wet-clay smear replaced by deep plate relief; now near-black with specular flecks (Astra) |
| 08 | logarch-clay-plank-16m | w18-spine-f | UNCHANGED | belly still a smooth clay plank at 16 m; faint grain, hanging moss threads added |
| 09 | north-plain-bare-ground | w21-spine-f | IMPROVED | grass, herbs and litter out to ~10 m; flat pale ground beyond |
| 10 | forest-floor-bare-under-whitebarks | w18-spine-r | IMPROVED | more herb cover mid-ground; floor right under the whitebarks still bare olive |
| 11 | lantern-limb-smooth-2m | w04-spine-f | UNCHANGED | identical faint stucco striations, no longitudinal bark |
| 12 | giant-limbs-pale-tubes | w00-spine-f | UNCHANGED | pale smooth tubes in haze at 14 m (bark banding only shows from directly below, w07-u) |
| 13 | root-arc-floating-earth-face | w09-spine-r | UNCHANGED | smooth dark tube with the shadow gap to the face still present |
| 14 | giant-root-lime-tube | w18-spine-r | FIXED | lime tube replaced by a bark-textured root with moss caps |
| 15 | bigleaf-cards-at-lens | w27-plateau-r | FIXED | no cards at the lens at this pose |
| 16 | bigleaf-cards-over-boulder | sn-boulder-terrace | IMPROVED | leaves now veined and curled; still large flat cards |
| 17 | hollow-dirt-tiles | w13-spine-d | FIXED | full flagstone paving with soil joints to the far end |
| 18 | arch-gravel-seam | w20-spine-d | IMPROVED | seam follows slab outlines with a pebble; still a hard step, gravel still a flat plane |
| 19 | fence-post-black-smooth | sn-fence-post | FIXED | brown wood, chamfered cap, grain |
| 20 | fence-post-plateau | w28-plateau-f | IMPROVED | brown wood with faint grain; rails still flat planks |
| 21 | blue-flower-blob | sn-signpost | IMPROVED | violet, thinner, individual heads; still identical spheres |
| 22 | purple-flower-blob | w30-house-l | IMPROVED (marginal) | hue shift, slightly looser; still a clump of identical spheres with no petals |
| 23 | earth-face-smooth-clay | w08-spine-r | IMPROVED | faint ledge/root-ridge relief and a damp foot; still a soft clay wall at 8 m |
| 24 | nearcanopy-flat-card | w02-spine-r | UNCHANGED | one huge flat single-tone dark-green lobe |
| 25 | hero-boulder-shards-rope-through | sn-boulder-stairfoot | IMPROVED | rope no longer passes through the boulder; shard skirt still angular low-poly |
| 26 | threshold-slab-confetti | w31-house-d | IMPROVED | slab now mottled stone with a rounded edge; fewer but still flat moss dabs |
| 27 | distant-trees-cardboard | w26-stairs-f | UNCHANGED | same flat pale silhouettes; disc-crown tree still present |
| 28 | moss-cushion-spheres | sn-boulder-stairfoot | IMPROVED (marginal) | speckled tint; still smooth sphere clusters |
| 29 | arch-pod-at-head-height | w21-spine-l | UNCHANGED | east peg pod still at head height beside the spine (camera no longer inside it) |
| 30 | distant-hut-black-from-below | w13-spine-u | IMPROVED | plank soffit, straps and a lit pod visible; bowl underside still a smooth dark dome |
| 31 | whitebark-base-no-flare | sn-whitebark-base | UNCHANGED | identical painted birch tiling, no flare, ~1 m vertical repeat |
| 32 | boulder-polkadot-lichen | sn-boulder-shotd | UNCHANGED | same slate seams and black hole on top |
| 33 | column-crown-cutouts | w19-spine-u | UNCHANGED | identical flat spiky cutouts in haze |
| 34 | astra-far-pod-bloom-orbs | w11-spine-f | UNCHANGED | four shapeless bloom orbs at 30 m, 4–5× pod size |
| 35 | astra-overbright-hollow-floor | w17-spine-l | IMPROVED | no longer blown out; darker olive with more tufts |
| 36 | stair-block-black-side | w29-house-d | FIXED | black side face now lit stone with moss; thin dark contact sliver remains |

Pairs: `/opt/cursor/artifacts/survey2-check-<nn>-<slug>.jpg` (36 files, 600×300, before left / after right).

## B. Fresh inspection of the 181 after-frames — 39 world defects + 3 lighting (Astra)

Ranked by severity × frequency (frequency = number of after-frames where the defect is legible).
Crops: `/opt/cursor/artifacts/survey2-<nn>-<slug>.jpg` (300×300, label = frame @left,top).

| # | defect | frame (crop) | world position | system | sev | freq | score | fix |
|---|---|---|---|---|---|---|---|---|
| 01 | column trees = smooth grey/dark truncated cones, hard base seam | w20-spine-r | hollow/north columns e.g. (8.8, 0, −26.9), (−3.5, 0, −24.7); arch columns; fence column (18, 6, −7) | trees/column | 3 | 18 | 54 | bark albedo + normal on the column mesh, base flare with litter ring, darker shade side; banded bark tint at 20 m+ instead of flat grey |
| 02 | giant bole camo moss decal, zero relief at 4 m, black notches at the skirt | w07-spine-l | NW-near giant (−6, 0, −12.8); lantern-tree (−11.5, 2.6, −7.2) sleeve; w29-house-l boles | trees/giant | 3 | 10 | 30 | detail bark shell (fissure normal + AO) within 12 m; fix inverted/missing rootkit faces that read as black notches |
| 03 | new buttress flare = faceted low-poly green cone, hard straight base on the lawn | w09-spine-l | NW-near giant (−6, 0, −12.8) skirt; lantern-tree buttress | trees/giant (rootkit/buttress) | 3 | 9 | 27 | subdivide + smooth normals, fillet into the ground with a root/litter ring, bark-moss shell instead of flat moss tint |
| 04 | lantern limb = stucco-noise pale tube, no longitudinal bark | w04-spine-l | lantern limb (−11.5→0, 5–6 m up, z −7…3) | structures/lanternBranch | 3 | 7 | 21 | longitudinal bark relief + top-side moss cushion + hanging moss |
| 05 | flower clumps = clusters of identical spheres, no petals | w30-house-l | signpost bank (4…7, 3, −8…−10); plaza west; mound; house lawn | vegetation (flowers) | 2 | 10 | 20 | petal cards instead of spheres, stems, fewer heads per clump, hue jitter |
| 06 | hollow floor / north plain = flat pale-olive plane with sparse tufts and floating litter sprites | w19-spine-l | hollow floor (−12…−2, 0…2, −20…−45); north plain (−5…15, 4, −50…−60) | vegetation (ground cover) + terrain material | 2 | 9 | 18 | dense short grass/moss carpet + litter + low undulation to 25 m; dirt/moss albedo mask |
| 07 | near-canopy lobes = single-tone flat dark-green discs | w22-stairs-r | canopy over plaza/stair (3…12, 6…12, −5…12) | trees (nearCanopy/canopy) | 2 | 9 | 18 | split each lobe into layered leaf clusters with translucency and twigs |
| 08 | root arcs = smooth brown/dark tubes with painted grain, floating gap | w26-stairs-l | upper house (13.5, 5.4, −17.5) roots; house-lawn face (3…9, 1…4, −10…−16); cliff arcs | structures/house (roots) + trees/giant (rootkit) | 2 | 9 | 18 | bark-textured tapering roots seated on the heightfield; close the floating gap |
| 09 | giant limbs overhead = smooth pale tubes / straight hard-edged planks | w27-plateau-r | plaza limbs 10–14 m up; plateau limb over (15…20, 10, −12) | trees/giant (limbs) | 2 | 9 | 18 | bark banding + normal, taper and curvature, moss on the top face |
| 10 | distant trees = flat pale cardboard silhouettes, disc-crown tree | w25-stairs-f | ring beyond the plateau fences (z < −25, x > 15) | trees/distant | 2 | 8 | 16 | crossed two-plane cards with soft alpha crowns and hazed taper; remove the disc-crown tree |
| 11 | stair-bank / east giant boles still smooth orange at 8–15 m | w27-plateau-r | stair-bank giant (10.6, 0, 9.15); east giant | trees/giant | 2 | 5 | 10 | apply the NE-giant fissured-bark treatment (survey-1 #1 fix) to these boles |
| 12 | arch lip / ends = triangular sawtooth silhouette | w20-spine-r | log arch (−6…24, 4…13, −60…−47) | structures/logArch | 2 | 5 | 10 | torn bark plates and fibrous ends instead of the triangular cut |
| 13 | flat 8-gon moss disc intersecting the bole at touch distance | sn-bole-stair-bank | stair-bank giant at 1.5 m; lantern-tree; NW-near base | trees/giant (moss caps) | 3 | 3 | 9 | cull moss-cap cards within 2 m or give them a fuzzy alpha edge + lumpy silhouette |
| 14 | arch belly = smooth clay plank at 10–20 m | w18-spine-f | log arch belly | structures/logArch | 2 | 4 | 8 | bark-plate relief + normal at mid range, not just at 1 m |
| 15 | house-west flight = stacked slab boxes with black voids behind the risers | w29-house-d | house-west flight (6…9, 0.5…2.5, −6…−9) | hardscape | 2 | 4 | 8 | fill behind the risers, sink slabs into the bank, vary tread outlines |
| 16 | house interior = black fill + untextured primitive props on a flat floor plane | sn-house-door | Saria's house (9, 2.4, −10) | structures/house (interior) | 2 | 4 | 8 | textured floor/walls + wood props; lift the black (Phase-2 candidate but visible from the threshold) |
| 17 | stair-foot boulder = flat pale face + angular low-poly shard fringe | sn-boulder-stairfoot | (9.1, 0.2, 2.5) | rocks | 2 | 4 | 8 | round the shard fringe, sink half into the grass, triplanar the pale face |
| 18 | moss cushions = smooth sphere clusters | w29-house-r | house mound (7…10, 1…3, −8…−12); stair-foot lawn | vegetation (moss cushions) | 2 | 4 | 8 | irregular fuzzy cushions with alpha fringe |
| 19 | boulder black holes / slate seams | sn-boulder-terrace | terrace boulder (−15, 2.6, −20); shot-D boulder (−2.6, 0, −9.6) | rocks | 2 | 3 | 6 | close cavities (inverted faces), triplanar lower face, irregular lichen mask |
| 20 | column crowns = flat spiky cutouts from below | w19-spine-u | columns north of the arch | trees/column | 2 | 3 | 6 | leaf-card crowns with depth and translucency |
| 21 | bush = smooth stucco dome blob | w22-stairs-r | stair-foot lawn bush (12, 0.3, 4); plateau fence bush (~15, 6, −10) | vegetation (bush) | 2 | 2 | 4 | leaf-cluster shell with silhouette breakup |
| 22 | bright vertical seam lines down the hazed NW giant | w17-spine-l | (−13, 1.9, −33) | trees/giant | 2 | 2 | 4 | check UV seam / cord geometry; blend the strips |
| 23 | flagstone pad = raised island with a hard contoured edge over the gravel | w21-spine-d | path north end (2, 3.6, −46) | hardscape | 2 | 2 | 4 | feather the pad edge with pebbles/dirt; drop the pad to grade |
| 24 | arch vines = evenly beaded straight strings | w20-spine-r | arch vines (0…20, 4…9, −58…−48) | structures/logArch (vines) | 1 | 4 | 4 | varied leaf cards on a curved stem |
| 25 | bank boulders = smooth dark domes at 8–15 m | w13-spine-l | hollow west bank (−10…−6, 0.5, −25…−35); hero boulder at 8 m | rocks | 1 | 3 | 3 | faceted mid-LOD with normal map and lichen mask |
| 26 | mound crown bald smooth green | w00-spine-l | mound (−3…3, 0, −6…−9) | vegetation | 1 | 3 | 3 | extend the grass/moss carpet over the crown |
| 27 | rope-fence posts = thin red sticks | w01-spine-l | rope fence west of the plaza (−5…−2, 0.3, 5…12) | structures/fences | 1 | 3 | 3 | thicker split-log posts with bark and a sagging rope |
| 28 | stair treads repeat the same stain each step | w23-stairs-f | stairway (10…12, 1…5, 0…−12) | hardscape (stairs) | 1 | 3 | 3 | per-step UV offset/rotation + wear mask |
| 29 | big-leaf / vine cards at the lens | w30-house-d | house lawn; arch exit | vegetation | 1 | 3 | 3 | camera-distance fade within 0.6 m |
| 30 | house-lawn earth face still soft clay | w08-spine-r | (3…9, 1…4, −10…−16) | terrain (cliff material) | 1 | 3 | 3 | embedded stones + grass overhang on top of the new strata |
| 31 | whitebark = painted tiling, no flare, 1 m repeat | sn-whitebark-base | (−7.4, 1.1, 12.9) | trees/whiteBark | 2 | 1 | 2 | base flare + bark normal, break the vertical tile |
| 32 | crate = smooth flat planks | w28-plateau-d | plateau props (18.5, 5.4, −10) | props | 2 | 1 | 2 | wood grain albedo/normal + edge wear |
| 33 | plateau canopy from below = hard paper-cutout lobes | w27-plateau-u | plateau oak canopy (16…20, 9…12, −14…−8) | trees (bigleaf/plateau canopy) | 2 | 1 | 2 | soft alpha edge + translucency, second leaf layer |
| 34 | plaza joint pebbles = smooth olive ellipsoids | w05-spine-d | plaza joints (0, 0, −2…1) | hardscape/rocks (pebbles) | 1 | 2 | 2 | facet/roughness variation + lichen speckle |
| 35 | threshold slab flat moss dabs (texture landed) | sn-signpost | Saria's threshold (8.5…9.5, 2.4, −8…−9) | structures/house (doorway) | 1 | 2 | 2 | real moss tufts instead of flat dabs |
| 36 | north-rise flagstones = extruded biscuits | w16-spine-d | north rise (3, 3.5, −34) | hardscape | 1 | 1 | 1 | sink into joint dirt, vary edge wear, add pebbles/lichen |
| 37 | fern frond pierces the pot | w26-stairs-d | plateau pot (17, 5.4, −12) | props + vegetation | 1 | 1 | 1 | prop exclusion mask for the fern scatter |
| 38 | lantern-post rope rings = smooth pale toroids | w23-stairs-r | stair lantern post (12.5, 1, 2) | structures (lantern post) | 1 | 1 | 1 | rope texture + twist |
| 39 | house burl = painted swirl on a smooth bulge | w24-stairs-l | Saria's house burl (7, 4, −10) | structures/house | 1 | 1 | 1 | displace the burl with the bark normal |

Lighting (Astra), reported separately — crops `/opt/cursor/artifacts/survey2-astra-<n>-<slug>.jpg`:

| # | defect | frame | sev | freq | fix |
|---|---|---|---|---|---|
| A1 | far pods = shapeless bloom orbs 4–5× pod size at 30 m | w11-spine-f | 2 | 8 | clamp bloom threshold/radius for distant emissives |
| A2 | crushed-black shade (trunk at 1 m, arch underside, interior) | w31-house-r | 1 | 4 | lift the ambient/GI floor; no pure-black regions at 1 m |
| A3 | flat saturated pod glow at 2–4 m | w23-stairs-r | 1 | 2 | emissive gradient / inner shell |

### Per-system counts (39 world items)

| system | items | of which sev 3 |
|---|---|---|
| trees (giant 6, column 2, canopy/nearCanopy/bigleaf 2, distant 1, whiteBark 1) | 12 | 4 (#01 #02 #03 #13) |
| structures (logArch 3, house 4, lanternBranch 1, fences 1, lantern post 1) | 10 | 1 (#04) |
| vegetation | 6 | 0 |
| hardscape (incl. plaza pebbles) | 5 | 0 |
| rocks | 3 | 0 |
| props | 2 | 0 |
| terrain | 1 | 0 |
| lighting (Astra, separate) | 3 | 0 |

### 5 best frames (after)

`w04-spine-r` (hero: house, stair, lantern posts, flagstones), `w03-spine-r` (stair + house from the path), `w23-stairs-f` (worn treads, dark risers), `w31-house-u` (house bark + pods at 1 m), `w09-spine-d` (plaza flagstones). Runners-up: `w17-spine-r` (fixed NE giant bark), `w22-stairs-d`, `w28-plateau-f`, `w15-spine-r`. Sheet: `/opt/cursor/artifacts/survey2-best-frames.jpg`.

### Paths

- Before/after pairs: `/opt/cursor/artifacts/survey2-check-01…36-<slug>.jpg`
- New defect crops: `/opt/cursor/artifacts/survey2-01…39-<slug>.jpg`, `/opt/cursor/artifacts/survey2-astra-1…3-<slug>.jpg`
- Best frames sheet: `/opt/cursor/artifacts/survey2-best-frames.jpg`
- Rendered manifest (181 poses, name/from/to/s): `/tmp/survey2/manifest.json`; source poses `/tmp/survey1/manifest.json`; batches `/tmp/survey2/batches/b1…b8.json`
- After frames: `/tmp/survey2/frames/`; worktree `/tmp/survey2/wt` (detached at 75911f9, untouched)
- Machine-readable: `/tmp/survey2/final-ranked.json`, `/tmp/survey2/final-astra.json`, `/tmp/survey2/check-boxes.json`
