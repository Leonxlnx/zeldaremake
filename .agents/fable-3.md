---
agent: fable-3
runtime: Cursor Cloud Agent (Claude Fable 5.1)
github: Cursor Agent <cursoragent@cursor.com>
status: active (goal mode, timer goal-mode-fable-3 @ 20 * * * *)
branch: agent/fable-3-kokiri-girl (lane 7: the girl by the signpost, the cast back); r55-notes (notes)
updated: 2026-09-24T04:35:00Z
---

# fable-3 — work log

Lane: **village props** — `src/world/props/**` only (index.ts, layout.ts, geometry.ts,
materials.ts, tests, README). Onboarded from `docs/ONBOARDING_FABLE_CHATS.md` (chat 2) on
2026-09-19; base `cursor/kokiri-world-phase1-f65e` @ `d06e2753` (take-0116's world `973a21e` +
agents-log ticks). Draft PR #13 against the world branch.

## Current task
Goal mode. **Everything is merged**: `agent/fable-3-backside` went in at `14f03147` (`fe65ce81`,
fable-cursor's nine-branch batch 04:55 UTC; take-0126 running on the lot). Re-verified on the
round-50 head before the merge report landed: six views identical (4 px in B/E), draws and
triangles equal (A 440 / 8.607 M). Props' list is empty; none of take-0125's failing rubric
items (W02/05/06/08/09/10/23/30/31/37, C01/02, U02) is one props can move. Round 51's internal
lanes are paused by an account block on fable-cursor's side.

Next: whatever fable-cursor ranks; a non-author measurement on request; otherwise heartbeats.
07:50 UTC heartbeat: head unchanged (`48156889`, take-0126 running); active branches (fable-2's
near-skin relief on `fable-2-ledge`, `fable-2-r51`, fable-4's `lod25`) are fable-5's to measure.
08:30 UTC heartbeat: head `54196e0b` (owner's direct bark fix); nothing for props; fable-5 opened
`agent/fable-5-r50-review`.
09:05 UTC: take-0126 sealed on the goal-mode merges. fable-2's reciprocal check: my backside props
clear of their rocks; their V21 anchor moved 0.12 m clear of the squat pot — confirmed the proposed
layout move keeps both pots (no nudge). Offered `potGeometry` to structures for the owner's "shelf
props read hollow" (house.ts shelf items are flat material).
10:30 UTC heartbeat: head unchanged (`f728813e`); no answer yet on the shelf pots; nothing ranked.
11:30 UTC heartbeat: takes 0126 (38/50) and 0127 (brown bark, 38/50) sealed; nothing for props.
12:35 UTC: fable-cursor offered `hardscape/stairs.ts` (log nosings, the owner's stairs) to fable-3 or
fable-2; fable-2 claimed it at 11:35 (`agent/fable-2-stairs-logs`) — no race; offered them the
props' `board`/`lashing`/`rope` builders for the end stakes.
13:30 UTC heartbeat: head unchanged (`d292437a`, take-0128 running); fable-2 building
`agent/fable-2-stairs-logs`; no answer yet on the shelf pots.
14:30 UTC heartbeat: take-0128 sealed 39/50 (W08 pass); nothing for props.
15:20 UTC: fable-2's log nosings merged (93fdff4a); fable-cursor opened the flight's **pitch**
(fable-5's 35–40°) to anyone. Measured before taking: the 20 nosings projected into A and F sit on
the reference's logs; a 37° flight overshoots the top by 27/34 rows. Same-pose renders at
`d_105`/`d_107` read the same as the demo's. Note `.agents/reviews/fable-3-stairs-pitch.md`, sheets
`art/environment/props-fable-3/stairs-pitch/`, branch `agent/fable-3-stairs-pitch` @ 9293b611 —
recommended closing the item; took no code. fable-5 accepted and withdrew the §9 row (15:40);
merged f989e395, the item closed (tick 209).
16:05–16:50 UTC: the owner's "shelf props read hollow" (06:19, unclaimed ten hours, structures
paused) — claimed in the INBOX and done on `agent/fable-3-shelf-mouths` @ 6d5fca4e: `house.ts`'s
`turned()` closed every vessel with a flat disc painted dark; now an optional `mouth` (lip, inner
wall following the profile inset by the wall, floor, shaded). Before/after at three in-house
poses; six views identical to 4 dp (draws equal, B/E +0.01 M tris). Merged 962f9fed (tick 209);
evidence `art/environment/props-fable-3/shelf-mouths/` (README carried over on `fable-3-hearth`).
17:25–18:45 UTC: owner #11's nook at arm's length — the **hearth** (announced 17:25, no stop): the
hero house's torus kerb + squashed ember sphere → ten separate field stones, an ash bed, charred
sticks, seven ember lumps (`agent/fable-3-hearth` @ 72e6ee75). Before/after at 1.4 m and from the
door; six views pixel-identical (0 changed px), draws/tris equal. Evidence
`art/environment/props-fable-3/hearth/`.

18:40–19:45 UTC: hearth merged (tick 210). The upper house's doorway still showed the torus hearth —
the plateau is a destination (owner #14) — so the `hero` gate went: eight coarser stones / two sticks /
five embers there (`agent/fable-3-hearth-upper` @ cedd3bbd). Six views pixel-identical (0 px), draws/tris
equal; A reads 8.80 M on this head (200 K under the line, none of it props: 62.6 K total).

20:30–20:50 UTC: tick 212 merged blockers + hearth-upper + arch-rim; Astra's `ground.ts` hook is live
(r + 0.12, wall policy). Verified offline under that rule: eleven walk corridors keep ≥ 0.48 m beyond
any blocker's radius (bar 0.37) — now an assertion in `geometry.test.mjs` (`agent/fable-3-blockers-walks`).

21:30–22:20 UTC: tick 213 merged arch-rim (tuck) + blockers-walks. fable-2's non-author review of the
roll (IMPROVED, one residual: a slot where mid-roll rays got 0.04·s² of tuck) → round 2: tuck 0.06·s
linear + the bark's UV advanced round the roll. Slot px 16 → 0; D pixel-identical vs the current head
(`agent/fable-3-arch-rim-2`).

09:32–09:45 UTC: ticks 224–225 — memory thrash; fable-4's trees and fable-2's pebbles trimmed. Props' share:
`releaseAfterUpload` on the 13 merged meshes (7.9 MB of arrays; bounds first; nothing reads them after
build), test asserts the hook (fails on head, passes on branch). `agent/fable-3-propmem`. No renders while
take-0133 (sixth start, stalled at A 71–75) runs.

08:20–09:20 UTC: fable-cursor's 07:30 fit → **lane 9** (props + signs of use at player height; Saria's
shelves). Rendered the owner's view (follow camera at the threshold, Link's eye at the door): the shelves
read stocked — the 09-21 "hollow" is closed by the mouths. Added a woven kindling basket with six sticks in
front of the firewood by the hearth (first placement landed inside the wall — the room ends 0.2 k past
the door's right edge; moved in front of the stack). `agent/fable-3-shelves-threshold`; evidence
`art/environment/props-fable-3/kindling-basket/`. The plaza matches review46 (signpost + lantern post at
the split, no pots along the path).

10:20–11:20 UTC: lanes 1–5 held by squad chats (merged, live); none touches props/house. The squad log's
"snag" at (−11.4, 8.25) = my west-fork marker 0.25 m off the fork→landing chord (a corner-cut walk) → moved to
(−11.2, 7.75), the shortcut added as a test corridor (old spot fails, new clears 0.52 m).
`agent/fable-3-fork-marker`. The fork pose from the plaza is now foliage-heavy (squad 2/4 + fable-4's
understory) — the marker hidden; flagged to lanes 2/4 via fable-cursor.

12:20–12:55 UTC: checked the squad's scatters against props: vegetation honours `insidePropFootprint`
(litter/edges/plants); fable-4's understory (trees, built before props) does not know props, and a bole
stands in the plateau cluster on the head (trunk through `upper-crate`). `placementAllowed()` now keeps
props 5 cm off `ctx.shared.slimTrunks` (white-barks + understory); test with a synthetic bole; live audit:
crate + barrel nudged 0.55 m. `agent/fable-3-trunk-avoid`; before/after at the cluster. Suggested to fable-4
that the placer also keep off `PROP_LAYOUT` spots.

13:20– UTC: **lane 7, the people** (fable-cursor 12:55; the owner's "the people also need to be updated"
twice). Saw the problem first: the girl by the signpost rendered at the follow camera's 5 m
(`/tmp/props/girl-shots.json`, cast forced visible on a throwaway build) — a smooth brown helmet of hair
hugging the skull, orange-tan skin, a flat green tunic cylinder; ref-01 / d_024 have a wide maroon bob with
a sheen, pale peach skin, cloth with folds. `agent/fable-3-kokiri-girl`: `kokiri.ts` — bob r × 1.10 → 1.16
with a 0.20 hem flare and seven soft lobes below the band, crown r × 1.18, side locks moved to the bob's cut
edge (thicker, 5 mm clear of the cheek), a hair canvas (nine broad locks, fine strands, hem shade, roughness
0.58 for a sun sheen) that every hair part carries UVs onto (spheres theirs, fringe `shell` grid, clumps
`clumpUv`), a cloth canvas on the tunic (four drape valleys in step with the skirt's `cos(4a + 0.7)` ridges —
`skirtPanel` u is now a / 2π — hem + belt shade, a two-texel weave), skin 0xbd8a62 → 0xd3a98a (all four
looks paler). `npc.ts` — the four fairy point lights ride on the npc group (constant light count, the
north-posts precedent), positioned from `anchor + offset(t)` each frame, dimmed by a `glow` factor where a
fairy is hidden (ledge, under capture) or kept out of the six frames (bank) — no `visible` toggles.
`character/index.ts` — `backgroundCast.visible = true`. Same meshes per kid. Six views WILL change where the
kids stand (owner-approved: the cast returns) — measured against the exact head build below.
Round 1 at 5 m (paler skin, lock shading, sheen) was too subtle to call a step — pushed: head joint ×1.14
(`HEAD_SCALE`; face/hair/band grow together, the skull meets the shoulder line as in d_024), the footage's
maroon (0x7e2f33) with stronger lock contrast, four fold ridges on the tunic upper (UVs turned to the skirt's
convention so the canvas valleys sit in the lathe's own), thinner brows (a frown at 5 m under the grown head).
Budget: the cast back put A at **723 draws** — the sun's 92 m shadow window draws every kid in the village each
frame. Kids now cast only while their shadow reach (2.6 m; 7 m for the ledge girl) meets the view frustum
(`scopeKidShadows`, no program key touched); belt / band / cuffs leave the shadow pass; no neck mesh (enclosed
under the scale). Six views vs the exact head build (settle 12): A −0.0044 / 597 → 698 draws, B −0.0063 / 690,
C −0.0001 / 525, D 0 (byte-identical, 557 → 557 — the scoping proven), E −0.0045 / 690, F −0.0014 / 648; every
changed pixel a kid, her fairy, shadow or light pool. Play walk: programs 111 → 112 over 9 s, draws 711 → 537.
Evidence `art/environment/people-fable-3/kokiri-girl/`.
17:35–17:55 UTC: the final (`8651fce3`: thinner brows, cuffs out of the shadow pass, no neck mesh) re-captured at A / B —
692 / 684 draws, 8 / 30 px from `b1ebee6b`'s frames. The walker probe (`__ZR__.audit().systems.character.npc`) showed the
kid in my 5 m frames was the SITTER on the first tread (the walker dwells at (4.4, 0.9) at broll's t) — labels corrected;
the walker rendered where she stands at 2.6 m / 5 m (`before-after-walker.jpg`, the clearest sheet). fable-cursor merged
`8651fce3` into the head (`b39d395e`) before the report landed; INBOX note posted 17:55 with the list for next: legs 44 → 40 %, the boy's round-1 look, the understory over the walker's
loop sightlines (lanes 2 / 4). (The note's first draft listed the sitter's knees at 177° — an audit read under per-view
placement where the seat is not driven; in free / play mode she sits as designed. Corrected 17:58.)

17:55–18:35 UTC: **the boy at Saria's door** (`e7a01c7e`) — the owner's threshold approach had round 1's boy (sphere-and-boxes
bob, thin band, tan skin, flat near-black tunic) beside the door next to the girls' new look. He shares the pass now:
`buildGirlHair` (no tube brows — `buildFace` has box brows), `buildGirlHeadband`, the cloth canvas + four fold ridges on both
lathes (near-black lifted to 0x2f3320), skin 0xcfa07c on the ramp; materials keyed by name (`hairMaterial` / `clothMaterial` /
`rampedSkin`). Before/after at the threshold pose + 2.5 m (`before-after-boy.jpg`; the before = the merged head with the girls'
pass). Six views vs the merged head `bd0bd1ba`: B −0.0003 (685 px, his box), F 0 (515 px), draws/tris equal. INBOX 18:35.
Chrome-free note: a broll `--test` render drives the loop — the walker is wherever the schedule has her at t ≈ 13.2 s
((4.4, 0.9), facing SW); `where.mjs` (audit `systems.character.npc.walker`) finds her before aiming a pose.

18:40–19:25 UTC: **the fairies** (`044fb636`) — d_026 / d_090 show the girl's fairy as a glowing ball with wings about as
wide as her head; ours was a dot at 5 m (5 cm ball, 0.2 m halo at ¾ tint, 0.1 m wings). `navi.ts createFairy`: 0.05·s ball,
0.4·s halo at full tint, 0.22·s wings → at the kids' 0.75: 7.5 cm / 0.3 m / 0.17 m, just under Navi's (8.4 cm / 0.3 m).
Before/after at the two 5 m poses (`before-after-fairy.jpg`); six views vs the branch before the step on the merged head:
A +0.0002, B −0.0004, F −0.0003 (the fairy's box each), draws/tris equal. INBOX 19:25. Baselines: a six-view "before"
must be the exact commit under the change — `git worktree add` + `vite build --outDir` (1 min) beats reusing an older dist.

19:25–20:15 UTC: **the kids notice Link** (`e43ae92f`) — nothing in the cast reacted to the player. `npc.ts noticePlayer`:
within 5 m the posed head turns to him (fully by 2.8 m; a fade past ±1.05 rad instead of pinning to the shoulder; pitch to
his eyes; the hips'/chest's own yaw taken out of the target), blended over the pose's look; the driven kids in `drive()`,
the boy after his idle pose in `index.ts`; no state. Capture passes no player → B and F byte-identical (`cmp`); play draws
702 = 702. Stills with Link 2 m from the sitter (`before-after-notice.jpg`), the walk-in clip (`kokiri-notice-walk-in.mp4`).
Framing lesson: with Link facing a kid straight on, the follow camera hides her behind his head — aim him 15–20° off.
Legs (44 → 40 %) measured and dropped: 42 % with the hair height, two centimetres. INBOX 20:15.

20:20–21:50 UTC: fable-cursor merged the lane-7 round (`f1f93d77`, play link `b51f0954`). fable-5's lane-10 read (and
their 20:15 note to me): a kid in view ≈ 50 draws, B / E two under the cap, "the kid as merged meshes next"; also "5 m
from the girl is 10 m for the lens". **Skinned kids** (`814af6c9`, `character/skin.ts`): every Mesh under a joint → one
SkinnedMesh per (material, shadow flags) per kid, the rig's own Groups as bones (weight 1), bound at rest in attached
mode; ≈ 26 → 11 colour submissions, 16 → 5 shadow. First cut left the vertices in joint space (the kids came apart) —
the joint's rest world matrix is baked in now. Six views on the same head: A 692 → 640 (0 px), B 683 → 631 (8 px),
F 642 → 590 (2 px), tris equal; the play still with three kids 702 → 623 (8 px); the walker mid-stride (broll t 10.4)
17 px, at her dwell (t 12.0) 1 px; the sitter's fold and the head turn intact. INBOX 21:50. Lesson: verify a rig-structure
change on every pose class (stand, sit, stride, head turn), and `where.mjs` / the schedule to find a stride time.
21:50–22:00 UTC: fable-5's 21:43 read confirms the skinning (A 640 / B 631 / F 590, merge-ready by the counts). Lane 7's
ranked list is empty; the open people-visible defect (the walker behind an understory crown from the plaza's SW) is lane 2's
— `nearestWalkLine` knows the four paved lines, not `NPC_LOOP`; asked fable-4 for a fifth line at 3–4 m (INBOX 21:58), and
offered fable-cursor lane 9's signs of use for `exp-south` once its positions settle. Next tick: reads of a named branch, or
the atlas step (3 submissions a kid) if the budget calls for it.
22:25 UTC heartbeat: the skinning is merged and live (`276cd803`, play link `94d96536`; squad log 22:05). No ask for lane 7 /
9 on the head; my 21:50 / 21:58 notes ride the next merge. Read fable-cursor's `exp-south` where it touches lane 7's files
(`character/index.ts` `moveRoot` edge-slide — `ground.blocked()` now makes props slide-able edges; `ground.ts` walk spans for
the deck / tunnel floor and the off-deck ravine block, `builtTop()` clearing the deck first): sound, no overlap with the
kids' code, clean merge. `EXPANSION_SOUTH` (path nodes, bridge sills, tunnel mouth) is specified — the signs of use wait
for fable-cursor's word. Nothing landed this tick.
23:25 UTC: the head merged my notes (`77c4a7bc`) and lanes 1 / 5 (corridor air, gust-gated wind). Read the people on
`81430baf` at the walker's 5 m and a 10 m pose (the follow lens's distance): unchanged at 5 m, the Kokiri read holds at
10 m under lane 1's air (`head-81430baf-corridor-air-5m.jpg`). INBOX 23:40 (a read, not a landing). No ask for lane 7 / 9.
00:27–00:45 UTC: **owner 23:00 review** (`pass5/README.md` on squad4's branch): "make the other characters look a bit
better" → JOB 7, lane 7's; he records at 01:00. Landed small and safe (`a0262ae1`): thumbs on the mitten hands
(`buildThumbs`, in the skin's skinned submission) and the standing idle's arms — upper arm a touch back, elbow bent
−0.46 rad, the hand by the hip (`poseWander`; the sitter's hands stay on her knees; A–F untouched, the plaza kids pose
through the puppet idle under capture). Verified at the walker's 2.6 m vs the head `81430baf`
(`before-after-hands-arms.jpg`): reads, modest. INBOX 00:35 (claim) — a fresh chat may have been spun up on
`agent/kokiri-quality`; asked fable-cursor to point them here. After the recording: the rest of JOB 7's list at 2–6 m.
01:29–02:10 UTC: fable-5's 00:36 question (a compile at the flight's top on the prebuild head — the skinned kids?):
measured with `programs.mjs` (`?warmup=1`, one frame per spot): 177 programs after the warm-up and 177 through the sitter,
the door boy, the flight's top, the bank girl, the ledge girl — the warm-up passes each object to `getProgram` in both
passes and the kids are casters before the scoping runs. INBOX 01:45. Then JOB 7's idle (`437b7166`): weight shift 2.5 cm
+ 0.05 rad lean + a slow torso yaw sway, breath 8 mm; thighs tilt back by shift / legLen and cancel the pelvis' lean so
the soles stay planted. Verified at t 14.8 inside her dwell vs `a0262ae1`: the body over one leg, the boots in the same
pixels (`before-after-idle-sway.jpg`). A two-time motion metric (t 13.6 vs 14.8) was swamped by the dwell look-around
and the fairy in both builds — the same-instant pair is the honest measure. Play-mode note: the flight's top looking down
draws 730 (not a fixed view).
02:31–02:55 UTC: the head still at 23:05; squad4 built an integration candidate (`8fb5049c`, six branches) without my two
JOB 7 landings — offered them (INBOX 02:40). Tried JOB 7's "faces as geometry" for the boy: `buildKidFace` parametrised
(`KidFace`: skin / iris / blush / lips / lash / flick) and the boy on it (`ed5b43c6`). At 2.5 m it read WORSE (small dark
eyes under the fringe vs round 1's big bright ones) → reverted (`2fab35f4`), pair kept (`tried-boy-modelled-face.jpg`),
INBOX 02:55 correction. Lesson kept: the girls' face works because of the lashes' weight and the flick; a boy variant
needs its own lid opening, not the girls' with the lashes thinned.
03:33–03:55 UTC: head still at 23:05 (fable-cursor on the expansions; `exp-south` at "final verification" `9d32b7f1`).
Planned its signs of use against the final layout (waymarker at the fork's west verge, crate + squat pot at the bridge
head, pots either side of the log's mouth) and found the blocker: `expansionCull` drops props on the route / structures /
cut / moved ground and props sample the LEGACY heightfield — a `south` cluster needs live-view heights and a verge-only
exemption (props-side, reading `terrain/south.ts`). INBOX 03:55 with the plan; building when `exp-south` lands.
04:20–04:30 UTC: the head moved to `ad4d5537` (the owner-23:00 squad round; fable-2's tracked `node_modules` link accident
fixed — I add paths explicitly, never `-A`; my worktree links were never staged). My branch not in that round → merged the
head into it (`6d28ad46`; INBOX conflict resolved by rebuilding both note lists newest-first, 185 notes), build + 119 tests
green. INBOX 04:30: merge-ready with the two JOB 7 landings. Read the people on the merged branch vs the 23:05 head at the
walker's 5 / 10 m (lane 1's sky light, lane 4's verge tier in): unchanged but for my own arms and sway — nothing to flag. Play mode at the plaza spot: head 604 → 779 draws with three kids in frame.

## Files / systems being touched
`src/world/props/{index,layout,geometry,materials}.ts`, `geometry.test.mjs`, `README.md` (lane 9);
`src/world/character/{kokiri,npc,index}.ts` (lane 7, from 2026-09-23 12:55).
Evidence sheets under `art/environment/props-fable-3/` and `art/environment/people-fable-3/`.

## Completed work
- merged `fe65ce81`: the backside branch (item 0 in full) — final six-view table on the round-50 head in `backside/README.md`.
- `52e2a745` / `da630293` the deck pot by the west-house door (`onDeck`), six views identical to the head.
- `3227a358` / `054cee47` the backside as its own culled locality; the marker's final spot; evidence.
- `b1a07f2b` / `90f63fed` / `09fc511e` the backside (landing stores, fork marker, expansionCull
  filter, the test on the legacy view); evidence `backside/`.
- `73129594` / `44873644` the props' wood toward the fences' red-brown (measured), evidence `wood-tone/`.
- `48a48978` pots in two tones (clay-map firing tone + slip drips, per-pot UV offset, wider flash),
  the marker hand-hewn (`board({ wobble })`); evidence `pot-tones/` — merged `dbc1d87e`.
- `21dfa7d0` iteration-5 evidence (`art/environment/props-fable-3/light-strings/`): reference|ours
  crops at the same band of A, before/after at the bank pose, six views.
- `b8034a7c` … `4b1edb0b` the `lightString` kind + `glow` material; four placements measured
  against the six views (the first three, on approximate coordinates, cost C up to −0.0029).
- `c8263f53` iteration-4 evidence (`art/environment/props-fable-3/merge/`): six views pixel-identical
  vs `0987e060`, draw deltas per view.
- `38aa5bfd` / `f37968ba` merge per locality (8 meshes), README.
- `351739cc` iteration-3 evidence (`art/environment/props-fable-3/north-clearing/`): six views
  pixel-identical with the clearing drawn and culled, before/after at three clearing poses.
- `0b46deb7` distance cull per cluster (45 m; `update` + `onCameraMove`; `audit.culling`).
- `eaf4b930` / `f8b73662` the waymarker builder and the north-clearing cluster (marker + 4 pots) —
  merged `7fda3f98`.
- `798f48af` iteration-2 evidence (`art/environment/props-fable-3/lookout/`): six views
  pixel-identical vs the world head, before/after at three lookout poses, the hidden-dais finding.
- `393d4337` railing posts run from the turf through the slab (hardscape hides `flagstones-north`,
  dais included, beyond 45 m of the north clearing — from the plateau the slab is never drawn).
- `6d04bcad` the lookout railing bound to `LAYOUT.plateauLookout` (no deck of its own; ropes,
  lashings, a step block), `ctx.shared.propFootprints` published, tests for both.
- (merged `4b86846`, PR #13) the first pass below.
- evidence: `art/environment/props-fable-3/` (six-view sheet + 8 pose sheets + README with the
  SSIM / draw table and honest remainders).
- `4f6476f` warmer wood (×1.85/1.42/0.92), clay shade floor halved, squat plateau pot off a fern.
- `8f47073` wood on the plank map's true scale (its linear mean is 0.082/0.058/0.044 — ×4.2
  read as bleached driftwood in the plateau sun), shade floors for wood / clay / rope
  (`materials/shadeFloor.ts`, shared module), near-matte iron, thinner darker ropes, lip deck
  raised 0.4 → 0.62 m with two block steps (the lawn's 0.4–0.8 m ferns poked through 0.4 m).
- `9e28fe7` the props rebuild: pot family (3 thrown profiles, closed lathe with a rolled lip and
  a solid floor, ochre body + dark rim band + shoulder line, per-pot wobble, original procedural
  wheel-ring colour/normal `DataTexture`s), crates as chamfered boards on `weathered_planks`
  with per-board UV columns at true scale, nails, an askew board; coopered barrel (18 staves,
  4 hoops, board lid) and bucket; rope-and-plank ladder on the upper house's trunk (crossbar
  pegged into the bark, lashed rungs); platform builder with rope railing / lashings / ladder or
  steps; clusters merged per material (7 clusters → 16 meshes, 44.5 k triangles); placement
  rules gain hero boulders, npc spots (0.8 m), signposts, a porch-aware house clearance, the
  `paving` and `pad` flags; small props level-limited to 9° with the underside conformed.
- `2b1eed7` onboarding (log, INBOX).

## Important decisions
- Leaf module kept: no imports from other systems; `ctx.textures` for the plank set (already
  credited CC0) and `materials/shadeFloor.ts` (shared, like `materials/textures.ts`). Clay and
  rope maps are pure-JS `DataTexture`s so the Node test builds them and W41 sees the same bytes.
- Positions: door pots on the porch floor, viewer's LEFT of the doorway (the right side is a
  60° bank); stair-foot pots on the paved apron at the bottom riser's south corner (the north
  side is inside the wide `stairs` mask and the C protected box); the storage corner stays on the
  plateau lawn by the plateau-north fence (the plateau has no paving and the upper house's pad
  barely clears its trunk); the lip deck where the plateau-west fence ends (only camera F sees it,
  (0.62, 0.23) at 26 m); the ladder at 77° round the upper house (between its roots at 46° / 113°).
- The round-31 Saria crate authored at (8.75, −8.0) was on the walk's stepping-stone mask and had
  been nudged onto a 55° bank at (9.5, −7.25) every build; it is now a 0.58 m crate in the flat
  pocket right of the walk's end, `pad: true`.

## Known issues
- The stone dais under the lookout railing is never drawn where it can be seen (hardscape's
  `flagstones-north` visibility rule, reported 2026-09-20 01:25 UTC): until hardscape-31 fixes
  it the railing stands in the lawn; the posts reach the turf so nothing floats.
- The PR tool cannot open PRs for this identity any more (GitHub "must be a collaborator");
  branches are pushed and fable-cursor is asked to open them.
- Fern fronds intersect props wherever the lawn scatter is dense (survey-2 #37 in general): the
  vegetation does not know about props. `ctx.shared.propFootprints` is now published; vegetation-26
  is to read it. Until then the plateau pots stay at frond-free spots at the judged poses.
- The plank map is grey-brown; the crates read a shade greyer than the fences' red-brown posts
  (which use the same map under a different tint and floor).

## Recommended next work
- Vegetation: an exclusion mask around prop footprints (`props/layout.ts` positions + radius, or
  a `ctx.shared.propFootprints` list — props would then have to build before vegetation).
- A Kokiri on the lip deck (npc-1) — the deck is the "stand on the ledge" destination.

## Last updated
2026-09-21T14:30:00Z
