# The head's cost, completed: every fixed view cheaper, and the last breach needs 0.22 M from vegetation

> **fable-cursor: this file is the PR description for `cursor/squad2-perfhealth-682b`.** The pull-request
> call is still refused with `Validation Failed … "must be a collaborator"` (eighth attempt since 08:20),
> so please open the PR from the branch (base `cursor/kokiri-world-phase1-f65e`) or merge it directly.
> Evidence only, no source change. The queue is `HANDOFF.md` on `cursor/squad2-handoff-682b`; with this
> branch it is ten.

The third part of the health check on head `2b15f687` (look in `ROUND2.md`, walk in `WALK-HEALTH.md`).
Everything got cheaper overnight, and the one remaining ceiling breach now has a price on it.

## The six fixed views: all inside W38, and 0.25–0.37 M cheaper than yesterday

| view | now | at 19:30 yesterday | delta |
| --- | --- | --- | --- |
| A_stairs | **575 / 8.64 M** | 614 / 8.97 M | −39 draws / −0.33 M |
| B_house | 557 / 7.95 M | 596 / 8.29 M | −39 / −0.34 M |
| C_lookback | 494 / 7.73 M | 533 / 7.96 M | −39 / −0.23 M |
| D_log | 484 / 8.37 M | 523 / 8.74 M | −39 / −0.37 M |
| E_ground | 557 / 7.95 M | 596 / 8.29 M | −39 / −0.34 M |
| F_canopy | 516 / 7.84 M | 555 / 8.10 M | −39 / −0.26 M |

A is still the binding view and now has **360 K of triangle headroom** — the figure my notes carried as
30 K all yesterday, which is why `../reviews/pr193-keepinstanced.md` corrected it.

## Play mode: better everywhere, still over at the flight's foot

| play spot | now | at 19:30 | delta |
| --- | --- | --- | --- |
| plaza | 539 / 7.69 M | 578 / 7.99 M | −39 / −0.30 M |
| **stairs2-base** | **557 / 9.24 M** | 585 / 9.59 M | −28 / −0.35 M |
| saria-side | 520 / 8.60 M | 559 / 8.94 M | −39 / −0.34 M |
| west-house | 430 / 5.09 M | 463 / 5.56 M | −33 / −0.47 M |

The main flight's foot is **2.7 % over the 9.0 M line**, down from 6.5 % yesterday. It needs **0.22 M**.

## Where that 0.22 M has to come from

`playcost.mjs` at the follow rig's rest pose there (547 draws / 9.22 M), against the same measurement at
07:22 yesterday:

| system | now | then | delta |
| --- | --- | --- | --- |
| **vegetation** | **3.471 M** (121 draws) | 3.471 M | **0.000 M** |
| trees | 2.451 M (147 draws) | 2.765 M | **−0.314 M** |
| structures | 1.879 M (102) | 1.879 M | 0.000 M |
| terrain | 0.599 M (32) | 0.599 M | 0.000 M |
| hardscape | 0.341 M (14) | 0.341 M | 0.000 M |
| rocks | 0.279 M (27) | 0.326 M | −0.047 M |
| character | 0.132 M (71) | 0.129 M | +0.003 M |
| props | 0.098 M (15) | 0.098 M | 0.000 M |

So the whole 0.35 M of play-mode improvement came from **trees** (−0.314 M, fable-4's work in this lane's
files) plus a little from rocks. **Vegetation has not moved at all in seven hours**, and at 3.471 M it is
37.6 % of that frame — a 7 % trim of it alone would put the pose under the ceiling. Everything I could
find in lane 2 is already spent (`../midspend/`, `../farring/`, `../shadowcost/DEPTH-SPLIT.md`).

## Head `2b15f687` in one line

0 page errors; 10 look spots with a uniform 60.16° / −35.52° envelope; 11 walk routes, nothing stuck, the
new 1.2 m/s walk measuring 1.16–1.28 m/s; six fixed views inside W38 with 360 K of headroom at A; one
play spot 2.7 % over on triangles with the 0.22 M priced to vegetation.
