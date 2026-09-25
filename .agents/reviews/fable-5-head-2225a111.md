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
