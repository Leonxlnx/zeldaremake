# Lane 5 — the player got new legs, and half this lane's numbers were about a player who no longer exists

Branch `cursor/squad5-newlegs-5535`, off the integration head at `bed93a19`. No behaviour change.

PR #59 landed at 22:05 with a new character controller: the game **walks at 1.2 m/s and runs at
2.2**, where it walked at 1.5 and ran at 4.2. The footsteps followed it in the same round (`7dca9387`
— the stride lengths and the run threshold). Nothing followed it in the bed, and the bed spent this
evening being rebuilt around the player's speed:

- `PLACE_TAU` exists because *"a smoothing time is a distance once the listener has a speed"*, and
  its doc quoted 4.2 m/s.
- `lag.test.mjs` caps the bed's lag in **metres**, sized against a 4.2 m/s run.
- `2026-09-25-lag/lag.mjs` and `2026-09-25-reseed/rate.mjs` had the two speeds **copied in as
  literals**, so every number they print described the old controller.

Every conclusion survives. Every number halves.

## The lag, at the legs the player actually has

```
--- the north path in through the log arch's mouth ---
parameter      was      span   walk lag  walk miss    run lag   run miss    run now   miss now
roll level    0.90   0.42 dB     1.06 m    0.20 dB     2.22 m    0.26 dB     0.15 m    0.05 dB
bed top       0.35  2.39 oct     0.46 m   1.80 oct     0.81 m   1.98 oct     0.15 m   1.21 oct
bore duck     0.12   6.94 dB     0.16 m    2.68 dB     0.27 m    4.03 dB     0.14 m    2.48 dB
hall send     0.60   0.41 dB     0.73 m    0.16 dB     1.32 m    0.22 dB     0.15 m    0.05 dB

--- the north path from the open village in under the crowns ---
roll level    0.90   5.19 dB     1.04 m    0.79 dB     1.76 m    1.30 dB     0.15 m    0.12 dB
hall send     0.60   5.11 dB     0.72 m    0.55 dB     1.26 m    0.93 dB     0.15 m    0.12 dB
bed top       0.35  2.16 oct     0.46 m   0.15 oct     0.86 m   0.27 oct     0.15 m   0.05 oct

--- past the village lantern ---
flame level   0.30  17.13 dB     0.35 m    1.44 dB     0.60 m    2.47 dB     0.15 m    0.61 dB
```

The roll's level was **1.76 m** behind a runner crossing the canopy edge and **2.22 m** at the bore,
where the first report said 2.8 and over four. The fault was real at the old speeds and it is real
at these; it is simply half the size. What it is now is **0.15 m at either gait**, which is
`PLACE_TAU` plus half a tick times the speed and cannot be improved without moving one of those.

## The re-seed rate, likewise

```
plaza to the log arch (one way, run)     27 s    2 re-seeds  one every 13.7 s  = 0.40 per call
plaza to the north grove (one way, run)  22 s    1 re-seed   one every 22.2 s  = 0.25 per call
pacing a 26 m line, 2 min at a run      120 s   10 re-seeds  one every 12.0 s  = 0.46 per call
pacing a 60 m line, 2 min at a run      120 s    5 re-seeds  one every 24.0 s  = 0.23 per call
```

Running from the plaza to the log arch still re-drew the whole wood twice — it just took 27 seconds
instead of 14. **Two calls in five arrived after all six birds had jumped**, where the first report
said two in three. Still the scattered stream the perch system exists to replace.

## What changed

**The two model scripts now read `WALK_SPEED` and `RUN_GROUND_SPEED` out of `footsteps.ts`** instead
of carrying copies. `footsteps.ts` derives them from the animation clip for exactly this reason —
*"deriving it instead means there is nothing to go stale"* — and then two evidence scripts copied
them anyway and went stale inside a day.

**`lag.test.mjs`'s caps came down from 0.2 / 0.45 m to 0.12 / 0.2.** A cap in metres sized against a
4.2 m/s run cannot fail on a 2.2 m/s one: at the old caps `PLACE_TAU` could have been doubled to 0.1
and nothing would have noticed. At the new ones it fails at 0.09 with *"crossing the log arch's
mouth at a run, the bed is still 0.21 m behind him (cap 0.2 m)"*.

**`PLACE_TAU`'s own doc and the contract test's failure message** quoted 4.2 m/s; the message now
multiplies by the constant.

`PLACE_TAU` itself is unchanged and did not need to change: its lower bound is the tick, which has
not moved, and at a slower run the geometry is easier to track, not harder.

## Left alone deliberately

The `takes.json` files in `2026-09-25-{turning,parallax,stale,reseed}` still carry 1.5 and 4.2,
because they are the record of renders already made and published — changing them would leave the
numbers in those reports describing takes that no longer exist. Anyone re-running them should expect
the lags to halve and the conclusions to hold, which is what this branch measures.

## And one thing that was fine

While looking for speed-dependent drift I checked something nobody had: **does the bed survive being
summed to mono?** A laptop speaker is a common way to hear this game, and the bed is heavily panned
— birds at ±0.85, leaves at ±0.72, the flame, the wind's lean. Per band, the mono sum against the
average channel:

```
take                  20-60   60-250  250-1k    1-2k    2-4k    4-8k   8-16k
open, gusty           -2.05    -2.11   -1.90   -2.12   -1.05   -1.10   -0.63
crowns, gusty         -1.67    -1.68   -1.41   -2.03   -1.36   -2.71   -2.80
crowns, still air     -1.59    -1.63   -0.10   -1.98   -0.99   -2.18   -2.92
```

Everything between 0 and −3 dB, which is the range between "perfectly correlated" and "perfectly
decorrelated". **Nothing cancels** — no band goes past −3, which is what a phase-inverted pair would
do. Worth knowing rather than assuming, and no change needed.

## Reproduce

```bash
node art/audio/2026-09-25-lag/lag.mjs --out /tmp/lag      # no browser, reads the real speeds now
node art/audio/2026-09-25-reseed/rate.mjs
```

**222 / 222 tests**, typecheck clean, build green.
