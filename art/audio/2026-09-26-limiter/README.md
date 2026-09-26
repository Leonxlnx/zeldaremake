# Lane 5 — the compressor is worth what it costs, and the thing it was added for is still there

Branch `cursor/squad5-limiter-5535`, off the integration head at `97045ffa`. The only `src/` change
is an offline switch; nothing in play behaves differently.

`2026-09-26-perstep` ended by naming the sfx bus's compressor as the next thing to look at: it is
called `sfxLimit`, its comment says *"quiet steps pass untouched (the threshold is below a walk's
peak); a run's are held"*, and measured, **every step in the game is in full four-to-one
compression**. The obvious move was to raise its threshold so ordinary steps pass and only the
overshoot is caught.

**Measured, that is the wrong direction.** Here is why, and what the compressor is actually worth.

## What it is for, made measurable

The compressor exists for one sentence: 2026-09-24, owner at 23:00, *"the music kind of still shakes
whenever I run"*. Its comment names the mechanism precisely — *"in the mix's envelope the strongest
rhythm then stops being the music's beat and becomes the step rate"*. That is a testable claim, and
`limiter: false` (new, offline only) takes the compressor and its makeup trim out together so it can
be tested.

The mix's broadband envelope, its spectrum, and how far two lines stand over the background around
them: the music's 1.2 Hz beat, and the step rate (2.73 Hz at a walk, 3.67 at a run).

```
gait    compressor    music 1.2 Hz  step rate  the step rate is
walk            on         18.3 dB    19.3 dB     +1.1 dB, over the music
walk           off         17.9 dB    19.7 dB     +1.8 dB, over the music
run             on         18.2 dB    22.6 dB     +4.4 dB, over the music
run            off         16.5 dB    24.2 dB     +7.6 dB, over the music
```

**The compressor takes 3.2 dB off the step-rate pulse at a run.** It is doing the job it was added
for, and the comment's description of the mechanism is exactly right.

## What it costs

```
gait    compressor       peak
walk            on    -13.7 dB
walk           off    -12.1 dB
run             on    -12.1 dB
run            off     -8.2 dB

  compressor on:  a run is +1.55 dB over a walk
  compressor off: a run is +3.97 dB over a walk
```

**2.4 dB of the gait difference.** The 3.97 dB without it is the 4.31 the design asks for, less what
the render's own variation takes — which is a clean independent check on
[#177](https://github.com/Leonxlnx/zeldaremake/pull/177)'s change, measured a different way.

So the trade is explicit: **3.2 dB less pulse for 2.4 dB less gait.** Raising the threshold buys the
gait difference back and hands the pulse back with it, and the pulse is the one the owner named.
**The item from `2026-09-26-perstep` is closed: do not raise it.**

## And the part that is still open

**With the compressor, at a run, the step rate still stands 4.4 dB over the music's beat.** The
owner's sentence describes a condition that is still measurably true — the strongest rhythm in the
mix is still his feet, not the tune. The compressor reduced it from 7.6 dB and did not remove it.

That is the real open item, and it is not the threshold. Three things could be tried, and each needs
its own before and after:

- **The release.** 120 ms at 3.67 steps a second means the gain is still recovering when the next
  step lands, so the compressor pumps at the step rate — which puts energy at exactly the frequency
  it is trying to remove. A release under one step interval, or over several, would not.
- **The step level itself.** `STEP_FORCE_RUN` is 0.69 and the owner's complaint is about steps
  against music; the lane has been pushing that number up (for the gait difference) while the
  compressor pushes it down. Those are two dials fighting.
- **The music.** It sits 0.9 LU under the mix and the bed 10.6 (check 38). A tune that occupies more
  of the mix is harder for footsteps to stand over.

Nothing here should be tuned by feel. The instrument now exists, so each is a measurement.

## Reproduce

```bash
npm run build
node art/audio/2026-09-26-limiter/render.mjs --dist dist --out /tmp/limiter
python3 art/audio/2026-09-26-limiter/pulse.py --takes /tmp/limiter
```

`clips/run-mix-{on,off}.mp3` is the same run mixed both ways.

## The `src/` change

`OfflineOptions.limiter` only, threaded to `createBuses`, which gains an optional third argument
defaulting to `true`. The live path does not pass it. Same pattern as `reverb: false` and `mute`:
a switch that exists so a claim about the graph can be measured instead of asserted.

**223 / 223 tests**, typecheck clean, build green.
