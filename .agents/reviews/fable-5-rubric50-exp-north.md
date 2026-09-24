# fable-5 — the 50-point rubric, non-author pre-merge read: the north grove (`agent/fable-cursor-exp-north` @ `943d10b4`, still being built) — 2026-09-24 09:33–09:50 UTC

The grove hamlet past the second clearing: the grove flight (9 log-nosed earth steps) up from the ledge terrace, a trodden
trail 30 m north to a levelled shelf, the **trunk house** and its yard (woodpile, chopping block, pots, baskets, bench,
washing line), the **stilt house** with a veranda and a gangway, a **rope walk** to a **tree hut** on a column. Read at
player height with the follow camera at nine spots (`fable-5-lane10/spot.mjs`; sheet `fable-5-rubric50-exp-north/it106-north-sheet.jpg`),
the branch's own `north-grove` route and probes (`walk-north-grove-943d10b4.json`), and the caps probe. A pre-merge read of a
moving branch (last commit 08:53) — the author's README carries the rest; scores only where I have evidence.

## What is right, in one glance

The hamlet reads (#1 ★): from the trail the trunk house is a low hut under a mossy cap with a lit doorway, a lantern post,
pots at the door, a washing line and a woodpile — lived in (`it106-house-door-from-trail.jpg`); the stilt house on its
posts with a lantern reads as a raised dwelling from the trail below (`it106-lookout-from-trail.jpg`); the rope walk
leads the eye to the tree hut's lit door. Paths lead to every door (#25); the route walks all of it — **28 / 28
waypoints, 0 stuck, 61.8 m; the probes 64 / 64**; the boots on the decks p50 0 / max 5.6 cm (#41 ★ / #42 = 4 / 4); wood
underfoot on the veranda, gangway and platform by the commit (#45). Caps: the grove sits out of the six hero frames
(A 638 / 8.86 M …; the branch lacks the 07:05 merges, so the pair is not clean) — #46 ★ by the counts I have, the item's
own view not measured.

## What fails now, and where — the follow camera (#44)

The harness's per-frame camera trace on the route records **one-frame jumps of 3.89 m, 3.57 m and 2.38 m** (accelerations
2,300–3,500 m/s²), all against *solid* hits:

| Link at | the camera | jump |
| --- | --- | --- |
| **(9.78, 11.61, −91.79)** — the gangway's head at the stilt house | (7.42, 13.31, −95.60) → (9.48, 13.14, −92.31) | **3.89 m** |
| **(−0.85, 10.02, −98.74)** — the trunk house's yard, at the door | (3.07, 11.77, −100.10) → (−0.31, 11.56, −99.00) | **3.57 m** |
| (−0.23, 10.01, −98.47) — the yard | (−0.18, 11.71, −101.84) → (−0.27, 11.57, −99.46) | 2.38 m |

The village's worst pull-in is the west house's 1.26 m (lane-10 §8); the grove's huts give the follow camera three
times that. **The tree hut's platform** is the other case: Link one metre from the hut's column facing it puts the camera
inside the column — the frame is bark and a rail (`it106-hut-platform.jpg`); the platform is 1.67 m of radius round the
column, so every turn on it will do this. **The veranda** (`it106-veranda.jpg`): against the wall the camera pulls to
0.5 m behind Link — Navi fills a fifth of the frame, the roof's underside crosses the top and the understory's leaf
cards hang at arm's length on the right (the 4.5 m clearance the commit gives the decks is not enough for the lens at
the rail). **#44 = 1 on this branch.** The same fix as the plaza-south flare and the west house: the huts, the column and
the rails as shells the pull-in eases against, and a floor on the pull-in distance on the decks.

## Scores with evidence (the rest is the author's)

| # | check | score | evidence |
| --- | --- | --- | --- |
| 1 ★ | reads as what it is from 20 m | **4** | trunk house, stilt house, tree hut each in one glance from the trail |
| 2 | Kokiri scale | **3** | the doors ≈ 1.4 m, Link fits the veranda and the gangway; the trunk house is low and wide for its trunk |
| 4 | varies from siblings | **4** | three different dwellings — a trunk hut, a stilt house, a tree hut — none a copy of the village's |
| 6 ★ | every part visibly held | **3** | stilts, the gangway's rails, the rope walk's posts and ropes; the rope walk's plank carriers not readable from above |
| 13 | palette | **3** | mossy caps, warm bark, amber pods; nothing chalk or neon |
| 17 | wear follows use | **3** | the trail is trodden earth with set stepping discs; the yard's ground worn |
| 18 | signs of life | **4** | woodpile, chopping block, pots, baskets, bench, washing line — placed, not scattered |
| 25 | paths lead to the door | **4** | the trail to the trunk house, the gangway to the stilt house, the rope walk to the hut |
| 27 | interiors lit with depth | **3** | the trunk house's doorway shows pots and a bench in warm light; the stilt house's door a lit arch |
| 31 ★ | soft roof edges | **4** | moss caps on all three, no polygon rims read |
| 36 ★ | pods glow warm and steady | **3** | the post lantern, the door pods; steady across the frames |
| 41 ★ | Link walks every surface | **4** | 28 / 28, 0 stuck |
| 42 | edges block him | **4** | probes 64 / 64 |
| 44 | the camera never inside it, never pops > 0.3 m | **1** | 3.89 / 3.57 / 2.38 m pops; the camera inside the hut's column on the platform |
| 45 | footsteps play the right surface | **3** | wood on the veranda, gangway, walkway, platform by `df3774c4`; not heard here |
| 46 ★ | caps | **3** | six hero views under both caps; the grove's own view not measured |
| 50 | the owner would stop and look | **4** | the yard with its washing line, and the rope walk to the lit hut door |

17 checks scored, 57 / 68; the rest (materials at 2–5 m, weathering, grounding, the 60° / 35° views, texel density,
determinism) need the author's evidence or a read once the branch settles. **The one blocker by the rubric is #44**;
everything ★ that I could score is 3–4.

## Re-read on `e156566f` (10:29 — `d7432cc9` the huts' walls as exact round camera solids and a follow camera that does not pop round them; `137cee05` taller hut walls; 10:37–10:50 UTC)

**The pops are gone.** The same route's camera trace: the worst one-frame jump **3.89 → 0.36 m** (at the yard door),
acceleration max 3,564 → 125 m/s², vertical max 211 → 27, the camera's minimum height 1.37 → 1.53 m; 28 / 28, 0 stuck,
probes 64 / 64 as before. From the gangway's head the stilt house is the grove's picture — the round bark hut under its
mossy cap, the lit arch with pots inside, the pods, the rail, the rope walk behind (`it107-gangway-head.jpg`). One cost of
the easing: the turn acceleration's p95 556 → 909 °/s² on the route — the camera swings round the round walls faster than
before; below the flights' old 2,370 but above the flat routes' 440–560.

**Two camera cases remain** (`it107-ba-hut-platform.jpg`, `it107-ba-veranda.jpg`):
- **the tree hut's platform** — Link 1 m from the column facing it: the frame is still bark (luma 0.14 → 0.21, 76 % of it
  under 0.25). The platform is 1.67 m of radius round a 0.8 m column; a camera 3.5 m behind Link has nowhere to be. A
  deck mode (the camera pulled to ≈ 1.2 m and raised, the pitch down) is the shape of the fix.
- **the veranda at the rail** — the roof's underside and the leaf cards are out of the frame now, but the camera pulls so
  close that **Navi fills half the frame** (a white blob with wings between the lens and Link). The fairy should fade when
  she is within ≈ 0.6 m of the camera — the same rule the village's lanterns follow for the near plane.

**#44: 1 → 2** — no pop over 0.36 m on the walked route; the platform and the veranda's near plane are the two placed
poses left. Everything else as the 09:45 read.

## Re-read on `571acd21` (15:07–15:33 UTC — the pods rehung, the walkway stubs as round poles and a rope, the casters and far-LOD packs, the author's own 50 checks at 174 / 171 / 172 / 170)

**A correction first.** My "tree hut's platform" pose (Link at (16.2, −86) facing the column) is 1.0 m from the hut's
host (16.8, −85.2), *inside* its 1.45 m barrel — `place()` teleports through walls, so that bark frame (10:29, 10:50) was
my probe's, not the camera's: the hut has no walkable platform round its wall, only the walkway stub in front of its door,
and the probes hold the wall and door shut. **Strike it from the 10:50 read.** The veranda pose stands: 2.05 m from the
stilt house's centre, on its 1.81–2.45 m ring.

**The route is frame-identical to `e156566f`** (`walk-north-grove-571acd21.json`): 28 / 28, 0 stuck, 61.8 m, probes
64 / 64, the same one spike — a 0.36 m camera step in one frame at the trunk house's door, Link at (−0.75, 10.02, −98.8)
(the author counts it as a 0.14 m second difference; by the check's letter it is one pop of 0.36 m at 3.6 m). Nothing in
`59e970d6`'s pole-and-rope stubs or the rehung pods touched the camera or the walk.

**The camera at the doors — the real case** (`it111-camera-poses-doors.jpg`, `it111-camera-poses-hut-veranda.jpg`,
`it111-hut-door-turn.jpg`, `it111-stilt-door-turn.jpg`), poses Link reaches on the route (the walkway stub's end, the
gangway's head), 1280 × 720:

| Link at | facing | the camera | frame |
| --- | --- | --- | --- |
| the tree hut's door, (15.7, 11.3, −86.6), 0.33 m outside the wall | the door (yaw 37°) | (13.11, 13.05, −90.03), 4.3 m back over the rope walk | the hut, the door, Link — good |
| the same | **back to the door** (217°) | **(16.06, 12.83, −86.12) — 0.6 m behind Link, 1.18 m from the host: 0.27 m inside the 1.45 m wall** | **the room's floor, a flat untextured tan plane (180, 132, 71), fills 31 % of the frame (62 % of its lower half, rows 422–719); Link out of frame; Navi's blob 32 % of the frame's height** |
| the stilt house's door, (10.37, 11.61, −92.39), 0.28 m outside | the door (61°) | (6.61, 13.36, −94.47), 4.3 m back | the stilt house, the door, Link — good |
| the same | **back to the door** (241°) | **(10.89, 13.14, −92.10) — 0.6 m behind, 1.26 m from the host: 0.29 m inside the 1.55 m wall** | **the same tan floor plane across the lower half; Link out of frame** |
| the stub's end, (15.5, 11.3, −86.91) | back to the hut (217°) | (15.86, 12.83, −86.43), 0.6 m behind, at the wall's skin | the stilt house across the walk; Navi 25 % of the frame's height at the lens, Link's cap at the frame's foot |
| the veranda, (13.24, 11.61, −89.87) | the tree hut, back to the wall (37°) | (12.88, 13.14, −90.35), 0.6 m behind, 1.45 m from the centre against the 1.55 m wall | the hut's door and pods (a fine picture) — **Link out of frame, Navi 27 % of the frame's height** |
| the veranda | the wall (217°) / north-west (127°) | 3.9 m / 3.4 m back, out over the drop | good — the author's `p-veranda` |
| the trunk house's door, (−0.85, 10.02, −98.74) | back to the door (90°) | (−2.50, 11.44, −98.74), 1.65 m back | the yard and the stilt house; Link's cap at the foot — acceptable |

So `d7432cc9`'s round camera solids stop the camera at the walls but **not at the doors**: with Link at either hut's door
facing out — a pose the route passes at both — the camera drops 0.6 m behind him into the doorway, 0.27–0.29 m inside
the wall's radius, and the room's floor plane is the picture. The fix is the doorway as part of the solid (the camera has
no business in a shut room), and a **floor on the pull-in of ≈ 1.2 m with the camera raised** so Link's head stays in
frame: at 0.6 m the lens is 1.5 m over his feet and his 1.25 m head is 0.28 m under the frame's edge, and Navi (who
follows his shoulder) is at the lens — 25–32 % of the frame's height at the veranda, the stub and both doors.
**#44 = 2** (the camera inside both huts' rooms at reachable poses; one 0.36 m step on the route) — the author's 3 / 4 / 4 / 3
counts the route only.

**Caps at the yard's look-back** (`it111-grove-spots-571acd21.jpg` for the frames; the head `3c6cc553` built at the same
poses for attribution — the shelf is 0.9 m higher there, unlevelled):

| Link at, facing | `571acd21` | head `3c6cc553` | the grove adds |
| --- | --- | --- | --- |
| the yard (2, −100), yaw 10° (back down the trail toward the village), level | **728 draws / 9.44 M** | 607 / 7.62 M | +121 / +1.81 M |
| the same, pitched down 25° | **722 / 9.22 M** | 607 / 7.52 M | +115 / +1.70 M |
| the yard (0.5, −98), yaw 30°, down 25° | 676 / **9.30 M** | 560 / 6.88 M | +116 / +2.42 M |
| the trunk house's door, facing it | 213 / 1.66 M | 109 / 0.40 M | +104 / +1.26 M |

The author's `g-back` counts 689 / 8.88 M on `59e970d6` — his pose; mine, Link at the trunk house's door turning round to
look back down the trail (the pose every visitor takes), is **over both caps by 22–28 draws and 0.22–0.44 M**, and the
head itself sits at 607 / 7.6 M there. The scene audit says where the add is: the branch carries **+84 vegetation meshes
(+99 k instances, +0.97 M)** and **+47 structures meshes (+0.47 M)** over the head, trees −35 instances. **#46 ★ = 2** until
the yard's look-back is under 700 / 9.0 M (the author's 4 / 3 / 4 / 3 counts his own 24 views).

The rest of `59e970d6` reads well at player height (`it111-grove-spots-571acd21.jpg`): on the rope walk the stubs' posts
are round poles with a rope rail and the pods hang outboard; on the gangway the lime pod is off the trestle's leg
outboard of the hand rail, out of Link's way; the gangway's head, the yard door and the stilt house from the yard are
as at 10:50 — the grove's pictures.

**Where the grove stands by this read: two checks at 2 — #44 (the camera in both huts' rooms at their doors) and #46 ★
(the yard's look-back over the caps) — so not shippable by the rubric's letter until both are fixed; everything else I
can score is 3–4 and matches the author's table.** Both fixes are small and in his lane (the door arc of the camera
solid, a pull-in floor; the look-back's vegetation). I re-read on his next push.
