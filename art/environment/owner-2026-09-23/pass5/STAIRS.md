# The stair shake — what it was, and what it is now (2026-09-23 23:00 → 23:40)

The owner, 23:00: *"whenever I walk up or down the stairs, it glitches the frames like up and forth
every each step, which is annoying and that keeps like cutting."*

## It is the camera, not the frame rate

First suspicion was a frame hitch, so the pacing harness ran the flight before anything changed
(`playtest.mjs --only pacing --routes upper-house`, 630 frames, 21 simulated seconds): JS step p50
4.7 ms / p95 10.7 / p99 14.7, and every hitch it flagged sits at z ≈ 0–2, which is the **plaza before
the flight**, not on it. Three shader programs compile during the walk (113 → 116) — real hitches,
but three in twenty seconds, not one per step. So the thing that repeats on every tread is geometry,
not cost.

## What was wrong

The walked surface is a **staircase**: `ground(x, z)` jumps a whole riser at every nosing. Four of
the follow camera's inputs read it, and only one of them was eased against it.

| input | was | effect on a flight |
| --- | --- | --- |
| the orbit pivot `baseY` | eased, `Y_TAU` 0.32 s | smooth in position — but see below |
| **the aim** (`aimP.y`) | **raw** | the view pitched a riser's worth on every tread |
| **the camera's floor clamp** | **raw** | descending, the camera fell a whole riser inside one frame |
| **the collider's lift** | **raw** | it lifts the camera so the LINE from Link clears the ground between, and on a flight the ground between is the treads **behind** him — so the lift stepped too |

And the one that *was* eased still had a second-order problem: a single lag fed a staircase smooths
the position but not the **rate**. The treads arrive every 0.088 s at run speed and `Y_TAU` decays
over 0.32 s, so the climb pulsed between a near stand-still and twice its speed, once per tread.

## What changed (`src/camera/follow.ts`)

- the aim rides the surface on its own shorter constant, `AIM_TAU` 0.13 s (the jump stays instant,
  so Link keeps his frame at the apex);
- the orbit height now follows **the eased aim** rather than the raw surface — two lags in series,
  which is a critically damped climb;
- the floor clamp is eased on `FLOOR_TAU` 0.16 s but stays a hard clamp, bounded so it can never
  trail the true ground by more than `FLOOR_SLACK` 0.14 m (well inside the 0.35 m clearance, so the
  camera cannot enter a tread);
- the collider's lift is eased on `LIFT_TAU` 0.15 s with the same kind of bound, `LIFT_SLACK` 0.12 m
  against the line's own 0.2 m clearance over the ground.

## Measured

`stair-cam.mjs` drives the real camera over a 22-step flight (0.30 m treads, 0.17 m risers) at run
speed, 60 fps, on the CPU — no browser. "Ripple" is the rms second difference: ~0 for a steady
glide, large for a saw-tooth.

| | before | after |
| --- | --- | --- |
| **up** — pitch ripple | 1.217 °/frame | **0.099** |
| **up** — pitch peak-to-peak | 2.259 ° | **0.442** |
| **up** — height ripple | 0.00343 m/frame | **0.00051** |
| **down** — height peak-to-peak | 0.2365 m | **0.0360** |
| **down** — height ripple | 0.0564 m | **0.0047** |
| **down** — pitch ripple | 1.397 °/frame | **0.113** |
| **down** — pitch peak-to-peak | 4.624 ° | **0.616** |

Descending, the camera used to drop **237 mm in a single frame** — more than a whole 170 mm riser,
because the floor clamp and the lift stepped together. It now moves 36 mm at worst.

The mean climb and descent rates are unchanged (0.026 and −0.020 m/frame), so the camera still
tracks the flight; what went away is the alternation.

`stair-chart.mjs` draws all four quantities with the **pre-fix** `follow.ts` on one side and this one
on the other (it loads the old file straight out of git, so both lines are the real code).

## Tests

`node --test src/camera/follow.test.mjs` — 12/12, with two new ones that pin the flight in both
directions at the numbers above, so this cannot quietly come back. `npm run typecheck` and
`npm run build` green. `playtest.mjs --only walk,climb`: nine routes reach every waypoint, no stuck
points, no stalls on either flight.
