# Job 8 — "the music kind of still shakes whenever I run" (owner, 23:00)

Branch `agent/squad5-music-stable`, off `ad4d5537`. A draft PR cannot be opened from this agent (its
token is not a collaborator on the repository), so this file is the report.

## The music was never shaking

The job brief's first suspect was scheduling drift — notes started from a JS timer or the render
loop instead of the audio clock, so every frame hitch shifts the beat. That is not what is
happening, and it is worth saying why before the fix:

- `music.scheduleUntil(ctx.currentTime + 6)` already schedules on the **audio clock**, six seconds
  ahead, in absolute times. Once a note is scheduled the audio thread owns it; a main-thread hitch
  cannot move it. Starving that would need a six-second stall.
- Nothing reads player speed or position anywhere in `music.ts`. The only pitch modulation is a
  fixed 5.1 Hz, 7-cent vibrato on the woodwind.
- Nothing ducks or side-chains the music bus.

And measured: the music stem's **own** amplitude rhythm is its beat, 76 bpm ≈ 1.2 Hz, standing at
17× over the background of its envelope spectrum — **identical whether he is standing, walking or
running** (17.1 / 17.8 / 13.8). The music is exact.

## What is shaking is the mix, and it is the footsteps doing it

Take the envelope of each stem over a leg of the scripted walk, remove its mean, and look at its
spectrum between 1 and 12 Hz: the tallest line is the rhythm the LEVEL is moving to (`beat.py`).

| stem | leg | before (head `03e1127a`) | after |
| --- | --- | --- | --- |
| mix | walking stone | 1.20 Hz (the music) ×4.5 | 1.20 Hz ×10.9 |
| **mix** | **running stone** | **2.80 Hz — the step rate — ×5.0** | **1.20 Hz — the music — ×6.9** |
| mix | standing | 1.75 Hz ×11.7 | 1.75 Hz ×12.4 |
| music | every leg | 1.20 / 1.20 / 1.75 Hz | **unchanged, byte for byte** |
| steps | running stone | 2.80 Hz ×7.2 | 2.80 Hz ×8.5 |

The moment he runs, the mix stops moving to the music's beat and starts moving to his feet. The
footsteps are the loudest transients in the game — peak −15.2 dBFS against the music's −20.2, about
28 dB of crest against the music's 13 — and at a running cadence they arrive two to five times a
second. A pulse at a few Hz laid over sustained notes is what shaking sounds like.

Two other candidates were measured and ruled out rather than assumed:

- **Audio-thread underruns.** Chrome's `AudioContext.renderCapacity` is not implemented in this
  browser, so instead the probe patches the node constructors from outside the source and counts the
  graph's main-thread work. Running builds 123 nodes/s costing **1.1 ms of main thread per second** —
  and standing still afterwards measured 122 nodes/s at 0.83 ms/s. Node churn is negligible and, more
  to the point, **not run-correlated**. (`load-probe.mjs`, `/tmp/load.json`.)
- **An offline render proving anything about drift.** It cannot: `OfflineAudioContext` renders
  against a perfect clock by construction, so both takes come out identical whatever the real-time
  behaviour. Offline is the right tool for the level question and the wrong one for the timing
  question.

## The fix

The footsteps get a compressor **of their own**, on the sfx bus and not the master: the music is
never touched, ducked or side-chained — only the crest of the thing that was punching through it
comes down. Threshold −30 dB, knee 12, ratio 4, attack 3 ms, release 120 ms; a walk's steps pass
under the threshold, a run's are held. `strengthFor` also flattens from 0.14 to 0.10 per m/s, because
running already multiplies the steps by cadence as well as by weight.

`DynamicsCompressorNode` applies its own makeup gain, which is neither optional nor reported: with
these settings it put the steps stem **8.1 dB louder** than before it was added. `SFX_TRIM` takes
that back and 2 dB besides, measured on the offline stem rather than guessed.

**And the music's −3.2 dB trim is reverted — it was mine, and it made this worse.** It came in with
the rests (`8bc41e0e`) to let the forest be heard beside the tune, but the rests already do that far
better: between passes there is no tune at all. What the trim actually bought was the footsteps
punching 3.2 dB further over the music, so on the build the owner plays next his complaint was worse
than when he made it. With the compressor alone on this head the running leg still moved to the step
rate (2.80 Hz ×5.4); with the level back it moves to the music (1.20 Hz ×6.9). Level belongs to the
music, space belongs to the rests.

| 60 s of the same walk | before | after |
| --- | ---: | ---: |
| mix RMS | −35.9 | −33.4 |
| mix peak | −14.7 | **−17.2** — 2.5 dB more headroom |
| mix crest | 21.2 dB | **16.2 dB** |
| footsteps RMS | −42.9 | −45.0 — still plainly there |
| footsteps peak | −15.2 | **−21.1** |
| footsteps crest | 27.8 dB | **23.9 dB** |
| music RMS / peak | −37.2 / −23.7 | −33.9 / −20.4 — the trim below |

And the steps keep their character — the whole point of the surface work — with only their peak
coming down:

| leg | centroid Hz | low/high | hits | peak dBFS |
| --- | --- | --- | --- | --- |
| grass | 1449 → 1457 | 2.19 → 2.18 | 2.3 → 2.1 | −28.2 → −28.7 |
| stone | 1004 → 1007 | 6.05 → 6.09 | 2.0 → 2.1 | −25.0 → −27.1 |
| stairs | 927 → 931 | 6.91 → 6.90 | 1.6 → 1.6 | −26.6 → −28.0 |
| leaves | 4607 → 4590 | 0.72 → 0.73 | 3.7 → 3.6 | −34.8 → −35.0 |
| run stone | 2430 → 2540 | 2.70 → 2.66 | 0.9 → 1.1 | −27.4 → −29.4 |

`clips/run-before.mp3` and `run-after.mp3` are the same 13 s of the walk running onto stone, at
+6 dB so it is easy to hear on a laptop.

## What this does not cover

He also reports the frames glitching per step on the stairs (job 1, fable-squad4's). If his machine
is dropping frames badly enough, the audio device can starve too, and no amount of mix work fixes
that — but the audio system's own contribution to main-thread load is the 1.1 ms/s measured above,
so it is not the cause of the hitching.

## Reproduce

```bash
npm run build
node art/audio/2026-09-23-lane5/render-mix.mjs --dist dist --out /tmp/after --seconds 60 --stems mix,steps,music
python3 art/audio/2026-09-24-music-stable/beat.py --before /tmp/before --after /tmp/after
python3 art/audio/2026-09-23-lane5/spectra.py steps --before /tmp/before --after /tmp/after --out steps-before-after.jpg
node art/audio/2026-09-24-music-stable/load-probe.mjs --dist dist
node --test src/audio/footsteps.test.mjs
```
