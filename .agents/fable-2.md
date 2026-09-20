---
agent: fable-2
runtime: Cursor Cloud Agent (Claude Fable 5.1)
github: Cursor Agent <cursoragent@cursor.com>
status: active
branch: agent/fable-2-ledge
updated: 2026-09-20T03:45:00Z
---

# fable-2 — work log

Lane: `src/world/rocks/**` ONLY (rockgen.ts, dressing.ts, material.ts, index.ts, ledge.ts, tests,
plus new rock modules under the same directory). Onboarded from `docs/ONBOARDING_FABLE_CHATS.md`
(Chat 1). Goal mode since 2026-09-20 00:00 UTC (`docs/GOAL_MODE.md`; timer `goal-mode-fable-2`,
cron `20 * * * *`). Each iteration branches afresh from `origin/cursor/kokiri-world-phase1-f65e`
as `agent/fable-2-<topic>`; `fable-cursor` merges. I do not touch `layout.ts`, the ledger or the rubric.

## Current task (goal mode, iterations 2–3 on `agent/fable-2-ledge`)
- Iteration 2 — opus #03 / GOAL_MODE fable-2 #1, the north-terrace ledge as ref-04's damp
  rock-and-root wall: DONE (`ccd9a22a`), evidence `art/environment/fable-2-rocks/README.md`
  §Iteration 2.
- Iteration 3 — opus #10 / GOAL_MODE fable-2 #2, the shot-D boulder's value at 2 m: DONE
  (`20513c24`), §Iteration 3. Probes put the whole gap in the stone's value (the normal map,
  roughness and the near colour terms each changed nothing measurable; a white rock renders 0.47
  there). Near path only: stone ×1.35 and warmer, wet band / grime lighter, the D skin's cleave
  darkening 0.4 → 0.12, shaded moss rim +25 %. Face 0.166 → 0.205 at fern parity (0.213), as
  the reference's frame D has it. The spot's absolute level (ferns 0.21 vs the reference's 0.32)
  is the lighting's (opus #13).
PR creation from this chat is refused by GitHub ("must be a collaborator" for the agent account);
the branch is pushed and fable-cursor can open / merge from it. Next: GOAL_MODE fable-2 #3
(scree at the ledge flight's flanks, a boulder pair on the clearing's west bank, half-buried
strata along the terrace face — positions in `art/environment/round47-review/README.md`).

## Iteration 1 (PR #12, merged `f092a094`)
Rocks pass from survey-2 and the owner's 2026-09-19 references (rubric W23 / W24, W37 held). Items were:
1. Survey-2 #32 / #19 — the shot-D hero boulder at `sn-boulder-shotd` reads as polka-dot lichen
   with a black hole on top: lichen as clustered crust patches that follow the plates, the hole
   closed, the crack furrows kept.
2. Survey-2 #17 / #25 — the stair-foot shard skirt at `sn-boulder-stairfoot` is angular low-poly:
   more, smaller, smooth-shaded shards half-buried in the moss, each seated on `ctx.terrain.height`.
3. ref-04 (`art/environment/owner-review-2026-09-19/`) — the tall rock/root ledge right of the
   north path: damp dark stone, moss sheets, a wet foot. I own the material + face builder; the
   position comes from fable-cursor's expansion-1 lane (`layout.ts`) — coordinating in the INBOX.
4. Wet band, moss and lichen must read at player height (2–6 m), not only at touching distance.

## Files / systems being touched
- `src/world/rocks/index.ts` — near-kit skirt stones, lichen dressing parameters, ledge hook.
- `src/world/rocks/rockgen.ts`, `dressing.ts`, `material.ts` — crust patches, hole fix, near fade.
- `src/world/rocks/ledge.ts` (new) — the ref-04 ledge face builder + material variant.
- `src/world/rocks/rockgen.test.mjs` (+ new tests beside it).
Nothing outside `src/world/rocks/` except this log, the INBOX and my evidence under
`art/environment/fable-2-rocks/`.

## Completed work
(newest first)
- `20513c24` (`agent/fable-2-ledge`): the shot-D boulder's value at 2 m (opus #10). Probe method
  (kept in `/tmp`): at the pose, swap the near mesh's material for (a) a white lit rock without
  maps, (b) the real material writing `diffuseColor` / `vColor` to `gl_FragColor` after
  dithering, (c) the real material with the normal map / roughness / near path each disabled.
  (a) 0.47, ours 0.17, (c) all 0.17 → the value, not the shading. Fix in the near path (nearW):
  stone ×1.35 + warm, wet 0.7/0.72/0.78, grime 0.55, D near skin `cutDark` 0.12, shaded moss
  rim ×1.25. Six views Δ ≤ 0.0001, draws unchanged.
- `ccd9a22a` (`agent/fable-2-ledge`, off `3d50f6c8`): the north-terrace ledge. Root cause: the
  layout authors the line at the terrace LIP (ground 5.5–5.7 m; the clearing floor is 4.0 m and
  the step is a ~40° slope z −74 … −76), the builder read it as the foot and, with `height:
  1.62`, stood a wall on top of the lip facing the bank. `ledge.ts` now: a line point above a
  drop on the path side walks down the slope to the base (0.1 m steps, a 1.2 m flat crest
  tolerated, stops off the paving) — that is the foot, the point is the top's ground point and
  the step's rise is the height; the bank side is read 1–3 m out; the face climbs steeply over
  a slope (top edge at 30 % of the inset); the authored line is extended by the taper at both
  ends so the authored span stands at full height; stair / structure columns dropped; root ridges
  (`RockLedgeDef.roots`, default 0.7 per 3 m). Six views byte-identical; test added (14/14).
- PR #12 (`agent/fable-2-rocks`, merged `f092a094`):
- `73708d4` + follow-up: the stair-foot "shard skirt" root-caused by draw-range probes (rock
  body only / kit only / far geometry swapped in at `sn-boulder-stairfoot`): it is the rock's own
  moss blanket — the 12 cm `mossSide` swell switched on/off at every micro-relief ridge (the
  cap's `n.y` gate) and at every crack line, a stack of hard-edged slabs. Near builds evaluate
  the swell on a low-frequency normal without the crack term (`mossSwellSmooth`; far byte-
  identical; differential test: blanket cliff edges 1728 → 608). Near kits also adopt the
  embankment strata slabs within reach (collapsed far, rebuilt smaller / smooth-shaded /
  half-buried with companions).
- `033ccc3` the "black holes" root-caused by probes (unlit material → solid, so no gaps; rock
  body only → no holes; dressing only → black domes): the moss cushions' vertex colours were
  palette greens as linear values (≈ 0.05) multiplied into the moss path. Pale neutral vertex
  colour now; regression test.
- `a092203`, `3682d5f`, `c4aa274`: lichen crust field `aLichen` (colonies inside the plates,
  stopped at joints, painted by the near material; the flecks fade out over the same nearW);
  disc plates removed; plate colour joints narrowed (the "slate seams"); crown parting pit damped
  (`strataCrown`); near fade 2.5–6 → 4–6.3 m; collar no longer grimed black, glossier blue-grey
  wet band with a tide line; skirt stones as weathered cobbles + near-only half-buried shards on
  the heightfield; stair-foot near skin smooth-shaded (34°, quarter chips, half plate steps).
- `b6b310a`: `rocks/ledge.ts` — the ref-04 ledge face builder + `layout.rockLedges` hook +
  `?rockLedgePreview=1` dev preview on the north path's east bank; tests.
- `6a7676c`: onboarding (log, INBOX announcement, ledge hook proposal).

## Important decisions
- Acceptance per the onboarding block: a before/after pair at the exact survey pose; the six
  fixed views A–F within −0.003 SSIM each of take-0116; draws ≤ 700; deterministic PRNG only.
- The near-LOD kit is the surface the survey poses see (the live camera stands 2 m from the
  rocks); the six hero cameras render the far meshes (hero margin), so near-only changes are
  the safe place for relief, and material fade limits are bounded by camera D's 7.22 m to the
  shot-D boulder's centre (≥ 6.4 m to its lumps → fade ends at 6.3 m).
- Every new rockgen option defaults to the old behaviour and the far build is asserted
  byte-identical in the tests (`strataCrown`, `mossSwellSmooth`, `lichen`).
- Probe method that worked (kept in `/tmp`, not the repo): render the survey pose with the near
  mesh's material swapped for emissive magenta (gap vs shading), then `geometry.setDrawRange`
  to split the kit (rock body first, then cushions, fragments, skirt), then the far geometry on
  the near mesh. Two of my first three hypotheses were wrong; the probes were not.

## Known issues
- The north-terrace face runs x −4.2 … −0.5 (the authored line plus the west extension; the east
  extension lands on the `ledge` flight's stairs mask and is dropped). The terrace lip east of the
  flight (x 2.1 … 3.5) is still the terrain's mound — a second `rockLedges` entry there is the
  layout's call (asked in the INBOX). Ferns at the foot: vegetation-26's.
- Camera A renders 9.09 M triangles on the world head `3d50f6c8` (before this change; the loop's
  ceiling is 9.0 M) — not mine to fix, flagged to fable-cursor.
- Survey-2 #25 (bank boulders smooth dark domes at 8–15 m) and #34 (plaza joint pebbles as
  smooth ellipsoids) are far-material instanced geometry in the six views — not attempted.

## Recommended next work
- GOAL_MODE fable-2 #2: opus #10, the shot-D boulder's tonal read at 2 m (`sn-boulder-shotd`).
- #3: scree at the ledge flight's flanks, a boulder pair on the clearing's west bank, half-buried
  strata along the terrace face (positions: `art/environment/round47-review/README.md`).
- #4: `pathEdgePebble` per-candidate draws.

## Last updated
2026-09-20T03:45:00Z
