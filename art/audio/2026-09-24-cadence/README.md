# Lane 5 — the evidence walked at half the rate the game does

Branch `agent/squad5-cadence`, stacked on `agent/squad5-birds`.
Listen: `clips/mix-{before,after}.mp3` (the offline walk), `clips/live-running.mp3` (the real graph).
Run it: `probe.mjs` (the gait's own rate), `running.mjs` (the live master while he runs).

**This changes nothing the owner hears.** It fixes the instrument that everything else on this lane
was measured with, and the first thing the fixed instrument did was overturn a result.

## Where the step rate comes from

`footsteps.ts` carries a cadence model with a test asserting it is "a cadence a person could walk".
That model drives the **distance integrator**, which is the fallback. In play the character system
reports the gait's own boot plants and the integrator stays out of the way.

`probe.mjs` counts three things over the same walk and compares them: the ground actually covered,
the audio's own counters, and the gait's stance edges counted without the audio involved. Four
seven-second legs on two surfaces:

| | speed | steps | rate | a step is | gait-driven | the gait's own edges |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| walk, flagstones | 1.59 m/s | 25 | 3.56 /s | 0.44 m | 24 | 25 |
| walk, the lawn | 1.60 | 26 | 3.71 | 0.43 | 26 | 26 |
| run, flagstones | 4.60 | 34 | 4.85 | 0.95 | 34 | 35 |
| run, the lawn | 4.60 | 35 | 4.99 | 0.92 | 35 | 35 |

**The audio fires exactly one step per stance edge.** It is faithful; the rate is the animation's.

And the model was nowhere near it — 2.02 a second and a 0.79 m step at a walk, 2.95 and 1.56 m at a
run. Those are an adult's numbers. Link is a 1.25 m child who really does patter at 1.6 m/s, so the
gait is right and the model was wrong.

## Why that mattered

In play, not at all — the model is never consulted. But an **offline render has no character
system**, so the model is exactly what drives it, and every evidence WAV this lane has published
stepped like this:

| the 45 s offline walk | before | after |
| --- | ---: | ---: |
| walking legs | 1.98 /s, 0.76 m | **3.59 /s, 0.42 m** |
| the run leg | 2.90 /s, 1.45 m | **4.75 /s, 0.88 m** |
| steps in the whole render | 90 | **152** |

55 % of the rate, 59 % of the steps. The step *design* is unaffected — each step is the same sound
either way, so the heel-roll-toe work, the surfaces and the level balance all stand. Anything about
step **density** was measured at the wrong cadence.

`cadence()` is a two-point calibration against the gait now. A keyboard reaches exactly two speeds,
so those two points are the whole domain; the line between them is an interpolation and the ends are
clamped rather than extrapolated. The test asserts the calibration against the measured gait instead
of asserting that a number sounds plausible.

## What the fixed instrument overturned: the owner's job 8

The owner, 2026-09-23: *"the music kind of still shakes whenever I run"*. This lane's answer was
that the music was steady and the footsteps were pulsing over it at the step rate, and the fix was a
compressor on the sfx bus. **That was verified on an offline render, at 55 % of the step density the
owner hears.** So it had to be redone where he hears it.

`running.mjs` records the real master while Link runs, walks and stands. The envelope-modulation
spectrum — what rhythm the level moves to; the music's own beat is 76 bpm, 1.27 Hz:

| the live master | steps | strongest modulation | at the music's beat | at the step rate |
| --- | ---: | ---: | ---: | ---: |
| walking | 3.66 /s | **3.65 Hz** | 0.68 | 1.00 |
| running | 5.00 /s | **5.02 Hz** | 0.88 | 1.00 |
| standing | 0 | 1.18 Hz | 0.32 | — |

So in the game the steps set the mix's rhythm **whenever he moves**, walking as well as running —
which the old offline check could not have shown, because at 2.9 steps a second the step rate sat
close enough to the music's beat to be mistaken for it.

### Is that a defect? Measured, no — but here is the number

How far the mix swings, live:

| | 60 ms view (a footfall) | 400 ms view (a phrase) |
| --- | ---: | ---: |
| standing | 24.2 dB | 23.0 dB |
| walking | 10.0 dB | 6.2 dB |
| running | **5.9 dB** | **3.1 dB** |

Running does not make the mix *pump*; it makes it **flat**. Five footfalls a second put a floor
under everything and the swing collapses from 23 dB to 3.

Two things say this is what walking sounds like rather than a fault to suppress:

- **the hall is not doing it.** Rendering the run leg wet and dry: the whole mix swings 7.0 dB wet
  and 7.2 dB dry — no difference. The steps *stem* alone swings 38.8 dB wet against 147 dry (digital
  silence between steps), so the hall does fill the steps' own gaps; in the full mix the music and
  the bed were already filling them.
- **the steps are not out-punching the music.** On the run leg they peak at −33.2 dBFS against the
  mix's −30.3.

The strongest modulation being the step rate is what your own boots do in a real wood. Recorded here
so the owner can say whether the flattening is what he meant; **no change made on a guess.**

## Reproduce

```bash
npm run build
node art/audio/2026-09-24-cadence/probe.mjs   --dist dist   # the gait's rate, three ways
node art/audio/2026-09-24-cadence/running.mjs --dist dist   # the live master, running
```

`node --test src/audio/footsteps.test.mjs` — 14 tests; the cadence one now asserts the measured
calibration (3.63 /s and 0.44 m at 1.6 m/s, 4.92 and 0.93 at 4.6) rather than a plausible-sounding
number, and that the ends are clamped rather than extrapolated.
