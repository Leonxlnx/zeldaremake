# fable-5 — non-author pre-merge check: the east lane (`agent/fable-cursor-exp-east` @ `b3e10c09`) — the six views, the caps, the camera — 2026-09-24 15:35–16:03 UTC

The east plateau's lane (shop, tall deck house, small house, lookout) plus a **cost pass that reaches into the village's
own houses** — room culling behind the fog planes (`b3e10c09`), a shadow LOD for the caps / roof branches / ropes / vines /
pods (`82a85ced`), the moss tufts within 34 m (`09110730`), kids the terrain hides (`eb17a820`), the lane's card crowns 11 m
off (`162f1a6e`). Each says it leaves the fixed cameras alone; this is the non-author pair that checks it. Same method
as the ruins pair: `broll.mjs --test --settle 8 --quality high --size 1280x720` on the head `3c6cc553` (`it110-h-six`)
and on `b3e10c09` (`it111-e-six`), the gauntlet's own 256 × 144 SSIM (`lib/image.mjs`), pixels changed at tol 8 / 255 full
res. Not yet a 50-check read — the author's README (`art/environment/exp-east-2026-09-23/`) predates his cost pass and
says #42 / #44 / #45 / #46 ★ would score low; the checks below are the ones I can measure now.

## The six views — inside the budget, but A, B and E lose a leaf cluster at the top edge

| view | SSIM head ↔ branch | pixels changed | vs reference head → branch | Δ |
| --- | --- | --- | --- | --- |
| A_stairs | **0.9915** | **0.83 %** | 0.1765 → 0.1792 | +0.0026 |
| B_house | 0.9952 | 0.50 % | 0.1705 → 0.1704 | −0.0002 |
| C_lookback | 0.9999 | 0.02 % | 0.1742 → 0.1743 | +0.0001 |
| D_log | 1.0000 | 0.00 % | 0.2362 → 0.2362 | 0 |
| E_ground | 0.9953 | 0.50 % | 0.1913 → 0.1913 | +0.0001 |
| F_canopy | 0.9795 | 7.10 % | 0.1955 → 0.1945 | −0.0010 |

Every Δ is inside −0.003. But the ruins pair moved 0.01–0.06 % of A / B / E's pixels and this one moves 0.5–0.83 %, all
in **one place: the top row of the frame, right of centre** (cells 10–12 of 16 in A, 13–15 in B and E; 46 % of A's cell
(10, 0) changed), and the changed pixels are **+38 luma brighter** on the branch (97 % of them brighter). The crops
(`it111-six-crops-head-vs-east.jpg`, `it111-A-head-over-east.jpg`) show what it is: **the dark leaf cluster hanging into
the top of A and B from the right is gone on `exp-east`** — haze where leaves were. That is `162f1a6e` (the lane keeps
the mid grove's card crowns 11 m off, as the plaza's walk lines do): the lane's first 14 m "thread the trees at camera
A's right edge", so the crowns it clears are the ones A, B and E see at their top edge. F's 7.1 % is sway (Δ luma +4,
42 % darker — the wind's speckle, as in the ruins pair).

Numerically A ends 0.0026 *closer* to the reference, so the budget passes; visually three hero views lose canopy at the
frame's top, and the INBOX carries no owner-approved look change for it. **The author should say whether the 11 m rule
needs to reach those crowns** — the lane's walkers only need the cards off their own heads; a rule that spares the
cards above 4 m (the walk lines' clearance is for the lens at 1.5 m) would keep A / B / E as they are.

## The caps on the lane's own views (play mode, the follow camera, 1280 × 720; `it111-east-lane-spots.jpg`)

| Link at, facing | `b3e10c09` | head `3c6cc553` | the lane adds |
| --- | --- | --- | --- |
| the stair head (18.5, −7), east along the lane | 519 draws / 7.47 M | 450 / 6.22 M | +69 / +1.25 M |
| the lane's bend (33, −4), east | 364 / 4.79 M | 297 / 3.49 M | +67 / +1.30 M |
| the shop's door (36.8, −4.6), facing it | 355 / 4.53 M | — | |
| the small house's door (36.5, 3.2), facing it | 380 / 5.28 M | — | |
| **the green (43, 4), west over the village** | **816 / 10.29 M** | **833 / 9.94 M** | −17 / +0.35 M |
| **behind the lookout fence (47.5, 7.5), yaw 265°** | **761 / 10.27 M** | **778 / 9.90 M** | −17 / +0.37 M |
| **the tall deck (48.5, 6.86, 2.15), west** | **760 / 10.03 M** | no deck on the head | |

Three of the lane's seven views are over both caps. Two of them the **head is over already** — the plateau's green and
lip look back over the whole village at 833 / 778 draws and 9.9 M today; the cost pass takes 17 draws off each and
the lane puts 0.35 M triangles on. The deck is new and stands 1.3 m higher, so it sees the most. The village's cost
at the look-backs is the same finding as the ruins' trail and the south's far bank: **the expansions make places to
stand that look back at a village drawn for six fixed cameras**, and none of them can pay that bill alone. #46 ★ by
the letter: 2 on this branch (the author says so himself in his README).

## The camera (#44) at the lane's poses

Facing the doors and along the lane the frames are good (the stair head, the bend with the shop's lit window, the shop's
door with its room). **The small house's door** (`it111-small-house-door.jpg`): Link at (36.5, 3.2) facing the door, 0.83 m
from it — the camera stops **0.6 m behind him at the arch's height** (1.54 m over his feet; the arch hangs 1.5–1.6 m over
the doorstep): the frame is the trunk's shadow, black across the left two thirds, the lit room right, Navi at the lens,
Link out of frame. The same pull-in floor the grove wants (≈ 1.2 m, the camera raised) would keep him in the picture
here. The author's README already names 1.3–1.9 m pulls at the turn-arounds.

## Where this leaves the branch

- The six views pass the budget; **the leaf cluster gone from A / B / E's top edge is a look change to three hero
  views that needs the owner's yes or a rule that spares the high cards.**
- Caps: the lane's look-backs 760–816 draws / 10.0–10.3 M; the head is at 778–833 / 9.9 M on two of the three poses.
- Camera: the small house's door pulls to 0.6 m.
- Not read yet: the 50 checks at player height (materials, weathering, grounding, the up / down views); the author's
  README is pre-pass. I read them on his next push once the crowns question is answered.

Evidence: `fable-5-rubric50-exp-east/it111-six-crops-head-vs-east.jpg`, `it111-A-head-over-east.jpg`,
`it111-east-lane-spots.jpg`, `it111-small-house-door.jpg`; frames `/tmp/f5/it110-h-six`, `/tmp/f5/it111-e-six` (VM);
probes `fable-5-lane10/spot.mjs`, the six-view pair `fable-5-lane10/sixpair.mjs`.

## The 50 checks at player height — `b3e10c09` (16:28–16:36 UTC; `it112-east-rubric-poses.jpg`, `it111-east-lane-spots.jpg`, `walk-east-b3e10c09.json`)

The author's own three routes run here on `b3e10c09` (his README's numbers are from `9a97df4b`): `stairs-to-east-lookout`
20 / 20, 0 stuck, 59.5 m; `east-tall-deck` 8 / 8, 15.2 m; `east-small-door` 5 / 5, 7.5 m. Nine more poses shot with the follow
camera (looking up 40–60°, down 20–35°, the details at 2–5 m, both doors, the steps, the lookout, the lane's middle).

| # | check | S / T / L (shop, tall house, lane) | evidence |
| --- | --- | --- | --- |
| 1 ★ | reads in one glance from 20 m | 4 / 4 / 4 | from the stair head the lane's discs, a fence, a barrel and the shop's lit window lead the eye (`stairhead-lane`); the shop's counter, awning and sign read as a shop (`shop-side`); the tall house's deck on its stilts as a dwelling with a porch (`deck-steps`) |
| 2 | Kokiri scale | 3 / 3 / 4 | doors ≈ 1.4 m, the counter's sill at Link's chest, the deck's rail at his shoulder; the discs a stride apart |
| 4 | varies from siblings | 3 / 4 / — | three houses from one builder: the shop with a counter and awning, the tall house with a side deck and plank flight, the small house low with a round window and flower boxes — the shop's and the small house's domes read as the village's houses again |
| 6 ★ | every part visibly held | 3 / 4 / 3 | the deck on posts with braces and a plank flight on stringers (`deck-steps`, `deck-below`); the awning on two poles; the lookout's rope on five posts; the sign on its post. The discs lie on the turf |
| 10 | small detail at 2–5 m | 4 / 3 / 3 | the counter's shutter boards, pot and fruit, the fruit basket at the door (`shop-side`); the pods' hangers; the barrels and the log bench at the lookout |
| 11 ★ | wood as wood, bark as bark, stone as stone | 3 / 3 / 3 | plank atlas on the deck and steps, bark on the posts, the discs stone; the flat-shaded awning boards read as painted |
| 13 | palette | 3 / 3 / 3 | the village's bark, moss and amber; nothing chalk or neon |
| 17 | wear follows use | 3 / 3 / 3 | the discs' tops pale, the doorsteps trodden; the lane's turf not worn between the discs |
| 18 | signs of life | 4 / 3 / 4 | the counter's goods, the basket, the barrels, the bench facing back over the lane, the waymarker |
| 25 | paths lead to the door | 4 / 4 / 4 | the discs from the stair head to every door and the lookout (his routes walk all of it) |
| 27 | interiors lit with depth | 3 / 4 / — | the tall house's door shows a room with shelves and pots in warm light (`tall-door`); the shop's window a lit room behind the counter |
| 31 ★ | soft roof edges | 4 / 4 / — | moss caps on all three, no polygon rims read (`deck-below`, `small-house-front`) |
| 34 | tops carry growth | 4 / 4 / — | moss and ivy on the caps and the tall house's crown (`deck-below`) |
| 36 ★ | pods glow warm and steady | 4 / 4 / 4 | the 16 pods and the two posts; emissive only, steady across the frames |
| 37 | light pools where lanterns hang | 3 / 3 / 3 | `736fd44f`'s pools under the shop's and small house's lights and the posts — visible as warm ground at the doorsteps (`tall-door`, `shop-side`); soft, no disc edge |
| 41 ★ | Link walks every surface | 4 / 4 / 4 | 33 / 33 waypoints on his three routes, 0 stuck; the deck's boots max 4.6 cm, footprint −3.8 cm; the stairs route's 17 cm is the head's main flight (his known issue) |
| 42 | edges block him | 3 / 3 / 2 | the deck's railings and the lookout's rope stop him; **the lip past the fence's two ends is open** and no other fence in the world stops him (his README) |
| 44 | camera never inside, never pops > 0.3 m | **1** | on his own routes: **1.28 + 1.58 + 0.64 m** in one frame each at the deck's far end (Link (49.0–49.1, 6.86, 2.4), camera speed max 47 m/s), **1.90 + 0.71 m** at the small house's doorstep turn-around (36.9, 1.1; 57 m/s), 0.43 / 0.55 / 0.32 m at the tall house's door spur (41.9–42.4, −0.3…−1.0); placed: the small house's door pulls to 0.6 m (`it111-small-house-door.jpg`), and **at Link (26, −6) facing 110° on the lane's first stretch the camera sits inside an understory crown** — a leaf card over 95 % of the frame, the occluder's peephole round Link (`it112-lane-camera-in-crown.jpg`) |
| 46 ★ | caps at every hero view and its own | **2** | the six views pass; the green 816 / 10.29 M, the lookout 761 / 10.27 M, the deck 760 / 10.03 M (the head 833 / 778 at the first two) |
| 47 | hidden when far or off-screen | 4 | `eastInReach`: nothing of the lane beyond 35 m of every trunk while the eye is under 6.5 m; A–F draw none of it (the six-view pair) |
| 50 | the owner would stop and look | 3 / 4 / 3 | the counter with its goods; the deck's flight up to the porch with the pods lit; the lookout's bench over the gorge |

21 checks scored, S 71 / T 73 / L 66 on those; **two under 3: #44 = 1 and #46 ★ = 2**, and #42 at 2 for the lane's open lip.
The rest — weathering by exposure, seams at 3–10 m, texel density, the 60° / 35° views of the domes (my up-views caught
canopy, not the caps), determinism — need the author's evidence or a settled branch. **Not shippable by the letter until the
camera's pops (the turn-arounds at the deck and the doorstep want the ease-in he names; the crowns beside the lane want
to be camera solids or to dissolve) and the look-backs' cost are answered; the leaf cluster gone from A / B / E's top edge
is the owner's call.**

## `6d1c92e2` (22:09 — the tall house's flight stringers rise with the treads) — 00:33–00:38 UTC

At the `deck-steps` pose (Link (46.3, 6.14, 2.4) at the flight's foot facing east) the stringers under the treads ran the wrong
way on `b3e10c09` — sloping down toward the deck, crossing the treads; on `6d1c92e2` they rise with the flight
(`it121-deck-stringers-ba.jpg`). #6 ★ / #8 for the tall house hold at 4. The lane's routes on this build: `east-tall-deck` 8 / 8
with the same pops (1.28 / 0.64 / 1.58 m), `east-small-door` 5 / 5 (1.90 / 0.71 m); the boots ≤ 4.7 cm. #44 stays 1 on the lane;
the crowns question (16:03) is still unanswered — the branch has merged the head twice since without touching the 11 m rule.

## `f84ff318` (16:06 — the relaunched builder: the head merged, the lookout's rope run on to the small house's roots and turned inland to a third stump, east probes in the harness) — 16:28–16:50 UTC

- **#44 on the lane's routes: 1 → 3.** With the head's grove camera (`d7432cc9`'s easing) in the branch, **every pop on the three routes
  is gone** — `east-tall-deck` 8 / 8 with none (was 1.28 / 0.64 / 1.58 m), `east-small-door` 5 / 5 with none (was 1.90 / 0.71), `stairs-to-
  east-lookout` 20 / 20 with none (was 0.43 / 0.55 / 0.32); turn acceleration p95 882–940 °/s² (the head's swing); boots ≤ 9.6 cm. What
  stands from the placed poses: the small house's door still pulls the camera to 0.6 m (Link out of frame), and on the lane's first
  stretch (Link (26, −6) facing 110°) the camera still sits inside an understory crown — crowns are not camera solids anywhere.
- **#42: L 2 → 4.** `eastProbes` **69 / 69**: the fence's three rope runs (the fence, the west run to the small house's back roots, the
  east run to the third stump) block the walker; the lip past the ends is closed (`walk-east-f84ff318.json`).
- **Caps:** the lookout looking back 691 / 10.19 M (was 761), the green 723 / 10.20 M (was 816; the head's green is 701, the lane +22),
  the fence's west end 682 / 9.87 M — the head's three payments carried in; #46 ★ stays 2 on the lane's own views (the triangles).
- **The six views, against the head it now sits on (`ecaf3df7`):** A 0.9905 (0.93 %, **+0.0033** vs the reference), B 0.9941 (0.54 %),
  C 1.0000, D 1.0000, E 0.9942 (0.54 %), F 0.9947 (1.14 %, +0.0004). The change is the one from 16:03 yesterday, unchanged: **the leaf
  cluster at A's top edge is gone** — 6.8 % of A's top ninth, 1.6 % of the second, nothing below, +38 luma where it was (haze for leaves),
  the 11 m crown rule at the lane's first 14 m. Numerically A moves toward the reference; visually three hero views lose canopy at the
  top. Still the owner's call, and still unanswered in the INBOX.

Scores now: #42 L 4, #44 3, #46 ★ 2 (the lane's views over the triangle cap as the whole head is), the rest as the 16:36 read. One check at 2.

## `a8486d32` (16:51 — the lane's base and mid tiers and its small detail folded into core; only the moss tufts distance-gated) — 17:35–18:06 UTC

Six views pixel-identical to `f84ff318` (1.0000 / 0.00 % at all six) — the fold changes nothing the fixed cameras see; against the
head the pair is `f84ff318`'s (the A / B / E cluster). The lane's frames: the green 723 → **708** draws (10.35 M), the lookout 691 → **674**
(10.27 M), the stair head 519 → 457 (7.63 M) — the fold takes 15–62 draws off the lane's own views. #46 ★ stays 2 on the triangles.

## `a3f57348` (18:45 `72cbd118` — the far colour LOD: while the camera is on the plateau's far part, x > 40 m, the other structures draw a coarser triangle list, their vertices clustered on cells of 1/400 of their distance from there; 18:45 `882070d8` the houses' tufts' coarse copy past 6 m; the head `60085f03` merged) — 19:30–21:20 UTC

**The rule pays: the green 708 → 646 draws / 10.35 → 9.31 M, the lookout 674 → 616 / 10.27 → 9.21 M, the tall deck 616 / 9.09 M — every
plateau frame under the draw cap, 0.1–0.3 M over the triangle line.** Where the cut sits (`isolate`, the head `e438c6e5` at the same
pose beside it): the structures row 173 → **133 draws / 2.33 → 1.84 M** (−40 / −0.49 M); every other row is the head's (trees 218 ↔ 216,
vegetation 123 ↔ 123 — the 0.08 M less is the tufts' coarse copy, rocks, props, hardscape, terrain identical; the character row 56 ↔ 36
is the kids' walk phase at sample time — nothing in the lane touches them). The structures' audit (`eastFarLod`): 77 meshes, fine 911 k →
coarse 490 k triangles, the nearest such part 16.6 m from the box, the heaviest rows `merged:roof` 129 k → 76 k, `lantern-branch-bark`
75 k → 32 k, `fence-south-bridge-rope` 54 k → less. The tests (`farLod.test.mjs` 6 / 6, `expansion2.test.mjs`) pass; the vite build is green.

**What it looks like — designed to be under 2 px, and it is.** The green's frame before and after the rule (the same pose, `it138` ↔ `it140`):
SSIM 0.9993, **0.35 % of pixels** over 8/255, all of it in the village tiles 40+ m off; the lookout 0.9999 / 0.09 %. The cleaner measure —
the same frozen frame with `__KF_EAST_FAR_LOD_OFF__` set and cleared, nothing else moving — at the green: **0.01 % of pixels, max luma
delta 65**, i.e. a few dozen pixels of relief on the far roofs. **The six views are pixel-identical to `a8486d32`** (1.0000 / 0.00 % at all
six — no fixed camera is inside the box, as the layout comment says), so against the head the pair is still the A / B / E cluster of
the 11 m crown rule (A 0.9905 / +0.0033 vs the reference, B 0.9941, E 0.9942, F 0.9947, C D 1.0000) — unchanged since 16:03 yesterday
and still the owner's call.

**The swap itself, in the play loop's own steps: clean.** A scare first, for the record: in my toggle probes the *first* time the coarse
list was set after page load, the frame drawn right after it came out black (mean RGB 11 / 15 / 10, 99.5 % of pixels), while every later
swap was the 0.01 % change above. That probe redraws with a zero-dt step; the play loop never does. Redone in drawn steps at dt 1/30
on a fresh page — the camera placed at x 39.7 (outside, three drawn frames, mean luma 65.5–65.7), then at x 40.2 (the first swap, the
triangles 9.94 → 9.67 M): **the swap frame and the three after it draw normally, mean luma 60.9–61.4**, the 4.6 difference being the
camera's half-metre move (the second pass out and in reads 65.3 → 60.6, the same). No flash for the player. One line for the author,
in case it is ever wired to a zero dt: with a 0-dt step the frame the swap lands in is black. And the rule has **no hysteresis** (a
hard `p.x > 40`): a camera dithering on the line swaps 77 meshes' draw ranges back and forth each frame — 0.01 % of pixels a time,
invisible; a 0.5 m band would only be tidiness.

Scores now: #42 L 4, #44 3 (the small house's door pull-in stands), #46 ★ 2 → **3** on the lane's own views (draws met everywhere on the
plateau, triangles 0.1–0.3 M over), the rest as the 16:36 read. **From this lane's side the branch is merge-ready once the owner has
called the A / B / E top-edge crown change** — the one item that has not moved since yesterday.

## `256ebe91` (19:32 `f154f9f2` the lane's core buckets draw house by house — runs per house, drawn from the first run whose 0.5 m cells the frustum meets to the last; 03:03 `32f852ed` the deck's flight comes up inside the strip's band; the head `33e92705` merged — columnbatch, farfold, farshadow in) — 05:31–06:15 UTC

**The plateau's frames, all under the draw cap, 0.03–0.2 M over the triangle line:** the green **592 draws / 9.20 M** (was 646 / 9.31 M
on `a3f57348`), the lookout **567 / 9.13 M** (616 / 9.21 M), the tall deck **571 / 9.03 M** (616 / 9.09 M), the stair head 415 / 7.09 M
(457 / 7.39 M). Against the head `6bb60a08` at the same poses (652 / 9.84 M at the green, 623 / 9.71 M at the lookout) the lane is −60 and
−56 draws, −0.6 M — the far colour LOD's structures row, unchanged: **133 / 1.84 M at the green, 134 / 1.90 M at the lookout**, exactly the
`a3f57348` numbers. So the frames' −49…−54 draws since my last read are the head's tree batches carried in, and the house-by-house runs
took nothing at these two poses: every house's run has cells in the frustum from the green and from the lookout looking back. The commit
models its cut at "lookout west 1.898 → 1.653 M" — a pose where a house's run leaves the frustum; at my lookout-back (265°) the row reads
1.90 M on both tips. Not a fault — a rule that only pays when a house is out of frame — but the modelled number is not one of my poses'.

**Six views:** pixel-identical to the branch's own `a3f57348` (1.0000 / 0.00 % at all six); against the head the pair is still the
11 m crown rule's — A 0.9905 / +0.0033 vs the reference, B 0.9941, E 0.9942, F 0.9947, C D 1.0000 — the one item on this branch that has
not moved since 16:03 two days ago, and still the owner's call.

Scores as at `a3f57348`: #42 L 4, #44 3, #46 ★ 3 (draws met everywhere on the plateau, 0.03–0.2 M over the triangles — the head's trees
and vegetation). The deck's flight (`32f852ed`) is a walkability fix I have not walked this tick; the lane's own harness route covers it.
