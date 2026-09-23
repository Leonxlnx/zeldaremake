---
agent: fable-3
runtime: Cursor Cloud Agent (Claude Fable 5.1)
github: Cursor Agent <cursoragent@cursor.com>
status: active (goal mode, timer goal-mode-fable-3 @ 20 * * * *)
<<<<<<< HEAD
branch: agent/fable-3-r55-notes (heartbeats); propmem merged 3d4effbe (tick 226); tunnel-floor note pending
updated: 2026-09-23T01:24:00Z
=======
branch: agent/fable-3-propmem (OOM ask: CPU arrays dropped on upload); notes branches pending
updated: 2026-09-22T09:45:00Z
>>>>>>> origin/cursor/kokiri-world-phase1-f65e
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

<<<<<<< HEAD
00:25–00:35 UTC heartbeat: tick 216 (heel guard, fable-4's W38 give-back); take-0132 on its B view,
take-0133 queued; nothing for props. Asked fable-cursor to rank one of three (the passage light, a
paused-lane arm's-length item, non-author reviews).

01:28–01:35 UTC heartbeat: tick 217 — take-0132 died at C under load 7 (other agents' captures, mine among
them in the evening); take-0133 restarted 01:15 on 520537e6 with the full note. Standing rule for me from
here: **no captures or pose renders while a take is capturing** — measurements only offline (the anchor
projector, the test harness) until it seals. B3's census fix (9b93f1c9) does not touch props (the
cross-check list is grass / flagstones / white-barks / leaves / fireflies / pebbles). No answer yet to the
00:35 ask; nothing for props.

02:34–02:40 UTC heartbeat: tick 218 — capture chunking fixed (5 frames per CDP call, 1,200 s timeout),
B3 census fixes, take-0133's third start at 02:15 under load < 1 → no renders from me while it runs.
Props tests green on the head (073f5ff2 merged in); fable-2's system map puts character + props + rest
at 0.24 M / 3 % of A. No answer yet to the 00:35 ask; nothing for props.

03:25–03:30 UTC heartbeat: tick 219 (heartbeat) — take-0133's A frame at 03:12 with the 5-frame chunks, seal
~05:45; no new source this hour; no answer yet to the 00:35 ask. No renders from me while it captures.

04:31–04:40 UTC heartbeat: head unchanged since tick 219 (take-0133 capturing, seal ~05:45). fable-5's
round-52 list (r54-branches §F) has twelve items, none for props; #12's V14 (pod posts: 1 pod on a hook vs
the demo's 3–4 on a bark post) is structures' and a look change at A — fable-cursor's to rank. fable-2
measured V16 five ways (not "a seam value"). No answer yet to the 00:35 ask; no renders while the take runs.

05:33–05:40 UTC heartbeat: ticks 220–221 — the capture stall found (one long page degrades across
views; a fresh page per viewpoint now), take-0133 on its fourth start (A 05:16, B running); the owner's
05:04 items were audio (done on the head); fable-2's dressing fade merged. Nothing for props; no answer
yet to the 00:35 ask; no renders while the take runs.

06:28–06:35 UTC heartbeat: tick 222 — the fourth take-0133 died at B even with a fresh page; a browser per
viewpoint now, fifth start 06:22. No new source; nothing for props; no answer yet to the 00:35 ask. No
renders from me while it captures.

07:34–07:45 UTC: tick 223 — the capture stalls are OOM kills (renderer 1.94 GB + GPU 1.70 GB; a memory ask
to fable-4 / Astra / fable-6). Measured props offline through the test harness: 13 meshes, 187.9 K
vertices (non-indexed merges), 7.9 MB arrays + 2.8 MB own textures ≈ 11 MB (≤ 20 MB with GPU copies) —
posted so it can be subtracted. take-0133's fifth start alive past A's frame 65; no renders from me.

08:26–08:30 UTC heartbeat: head unchanged since tick 223; take-0133's fifth start presumably still
capturing; fable-2 answered the memory ask for rocks (`fable-2-pebble-bytes`). Nothing for props; no
answer yet to the 00:35 ask; no renders.
=======
09:32–09:45 UTC: ticks 224–225 — memory thrash; fable-4's trees and fable-2's pebbles trimmed. Props' share:
`releaseAfterUpload` on the 13 merged meshes (7.9 MB of arrays; bounds first; nothing reads them after
build), test asserts the hook (fails on head, passes on branch). `agent/fable-3-propmem`. No renders while
take-0133 (sixth start, stalled at A 71–75) runs.
>>>>>>> origin/cursor/kokiri-world-phase1-f65e

10:32–10:40 UTC heartbeat: tick 226 merged propmem (with fable-2's rock bytes/upload; 29/29 rocks/props
tests). The stall recurs with 7 GB free — fable-cursor's hypothesis is a late shader compile when the
pools pin a new part type. Props cannot be that: five shared material instances, all drawn from frame 0
at every view (the culled localities reuse them — no late program variant). Nothing for props; no
renders while take-0133 runs (B 71–75).

11:26–11:32 UTC heartbeat: tick 227 — take-0133 grinding (C at 80+, ~5 h to seal; the whole capture 2.5×
slower than yesterday, SwiftShader at 370 % of 4 cores); fable-cursor keeps their own load minimal, so do
I. fable-4's vertexbytes merged. Props' GPU copies are ≈ 8 MB — a compaction would return ~3 MB, not
worth a change. Nothing for props; no answer yet to the 00:35 ask.

12:32–12:36 UTC heartbeat: tick 228 (heartbeat) — take-0133 at D (C sealed 2,829 s; D stalled once at
71–75). No new source; nothing for props; no answer yet to the 00:35 ask; no renders.

13:24–13:30 UTC heartbeat: tick 229 — the owner's grass item done by hand (mid blade LOD 16 → 26 m;
+60–100 K tris at A to be measured at take-0134); take-0133 at F (E 13:06), det + motion after, ~2 h to
seal. Nothing for props; no answer yet to the 00:35 ask; no renders.

14:27–14:32 UTC heartbeat: tick 230 (heartbeat) — take-0133 through F (1,160 s, no stall), the det pass
stalled once at 11–15; motion after. Nothing for props; no answer yet to the 00:35 ask; no renders.

15:32–15:40 UTC: **take-0132 sealed** on 06b420c9 (seven hours of capture) — 41/50, A 0.2153 → 0.2209,
F −0.0062 (Astra's bank cores), B/C/D/E within −0.004. Booked with my hearth, arch roll, collision hook
and deck lane: **W25 (house interior) pass, W24 anti-cheat pass, W38 pass (A 8.68 M)**; the nine fails are
the known other-lane items (W05/09/10/30/31/37, C01/02, U02). take-0133 started 15:50 on f9c58007+ (grass
to 26 m, the memory branches incl. propmem, dressing fade) — no renders from me. Notes branches
(tunnel-floor, r55-notes with the 00:35 ask) still unmerged; nothing ranked for props.

16:36–16:42 UTC heartbeat: the owner's clarity direction (distant/high trees clear, less grey washout,
blurry crowns) is Astra's / fable-4's / fable-5's — "nobody else starts a fog or crown pass". fable-5's
take-0132 read: pipeline healthy, deltas are the source, W02 pass reinforced, 41/50; nothing on props.
Tick 232: take-0133 A 8.83 M (the grass), stand LOD merged. Nothing for props; no answer yet to the
00:35 ask; no renders while take-0133 captures.

17:25–17:30 UTC heartbeat: tick 233 — owner-fable's clearing roof merged; Astra's far-crown atlas painter
and height-fog clarity slice (hazeDensity 0.018 → 0.008, farShadeMin 0.30 → 0.65) imported; take-0133 at
D, take-0134 queued behind it. Astra also takes the near-canopy free-camera admission lane. Nothing for
props; no answer yet to the 00:35 ask; no renders while the takes capture.

18:29–18:33 UTC heartbeat: tick 234 (heartbeat) — take-0133 through E with no stalls since C; F next;
Astra's running posture import. Nothing for props; no answer yet to the 00:35 ask; no renders.

19:35–19:40 UTC: **take-0133 sealed** (grass to 26 m, the six memory branches incl. propmem, dressing fade):
41/50, A −0.0001 / B +0.0001 / C −0.0004 / D 0 / E +0.0003 / F −0.0022, A 8.83 M / 452 — propmem neutral as
claimed. take-0134 (the clarity set: fog, atlas, roofs, stand LOD, Link posture) started 19:32; every frame
changes by the owner's direction. Nothing for props; no answer yet to the 00:35 ask; no renders.

20:20–20:25 UTC heartbeat: tick 236 — take-0134 (clarity set) A in at 8.78 M / 456; Astra's upper-canopy
admission and far packs imported for the next take. Nothing for props; no answer yet to the 00:35 ask;
no renders while it captures.

21:20–21:24 UTC heartbeat: tick 237 (heartbeat) — take-0134 at C (B 20:30; C stalled once). Nothing for
props; no answer yet to the 00:35 ask; no renders.

22:20–22:24 UTC heartbeat: tick 238 (heartbeat) — take-0134 at D (C 21:25; D stalled once at 26–30).
Nothing for props; no answer yet to the 00:35 ask; no renders.

23:20–23:24 UTC heartbeat: head unchanged since tick 238; take-0134 still capturing (D/E/F, det, motion
ahead). Nothing for props; no answer yet to the 00:35 ask; no renders.

00:20–00:24 UTC (23 Sep) heartbeat: tick 239 — fable-4's colour-pass culling merged (A −150 K, F −130 K,
pixel-identical); take-0134 at E. Nothing for props; no answer yet to the 22 Sep 00:35 ask; no renders.

01:20–01:24 UTC heartbeat: tick 240 (heartbeat) — take-0134 at F (E 23:29; F stalled once at 51–55); det +
motion after. Nothing for props; no answer yet to the 22 Sep 00:35 ask; no renders.

## Files / systems being touched
`src/world/props/{index,layout,geometry,materials}.ts`, `geometry.test.mjs`, `README.md`.
Evidence sheets under `art/environment/props-fable-3/`. Nothing else.

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
