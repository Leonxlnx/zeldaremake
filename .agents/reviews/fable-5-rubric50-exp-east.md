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
