# exp-south2: the log's exit, and dwellings on the way out (2026-09-24)

The owner, 2026-09-24 06:07 UTC: *"why is it white?"* (the end of the hollow log on the far bank)
and *"add more stuff and the structures from the screenshot ... more structures along the path
further down"*.

Branch `agent/fable-cursor-exp-south2`. Every image is 960×540 at `quality=high`, simulation time
12.5 s, character hidden, with the same camera before and after.

## 1. The end of the hollow log (`01-log-exit.jpg`)

**Before** (the build before `bc757dfa`): the walk into the log ended at a flat cream disc, an
emissive glow card behind haze veils. Inside the disc's own area the luminance was uniform
(p99 = p99.9 = peak ≈ 231.8 of 255): a flat colour, not a scene, with up to 0.2 % of the area at a
clipped channel.

**After** (`bc757dfa`): the disc and its veils are gone. The tube runs on to a snapped far end
(splintered rim, end grain) that opens into a cleft cut through the bank behind it: sunlit ground
with ferns, saplings, a fallen branch and a thicket of young white-bark trees closing the view.
The walk still stops at the dead end, now behind a curtain of roots grown down through the rotten
roof. No light source was added; the hollow's daylight bounce is re-tinted and falls off from the
far end.

Luminance (0–255, Rec. 709 weights) inside the old disc's area:

| View | Crop (x0,y0–x1,y1) | p99 | Peak | Max channel | Area with a channel ≥ 250 |
| --- | --- | --- | --- | --- | --- |
| L1, far path, 12 m out | 370,150–580,335 | 230.8 → 183.8 | 231.8 → 208.2 | 251 → 234 | 0.09 % → 0 |
| L3, 4 m inside | 290,60–675,400 | 231.8 → 189.7 | 231.9 → 214.0 | 254 → 239 | 0.19 % → 0 |
| L4, 6 m inside | 90,0–880,520 | 231.8 → 195.4 | 232.6 → 220.9 | 254 → 243 | 0.21 % → 0 |
| L7, at the dead end | 150,0–810,470 | 231.8 → 166.3 | 232.6 → 211.1 | 240 → 233 | 0 → 0 |

The brightest pixels left in the exit are sunlit leaves and ground in the glade (e.g. RGB
(233, 216, 138) in L3). The whole-frame peaks in the views from the far path are the two pod
lanterns at the log's mouth (≈ (252, 212, 143)), the same before and after. The last row of the
sheet looks back at the exit from the glade; before, that camera stood inside the hill, because
nothing existed beyond the disc.

Walk `south-bridge-to-log` 21/21 and the 41 south probes pass on `bc757dfa`.

### The far rim and the glade (`887e8d8e`, `02-exit-views.jpg`)

The snapped far end no longer stops at a bare ring of bark against the light. The log's moss cap
and the bank's turf roll over the rim: 66 moss cushions along the crown's last 0.6 m and
over the rim's outer edge (tipped out toward the glade), 18 grass and fern tufts standing on
the crown (those at the edge lean out over it), and 14 moss beards and runners off the rim,
short over the opening and longer down the flanks. From inside, the opening is framed by a soft,
shaded edge (`X3`, `X4`, `E-up`).

In the glade stands the children's slingshot target: a sawn round of a young trunk (0.27 m radius,
0.07 m thick) with its bark left on the rim, rings painted on its face in red ochre and cream,
worn thin, chipped and dented dark where stones struck, pegged with two pegs to a leaning stake.
It stands 2.6 m past the far end and 1 m west of the axis, facing the log, so it shows from the
dead end over the roots (`X4`, `T-diag`) and stays out of the look back from the glade (`G1`).
Face centre (3.56, 0.58, 57.13) (audit `south.log.cleft.target`).

## 2. Dwellings on the way out

Two structures stand where the path straightens for the bridge (layout.ts `EXPANSION_SOUTH_DWELLINGS`, built by
`structures/expansionSouthDwellings.ts`). Both sit in the wedge that `plaza-south`'s trunk hides from camera C, clear of
the walked line, the bridge corridor, the trees and fable-3's toll pile (the marker at (5.6, 27.7), the crate at
(5.4, 29.3), the squat pot at (5.95, 29.85)).

### The bridge keeper's hut: centre (7.1, 31.9), on the ravine's north lip 3.4 m east of the north sill

- A round hut (the village huts' builder, `distantHouse.ts`, with its walkway turned off): wall radius 1.15 m, wall
  1.9 m, a moss cap 1.1 m high with a fringe, platform top at y −0.07. The round door (0.70 × 1.35 m, recessed, with a
  threshold) faces the gallery's entrance at 220°. Behind it is a dim room lit by one small lamp: the reveal's lamp
  scales with the room's (`interiorLight` 0.1 for this hut, 1 for every other), so the jambs stay dark bark and the
  doorway is no longer one band of lit beige wood (`c2d8546d`). The round window at 123° watches the bridge, with a brow
  over it and flowers on its ledge. Herbs dry under the eave by the door.
- The mast: a dead snag trimmed to a pole, footed 3 m down the slope, rising through the cap and leaning 0.22 m over the
  gorge to a broken top at y 5.6. A stub arm out of its head carries the beacon pod over the gorge (7.01, 4.8, 32.73),
  its hauling rope running down to a cleat.
- The gallery: 46 tapered boards on two ring beams on radial outriggers, round the gorge side from −14° to 228°
  (wall angles; 0° east, 90° south), 1.37–2.25 m from the axis, each board pegged where it crosses the ring beams
  (91 domed peg heads). It is braced back to the mast (8 braces) where the lip falls away to −8 m, and propped on 3
  footings where it does not. The railing has 12 bark posts under a peeled top rail (polished where hands run along
  it), with a rope midrail. You step onto it from the path at the entrance (193–228°) over a split log bedded on the
  ground at both ends (0.10 m up from the ground, 0.16–0.21 m up to the boards), and leave it at the open east end
  down onto a split log laid along the end, its flat top's edge under the boards' ends (`9ea7f06d`, `K-step`). The
  ground falls 0.39–0.68 m under the deck there, so the log's top sits halfway between the deck and the ground a
  stride past it: two even risers, 0.20 m at the hut end and 0.15 m at the rim, deck to log and log to ground. It rests on 2 stumps where it clears the ground. Before,
  a log lay 6.5° past the end with a 5–13 cm strip of bare ground between them: walking off the end, Link dropped
  0.47 m into the strip and stepped back up onto the log (one stance foot 0.154 m over the ground for a frame),
  and the log hung 9 cm over the ground along its axis.
- What Link walks on: 14 chords 0.72 m wide round the boards (1.38–2.10 m out), a disc at each of their 13 joints,
  and over the entrance, where no railing stops him short of the boards' ends, four short chords out to 2.28 m, with
  the west step's walk reaching 7 cm in under them. A strip just inside each end line covers the sliver the chords'
  square ends left. Each of these was a stop on the way in after the merge's slower gait (walk 1.2 m/s):
  - `7436dabb`: the chords' square ends left a wedge outside each joint, 5 cm wide 0.25 m out. Over the gorge and
    beside the bridge the ground under it is a drop (the bridge's side rule refuses it), and Link stopped dead on
    the boards at 210.7°.
  - `1aa32afc`: the chords' walk ended at 2.10 m, the boards at 2.25 m, and the west step's walk began at
    2.29–2.34 m. Beside the bridge the ground between is refused, and Link, walking in off the step, stood on it at
    (5.32, 30.71) with every stride landing short of the deck: the play-test's `south-dwellings` missed its next
    three waypoints there. The same commit's end strips took away a one-frame float at the east end (a stance shoe
    0.115 m over the step's walk, where the chord's end fell 3 cm short of the boards' end).
  The play-test now sweeps the gallery every 0.5° at 1.45, 1.74 and 1.95 m, at the entrance also at 2.05, 2.20
  and 2.24 m, and 1 cm inside both end lines every 2 cm (1,683 samples, every one on the deck at its height; before `1aa32afc` three were off it, at both ends and at the entrance's edge), and walks five lines in off the west step
  (200–220°, every 1 cm), which must never be refused, never dip below the step and rise at most 0.28 m
  (each goes from the step's top, −0.23 to −0.27 m, straight onto the deck at −0.07 m: risers 0.16–0.20 m).
- Use and repair: the 5 boards between the entrance's step and the door are trodden greyer and paler, their moss worn
  off; one board at 78° is a newer, browner replacement; one at ≈ 136° has lost 0.22 m of its outer end (jagged).
- A davit over the drop: a bent pole socketed through the boards and lashed to the rail, a turned block under its tip,
  and a bucket of twelve staves with two hoops on 1.55 m of rope over the gorge. The hauling end is tied off round the
  next post.
- Pods: the beacon; an orange pod on an arm off the gate post at the entrance (4.64, 1.66, 31.29); and a lime pod on a
  bracket off the lamp post at 150° (4.83, 1.36, 32.9), a lime among the orange as the village hangs them. All three
  hang clear of the walk from hangers on their arms. They are static and emissive; no light is added. The gate pod
  lays a soft warm pool on the gallery boards and the ground by the entrance, and the lime pod one on the boards under
  it (additive vertex colour fading to nothing over 1.2–1.5 m and dimming with distance like the haze; the beacon,
  4.9 m over the deck, lights nothing).
- By the north wall: 15 split logs in three rows between two stakes under the eave, and a chopping block (a log round
  with a checked, dished top) with a billet leaning on it, moss at its foot on the shaded side.
- The follow camera: the hut's wall is one of canonical's camera walls (`ctx.shared.cameraSolids.walls`, a
  `CameraWall` of radius 1.29 m from the gallery's boards to the wall's top). The voxel grid leaves the wall out
  (grown by one voxel it had reached 1.93 m on the diagonals, over the gallery, and pinned the camera), and
  canonical's round-wall collision and ring trailing (`camera/follow.ts`) carry the camera round the gallery. Since
  the merge `77ed21f9` the lane's own camera cylinders and `wallSwing` (`5b8dde39`, `066144ad`) are gone and
  canonical's camera code is untouched. `follow.test.mjs` walks Link round the gallery as the play-test steers him,
  both ways, at the controller's walk and run (1.2 and 2.2 m/s since #165, `ae86c580`) and at the older 1.6, 3 and
  4.6 m/s: from 1.2 to 3 m/s the camera stays 4.36–4.51 m from him with pops of 0.081–0.103 m; at 4.6 m/s it eases
  in to 1.40–1.65 m ahead of the wall (pops 0.135–0.168 m). In all ten walks every waypoint is reached, the camera
  stays 2.02 m or more from the hut's axis, and the wall is never between it and Link.
- 59,718 triangles.

### The waystation: centre (5.12, 25.95), facing −74° (open to the path), floor y 0.22

- A lean-to built against `plaza-south`, 2.0 × 1.35 m, beside fable-3's waymarker. One of the giant's roots is its
  front-north corner post: it leaves the bole 2.4 m up (4.32, 2.42, 23.54), 0.25 m above the front plate, runs under
  the roof's north edge and turns down at the corner into the ground at (4.27, 25.24), 4.72 m long; its radius is
  0.27 m at the bole, 0.09 m as a post and 0.11 m at the ground. Moss grows along its top, ivy where it leaves the
  bole, and a collar of foot moss where it roots. The front plate's north end rests in its elbow, lashed with two
  turns of rope. The other three posts are sawn poles. (Without the trees system's seat the builder falls back to
  four sawn posts.)
- A plank floor of 12 boards on two bearer logs on sunk stumps, each board pegged over both bearers (24 peg heads);
  plates and five rafters, each ending 0.1 m inside the roof's lobed edge. The roof is a moss cushion, 1.95 m high at
  the front and 1.65 m at the back, over a bark underside: its rim rolls over and down all round (the roll's depth
  wanders along the edge), 84 moss lumps sit along the rim and 90 on the cushion, and where the root passes the moss
  drapes over it. Moss beards, leaf clusters and hanging vines hang along the front eave, a few along the back and
  the ends.
- A palisade of split poles at the back, with a round window and a shutter propped open outside it (hinged on withy
  loops round two poles), and a half-height palisade (0.95 m) at the north end whose two withy ties end at the root.
- Inside: a bench (a split log on two stubs with a board seat) 0.1 m off the back wall, a woven basket beside it, a
  walking stick against the front-south post, and a rope coil hung on the root. Outside: 18 split logs in three rows
  against the north end.
- The follow camera (`30f90b6d`): canonical's camera keeps 0.6 m from Link's aim (1.5 m over his feet) whatever
  stands behind it, and its level line meets the back wall 1.74–1.81 m up. With the back wall at 1.30 m that line
  cleared it, passed through the roof (a slim part, which the camera may look through, like the keeper's eave) and
  stood the camera behind the hut with Link hidden; facing south, the 0.6 m clamp put the camera in the full-height
  north palisade. Now the back wall stands 1.65 m high and stops the line, a row of walk blockers over the bench
  holds Link 0.64 m or more from the wall's inner face so the clamp leaves the camera inside, under the roof, and the
  north end is a half wall the camera looks over. (Looking down from inside, the camera still rises through the slim
  roof, as it does through the keeper's eave.)
- Use and repair: 7 floor boards over the steps are trodden paler, most at the front edge where feet land, and the
  steps' tops are worn too; the north corner board has lost 0.13 m of its front end.
- The steps up from the path: two split logs along the front (`422c5df9`, `W-step`). The ground in front falls from
  0.36 m under the floor at the north end to 0.73 m at the south. The upper log's top parts that into even risers,
  two of 0.19 m at the north end and three of 0.20–0.27 m (floor to upper log 0.22 m, upper to lower 0.20–0.27 m, lower to ground 0.16–0.20 m) at the south; the lower log, laid in front of its south
  part, takes the third. Every riser is 0.16–0.27 m (the single log's 0.36 m risers at the south end had one of Link's
  shoes sunk 0.17 m into it while the other hung 0.59 m over the ground). Both logs rest on stumps where they clear
  the ground (4 stumps).
- Until `f6ba842c` Link could not get onto the floor. The upper log stood 9 cm off the boards' ends and its walk
  stopped 16.5 cm short of the floor's, over ground 0.56 m under the floor (past the 0.55 m step guard): he
  stepped into the gap and turned back. The play-test passed anyway, because a waypoint counted as reached within
  0.5 m, and the floor's waypoint was within 0.5 m of the gap. Now the upper log's back edge is tucked 3.5 cm under
  the boards' ends, its north end stops clear of the root post, and the floor's, the upper log's and the lower
  log's walks overlap. The route's floor waypoints must be stood on at the floor's height (within 0.2 m, y
  0.22 ± 0.06), and four lines out of the floor over both steps must stay built with no riser over 0.28 m
  (floor 0.22 m, upper log 0.00–0.02 m, lower log −0.18 to −0.26 m: risers 0.20–0.26 m). The footsteps sound wood over both logs.
- A pod (4.66, 1.82, 26.66) hangs from a hanger under the front plate; it lays a soft pool on the floor and out of the
  open front onto the path, never past the back or the north wall.
- 33,430 triangles.

Both: no point light, 5 light pools, 69 walk surfaces appended to `ctx.shared.walkSurfaces`, parts named for the
follow camera's solids (`cameraSolids.ts`: the walls solid, the keeper's eave over the gallery and the waystation's
roof, posts and root slim), own rng fork, meshes folded into the south group's existing buckets before consolidation.
With the parts they share (the four static pods, 19,698; foot moss, the hut's fringe, hangers, leaves, vines, the
pools) the dwellings add 126,888 triangles (audit `southDwellings`, on `b34f66a5`). Pools and wear draw no random numbers, so nothing else in the stream
moves.

## 3. The look back from the far bank: a far-bank LOD

The integrator measured the look-back from the far bank (camera (4.8, 2.6, 43.6) → (2, 0.8, 24), fov 46) at
**818 draws / 9.30 M triangles** on the canonical head (cc02a9cf), against the 700 / 9.0 M budget. From
there the frustum takes in the whole village, seen through haze beyond the gorge and between the south
giants' boles. Hiding the village is not an option: it is on screen from all 10 far-bank poses tried,
with up to 7,481 pixels changed. Walking back over the bridge the follow camera has the same view, nearer:
in play mode (Link drawn, shadow pass included) Link on the bridge facing north drew 700–719 draws /
9.8–10.2 M, and at the south sill and the log's mouth 711–725 / 10.4–10.8 M, without the LOD.

While the camera is inside `FAR_BANK_ZONE` (`util/farBankLocality.ts`: x −2…15, z 30.45…62, under y 4) or
its corner `FAR_BANK_BEND` (x −2…3.2, z 28.5 up to the zone), five things change. The zone starts at the bridge's north sill (`56fcd773`; it started 4 m past the
sill until this session). The follow camera stands 4.3 m behind Link's aim (4.04 m or more in plan at
up to 20° of pitch), so walking back it stays inside while Link crosses the bridge, steps off the sill
and walks the path's last straight to its bend, all the while facing the village. With the zone 4 m
further south the camera left it as Link stepped off the sill, and the walk-back's frames there ran
over budget: just off the sill 703 draws / 10.08 M, at the bridge head 718 / 10.15 M (play poses
`N-sill-out`, `B0-N`, LOD off), and 684–715 draws / 9.77–9.92 M on the walk. At the bend the path turns
him north-west, the camera swings round behind him and soon leaves the zone as the village swings
out of the frustum (turned at the bend, `P3-N`: 583 / 7.73 M).

The dwellings brought two more places where the camera faces the village from just outside the zone
(`cdaa3a6c`; the dwellings walk, section 7, found them: 4 of its 92 drawn frames over 9.0 M, all with
the camera outside the zone as it was). Off the keeper's gallery's east end and back west, the camera
trails Link 11.6–12.1 m east, past the zone's old edge at x 11: 648–673 draws / 9.13–9.47 M there,
8.4–8.7 M a stride either side where it was inside. The zone now runs east to x 15 (Link at the east
step's end facing back west puts the camera 14 m east). Turning off the path onto the waystation's
steps, Link faces north-east and the camera swings round south-west of him, from z 30.1 to 28.7 at
x 2.4 to 1.3 with the village still in the frame (heading 155° to 126°; at (2.2, 29.7) 613 / 9.47 M).
The corner `FAR_BANK_BEND` covers that swing; the path's last straight (x 3.3–3.7) and the waystation
stay outside it. From the zone and its corner the nearest village mesh is 17 m off (audit
`farBank.nearestVillageM`; 27 m from the first zone's edge). Its south part `FAR_BANK_SOUTH` (z 42.5
on: the bridge's last 1.2 m, the far path, the log and the cleft; x −2…11, as measured) adds a
shadow reach. The keeper's hut is inside the zone (the LOD never touches the south group); every
fixed viewpoint, the path to the bridge head and the waystation stay outside, and tests pin the
boxes to the layout and the trace's camera positions.

1. **The village's shadows and tufts** (`de967e3d`): the village structures stop casting shadows, and
   their roof and trunk tuft buckets are not drawn.
2. **Pods at rest** (`f46c4835`): the village's swinging pods, one draw each, fold into one static draw
   per material and visibility group. The swing moves a pod by at most 4 cm, under a pixel from 40 m.
   The south's own pods stay live.
3. **Fine dressing and small far shadows** (`86e9b380`): the village's centimetre-scale dressing is not
   drawn: room props seen through doorways, fringes, flowers, the bough's vines, post ropes, hanger
   toggles, fence foot moss and sign runes. Frames, thresholds and every glow stay. Casters with a
   bounding radius ≤ 1.5 m whose near side is more than 25 m away cast no shadow
   (`FAR_BANK_SMALL_SHADOWS`); the player 3–6 m away is untouched.
4. **A draw distance for small far things** (`48877906`): drawables with a bounding radius ≤ 1 m more
   than 110 m away are not drawn (`FAR_BANK_SMALL_DRAWS`, `postfx/shadowcull.ts` `hideSmallFar`). From
   the zone that is the girl on the upper ledge, 120 m north and 6 px tall in the haze, with her fairy
   and contact decal. Such a sphere spans at most 12 of 540 rows at fov 46.
5. **The far bank's shadow reach** (`f1494e57`): while the camera is in `FAR_BANK_SOUTH`, a caster
   whose bounding sphere lies wholly more than 20 m outside that box in plan casts no shadow
   (`FAR_BANK_SHADOW_REACH`, a box rule in `postfx/shadowcull.ts`). From the log's mouth that is 35
   casters: the giants' two far sector meshes (the lantern tree, north-west, north-east; the plateau
   oak, far plateau, east giant and stair-bank giant: 510 k triangles), the far terrain chunks, the
   east columns, the backside rocks, the west house and its fence, the village's rope and wood props.
   The sun stands in the north-west, so their shadows fall east and south-east of them, 30 m and more
   from the far bank, in the haze. The nearest giants (south-centre, plaza-south,
   south-giant), the white-barks, the ravine's strata and the keeper's hut keep casting. The reach is
   measured from the box, not the camera, so nothing switches while the camera moves on the far bank.

`globalThis.__KF_FARBANK_OFF__ = true` switches all five off from the next frame, without a reload,
so the A/B below compares exactly what the LOD changes. It is unset as shipped.

⟨AB⟩

Rejected along the way: hiding the whole village (on screen from every far-bank pose); judging each
instance of an instanced batch by its own size (it also switched off the ravine strata's shadows at
the cleft). An instanced batch is judged by its whole batch, and a test pins that.
