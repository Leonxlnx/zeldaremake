# Round 46 — evidence-gated on the survey-2 poses

World `973a21e` (merges `233c559` vegetation-24, `b658e54` trees-29, `973a21e` structures-29 on
`9bdd72b` = take-0115's world + survey-2). Every sheet is BEFORE (take-0115 / `9bdd72b`) | AFTER
(the lane's final build) at an identical survey pose (`art/environment/survey2/manifest.json`).
Rule for this round: an after that looks like its before is a recorded FAIL, not a claim.

## trees-29 (`723264c…d4a0259`) — `trees29-<pose>.jpg`

| pose | survey-2 item | verdict | what changed |
| --- | --- | --- | --- |
| `w07-spine-l` | #02 giant bole camo decal at 4 m | **PASS** | the emergent column at 4.4 m is dark fissured relief bark with 3-D moss cushions (crop mean diff 26/255) |
| `w29-house-l` | #02 lantern-tree bole | PASS | same near-base program on the lantern tree |
| `w19-spine-r` | #01 columns = smooth cones | PASS (modest) | bark banding on the depth-row boles' near LOD (`DISTANT_NEAR_FLOOR`, zero at 38 m+) |
| `w04-spine-f` | #04 lantern limb stucco | marginal | bough cords / AO / beards on the sleeve; the underside at 2 m barely moves (diff 8/255) |
| `sn-bole-lantern-tree` | 03 WORSE (flat 9-gon cushion at 0.4 m) | marginal | cushion softened, the disc still reads at touching distance |
| `w09-spine-l` | #03 "faceted buttress cone" | reclassified | the pale wedge is a depth-row bole foot at 55–71 m in haze, not a buttress flare — no geometry to fix here; it is a far-haze read |
| `sn-arch-outside` | #05 columns under the arch | FAIL | unchanged at 7–9 m in the haze |
| `w02-spine-r`, `w22-stairs-r`, `w19-spine-u` | #07 near-canopy discs, #33 crown cut-outs | not attempted | measured no-go on record |

Six views (`/tmp/r46/cap0` → `cap1`): A +0.0005, B +0.0001, C +0.0002, D +0.0002, E −0.0001, F +0.0005.

## structures-29 (`485d0ce…155e7f5`) — `structures29-<pose>.jpg`

| pose | item | verdict | what changed |
| --- | --- | --- | --- |
| `w29-house-d` | #15 house-west flight slab boxes, black voids | PASS | risers backed and faced with mortared stone; the void behind the moss block is a lit stone face |
| `w20-spine-r`, `w18-spine-f` | #12 arch sawtooth rims, #14 belly clay plank | PASS (modest) | torn bark plates of irregular width/tilt with fibrous tips; plate cells in the bark colour on the belly; underside ground bounce ×3 |
| `sn-house-door` | #16 interior black + primitive props | PASS (modest) | boards, lamp pools, turned furniture; stays dark from outside |
| `w26-stairs-l`, `w09-spine-r` | #08 root arcs floating | PASS | arcs seated on the heightfield, bark cords round the tube, moss on top |
| `w28-plateau-f` | fence rails flat | PASS (subtle) | grain + chamfer on rails; signpost board ×4.5 toward B's measured tone |

Six views (`/tmp/r46s/cap0` → `cap8`): A −0.0013, B −0.0006, C 0, D −0.0013, E −0.0008, F +0.0001.

## vegetation-24 (`5e2925a…750fcf9`) — `veg24-<pose>.jpg`

| pose | item | verdict | what changed |
| --- | --- | --- | --- |
| `w30-house-l`, `sn-signpost` | #05 flower spheres | **PASS** | 5–6 obovate petal cards + inner whorl + eye disc at near/mid LOD, blob kept far; D purple share 0.374 → 0.491 % |
| `w19-spine-l`, `w21-spine-f`, `w18-spine-r` | #06 hollow floor / north plain | PASS | clump-card carpet to 25 m (9 089 cards), north litter ×1.9 seated flat on the exact terrain, litter/humus albedo mask under the whitebarks |
| `sn-boulder-stairfoot` | #28 moss cushion spheres | PASS (improved) | ultra LOD to 6 m; lobed, ruffled cushions with blades and one-triangle hairs |
| `sn-boulder-terrace` | #16 big-leaf cards | PASS | folded two-tone leaflet clusters at ≤ 5 m |

Six views: worst −0.0006 (D); draws unchanged; +0.085 M tris at C worst; W18 pass; score 23 → 24/50.

## Open after this round

Columns under the arch in haze (`sn-arch-outside`), the lantern limb's underside at 2 m, the
touching-distance cushion disc, near-canopy flat discs, distant cardboard trees, whitebark bases.
