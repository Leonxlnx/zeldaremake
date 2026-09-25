# fable-5 — the head `31146062` → `2225a111` (the grove at 22:20, the post-recording round at 23:45: #54 roofhole, #61 tread-tone, lodcheck, #65 understory LOD, lane 5's audio; 88 commits) — six views, walk, the look-back bill — 2026-09-25 00:04–00:32 UTC

`2f6c8ae2` (00:17, `squad5-indoors`) differs from `2225a111` in `src/audio/` only; these numbers stand for it.

## The six views — inside the budget, the sum of the reads

| view | SSIM `31146062` ↔ `2225a111` | pixels changed | vs reference | Δ | of which the 23:45 round |
| --- | --- | --- | --- | --- | --- |
| A_stairs | 0.9976 | 0.86 % | 0.1730 → 0.1732 | +0.0002 | 0.9979 (the tread tone's risers, the roof's band) |
| B_house | 0.9949 | 1.14 % | 0.1693 → 0.1689 | −0.0004 | 0.9952 (the roof's top band) |
| C_lookback | 0.9974 | 0.72 % | 0.1776 → 0.1793 | **+0.0017** | 0.9974 (the roof's south bands) |
| D_log | 0.9857 | 2.77 % | 0.2336 → 0.2334 | −0.0002 | 0.9858 (lodcheck's tier switch + the band) |
| E_ground | 0.9949 | 1.14 % | 0.1902 → 0.1899 | −0.0004 | 0.9952 |
| F_canopy | 0.9993 | 0.35 % | 0.2030 → 0.2029 | 0 | 0.9993 |

Each pre-merge read's numbers add up to the head's: the grove alone was 0.9997 … 1.0000; the round carries the rest. Every Δ
inside −0.003; C moves toward the reference.

## The walk — 96 / 96, three of the village's four pops gone, the swing up everywhere

Eleven routes (the grove's now among them), the same full run as on `31146062` (`walk-head-2225a111.json`):

| route | pops > 0.3 m, `31146062` → now | turn acceleration p95, `31146062` → now |
| --- | --- | --- |
| plaza-to-upper-house | 0.41 / 0.32 → **none** | 506 → 899 °/s² |
| north-clearing-ledge | 0.42 → **none** | 476 → 901 |
| west-house-to-plaza | 1.28 / 0.66 → **0.51** | 556 → 924 |
| saria-front-arc, west-deck, plaza-loop, south-approach, house-west-to-saria-door, south-bridge-to-log | none → none | 440–556 → 873–923 |
| plaza-to-south-bank-top | none → none | 439 → 295 |
| north-grove | 0.36 (the trunk house's door) | 909 |

The grove's camera (`d7432cc9`) is the head's: the village's pops are one 0.51 m step now, and **the camera's turn acceleration p95
is 1.6–2.0× on nine of ten village routes** — the swing the branch called "one cost of the easing", now under every walk. The
owner recorded his video on `b9993008`, the first head with it; his hand is the measure. 0 stuck, probes 41 / 41 and 64 / 64,
no page errors.

A harness note: the full run reports Saria's arc with a boot 77 cm over and 94 cm inside the ground at one frame (p95 6 cm);
run alone the arc reads 9 cm on both heads. The earlier routes' frame counts changed (their pops are gone), so the arc's placed
start lands at a gait phase the feet have not settled from — the route-order dependence noted at 19:03. A few settle frames
after `place()` before sampling feet would close it (fable-cursor's `playtest.mjs`).

## The look-back bill on this head (`lookback-isolate-2225a111.json`)

| pose | `31146062` isolate sum | `2225a111` | what moved |
| --- | --- | --- | --- |
| the far bank | 832 / 10.18 M | 832 / 10.18 M | nothing — the trees beyond both rungs |
| the east green | 789 / 9.80 M | 786 / **9.87 M** | trees 252 → 249 / 3.62 → 3.70 M (lodcheck's gate) |
| the east lookout | 758 / 9.89 M | 755 / 9.90 M | trees −3 |
| the ruins' trail | 776 / 10.41 M | 778 / **10.63 M** | trees 238 → 240 / 4.16 → **4.38 M** |
| the grove's yard (new) | — | 696 / 9.57 M | structures 180 / 2.85 M, trees 165 / 2.36 M, vegetation 126 / 2.72 M, character 109 |

The rows are as the branch reads predicted: lodcheck's 45 m gate puts +0.07–0.22 M on three look-backs and nothing off the far
bank; the roof's clumps add nothing measurable. Rows 2 (a far tier for crowns beyond ≈ 35 m), 4 (vegetation, one pack per LOD)
and 1 (the kids' 66 colour draws) are still the bill; `exp-south2`'s structures work (171 → 84 at the far bank) is not on the
head yet — its camera hunks are.

## → `7468bb38` (02:15 round: #74 `wbmed`, #75 `cliff-scale`, #77; 02:55 round: #82 fable-3's far-kid cut + belts + cuffs + the grove girl, #81 fable-4's inert stand rule retired, #79 / #83 / #84) — 03:27–03:52 UTC

- **Six views** against `2225a111`: A / B / D / E / F 1.0000 / 0.00 %, C 1.0000 / 0.02 % (#74's white-bark crown at range); vs the
  reference unchanged to the fourth decimal. Every branch in both rounds had its pair before it merged (02:00, 02:57).
- **The walk**: 96 / 96, 0 stuck, probes 41 / 41 and 64 / 64, no page errors; every route's camera pops and turn-acceleration
  p95 identical to `2225a111`'s — the kids' cull and the grove girl touch no camera.
- **The look-back bill on this head** (`lookback-isolate-7468bb38.json`): the character row **66 / 56 / 56 / 56 / 85** (was 127 /
  110 / 110 / 110 / 109) — row 1 paid on the head; the trees row +0.03–0.09 M (#74's medium crowns: the far bank 3.63 M, the
  ruins' trail 4.47 M). The frames: **the far bank 774 / 10.06 M, the east green 736 / 9.80 M, the east lookout 700 / 9.82 M
  (at the draw cap), the grove's yard 676 / 9.57 M.** What is left over 700 / 9.0 M is trees (240–256 draws / 3.6–4.5 M),
  vegetation (96–148 / 1.6–2.7 M) and, at the far bank, the structures row that `exp-south2` has already cut on its branch.

## The camera's swing, characterised (05:36–05:44 UTC; `fable-5-lane10/turn.mjs`, `turn-31146062.json`, `turn-7468bb38.json`)

The harness's turn-acceleration p95 rose 1.6–2.0× on nine village routes when the grove's camera merged; this is the shape of
that number. Four curving walks of 8 s (W + A or W + D held from a placed pose, the same on both heads), the camera's yaw taken
from Link − camera each frame:

| walk | steady yaw rate p50, old → new | max °/s | onset acceleration max °/s² | acceleration p95 | max camera step |
| --- | --- | --- | --- | --- | --- |
| the plaza, arc left | 63.3 → **67.5** | 66.8 → **83.0** | 626 → **1041** | 28 → 27 | 0.47 → 0.24 m |
| the plaza, arc right | 63.4 → 67.5 | 66.8 → 83.0 | 626 → 1041 | 28 → 32 | 0.24 → 0.28 |
| the west lawn, arc | 63.4 → 67.5 | 66.8 → 83.0 | 626 → 1041 | 26 → 32 | 0.15 → 0.19 |
| **the grove's yard, arc past the trunk house** | 63.4 → 67.5 | 66.6 → **177.8** | 613 → 1051 | **22 → 518** | 0.14 → 0.26 |

- **In the open the camera is not nervous.** The steady turning speed is 7 % faster (63 → 68 °/s), the swing's *onset* is 1.7×
  sharper (the first frames of every turn: 626 → 1041 °/s², 67 → 83 °/s) and it then settles; the acceleration p95 over the
  arc is unchanged (≈ 30). A route's p95 is made of its waypoint turns' onsets, which is why the harness reads 1.6–2.0× while the
  steady state barely moved — and the camera's largest single step in a turn is smaller (0.47 → 0.24 m on the plaza).
- **Beside an exact wall it holds and releases.** In the grove's yard the `RING_IN` steering lets the orbit pause while Link
  walks along the trunk house's ring (the rate near 0 for ≈ 1 s) and then catches up at 178 °/s — the p95 acceleration 22 →
  518 °/s². That is the hut-camera fix doing its job and it is the one place the swing is felt; the same behaviour arrives at
  the keeper's hut and the water stair when their branches merge.
- Straight walks (W alone) swing nothing on either head (yaw rate 0); the camera's single-frame steps there are down too
  (the west house 0.66 → 0.39 m, the plaza 0.42 → 0.28 m).

For the owner's hand at the controller: the turn starts quicker and the camera sits closer to Link's heading through it; next
to a hut it waits and catches up. If the onset is the part that reads as haste, `WALL_SWING`-style easing on the orbit's first
frames (a τ of a few hundredths) is the knob, in `src/camera/follow.ts`.

## → `1a183570` (06:10 round: #93 the boy's look, notes) — 06:25–07:00 UTC

Six views pixel-identical to `7468bb38` (1.0000 / 0.00 % at all six): the boy at A's right edge reads as before; vs the reference
unchanged to the fourth decimal. `d367cfbf` (05:25) was notes only.

## → `24dc489f` (07:10 round: the sitter's gaze, lane 5's gait / loop / ambience) — 07:28–07:57 UTC

Six views pixel-identical to `1a183570` (1.0000 / 0.00 % at all six): the seated kid's gaze does not move A.
