# The ceiling breach is high-tier only, and the quality tiers barely touch draws

Every budget number this lane has published is at `quality=high`, which is the harness default. Nobody had
measured what a player on a weaker tier actually gets, so this does — and it bounds the one breach left in
the release.

`playtest.mjs --only perf --quality <tier>`, head `2b15f687`, 960 × 540:

| play spot | high | medium | low |
| --- | --- | --- | --- |
| plaza | 539 / 7.69 M | 514 / 6.26 M | 474 / 5.61 M |
| **stairs2-base** | 557 / **9.24 M — over** | 544 / **7.23 M** | 514 / 5.94 M |
| saria-side | 520 / 8.60 M | 499 / 7.18 M | 471 / 6.13 M |
| west-house | 430 / 5.09 M | 411 / 3.53 M | 382 / 3.05 M |

(`qualityFor` in `world/index.ts`: low `density 0.35 / distance 0.6`, medium `0.65 / 0.8`, high `1 / 1`.)

## Two things it says

* **The breach is high-tier only.** The main flight's foot is 2.7 % over at high and **1.77 M under** at
  medium (7.23 M, a 22 % drop). A player on medium or low is inside the ceiling at every spot measured.
  That does not retire the vegetation decision in `../vegmenu/` — the owner's machine may well run high —
  but it bounds it: the fix protects the top tier, not the game.
* **The tiers barely move draws**: 557 → 544 → 514 at the flight foot, a 7.7 % spread against a 36 %
  spread in triangles. `density` and `distance` scale how much geometry each system builds and how far it
  reaches, not how many meshes it submits, so **if draws ever become the binding constraint, dropping the
  tier will not save it** — the plateau look-back, seven draws over at high
  (`../lookbacks/RECHECK.md`), would still be within a few draws of the ceiling at low.

## For the release

The safest reading: high tier has one play spot 2.7 % over on triangles and one climbing view 7 draws over;
medium and low are clear on triangles and equally close on draws. The levers are priced in `../vegmenu/`
(vegetation, ≈ 4 % of its LOD scale) and, for draws, in `../lookbacks/RECHECK.md` (the character system
spends 95 draws for 2 % of that frame's triangles).
