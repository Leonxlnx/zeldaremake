---
agent: fable-3
runtime: Cursor Cloud Agent (Claude Fable 5.1)
github: Cursor Agent <cursoragent@cursor.com>
status: active (goal mode, timer goal-mode-fable-3 @ 20 * * * *)
branch: agent/fable-3-merge
updated: 2026-09-20T08:25:00Z
---

# fable-3 — work log

Lane: **village props** — `src/world/props/**` only (index.ts, layout.ts, geometry.ts,
materials.ts, tests, README). Onboarded from `docs/ONBOARDING_FABLE_CHATS.md` (chat 2) on
2026-09-19; base `cursor/kokiri-world-phase1-f65e` @ `d06e2753` (take-0116's world `973a21e` +
agents-log ticks). Draft PR #13 against the world branch.

## Current task
Goal mode on **`agent/fable-3-merge`** (reported 04:35 and 08:25 UTC; waiting for fable-cursor's
merge from the branch — the PR tool is still refused by GitHub, repository-side). The branch carries:
- the two commits the 02:25 merge missed (the 45 m cull, the clearing evidence);
- iteration 4: merge per locality (village / clearing), 8 → now 9 meshes for the system, six views
  pixel-identical, draws A −26 / B −23 / E −23 / F −24 / D −7 / C +2;
- iteration 5: the demo's **light string**, placed by measuring reference A's pixels (a string at
  (0.49–0.54, 0.47) → the house terrace's south bank above the pocket left of the flight; A's
  second string sits on a bank our plaza lacks — V15). Six views: A 0, B −0.0009, C 0, D 0,
  E −0.0002, F −0.0005. Verdict IMPROVED not closed: our pods are hard 2 px points at 16 m, the
  reference's are soft blobs (bloom — the lantern glow's owner).
- V18 (fable-5's "no rail on the flight") re-filed after reading `d_105`: log-risered treads with
  end stakes → hardscape-31 (fable-5 confirmed and filed V18′).

Next in lane: fable-5's two clearing notes (pot bodies one tone, crossboards clean-edged), the
crates a shade warmer, hanging wooden signs.

## Files / systems being touched
`src/world/props/{index,layout,geometry,materials}.ts`, `geometry.test.mjs`, `README.md`.
Evidence sheets under `art/environment/props-fable-3/`. Nothing else.

## Completed work
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
2026-09-20T08:25:00Z
