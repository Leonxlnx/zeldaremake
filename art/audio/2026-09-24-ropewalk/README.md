# Lane 5 — the grove's rope walkway is a bridge, not a deck

Branch `agent/squad5-ropewalk`, off the head at `b9993008` (the merge that brought `exp-north` in).

`exp-north` landed the north grove and did its own footstep classification, which is the system
working: `onGrovePlanks` in `src/audio/index.ts` put `wood` under the stilt house's veranda, the
gangway, the tree hut's platform **and the rope walkway between them**. Its own scorecard gave
check 45, "footsteps play the right surface", **3 of 4** — which is the right score for that.

## Why the walkway is not a deck

This lane split `bridge` off from `wood` for the south exit, and wrote down the reason at the time:
*a deck on the ground and a deck over a ravine are not the same sound.* A `bridge` knocks hollow
with a deep body and the ropes and lashings answering, because a plank with nothing under it is not
a plank on a joist.

The reason holds here more strongly than it did there:

| | over | |
| --- | ---: | --- |
| the ravine's rope-and-plank bridge | ~8 m | already `bridge` |
| **the grove's walkway** | **11.6 m and 11.3 m** | was `wood` |

`EXPANSION_NORTH` puts the stilt house's floor at 11.6 m and the tree hut's at 11.3, with
`ropeWalk: { stub: 0.7, sag: 0.12, halfWidth: 0.42 }` between them. It sags. It is the same object,
higher up. `exp-south2` made the same call independently for its keeper's gallery — `bridge` where
the boards hang over the gorge, `wood` where the lip is still under them — so the distinction is
already the squad's, not just this lane's.

## What changed

`onGrovePlanks` returns the surface rather than a boolean. The decks and the gangway stay `wood`;
the walkway and its **stubs** — its first 0.7 m, cantilevered out past each rim — are `bridge`. The
deck discs are tested first, so a plank still over its own veranda stays wood. Measured along the
span between the two houses:

```
0.0–2.65 m   wood     (the stilt house's veranda: radius 1.55 + veranda 1.1)
3.2–5.9 m    bridge   (the stubs and the walkway)
then          wood     (the tree hut's platform)
```

Nothing else moves: the gangway halfway up reads `wood`, the lawn beside the grove `leaf`.

## The guard, and the file outside this lane

`src/audio/surfaces.test.mjs` — the list of every built standing place the layout names — covers
the grove now and fails by name if the walkway goes back to being a deck:

```
the rope walk at 40 % of its span at (13.92, -88.98) sounds like wood, should be bridge
```

**One file outside `src/audio/` changed:** `src/world/terrain/expansionNorth.test.mjs` asserted
`wood underfoot on the rope walk`. That assertion is about `surfaceAt`'s output, which is this
lane's, so it had to move with it — one entry out of the `wood` list, one `bridge` assertion added
with the reason, and the file's header comment updated to match. Nothing else in that file is
touched and no `src` behaviour outside `src/audio/` changes.

**For exp-north:** your README's check-45 row and its file table both say `onGrovePlanks` plays wood
on the rope walk. That is the line this changes, and check 45 should be a 4 now.

## Also fixed while here

`agent/squad5-level` (PR #63) stopped merging when the grove landed — `exp-north` added
`EXPANSION_NORTH` and `northGangway` to the layout import on the same line the master trim added
`MASTER_LEVEL` to the graph import. Both sides kept, verified green, pushed. The other three pending
lane-5 branches (`soak`, `clipspec`, `birdvoice`) still merge clean.

## Reproduce

```bash
node --test src/audio/surfaces.test.mjs
node --test src/world/terrain/expansionNorth.test.mjs
```

178 / 178 tests across the repo, typecheck clean, build green.
