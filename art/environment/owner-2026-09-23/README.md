# Owner review 2026-09-23 — staircase, bungalows & lanterns, upward view

Everything here was captured from running builds on this VM (Chrome + SwiftShader, 4 CPU cores,
no GPU). Before = `47773f13` (the build the owner played); after = the branch head recorded in
each run's `BASELINE_SHA` (final: `e48d5e8e` + evidence commits).

- `shots.json` — the 22 fixed free-camera poses used for every before / after pair
  (`gauntlet/scripts/broll.mjs --shots … --test --settle 6`, 960 × 540, character hidden).
- `compare/<pose>.jpg` — before | after for each pose (`gauntlet/scripts/compare-sheet.py`).
- `lighting/stairs-three-suns.jpg` — both staircases under the default sun, a low raking sun from
  the east and a dim sun (`gauntlet/scripts/probe-look.mjs`, runtime sun override).
- `play/` — play-mode captures from `gauntlet/scripts/playtest.mjs` (real key holds, mouse drags,
  an emulated gamepad; the follow camera as the player has it), before and after, and the
  measurement files `playtest-before.json` / `playtest-after.json`.
- Movement clips (look sweeps beside Saria's lanterns and at the plaza, the climb up the second
  staircase) are attached to the pull request.

## Diagnosis — verified vs suspected

**Second staircase (verified on renders and in code).** The stone treads come from the same builder
as the first staircase and already vary per tread; the repetition was the twenty log nosings.
Every log (1) was lifted to near-white by its tint (`LOG_TINT` [1.35, 1.5, 2.3]), so at play
distance it read as a silver birch pole against its shaded tread — twenty pale / dark stripes;
(2) mapped the bark with the map's fissures running *round* the log (rings across every step), from
the same start and roll; (3) wore the same paler crown and moss band; (4) had stake pairs at every
second riser like a fence. Geometry reuse and mirroring were not the cause (each log is built
per step); lighting only exposed the tint.

**Upward view — camera (verified, measured).** The follow camera's "pitch" only raised or lowered
the camera while it kept aiming at Link's chest: +13° at best (+3° at the upper house, where the
ground clamp caught it), the top of the frame never above 36°, and mouse / drag / right stick *up*
looked *down*. No sky pixel was visible from any of the ten test spots. Looking up at the top of
both flights put the near plane 10 cm from the stair stones (the camera clamped against the
heightfield, which is trenched 18 cm under the treads).

**Upward view — content (verified on renders).** In the village the canopy, limbs and eave
undersides were already there — the camera could not reach them. In the open ground north of the
log arch the distant tree ring's crowns (crossed vertical cards) smeared into streaks when seen
from below; a group-isolation probe confirmed the distant family alone produced them.

**Lanterns and huts (verified on renders).** Saria's pods were uniform glowing husks on bare cords;
the west house hung the village huts' distant-LOD pod (scale 2.8, flat unlit glow) right over its
window; its lanterns had no light; the huts' roofs ended in a thin moss sheet.

**Suspected, not proven here:** display-rate frame pacing (this VM has no GPU; SwiftShader timings
are CPU rasterisation, see Performance).

## What changed (passes)

1. **Baseline** — 20 poses + 2 later poses rendered from the frozen build; play-mode baseline with
   the new harness at ten spots (plaza, both staircases foot / middle / top, beside Saria's, the
   upper house, the west house deck, the open north).
2. **Second staircase** (`src/world/hardscape/logNosings.ts`) — timber tint to weathered grey-brown
   (chosen from a runtime sweep ×1.0 / 0.7 / 0.52 / 0.4 on the owner's pose); bark grain along each
   log, whole turns round it, its own offset / repeat / roll; butt-to-tip taper, slight bow, laid
   either way round; the boot-worn crown darker and smoother, soil in the crease, moss only where
   nobody steps and more on older logs; stakes where a builder needed them. Step dimensions,
   crowns and the support grid Link stands on are unchanged.
3. **Bungalows** (`src/world/structures/distantHouse.ts`) — every hut: a sill band broken at the
   door, a wall plate under the eave broken at the window, a window ledge, a bark eave roll under
   the moss edge (a thick roof lip), its own trim tone.
4. **Lanterns** (`lantern.ts`, `house.ts`, `distantHouse.ts`) — bent-wood ribs over the seams, a hoop
   round an open bottom, a band under the calyx, a flame in a clay wick cup on three spokes seen
   through the opening, the panels lined inside, an occasional replaced panel, soot toward the top;
   cords hang from pinned toggles (houses) or are tied round the door bough (west house). The west
   house hangs these crafted lanterns (sized to the hut) and gets a restrained 2.6 cd / 5 m light
   like Saria's; the far village's pods carry the frame's dark ribs and hoop in their glow mesh.
5. **Camera** (`src/camera/follow.ts`, `collision.ts`, `nearFade.ts`) — a real yaw / pitch orbit:
   the rest pose is exactly the reference's; down to 35°; above 6° the camera stops descending,
   draws in to 2.9 m and tilts in place to 60°. Up looks up (`?invertY=1` for the old direction);
   input smoothed; the pitch settles back to rest after 1.5 s of walking without look input.
   Collision: lifted over ground and flights, kept in front of the structures' solid shells and the
   big boles (voxelised at load, play only), lowered under low ceilings, never inside posts, pods,
   boughs, white-bark boles or props; cards within 0.2–0.7 m of the lens or inside a narrow cone
   in front of Link screen-door out.
6. **Upper view** (`src/world/trees/distant.ts`) — every distant crown has a floor card; vertical
   cards fade as the view climbs to them (25°–46°), so from below a crown is its leaf roof. The
   fixed hero frames see the far forest within 20° of level and are untouched.
7. **Whole world** — the play test's walk routes, climbs, interactions and resize / reload found no
   regressions; the one remaining weak spot found (heavy light-shaft veil at the upper house) is
   listed under Unfinished.
8. **Performance** — measured below.
9. **Rubric** — below.
10. **Regression** — `npm run build`, `npm run preview`, the final play test on the final build.

The measurement tables and the rubric follow.

## Measurements (play mode, same spots before / after)

From `play/playtest-before.json` (the pre-change build + the test hook only) and `play/playtest-after.json` (the final build), both taken with the same harness version; interactions and resize / reload from `play/playtest-interact-resize.json`.

### Camera look range per spot (degrees of view elevation; + is up)

| spot | before: rest / drag up / drag down | before: frame top max | after: rest / up / down | after: frame top max | after: nearest surface rest / up / down (m) | after: sky share looking up |
|---|---|---|---|---|---|---|
| plaza | -3.3 / -22.1 / 13.1 | 36.1 | -3.3 / 60.2 / -35.5 | 83.2 | 3.20 / 2.66 / 3.03 | 0.16 |
| stairs2-base | -3.3 / -22.1 / 13.1 | 36.1 | -3.3 / 60.2 / -35.5 | 83.2 | 2.86 / 5.19 / 4.18 | 0.09 |
| stairs2-mid | -3.3 / -22.1 / 13.1 | 36.1 | -3.3 / 60.2 / -35.5 | 83.2 | 4.01 / 7.07 / 4.36 | 0.11 |
| stairs2-top | -3.3 / -22.1 / 13.1 | 36.1 | -3.3 / 60.2 / -35.5 | 83.2 | 3.49 / 3.29 / 3.01 | 0.13 |
| stairs1-base | -3.3 / -22.1 / 11.4 | 34.4 | -3.3 / 60.2 / -35.5 | 83.2 | 3.28 / 4.28 / 3.08 | 0.15 |
| stairs1-top | -3.3 / -22.1 / 13.1 | 36.1 | -3.3 / 60.2 / -35.5 | 83.2 | 3.46 / 6.88 / 4.39 | 0.06 |
| saria-side | -3.3 / -22.1 / 13.1 | 36.1 | -3.3 / 60.2 / -35.5 | 83.2 | 3.45 / 6.34 / 4.21 | 0.12 |
| upper-house | -3.3 / -22.1 / 13.1 | 36.1 | -3.3 / 60.2 / -35.5 | 83.2 | 2.10 / 3.77 / 3.64 | 0.06 |
| west-house | -3.3 / -22.1 / 13.1 | 36.1 | -3.3 / 60.2 / -35.5 | 83.2 | 0.93 / 1.06 / 0.85 | 0.07 |
| open-north | -3.3 / -22.1 / 13.1 | 36.1 | -3.3 / 60.2 / -35.5 | 83.2 | 3.60 / 0.10 / 4.29 | 0.36 |

Right stick: before -22.1° … 13.1° (stick up looked down); after -35.5° … 60.2° (stick up looks up).

### Climbs (held W from 1.6 m before the foot / from the top)

| flight | before up: stalls, end y, reached top | after up | before down: min camera over ground | after down |
|---|---|---|---|---|
| main | 0 stalls, y 4.32, top false | 0 stalls, y 4.32, top false | 0.38 m | 0.38 m |
| south-bank | 0 stalls, y 1.95, top true | 0 stalls, y 1.95, top true | 0.43 m | 0.44 m |

### Walk routes (camera-relative key steering)

| route | before: reached, stuck | after: reached, stuck |
|---|---|---|
| plaza-to-upper-house | 6/6, none | 6/6, none |
| plaza-to-south-bank-top | 4/4, none | 4/4, none |
| saria-front-arc | 3/3, none | 3/3, none |
| west-deck | 3/3, none | 3/3, none |

### Stair collision against the rendered stone and timber (after)

| flight | tread span: samples, share > 3 cm off, max off (m) | nose zone (±0.1 m round each riser line): share > 3 cm, max (m) |
|---|---|---|
| main | 3195, 0.03 %, 0.12 | 63.1 %, 0.34 |
| south-bank | 480, 0.00 %, 0.00 | 30.5 %, 0.26 |

### Frame cost (this VM renders with SwiftShader on 4 CPU cores: the wall times are CPU rasterisation, not a GPU)

| spot | draws before → after | triangles before → after | after JS step ms (camera / world update / render issue) | before / after drawn frame wall s (synced, median of 4) |
|---|---|---|---|---|
| plaza | 450 → 452 | 7.71 → 7.77 M | 23.4 (0.1 / 1.3 / 22.0) | 31.1 / 30.9 |
| stairs2-base | 453 → 455 | 9.81 → 9.86 M | 26.2 (0.1 / 8.7 / 17.4) | 34.4 / 39.7 |
| saria-side | 448 → 450 | 8.95 → 9.01 M | 12.0 (0.1 / 5.0 / 6.9) | 28.3 / 34.1 |
| west-house | 364 → 386 | 5.29 → 5.40 M | 18.5 (0.2 / 3.6 / 14.7) | 24.4 / 13.7 |

Page errors (after): [page:error] Failed to load resource: the server responded with a status of 404 (Not Found); [page:error] Failed to load resource: the server responded with a status of 404 (Not Found)

The two 404s per page load are the music slot probing for an optional owner-supplied
`public/audio/music.ogg|mp3` (by design; the original placeholder tune plays). The synced frame
times depend on which other render job shared the 4 cores, so they compare nothing across runs.
Link-view nose-zone "mismatch" is the next step's slab nose and timber overhanging the analytic
riser line by up to 10 cm; the feet plant on the rendered surface there (`character/ground.ts`
`surface`), the root climbs at the riser line.

## 50-point rubric (0–4; evidence paths are in this folder)

| # | item | score | evidence |
|---|---|---|---|
| 1 | first staircase as good as or better than baseline | 4 | `compare/s1-approach.jpg`, `compare/s1-top-down.jpg` (builder untouched), `lighting/stairs-three-suns.jpg` row 4 |
| 2 | second staircase: no obvious repeated pattern | 3 | `compare/s2-approach.jpg`, `s2-owner`, `s2-climb`, `s2-top-down`; climb clip. A regular timber rhythm remains by design; at distance the logs read alike |
| 3 | step dimensions consistent and navigable | 4 | unchanged risers (0.27 / 0.26 m); climbs 0 stalls before and after, identical traces (Measurements) |
| 4 | materials match the construction style | 3 | `compare/s2-owner.jpg`, `compare/w-wide.jpg` |
| 5 | believable texture scale on treads and risers | 3 | `compare/s2-owner.jpg` (bark grain along each log, ≈ 0.6 m of bark per map repeat) |
| 6 | wear and dirt with a plausible cause | 3 | `compare/s2-owner.jpg`, `s2-climb` (dark worn crowns in the walking band, moss toward the ends) |
| 7 | clean edges and joins at close range | 3 | `compare/s2-climb.jpg` |
| 8 | lighting reveals no new repetition | 4 | `lighting/stairs-three-suns.jpg` (default, low raking east, dim) |
| 9 | collision matches the visible stairs | 3 | tread span 99.97 % (main) / 100 % (south bank) within 3 cm; 10 cm nose overhang (Measurements) |
| 10 | coherent from above, below and while moving | 3 | `compare/s2-top-down.jpg`, `s2-side`, `w-wide`; climb clip |
| 11 | clear, appealing bungalow silhouettes | 3 | `compare/b-saria-front.jpg`, `b-west-house`, `b-north-east-side` |
| 12 | roofs and eaves with believable thickness | 3 | eave roll: `compare/b-west-house.jpg`, `b-north-west-side` |
| 13 | coherent walls, trim, foundations | 3 | `compare/b-west-house.jpg` (sill band, wall plate, window ledge) |
| 14 | buildings meet the terrain naturally | 3 | `compare/b-saria-front.jpg`, `b-upper-2` (unchanged roots / platforms) |
| 15 | repeated bungalows vary purposefully | 2 | per-hut trim tone plus existing size / height / pods / dressing; the three village huts still read as one design |
| 16 | lantern frames and mounts detailed and plausible | 3 | `compare/b-saria-pods.jpg`, `l-saria-under`, `b-west-house` |
| 17 | lantern glass and inner light readable | 3 | `compare/l-saria-under.jpg` (open bottom, lit lining, spokes, flame; the flame is small at this range) |
| 18 | lantern light affects nearby surfaces | 3 | `compare/b-west-house.jpg` (new light warms the doorway and jambs), `b-saria-front` (threshold pool) |
| 19 | lantern shadows / brightness stable while moving | 3 | lights fixed (the pods swing, the lights do not), no flicker; Saria look-sweep clip |
| 20 | detail improves without clutter | 3 | `compare/b-saria-pods.jpg`, `b-west-house` |
| 21 | useful upward range | 4 | +60° at all ten spots, frame top 83° (was +13° / 36°); `play/look-range-before-after.jpg` |
| 22 | smooth, predictable mouse / controller | 3 | `src/camera/follow.test.mjs`; stick +60° / −35.5° (was inverted); clips |
| 23 | no clipping through overhead geometry | 3 | nearest solid surface ≥ 0.85 m at every spot and angle; the one 0.10 m reading is a translucent mist sheet in the hollow |
| 24 | looking up reveals meaningful detail | 3 | `play/look-range-before-after.jpg` (canopy, limbs, sky gaps: 6–36 % sky, was 0 %) |
| 25 | roof undersides and upper parts finished | 3 | `compare/u-saria-up.jpg`, `b-north-east-side`, `b-north-west-side` |
| 26 | tall forms hold up from below | 3 | `compare/u-plaza-up.jpg`, `u-stairs-up`; `u-open-up` improved (streaks gone) but see Unfinished |
| 27 | sky and atmosphere suit the setting | 3 | `compare/u-*.jpg` |
| 28 | culling / LOD without sudden gaps | 3 | the crown fade is continuous with view angle; look-sweep clips |
| 29 | comfortable exposure from ground to sky | 3 | look-sweep clips (fixed exposure; sky gaps not clipped) |
| 30 | looking up works at stairs, bungalows, open ground | 4 | all ten spots in Measurements |
| 31 | coherent material language | 3 | `compare/w-wide.jpg`, `s2-approach` |
| 32 | large forms read before small details | 3 | `compare/w-wide.jpg`, `u-plaza-ahead` |
| 33 | terrain transitions without seams | 3 | `compare/w-close.jpg`, `s1-approach` (unchanged) |
| 34 | credible foliage | 3 | `compare/s1-approach.jpg`, `b-west-house` |
| 35 | repeated props without stamping | 3 | logs individual; lanterns 5–7 ribs, replaced panels, sizes |
| 36 | lighting supports depth and direction | 3 | `lighting/stairs-three-suns.jpg`, `compare/w-wide.jpg` |
| 37 | stable, detailed shadows | 3 | unchanged shadow system; stairs under three suns |
| 38 | atmosphere adds depth without hiding defects | 2 | the upper house from the plateau is heavily veiled by a light shaft (`compare/b-upper-2.jpg`); the hollow's mist washes crowns overhead |
| 39 | points of interest guide exploration | 3 | lanterns, houses, both flights (`compare/s2-approach.jpg`, `u-plaza-ahead`) |
| 40 | new details consistent with the style | 3 | Kokiri materials kept (bark, moss, leaf calyx, pod glow) |
| 41 | walking and climbing work | 4 | identical climb traces, all walk routes complete |
| 42 | no new snags or invisible walls | 3 | four routes complete before and after, no stuck points; limited route coverage |
| 43 | existing interactions still function | 4 | jump, equipment bag (world holds, closes, walks on), P free camera — `play/playtest-interact-resize.json`, `play/interact-bag.jpg` |
| 44 | camera comfortable during movement | 3 | recentre after 1.5 s, lift over flights (≥ 0.38 m over ground descending); climb clip |
| 45 | performance measured on this machine | 3 | draws / triangles before → after, JS phase times, synced SwiftShader frame times; no GPU here |
| 46 | stable frame pacing in detailed areas | 2 | display-rate pacing cannot be measured on SwiftShader; CPU-side step 12–26 ms including its submission |
| 47 | new assets and effects load reliably | 3 | no system build failures; only the optional music probe's 404s |
| 48 | survives resizing, reloading, traversal | 4 | 640×360 → 1280×720 → 960×540 resized correctly; reload back in play mode, walking, 0 page errors |
| 49 | captures and results from the current build | 4 | every run records its build SHA (`BASELINE_SHA`) |
| 50 | final build launches through the normal run path | 4 | `npm run build`, `npm run preview`, `play/normal-run-*.jpg` |

**Total: 157 / 200.** Every must-reach item (2, 3, 9, 16, 18, 21, 23, 24, 41, 42, 43, 50) is at 3 or
4. The 185 target is not met: most items are "strong" (3), not "polished" (4), and three are 2.

## Unfinished (exact remaining defects)

- **15 — hut variation:** the three village huts are one design at three sizes; no per-hut features
  (shutters, balcony, flower box) were added.
- **38 — atmosphere:** a light shaft sits between the plateau and the upper house and veils it
  (`compare/b-upper-2.jpg`); the misty hollow north of the log arch washes the crowns overhead.
- **26 / 28 — distant ring from below:** in the misty hollow a distant crown straight overhead can
  read as one flat, pale floor card (`compare/u-open-up.jpg`, top left); the ring was built for
  60 m+ views and sits 20 m from that corner of the playable ground.
- **46 — frame pacing:** not measurable without a GPU; needs a run on a real machine
  (`gauntlet/scripts/playtest.mjs --only perf` measures synced frame times there too).
- **Stair nose zone:** the collision riser sits up to 10 cm behind the visible nose / timber; the
  feet plant on the rendered surface, so nothing sinks, but the root's step-up happens 10 cm late.
- **Foliage between camera and Link:** cards in a narrow cone in front of Link now screen-door out
  (play only); vegetation outside that cone can still briefly cover the view in dense ferns.
- The pose `b-upper` in `shots.json` stood inside a bank in both builds and was replaced by
  `b-upper-2`; no gauntlet take was sealed for this round (a take is ~6 h on this VM).
