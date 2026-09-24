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
