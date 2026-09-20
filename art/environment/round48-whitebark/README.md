# Round 48 — fable-4 goal-mode iterations (white-bark trees)

Branch `agent/fable-4-r48` off the world head `3d50f6c` (take-0118's world + round 47). Every sheet
is BEFORE (`3d50f6c`) | AFTER at an identical pose, rendered with
`broll.mjs --size 1280x720 --fps 12 --test --settle 12`; the walk poses (`x-*`) are opus-review's
(`.agents/reviews/opus-review-walk/manifest.json`, eye 1.45 / aim 1.3 m over the terrain, resolved
in node from the same heightfield). Rule (round 46): an after that looks like its before is a
FAIL, not a claim.

## Iteration 1 — young white-barks on the north clearing's banks (`a0f55cd` + hook `f9b6c32`)

GOAL_MODE fable-4 #1 / round-47 handoff "trees: young white-barks on the clearing's banks".
`CLEARING_WHITE_BARKS` at (−7.6, −66.0), (6.2, −71.5), (−6.0, −75.5) west of the ledge, and
(8.0, −64.8) (expansion-1's (7.5, −64.5) moved 0.6 m off the paving so no toe crosses the slabs);
seated on `terrain.height`, young variants cycled, toes from the seated-root mesh.

| pose | verdict | what changed |
| --- | --- | --- |
| `x-arch-approach` (ref-03's view through the arch) | PASS (modest) | two young stems with small crowns stand in the far clearing between the grey far-forest cones — the first real trees in the "deep world"; 2.5 % of the frame |
| `x-northpath-n` | PASS | the west-bank stem with its crown and shadow beyond the stone circle; 11 % of the frame |
| `x-clearing-stones`, `x-clearing-back` | PASS | the east-bank stem rises behind the stones and throws its shadow across the paving; the west stem at the frame's left |
| `f4-clearing-ledge-tree` (3 m) | PASS | a slender young birch on the bank west of the ledge flight, flared foot into the slope, lenticels, shadow across the ground |
| `f4-clearing-east-tree` | PASS | the east stem from the path, 1.6 m off the flagstone edge |
| `x-clearing-n`, `x-ledge-foot` | unchanged (0.3 % / 0.0 %) | both look north past the west stem; nothing of this iteration is in frame — noted, not claimed |

Probed against the terrain before placing: all four on vegetation-allowed bank ground, no
path/structure mask, tilt 2–14°; the nearest authored column seat is 30 m away; the distant
placement does not read white-bark positions; `seatBlocked` keeps any new column seat 2.5 m clear
of them (they are appended to `whitePlacements` before the columns are seated). The eye-level
sight line from the clearing toward (−8, −88) passes 2.3 m from the west trunk and under its crown.

Six fixed views (settle 6, `3d50f6c` → `f9b6c32`): A 0.2199 → 0.2199, B 0.2045 → 0.2044,
C 0.2397 → 0.2397, D 0.2783 → 0.2784, E 0.2145 → 0.2147, F 0.2606 → 0.2606; draws 568/526/393/394/
526/511 → +0/+1/0/0/+1/0; triangles +0.017 M on A/B/D/E, +0.006 M on C/F (the four low-LOD
instances and their toes; the clearing lies inside A's frustum behind the arch). W12 163/163
seated (maxGap 0), whiteBarkInstances 78 → 82, leafCount 288,607 → 291,551, columns 10 and
distant 729 unchanged, determinism 0, console clean.

**Camera A budget, reported:** the head `3d50f6c` already submits 9.086 M triangles at A (over the
loop's 9.0 M line before this branch); this iteration adds 0.017 M. Commit `e3f50cd` gives it
back inside the lane — the seated-root mesh skips saplings (their 2–5 cm toes lie under the grass)
and builds young stems' toes with 8 sections — see iteration 2's capture for the net.

## Iteration 2 — the trunk read at 5–20 m (`e3f50cd`, `9ee2c7c`)

GOAL_MODE fable-4 #3 (the owner's "detail at longer range"). Vertex colours and the tile only —
geometry identical on 10/10 variants, placements unchanged. Per variant, from their own fork: one
or two broad near-black bands (0.25–0.45 m) and one to three chevron branch scars (0.25–0.45 m,
widest at the top, tapering to a point below, at 1.2–4.5 m); the tile's tonal zones ± 6 %.

_(verdicts and numbers follow in this file when the capture lands)_
