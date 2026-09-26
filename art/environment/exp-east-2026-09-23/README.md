# East plateau lane (exp-east), 2026-09-23 to 09-26

The owner asked on 2026-09-23 at 20:08 UTC: *"why for the love of God has there been no expansion to the
environment past the stuff"*. The flat ground at the top of the main stairway, about 5.2–5.9 m up and east
of the upper house, is now a walkable Kokiri lane. A stepping-stone path runs from the stair head past a
shop, a tall house with a side deck, a small cosy house and a green, to a lookout with a rope fence and a
log bench over the south lip.

Branch `agent/fable-cursor-exp-east`. Everything is authored in `src/world/layout.ts` (`EXPANSION_EAST`,
`EAST_BOX`, `eastDeckPlan()`, `eastHouseBlocks()`) and built by `src/world/structures/east.ts`. The
distance, frustum and zone rules live in `src/world/util/eastLane.ts`.

## Status

**READY.** The lane is merged with canonical `2b15f687` (merge `5dc77784`). `npx tsc --noEmit` is clean and the
full suite passes 257 of 257. On that build every hero and lane view is inside 700 draws and 9.0 M triangles
(the heaviest, `tall_deck`, draws 577 calls and 8.827 M), every walk route reaches every waypoint without
sticking, the deck and its flight play wood, and the lookout's fence ends hold. The 50 checks score 173 / 200,
none below 2 (check 19, damage, scores 2) and every starred check 3 or 4.

## What is there (world XZ in metres, ground height from the heightfield)

| Piece | Where | Detail |
| --- | --- | --- |
| Stepping-stone lane | 17 nodes, from the stair head (17.6, −7.35) to the lookout (47.2, 7.25) | 50 discs (radius 0.40–0.47 m, 1 m apart) laid on the natural ground. Its first 14 m thread the trees at camera A's right edge at least 1.8 m from each trunk; it swings round the shop's door at least 5.3 m from its trunk's axis. |
| Spurs | upper house ladder (17.6, −7.35) → (16.05, −14.55); tall house door (42.6, −0.3) → (44.3, −1.1); small house door (38.27, −1.52) → (35.96, 2.14) | |
| Shop | trunk (40.0, −7.0), radius 3.0, dome 5.3 m high, door facing bearing −53° (toward the lane) | Counter window 1.02 rad right of the door (sill 0.92 m, head 1.72 m) with 5 shutter boards, a plank awning, and pots and fruit on the counter. A hanging sign with an original carved glyph (27 strokes) hangs from a post at (35.7, −6.95). A crate stack and a basket stand beyond the sign, an open crate and a fruit basket past the counter. 2 door pods. |
| Tall ("bossy kid") house | trunk (48.6, −1.6), radius 3.0, dome 7.6 m (the tallest), door facing −84° | Side deck on the south face, planks at 6.86 m (1.15 m above the door floor): 8 grained boards on two beams and four joists, a rim board, 6 log posts sunk 0.3 m into the ground, a top and a mid rail. 6 rises of 0.21 m (5 plank treads and the deck) on two stringers climb from (45.58, 2.25) to (47.33, 2.19), 0.27 m in from the deck's outer edge, with the corner post beside their top; the railed walk strip runs on from there (47.25, 2.19) → (49.92, 2.10). A 5-rung ladder, its rungs lashed on, stands at the far end, footed at (50.78, 2.28). |
| Small cosy house | trunk (37.2, 6.0), radius 2.1, low dome 4.1 m, door facing 200° (toward the lane) | Round window, two flower boxes with 16 flowers each, 1 door pod. A doorstep block stops Link at the threshold, because the arch hangs only 1.5–1.6 m over it. |
| Pod lantern posts | (41.2, 0.4) orange, 1.95 m; (46.4, 6.55) lime, 1.8 m | Emissive pods. |
| Lookout | rope fence on the south lip, 5 posts from (45.3, 8.85) to (50.3, 8.55), its ends wrapped round two sawn stumps at (44.72, 8.98) and (50.88, 8.36); a west run of 5 posts from the west stump to the small house's back roots at (38.95, 8.45); an east run of 3 posts turned inland from the east stump to a smaller stump at (50.78, 5.3); log bench at (48.3, 7.55), yaw −132°, 1.9 m long | The bench faces back over the lane. The ropes and stumps stop Link 0.25 m short of them. Every run end but the west run's last stands inside a stump's stop ring, and that one stands on the small house's pad, so the barrier has no gap from the small house to the inland stump. |

The doors are dark recessed openings with a lit room behind (shelves, pots, hanging pods, a table). They
cannot be entered, like the rest of the village. All three houses use the shared house builder
(`structures/house.ts`). It gained an opt-in `rightFoot`, so the entrance arch's right root lands next to the
door instead of sweeping 5.5 m out over flat ground. Houses that don't set it build unchanged.

The 16 new pods glow through emissive material only. The builder's 14 pod point lights are dropped (audit
`pointLightsDropped: 14`), so the scene's light count, and therefore every shader, stays the same. Each
dropped light leaves a soft pool on the ground (`buildLightPools`).

Trees, vegetation and rocks are cleared from the footprints and the lane in the *live* terrain view only
(heightfield `eastLaneCull` / the `expansionCull` east flag). The mid grove's card crowns are kept 11 m off the
lane, the same rule the plaza's walk lines use, except the crowns cameras A–E frame. The legacy streams keep
their counts, so no other instance moves.

Outside `structures/` and the lane's own util files the branch touches: `layout.ts` (the lane's data),
`terrain/heightfield.ts` (masks only, no height changes), `hardscape/` (the discs: a `flagstones-east` mesh of
their own, drawn only from over the plateau),
`character/ground.ts` (walls, walk surfaces, the lookout fence), `character/index.ts` (background kids hidden
by the terrain, `util/sight.ts`), `trees/index.ts` (the clearing), `vegetation/expansion.ts` (two lines:
`tileMeetsExpansion` includes `EAST_BOX`), `audio/index.ts` (the deck plays wood), `system.ts` (the deck's
optional `skirt`) and `gauntlet/scripts/playtest.mjs` (three walk routes and the lane's edge probes).

## Walkability

- Character ground (the live mask plus `ctx.shared.walkSurfaces`): the discs are walkable. These are walls:
  the trunks (at 1.1 R), both arch buttress feet of every house, the small house's doorstep, the sign post,
  both lantern posts, the bench, the deck railings, and the lookout's three rope runs and three stumps. The
  deck and its steps are walk surfaces (`east-tall-deck`, `east-tall-steps`). Section 7 of
  `src/world/terrain/expansion2.test.mjs` asserts all of this. It also checks 0.5 m of clear ground round
  every lane and spur sample, gradients up to 0.25, every buttress foot clear of the paths and the deck
  steps, and that every door step is open.
- The deck (`697e251a`, `c710389f`, `9a97df4b`). Its walk strip is 0.8 m wide and stops 0.25 m inside both
  railings, so a walker pressing on them keeps his boots and chest out of the boards. A skirt of the deck's
  height reaches 0.9 m round the strip and is closed to walking: the feet's foothold prediction reads the
  planks there instead of the ground 1.2 m below. A flood by the movement rule from the deck goes down the
  steps to the ground and never reaches the skirt.
- The flight (`32f852ed`). Its walk band is the strip's own band, 3.34–4.14 m off the trunk. On the merged
  build, the playtest's deck route stopped dead at the top of the steps, at (47.38, 2.64). The flight used to
  be 0.22 m wider on the outside than the strip, so a walker coming up the treads' outer edge met the strip's
  skirt head-on under the outer corner post, where neither of the movement's slide turns could step clear.
  The flight now stands 0.27 m in from the deck's edge. Section 7 walks it by the movement rule every 5 cm
  across the treads, and every walker reaches the strip. On the old layout that test stopped at the
  playtest's point exactly.
- The lookout (`0c7bcaed`, `9de40b0e`, `24cdb3c1`). The lip behind the fence falls 5 m in 6 m. The character
  ground stops Link 0.25 m short of every rope and stump (`lookoutFenceBlocked` in `character/ground.ts`,
  not a structure pad, so the grass under the rope stays). Canonical's movement slides along an edge met
  at a slant, so the rope runs on at both ends: west from the west stump along the lip to the small house's
  back roots, and inland from the east stump to a third, smaller stump 3 m in, so a slanted press ends in a
  corner. The test floods from the bench by the movement rule and never reaches the bank side of the rope
  between the small house and the inland stump. East of the inland run and west of the small house the lip
  is the plateau's own edge, as before the lane: a 41° bank, walkable both ways, reached only by walking
  round the runs on purpose.
- Footsteps (`3f5a262c`, `5ce100b8`). The deck and its flight play wood: the audio's `surfaceAt` reads
  `eastDeckPlan()`, and `src/audio/surfaces.test.mjs` lists both among the built standing places, with the
  ground a metre off the outer railing as the mirror check. The discs play stone from the live path mask,
  the lawn grass.
- Play camera (`38e1cd13`). The camera's collision treats an entrance arch's right side as a solid shell,
  so the lane passes the shop's door at least 5.3 m from its axis, and the deck is turned so the foot of its
  steps stands 3.5 m right of the tall house's door axis. The houses' trunks, caps, arches, porches and frames are camera
  solids and the deck, posts, stumps, bench and crates slim parts (`structures/cameraSolids.ts` voxelises the
  east group with the rest).

## Cost: how the lane stays inside the budget

The lane adds three houses to views that already looked back over the whole village. Six rules keep every
view within 700 draws and 9.0 M triangles, shadow pass included. None of them acts at a fixed camera: they
are scoped to the plateau, and at A–F the lane draws nothing. Each rule that changes what is drawn has a
`window` switch for A/B captures, unset as shipped.

| Rule | Commit | What it does | Switch |
| --- | --- | --- | --- |
| One tier | `a8486d32` | The lane's base and mid tiers and its small detail share the trunks' buckets, one per material (a tier of its own costs a draw per material in the colour and the shadow pass). Only the moss tufts and the rooms stay tiers of their own. | — |
| Tufts in reach | `d6292222` | The moss tufts' bucket draws each house's run and the lookout's only while it is in reach and in frame. | — |
| Coarse tufts | `882070d8` | A house's cap and trunk tufts draw a coarse copy (5 / 4 segments, one ring) while the camera is more than 6 m off its trunk (`EAST_TUFT_FAR_M`). | `__KF_EAST_FAR_TUFTS_OFF__` |
| The zone | `cc8c8bb0`, `cbc4c55f` | While the camera is on the plateau past the lane's bend (`EAST_ZONE`: x > 30 m, y > 5 m), the other structures' casters (village, expansion, south, north, grove, 30–95 m off down the bank) stop casting. | `__KF_EAST_ZONE_OFF__` |
| Far colour LOD | `72cbd118` | On the plateau's far part (x > 40 m) the other structures draw a vertex-clustered copy, on cells 1/400 of each one's distance from the camera (≤ 1.6 px at 960 × 540). 77 parts, 839 k → 457 k triangles (audit `structures.eastFarLod`). | `__KF_EAST_FAR_LOD_OFF__` |
| House runs | `f154f9f2` | Each core bucket holds the tall house's parts, then the shop's, then the small house's, then the lane's. A frame draws from the first run in view to the last (each run's 0.5 m cells, taken from its triangles, against the frustum). The shadow pass draws from the first to the last run whose shadow can reach the frame (the run's sphere swept along the sun). | `__KF_EAST_HOUSE_RUNS_OFF__` |

They sit on the lane's earlier cost pass (2026-09-24): shadow proxies for the caps, wood, ropes and pods
(`932880de`), the village's shadow LOD (`82a85ced`), the village's tufts only within 34 m (`09110730`), the
village's rooms only in front of their doorways (`b3e10c09`), background kids hidden by the terrain
(`eb17a820`), and the reach rule, sight-tested tiers, baked pods, shared rooms and ground light pools
(`2065314d`, `9ab6808c`).

## Results

The budget views (the heroes A–F and the six lane views of the first table), the walk routes and the play
probe were measured on the final merged build `5dc77784`: the lane plus canonical `2b15f687`, in headless
Chrome + SwiftShader at 960 × 540. The canonical column is `2b15f687` itself. The rest of the lane's views
were measured one merge earlier, on `67017696` (the lane plus canonical `33e92705`). The last merge brought
canonical's per-lobe depth pass for the far foliage (`56fad662`), audio levels and notes. At the six lane views
it renders byte-identical frames with the same draws (one fewer at `lane_bend` and `shop_door`) and 9–254 k
fewer triangles, so the numbers from `67017696` are upper bounds.

### Draw calls and triangles (colour, shadow and post passes; budget 700 draws and 9.0 M triangles)

`tools/views.mjs`: `setTime(12.5)`, 6 settle frames at 1/30 s, then `renderer.info`.

| View | Draws, canonical | Draws, branch | Triangles, canonical (M) | Triangles, branch (M) |
| --- | ---: | ---: | ---: | ---: |
| `A_stairs` | 575 | 575 | 8.636 | 8.604 |
| `B_house` | 557 | 557 | 7.954 | 7.931 |
| `C_lookback` | 494 | 494 | 7.725 | 7.723 |
| `D_log` | 484 | 484 | 8.368 | 8.360 |
| `E_ground` | 557 | 557 | 7.954 | 7.931 |
| `F_canopy` | 516 | 515 | 7.840 | 7.796 |
| `stairhead_lane` | 356 | 403 | 7.102 | 8.180 |
| `lane_bend` | 259 | 307 | 3.691 | 4.819 |
| `shop_door` | 266 | 286 | 3.044 | 3.343 |
| `green_wide` | 612 | 562 | 8.976 | 8.570 |
| `lookout_back` | 514 | 475 | 7.952 | 7.621 |
| `tall_deck` | 636 | 577 | 9.410 | 8.827 |

The heaviest view is `tall_deck`: 577 draws and 8.827 M triangles, 1.9 % under the triangle budget. Canonical's
camera at the same pose, on the plateau without the lane and looking back over the village, is over budget at
636 draws and 9.410 M. The zone and the far colour LOD save more there than the lane adds, as they do at
`green_wide` and `lookout_back`. Where the lane itself fills the view it costs what it adds: `stairhead_lane`
+47 draws and +1.08 M, `lane_bend` +48 and +1.13 M, `shop_door` +20 and +0.30 M. At A–F the lane draws nothing.

The rest of the lane's walking views, on the branch only, measured on `67017696` (they supply the sheets;
canonical was not measured at these poses):

| View | Draws | Triangles (M) |
| --- | ---: | ---: |
| `lane_mid` | 345 | 5.872 |
| `green_back_sw` | 566 | 8.820 |
| `lookout_west` | 573 | 8.804 |
| `deck_back_west` | 551 | 8.597 |
| `small_door` | 552 | 7.793 |
| `small_door_back` | 479 | 7.735 |
| `lookout_east_run` | 190 | 2.843 |
| `lookout_west_run` | 580 | 8.513 |
| `x_tall_up60` | 215 | 3.189 |
| `x_small_down35` | 404 | 6.244 |
| `x_deck_down35` | 233 | 3.764 |

### Hero frames (canonical `2b15f687` against the branch `5dc77784`, same shot list)

| Hero | SSIM | Pixels changed (> 8/255) | Box of changed pixels (960 × 540) |
| --- | ---: | ---: | --- |
| A stairs | 0.9883 | 0.94 % | x 578–957, y 0–170 |
| B house | 0.9934 | 0.53 % | x 766–959, y 0–97 |
| C lookback | 0.9999 | 0.01 % | x 335–959, y 48–140 |
| D log | 1 | 0 % | — |
| E ground | 0.9934 | 0.53 % | x 766–959, y 0–97 |
| F canopy | 0.9931 | 1.17 % | x 85–851, y 0–178 |

Every changed pixel, faint or not, lies in the top 211 rows: canopy leaves and flowers above and beside the
stair head, where the lane clears its path. The lane's own meshes draw nothing at A–F (no east tier in view);
the draws match canonical's (F one fewer) with 2–45 k fewer triangles, and D is byte-identical.

### Walk routes (`playtest.mjs --only walk`, real held keys at a fixed 1/30 s step)

| Route | Waypoints | Stuck | Length | Camera accel max (m/s²) → second difference | Spikes over 100 m/s² | Camera over ground, min | Sole gap p50 / p95 / max (cm) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `plaza-to-upper-house` | 6 / 6 | 0 | 27.2 m | 85.97 → 0.096 m | none | 1.213 m | 0.33 / 3.51 / 12.49 |
| `plaza-to-south-bank-top` | 4 / 4 | 0 | 14.8 m | 73.1 → 0.081 m | none | 0.599 m | 1.96 / 6.51 / 9.35 |
| `saria-front-arc` | 3 / 3 | 0 | 5.3 m | 72.94 → 0.081 m | none | 1.483 m | 4.51 / 57.18 / 95.49 |
| `west-deck` | 3 / 3 | 0 | 6.1 m | 73.12 → 0.081 m | none | 1.969 m | 1.89 / 4.49 / 11.13 |
| `plaza-loop` | 4 / 4 | 0 | 26.9 m | 77.06 → 0.086 m | none | 0.3 m | 0.30 / 2.29 / 6.10 |
| `south-approach` | 2 / 2 | 0 | 13.9 m | 72.94 → 0.081 m | none | 1.687 m | 0.18 / 0.84 / 1.94 |
| `house-west-to-saria-door` | 5 / 5 | 0 | 8.8 m | 73.1 → 0.081 m | none | 1.349 m | 0.22 / 9.94 / 12.33 |
| `west-house-to-plaza` | 5 / 5 | 0 | 20.4 m | 632.37 → 0.703 m | 632.4 (0.042 m), 408 (0.744 m), 100.7 (0.188 m) | 0.331 m | 1.65 / 4.42 / 7.26 |
| `north-clearing-ledge` | 15 / 15 | 0 | 82.1 m | 136.3 → 0.151 m | 136.3 (0.186 m), 135 (0.041 m), 122.5 (0.129 m), 120 (0.039 m) | 1.524 m | 0.40 / 2.60 / 22.17 |
| `south-bridge-to-log` | 21 / 21 | 0 | 51.7 m | 72.94 → 0.081 m | none | 1.372 m | 0.24 / 2.13 / 3.00 |
| `stairs-to-east-lookout` | 20 / 20 | 0 | 59.6 m | 73.24 → 0.081 m | none | 1.311 m | 0.24 / 2.48 / 23.60 |
| `east-tall-deck` | 8 / 8 | 0 | 14.7 m | 124.09 → 0.138 m | 124.1 (0.038 m) | 1.633 m | 0.41 / 2.40 / 6.65 |
| `east-small-door` | 5 / 5 | 0 | 7.5 m | 88.07 → 0.098 m | none | 1.537 m | 0.69 / 2.96 / 3.00 |
| `north-grove` | 28 / 28 | 0 | 61.7 m | 100.04 → 0.111 m | 100 (0.168 m) | 1.519 m | 0.29 / 3.88 / 6.46 |

The lane's three routes are `stairs-to-east-lookout`, `east-tall-deck` and `east-small-door`. Every route
reaches every waypoint and none sticks. The numbers repeat those of the run on `67017696` exactly, as do the
play probe's pushes and camera walks. Before the flight fix, `east-tall-deck` stuck once at the steps' top and
skipped the far end (10.7 m walked, sole gap 32.65 cm). `stairs-to-east-lookout`'s 23.6 cm sole gap is on
canonical's main flight: the same walk from the stair head (the play probe, below) never exceeds 3.3 cm. The
lane's edge probes (`eastProbes`) pass 69 of 69.

### Play probe (`tools/play-probe.mjs`)

- Wall pushes (28): every push at a rope, stump or run stops 0.25 m short, and the largest height drop of any
  push is 0.24 m. Pushes along the rope and at a slant end against the rope, at (47.73, 8.45) and
  (48.06, 8.45). The east run's corner push ends at (50.71, 7.63) and the west run's pushes at (39.2, 8.26),
  on the small house's pad. The deck railing push stops on the strip's outer edge at (48.54, 2.54), and the far-end
  push at (49.98, 2.14).
- Footsteps by surface (live audio, one entry per step). From the stair head to the green: stone 41, grass 10,
  and dirt 2 on the forest floor under the first trees, with stance sole gaps p95 2.7 cm and max 3.3 cm. The deck
  walk plays wood on every step on the flight and the strip (15 of 15) and nowhere else, and stone, grass and dirt
  on the green at either end. Its sole gaps are p95 2.6 cm and max 3.8 cm, on the flight. The lawn off the discs
  plays grass 6 of 6. Each tally differs by one step from the run on `67017696` while the walk repeats exactly
  (the same stance-foot samples): the audio schedules its steps on the audio context's real-time clock, not on
  the frame step.
- Follow camera through the two turn-arounds. On the deck, 372 frames: largest second difference 0.138 m, at
  the far-end turn; largest frame step 0.252 m; closest to the tall trunk 0.29 m; lowest over the walked ground
  0.51 m. At the small house's doorstep, 192 frames: second difference 0.098 m, frame step 0.345 m (a fast,
  smooth swing, camera speed up to 10.3 m/s), trunk clearance 1.46 m. Frames at the turn and 12 and 24
  frames on are sheet 5.

## The 50 checks (`docs/RUBRIC_50_STRUCTURES.md`)

Scored for the lane as one area (the three houses, the deck, the lookout, the lane and its props), at player
height, from the merged build's captures and play-mode probes. Sheets are the JPGs in this folder.

**Total: 173 / 200.** No check is below 2. Check 19 (damage) scores 2 and is the only one under 3. The starred
checks 1, 6, 11, 16, 21, 31, 36, 41 and 46 score 4, 3, 3, 3, 3, 4, 3, 4 and 3.

| # | Check | Score | Evidence |
| --- | --- | :---: | --- |
| 1 ★ | Reads as what it is from 20 m | 4 | From 15–30 m the three houses read as Kokiri trunk houses with mossy domes and lit doors, and the lookout as a fenced lip with a bench (sheet 1 `lane_bend`, `lookout_back`; sheet 2 `green_back_sw`). |
| 2 | Kokiri proportions | 3 | The shared builder's doors; the small house's arch hangs 1.5–1.6 m over its doorstep, and Link (1.25 m) at the doorstep and on the deck looks right (sheet 5). The shop's counter was not checked against Link side by side. |
| 3 | Irregular, hand-built outline | 4 | Lumpy moss domes, flared roots and arch roots, log posts, sawn stumps and sagging ropes; no clean box, cylinder or straight ridge in any silhouette (sheets 1–3). |
| 4 | Varies from its siblings with purpose | 4 | Shop: wide stump, counter window, awning, carved sign. Tall house: the tallest dome (7.6 m), side deck, ladder. Small house: 4.1 m dome, round window, flower boxes, doorstep. |
| 5 | Holds up from 60° below and 35° above | 3 | `x_tall_up60`, `x_small_down35`, `x_deck_down35` (sheet 3): no holes, missing undersides or open shells. The view up the tall house is mostly trunk and near leaf cards: it holds up but does not show off. |
| 6 ★ | Every part visibly held | 3 | Boards on joists on beams on six posts sunk 0.3 m, rails on posts, lashed ladder rungs, the sign hung from its post, ropes wrapped round posts and stumps, pods on the builder's hangers (sheets 2, 3). The awning's brackets were not checked at 2 m. |
| 7 | Joints meet | 3 | No gap, floating plank or z-fighting in any capture; the deck's posts sink 0.3 m by design. On the deck walk Link's stance feet stay within 2.6 cm of the treads and planks 95 % of the time (3.8 cm at most). |
| 8 | Load paths make sense | 4 | Boards → joists → beams → posts → ground; steps on two stringers; the ladder footed on the ground (sheet 2 `tall_deck`, sheet 3 `x_deck_down35`). |
| 9 | Trim and edges finished | 3 | Rim board, top and mid rails, the counter window's sill, head and shutter boards, the moss overhang at every dome rim. |
| 10 | Small construction detail at 2–5 m | 3 | Grained boards with seams, rope wraps on the posts and stumps (sheet 3 `lookout_east_run`), lashed ladder rungs. No nail heads or knots. |
| 11 ★ | Wood as wood, bark as bark, stone as stone | 3 | The deck's boards carry grain along their length (`woodGrain`), the trunks the village's bark, the discs stone (sheets 1–3). End grain on the stumps' sawn tops is not visible from walking height. |
| 12 | Texel density matches the neighbours | 3 | The builder's bark, moss and wood at the village houses' tiling; nothing blurry next to something sharp in the sheets. |
| 13 | Colour and value in the village's palette | 4 | Warm browns and moss greens, warm orange and soft lime pods; no pixel in any of the lane's views has every channel over 235 (clipped-whites scan). |
| 14 | Believable roughness and sheen | 3 | Matte wood and bark, soft moss (shared materials). The lane has no wet stone to judge. |
| 15 | No stretching, seams or tiling at 3–10 m | 3 | None seen on the boards, trunks or discs (sheets 1–3). |
| 16 ★ | Weathering follows exposure | 3 | The builder's moss caps, trunk tufts and lichen, darker toward the roots. The moss is not biased to the shaded side beyond what the builder does. |
| 17 | Wear follows use | 3 | Stepping-stone spurs to every door, the builder's worn thresholds. The rails are not polished where hands go. |
| 18 | Signs of life, placed | 4 | Pots and fruit on the counter, a crate stack, a basket stand, an open crate, a fruit basket, two flower boxes of 16 flowers, the bench, the carved sign (sheet 1 `shop_door`). |
| 19 | Damage plausible and sparse | 2 | None: no missing plank, split post or patch. Acceptable, not dressed. |
| 20 | Nothing brand-new | 3 | Weathered shared textures and moss everywhere; the deck's boards read a little clean. |
| 21 ★ | Sits in the terrain | 3 | Trunks rise out of flared roots, the deck's posts sink 0.3 m, the discs lie with the grade, the houses sit on flattened pads (sheets 1–3). No trampled ring at the doors beyond the spurs' discs. |
| 22 | No floating corners, nothing buried through | 3 | Every lane and spur sample has 0.5 m of clear, even ground (gradient ≤ 0.25) and every buttress foot clears the paths and steps (section 7 of `expansion2.test.mjs`); none seen in the sheets. |
| 23 | Contact shadow / AO at the ground | 3 | The houses' casters and shadow proxies, the post's AO, a soft pool under each pod (sheets 1–3). |
| 24 | Vegetation grows round it | 3 | Grass and ferns to the footprints and between the discs, none through the deck or the discs (the vegetation's expansion cull includes `EAST_BOX`). |
| 25 | Paths lead to its door | 4 | The lane leaves the stair head on the walk network and a spur runs to every door (route `stairs-to-east-lookout`, `east-small-door`). |
| 26 | Openings recessed with frames | 4 | The builder's recessed round-topped doors in frames, the counter window with sill, head and shutters, the small house's round window (sheet 1 `shop_door`). |
| 27 | Interiors dark or lit with depth | 4 | A lit room behind every door: shelves, pots, hanging pods, a table (sheet 1 `shop_door`). |
| 28 | Openings face where people come from | 4 | Every door faces the lane (shop −53°, tall −84°, small 200°); the counter window faces the lane where it leaves the trees. |
| 29 | Round Kokiri doors and windows | 4 | Round-topped doors like the village's and the reference's; a round window on the small house. |
| 30 | Curtains, shutters or hanging leaves | 3 | Five shutter boards on the counter window; vines and leaves on the arches (the builder's). No curtains. |
| 31 ★ | Soft, organic roof edges | 4 | Lumpy moss domes with tufted rims, no hard polygon rim (sheets 1–3, `x_small_down35`). |
| 32 | Eaves overhang and shade the walls | 3 | The domes overhang the trunks and shade their tops; the tall house's deck sits in its dome's shade (sheet 2). |
| 33 | Thickness at every edge | 4 | Domes, boards, rails, posts and steps all have thickness; no zero-thickness shell in the up and down views. |
| 34 | Tops carry growth | 4 | Moss caps with fine and coarse tufts (`882070d8`) and small plants on every dome (`x_small_down35`). |
| 35 | Roof line ties to its tree | 4 | The houses are the trees: each dome caps its own trunk. |
| 36 ★ | Pods glow warm and steady, each hung | 3 | 16 emissive pods on the builder's hangers and two lantern posts, no flicker (sheets 1–3). |
| 37 | Light pools restrained and soft | 3 | One soft ground pool per dropped pod light (`buildLightPools`). |
| 38 | No clipped whites | 4 | No pixel with every channel over 235 in any of the lane's views or heroes, glows included: 0 in each of the 23 views (brightest (247, 242, 231), in F) and 0 in the six turn frames of sheet 5 (brightest (247, 242, 233), the fairy's glow at arm's length). |
| 39 | Reads in light shafts and in shade | 3 | The houses read in sun patches and in shade (sheet 1 `lane_bend`, sheet 2 `green_back_sw`). |
| 40 | No new real-time light | 4 | The builder's 14 pod point lights are dropped (audit `pointLightsDropped: 14`): the light count and every shader stay the same. |
| 41 ★ | Walks every intended surface; a route proves it | 4 | On the merged build, `stairs-to-east-lookout` reaches 20 of 20 waypoints, `east-tall-deck` 8 of 8 (up the flight, along the strip to the ladder end and back down) and `east-small-door` 5 of 5, none stuck. Section 7 floods the deck and walks the flight across its whole width by the movement rule. The dead end at the flight's top is fixed (`32f852ed`). |
| 42 | Walls, rails and edges block him | 4 | `eastProbes` 69 of 69: rails, rope, runs, stumps and trunks blocked; strip, steps and lane open. Every one of the 28 wall pushes stops 0.25 m short of a rope or stump; the railing push ends on the strip's edge. |
| 43 | Walkable rise, even underfoot | 4 | The flight is 6 rises of 0.21 m, well under the 0.55 m step guard. Stance sole gaps on the lane are p95 2.7 cm, max 3.3 cm; on the deck walk p95 2.6 cm, max 3.8 cm. |
| 44 | Camera never inside, never pops over 0.3 m | 3 | The largest second difference in the turn-around walks is 0.138 m and the closest the camera comes to a trunk is 0.29 m. None of the lane's routes has a spike but the deck's one (124 m/s², 0.14 m, no collision). At the deck's far-end turn the new camera passes close by the hanging pod (known issues). |
| 45 | Footsteps play the right surface | 4 | Wood on all 15 steps on the flight and strip, none off them. On the lane, stone on the discs (41) and grass or dirt between them (10, and 2 on the forest floor under the first trees). Grass on the lawn (6 of 6). All counted from the live audio's own step counter. |
| 46 ★ | Every hero view and its own views ≤ 9.0 M / 700 | 3 | On `5dc77784` the heroes draw 484–575 calls and 7.72–8.60 M triangles, the six lane views 286–577 and 3.34–8.83 M; the 11 other lane views (on `67017696`, upper bounds) 190–580 and 2.84–8.82 M. All pass, but `tall_deck` has 1.9 % of the triangle budget left, `green_back_sw` 2.0 % and `lookout_west` 2.2 %. |
| 47 | Hidden when far or off-screen | 4 | At A–F the lane draws nothing (east tiers "none" at every hero); its tiers draw only in reach and in frame, its core buckets by house run. |
| 48 | Deterministic | 4 | Canonical's six hero frames, rendered in two sessions six hours apart (`7ecbd670`, `e438c6e5`), are byte-identical; D is pixel-identical between canonical and the branch; the lane draws only with `prng` forks. The six lane views rendered on `67017696` and, an hour later, on `5dc77784` are byte-identical (canonical's merge between them only culls shadow-pass triangles), and so are the deck's three turn frames from the two play probes. |
| 49 | Belongs to this forest | 4 | The shared house builder, the village's materials and scale; the lane's houses sit beside the upper house in `lookout_back` without a seam in style. |
| 50 | The owner would stop and look | 3 | The shop's counter with its pots and fruit under the awning, the carved sign, the deck with its ladder, the bench looking back over the lane. |

## Known issues

- Hero frames change a little where the stair head shows. A changes 0.94 % of its pixels by more than 8/255,
  B and E 0.53 %, F 1.17 % and C 0.01 %; D is byte-identical. All of it is canopy leaves and flowers in the top
  211 rows, above and beside the stair head, where the lane clears trees, understory and flowers from its path
  (sheet 4).
- The deck's far-end turn, with canonical's new movement and camera (#165: walk 1.2 m/s, run 2.2 m/s). As
  Link turns back, the follow camera swings round him under the dome's eave. It passes the tall house's
  hanging pod close enough for the pod to fill the left fifth of the frame (sheet 5, `deck turn +24`), and comes
  0.29 m from the trunk. With the old movement it kept 0.92 m from the trunk and about 1.5 m from the pod.
  Pods are slim parts to the camera (`structures/cameraSolids.ts`): it never stands inside one, but it may pass
  close by. The same turn gives the lane's only camera spike: 124 m/s², a 0.038 m frame step and a 0.14 m
  second difference, under the rubric's 0.3 m, with no collision event (hit none, lift 0, lowered 0).
- Headroom. `tall_deck` has 1.9 % of the triangle budget left (8.827 M), `green_back_sw` 2.0 % and
  `lookout_west` 2.2 % (8.820 M and 8.804 M on `67017696`, upper bounds). Canonical's own camera at the
  `tall_deck` pose is already over (9.410 M on `2b15f687`), so anything added to the village's look-back from
  the plateau eats this margin first.
- Canonical's routes, not the lane's, carry the new legs' worst numbers: `saria-front-arc` sole gap 95 cm,
  `west-house-to-plaza` a 632 m/s² camera spike (0.70 m second difference), `north-clearing-ledge` 136 m/s².
  The 23.6 cm sole gap on `stairs-to-east-lookout` is on the main flight. Reported for the owner; nothing in
  the lane touches them.
- Three measurement poses stand inside solids: `green_wide` in the tall trunk's root flare, `small_door_back`
  in the small house's trunk and `lane_mid` in a bush. They are fixed capture poses, not the play camera.
  They count toward the budget table but are left out of the sheets.
- `vegetation/expansion.ts` is codex's directory. The lane touches two lines there, so that
  `tileMeetsExpansion` includes `EAST_BOX` and grass is not grown through the discs and the deck.
- The houses cannot be entered and the lane has no NPCs, like the rest of the village. There is no damage
  anywhere (check 19 scores 2): no missing plank, split post or patch.
- The flight moved 0.21 m toward the trunk in `32f852ed`. Every frame and number here is from after the move.
  Older sheets and tables are superseded.

## Sheets

- `1-stairhead-and-lane.jpg`: `stairhead_lane`, `lane_bend`, `shop_door`, `lookout_back` (on `5dc77784`).
- `2-shop-and-houses.jpg`: `tall_deck` (on `5dc77784`), then `deck_back_west`, `small_door` and `green_back_sw`
  (on `67017696`).
- `3-green-and-lookout.jpg`: `lookout_west`, `lookout_west_run`, `lookout_east_run` and the up and down views
  `x_tall_up60`, `x_small_down35`, `x_deck_down35` (on `67017696`).
- `4-hero-diffs.jpg`: the heroes A–F, canonical `2b15f687` | branch `5dc77784` | difference × 4.
- `5-turnarounds.jpg`: the follow camera at the deck's far-end turn and at the small house's doorstep, at the
  turn and 12 and 24 frames on (play probe on `5dc77784`).

Each view panel is labelled with its draws and triangles. `green_wide`, `small_door_back` and `lane_mid` stand
inside solids and are left out (known issues).

## How it was tested (headless Chrome + SwiftShader on the Cloud VM)

- `npx tsc --noEmit` and every `*.test.mjs` outside `dist/` and `node_modules/` (`node --test`), on each merge
  and on the head. Section 7 of `src/world/terrain/expansion2.test.mjs` holds the lane's walkability and cost
  assertions; `src/audio/surfaces.test.mjs` the deck's wood.
- The scripts in `tools/` (run from the repo root on a `npx vite build` dist; on the shared VM each Chrome
  launch went through `/tmp/treebase23/capslot.sh`, the two-slot capture lock):
  - `node art/environment/exp-east-2026-09-23/tools/views.mjs --dist <dist> --out <dir> [--only a,b] [--poses art/environment/exp-east-2026-09-23/tools/poses-updown.json]`:
    draw calls and triangles (`renderer.info`, colour, shadow and post passes) after `setTime(12.5)` and 6
    settle frames at 1/30 s, 960 × 540, plus a screenshot, at the heroes A–F and the lane's walking views. The
    walking views stand the camera 4.3 m behind a walker's aim point, 1.75 m over the ground (the deck's top on
    the deck), looking at the next lane node; `poses-updown.json` adds a camera 0.5 m over the ground looking
    60° up at the tall house and the follow camera's orbit 35° above the small house and the deck. These are
    fixed poses, not the play camera: `green_wide` stands inside the tall trunk's root flare, `small_door_back`
    inside the small house's trunk and `lane_mid` in a bush, so they count the cost from those points but are
    left out of the sheets.
  - `node gauntlet/scripts/playtest.mjs --dist <dist> --out <dir> --only walk`: every walk route, with real
    held keys at a fixed 1/30 s step (waypoints, stuck frames, camera speed and acceleration, the feet), and
    the lane's 69 edge probes (`eastProbes`).
  - `node art/environment/exp-east-2026-09-23/tools/play-probe.mjs --dist <dist> --out <dir>`: the same play
    page; 28 wall pushes (Link placed a few metres off a rope, stump, rail or post and steered at it with held
    keys for 6 s, closest approach and height drop recorded), footsteps by surface along three walks (live
    audio, `__ZR_AUDIO__.stats()` per step), and the follow camera through the two turn-arounds (per-frame
    jump and second difference, clearance to the trunks, frames rendered at the turn and 12 and 24 frames on).
  - `node art/environment/exp-east-2026-09-23/tools/attrib.mjs --dist <dist> --out <dir> --poses a,b --ab FLAG,...`:
    a pose rendered, rendered again (control), then with each `window` switch set, and the pixel differences.
  - `node art/environment/exp-east-2026-09-23/tools/evidence.mjs --base <dir> --branch <dir> --out <dir> --sheets ...`:
    hero diffs (SSIM, share of pixels changed by more than 8/255, their box) and the sheets;
    `tools/final-report.mjs` turns the outputs into the tables above.
