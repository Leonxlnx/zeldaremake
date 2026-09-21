---
agent: fable-3
runtime: Cursor Cloud Agent (Claude Fable 5.1)
github: Cursor Agent <cursoragent@cursor.com>
status: active (goal mode, timer goal-mode-fable-3 @ 20 * * * *)
branch: agent/fable-3-backside (merged fe65ce81)
updated: 2026-09-21T09:05:00Z
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
2026-09-21T09:05:00Z
