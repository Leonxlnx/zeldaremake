# Owner review 2026-09-23 — staircase, bungalows & lanterns, upward view

Everything here was captured from running builds on this VM (Chrome + SwiftShader, 4 CPU cores,
no GPU). Before = `47773f13` (the branch head when the owner's directive arrived); after = the branch
head recorded in each run's `BASELINE_SHA` (pass 1 final: `e48d5e8e` + evidence commits; pass 2
final: `a5dbf45f`). **Correction (pass 3):** the build the owner actually played was older still —
the live link `monitor/play/` serves the last sealed take, take-0134 (`702086ba`, 2026-09-22 19:26),
so none of passes 1–2 reached him; he now plays the head at
https://raw.githack.com/Leonxlnx/zeldaremake/play-head/index.html (§Pass 3).
**Passes 2 and 3 and the current rubric are at the end of this file.**

- `shots.json` — the fixed free-camera poses used for every before / after pair
  (`gauntlet/scripts/broll.mjs --shots … --test --settle 6`, 960 × 540, character hidden): the 22 of
  pass 1 and four hut poses added in pass 2 (`h-ladder`, `h-west-herbs`, `h-north-east`, `h-west-front`).
- `compare/<pose>.jpg` — pass 1: before | after for each pose (`gauntlet/scripts/compare-sheet.py`).
- `compare-pass2/<pose>.jpg` — pass 2: before (`47773f13`) | final (`a5dbf45f`) for all 26 poses.
- `lighting/stairs-three-suns.jpg` — both staircases under the default sun, a low raking sun from
  the east and a dim sun (`gauntlet/scripts/probe-look.mjs`, runtime sun override).
- `play/` — play-mode captures from `gauntlet/scripts/playtest.mjs` (real key holds, mouse drags,
  an emulated gamepad; the follow camera as the player has it), before and after, and the
  measurement files `playtest-before.json` / `playtest-after.json`.
- `play/pass2/` — pass 2's play tests on the final builds (`playtest.json`, `playtest-interact-resize.json`,
  `playtest-final-look.json`, `normal-run.json`) and their sheets.
- Movement clips (look sweeps beside Saria's lanterns and at the plaza, the climb up the second
  staircase), for both passes, are attached to the pull request.

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

## 50-point rubric — pass 1 (0–4; evidence paths are in this folder)

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

## Unfinished after pass 1 (pass 2 below closes some of these)

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

## Pass 2 (2026-09-23, 03:30–06:00 UTC) — the lowest scores of pass 1

Final build `c526a5b8` (renders in `compare-pass2/`; the play tests in `play/pass2/` ran on `a5dbf45f`,
which differs from it only in the distant floor cards' shading from below — the open-north and
upper-house look spots were re-run on `c526a5b8`). Before = `47773f13` throughout, so each sheet shows
the whole owner review, not only this pass.

### Diagnosis — verified

- **The upper house from the plateau (item 38).** The veil over `b-upper-2` is the god-ray march:
  rendered with `fx=norays` the house is crisp. The plateau path passes 0.7–1.1 m from the axis of the
  narrow × 7.5 shaft column at (13.3, 10, −14.6) (`trees/corridors.ts`; the × 7.5 gain was tuned so shot
  F reads the column from 18–31 m), so every ray from a camera there started inside the boost.
- **Repeated huts (item 15).** The three village huts were one generator at three sizes; nothing told
  them apart but scale and pod count.
- **Load errors (item 47).** The two 404s per page load were the music slot fetching
  `audio/music.ogg|mp3` whether or not the owner had dropped a track in.
- **Pale straight-edged slab overhead in the north hollow / behind the west hut (items 24, 26, 38).**
  A depth pick (`probe-look.mjs --pick`) puts it on the floor cards of the tall pale poles in the
  far-trunk row (`distant-5-near`, x −7…−10, z −46…−49, 22–34 m from those cameras); a red emissive on
  the crown material marks it. It is not the mist (the mist buffer is empty there), not the god rays
  (`fx=norays` leaves it), not the haze (a 60 % haze give-back leaves it) and not the albedo (× 0.25
  leaves it): the crown material bends every card's normal 85 % toward the crown sphere
  (`CROWN_SPHERE_MIX`), which under the crown's centre is horizontal, so a floor card seen from below
  met the view at a grazing angle and took the sky's Fresnel sheen — a pale slab whatever its colour.
- **The 0.10 m "nearest surface" looking up in the open north (item 23).** 0.01 % of the depth samples
  (one or two of 14 400): a small object at the lens — Navi's core or a falling leaf, the two things in
  the atmosphere that write depth — not overhead geometry. Pass 1 called it a mist sheet; the mist
  writes no depth.

### What changed

1. **Each village hut its own character** (`structures/distantHouse.ts` `character`, audit
   `distantHouseDetail[].character`): the lowest hut (hollow column, on a bank 9.5 m over the north
   path) got a staked rope ladder down the bank (7.1 m, 22 rungs, the foot stepped out until every rung
   clears the bole by 0.2 m) and a flower box on its window ledge; the highest (north-east, platform at
   11.8 m) a railing round its platform (22 posts under a bent-pole rail, open at the walkway and the
   door) and a hoist — a davit lashed to the wall, a block, a basket of firewood 2.4 m under the
   platform, the hauling end tied off on a peg; the grower's hut (west column) a sapling rooted in its
   moss cap, a mossy bark brow over its window (the wall plate stops either side of it) and six bundles
   of herbs drying under its eave on the side facing the path. The ladder is on the play camera's SLIM
   list (it may stand behind a rope ladder, never be walled off by it). Cost (structures audit, `f4ed20de`
   → `c526a5b8`): the three huts 37.8 → 42.8 K triangles and 4 → 6 draws where the village is in view
   (its new leaf and flower buckets); the ladder, rails, hoist, sapling and brow ride in the village's
   wood and bark buckets.
2. **The god rays' boosted columns fade in along the ray** (`postfx/composer.ts`
   `rayColumnNearStart/End` = 2 / 6 m, `shaders.ts`): a gained column's boost above 1 now ramps in over
   the first 2–6 m of each ray, so a camera standing in a shaft sees ordinary lit air around it and the
   shaft itself from outside. Plain columns and every sample past 6 m are untouched: the fixed frames
   first meet a narrow column 7.7 m (C) to 16.6 m (A) out, and rendered at matched simulation time
   **F is byte-identical and C differs in one pixel by one level** (the known SwiftShader scatter).
3. **Distant crowns overhead** (`trees/distant.ts`): inside the near gate (< 48 m) a floor card seen
   from below keeps its own normal (the slab is gone: a dark, round leaf roof over the pole,
   `compare-pass2/u-open-up.jpg`, and dark crowns behind the west hut, `b-north-west-side`); on rays
   climbing 20–44° a crown keeps 60 % of its shade through the haze and a floor card ends round. Zero
   at 48 m+: the fixed frames see the ring from 51 m out.
4. **No request for a file that is not there** (`vite.config.ts`, `audio/music.ts`): the optional
   track is looked up when Vite starts; the play tests record **0 page errors** (was 2 per load).
5. **Performance**: fable-4's per-giant / per-crown-band colour-pass culling merged (`084da3da`:
   −148 K … −360 K triangles at the six fixed views, pixel-identical); a frame-pacing measurement
   (below).
6. **Tooling**: `playtest.mjs --only pacing`; `probe-look.mjs` composer buffers (`atmoDebug`),
   `--audit`, `--pick` (the mesh under a pixel, from the frame's own depth).

### Measurements (final build, play mode)

From `play/pass2/playtest.json` (main run: look, pad, stairs, climb, walk, perf, pacing) and
`play/pass2/playtest-interact-resize.json`, both on `a5dbf45f` at 960 × 540 through `?test=1`.

**Unchanged by this pass (identical to pass 1's final numbers):** the look range at all ten spots
(rest −3.3°, drag up +60.2°, drag down −35.5°, frame top 83.2°), every clearance reading, the right
stick, both climbs (0 stalls, same end points), all four walk routes (reached, no stuck point), the
stair collision table (main tread span 0.03 % > 3 cm; nose zone as before).

**Interactions and resilience:** jump (0.50 m, lands), equipment bag (opens, world holds, closes,
walks on), P free camera and back; resize 640 × 360 → 1280 × 720 → 960 × 540 correct each time;
reload back in play mode and walking. **Page errors: 0** (pass 1: the two music 404s per load).

**Normal launch** (`npm run build` + `npm run preview`, no flags, `gauntlet/scripts/normal-run.mjs`) on
`c526a5b8`: ready in 151 s, play mode with the HUD, 517 draws, 0 errors.

**Frame cost per spot** (draws, triangles, JS step split, synced drawn-frame wall time; this VM's
SwiftShader wall times depend on what else shares the 4 cores, so they compare nothing across runs):

| spot | draws pass 1 → 2 | triangles pass 1 → 2 | JS step ms (camera / update / render issue) | drawn frame wall s (median of 4) |
|---|---|---|---|---|
| plaza | 452 → 521 | 7.77 → 7.43 M | 10.6 (0.1 / 3.4 / 7.1) | 31.9 |
| stairs2-base | 455 → 522 | 9.86 → 9.53 M | 15.5 (0.1 / 4.4 / 11.0) | 29.9 |
| saria-side | 450 → 519 | 9.01 → 8.59 M | 15.7 (0.1 / 5.3 / 10.3) | 28.9 |
| west-house | 386 → 442 | 5.40 → 5.03 M | 8.5 (0.2 / 2.1 / 6.2) | 19.2 |

(+56–69 draws and −0.34 … −0.42 M triangles: fable-4's per-giant, per-crown-band groups, plus the
village's two new buckets where it is in view.)

**Frame pacing** (`--only pacing`: the walk from the plaza up the second staircase to the upper house,
steered with held keys, 627 frames = 20.9 s simulated, route completed; every frame's JS step timed by
the page, every 12th frame drawn and synced; the box ran two SwiftShader jobs at load ≈ 10 on 4 cores):

| measure | value |
|---|---|
| JS step (camera + world update), all frames | p50 5.5 ms · p95 13.1 · p99 17.9 · max 21.6 · mean 6.4 |
| … frames not next to a drawn frame | p50 5.3 ms · p95 11.8 · max 20.3 |
| … the frame after each drawn frame | p50 10.3 ms · max 21.6 (most likely the LOD pools' builds queued by that draw — not traced) |
| render issue (JS) of the drawn frames | p50 13.5 ms · max 23.4 |
| synced drawn-frame wall (SwiftShader) | p50 27.6 s · max 38.1 s |
| shader programs | 170 at the start, 170 at the end — **no compile during the walk** |
| JS heap | 1161.6 → 1168.5 MB (max 1169.8) — flat, no GC storm |

The other frames above 11 ms come in short runs late in the walk (frames 520–525 and 604–619, between
the top of the flight and the upper house) and a few near its start (100, 112–113). What this machine
cannot show is display-rate pacing: that needs a GPU (`playtest.mjs --only pacing` runs unchanged there).


### 50-point rubric — final (0–4)

Changed from pass 1 in **bold** (with the new evidence); every other score and its evidence is as in
the pass-1 table above, re-checked on the final renders in `compare-pass2/`.

| # | item | pass 1 | final | evidence (final) |
|---|---|---|---|---|
| 1 | first staircase as good as or better than baseline | 4 | 4 | `compare-pass2/s1-approach.jpg`, `s1-top-down` (builder untouched) |
| 2 | second staircase: no obvious repeated pattern | 3 | **4** | `compare-pass2/s2-approach`, `s2-owner`, `s2-climb`, `s2-top-down`: each timber its own grain phase, tint, wear and moss, a repaired pair of newer timbers, three checked old logs, stakes where needed; fable-5 and fable-2 measured the stripes gone at A / F independently (INBOX 03:05 / 03:30) |
| 3 | step dimensions consistent and navigable | 4 | 4 | `play/pass2/playtest.json` climbs: 0 stalls, traces identical to before |
| 4 | materials match the construction style | 3 | 3 | `compare-pass2/s2-owner`, `w-wide` |
| 5 | believable texture scale on treads and risers | 3 | 3 | `compare-pass2/s2-owner` |
| 6 | wear and dirt with a plausible cause | 3 | 3 | `compare-pass2/s2-owner`, `s2-climb` |
| 7 | clean edges and joins at close range | 3 | 3 | `compare-pass2/s2-climb` |
| 8 | lighting reveals no new repetition | 4 | 4 | `lighting/stairs-three-suns.jpg` |
| 9 | collision matches the visible stairs | 3 | 3 | tread span 99.97 % within 3 cm; the 10 cm nose overhang remains (Unfinished) |
| 10 | coherent from above, below and while moving | 3 | 3 | `compare-pass2/s2-top-down`, `s2-side`; climb clip |
| 11 | clear, appealing bungalow silhouettes | 3 | 3 | `compare-pass2/b-saria-front`, `b-west-house`, `h-north-east` (railing), `h-ladder` |
| 12 | roofs and eaves with believable thickness | 3 | 3 | `compare-pass2/b-west-house`, `h-west-front` |
| 13 | coherent walls, trim, foundations | 3 | 3 | `compare-pass2/b-west-house`, `h-west-front` (plate stops at the brow) |
| 14 | buildings meet the terrain naturally | 3 | 3 | `compare-pass2/b-saria-front`, `b-upper-2`, `h-ladder` (the ladder staked at the bank's foot) |
| 15 | repeated bungalows vary purposefully | 2 | **3** | `compare-pass2/h-ladder`, `h-north-east`, `h-west-herbs`, `h-west-front`, `b-north-east-side`, `b-north-west-side`; audit `distantHouseDetail[].character` (22 rungs, 22 railing posts, a basket 1.03 m off the bole, 7 flower heads, 6 herb bundles) |
| 16 | lantern frames and mounts detailed and plausible | 3 | 3 | `compare-pass2/b-saria-pods`, `l-saria-under` |
| 17 | lantern glass and inner light readable | 3 | **4** | `compare-pass2/l-saria-under`: through the open hoop the flame in its clay cup outshines the lit lining; ribs, spokes and hoop read against it |
| 18 | lantern light affects nearby surfaces | 3 | 3 | `compare-pass2/b-west-house`, `b-saria-front` |
| 19 | lantern shadows / brightness stable while moving | 3 | 3 | lights fixed; look-sweep clip beside Saria's |
| 20 | detail improves without clutter | 3 | 3 | `compare-pass2/b-saria-pods`, `h-west-herbs` |
| 21 | useful upward range | 4 | 4 | +60.2° at all ten spots, frame top 83° (`play/pass2/playtest.json`) |
| 22 | smooth, predictable mouse / controller | 3 | 3 | `src/camera/follow.test.mjs`; pad trace; look-sweep clips |
| 23 | no clipping through overhead geometry | 3 | **4** | every surface ≥ 0.85 m from the lens at every spot and angle; the one 0.105 m reading is 0.01 % of the samples (a particle or Navi at the lens — the mist, blamed in pass 1, writes no depth; the same look on `c526a5b8` reads 9.4 m, `play/pass2/playtest-final-look.json`); the new ladder is on the camera's SLIM list |
| 24 | looking up reveals meaningful detail | 3 | 3 | `play/pass2/look-up-pass1-vs-pass2.jpg`; the upper house unveiled; the hollow's crowns now leaf roofs (`compare-pass2/u-open-up`) |
| 25 | roof undersides and upper parts finished | 3 | 3 | `compare-pass2/u-saria-up`, `b-north-east-side` |
| 26 | tall forms hold up from below | 3 | 3 | `compare-pass2/u-open-up` (the pole leads into a dark round crown; the slab is gone), `play/pass2/look-open-north-up-pass1-vs-final.jpg` (the same in play), `u-plaza-up` |
| 27 | sky and atmosphere suit the setting | 3 | 3 | `compare-pass2/u-*.jpg` |
| 28 | culling / LOD without sudden gaps | 3 | 3 | crown fades continuous with view angle; sector culling pixel-identical at the six views (fable-4) |
| 29 | comfortable exposure from ground to sky | 3 | 3 | look-sweep clips |
| 30 | looking up works at stairs, bungalows, open ground | 4 | 4 | all ten spots (`play/pass2/playtest.json`) |
| 31 | coherent material language | 3 | 3 | `compare-pass2/w-wide`, `s2-approach` |
| 32 | large forms read before small details | 3 | 3 | `compare-pass2/w-wide`, `u-plaza-ahead` |
| 33 | terrain transitions without seams | 3 | 3 | `compare-pass2/w-close`, `s1-approach` |
| 34 | credible foliage | 3 | 3 | `compare-pass2/s1-approach`, `b-west-house` |
| 35 | repeated props without stamping | 3 | 3 | logs individual; lanterns vary; huts' features differ |
| 36 | lighting supports depth and direction | 3 | 3 | `lighting/stairs-three-suns.jpg`, `compare-pass2/w-wide` |
| 37 | stable, detailed shadows | 3 | 3 | shadow system unchanged; stairs under three suns |
| 38 | atmosphere adds depth without hiding defects | 2 | **3** | `compare-pass2/b-upper-2` (the veil over the upper house gone, the shaft still seen from outside), `u-open-up` / `b-north-west-side` (the pale slab gone); F byte-identical, C one pixel by one level |
| 39 | points of interest guide exploration | 3 | 3 | lanterns, houses, both flights, the hollow hut's ladder from the north path (`h-ladder`) |
| 40 | new details consistent with the style | 3 | 3 | bark, moss, leaf and rope throughout the huts' features |
| 41 | walking and climbing work | 4 | 4 | identical climb traces, all walk routes complete (`play/pass2/playtest.json`) |
| 42 | no new snags or invisible walls | 3 | 3 | four routes, no stuck points; limited route coverage |
| 43 | existing interactions still function | 4 | 4 | jump, bag, free camera (`play/pass2/playtest-interact-resize.json`, `interact-bag.jpg`) |
| 44 | camera comfortable during movement | 3 | 3 | climb clip (unchanged camera) |
| 45 | performance measured on this machine | 3 | **4** | per-spot draws / triangles / JS phases / synced walls, and a 627-frame pacing walk with per-frame JS, drawn-frame walls, program count and heap (Measurements); this machine has no GPU and says so |
| 46 | stable frame pacing in detailed areas | 2 | **3** | no shader compile during the walk, a flat heap, JS step p99 17.9 ms / max 21.6 ms at load 10 on 4 cores; display-rate pacing needs a GPU |
| 47 | new assets and effects load reliably | 3 | **4** | 0 page errors in every pass-2 run (`play/pass2/*.json`, `normal-run.json`) |
| 48 | survives resizing, reloading, traversal | 4 | 4 | `play/pass2/playtest-interact-resize.json` |
| 49 | captures and results from the current build | 4 | 4 | every run records its `BASELINE_SHA` |
| 50 | final build launches through the normal run path | 4 | 4 | `npm run build`, `npm run preview` on `c526a5b8`: ready in 151 s, play mode with the HUD, 517 draws, 0 errors (`play/pass2/normal-run.json`, `normal-run-*.jpg`) |

**Total: 165 / 200** (pass 1: 157). Every must-reach item (2, 3, 9, 16, 18, 21, 23, 24, 41, 42, 43, 50)
is at 3 or 4, none is below 3. **The 185 target is not met**: 35 items are "strong" (3), not "polished"
(4); the remaining gaps below are the ones I could name.

### Unfinished (after pass 2)

- **185 / 200 not reached (165).** The gap is breadth: most items are sound but not polished.
- **Stair nose zone (item 9):** the collision riser sits up to 10 cm behind the visible nose / timber;
  the feet plant on the rendered surface, but the root steps up late (`character/ground.ts`, shared
  with Astra's stair posture — not changed here).
- **Huts (items 11, 15):** the three village huts share one body (barrel wall, moss cap, platform)
  under their new features; the west house and far hut share the door-bough dressing. The west
  hut's sapling shows only from above or far off.
- **Looking up toward the sun in the north hollow (items 24, 38):** the god-ray in-scatter still veils
  the lower canopy (rendered with `fx=norays` it is much darker) — the hollow glow shot D wants, heavy
  when looking straight up; Astra's call.
- **Distant ring near playable ground (items 26, 28):** the far-trunk row at z −46 stands 6–35 m from the
  open north; from below its crowns are now dark leaf roofs, but they are cards, not modelled crowns.
- **Frame pacing (item 46):** display-rate pacing needs a GPU (`playtest.mjs --only pacing` runs there
  unchanged); the JS step still spikes to ≈ 20 ms in short runs (after drawn frames and late in the
  walk), not yet traced to a system.
- **Foliage between camera and Link:** outside the narrow cone, dense ferns can still cover the view.
- **No gauntlet take sealed** (≈ 6 h here): A / B / D see the huts' new features at 23–45 m; F is
  byte-identical and C one pixel off for the ray change; a fable-5 re-verdict is welcome.

## Pass 3 (2026-09-23, 06:10–) — the build the owner plays, frame pacing, the camera, the stairs up close, the owner's 06:50 items

Evidence in `pass3/`. The owner's 06:50 message (marked screenshot: grey haze where his recording
shows layered trees, a smooth pale column trunk, a blue streak; thicker grass on the left; the sound
too buzzy; the people) is in `docs/GOAL_MODE.md`; the squad brief for his parallel chats is
`docs/SQUAD_2026-09-23.md`.

### The build the owner plays (verified)

- The live link (`raw.githack.com/…/monitor/play/`) serves the last sealed take's build: take-0134,
  `702086ba` (2026-09-22 19:26) — 35 commits behind the head, none of passes 1–2 in it. A take costs
  ≈ 6 h here (take-0134's capture ran 35–55 min per view), so the head is now published on its own:
  orphan branch `play-head`, `gauntlet/scripts/publish-play-head.sh` after every merge,
  **https://raw.githack.com/Leonxlnx/zeldaremake/play-head/index.html**.
- githack shows a browser a one-time "External Content Notice" before a proxied HTML page (one click
  on "Open the page"; a cookie remembers it) — what stalled two headless boots of the link. With the
  click (`gauntlet/scripts/url-check.mjs`): **ready in 80.9 s on this software renderer, 84 requests,
  0 failed, 0 console errors**, the first frame is the plaza with the HUD (`pass3/play-link-first-frame.jpg`,
  `pass3/play-link-url-check.json`). GitHub's raw cache can serve the previous `index.html` for minutes
  after a publish, so the last six bundles stay on the branch.

### Frame pacing: a shader compile storm walking north (verified, fixed)

The north clearing's two lantern-post lights lived in the group hidden beyond 45 m of the clearing;
a light joining the scene changes the light count every lit program is keyed on. Walk from the plaza
up the north path into the clearing (`playtest.mjs --only pacing --routes north-clearing --warmup`,
the normal launch path's warm-up on):

| build | programs start → end | compiles during the walk | worst drawn frame's render issue | JS step p50 / p95 / p99 / max (ms) |
|---|---|---|---|---|
| `c526a5b8` (before) | 166 → 227 | 52 in one frame at z −30, then 7 and 2 | **13 381 ms** | 3.6 / 10.9 / 14.3 / 21.3 |
| head (after, `a43ea516`) | 166 → 166 | **0** | 32.6 ms | 4.8 / 11.3 / 14.9 / 28.4 |

The upper-house route on the same build: 166 → 166, 0 compiles, JS p99 10.4 ms; 0 page errors on both
(`pass3/pacing-north-before.json`, `pass3/pacing-north-upper-after.json`).

### Camera (verified, fixed)

- **Frame-rate independence** (`src/camera/follow.test.mjs`): the heading chase was `dt × 1.6`
  (4 % faster at 30 Hz), the pitch recentre started on the next whole frame. Now an exact exponential
  and a sub-frame onset. The same input at 30 / 60 / 144 Hz: stick paths ≤ 1.0° apart, the walking
  recentre ≤ 1.05° (1.9° before the onset fix), end views ≤ 0.02°; one drag in 5 or 50 events lands
  on the identical view.
- **Pops**: nine walk routes with per-frame camera motion found single-frame jumps of 1.5 m where the
  follow camera ran into the lantern limb over the plaza and a house bough over the stairs from behind
  (`slimPush` 0 → 1.5 m in one frame, 1350 m/s²). The move in along the line now eases (0.12 s in,
  0.3 s out): a unit test walking past a bole 1.30 → 0.32 m in the worst frame; on the routes 1.53 →
  0.41 m (upper house) and 1.55 → 0.42 m (north clearing), peak 1352 → 330 m/s²
  (`pass3/walk-camera-*-easing.json`). The solid shells still pull in at once (no wall interiors):
  on the west house's deck a 1.26 m pull-in remains (Unfinished).

### Walking: nine routes (verified)

Every flight (both staircases, the house-west flight to Saria's door, the west house's steps, the
ledge flight in the north clearing), the plaza loop, the south approach and the north path under the
log arch into the clearing (82 m): **all reached, 0 stuck points** (`pass3/playtest-after.json`,
`walk-camera-after-easing.json`). The one block the first run met was the west fork's waymarker post
on the route's straight line — a visible prop; the route now walks the path round it.

### Stairs: the boots against the rendered stone and timber (verified)

`state().feet` (both boots' sole gap and the footprint's lowest point over the rendered surface) on
every climb frame: the deepest any boot corner goes into the stone or the logs is **0.1 mm (main flight
up), 1.8 mm (main down), 0 (south bank)**; no stance sample more than 5 mm inside. The root's analytic
riser line sits behind the log noses, but Link stands on the feet's supports, which read the rendered
surface — collision as seen matches the visible stairs.

### The second staircase up close (fixed)

- At eye height a ragged pale sliver of stone showed under every log (the slab's rolled lip reaching
  past the timber where the nose waves or the log thins): on the log flight the lip is now the shaded
  trough under the timber (`pass3/stairs-join-close.jpg`).
- From the top of the flight the bark map's knot recurred every 0.8–1.3 m along every log's crown (a
  row of evenly spaced eyes): each log now has a 7–12° spiral grain (`pass3/stairs-from-top.jpg`).
- Tones and UVs only — tread noses, heights and the support grid unchanged (paving / log tests green).

### Exposure from ground to sky (measured)

The look test's frames (10 spots × rest / drag up / drag down, the canvas after tone mapping): the most
clipped share **0.24 %** (the west house's lantern glow at rest), **0 %** crushed to black anywhere,
and looking up **0 % clipped** with 6–36 % of the frame sky (`pass3/playtest-after.json` → `look[].*.exposure`).

### Sound (fixed)

The pod lanterns' hum was the village's drone: a 96 Hz tone with a triangle partial at 287.5 Hz and a
fourth partial, open to 900 Hz, at the wind bed's level within ≈ 2 m of any pod — and pods hang on every
house, post and bough. Now two soft sines under 420 Hz at a third of the level, only near a lantern:
−12.6 dB at 1 m from one pod, −16 dB at 3 m, −10 dB on Saria's porch (`99af9adf`).

### The grey washout at the owner's pose (diagnosed, reduced)

Decomposed at his pose and two more (`probe-look` variants, `pass3/owner-0650-poses.json`): the far
softening pass changes nothing there; a thinner ground fog (0.012 → 0.007, cap 0.86 → 0.72) moves the
upper frame by under 1 level; **the god rays' in-scatter is the veil** — with the rays off the upper-left
third falls 83.6 → 59.8 levels looking north (`pass3/haze-rays-share-north.jpg`). Clearing the air
between the shafts as well (intensity 0.32 → 0.28, gap floor 0.3 → 0.15, the screen fan's floor
0.75 → 0.5) was tried and backed out: it dimmed the god rays themselves and the hero views read duller,
not fuller (top thirds A −7.6, B −10.5, D −12.2 levels; `pass3/haze-clear-shafts.jpg` shows that
variant at the owner's poses). What stays: the base air starts higher (3 / 6.5 → 6 / 16 m), so the
glow at eye level thins and the shafts above keep their brightness — the upper frame 79.1 → 72.9
looking north, 94.1 → 82.6 looking west, 80.2 → 75.6 toward Saria's (`9a1be295`). What the haze does
not explain — fable-5 (lane 10) measured it against the owner's recording: the corridor has no leafy
crowns at 10–40 m over its banks, only bare column trunks, and its mist is bright and warm where ours
is cool grey — is the trees' lane (fable-4 / squad lane 2–3) and the colour half of lane 1.
