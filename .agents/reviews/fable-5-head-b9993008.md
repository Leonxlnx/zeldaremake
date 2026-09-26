# fable-5 — the head `31146062` → `b9993008` (the north grove merged, 40 commits) — the six views, the play camera, the grove's poses as head items — 2026-09-24 22:27–22:55 UTC

## The six views — the grove is out of them

| view | SSIM old ↔ new | pixels changed | vs reference | Δ |
| --- | --- | --- | --- | --- |
| A_stairs | 0.9997 | 0.02 % | 0.1730 → 0.1731 | 0 |
| B_house | 0.9997 | 0.01 % | 0.1693 → 0.1694 | +0.0001 |
| C_lookback | 1.0000 | 0.00 % | 0.1776 → 0.1776 | 0 |
| D_log | 0.9998 | 0.02 % | 0.2336 → 0.2334 | −0.0002 |
| E_ground | 0.9997 | 0.02 % | 0.1902 → 0.1902 | 0 |
| F_canopy | 1.0000 | 0.00 % | 0.2030 → 0.2030 | 0 |

## The play camera changed for the whole village

`d7432cc9` (the huts' walls as exact round solids and a follow camera that does not pop round them) is the head's camera now,
and the harness reads it on the village's own routes (`walk-head-b9993008.json` against `walk-head-31146062.json`):

| route | camera pops > 0.3 m, old → new | turn acceleration p95, old → new |
| --- | --- | --- |
| `west-house-to-plaza` | **1.28 / 0.66 m → 0.51 m** | 556 → **924 °/s²** |
| `south-bridge-to-log` | none → none | 540 → **893 °/s²** |
| `north-grove` (new on the head) | 0.36 m at the trunk house's door | 909 °/s² |

The village's worst pull-in (lane 10 §8's west house) is better by 0.8 m; the price is the swing — the camera's turn
acceleration p95 rises 1.6–1.7× on routes that never touch a hut. That is the "cost of the easing" flagged on the branch at
10:50, now everywhere the player walks; whether it reads as liveliness or as a nervous camera is the owner's call at the
controller, and worth a sentence in the squad log. 28 / 28, 64 / 64 on the grove's route; 5 / 5 and 21 / 21 on the two
village routes; south probes 41 / 41; no page errors.

## The grove's open items are head items now

- **The camera at the huts' doors** — Link at the tree hut's door (15.7, 11.3, −86.6) or the stilt house's (10.37, 11.61, −92.39)
  with his back to it: the camera stops 0.6 m behind him, 0.27–0.29 m inside the wall's radius, the room's tan floor plane across
  the lower frame; the veranda with his back to the wall: 0.6 m, Link out of frame, Navi at the lens. Unchanged from `571acd21`
  (`fable-5-rubric50-exp-north.md` §571acd21).
- **The yard's look-back down the trail** — Link at (2, −100) facing yaw 10°: **713 draws / 9.39 M on the head** (the pebble gate's
  −15 on the branch's 728). By system: structures 180 / 2.85 M (the hamlet), trees 169 / 2.18 M, vegetation 126 / 2.72 M, character
  109 / 0.21 M (`lookback-isolate-b9993008.json`). The far bank on this head: 810 isolate-sum / 9.90 M (trees 256 → 234 with the merge).
- **Eight programs compile on first sight of the grove** — 112 at the doors → 118 at the veranda → 120 at the look-back; the first
  frame at the grove took **15.9 s** to render here (SwiftShader; a GPU's fraction of that is still the hitch the player gets walking
  in). The grove's materials are outside the warm-up.

## The merge map, now head × branch

`exp-south2` (9 files, the camera core), `exp-ruins` (8, `collision.ts` × 3) and `exp-east` (8, structures and hardscape) all
conflict with `b9993008` — `fable-5-lane10-merge-north-south2.md` §22:28. The camera decision is due at the next merge.
