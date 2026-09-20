---
agent: fable-3
runtime: Cursor Cloud Agent (Claude Fable 5.1)
github: Cursor Agent <cursoragent@cursor.com>
status: active (goal mode, timer goal-mode-fable-3 @ 20 * * * *)
branch: agent/fable-3-lookout
updated: 2026-09-20T00:40:00Z
---

# fable-3 — work log

Lane: **village props** — `src/world/props/**` only (index.ts, layout.ts, geometry.ts,
materials.ts, tests, README). Onboarded from `docs/ONBOARDING_FABLE_CHATS.md` (chat 2) on
2026-09-19; base `cursor/kokiri-world-phase1-f65e` @ `d06e2753` (take-0116's world `973a21e` +
agents-log ticks). Draft PR #13 against the world branch.

## Current task
Goal-mode iteration 2 (`agent/fable-3-lookout`, from the world head `eec1ce09`): round 47's
handoff to props — the platform bound to `LAYOUT.plateauLookout` (as a rope railing ON
hardscape's stone dais; the #13 deck stood 1.9 m from it as a second platform) and
`ctx.shared.propFootprints` published (the field and the build order landed at merge, the writer
did not). PR #13 merged `4b86846`. The PR tool refused to open the follow-up PR ("must be a
collaborator", GitHub) — branch pushed, fable-cursor asked in the INBOX to open it.

Next in lane (docs/GOAL_MODE.md): the north clearing's props at the stone circle's entrance
(pots + a wooden marker, expansion-1's brief), then LODs / ≤ 20 draws; still open from pass 1:
hanging wooden signs, the crates' wood a shade warmer.

## Files / systems being touched
`src/world/props/{index,layout,geometry,materials}.ts`, `geometry.test.mjs`, `README.md`.
Evidence sheets under `art/environment/props-fable-3/`. Nothing else.

## Completed work
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
- Fern fronds intersect props wherever the lawn scatter is dense (survey-2 #37 in general): the
  vegetation does not know about props. In-lane the plateau pots were moved to frond-free
  spots at the judged poses (deterministic scatter); the real fix is a prop-exclusion hook in
  vegetation (asked in the INBOX, 09:20).
- The plank map is grey-brown; the crates read a shade greyer than the fences' red-brown posts
  (which use the same map under a different tint and floor).

## Recommended next work
- Vegetation: an exclusion mask around prop footprints (`props/layout.ts` positions + radius, or
  a `ctx.shared.propFootprints` list — props would then have to build before vegetation).
- A Kokiri on the lip deck (npc-1) — the deck is the "stand on the ledge" destination.

## Last updated
2026-09-19T12:45:00Z
