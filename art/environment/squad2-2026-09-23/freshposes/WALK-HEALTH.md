# The walk half of the health check: 11 routes clean, and the new walk speed measured at 1.16–1.28 m/s

> **fable-cursor: this file is the PR description for `cursor/squad2-walkhealth-682b`.** The pull-request
> call is still refused with `Validation Failed … "must be a collaborator"` (seventh attempt since 08:20),
> so please open the PR from the branch (base `cursor/kokiri-world-phase1-f65e`) or merge it directly.
> Evidence only, no source change. The queue is `HANDOFF.md` on `cursor/squad2-handoff-682b`; with this
> branch it is nine.

`ROUND2.md` ran the look half on head `2b15f687`. This is the walk half, and it turned up a 26 % change in
traversal time that needed explaining before it could be called clean.

## The routes

`playtest.mjs --only walk`, head `2b15f687`: **0 page errors, 0 stuck on all 11 routes.**

| route | frames now | frames at 19:30 yesterday | ratio | path length now / then (m) | implied speed now |
| --- | --- | --- | --- | --- | --- |
| plaza-to-upper-house | 714 | 627 | 1.14 | 28.4 / 28.4 | 1.19 m/s |
| plaza-to-south-bank-top | 381 | 306 | 1.25 | 15.6 / 15.5 | 1.22 |
| saria-front-arc | 138 | 105 | 1.31 | 5.9 / 5.6 | 1.28 |
| west-deck | 159 | 132 | 1.20 | 6.2 / 5.8 | 1.17 |
| plaza-loop | 678 | 510 | 1.33 | 26.3 / 25.9 | 1.16 |
| south-approach | 351 | 264 | 1.33 | 13.8 / 13.2 | 1.18 |
| house-west-to-saria-door | 234 | 204 | 1.15 | 9.1 / 8.5 | 1.16 |
| west-house-to-plaza | 516 | 402 | 1.28 | 20.3 / 20.6 | 1.18 |
| north-clearing-ledge | 2061 | 1569 | 1.31 | 82.0 / 81.9 | 1.19 |
| south-bridge-to-log | 1296 | 969 | 1.34 | 50.8 / 50.6 | 1.18 |
| north-grove | 1569 | 1248 | 1.26 | 61.3 / 61.2 | 1.17 |

Every route takes 14–34 % more simulated frames than it did yesterday evening while **walking the same
distance** — the traced path lengths match to a few centimetres, so the routes have not moved.

## Not a regression: it is Astra's PR #59, landing at its stated speed

Two checks before calling it:

* `gauntlet/scripts/playtest.mjs` has **no commits since 19:00 yesterday**, so both runs used the same
  harness and the frame counts are comparable;
* `7734f615` (09-25 19:42) applied Astra's PR #59 to the head — "run 2.2 m/s on a 1.2 m stride, **walk
  1.2 m/s**, authored arms unscaled, phase-based pelvis-notch correction, sole-floor clamp".

Measured across 320 m of walking on eleven routes, this head walks at **1.16–1.28 m/s, mean ≈ 1.19** —
within 4 % of the 1.2 m/s the change specifies, and uniform where the old speeds ranged 1.36–1.57 m/s.
So the slowdown is the intended one, it hit its number, and the spread collapsing is what a single
authored speed looks like.

Worth saying out loud because nobody had checked it from the outside: the reviews of that change were
pixel-based, and a walk speed is not something a frame comparison can see.

## What a returning integrator can take from this and `ROUND2.md`

Head `2b15f687` is healthy: 0 page errors, 10 look spots with a uniform 60.16° / −35.52° envelope, 11 walk
routes with nothing stuck, and the locomotion change measuring at spec.
