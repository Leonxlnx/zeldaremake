# The north grove (fable-cursor, expansion-north — 2026-09-24)

The owner, 06:07: *"are you going to add more stuff and the structures from the screenshot … more structures along the
path further down"*. Past the log arch, the second clearing and the ledge terrace, a trail climbs 30 m north into a
second hamlet on a shelf cut into the hillside: a trunk house with its yard, a stilt house over the falling east slope,
and a tree hut high on its own bark column, joined to the stilt house by a rope walk, with a lookout nest above it.
Branch `agent/fable-cursor-exp-north`.

## Results at a glance

*Interim (13:30 UTC, on e994114a): the rubric, walk, probe and camera results below hold; one of the grove's own
views, `g-back` (the bank behind the trunk house looking back over the hamlet toward the village), counts 730 draws
against the 700 budget (8.88 M triangles), so check 46 fails until the grove draws less. Being fixed; the final numbers
replace this paragraph.*

## What is where (world metres; y is absolute height)

| item | where | what |
| --- | --- | --- |
| grove sign | (2.25, 5.62, −79.1) | the village's signpost at the grove flight's foot on the ledge terrace, facing the ledge stairs' head |
| grove flight | base (0.5, 5.62, −79.85), 9 steps × 0.27 m rise × 0.42 m tread, 1.4 m wide, up to 8.05 m at z −83.6 | log-nosed earth steps up the bank (hardscape, the ledge flight's nosings) |
| lantern posts | (−1.35, −84.3) orange, 2.35 m; (3.55, −94.4) lime, 2.45 m | pod posts at the flight's head and at the shelf's lip (their point lights taken out; the pods are emissive) |
| trail | (−0.15, 8.05, −85.25) → (−0.95, −87.45) → (−0.45, −89.85) → (1.05, −91.95) → (2.3, −93.9) → (2.5, 10.0, −96.0) | a trodden path 1.9 m wide, 24 % out of the landing easing to 15 %, set stepping discs every 0.92 m |
| shelf | centre (−0.5, 10.0, −99.2), 16.4 × 10.8 m superellipse, a pad (6.7, −94.35) r 1.5 for the gangway's foot | the levelled yard; a 2 m bank on its north side, a lawn on it (`terrain/north.ts groveLawn`) |
| trunk house | trunk (−3.9, 10.0, −101.4), radius 2.2 m, door facing (0.68, 0.73), door front (−1.75, −99.1) | `house.ts` with the upper house's settings: two pods outside the wall and two room lamps hanging inside; its point lights taken out |
| the yard | washing line (0.9, −102.7) ↔ (4.5, −101.3) with 4 cloths; chopping block ≈ (0.8, −99.8); woodpile ≈ (−1.2, −103.1); bench ≈ (−3.4, −97.8); three pots and a basket of kindling by the door; a fourth pot knocked over and broken ≈ (−2.3, −97.8) | signs of life, each with a blocker |
| gangway | foot (6.16, 10.1, −94.68) → head (9.72, 11.62, −92.75), 4.05 m run, 0.84 m wide | cleated treads on two stringers, a trestle, a sill, hand rails; a lime pod at (7.52, 11.69, −92.99) on a bracket rising off the trestle's leg outboard of the hand rail |
| stilt house | centre (12.0, −91.5), floor 11.6 m, wall radius 1.55 m × 2.35 m, cap 1.05 m | a round hut on a cut stump and four log stilts on stone pads; door 0.76 × 1.55 m toward the gangway's head |
| veranda | round the stilt house, walkable ring 1.81–2.45 m from its centre, railing at 2.58 m | plank deck, bent-pole rail on posts with a rope mid-rail; pots and a herb basket; a wooden ladder down its south side (decorative) |
| rope walk | (14.03, 11.6, −88.84) → (15.36, 11.3, −87.09), 0.84 m wide, 0.12 m sag | planks on two floor ropes between the walkway stubs, hand ropes from their end posts |
| tree hut | centre (16.8, −85.2), floor 11.3 m (4.3 m up its column), wall radius 1.45 m × 2.3 m | on its own bark column (base radius 0.9 m, 22 m tall, limbs into a crown from 17.5 m); door 0.72 × 1.5 m toward the rope walk; a walkway deck at the rope walk's end |
| tree hut's dressing | rope ladder (−30°), hoist with its basket (40°), a woodpile in the column's root gap, a basket of leaves | the ladder is decorative |
| lookout nest | on the column over the hut's cap, floor 16.3 m, ring radius 1.2 m | boards, rungs up the column, the same railing as the veranda |
| light pools | 15: under the trunk house's 2 outside pods and the posts' 2 (on the ground), the gangway's pod (one on the treads beside it, one on the slope under it), the stilt house's 4 (on the veranda) and the tree hut's 5 (on its platform and walkway stub); the room lamps inside the trunk get none | additive vertex colour, `lanternGlow` at ≤ 0.085 linear, clipped to the deck it lands on, faded by the haze's extinction; no light joins the scene |
| pods | 17: the trunk house's 2 outside + 2 room lamps, 2 posts, the gangway's, the stilt house's 4, the tree hut's 5, the nest's 1 | the huts' walkway post pods hang from brackets 0.28 m outboard of their posts (`postPodsOutboard`); every pod is at least 8 cm clear of anywhere Link can stand |
| understory | 16 leafy trees round the walks, crowns ≥ 4.5 m off the decks and huts and ≥ 2.2 m off the walkable ground | `trees` north-grove zone, drawn only near the grove |

Everything in the grove is 78–112 m north of the plaza, behind the log arch and the ledge. It is drawn only within
`GROVE_VISIBLE_M` (60 m) of it and only when the frustum meets its spheres (`util/groveLocality.ts`); no fixed camera
frames it.

**Decorative, not walkable:** the stilt house's wooden ladder down its south side and the tree hut's rope ladder (the
veranda's railing and the hut's platform railing run across their heads; probes `veranda-rail` and `hut-rail` blocked).
The huts' doors are shut to Link (the wall ring has no gap; probe `hut-door` and `stilt-wall` blocked) — the rooms are
glimpsed, not entered.

⟨IMAGES⟩

⟨RUBRIC⟩

## Walking it (checks 41–45)

The route `north-grove` in `gauntlet/scripts/playtest.mjs` drives the real player controller in Chrome from the second
clearing (3.6, −65.2): up the ledge flight, past the sign and up the grove flight, along the trail to the trunk house's
door, back across the yard, up the gangway, round the veranda the south way past the decorative ladder's head, over
the rope walk and onto the tree hut's walkway deck. 28 waypoints.

| build | waypoints | stuck frames | frames | walked | camera accel p95 / max | frames over 100 m/s² | camera lowest above ground | feet: sole gap p95 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| e156566f (all 11 routes, 10:38 UTC) | 28 / 28 | 0 | 1248 | 61.8 m | 69.6 / 124.6 m/s² | 1 | 1.53 m | 0.047 m |
⟨WALKV7⟩

The one frame over 100 m/s² is at the trunk house's door (Link at (−0.75, 10.02, −98.8)) as he turns back into the
yard: the camera swings 0.36 m in that frame while holding its distance (nothing cut the line; keep 1 → 0.987). What
reads as a pop is the change in its motion, the second difference of its position, and that is 0.14 m.

The same run's other routes all reach every waypoint with nothing stuck:

| route | waypoints | frames | walked | camera accel p95 / max (m/s²) | frames over 100 m/s² |
| --- | --- | --- | --- | --- | --- |
| plaza-to-upper-house | 6 / 6 | 627 | 27.2 m | 69.8 / 79.4 | 0 |
| plaza-to-south-bank-top | 4 / 4 | 306 | 14.8 m | 6.3 / 72.3 | 0 |
| saria-front-arc | 3 / 3 | 105 | 5.3 m | 68.3 / 72.3 | 0 |
| west-deck | 3 / 3 | 132 | 6.2 m | 69.9 / 73.0 | 0 |
| plaza-loop | 4 / 4 | 510 | 26.9 m | 69.8 / 94.2 | 0 |
| south-approach | 2 / 2 | 264 | 13.8 m | 46.5 / 72.3 | 0 |
| house-west-to-saria-door | 5 / 5 | 204 | 8.8 m | 71.3 / 73.2 | 0 |
| west-house-to-plaza | 5 / 5 | 402 | 20.5 m | 69.7 / 412.4 | 2 (phase1's camera: 6, see the camera section) |
| north-clearing-ledge | 15 / 15 | 1569 | 82.2 m | 67.8 / 87.8 | 0 |
| south-bridge-to-log | 21 / 21 | 969 | 51.4 m | 68.0 / 72.3 | 0 |

The node replay (next section) walks the grove 48 more ways — there and back, hugging the veranda both ways, at walk,
jog and run with different arrival radii and steering — and reaches every waypoint in all 48, on the current build
with the broken pot's blocker as before it.

**Edges.** `northProbes` asks the ground at 64 points what Link would stand on; all 64 answer as intended:

| where | expected | ok |
| --- | --- | --- |
| veranda, 7 bearings round the stilt house at 2.05 m | the deck's height | 7 / 7 |
| veranda railing, 8 bearings at 2.58 m (the decorative ladder's head at 108° among them) | blocked | 8 / 8 |
| the stilt house's wall at 1.4 m (on the door's bearing, 90°, −30°) | blocked | 3 / 3 |
| gangway, 3 stations × centre and ±0.28 m | the gangway's height | 9 / 9 |
| gangway sides, ±0.47 m | blocked | 6 / 6 |
| rope walk, 3 stations × centre and ±0.25 m | its sagging height | 9 / 9 |
| rope walk sides, ±0.46 m | blocked | 6 / 6 |
| the tree hut's walkway deck at 1.9 m | the floor's height | 1 / 1 |
| the tree hut's platform off the walkway, 4 bearings at 1.5 m (a ledge inside the wall's clearance) | blocked | 4 / 4 |
| the tree hut's railing, 3 bearings | blocked | 3 / 3 |
| the tree hut's door, 1.35 m on the walkway's bearing | blocked | 1 / 1 |
| the trunk house's bole | blocked | 1 / 1 |
| the trunk house's door front, 4 trail points, the flight's middle | walkable, at the ground's height | 6 / 6 |

The south expansion's 41 probes hold too (41 / 41).

**Steps and ramps (check 43).** The flight rises 0.27 m per 0.42 m tread, the gangway 1.52 m over 4.05 m (20.6°) with
a cleat every 0.36 m, the rope walk falls 0.3 m with 0.12 m of sag, the trail climbs at 24 % out of the landing, easing
to 15 %. All of it is well under the 0.55 m step guard. Along the route the feet's sole gap is 3 mm at the median and
47 mm at p95.

**Footsteps (check 45).** `src/audio/index.ts` `onGrovePlanks` plays wood on the veranda, the gangway, the walkway
stubs, the rope walk and the tree hut's platform; the trail's discs play stone and the lawn grass
(`src/world/terrain/expansionNorth.test.mjs` checks each).

**Not the grove's.** `climb.main.reachedTop` is false on this branch and on phase1-based builds alike: the same end
point (13.74, ·, −5.12) after the same 255 frames, with no stalled frame. The hero flight has 26 treads now and the
climb's frame budget ends before its top (W02). The pad's look reaches 60.2° up and −35.5° down, as on phase1.

⟨COST⟩

## The camera change (check 44; `src/camera/follow.ts`, `src/camera/collision.ts`)

The camera is the camera lane's, so it is changed here only because the grove needs it, and measured before and
after. The grove puts Link right beside round walls: a 0.64 m-wide veranda ring round the stilt house, a gangway rising
along its wall, a door he turns about at under the trunk house's root arch. Phase1's camera meets a wall that its line
of sight swings into by pulling in to it within the same frame, and in the grove that was a 3.6–4.3 m jump every time
Link went round the veranda or turned down the gangway.

What changed:

- `collision.ts`: the huts' walls reach the camera as exact round solids (`cameraSolids.walls`, from `distantHouse.ts`
  with the barrel's taper and wobble) in place of their voxels, so a line along a wall keeps its length and a line into
  it stops at its surface. A line is blocked only where it runs through a surface (four consecutive samples, a fifth of
  a cell each), not where it clips the corner of the grown shell round it (a door's edge). A plain `sweep()` serves the
  look-ahead.
- `follow.ts`: the line is also swept where it is going (0.12, 0.3 and 0.6 s ahead), so the camera eases in before a
  wall arrives instead of jumping when it does. Every eased move along the line is held to 8 m/s and 50 m/s². The swing
  behind Link waits when swinging on would run the line into a wall and hurries when swinging faster clears it; on a
  hut's ring it trails Link along the ring. The orbit's own turn is held to 4 rad/s and 75 m/s² sideways at the camera.
- Kept: the camera lane's stair smoothing (cc360d8a, 34b81013 and 5bd1aeee are ancestors of this branch; their easing
  of the aim, the orbit's height and the ceiling duck is unchanged; where the eased duck and the pull-in disagree the
  camera's own line is swept), the pitch orbit, the look and the pad. The fixed viewpoints A–F do not use the follow
  camera.

**In Chrome**, with the real controller: the phase1 camera's own published run after the stair fix
(`art/environment/stairs-look/playtest-after.json`, 00:43 UTC) against this branch (e156566f, 10:38 UTC).

| route | phase1's camera: frames over 100 m/s², worst | this branch |
| --- | --- | --- |
| west-house-to-plaza | 6; 1128 m/s², a 1.26 m jump | 2; 412 m/s², 0.51 m |
| plaza-loop | 4; 158 m/s² | 0 (max 94) |
| north-clearing-ledge | 6; 327 m/s² | 0 (max 88) |
| plaza-to-upper-house | 2; 330 m/s² | 0 (max 79) |
| the other five village routes | 0 | 0 |
| north-grove | (no grove in that build) | 1; 125 m/s², 0.14 m second difference |

The stairs keep the camera lane's numbers: climbing the main flight 3.78 m/s² of vertical acceleration (5bd1aeee
recorded 4.95), the south bank 5.25 up and 5.25 down (5bd1aeee: 5.25 and 5.26), no spikes.

The trade: the 95th percentile of the camera's acceleration is about 70 m/s² on every route where it was about 36. A
turn behind Link now runs at a bounded 75 m/s² for a few frames instead of peaking in one; `SWING_ACCEL` is the knob.

**In the grove**, where phase1's camera has no Chrome run, a node replay: the real `follow.ts`, `collision.ts` and
structures, Link's controller mirrored, at 30 fps. The grove is 4 routes (there, back, and hugging the veranda both
ways) × 12 variants of pace, arrival radius and steering = 48 replays; the village is its 10 routes × 6 = 60.

| replays | camera | worst pop (second difference) | frames over 100 m/s² | frames moving > 0.3 m | waypoints missed | frames within 1.5 m of Link |
| --- | --- | --- | --- | --- | --- | --- |
| grove, 48 | phase1 | 4.28 m | 370 | 441 | 0 | 23.4 % |
| grove, 48 | phase1's `follow.ts` + this `collision.ts` | 4.55 m | 388 | 475 | 0 | 9.1 % |
| grove, 48 | this branch | 0.26 m | 153 | 924 | 0 | 3.0 % |
| village, 60 | phase1 | 4.65 m | 69 | 46 | 0 | 2.7 % |
| village, 60 | this branch | 1.17 m | 32 | 54 | 0 | 1.9 % |

More frames move over 0.3 m because the camera now holds its distance behind a running Link instead of collapsing onto
him, and 4.3 m back a turn sweeps it further per frame. What reads as a pop is the second difference, at most 0.26 m in
the grove (check 44 asks for 0.3 m). The collision change alone does not fix the grove: it keeps a line along a round
wall at length (within 1.5 m of Link on 9 % of frames instead of 23 %), and the look-ahead and the swing take the pops
out. Re-run on the current build (b16d23c3, with the broken pot), all 48 grove replays come out identical.

Tests: `node --test src/camera/*.test.mjs` passes: `follow.test.mjs` (the camera lane's 12, unchanged) and
`walls.test.mjs` (4 new). The new ones check that a line along a wall's grown cells keeps its length and one through it
stops in front; that a round wall blocks to its surface, a tangent line passes and the air over its eave is free; that
walking and running round the veranda both ways the camera never pops over 0.3 m, never enters the wall and never
loses Link; and that a right-angle turn has no jump in its turn rate.

Left as they are: west-house-to-plaza still pops 0.66–1.17 m in 3 of 6 replay variants (phase1: 1.29–1.33 m in all 6)
and 0.51 m once in Chrome, at the west house's cap skirt; the plaza loop's U-turn has 1–3 replay frames just over
100 m/s² (0.12–0.18 m, where phase1's replay has none and its Chrome run has 4).

## What changed outside the grove's own files

The grove's own files are `src/world/structures/expansionNorth.ts`, `src/world/terrain/north.ts`,
`src/world/vegetation/expansionNorth.ts`, `src/world/util/groveLocality.ts`, `src/world/terrain/expansionNorth.test.mjs`
and `src/camera/walls.test.mjs`. The shared files each take a small addition:

| file | change |
| --- | --- |
| `src/world/layout.ts` | a new `EXPANSION_NORTH` block (the grove's places, sizes and walk numbers); no existing value moved. Inside it the stilt house's wall went 1.9 → 2.35 m and the tree hut's 1.8 → 2.3 m (137cee05), so the caps' rims hang 2.2 m over the decks |
| `src/world/terrain/heightfield.ts` | the live view inside `EXPANSION_NORTH_BOX` reads `terrain/north.ts`; the interface is unchanged and nothing outside the box moves |
| `src/world/terrain/material.ts` | the forest floor's patch grows by 57 rows on the same lattice (to z −130.1) and gives way to the grove's lawn |
| `src/world/hardscape/index.ts`, `flagstones.ts` | the grove flight and the trail's stepping discs, in a group drawn only near the grove |
| `src/world/character/ground.ts` | stands Link on the grove's discs and decks, and blocks him at the published walk edges (railings, deck sides) |
| `src/world/structures/index.ts`, `distantHouse.ts` | builds the grove; `distantHouse.ts` gains `doorSize`, `walkway.from`, `cameraWalls`, `seamlessRings` (whole texture repeats round the window tunnel, cap skirt, eave roll and platform rim) and `postPodsOutboard` (the walkway's post pods on brackets 0.28 m outboard); every default leaves the far huts and the expansion's houses as they were, and the 139 meshes outside the grove hash identically to f427afda |
| `src/world/structures/geometry.ts` (+ `geometry.test.mjs`) | `repeatsRound` and `seamUV` (a closed ring's uv with whole repeats and an extrapolated seam column), moved here from the grove so `distantHouse.ts` can share them |
| `src/world/structures/cameraSolids.ts`, `src/world/util/voxelGrid.ts`, `src/world/system.ts` | exact round walls for the camera (`CameraWall`), the grid's undilated core, `builtFootprints` for the vegetation to keep off |
| `src/camera/collision.ts`, `follow.ts` | see the camera section |
| `src/world/trees/index.ts` | the far layer keeps off the grove; a 16-tree understory zone appended last in the shared stream, so nothing else re-rolls |
| `src/world/vegetation/index.ts`, `grass.ts` | the grove's ground dressing (`vegetation/expansionNorth.ts`), shown only near the grove; `bladeGeometry` exported for the lawn's blade tiles. This is codex's directory: additions only |
| `src/audio/index.ts` | wood footsteps on the grove's planking (`onGrovePlanks`) |
| `gauntlet/scripts/playtest.mjs` | the `north-grove` route and `northProbes` |

The huts' doors are shut to Link: `shut()` in `expansionNorth.ts` closes the wall ring's door gap and puts its outer
edge `WALL_CLEAR` (0.16 m, his shoulder's half width) beyond the wall's widest bulge. Two notes on the history, which
is not rewritten: 7bf128ec's message says the rope walk's "east hand rope" is spliced, and it is the west one; and
97ba059a on its own does not typecheck (it reads two helpers that 34c100dc adds; both went up in the same push, and
every pushed tip builds).

## Known issues and what is left

- The stilt house's cap ties to nothing above it (check 35 scores 2 for it): it is a hut on a cut stump, and the only
  thing over it is sky and the understory's crowns.
- The huts are glimpsed, not entered: their doors are shut and their rooms are dark recesses.
- The camera issues listed in the camera section: the west house's cap skirt pop (improved, not gone), the plaza loop's
  replay-only frames just over 100 m/s², the 0.36 m swing (0.14 m second difference) at the trunk house's door.
- Not the grove's, seen while checking: the west house's wall ring (round 49's `distantHouse.ts` walk surface) is still
  ±0.2 m round its eave's radius, so where the wall's wobble swells Link's shoulder can overlap the wall (on the stilt
  house, before `WALL_CLEAR`, that was 0.16 m); `climb.main.reachedTop` is false since the hero flight grew to 26 treads (W02);
  phase1's own south far-bank look-back is 818 draws / 9.30 M triangles (exp-south2's, flagged in f04d9529).
⟨LEFT⟩
