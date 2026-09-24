# fable-5 — pre-merge check: `exp-north` `571acd21` × `exp-south2` `066144ad` conflict in the camera's core — 2026-09-24 16:37–16:40 UTC

A scratch merge in a detached worktree (`git merge origin/agent/fable-cursor-exp-south2` onto `571acd21`, both branched from
the head `3c6cc553`; aborted afterwards, nothing pushed). **Nine files conflict**, and four of them are the play camera and
its walls:

| file | hunks | ours (north) / theirs (south2) lines | what collides |
| --- | --- | --- | --- |
| `src/camera/follow.ts` | 2 | 74 / 4 | the `following` block: the grove's **`ringGoal` / `RING_IN`** (the orbit trails Link along a hut's ring, `RING_IN` 0.9 m, `RING_FADE` 0.6, `RING_OUT` 0.5) against the south's **`wallSwing` / `WALL_SWING_TAU`** (the placed yaw turns off an exact wall) — plus `following = …` vs `const following = …` |
| `src/camera/collision.ts` | 1 | 6 / 4 | the header comment only — but it names the two representations: "round walls given exactly (the grove's huts) … CAMERA_RADIUS as their grown shell" vs "the exact walls published beside them (`shared.cameraCylinders`)" |
| `src/world/structures/cameraSolids.ts` | 6 | 19 / 59 | the north's `walls: CameraWall[]`, `collect(roots, exact: Set<string>)` keyed `distant-house-bark:<id>`, `voxelise(solid, [], true)`, `report.walls` — against the south's `interface Shell`, `cameraShell.exact`, `collect(roots) → { solid, slim, exact }`, `report.exactParts`; and the `SOLID` / `SLIM` regexes (the south adds `pod-lantern-static`, the keeper's parts) |
| `src/world/system.ts` | 1 | 1 / 7 | `cameraSolids.walls?: CameraWall[]` vs `cameraCylinders?: { x, z, r, y0, y1 }[]` — **two types for the same thing, an exact vertical cylinder the camera sweeps** |
| `src/world/structures/index.ts` | 5 | 12 / 7 | imports, the grove's audit vs the dwellings' audit, and `south.visible(camera)` (north) vs `southShown(camera)` (south2) — one function under two names, in three places |
| `src/world/structures/distantHouse.ts` | 4 | 36 / 43 | both extend the hut builder (the grove's ring huts; the keeper's exact shell) |
| `src/world/layout.ts` | 1 | 134 / 69 | both append their expansion's layout at the file's end |
| `src/audio/index.ts` | 1 | 1 / 1 | both add a wood surface (the grove's decks; the keeper's gallery) on the same line |
| `gauntlet/scripts/playtest.mjs` | 3 | 85 / 35 | both add routes and probes at the same anchors |

Everything else auto-merges (`heightfield.ts`, the vegetation expansion, the READMEs).

## Why it matters more than a merge chore

The two branches **fix the identical defect twice**. The north's comment: *"straight behind him, the swing's lag put the
camera on the inside of the curve, its line grazing the wall — pulled in to MIN_DISTANCE in a frame (a 1.5–3.9 m pop)"*
(`follow.ts` `RING_IN`). The south's: *"walking round the keeper's hut (1.4–1.7 m from its axis) the trailing camera …
3.87 m in one frame"* (`collision.ts` `wallSwing`). Each works on its own branch — my reads: the grove's route 3.89 → 0.36 m
(`e156566f`), the gallery's 3.863 m → none over 0.32 m (`066144ad`) — and each publishes its huts as exact cylinders in a
type the other camera does not read. Merged naively, whichever mechanism is kept sees only its own walls: the grove's huts
would pop again under `wallSwing` alone (they are `CameraWall`s, not `cameraCylinders`), or the keeper's hut under
`ringGoal` alone.

## The shape of the resolution (the author's call, not mine)

- one exact-wall type in `system.ts` (`CameraWall` and `{ x, z, r, y0, y1 }` carry the same numbers), published by both
  `expansionNorth` and `expansionSouthDwellings`, read by both `collision.ts` sweeps;
- one `following` block: `ringGoal` steers the goal yaw along the ring while Link moves along it; `wallSwing` turns the
  placed yaw off the wall when the line turns in — they can stack (ring first, swing as the guard), but the guard must
  see the ring's walls;
- `south.visible` / `southShown`: one name;
- then the three routes on the merged build — `north-grove` (turn accel p95 already 909 °/s²), `south-dwellings`, and the
  standing back-to-wall poses on the veranda and the gallery (both still pull to 0.6 m on their own branches).

Whichever branch merges first, the second inherits all of this; the camera hunks are the ones to decide before either
does. I run the three routes and the poses on the merged build when it exists.
