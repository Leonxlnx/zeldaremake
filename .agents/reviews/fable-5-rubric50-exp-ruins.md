# fable-5 — the 50-point rubric, non-author pre-merge read: the waterfall ruins (`agent/fable-cursor-exp-ruins` @ `744a3b1e`, the owner's 10:58 "ruins building") — 2026-09-24 13:31–15:04 UTC

The hidden valley 40–80 m west of the village: a packed-earth **trail** from the west house's stepping discs between three
**pod-lantern posts** to two **gate boulders**, a pale **outcrop** with a tiled **parapet** over a **pool**, the worn **flight**
(8 × 0.2 m) cut into the **terrace**'s front, the **hero arch** (twisted shafts, a carved boss under the keystone), the
paved terrace with a **colonnade**, fallen drums and a **half-fallen arch** against the west **cliff**, the **fall** off the
cliff into the pool, a **slab bridge** across the pool's west end, and the great **"ivy rock"** right of the flight. The
author's reference: `reference/frames-dense/review46/r_036–r_043` (the trailer's ruins shot).

Read at player height with the follow camera at 24 spots (`fable-5-lane10/spot.mjs`, now with a pitch option — the
rubric's 60° up / 35° down are the follow camera's own limits `PITCH_UP` 1.05 / `PITCH_DOWN` −0.62), the branch's own
`plaza-to-ruins-terrace` route with its 60 probes and 216-sample camera sweep (`walk-ruins-744a3b1e.json`), directed
walks with per-frame feet (`fable-5-lane10/feet.mjs`, `feet-ruins-744a3b1e.json`), the six-view family split on the head
`3c6cc553` and the branch, and the same spots on the head for the item's own cost (`spots-ruins-744a3b1e.json`). The
branch's merge base is `cc02a9cf`; the head's four later commits are docs, so the head build is a clean "before".
Typecheck green, the branch's 143 tests green, no `Math.random` in its `src` changes. Sheets in
`fable-5-rubric50-exp-ruins/`.

## What is right, in one glance

**It reads as the reference's place** (`it110-ref-vs-ours.jpg`, `it110-ruins-sheet.jpg`): from the trail's first post
(18 m) the arch, the fall and the pillar are one glance; between the gate boulders the whole composition of r_038 stands
— the flight to the arch, the tiled parapet with its basin finials, the fall behind, the pale rock. The flight is the best
piece of stone on the branch: the treads sag, their nosings are chipped, moss lines the risers' feet
(`it110-detail-and-pitch.jpg`, first frame). The parapet's ring-tile band with the carved strip and the finials is the
reference's. **The route walks all of it — 26 / 26 waypoints, 0 stuck, 77.9 m; the probes 60 / 60; wading 0.25–0.7 m
before the pool holds him; the follow camera's worst one-frame move on the route 0.14 m (the rubric's limit 0.3), its
minimum 1.62 m over the ground; the boots on the flight float ≤ 0.7 cm.** The ruins themselves are cheap: +44–55 draws
and ≤ +0.1 M triangles over the head at their own poses (the reference pose 114 → 158 draws / 0.83 → 0.92 M; the gate
118 → 173), and the six hero views do not see them (A 638 / 8.87 M). No frame of the 24 holds a clipped white
(0.00 % of pixels at ≥ 250 in every one).

## What fails now, and where

1. **The "ivy rock" carries no ivy** (`it110-ref-vs-ours.jpg`; every frame with the pillar in it). The reference's
   pillar is the frame's signature — a wall of leaves from foot to crown. The branch's is a fissured grey column with a
   mossy dome and ferns at its foot (`rock.ts` "a bulging, fissured column … a mossy domed crown"; `expansionRuins.ts`
   dresses only "the cliff's foot and the ivy rock's"). At the reference pose it fills the right third of the frame as
   bare rock (l 0.166 vs the reference pillar's 0.302). The single biggest distance from the reference.
2. **The stone is half the reference's value at the matching pose, and the flight sits in shadow where the reference
   has it sunlit.** At Link (−57, −4.3) facing west: the flight + terrace front l 0.286 (p10 0.192 / p90 0.439) against
   r_038's 0.581 (0.457 / 0.735); the outcrop underfoot 0.232 vs 0.573; the whole frame 0.298 vs 0.452, 47.9 % of it
   under l 0.25. The pillar's shadow crosses the outcrop and the flight; the reference's light pours through the arch
   onto the stair. The owner's "the stones are good" (06:07) was said of fable-2's pale hero flight — the same standard.
3. **The follow camera at the fall's natural viewing spot** (`it110-camera-cases.jpg`, first frame): the terrace's
   south-west corner by the cliff, Link at (−73.8, −2.9) facing the fall — the camera pulls to 0.6 m behind him and
   1.5 m up: **Link leaves the frame**, Navi at the lens fills a sixth of it, the sheet is a thin ribbon at arm's length.
   The author's sweep records this spot as 21 / 24 headings against a solid, camera 1.56 m from Link. The same fix as
   the grove's platform: a close mode (camera pulled in, raised, pitched down) or the cliff as a shell the pull-in eases
   against.
4. **The pool's east shore** (`it110-camera-cases.jpg`, second; `it110-ba-head-vs-ruins.jpg`): Link at (−52.8, 3.35)
   facing the fall — the camera at (−48.5, 4.5, 3.35) sits inside an understory crown (a leaf card cuts the frame corner
   to corner) and a leaning trunk fills a third of it. The head's forest, not the branch's — the same pose on the head
   shows the same trunk and cards — but the branch makes the shore a place the player walks (`outcrop-and-shore`
   probes). `ruinsTrunkCull`'s 0.9 m ring keeps boles off the trail and the site; the shore needs the south route's
   rule for crowns (`MID_SOUTH_WALK_MIN_M` 7.5 m) as well.
5. **The two look-backs east are over the budget, and the head is already over there** (`it110-ba-lookbacks.jpg`):
   the trail's middle (−33.4, 0.6) facing east **832 draws / 10.27 M** (head 808 / 10.55 M — the branch adds 24 draws
   and removes 0.28 M of boles); the terrace through the arch (−68, −4.6) facing east **744 / 8.97 M** (head 700 /
   9.21 M); the east shore facing east 758 / 9.35 M. The cost is the village seen from the west — its west woods'
   crowns and the houses — which no fixed frame and no walk reached before; the trail now makes those poses places the
   player stands, like the south's far-bank look-back (818 on the head per the 11:20 full check). The fix is the
   village's west face (the trees' west-facing tiers), not the ruins.
6. **The third post stands where the camera does** (`it110-camera-cases.jpg`, third; the outcrop frames): the post at
   (−55.1, −2.62) on the outcrop by the parapet's east end is 1.5–1.9 m from the lens for anyone at the parapet looking
   at the pool or the fall — in three of my four parapet frames its pod fills a tenth of the frame at the top-left. A
   post on the trail's verge before the gate would light the way as well.
7. **Looking up, the site has no ceiling** (`it110-detail-and-pitch.jpg`, frames 4–5): from the outcrop or under the
   arch at 60° up the frame is the fog's flat grey with the pillar's bare top and the arch ring — no gorge wall, no
   canopy. The reference's ruins sit in a gorge whose walls and trees close the sky.
8. Smaller: the colonnade's architrave is a plain box and its top bare; the fallen drums are true cylinders; the
   half-fallen arch is two piers with no ring fragment, so it reads as two piers; the broken-arch corner in the cliff's
   shade is a grey mass on a grey cliff (76.9 % of that frame under l 0.25); the wall's waterline shows only a faint wet
   band; the forest floor north and east of the site is a flat lawn with trunks in the mist.

## The harness's one number I could not reproduce

The route's feet: `footprintLowestM` p50 0 / p95 3.0 cm / **max 15.0 cm** (a boot floating). Directed walks over every
leg of the route with per-frame feet (`feet-ruins-744a3b1e.json`: the plaza to the discs, the discs, the bend, the
trail's four straights, the outcrop → flight → arch → terrace run) give a worst of **4.7 cm on the stepping discs** and
0.7 cm on the flight — nothing near 15 cm. The harness keeps no per-frame feet in its JSON, so the 15 cm sample stands
unlocated; it is one sample of 1,467, most likely a waypoint turn on the discs. Not the ruins' stone.

## Scores with evidence

Seven checks do not apply to a roofless, doorless ruin — 4 (no sibling), 26, 27, 29, 30 (no doors or windows: the arch
is a free-standing opening), 31, 32 (no roof) — left out of the total and scaled, as fable-3 did for the prop clusters
(06:40), pending fable-cursor's rule.

| # | check | score | evidence |
| --- | --- | --- | --- |
| 1 ★ | reads as what it is from 20 m | **4** | the arch, the fall and the pillar from the first post at 18 m (`trail-lantern-1`); r_038's composition between the gate boulders (`gate`) |
| 2 | Kokiri scale | **3** | flight 2.4 m wide / 0.2 m risers, parapet 0.95 m at Link's chest, hooks at 2.3 m; the arch (2.9 m span, 2.9 m shafts + ring) is grand, as the reference's |
| 3 | irregular, hand-built outline | **2** | true cylinders on square plinths, a box architrave, cylinder drums, a regular ring; the paving (missing slabs), the chipped treads and the rock are the irregular parts |
| 5 | holds up from above and below | **3** | 35° down: paving, flight and bases read (`terrace-down35`, `stair-down35`); 60° up: the fog's flat grey with a bare rock top (`outcrop-up60`, `arch-up60`) |
| 6 ★ | every part visibly held | **3** | arch on shafts on plinths, architrave on shafts, the slab bridge on the wall and a rock pile, pods on lashed hooks with cords; the pendant reads as hanging from the keystone |
| 7 | joints meet | **3** | the flight's blocks, the paving, the coping and the springing meet in every close frame; not every joint checked |
| 8 | load paths make sense | **3** | masonry block on the outcrop against the cliff; the parapet's posts on the wall |
| 9 | trim and edges finished | **3** | coping, tile band, carved strip, finials, nosings; the terrace's north edge is a bare drop with no coping (`colonnade`) |
| 10 | small construction detail at 2–5 m | **4** | ring tiles, tread chips, moss lines in the joints, the pods' ribs and calyx, the posts' lashings and vines (`stair-treads-close`, `parapet-tiles-close`) |
| 11 ★ | stone reads as stone | **4** | worn treads, the outcrop's cracked pale skin, the cliff's fissures |
| 12 | texel density matches | **3** | consistent; the outcrop's crack pattern is the sharpest surface beside the softer masonry |
| 13 | colour and value in the palette | **3** | pale grey-cream stone, moss, amber pods, the reference's blue tile band; but l 0.29 vs the reference's 0.58 at the matching pose (fail 2) |
| 14 | roughness and sheen | **3** | matte stone, the pool's reflection, foam rings at the plunge |
| 15 | no stretching, seams or repeats | **3** | none seen at 3–10 m; the shaded cliff is one tone |
| 16 ★ | weathering follows exposure | **3** | moss on tops, in the joints, at the risers' feet, on the piers' caps and along the slab bridge; ferns in the cliff's shade; but no ivy on the ivy rock (fail 1) and a faint waterline |
| 17 | wear follows use | **4** | sagging treads with chipped nosings, the packed-earth trail |
| 18 | signs of life | **3** | three tended pod posts light the way; basins on the parapet; nothing else — right for a ruin |
| 19 | damage plausible and sparse | **3** | five fallen drums, a broken stump, missing slabs; the half-fallen arch reads as two piers |
| 20 | nothing brand-new | **3** | the tile band is crisp and unbroken; the ring's voussoirs clean |
| 21 ★ | sits in the terrain | **4** | the terrace abuts the cliff, the outcrop eases out over 1.8 m, the wall's foot is under the water (`pool-shore-south`), the trail's grade smoothed |
| 22 | no floating corners, nothing buried | **3** | boulders and posts seated (foot stones), the slab's ends closed; not every drum checked underneath |
| 23 | contact shadow / AO | **3** | cast shadows from the pillar and shafts; the pavers' bevel gives a joint shadow |
| 24 | vegetation grows around it | **3** | tufts at the flight, ferns at the cliff and pillar feet, grass in the missing slabs; the trail's east verges and the floor beyond are a flat lawn |
| 25 | paths lead to it | **4** | discs → trail → gate → flight → arch → terrace |
| 28 | openings face where people come from | **4** | the arch on the flight's axis, facing east |
| 33 | thickness at every edge | **4** | the ring, the slabs, the coping |
| 34 | tops carry growth | **3** | moss caps on the piers, the pillar's crown, the slab bridge; the architrave and the ring bare |
| 35 | ties to the rock it grows from | **3** | the terrace and the broken arch against the cliff; the fall's notch in the cliff |
| 36 ★ | pods glow warm and steady, believable hangers | **4** | three pods on lashed bent posts with cords; the same amber in every frame |
| 37 | light pools restrained | **3** | soft warm pools under the posts (`trail-lantern-1`) |
| 38 | no clipped whites | **4** | 0.00 % of pixels at ≥ 250 in all 24 frames (the fall's sheet, Navi and the pods included) |
| 39 | reads in lit shafts and in shade | **2** | the broken-arch corner 76.9 % under l 0.25, piers on cliff one grey; the flight in the pillar's shadow at the hero pose (fail 2) |
| 40 | no distance-toggled real-time light | **4** | no light sources by the commit (emissive pods, ground pools); 204 programs constant from the plaza to the shore with the default warm-up (the 121 → 131 under `warmup=0` is the warm-up's job) |
| 41 ★ | Link walks every surface | **4** | 26 / 26, 0 stuck, 77.9 m |
| 42 | edges block him | **4** | probes 60 / 60; the pool holds him after 0.25–0.7 m of wading |
| 43 | steps walkable and even | **4** | 8 × 0.2 m; boots on the flight ≤ 0.7 cm |
| 44 | camera never inside, never pops > 0.3 m | **2** | route max 0.14 m, no inside on 216 sweep samples; but Link out of frame at the fall's viewing corner (fail 3), the camera in a crown at the east shore (fail 4), 1.6 m at the third post |
| 45 | footsteps on the right surface | **3** | flight / paving stone, outcrop rock, trail earth by `744a3b1e`; not heard headless |
| 46 ★ | caps at every hero view and the item's own | **3** | six views under both caps (A 638 / 8.87 M); the site's own poses 112–275 draws; the look-backs east 832 / 10.27 M and 744 / 8.97 M are the village's cost (fail 5) |
| 47 | hidden when far or off-screen | **4** | `ruinsVisible` locality: 11 ruins meshes / 92 k triangles in the scene, none drawn at A / C / E; the six views inside −0.003 |
| 48 | deterministic | **4** | `ctx.rng.fork('ruins')` and its forks; no `Math.random` in the branch's `src`; the water on one time uniform |
| 49 | belongs to this forest | **4** | the trailer's ruins in the village's stone, moss and pod language |
| 50 | the owner would stop and look | **4** | the fall behind the tiled parapet, the flight to the arch |

**43 checks scored, 144 / 172 → 167 / 200 scaled** — three points under the 170 gate, no check below 2, every ★ at
3–4. The three 2s are #3 (outline), #39 (shade) and #44 (the two camera cases). Fails 1 and 2 (the ivy, the value and
the light on the flight) are what separates this from the reference; fixing them lifts #13, #16 and #39 and clears the
gate.

## The six views, the one draw, and the warm-up (14:45–14:55 UTC)

**Six-view pair, head `3c6cc553` ↔ branch, same shot list and flags** (`broll.mjs --test --settle 8 --quality high
--size 1280x720`, `it110-h-six` / `it110-r-six`):

| view | SSIM head↔branch | pixels changed | vs reference head → branch | Δ |
| --- | --- | --- | --- | --- |
| A_stairs | 0.9998 | 0.01 % | 0.1765 → 0.1768 | +0.0003 |
| B_house | 0.9988 | 0.06 % | 0.1705 → 0.1704 | −0.0001 |
| C_lookback | 0.9993 | 0.06 % | 0.1742 → 0.1734 | −0.0008 |
| D_log | 0.9984 | 0.04 % | 0.2362 → 0.2371 | +0.0009 |
| E_ground | 0.9984 | 0.04 % | 0.1913 → 0.1913 | 0 |
| F_canopy | 0.9846 | 2.0 % | 0.1955 → 0.1949 | −0.0006 |

All six inside the −0.003 budget. F's 2 % is grass and leaf sway at a slightly different wind phase between the two
runs (the diff mask is speckle over every blade and the near leaf clusters; the crops show the same leaves a few
pixels over) — not geometry.

**The one draw**: the per-system scene audit at A / C / E (`it110-bysystem.mjs`): the branch adds `ruins` (11 meshes,
91,956 triangles in the scene, **none drawn** at the hero views — the locality holds, #47), adds 59 vegetation meshes
(the site's own pass) while removing 6,473 grass instances under the trail and the site, and removes trees: 5.19 →
4.92 M scene triangles, **one tree instance fewer in every hero frustum (two at C)** — a bole `ruinsTrunkCull` drops
that every hero frame was drawing without showing it (the pixel change at A–E is 0.01–0.06 %). A draw the branch
happens to save; the frames do not move.

**Shader compiles with the default warm-up** (`spot.mjs` with `WARMUP=1`): **204 programs at the plaza and 204 at
every spot to the pool's south shore** (trail start, trail middle, first post, gate, outcrop, flight, arch, terrace
look-back, the fall's corner, the shore). The ten compiles seen under `warmup=0` (121 → 131) are the warm-up's job
and it does it; the walk to the ruins compiles nothing on the first visit. #40 stands at 4; no pacing item from the
ruins' materials.

## Re-read on `7c4fb16f` (the author's 13:41–14:47 pass; 14:56–15:04 UTC)

Seven commits landed while the read above was being taken — ivy over the great rock's stair-side face (`26206fc6`, 62
strands / 1.7 k leaves) and over the hero arch's ring (`65b01dae`), the rock rebuilt as three courses of jointed
leaning blocks (`0ee25e63`), the mid grove's and the distant layer's cards kept 11 m off the trail and 10 m off the
site (`278c3762` — the village-path rule), the cliff paler and the lost slabs' beds grown over (`f2b286d2`), an
offering at the arch (`39aa8002`), sixteen green motes over the water (`6f6b85ee`), and the masonry seated with the
voussoir joints closed (`7c4fb16f`). The same poses again (`it110-ba-744a3b1e-vs-7c4fb16f.jpg`,
`spots-ruins-7c4fb16f.json`, `walk-ruins-7c4fb16f.json`):

- **Fail 1 closed.** At the reference pose the rock's box goes from bare stone to a wall of leaves (leafy pixels 5.4 →
  60.0 %); the ring carries strands hanging into the opening. The frame is r_038's kind now. The leaves stand on the
  rock's shaded face, so the box is darker, not lighter (l 0.166 → 0.145) — the reference's ivy is lit.
- **Fail 4 closed.** The east shore facing the fall: the crown and the leaning bole are gone; the frame is the pool, the
  slab bridge, the tiled wall and the ivied arch with the motes — the ruins' postcard from the shore (160 draws /
  1.19 M). The far plain north-west of the pool — a flat misty lawn with bare trunks — is now what the left third of
  that frame shows (fail 7's cousin: the site is open past the cliff's ends).
- **Fail 2 stands.** The flight + terrace front l 0.286 → 0.294, the whole frame 0.298 → 0.303 against the reference's
  0.581 / 0.452; the pillar's shadow still lies across the outcrop and the flight.
- **Fail 3 stands** (the fall's corner: the same frame, Link out of it, Navi at the lens). Fail 6 (the third post at the
  lens) and fail 5 (the look-backs: the trail's middle 822 / 10.14 M, the terrace 744 / 9.05 M) stand.
- **Route and probes:** 26 / 26, 0 stuck, camera max 0.137 m, sweep minimum 1.56 m as before; **the author's probes
  now 60 / 61** — `edge-inside:notch-east-face` at (−63.25, −9.5), expected to walk at the paving's height, is
  blocked: the rebuilt rock's footprint (`0ee25e63` "walker/structure footprints follow the new outline") reaches the
  paving's corner in the notch. His own check catches it.
- **Cost at the site's poses** with the ivy, the motes and the offering: the reference pose 158 → 150 draws / 0.92 →
  1.01 M; the gate 173 → 166 / 1.09 → 1.19 M; the arch 118 → 119 / 0.48 → 0.58 M; the east shore 167 → 160. The
  ivy's leaves are ≈ +0.1 M; the card cull gives back the draws.

Scores that move: **#16 3 → 4** (the ivy where the reference has it, moss on the ledges, damp streaks), **#3 2 → 3**
(the rock as leaning jointed blocks, the barley twist, the grown-over beds), **#18 3 → 4** (the offering), **#44 2 → 3**
(the shore case gone; the fall's corner remains), **#42 4 → 3** until the notch probe walks again. **150 / 172 →
174 / 200 scaled — over the gate on this read**, with fail 2 (the value and the light on the flight) the one
reference distance left that a number describes, and fails 3, 5, 6, 7 open.

## Re-read on `6bd9b870` (16:04–16:10 UTC — a paler, cooler west cliff, moss kept to the ledges and foot, the fall's damp band narrowed, neutral stone)

Same six poses as the 15:04 read, `7c4fb16f` → `6bd9b870` (`it111-cliff-ba-6bd9b870.jpg`, `it111-ref-pose-6bd9b870.jpg`):

| Link at | frame luma | under l 0.25 | pixels changed |
| --- | --- | --- | --- |
| **the fall's viewing corner (−73.8, −2.9), facing the cliff and the fall** | **0.324 → 0.399** | **45 → 19 %** | 67 % |
| the arch passage (−64.75, −4.2), west | 0.345 → 0.355 | 36 → 30 % | 31 % |
| the outcrop, the reference pose (−57, −4.3), west | 0.327 → 0.332 | 40.4 → 40.6 % | 13 % |
| the gate (−51.4, −4.1) | 0.342 → 0.343 | 39.5 → 39.4 % | 8 % |
| the terrace looking back east | 0.479 → 0.479 | 8.7 → 8.5 % | 10 % |
| the outcrop toward the pool | 0.392 → 0.396 | 25.0 → 25.8 % | 14 % |

**The cliff is fixed where the cliff is the picture** — from the fall's corner the face reads as pale, cool rock with
moss on its ledges instead of a black wall (the frame's under-0.25 share 45 → 19 %). Saturation eases at every pose
(0.24 → 0.21 at the reference pose — the neutral stone). **At the reference pose nothing moves:** the flight + terrace
front l 0.232 → 0.238 (the reference's 0.581), the outcrop underfoot 0.364 → 0.382, the frame 0.327 → 0.332 against
r_038's 0.469 and 40 % of it under 0.25 against the reference's 13 % — the pillar's shadow still lies across the outcrop
and the flight. **Fail 2 stands as the light, not the stone's colour:** the stone is neutral now; it is in shadow where
the reference has the sun through the arch onto the stair. Costs unchanged (the reference pose 151 / 1.01 M).

## Re-read on `abc597f9` (18:36 — the camera kept off the terrace's ruined parapet `6fbfdf02`, a moss cap on the west cliff's top `7b0d8121`, a second route to the pool's shore `abc597f9`; the head merged at 18:26) — 19:04–19:11 UTC

Both routes and the probes (`walk-ruins-abc597f9.json`); six poses (`it115-ruins-abc597f9.jpg`).

- **Routes:** `plaza-to-ruins-terrace` 26 / 26, 0 stuck, 77.9 m; the new `ruins-trail-to-shore` (off the trail east of the gate
  boulder, down the east shore, round the south bank, a step into the shallows) **8 / 8, 0 stuck, 25.8 m**. The camera records
  **no step over 0.1 m** on either; the boots' lowest point max 15.0 / 13.5 cm (the flight), min −4.6 / −5.0 cm.
- **Probes 61 / 61.** The 15:04 fail (`edge-inside:notch-east-face`, the rebuilt rock's footprint) is closed by the probe set: the
  notch row is no longer in it (the edge-inside rows are now the east front's two, the ivy rock's west face and the north face).
- **The sweep:** 264 samples (11 spots × 24 headings, the two shore spots new), **no camera inside a solid**; 67 headings stop
  on one (the pull-in doing its job). `6fbfdf02`'s parapet case (the camera 6 mm inside a block, 1 of 216 on `e9ef6a05`) is
  gone. **What stands: the fall's viewing corner** — `terrace-west-by-cliff` and `terrace-northwest-by-cliff` put the camera at
  0.60 m from Link on 15 and 16 of their 24 headings (`keep` 0.139), and so do `outcrop-by-ivy-rock` (9) and `parapet` (3):
  Link out of frame, Navi at the lens (`fall-close`, as at 14:30). The same ≈ 1.2 m pull-in floor as the grove's, the keeper's
  and the east lane's — one camera item across four branches.
- **Poses:** the parapet's edge facing the pool and turned from it frame cleanly (the camera 4.3 m back both ways); the terrace
  looking up 45° shows the cliff's top with its new moss fringe on the skyline — a mossy brow, in kind with the boulders' caps;
  `fall-close` 0.399 → 0.403 (the cap is above this frame). The terrace's look-back east **731 draws / 9.04 M** (744 at 14:30;
  the pebble gate's −13) — over the draw cap by 31, the head's east look with the ruins' +44–55 on it.

**#44: 2 → 3** (no step, no inside, 61 / 61; the corner's pull-in keeps it from 4). #46 ★ 3 as before (the site's own poses
78–200 draws; the look-back east is the head's). 174 / 200 stands with #44 up one: **175 / 200**.

## Re-read on `fdb4d338` (19:39–21:24 — the site's haze rule for the south exit `3776cc81`, the shore route wading `da369023`, the rubble seated `4789b70c`, **a water stair down the wall's pool face to the fall's foot `526b7feb`**, the fall's sheet in two layers `6289aa78`, two tests) — 21:33–21:43 UTC

Three routes, the probes and the sweep (`walk-ruins-fdb4d338.json`); ten poses (`it118-ruins-fdb4d338.jpg`).

- **Closed — the terrace's look-back east is under the caps:** 731 / 9.04 M → **660 draws / 8.52 M** (`3776cc81`: the south exit's
  60 m haze rule measured to the content's spheres inside the site, and the small vegetation's LODs sharing draws). From the quay
  looking east along the pool 639 / 8.34 M. The site's own poses 83–138 draws.
- **Routes:** `plaza-to-ruins-terrace` 26 / 26; `ruins-trail-to-shore` now wades (**10 / 10**, 28.2 m, the boots under the water,
  lowest −3.4 cm); **`ruins-water-stair` 15 / 15**, 0 stuck, 27.2 m. Probes **80 / 80** (19 new for the stair, the quay and the
  platform); the sweep 360 headings at 15 spots, none inside a solid; no page errors.
- **The water stair's camera — #44 = 1 on the new structure.** On the branch's own route the camera jumps **3.90 m** (row 213, Link
  (−67.5, 1.86, −0.76) five treads up: the camera on the terrace 4.5 m behind him is cut by the wall's top, keep 1 → 0.13, pulled to
  0.6 m in one frame, 3,479 m/s²), **2.67 m** at the landing (−64.4, 3.69) and **3.26 m** coming back up (−67.3, 2.07); camera speed
  max 117 m/s, turn acceleration max 37,000 °/s². The sweep: `water-stair-mid` 13 of 24 headings at 0.60 m (keep 0.132), `water-stair-
  quay` 14 (0.074), `water-stair-platform` 17 (0.087). The frames say why: mid-flight the follow camera stands on the terrace above
  and Link is a cap behind the wall's lip; on the 1.2 m quay facing the fall the camera is 0.5 m behind him at the wall's face, Link
  out of frame; **from the platform at the fall's foot, looking up 60°, the frame is the wall's overhanging slabs, not the fall.** The
  stair is the grove's veranda and the keeper's gallery again — a walk 1.2 m wide against a wall — and wants the same two things
  (the wall as an exact camera solid the orbit swings off; a pull-in floor ≈ 1.2 m with the camera raised), plus a lowered camera
  on the flight so it stays under the wall's top.
- **Shaders:** the programs count climbs 123 → 125 at the fall's corner (the two-layer sheet) → 126 at the stair's head → 127 mid-
  flight: four programs compile on first sight, and the first frame at the stair's head took **3.85 s** to render here (2–8 ms
  elsewhere; SwiftShader's compile — a GPU's would be shorter but real). At 14:55 the site held 204 programs constant with the
  default warm-up; the new sheet and the stair are outside it.
- **The fall's sheet in two layers** reads (the front core parting from the back as it falls — `fall-close` before / after, in kind).
  **The rubble seating holds** (`it118-rubble-seated-ba.jpg`, the camera over the pool at (−60, 0.85, 5.1) facing the wall's foot):
  before, the block at the foot hangs with its underside open over the shelf's slope — a dark gap under its pool-side edge; after, it
  reaches down to the bed with its top where it was. #22 = 4 for the loose stone. (A note on the pose: (−60, 0.8) is the pool proper —
  Link stands at y −0.90 under a 0.55 m surface — the shelf is narrower than the layout's 1.6 m reads at this x.) The boots on the stair: p95 1.4 cm, one frame at 20 cm (the landing's edge).

**Scores:** #46 ★ 3 → **4** (the look-back east under both caps; every pose of the site's own 83–660); **#44 3 → 2** (the stair's
three pops and its 0.6 m headings — the site's older poses hold at 3). 175 stands at **175 / 200 with one check at 2** — not
shippable by the letter until the water stair's camera is done; the stair itself is the site's best new picture (the flight
down the wall's face to the quay, the fall ahead) once the camera can be on it.

## The six views on `f29ad20e` (21:56 — the butterflies anchored to the base's set, a card any hero camera frames kept) — 22:38–23:03 UTC

Against the branch's base `31146062`, the same capture: **A, B, D, E, F pixel-identical (1.0000, 0.00 %)** — the 34 butterflies' re-roll
that `3776cc81`'s prune caused in every hero frame is gone; **C 0.9998, 0.07 % of its pixels, −0.0004 vs the reference** — scattered over C's right third at
mid-height (x 867–1279, y 150–396 of 1280 × 720, +9 luma), the trail side of the frame where the card cull reached to x −1. Inside the budget; the author's own catch, confirmed from outside.

## Re-read on `e37b1777` (18:22 — the head merged with the grove's camera; the village's drawables hidden while the camera stands in the ruins' zone; the fixed frames' plant order kept) — 18:25–18:35 UTC

- **The water stair's camera pops are gone.** `ruins-water-stair` 15 / 15 with **one 0.30 m step** (was 3.90 / 3.26 / 2.67 m at
  `fdb4d338`), camera acceleration max 3,479 → **269 m/s²** — the head's grove camera (`d7432cc9`'s easing and ring steering, merged
  into the branch) does for the retaining wall what it did for the huts. `plaza-to-ruins-terrace` 26 / 26 and `ruins-trail-to-shore`
  10 / 10 with no step over 0.3 m; probes 80 / 80; the sweep's 360 headings never inside a solid. What stands is the standing
  pull-in: the two terrace-by-cliff spots at ≤ 0.7 m on 10–11 of 24 headings, the outcrop by the ivy rock 9, the stair's mid /
  quay / platform 9 each (down from 13–17) — the ≈ 1.2 m floor, the one camera item across all four expansions.
- **Every ruins look-back is under both caps** (`it139-ruins-zone-e37b1777.jpg`): the terrace looking east 660 → **490 draws / 6.84 M**,
  the quay looking east 639 → **486 / 6.70 M**, the trail's middle 702 → **604 / 8.58 M** — the plaza's houses, posts, fences, arch and
  huts 35–95 m east hide while the camera is west of x −30 at walking height; the near west house stays, nothing visible goes (the
  terrace's frame reads the same; at the trail's middle the branch's frame is clean where the head's camera stood inside a birch).
  The reference pose 128 / 0.98 M, the gate 138 / 1.15 M.
- **The six views** (`ce2566a7`, the plant-order fix, against the head): A / B / D / E 1.0000, C 0.9998 / −0.0004 — the same residual as
  `f29ad20e`; F's frame did not write in this run and the five stand.

**Scores:** #44 2 → **3** (no pop on any route; the standing pull-in keeps it from 4), #46 ★ **4** (every pose of the site's own and every
look-back under 700 / 9.0 M). **176 / 200 with no check under 3** — shippable by the rubric's letter; the standing pull-in floor is the
polish item, shared with the grove, the keeper's hut and the east lane.

## Re-read of `exp-ruins` @ `fcec1575` (02:59 — the stone's firmer split of sun and shade: key ×1.32 / 1.18 / 0.98, fill ×0.9 / 0.97 / 1.1, the moss's grain ±20 % instead of ±8 %, "so it reads in the wall's shade on the water stair's treads (r10)") — 03:23–03:50 UTC

A look change, on the ruins' stone only, measured as the branch's own before / after (`931472c9` → `fcec1575`, the same play poses):

| pose | SSIM | pixels over 8/255 | what moved |
| --- | --- | --- | --- |
| the terrace look-back (−68, −4.6) → E | 0.9936 | 44 % | the columns' lit sides warmer, their shade cooler, the paving's slabs a step more contrast (`it147-ruins-stone-terrace-look-back.jpg`) |
| the quay, looking back east (−70.5, −0.9) | 0.9843 | 21 % | the wall's face cooler in shade, the flight's lit treads warmer, the moss lines on the nosings legible |
| the water stair, five treads up facing up (−67.5, −0.76) | 0.9826 | 9 % | **the r10 case: the treads under the wall's shade now carry the moss's grain**; the lit treads above warmer (`it147-ruins-stone-water-stair-up.jpg`) |
| the water stair from its head, facing down (−64.5, −0.9) | 0.9767 | 19 % | the same, the whole flight in shade |
| the outcrop, close (−57, −4.3) → W | 0.9942 | 9 % | the rock's lit / shade split |
| the gate (−51.4, −4.1) → W | 0.9957 | 2.7 % | little stone in frame |
| the trail's middle look-back (−33.4, 0.6) → E | 1.0000 | 0.00 % | no ruins stone in view — the change is scoped as stated |

The split does what it says: the sun side reads warmer and a touch brighter, the shade cooler, and the moss's grain is visible where the
sun's normal detail cannot show (the wall's shade). Nothing goes hard — the shade is not crushed, the lit stone is not blown; the
columns at the terrace keep their reading against the paving. Draws and triangles unchanged at every pose (461 / 6.79 M at the terrace,
575 / 8.56 M at the trail). **The six fixed views are out of the ruins zone by construction (identical on every read of this branch); not
re-rendered for a material change scoped to the ruins' stone.** #12 (materials read as their material) holds at 4; the r10 item the
commit names is answered at the water stair. No score moves from the 176 / 200 of `e37b1777`.
