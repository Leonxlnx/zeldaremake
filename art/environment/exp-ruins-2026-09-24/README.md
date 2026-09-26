# exp-ruins: the waterfall ruins west of the village (2026-09-24 / 25)

Trailer shot r_036–r_043 (`reference/frames-dense/review46/`): a path runs west past the west house to mossy stone
arches, a terrace, and a waterfall into a pool. Branch `agent/fable-cursor-exp-ruins`. Every image here is 960×540 at
`quality=high`, simulation time 12.5 s, HUD off, character as the capture places him (at the spawn in the village).

## Results at a glance

Draft state at 99ad4987; the numbers were measured at 52ce2047 against canonical 14fda29d, and the final pass after
the canonical merge replaces them.

- **Rubric: 156 / 200, NOT READY** (ship bar ≥ 170, no check below 2, ★ ≥ 3). Below 3: #12 texel density, #32
  overhang and shade, #44 camera, #46★ budget.
- **Budget (700 draws / 9.0 M triangles):** heroes A–F within (max A 613 / 8.955 M); the ruins' views r01–r19
  within (max r16 636 / 8.542 M, measured before the lantern-branch fix). The trail's east end is over: r20
  712 / 10.076 M, where canonical draws 699 / 10.310 M.
- **Heroes against canonical:** B, D and E identical (no pixel moves more than 4 / 255); A moves 5 px, F 8 px,
  C 781 px (0.15 %: a few flowers in the bed right of the plaza).
- **Walk:** `plaza-to-ruins-terrace` 26 / 26, `ruins-trail-to-shore` 10 / 10, `ruins-water-stair` 15 / 15, 0 stuck;
  `ruinsProbes` 80 / 80 (before the canonical merge's new legs).
- **The village rule hid one thing the zone sees**, the lantern branch (208–6,644 px at all 17 zone poses);
  99ad4987 keeps it drawn.

## What is where (world metres; y is absolute height; layout `EXPANSION_RUINS`)

| item | where | what |
| --- | --- | --- |
| trail | 17 nodes from (−13.7, 8.3) beside the west house's flight foot to (−57.0, −4.3) on the outcrop, 48.3 m; ground 1.9 m at the discs, 2.5–2.9 m along the ledge | packed earth 1.7 m wide with a 0.7 m worn verge (the splat's path layer), north of the west house's wall ring, then west-north-west through the forest (`ruinsTrailLine`) |
| trail lanterns | (−45.6, −1.14), (−49.74, −5.32), (−55.1, −2.62), 2.25–2.45 m | bent bark posts on the verge with a pod on a hook over the path; emissive pods, no point light, no sun shadow from the pods |
| gate | boulders (−52.9, −7.2) r 1.5 and (−53.2, −1.2) r 1.3 | the trail enters the site between them |
| outcrop | x −61.0 … −54.4, z −8.2 … −1.85, top 2.9 m, eased to the forest floor over 1.8 m | the pale outcrop the trail climbs onto (terrain `ruins.ts`, stone skin `rock.ts outcropSkin`) |
| parapet | along the wall z −1.85 from x −61.0 to −55.6, 0.95 m, posts with basin finials at x −61.0, −58.3, −55.6 | the rail over the pool with the tile band |
| stair | base (−61.0, 2.9, −4.2), 8 risers × 0.2 m, tread 0.4 m, 2.4 m wide, climbing west | worn treads cut into the terrace's east front |
| terrace | x −74.9 … −61.0, z −9.8 … −1.85, slab tops at 4.5 m; front notched back to x −63.0 north of z −7.0 round the ivy rock | a solid ashlar block with a paved top; the retaining wall runs along its south face over the pool |
| hero arch | (−64.75, −4.2) at the stair head, 2.9 m clear span, twisted columns r 0.25 m × 2.9 m, the ring to 9.6 m | voussoir ring with ivy hung from it (`hangArchIvy`) |
| colonnade | z −9.1: columns at x −66.8 and −69.2 (3.2 m) under a lintel, a 1.05 m broken stump at −71.6 | along the terrace's north edge |
| broken arch | two piers at x −73.3, z −7.6 and −4.2 | the half-fallen arch at the terrace's west end |
| offering | (−63.72, −6.28) | a small offering on the paving between the stair head, the arch's north column and the ivy rock |
| water stair | base (−69.2, 0.85, −0.9), 18 risers × 0.203 m, tread 0.35 m, 1.2 m wide, climbing east to a landing reached through a break in the parapet (x −62.45 … −61.35) | down the retaining wall's pool face to the quay |
| quay | y 0.85 along the wall's foot, widening at the fall's foot to x −71.5, z 0.0 | the walk to the platform at the fall's foot |
| pool | centre (−64.9, 3.35), half extents 9.5 × 4.85 m (superellipse n 4), water 0.55 m, 1.45 m deep, a 1.6 m shelf | the basin below the wall |
| waterfall | lip (−74.35, 2.7) at 9.6 m, sheet 3.0 m wide | the fall off the west cliff into the pool's west end, with plunge foam, spray and mist |
| cliff | face along x ≈ −74.9 from z −12.5 to 10.5, top 10.8 m | the pale west cliff behind the terrace and the fall |
| ivy rock | (−60.6, −9.0), r 2.4 m, top 13.6 m | the great rock right of the stair, 201 ivy strands with 1,777 leaves on its shaded stair-side face |
| slab bridge | its piles at (−68.9, 0.5), (−69.5, 4.5), (−70.1, 8.6) | the natural stone slab spanning the pool's west end in front of the fall |

The ruins system (`src/world/ruins/`) builds 14 meshes, 156 k triangles: 390 ashlar blocks, 59 coping stones, 144
paving slabs, 34 stair treads, 18 voussoirs, 25 rubble pieces, 150 water-stair stones, 20 boulders, 3 lantern posts,
201 ivy strands with 1,777 leaves on the rock and 24 strands with 151 leaves on the arch, 16 offering pieces and 16
motes over the water. It adds no point light. It publishes 12 walk spans, 45 blockers and 246 paving seats for the
character ground and the vegetation. Its sounds are one waterfall and three pods (the audit's `soundSources`).

## Images

Contact sheets made with `sheet.mjs` from the captures (`poses.json`); the trailer frames are for comparison only.

- `sheet-trailer.jpg`: trailer r_036 / r_040 / r_042 / r_043 (left) beside r04–r07 (right) at player height.
- `sheet-trail.jpg`: the trail west from the village, r01–r04.
- `sheet-site.jpg`: the outcrop, the arch, the terrace, the water stair and the fall's foot (r05–r11), with trailer r_038.
- `sheet-water.jpg`: the pool from the east and south shores (r12, r13) and the three look-backs toward the village
  (r14–r16), with trailer r_039.

![trailer beside the branch](sheet-trailer.jpg)
![the trail](sheet-trail.jpg)
![the site](sheet-site.jpg)
![the pool and the look-backs](sheet-water.jpg)

## The 50-point rubric (`docs/RUBRIC_50_STRUCTURES.md`)

Judged at player height from the captures listed (r01–r19, `poses.json`), the playtest run and the tests. 4 is kept
for what matches the trailer or is fully proven by a measurement; every visual check that is plainly short of the
trailer's light and lushness stays at 3 or below.

| # | check | score | evidence |
| --- | --- | --- | --- |
| 1 ★ | reads at 20 m | 3 | r04 (16 m from the arch) and r12 (25 m): arch, stair, terrace, fall and pool read at a glance; the trailer's arch stands against bright sky, ours against the grey west cliff, so it reads less crisply |
| 2 | Kokiri scale | 3 | arch 2.9 m clear span on 2.9 m columns, risers 0.2 m / treads 0.4 m, parapet 0.95 m (chest height on Link's 1.25 m); no capture shows Link beside it (captures park him at the spawn) |
| 3 | irregular outline | 3 | 390 ashlar blocks of varied length and set-back, a broken parapet run, the half-fallen west arch, a 1.05 m stump, rubble; the terrace's mass is still a rectilinear block (r12) |
| 4 | varies with purpose | 3 | twisted hero columns against the colonnade's plain shafts, the broken arch, three lantern posts each bent its own way, the water stair's rough stones against the flight's cut treads |
| 5 | above and below | 3 | r17 (59° up at the arch from the terrace side): the ring's soffit, the keystone boss and the arch ivy hold, and the ring shows its depth; r18 (35° down from the parapet): the coping tops, the basin finial and the tile band are closed and textured; r19 (35° down on the quay): the water stair's treads read, but the pool is a dark flat sheet and the foam line round the slab bridge's pile is a clean arc |
| 6 ★ | visibly held | 3 | voussoir ring on capitals on twisted shafts on plinths, lintel on the colonnade, coping on the wall, pods on lashed hooks from bark posts, the slab bridge on three piles (r05, r06, r12) |
| 7 | joints meet | 3 | test "every loose stone meets what it lies on and stands out of it"; plinths and bases reach the paving bed (7c4fb16f); no gap or z-fight in r05–r11 |
| 8 | load paths | 3 | ring → capitals → shafts → plinths → paving → terrace fill behind the retaining wall; the slab bridge on piles in the pool; the flight cut into the terrace front |
| 9 | trim and edges | 3 | 59 coping stones, parapet posts with basin finials and the tile band, plinths, capitals, the lintel (r05, r13) |
| 10 | detail at 2–5 m | 3 | paving joints with grass and moss, lost slabs' moss beds, worn treads, lashing on the lantern hooks (r06, r08, r09); no tooling marks or chipped arrises on the blocks |
| 11 ★ | stone reads as stone | 3 | ashlar, paving and rock read as stone from 3 to 20 m (r06–r09, r11) |
| 12 | texel density | 2 | the masonry and the cliff hold at 3 m (r09, r11), but the quay's moss band (r10's foreground) and the east shore's lawn (r12) are soft beside the crisp blocks |
| 13 | palette | 3 | grey-green stone, moss greens, warm pods; the cliff lightened and cooled (6bd9b870); nothing chalk-white; the blue tile band is the one saturated accent, as on the trailer's parapet |
| 14 | roughness | 3 | a wet band at the waterline at ×0.5 roughness, moss 0.97, water 0.14 (`ruins/materials.ts`) |
| 15 | no stretching or tiling | 3 | no tiling repeat on the cliff or the terrace faces at 3–10 m (r09–r11); the paving is individual slabs |
| 16 ★ | weathering follows exposure | 3 | moss on the coping tops and ledges, a sunward moss cap on the cliff's brow (7b0d8121), damp shade moss low, the wet band at the waterline, ivy on the ivy rock's shaded stair-side face (201 strands) |
| 17 | wear follows use | 3 | the flight's treads worn at the middle; the trail's packed earth and worn verge from the village to the outcrop (r02, r06) |
| 18 | signs of life | 3 | the offering at the arch (a jar of wild flowers, a bowl of fruit, a cairn), three lit pods over the trail; sparse, as a ruin should be |
| 19 | damage plausible and sparse | 3 | a broken arch, a stump, a broken parapet run, lost slabs grown over, six rubble blocks in the shallows |
| 20 | nothing brand-new | 3 | every block weathered and mossed; the pods' husks aged |
| 21 ★ | sits in the terrain | 3 | the outcrop is terrain (`terrain/ruins.ts`), eased to the forest floor over 1.8 m; the terrace stands in the carved basin on its retaining wall; both stairs cut in (r04, r12, r13) |
| 22 | nothing floats or is buried | 3 | tests "every loose stone meets what it lies on…" and "the water meets its banks, the rock and itself" (18 k+ points, none bare); plinths reach the paving bed |
| 23 | contact shadow / AO | 3 | the sun's shadow and the AO at the column feet and along the block courses (r07, r08) |
| 24 | vegetation around it | 3 | 246 paving seats root the terrace's tufts in joints and lost beds, none on a slab's face; outcrop lawn, pool rim, cliff and pillar feet (`vegetation/expansionRuins.ts`); thinner than the trailer's moss |
| 25 | paths lead to it | 4 | the 48.3 m trail from the west house's flight foot to the outcrop with three lanterns; playtest `plaza-to-ruins-terrace` 26 / 26 waypoints |
| 26 | openings framed | 3 | the arch's opening is a voussoir ring on capitals and plinths; the colonnade's bays framed by the lintel |
| 27 | through the openings | 3 | through the arch: the paving and the cliff's blind arch (r06, r07), never a void; the trailer shows bright sky there |
| 28 | openings face arrivals | 4 | the arch stands at the stair head facing the trail's approach (r04–r06), as in r_036–r_043 |
| 29 | round where the reference is | 4 | a round arch on twisted columns, as in r_036–r_043 |
| 30 | leaves soften openings | 3 | 24 ivy strands (151 leaves) over the ring hang into the opening (r06) |
| 31 ★ | soft organic tops | 3 | moss on the coping and ledges, the cliff's brow fringe, ivy over the rock; the coping line itself stays straight |
| 32 | overhang and shade | 2 | the coping projects 6 cm, a thin shade line on the wall; the arch's ring and the lintel shade a little; no deep overhang anywhere |
| 33 | thickness | 4 | every block, slab, coping stone and the slab bridge is a closed solid; no single-sided shell |
| 34 | tops carry growth | 3 | moss caps on the coping, tufts in the paving, the cliff's cap, ivy over the rock and the arch |
| 35 | ties to the rock | 3 | the terrace is built against the west cliff and notched round the ivy rock (its front stepped back to x −63.0 north of z −7.0) |
| 36 ★ | lanterns glow warm | 3 | three pods, warm emissive, each on a lashed hook from a bent bark post with wedged foot stones (r03–r05) |
| 37 | light pools restrained | 3 | no point light, so no pool at all under the pods: restrained, but no soft pool either |
| 38 | no clipped whites | 3 | r01–r19: no pixel with all three channels ≥ 250 in any frame; only the pods' cores clip, in red alone (255 / 217 / 132; 0.56 % of r04, 0.63 % of r05); the brightest pixel is luma 235 (r06). Held at 3 because the frames are dim enough that nothing comes near clipping |
| 39 | reads in sun and shade | 3 | the paving in sun patches and in shade (r06–r08); the wall's pool face in shade (r13) |
| 40 | no toggling light | 4 | the ruins add no light; the village rule hides meshes only, never a light (structures audit `villageFromRuins`) |
| 41 ★ | walks every surface | 4 | playtest: `plaza-to-ruins-terrace` 26 / 26, `ruins-trail-to-shore` 10 / 10, `ruins-water-stair` 15 / 15, 0 stuck; the site's walk and water-stair tests |
| 42 | edges block | 4 | `ruinsProbes` 80 / 80 (50 blocked where they should be: walls, parapet, cliff, ivy rock, gate boulders, columns, piers, lantern posts, offering, deep water, every open edge); test "the ruins hold Link off their stone, their edges and the deep water" |
| 43 | steps even underfoot | 3 | risers 0.2 m (flight) and 0.203 m (water stair); the water stair's soles p95 1.4 cm off; the steep east bank (natural ground) p95 8.4 cm, max 25 cm |
| 44 | camera | 2 | `camcheck.mjs`: 0 of 2,367 route cameras in stone, ground or water; 2 of 360 swung views 6.6–7.0 cm behind a stone face at the water stair's mid tread; the worst jump 0.301 m at the fall's foot |
| 45 | footsteps | 4 | `surfaces.test.mjs`: dirt on the trail, stone on the masonry, water in the shallows (a wading step of its own, f9f27f3f); `afae710e` |
| 46 ★ | budget | 2 | heroes A–F within 700 / 9.0 M (max A 613 / 8.955 M); r01–r19 within (max r16 636 / 8.542 M); but at the trail's east end (r20, x −29.8, looking back at the village) the branch draws 712 / 10.076 M where canonical draws 699 / 10.310 M, so it takes that pose over the draw limit (see Cost) |
| 47 | hidden when far | 4 | `ruinsVisible` (casters and their shadow footprints); tests "no fixed frame sees the ruins or their shadows, and the zone views do" and "the village hides only from the ruins zone…" |
| 48 | deterministic | 4 | test "the same seed builds the same stone"; PRNG only; r20's pose drawn twice in one session moves 0 px (probe3), and drawn by the builds before and after the village rule (outside its zone) it also moves 0 px (verify2) |
| 49 | belongs to this forest | 3 | the trailer's own ruins, in the forest's palette; but past the site the backdrop is flat hazy meadow and bare distant trunks (r09, r12), not the trailer's gorge |
| 50 | worth walking up to | 3 | the arch at the stair head with the fall beside it (r04, r05) is a vista worth the walk; the light is flat and murky next to the trailer's |

**Total 156 / 200.** Below 3: #12 (2), #32 (2), #44 (2), #46★ (2). The ship bar is ≥ 170 with every ★ at 3 or
more, so this draft is NOT READY.

## Walking (gauntlet/scripts/playtest.mjs)

`node gauntlet/scripts/playtest.mjs --dist <dist> --out <dir> --only walk --walk-routes plaza-to-ruins-terrace,ruins-trail-to-shore,ruins-water-stair`,
run on this lane's build before the village rule and the two audio-only merges (neither touches the walk, the
ground or the camera), then `camcheck.mjs` on its output.

| route | waypoints | stuck | length | soles off the ground (p50 / p95 / max) | camera: min over ground, worst jump |
| --- | --- | --- | --- | --- | --- |
| `plaza-to-ruins-terrace` (plaza → trail → outcrop → flight → arch → paving) | 26 / 26 | 0 | 77.8 m | 0.4 / 3.8 / 9.9 cm | 1.63 m, 0 m |
| `ruins-trail-to-shore` (off the trail, down the east shore, round the south bank, into the shallows) | 10 / 10 | 0 | 28.2 m | 2.0 / 8.4 / 25.0 cm | 0.61 m, 0.10 m |
| `ruins-water-stair` (paving → parapet break → landing → 18 treads → quay → fall's foot) | 15 / 15 | 0 | 27.4 m | 0.0 / 1.4 / 13.7 cm | 1.93 m, 0.30 m |

- `ruinsProbes`: 80 / 80 as expected — 30 walkable spots (trail, lantern verges, outcrop, stair, arch passage,
  paving, inside every open edge, the water stair's crossing, landing, treads, quay and platform) and 50 held (every open edge from inside and off it, the ivy rock
  over the paving, deep water, wall, parapet, cliff, gate boulders, columns, piers, lantern posts, offering, plunge).
- Wading (`wade`): from the east shore at 15°, 90° and 345° he wades to the waterline and 0.25–1.1 m past it before
  the depth holds him; at 68° the bank holds him before the water.
- Camera (`camcheck.mjs`, all 2,367 route cameras and 360 swung views): none inside the cliff, the ivy rock, the
  ground or the water; 2 swung views 6.6–7.0 cm behind a stone face at the water stair's mid tread (yaw 0°, the
  boom pinned to 13 % against the wall); the view is hidden behind stone from one spot (terrace north-west by the
  cliff, yaw 225°). Worst jump 0.301 m (the boom pulling in at the fall's foot, `ruins-water-stair` frame 346).
- Footsteps (`src/audio/surfaces.test.mjs`): the trail is dirt, the masonry stone, the shallows water; the ruins'
  standing places all sound built (`afae710e`).

## Cost

Draw calls / triangles (M) after a composed frame, the sun's depth pass included (`views.mjs`, 8 settle frames,
960×540, `quality=high`). Canonical 14fda29d against this branch at 52ce2047, which already has the village rule
but not the lantern-branch fix. ✗ marks a frame over 700 draws or 9.0 M triangles.

| view | canonical | branch | | view | canonical | branch |
| --- | --- | --- | --- | --- | --- | --- |
| A stairs | 614 / 8.967 | 613 / 8.955 | | r10 water stair, quay | 66 / 0.080 | 95 / 0.390 |
| B house | 596 / 8.293 | 595 / 8.281 | | r11 fall's foot | 64 / 0.081 | 92 / 0.375 |
| C look-back | 533 / 7.959 | 531 / 7.936 | | r12 pool, east shore | 88 / 0.735 | 110 / 0.778 |
| D log | 523 / 8.741 | 522 / 8.729 | | r13 pool, south shore | 191 / 1.470 | 211 / 1.428 |
| E ground | 596 / 8.293 | 595 / 8.281 | | r14 look-back, terrace | 628 / 9.636 ✗ | 489 / 7.120 |
| F canopy | 555 / 8.098 | 554 / 8.086 | | r15 look-back, outcrop | 639 / 9.562 ✗ | 531 / 7.338 |
| r01 trail leaves village | 372 / 4.518 | 405 / 4.495 | | r16 look-back, trail | 730 / 10.625 ✗ | 636 / 8.542 |
| r02 mid forest | 200 / 2.835 | 224 / 2.548 | | r17 arch 59° up | 135 / 1.085 | 129 / 1.144 |
| r03 lanterns | 131 / 1.642 | 148 / 1.510 | | r18 pool 35° down | 72 / 0.514 | 95 / 0.501 |
| r04 gate | 93 / 1.038 | 116 / 0.990 | | r19 quay 35° down | 102 / 0.609 | 121 / 0.701 |
| r05 outcrop | 87 / 0.536 | 105 / 0.721 | | r20 trail's east end | 699 / 10.310 ✗ | 712 / 10.076 ✗ |
| r06 stair to arch | 78 / 0.276 | 95 / 0.488 | | x17 flight 59° up | 67 / 0.094 | 65 / 0.361 |
| r07 arch passage | 65 / 0.093 | 85 / 0.417 | | | | |
| r08 colonnade | 66 / 0.078 | 91 / 0.456 | | | | |
| r09 terrace to fall | 66 / 0.118 | 88 / 0.355 | | | | |

The same tree before the village rule drew 595 / 8.950 at r14, 633 / 9.159 at r15 and 739 / 10.347 at r16 (verify2's
A side). East of the rule's line the branch and canonical compare as follows: 704 / 9.992 against 694 / 10.204 at x
−26.4, 673 / 9.545 against 668 / 9.746 at x −19.6, and 637 / 8.997 against 633 / 9.144 on the west house's deck. At
r20 the ruins and their plants draw nothing (probe3), and the village is in view (hiding it moves 6,848 px), so that
frame is the village's own cost plus 13 draws the branch adds, which are not yet attributed to a system.

The rules that keep it inside the budget:

- `ruinsVisible` (`util/expansionLocality.ts`): the site's meshes draw only when a caster sphere or its shadow
  footprint meets the camera's frustum within reach; no fixed frame ever does (test).
- The vegetation's ruins share is pruned last with the packs' sort centres pinned (`lodset.ts pinSortCentres`),
  so the six fixed frames draw their plants in the same order as before the ruins (332e8a13).
- Trees: the mid grove and the distant layer keep 11 m off the trail's line and 10 m off the site's box; legacy
  boles keep their flare off the trail and the masonry (`trees/index.ts`, `ruinsTrunkCull`).
- The village from the ruins (e37b1777, `villageHiddenFromRuins`): west of x −30 inside the trail's or the site's
  box and at walking height (≤ 5 m over the ground), the structures system hides the village's drawables (the
  plaza's houses, posts, fences, arch and the distant huts; 35–95 m east behind the west giant and the forest). The
  lantern branch down the trail, which the zone does see, stays drawn.
  Lights are never toggled (a light leaving the scene recompiles every lit program).

**The village rule, checked (verify2, 2026-09-25).** The check compared 52ce2047 against the same tree before the
rule, with the same settle on both sides. At 17 zone poses (the three look-backs plus trail, forest, site and
hut-facing views, eye 1.5–3.8 m) the rule saved 103–115 draws and 1.8–2.0 M triangles each. It also hid something the
zone does see: 208–6,644 px moved (max Δ 16–114). Every moved pixel lies on the lantern branch's limb, moss and tufts
down the trail (the diff masks). The control pose just east of the line moved 0 px. 99ad4987 keeps the branch: the
branch is no longer in the hidden set, and the parts of it that the village merge folds into the houses' buckets are
copied and drawn as their own merged group while the rest of the village is hidden.

## Hero frames A–F

Canonical 14fda29d against 52ce2047, the same `views.mjs` settle on both sides, PNG (`herodiff.mjs`: a pixel "moves"
when any channel changes by more than 4 of 255).

| frame | draws / triangles (M), canonical → branch | pixels moved | max Δ | PSNR | where |
| --- | --- | --- | --- | --- | --- |
| A stairs | 614 / 8.967 → 613 / 8.955 | 5 (0.001 %) | 10 | 81.8 dB | a leaf edge at the top right |
| B house | 596 / 8.293 → 595 / 8.281 | 0 | 4 | 92.1 dB | — |
| C look-back | 533 / 7.959 → 531 / 7.936 | 781 (0.15 %) | 57 | 57.1 dB | a few flowers in the bed right of the plaza, shaded differently |
| D log | 523 / 8.741 → 522 / 8.729 | 0 | 4 | 90.9 dB | — |
| E ground | 596 / 8.293 → 595 / 8.281 | 0 | 4 | 92.1 dB | — |
| F canopy | 555 / 8.098 → 554 / 8.086 | 8 (0.002 %) | 11 | 79.9 dB | a few leaf pixels |

No hero frame sees the ruins or their shadows (test), and the village rule never fires at a fixed viewpoint (test).

## Changes outside the ruins' own files

| file | what |
| --- | --- |
| `src/world/index.ts` | one line: the `ruins` system (built before the vegetation and the character, which read its spans and blockers) |
| `src/world/system.ts` | `SharedGeometry.cameraSolidGrids` (further camera solids) and `pavingSeats` (where growth roots in the paving) |
| `src/world/layout.ts` | `EXPANSION_RUINS` (trail, site boxes, stairs, water stair, pool, fall, lanterns, offering) and `inExpansionRuins` |
| `src/world/terrain/heightfield.ts` | live view only: the trail's grade and verge, the outcrop and the pool's basin, the masonry in the structure mask; `expansionCull(…, withRuins)` |
| `src/world/terrain/expansion2.test.mjs`, `expansionSouth.test.mjs` | the older expansion tests skip the ruins' ground, which `ruins.test.mjs` and the vegetation's own rules cover |
| `src/world/character/ground.ts` | the ruins' flight and water stair in the stair list; `createRuinsBlocked` (pool, walls, cliff, ivy rock, boulders, columns) |
| `src/camera/collision.ts` | reads every grid in `cameraSolidGrids` beside the structures' solid |
| `src/world/trees/index.ts` | the grove and the distant layer keep off the trail and the site; boles keep their flare off them |
| `src/world/vegetation/expansion.ts`, `index.ts`, `lodset.ts`, `plants.ts` | the ruins' live sets (`expansionRuins.ts`), their prune last with the sort centres pinned, the butterflies' flower list as it stood before the prune |
| `src/world/structures/index.ts`, `src/world/util/expansionLocality.ts` | the village hides from the ruins zone at walking height (meshes only); the lantern branch stays drawn there |
| `src/audio/ambience.ts`, `footsteps.ts`, `index.ts` (+ tests) | the waterfall's roar (silent from 42 m), the trail pods' flames, the wading footstep, the ruins' surfaces |
| `gauntlet/scripts/playtest.mjs` | the three ruins routes, `ruinsProbes` (80 walk / block probes and the wading scan) and `ruinsCamera` (360 swung views) |

## Known issues

- The light at the site is flat and murky next to the trailer's sunlit arches and bright water (r_036–r_043).
- Past the site the backdrop is flat hazy meadow and bare distant trunks (r09, r12), not the trailer's gorge.
- The trail's east end (r20, x −29.8, looking at the village) is over the budget: 712 / 10.08 M, against canonical's
  699 / 10.31 M. The village rule stops at x −30 because the village is in view from there.
- The camera at the water stair's mid tread: 2 of 360 swung views end 6.6–7.0 cm behind a stone face.
- The coping projects 6 cm; nothing on the site throws a deep overhang shadow.
- The quay's moss band is soft beside the crisp blocks (r10).
- One capture of x17 (59° up from the flight, the sun in frame) came out as the page's flat background colour
  (#0b0f0a: the canvas contributed nothing), while the next frame in the same session and the same pose on another
  build render normally. It is treated as a capture glitch and re-captured in the final pass.
- The walk results predate the canonical merge that brings the new legs (walk 1.2 / run 2.2 m/s).
- No capture shows Link at the ruins: the capture API parks him at the spawn in the village.

## Reproduce

```bash
npx tsc --noEmit
node --test $(rg --files -g '*.test.mjs' | rg -v '^(dist|node_modules)/')
npx vite build --outDir /tmp/ruins-dist
node art/environment/exp-ruins-2026-09-24/views.mjs --dist /tmp/ruins-dist --out /tmp/ruins-views \
  --shots art/environment/exp-ruins-2026-09-24/poses.json --heroes 1
node gauntlet/scripts/playtest.mjs --dist /tmp/ruins-dist --out /tmp/ruins-play --only walk \
  --walk-routes plaza-to-ruins-terrace,ruins-trail-to-shore,ruins-water-stair
node art/environment/exp-ruins-2026-09-24/camcheck.mjs /tmp/ruins-play/playtest.json
node art/environment/exp-ruins-2026-09-24/sheet.mjs <spec.json> <out.jpg>
```
