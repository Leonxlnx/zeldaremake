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

## 2. Dwellings on the way out

**Status (interim, `a0795842`):** the description below is final. Typecheck, build and the tests (187 / 187) pass
on `a0795842`. The walk, probe, camera-spot, pose-count and render evidence and the 50-check rubric tables
(`docs/RUBRIC_50_STRUCTURES.md`) are queued behind the box's two capture slots and follow in the next commit.

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
  ground at both ends (0.10 m up from the ground, 0.16–0.21 m up to the boards), and leave it at the east end down a
  log laid along the slope (0.20 m over the ground at both ends).
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
- The follow camera: the wall is an exact camera cylinder (radius 1.29 m, `5b8dde39`; grown by one voxel it had
  reached 1.93 m on the diagonals, over the gallery, and pinned the camera), and walking round the gallery the camera
  swings off the wall instead of snapping in (`066144ad`, `collision.ts` `wallSwing`).
- 59,446 triangles (its rope work 21,152 of them).

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
  the front and 1.3 m at the back, over a bark underside: its rim rolls over and down all round (the roll's depth
  wanders along the edge), 84 moss lumps sit along the rim and 90 on the cushion, and where the root passes the moss
  drapes over it. Moss beards, leaf clusters and hanging vines hang along the front eave, a few along the back and
  the ends.
- A palisade of split poles at the back, with a round window and a shutter propped open outside it (hinged on withy
  loops round two poles), and a palisade at the north end whose two withy ties end at the root.
- Inside: a bench (a split log on two stubs with a board seat) along the back wall, a woven basket beside it, a walking
  stick against the front-south post, and a rope coil hung on the root. Outside: 18 split logs in three rows against
  the north end.
- Use and repair: 7 floor boards over the step are trodden paler, most at the front edge where feet land, and the
  step's top is worn too; the north corner board has lost 0.13 m of its front end.
- The step up from the path: a split log along the front whose top sits halfway between the ground in front of it and
  the floor at either end (two even risers: 0.19 / 0.19 m at the north end, 0.36 / 0.36 m at the south, where the
  ground falls away), on two stumps where it clears the ground.
- A pod (4.66, 1.82, 26.66) hangs from a hanger under the front plate; it lays a soft pool on the floor and out of the
  open front onto the path, never past the back or the north wall.
- 32,956 triangles.

Both: no point light, 5 light pools, 39 walk surfaces appended to `ctx.shared.walkSurfaces`, parts named for the
follow camera's solids (`cameraSolids.ts`: the walls solid, the keeper's eave over the gallery and the waystation's
roof, posts and root slim), own rng fork, meshes folded into the south group's existing buckets before consolidation.
With the parts they share (the four static pods, 19,698; foot moss, the hut's fringe, hangers, leaves, vines, the
pools) the dwellings add 125,042 triangles. Pools and wear draw no random numbers, so nothing else in the stream
moves.

## 3. The look back from the far bank: a far-bank LOD

The integrator measured the look-back from the far bank (camera (4.8, 2.6, 43.6) → (2, 0.8, 24), fov 46) at
**818 draws / 9.30 M triangles** on the canonical head (cc02a9cf), against the 700 / 9.0 M budget. From
there the frustum takes in the whole village, 27.7 m and more away (the structures' audit
`farBank.nearestVillageM`) and seen through haze between the south giants' boles. Hiding the village is
not an option: it is on screen from all 10 far-bank poses tried, with up to 7,481 pixels changed.

While the camera is inside `FAR_BANK_ZONE` (`util/farBankLocality.ts`: x −2…11, z 42.5…62, under y 4,
which covers the bridge's last 1.2 m, the far path, the log and the cleft), four things change. Every
fixed viewpoint, the bridge, and both dwellings stay outside the zone, and tests pin the box to the
layout.

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

`globalThis.__KF_FARBANK_OFF__ = true` switches all four off from the next frame, without a reload,
so the A/B below compares exactly what the LOD changes. It is unset as shipped.

(The A/B table, LOD on / off / on at the look-back, P3, L9, F4, F6 and mid-span, follows with the capture queue.)

Rejected along the way: hiding the whole village (on screen from every far-bank pose); judging each
instance of an instanced batch by its own size (it also switched off the ravine strata's shadows at
the cleft). An instanced batch is judged by its whole batch, and a test pins that.
