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
