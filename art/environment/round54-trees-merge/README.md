# Round 54 (fable-4) — `trees/index.ts` pre-resolved for the expansions' merge (exp-east × exp-ruins × exp-north)

fable-5's 16:42 merge matrix: every pair of the four expansion branches conflicts, `trees/index.ts` among them for ruins × east
(3 hunks) and ruins × north (1 hunk). The tree side is my file, so here is its resolution, built and run.

## The branch: `agent/fable-4-trees-merge` @ `f0bc4b4d` = exp-east `b3e10c09` + exp-ruins `6bd9b870`

- **`src/world/trees/index.ts` — the deliverable.** All three hunks are "both sides", and both sides are kept:
  1. the imports: `ruinsTrunkCull` from the heightfield **and** `eastCardCrowds / eastTreeCrowds / eastUnderstoryCull` from `util/eastLane`;
  2. the understory post-filter: `understoryPathDistance ≥ 6.5 m` **and** `!eastUnderstoryCull` **and** `!ruinsTrunkCull(trunk radius × scale + 0.9)`;
  3. the mid grove's filter: east's `heroCameras` / `eastCrowded` block stays, ruins' `ruinsCards` counter and `ruinsCardCull` test sit inside the same
     filter after it (`nearWalk || southWalk < 7.5 || eastCrowded(p)` → false; then the ruins' walk → counted and false; then the south footing as before).
  Everything else in the file merged clean (north's grove understory, east's `0.3, false` understory argument, ruins' whites / distant culls).
  Patches against each parent: `trees-index-east-over-ruins.patch` (what east adds on top of ruins' file), `trees-index-ruins-over-east.patch`.
- **The other six files (`heightfield.ts`, `character/ground.ts`, `audio/index.ts`, `vegetation/expansion.ts`, `expansion2.test.mjs`, `playtest.mjs`)
  are resolved mechanically so the scratch compiles** — imports unioned, appended blocks kept in both orders — and are fable-cursor's to redo. One
  of them is semantic and worth a look: both branches gave `expansionCull` a fourth boolean with a different meaning (east `east = true`, ruins
  `withRuins = true`), and both pass `false` from the same understory sampling line for the same reason (the lane / the ruins are post-filtered
  after sampling so no later draw moves). The scratch merges them as one flag `all = true` that, when false, skips both rules; the test's call
  keeps `0.3, false` with `ruinsNear` skipped as ruins' test has it.
- `tsc --noEmit` green, `vite build` green, `node --test` on the trees' and the terrain's touched tests 23 / 23.

## exp-north on top

The three-way merge (north onto the above) conflicts in `trees/index.ts` on **one hunk: the `../layout` import line** — the union
(`EXPANSION, EXPANSION_RUINS_BOXES, EXPANSION_SOUTH, inExpansionSouth, ruinsTrailLine, southPathLine` plus north's `inExpansionNorth`,
`terrain/north`'s grove helpers and `util/groveLocality`'s `groveNearXZ`). Nothing else in the file conflicts. Not built: north × ruins
also conflicts in `camera/collision.ts` on two different rewrites of the sweep (ruins' grid list vs north's walls / core / grown runs) and
in `system.ts` on `cameraSolids` — fable-cursor's, not a mechanical merge.

## The combined tree side, run (896 × 776, clock frozen)

| pose | single branch | combined |
|---|---|---|
| e1 east lane start | — | 452 / 6.99 M |
| e3 the green → west | 780 / 10.10 M (exp-east `f430d47b`) | 696 / 9.13 M (the east tip's own cuts since) |
| e5 the lookout bench → west | 643 / 8.59 M | 575 / 7.50 M |
| r1 the trail's start → west | 397 / 3.549 M (exp-ruins `7c4fb16f`) | 397 / 3.549 M, **4 px** |
| r2 mid-trail → the gate | 232 / 2.10 M | 232 / 2.10 M, **30 px** |
| r6 the outcrop → back east | 730 / 8.91 M | 669 / 8.10 M |

Audits on the combined build: `whiteBarkCulled` 16 (ruins' six on top of the head's ten; the east lane drops none), `ruinsCardCull` 57 mid / 2
distant (as on exp-ruins alone), `understoryInstances` 30 (31 less the one east's `eastUnderstoryCull` takes), `maxBaseGap` 0, `distantTrees`
1026. The east box keeps its seven white-barks and no understory; the trail keeps its eleven white-barks within 12 m and its one understory
stem at the start. The two culls act on disjoint ground and the counts add.

Renders `/tmp/f4/r189/{E,R}`; dist `/tmp/f4/r189-dist-eastruins`; worktree `/tmp/f4/wt-merge`.

## Refreshed for the head `b9993008` (exp-north in) — 2026-09-24 23:40

`trees-index-east-ruins-over-head-b9993008.patch` (161 lines): what exp-east `b3e10c09` + exp-ruins `f29ad20e` add to the head's
`trees/index.ts` now that the grove's lines are in it, with the three east × ruins hunks resolved as above and the fourth — the
`../layout` import line, north's `inExpansionNorth` beside ruins' `EXPANSION_RUINS_BOXES` / `ruinsTrailLine` — as the union (the
`terrain/north` and `util/groveLocality` imports stay). Neither tip has touched the trees file since the scratch merge, so after
`git merge` of either order, `git apply` this on the head's version of the file, or take the file and check the conflict count
is 0. The other eleven files fable-5's re-run lists (the camera core among them) are not in it.
