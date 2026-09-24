# East plateau lane (exp-east), 2026-09-23/24

The owner asked on 2026-09-23 at 20:08 UTC: *"why for the love of God has there been no expansion to the
environment past the stuff"*. The flat ground at the top of the main stairway, about 5.2–5.9 m up and east
of the upper house, is now a walkable Kokiri lane. You find it when you reach the top of the stairs.

Branch `agent/fable-cursor-exp-east`, based on `746f1d39`. Everything is authored in `src/world/layout.ts`
(`EXPANSION_EAST`, `EAST_BOX`, `eastDeckPlan()`, `eastHouseBlocks()`) and built by
`src/world/structures/east.ts`. Culling by distance and frustum lives in `src/world/util/eastLane.ts`.

## What is there (world XZ in metres, ground height from the heightfield)

| Piece | Where | Detail |
| --- | --- | --- |
| Stepping-stone lane | 17 nodes, from the stair head (17.6, −7.35) to the lookout (47.2, 7.25) | 50 discs (radius 0.40–0.47 m, 1 m apart) laid on the natural ground. Its first 14 m thread the trees at camera A's right edge at least 1.8 m from each trunk; it swings round the shop's door at least 5.3 m from its trunk's axis. |
| Spurs | upper house ladder (17.6, −7.35) → (16.05, −14.55); tall house door (42.6, −0.3) → (44.3, −1.1); small house door (38.27, −1.52) → (35.96, 2.14) | |
| Shop | trunk (40.0, −7.0), radius 3.0, dome 5.3 m high, door facing bearing −53° (toward the lane) | Counter window 1.02 rad right of the door (sill 0.92 m, head 1.72 m) with 5 shutter boards, a plank awning, and pots and fruit on the counter. A hanging sign with an original carved glyph (27 strokes) hangs from a post at (35.7, −6.95). A crate stack and a basket stand beyond the sign, an open crate and a fruit basket past the counter. 2 door pods. |
| Tall ("bossy kid") house | trunk (48.6, −1.6), radius 3.0, dome 7.6 m (the tallest), door facing −84° | Side deck on the south face: planks at 6.86 m (1.15 m above the door floor). A railed walk strip runs (47.25, 2.19) → (49.92, 2.10), 0.8 m wide and 0.25 m inside the outer and far railings, and 5 plank steps climb from (45.59, 2.45) to (47.33, 2.40). 6 posts, 8 boards, and a 5-rung ladder at the far end, footed at (50.78, 2.28). |
| Small cosy house | trunk (37.2, 6.0), radius 2.1, low dome 4.1 m, door facing 200° (toward the lane) | Round window, two flower boxes with 16 flowers each, 1 door pod. A doorstep block stops Link at the threshold, because the arch hangs only 1.5–1.6 m over it. |
| Pod lantern posts | (41.2, 0.4) orange, 1.95 m; (46.4, 6.55) lime, 1.8 m | Emissive pods. |
| Lookout | rope fence on the south lip, 5 posts from (45.3, 8.85) to (50.3, 8.55); log bench at (48.3, 7.55), yaw −132°, 1.9 m long | The bench faces back over the lane. The fence stops Link 0.25 m short of its rope. |

The doors are dark recessed openings with a lit room behind (shelves, pots, hanging pods, a table). They
cannot be entered, like the rest of the village. All three houses use the shared house builder
(`structures/house.ts`). It gained an opt-in `rightFoot`, so the entrance arch's right root lands next to the
door instead of sweeping 5.5 k out over flat ground. Houses that don't set it build unchanged.

The 16 new pods glow through emissive material only. The builder's 14 pod point lights are dropped (audit
`pointLightsDropped: 14`), so the scene's light count, and therefore every shader, stays the same.

Trees, vegetation and rocks are cleared from the footprints and the lane in the *live* terrain view only
(heightfield `eastLaneCull` / the `expansionCull` east flag). The mid grove's card crowns are kept 11 m off the
lane, the same rule the plaza's walk lines use. The legacy streams keep their counts, so no other instance
moves.

## Walkability

- Character ground (the live mask plus `ctx.shared.walkSurfaces`): the discs are walkable. These are walls:
  the trunks (at 1.1 R), both arch buttress feet of every house, the small house's doorstep, the sign post, both
  lantern posts, the bench, the deck railings and the lookout's rope fence. The deck and its steps are walk surfaces (`east-tall-deck`,
  `east-tall-steps`). Section 7 of `src/world/terrain/expansion2.test.mjs` asserts all of this. It also
  checks 0.5 m of clear ground round every lane and spur sample, gradients up to 0.25, every buttress foot
  clear of the paths and the deck steps, and that every door step is open.
- The deck's skirt (`697e251a`): Link's feet predict the next foothold up to about 0.86 m ahead. Turning at
  the deck's far end, that spot fell past the 1 m walk strip onto the ground 1.2 m below, and the hips dropped
  0.93 m, putting both soles 16.6 cm into the planks. `WalkSurface.deck` now takes an optional
  `skirt: { side, end }`. Ground heights read the deck's top 0.9 m round the strip, and `blocked()` closes
  that band, so no walk and no jump can stand Link on the air beside the deck. Side effect: at ground level
  Link now stops 0.60 m outside the planks' outer edge (0.16 m before the skirt) and 0.66 m past their far
  end (0.2–0.7 m before). That takes 2.2 m² of ground he could reach before (with the narrower strip of the
  next bullet). The test asserts that the skirt opens nothing and only closes air over the ground. It also
  floods from the deck by the movement rule, down the steps to the ground, and never reaches the skirt.
- The deck's walk strip keeps off the railings (`c710389f`, `9a97df4b`). It was 1 m wide, and its outer edge
  ran 0.06 m from the outer railing's line, and its far end reached 4 cm past the far railing. Pushed
  against the railing, Link's chest and boots went through the boards. The strip is now 0.8 m wide
  (`tallDeck.walkHw` 0.4) and stops `tallDeck.railStop` = 0.25 m inside both railings. Its door end still
  starts over the steps' top, as before. The test asserts the quarter metre (it fails at 0.05). A walker
  coming up the steps along their outer edge stops at the top, where the railing's first post stands, and
  steers inward.
- The lookout's rope fence (`0c7bcaed`). The lip behind it falls 5 m in 6 m, and Link used to walk straight
  through the rope and down it. The character ground now stops him 0.25 m short of the rope. This is
  `lookoutFenceBlocked` in `character/ground.ts`, not a structure pad, so the grass under the rope stays and
  nothing drawn changes. The test asserts the rope line and 0.2 m in front of it are walls, and half a metre
  in is open ground (except where the bench stands).
- Play camera: the camera's collision treats an entrance arch's right side (jamb leg, shoulder knot, buttress)
  as a solid shell. The lane therefore passes the shop's door at least 5.3 m from its axis, and the deck is
  turned to 1.5 rad so its steps start 1.7 m right of the tall house's arch. The previous build (v10) passed
  closer, and the camera snapped from about 4 m to 0.6 m at both places.

## How it was tested (headless Chrome + SwiftShader on the Cloud VM)

- `npx tsc --noEmit`, `npx vite build`, and every `*.test.mjs` under `src/` and `gauntlet/` (39 files): pass
  at `9a97df4b`.
- Merge onto the canonical head `5cbe6ac8`, which carries `EXPANSION_SOUTH`, the owner-23:00 merges (stone
  hero flight, kids, near veil, tree LOD) and the 05:35 squad merges. The code at `9a97df4b` conflicts in 10
  files (34 hunks), every one a place where the east and south expansions add side by side: `layout.ts`,
  `heightfield.ts`, `character/ground.ts`, `hardscape/index.ts`, `hardscape/flagstones.ts`,
  `structures/index.ts`, `trees/index.ts`, `vegetation/expansion.ts`, `expansion2.test.mjs` and
  `playtest.mjs`. Resolved in a scratch worktree (not pushed), keeping both sides. The only non-mechanical
  choice: `expansionCull` keeps its `east` flag and passes it on to canonical's new `westExpansionCull`, and
  the white-barks and the understory keep east off, as on both branches. On the merge, `tsc`, `vite build`
  and `node --test src/world/*/*.test.mjs` (99 tests in 36 files) pass. The play-mode walk on the merge
  completes every route with nothing stuck and no page errors: `stairs-to-east-lookout` 20/20 (59.5 m),
  `east-tall-deck` 8/8, `east-small-door` 5/5, canonical's `south-bridge-to-log` 21/21 (51.7 m) and
  `plaza-to-upper-house` 6/6. The deck, doorstep and plaza routes' camera numbers are identical to this
  branch's. On `stairs-to-east-lookout` the camera's p95 is 3.45 m/s (3.56 here), because canonical rebuilt
  the main flight, and the door spur's pulls are 0.43, 0.55 and 0.32 m. The merge onto the previous head
  `03e1127a` gave the same numbers.
- Wall pushes: a scratch probe (not committed) opens the same play page, places Link a few metres from each
  solid, and holds the keys that steer him straight at it for 180 frames (6 s) at the same fixed 1/30 s step.
  It records his closest approach, where he ends up, and the ground height there.
- Play-mode walk: `node gauntlet/scripts/playtest.mjs --dist <dist> --out <dir> --only walk --walk-routes
  stairs-to-east-lookout,east-tall-deck,east-small-door,plaza-to-upper-house`. It feeds real held keys at a
  fixed 1/30 s step.
- Renders: `node gauntlet/scripts/broll.mjs --size 960x540 --test --settle 6 --shots <list>` on the base build
  and on this branch, from identical poses. broll's uniform-frame retries shift later shots' time, so each
  hero comparison uses the identical 5-shot list on both builds.
- Perf: draw calls and triangles (`renderer.info`, colour and shadow passes) after 6 settle frames at each
  pose, on both builds, and again on canonical `5cbe6ac8` and the scratch merge.

## Results

### Play-mode walk (builds `38e1cd13`, `697e251a`, `0c7bcaed`, `c710389f` and `9a97df4b`: identical numbers)

| Route | Waypoints | Stuck | Length | Camera speed p95 / max | Camera pulls over 0.3 m in one frame |
| --- | --- | --- | --- | --- | --- |
| `stairs-to-east-lookout` (plaza → main stairs → lane → lookout bench) | 20 / 20 | 0 | 59.5 m | 3.56 / 16.5 m/s | 0.45 m and 0.55 m (keep 0.92 / 0.76) by the tall house's door spur |
| `east-tall-deck` (lane → steps → deck → far end → back) | 8 / 8 | 0 | 15.2 m | 4.06 / 47.3 m/s | 1.28, 1.58, 0.64 m while Link turns round at the deck's far end (the trunk comes between Link and the camera as it swings) |
| `east-small-door` (lane → doorstep → back) | 5 / 5 | 0 | 7.5 m | 12.8 / 56.9 m/s | 1.90 and 0.71 m while the camera swings round after the doorstep turn-around |
| `plaza-to-upper-house` (control, unchanged) | 6 / 6 | 0 | 27.3 m | 3.37 / 12.3 m/s | none (one 0.41 m step with no hit, identical to the base build) |

No page errors. The v10 build had 3.92 m and 3.79 m camera snaps (117 and 114 m/s) at the shop and on the deck
steps; both are gone. The walk traces never enter a solid: the closest approaches are 0.85 m outside the
lookout's lantern post, 0.94 m outside the shop's right buttress foot, 0.88 m outside the tall trunk (on the
deck) and 0.65 m outside the small house's doorstep block.

Feet on the deck: the playtest runs the routes plaza first. Run with the lane first, the gait reached the
deck's far end in another phase, and one frame there (38e1cd13) had both soles 16.6 cm inside the planks
(hips dropped 0.93 m, leg reach-clamped, Link at (49.25, 6.86, 2.41) facing the railing). With the skirt
(697e251a), the same lane-first run has no such frame. The deck route's worst sole is 4.6 cm (was 16.6 cm),
and its lowest footprint corner is −3.75 cm on the ground by the green (was −16.6 cm on the planks). The lane
route's numbers are unchanged. `9a97df4b` gives the same numbers to the millimetre (deck route sole gap
p50 / p95 / max 0.29 / 2.07 / 4.56 cm). `c710389f` had moved the strip's door end 8 cm up the steps, which
spread the deck route's gaps (p95 2.61 cm, max unchanged), and `9a97df4b` put it back.

### Play-mode wall pushes

A scratch probe steers Link with held keys straight at each solid for 6 s, from a few metres off, and
records the closest approach. Before: `697e251a`. After: `9a97df4b` (and the same on `0c7bcaed` for the
fence, and on `c710389f`). No page errors on either build.

| Push | Before | After |
| --- | --- | --- |
| Lookout fence, head-on from the bench side | walked through, ended 1.62 m past the rope and 1.2 m down the lip | stops 0.25 m short of the rope, on the lookout (5.49 m) |
| Lookout fence, diagonally at its east end post | walked on past the post, 1.74 m beyond the fence's line, 0.9 m down | stops 0.25 m from the post |
| Lookout fence, east run | walked through, 2.00 m past, 1.6 m down | stops 0.25 m short |
| Shop's doorway, straight at the trunk's axis | stops 4.10 m from the axis (the pad's edge, past the 4.05 m root flare) | same |
| Tall trunk, from its door spur | stops 4.11 m from the axis | same |
| Small house's doorstep, from the spur's end | stops at the doorstep block (0.90 m from its centre) | same |
| Deck railing, from the strip's middle | stops 0.06 m from the railing's line, on the planks (6.86 m) | stops 0.26 m from it, on the planks |
| Deck far end, along the strip | stops 0.02–0.04 m from the far railing's line | stops 0.25 m from it |
| Lookout bench, from the lane's end | stops 0.48 m from its centre (the seat's box) | same |
| Green lantern post | stops 0.21 m from its centre | same |

On the merged build (canonical `5cbe6ac8`, see the merge check), the pushes give the same numbers with two
exceptions. Canonical's movement now slides along an edge that Link meets at a slant (`SLIDE_TURNS` in
`character/index.ts`, added for the south bank's rope bridge); head-on he still stops. So the diagonal push at
the fence's east end post slides round the post, 0.25 m from it, and on down the bank to (51.27, 4.29, 10.33),
1.2 m below the lookout. The bench push slides to 0.42 m from the bench's centre instead of 0.48 m. The other two
fence pushes, the deck, the trunks, the doorstep and the lantern post stop within a centimetre of the
branch's distances.

### Draw calls and triangles

Probed on build `38e1cd13` against the base `746f1d39`. `697e251a`, `0c7bcaed`, `c710389f` and `9a97df4b`
change only the character ground (the deck's skirt, the lookout fence, the deck's walk strip), not what is
drawn. Nothing but the character ground reads the east walk surfaces.

| pose | draws before | draws after | triangles before | triangles after | east tiers drawn |
| --- | ---: | ---: | ---: | ---: | --- |
| `A_stairs` | 693 | 693 | 8,924,998 | 8,905,122 | none |
| `B_house` | 680 | 678 | 8,053,948 | 8,031,257 | none |
| `C_lookback` | 521 | 521 | 6,576,350 | 6,574,635 | none |
| `D_log` | 553 | 553 | 8,249,695 | 8,242,024 | none |
| `F_canopy` | 642 | 686 | 7,679,615 | 8,741,302 | core, base, mid |
| `stairhead_lane` | 394 | 499 | 5,789,517 | 7,353,445 | core, base, mid, lane, near |
| `lane_bend` | 264 | 362 | 2,957,623 | 4,523,239 | core, base, mid, lane, near |
| `shop_door` | 334 | 401 | 3,466,458 | 4,932,547 | core, base, mid, lane, near |
| `green_wide` | 785 | 870 | 7,840,281 | 9,350,713 | core, base, mid, lane, near |
| `lookout_back` | 796 | 896 | 8,173,488 | 9,771,424 | core, base, mid, lane, near |
| `tall_deck` | 250 | 323 | 2,785,356 | 4,303,451 | core, base, mid, lane, near |

Budget: hero A ≤ 9.0 M triangles and ≤ ~700 draws. A is 693 draws and 8.905 M triangles (the base build: 693
and 8.925 M). F rises because its frustum takes in the plateau and the houses' domes clear the lip, so their
core and mid tiers draw there, shadow pass included. It stays under A's budget numbers. Two walking views on
the lane go past A's numbers: `green_wide` (870 draws, 9.35 M) and `lookout_back` (896 draws, 9.77 M). The base
build already drew 785 and 796 there, because both look back over the whole village. The lane adds about 100
draws and 1.5 M triangles to them.

The same probe on the canonical head `5cbe6ac8` and on the scratch merge of this branch onto it:

| pose | draws canonical | draws merged | triangles canonical | triangles merged |
| --- | ---: | ---: | ---: | ---: |
| `A_stairs` | 639 | 639 | 8,916,189 | 8,884,731 |
| `B_house` | 627 | 627 | 8,255,397 | 8,232,706 |
| `C_lookback` | 560 | 560 | 7,688,645 | 7,686,930 |
| `D_log` | 561 | 561 | 8,574,960 | 8,567,289 |
| `F_canopy` | 599 | 643 | 7,996,942 | 9,047,047 |
| `stairhead_lane` | 398 | 503 | 6,006,848 | 7,570,776 |
| `lane_bend` | 266 | 364 | 3,368,590 | 4,934,206 |
| `shop_door` | 336 | 403 | 3,533,976 | 5,000,065 |
| `green_wide` | 673 | 758 | 8,113,682 | 9,624,114 |
| `lookout_back` | 697 | 797 | 8,547,285 | 10,145,221 |
| `tall_deck` | 250 | 323 | 2,898,858 | 4,411,162 |

The lane adds the same amounts there. A keeps 639 draws and loses 31 k triangles, so it stays within its
budget. F gains 44 draws and 1.05 M triangles, and the lane views gain 67–105 draws and 1.5–1.6 M
triangles. Canonical already draws 0.32 M more triangles at F than this branch's base, so on the merge F
reaches 9.05 M, past A's triangle figure (the budget names only A). The houses' core, base and mid tiers
draw at F because the terrain does not hide them from there, yet nothing of them shows in the frame: F's
pixels change only where crowns were cleared.

### Hero frames (960×540, identical shot list, SSIM and share of pixels changed by more than 8/255; rendered on `38e1cd13`, later commits draw the same)

| Hero | SSIM | Pixels changed | Where |
| --- | --- | --- | --- |
| A | 0.9904 | 0.88 % | top right only (x 575–959, y 0–173): a mid-ground crown and trunk above the stair head give way to lighter background foliage |
| F | 0.9918 | 1.27 % | top band only (y 0–168): background crowns above the stair head, one small gap of light background |
| B | 0.9938 | 0.54 % | top-right corner only (x 765–959, y 0–97): the same crowns |
| C | 0.9997 | 0.03 % | scattered specks |
| D | 1.0000 | 0.00 % | unchanged |

Sheet 4 shows each hero before, after and |after − before| × 4.

## Known issues / not done

- Camera pulls on turn-arounds next to a trunk (the deck's far end, the small house's doorstep): the follow
  camera pulls in within one frame whenever a solid comes between Link and the camera, then eases back out.
  They are 1.3–1.9 m, against 3.8–3.9 m snaps before. Removing them would need the camera to ease in too.
  That is a `src/camera/` change and was not made here.
- `stairs-to-east-lookout` reports a footprint corner 0.31 m below the surface. It is on the main stairway
  (Link at (12.05, 3.24, −3.88), about the 12th step), before the lane starts. The sole itself is on the tread,
  and its toe corner reaches under the next tread's riser. It depends on the route order: the same climb reads
  −2.5 cm when the lane route runs first. This is the character's stair planting, not the lane's geometry.
  Canonical has since rebuilt that flight (26 shallow treads). On the merged build the same route's lowest
  corner is −6.3 cm.
- The two lane views over hero A's budget numbers (`green_wide`, `lookout_back`, see the perf tables) and, on
  the merge, F at 9.05 M triangles. At F the houses draw although nothing of them shows in the frame. A far
  tier for the houses, or a sight rule that knows what stands in front of them, would take that back.
  Neither was made here.
- A god-ray beam greys the oblique doorways (`02-shop-door`, `06-tall-deck`). It comes from the postfx screen
  fan at the walker's eye level, which on the plateau is about 7 m, above the 3–6.5 m band where the plaza's
  air is kept crisp. An attempt that raised that band with the ground under the camera (`d77b1334`) did not
  clear it in the renders and was reverted (`0d401924`).
- `src/world/vegetation/expansion.ts` (codex's directory) has a 2-line touch: `tileMeetsExpansion` includes
  `EAST_BOX`, so the vegetation's expansion cull reaches the lane.
- No other fence in the world stops the character. The character ground has no blocked sample on the lines
  of the plateau-lip fences at the stair head (`LAYOUT.fences`), the plaza-west and stair-bank rope fences
  (`ROPE_FENCES`) or the south bank's (`EXPANSION_ROPE_FENCES`). The lookout fence is the only one that stops
  him. Making the others solid is a structures / props change and was not made here.
- Past the lookout fence's two ends the lip is open, like the rest of the plateau's edge: a walker can go
  round either end and down the bank. Canonical's movement slides along an edge met at a slant, so after the
  merge a walker who presses along the rope at a slant slides to its end and round it, as the merged wall
  push shows. Closing the ends would need the fence to run on to something solid, such as a boulder or a
  trunk. That is a change to what is drawn, and it was not made here.
- The houses cannot be entered, and there are no NPCs on the lane.

## Sheets

- `1-stairhead-and-lane.jpg`: the stair head, the upper-house spur (a trunk used to block the ladder), the
  lane mid-way and the lane's bend past the shop.
- `2-shop-and-houses.jpg`: the shop's door, its front (the room through the doorway, the carved sign), the
  counter, the tall house's deck and steps, the small house.
- `3-green-and-lookout.jpg`: the green, the view back from behind the lookout fence, and an aerial.
- `4-hero-frames.jpg`: heroes A, F, B, C, D before, after and the difference × 4.
