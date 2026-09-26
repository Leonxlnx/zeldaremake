# Lane 5 — the new controller took half of what tells a run from a walk

Branch `cursor/squad5-gaitagain-5535`, off the integration head at `6078bb00`.

PR #59 replaced the character controller on 2026-09-25: the game **walks at 1.2 m/s and runs at
2.2**, where it walked at 1.6 and ran at 4.6. `7dca9387` followed it in `footsteps.ts` — the stride
lengths and the run threshold, which is now the midpoint of the two speeds and so cannot go stale
again. One thing was not followed, because it is not a speed and does not look like one.

## A run has three cues

| | old controller | new controller | |
| --- | ---: | ---: | --- |
| cadence, steps a second | 3.64 walk / 5.05 run | 2.73 / 3.67 | ratio 1.39 → **1.34**, intact |
| level, `strengthFor` | 0.46 / 0.76 = **4.35 dB** | 0.42 / 0.52 = **1.86 dB** | more than halved |
| shape, the `running` design | heel attack −45 %, heel f0 +18 %, toe peak −30 %, tail −20 % | identical | a boolean; cannot drift |

The cadence survived because the run's stride came down with its speed — `RUN_STEP_M` went from
0.91 m to 0.60 — so the step rate fell in proportion and the ratio between the gaits barely moved.
The shape is switched by a boolean and takes no notice of speed at all; re-running
`2026-09-25-gait/design.mjs` on today's head prints exactly the figures it printed this morning.

**The level was the one that went.** `strengthFor` was `0.3 + speed × 0.1`, a slope — and a slope is
a number about a controller. Tuned against a 4.6 m/s run it gave 0.76 against a walk's 0.46; against
a 2.2 m/s run it gives 0.52 against 0.42, and the game only ever visits the bottom fifth of its own
range.

## The change

The curve is anchored to the controller's own speeds instead of being a slope:

```ts
export const STEP_FORCE_STILL = 0.3;
export const STEP_FORCE_WALK = 0.42;   // exactly where the walk already was
export const STEP_FORCE_RUN = 0.69;    // 4.31 dB over it, as the design was tuned against
```

with the walk landing exactly on its own constant and the run on its. Nothing about walking moves:
`strengthFor(1.2)` is 0.42 before and after. A run goes back to a **4.31 dB** gap.

**0.69 is under the 0.76 the game made at the old run speed**, so it asks nothing of the headroom
that the headroom has not already carried. Confirmed rather than assumed — the same worst case the
gain staging was sized against, captured off the live master on this branch:

```
                        19:30, old controller    now, new controller + this change
integrated loudness            −23.7 LUFS                 −24.1 LUFS
true peak (4× oversampled)      −7.5 dBFS                  −7.1 dBFS
clipped samples                         0                          0
the take                 174 steps, 51 landings     144 steps, 44 landings
```

Seven decibels of room left. The step count is down because a slower controller covers less ground
in seventy seconds, which is what makes this the new worst case rather than the old one.

## Why not lift the shape instead

Because it was tried and measured. `2026-09-25-gait` added a 1.35× lift on the heel and the headroom
guard caught it at 0.47 against its 0.45 limit on a bridge — the note beside `RUN_TOE` says why:
*"peak force IS level, so a 'harder heel' here would be level twice"*. The shape carries what is
left when loudness is taken out, and it is intact. What was missing was the loudness.

## Reproduce

```bash
node art/audio/2026-09-25-gait/design.mjs                 # the shape difference, unchanged
npm run build
node art/audio/2026-09-24-level/worstcase.mjs --dist dist --out /tmp/worst --seconds 70
ffmpeg -y -i /tmp/worst/worst.webm -ar 44100 -ac 2 /tmp/worst/worst.wav
python3 art/audio/2026-09-25-headroom/verdict.py --take /tmp/worst/worst.wav
```

## Guard

`footsteps.test.mjs` — *a run is louder than a walk by a stated amount, not by an accident of
slope*. Requires the gap between `strengthFor(WALK_SPEED)` and `strengthFor(RUN_GROUND_SPEED)` to be
between 3.5 and 5.5 dB, the two gaits to land exactly on their own constants, the run to stay under
the 0.76 the old controller made, and the curve to be monotone and never past full force.

That first assertion is the one that matters: it is stated in **decibels between the gaits** rather
than as a slope, so the next controller change cannot quietly halve it. (Checked: putting the run
back to 0.52 fails it with *"a run is 1.86 dB over a walk; the design was tuned against about
4.3"* — which is exactly what PR #59 did, and what nothing caught.)

**223 / 223 tests**, typecheck clean, build green.
