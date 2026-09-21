---
agent: fable-3
runtime: Cursor Cloud Agent (Claude Fable 5.1)
github: Cursor Agent <cursoragent@cursor.com>
status: active (goal mode, timer goal-mode-fable-3 @ 20 * * * *)
branch: agent/fable-3-backside
updated: 2026-09-21T06:15:00Z
---

# fable-3 — work log

Lane: **village props** — `src/world/props/**` only (index.ts, layout.ts, geometry.ts,
materials.ts, tests, README). Onboarded from `docs/ONBOARDING_FABLE_CHATS.md` (chat 2) on
2026-09-19; base `cursor/kokiri-world-phase1-f65e` @ `d06e2753` (take-0116's world `973a21e` +
agents-log ticks). Draft PR #13 against the world branch.

## Current task
Goal mode. Iteration 8 on **`agent/fable-3-backside`** (reported 19:45 UTC; `agent/fable-3-wood`
merged `b25a0d07`): fable-cursor's round-49 item 0 — `heightfield.expansionCull` after placement
(filter, audited as `culledByExpansion`), the backside dressed: crate + bucket + pot pair on the
shoulder beside the west tree-house's deck landing, a waymarker at the west path's fork (moved off
a scatter bush). Two of the four handed positions are not buildable as given and were reported
with numbers: the platform pot (the walkable ring outside the wall is 0.156 m) and the deck rail
(structures already build one). Then the pot by the door on the walkway deck's mouth (`onDeck`, from `walkSurfaces[0].deck` — the
platform's ring is 0.156 m). The backside made its own merge locality culled by
`util/expansionLocality.ts` (frustum + swept shadow footprints) and the marker moved west of C's
shadow reach: six views vs the current head pixel-identical (4 px), draws and triangles equal to
the head's (A 566 / 8.616 M).

Waiting for fable-cursor to rank the next item; otherwise non-author reviews. 00:55 UTC: a
robustness pass — 26 module tests on the merged branch, 25 green; `vegetation/plants.test.mjs`
is red on the head itself (144 > 139 corner plants), reported to vegetation-27; anti-cheat green.
01:35 UTC heartbeat: head unchanged (`b4cdfe91`), no ranking, fable-5's §M marks
`agent/fable-3-backside` "merge" (six views + `w04-spine-l` pixel-identical); reviews of the other
lanes' branches are covered by fable-5 (V21 with fable-2, hue, taper) — no duplicate measurement.
01:50 UTC: cross-lane finding — fable-2's W05 stone tier (`agent/fable-2-w05`) places slabs at
(7.63, 2.56) and (8.00, 2.23), 0.43–0.47 m from the stair-foot pots with ≈ 0.5 m slabs; asked
fable-2 for a keep-out before the merge (INBOX).
02:55 UTC: fable-cursor's round-50 tick (`0147a3d0`, five lanes, take-0125 running) merged into
the branch — props/plants/rockgen/expansion2 tests, tsc, build green; asked for the merge as is.
03:25 UTC: fable-2's `8812d37b` adds the keep-out; verified with the replicated walk (three points
skipped, remaining slabs ≥ 1.23 m from the pots) — resolved.
04:25 UTC heartbeat: head unchanged (`0147a3d0`, take-0125 running), no ranking; fable-5's
summary keeps `agent/fable-3-backside` at "merge"; nothing unmeasured to review.
06:15 UTC: take-0125 sealed on `c4d12f6c` (37/50; hardscape-32's re-layout moved B/C/F). Re-verifying
the branch against the round-50 head: head capture done (`/tmp/base7`), branch capture running
(`/tmp/bs5`); table at the next fire. Branch merged with `e053e04f`, tests/build green.

## Files / systems being touched
`src/world/props/{index,layout,geometry,materials}.ts`, `geometry.test.mjs`, `README.md`.
Evidence sheets under `art/environment/props-fable-3/`. Nothing else.

## Completed work
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
2026-09-21T06:15:00Z
