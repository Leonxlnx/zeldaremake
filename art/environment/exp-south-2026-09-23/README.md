# Expansion south: the village exit (round 56, 2026-09-23)

The owner, 2026-09-23 20:08 UTC: *"why for the love of God has there been no expansion to the environment
past the stuff"*. This round extends the playable world south of the plaza: the flagstone path runs on
from the end of the south approach, between the south giants, to a misty ravine crossed by a walkable
rope-and-plank bridge, and ends at the glowing mouth of a hollow log on the far bank, the way out of
the forest.

Branch `agent/fable-cursor-exp-south`, built on the pinned checkpoint `746f1d39`. BEFORE images are that
checkpoint's build and AFTER images this branch's, from the same cameras at the same simulation time
(12.5 s, character hidden, 960×540, `quality=high`).

## What and where

World metres, +x east, +z south, y up, plaza at the origin (`src/world/layout.ts` `EXPANSION_SOUTH`).

| Part | Where | Notes |
| --- | --- | --- |
| South path | (1, 16) → (−1.3, 21.6) → (3.7, 29.9) | Out of the spine's end cap, south-west round `plaza-south`'s flared foot (4.4, 20.5), through the gap to `south-centre` (−4.5, 27), then south-east onto the bridge axis. 16.6 m long, 4.0 → 2.4 m wide, grade ≤ 0.07, ≥ 0.48 m off both giants' feet. The giants' buttress roots dive under the paving. |
| Ravine | (−27.2, 52.2) → (3.9, 37.1) → (30.3, 49.7) | A west–east gorge closing to nothing at both ends. At the crossing it is 11.4 m lip to lip and 9.2 m deep, with rounded lips, rock walls with moss draped from the lip (lip drape, hanging tongues, ledge cushions), ferns, roots and leafy vines down the walls, a talus apron, a 2.8 m floor of ferns, and pooled mist. |
| Bridge | north sill (3.72, 30.45) → south sill (4.08, 43.7) | 13.3 m deck on two floor ropes with 0.7 m of sag, ≥ 5.7 m over the floor at mid-span. Weathered planks 1.24 m wide, a few worn, broken short or missing. Half-buried sill logs, four raked bark posts carrying two laid hand ropes (0.98 m over the deck, stayed back to stakes, zig-zag cord to the floor ropes), and a pod lantern on an arm at every post's head. |
| Far paving and log | (4.08, 43.7) → the mouth at (4.25, 46.9) | A fallen giant's hollow trunk, heading south into a broad forested rise: 7.6 m of shell (outer radius 2.05 m, hollow 1.66 m), a splintered end-grain rim, moss cap, litter floor, and two pods at the mouth. The walk goes 5.6 m in, to a warm glow that closes the tube. The glow is emissive materials only; no light is added. |

New content lives in the separate `EXPANSION_SOUTH` export, not in `LAYOUT`'s lists, and the landform exists
only in the heightfield's live view, so no pre-existing placement stream re-rolls. The trees, vegetation,
rocks and props are culled off the path, bridge heads and log, and the rims are dressed.

## Sheets

- `01-spawn-and-C.jpg`: Link's spawn looking south, and hero camera C.
- `02-path-between-giants.jpg`: the spine's south end, round `plaza-south`'s foot, through the gap.
- `03-bridge-and-log.jpg`: the north rim, mid-span, the log's mouth.
- `04-ravine.jpg`: the gorge from the west rim and from the deck, plus (after only) the look back north from the far bank.

## How it was tested

- `npx tsc --noEmit`, `npx vite build`, and all tests: `node --test` on the 35 world test files
  (93/93, including `node --test src/world/trees/*.test.mjs src/world/structures/*.test.mjs` and the new
  `src/world/terrain/expansionSouth.test.mjs`), plus the monitor, ledger, perf-flag, audio and camera tests (30/30).
- Play mode walk: `node gauntlet/scripts/playtest.mjs --only walk --walk-routes south-bridge-to-log` on the
  final build. Route plaza → south path → bridge → 5 m into the log: **reached, 21/21 waypoints, 51.7 m,
  nothing stuck**. Camera max 8.9 m/s (the pre-reroute run hit 79 m/s in a 2.6 m snap against
  `plaza-south`'s trunk), feet on the ground (sole gap p95 2.1 cm). **Probes 41/41 pass:** the deck walks at 25/50/75 %
  of the span (9/9), **every probe 0.7, 1.0 and 2.5 m off either side of the deck is blocked (18/18)**, the rim
  beside the north head is walkable only at grade (2/2), the gorge beside both heads is blocked (6/6), the
  log's floor walks (3/3), and its walls and the glow past the dead end block (3/3).
- The same merge on top of the integration head `81430baf` is conflict-free, typechecks and passes 97/97 world tests.

## Numbers

Draw calls and triangles as the renderer reports them for one settled frame (`__ZR__.stats()`, colour and
shadow passes, `quality=high`), BEFORE = `746f1d39`, AFTER = this branch:

| Pose | Camera → target | Draws before → after | Triangles before → after (M) |
| --- | --- | --- | --- |
| spawn, looking south | (0.2, 1.75, −3.2) → (2, 1.1, 20) | 478 → 542 | 6.156 → 6.668 |
| rim, across the bridge | (2.6, 1.75, 26.8) → (5.3, 0.4, 44) | 244 → 318 | 2.840 → 3.007 |
| mid-span | (4.45, 1.0, 35.8) → (5.4, 0.9, 52) | 174 → 235 | 1.634 → 2.309 |
| deck, mid | (3.9, 0.85, 36.5) → (4.3, 0.2, 52) | 167 → 232 | 1.734 → 2.525 |
| log mouth | (5.1, 1.75, 44.2) → (5.6, 1.2, 56) | 136 → 222 | 1.291 → 3.034 |
| west rim | (−7, 3.2, 35.5) → (4.5, −1.2, 39) | 373 → 462 | 3.983 → 4.608 |
| down the gorge | (4.3, 1.0, 37) → (−20, −3, 40) | 345 → 409 | 3.602 → 3.666 |
| spine's south end | (0.9, 1.7, 11.5) → (−1.4, 0.5, 22) | 382 → 471 | 4.577 → 5.087 |
| round `plaza-south`'s foot | (−1.0, 1.6, 18.0) → (0.4, 0.4, 26.5) | 335 → 426 | 4.117 → 4.666 |
| through the gap | (−1.2, 1.6, 22.2) → (3.8, 0.3, 31.5) | 317 → 408 | 3.853 → 4.242 |
| far bank, looking back north | (4.8, 2.6, 43.6) → (2, 0.8, 24) | (new ground) → 699 | (new ground) → 8.806 |

The south content costs about 93 draws when all of it is in view (48 vegetation batches, 21 + 14 structure draws in
the colour and shadow passes, 2 paving, 2 mist); the six pods stay separate draws because each one's pivot swings,
as every village pod does. The look back from the far bank is the heaviest new view because it frames the whole
village beyond the gorge.

HERO_TABLE

INTEGRATION_TABLE
