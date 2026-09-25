# Lane 5 — a diagnostic that cost a frame, and a question I could not answer

Branch `agent/squad5-rhythm`, off the integration head at `905d55ea`.

Two things, and the honest split is that the one I set out to answer I could not, and the one I
tripped over on the way is a real fault of mine from yesterday.

## The fault: `stats()` was walking the whole scene, every call

`art/audio/2026-09-25-occlusion/` added `podSpots` to `stats()` so a harness could ask where the
flames are. It did it by calling `gatherPods(o.scene)`, which is a full `scene.traverse()` — on
**every call**. And `stats()` is the thing harnesses poll every frame.

```
                 before      after
stats()          0.333 ms    0.003 ms
a sim frame      2.585 ms    3.105 ms
stats() is       13 % of a frame    0.1 %
```

A pod lantern is a fixture; the answer cannot change. Gathered once now and kept. Three lines, and
`stats()` still returns all 62 of them.

It is worth being plain that this was mine, shipped yesterday, in a PR whose whole point was
measuring carefully. A diagnostic that costs a tenth of what it is diagnosing is not a diagnostic.

## The question I could not answer

`2026-09-25-gaitdriven` established that a player's steps come from the character system's stance
edges while every offline render this lane makes falls back to the distance integrator. The rates
were matched deliberately (#64 derived the stride from the animation's clip contract), but a rate is
not a rhythm — and **every listenable clip this lane has produced came from a render**. If the
integrator lays steps on an even distance grid where a real gait lands them on the animation's
contacts, the evidence is more mechanical than the game.

Measured, the intervals between one step and the next:

```
                        gaps    mean       sd    spread    min      max
in play, walk             86   347 ms   46.8 ms   13.5 %   293 ms   618 ms
in play, run             110   252 ms   39.3 ms   15.6 %   189 ms   421 ms
in a render, walk         17   274 ms   25.1 ms    9.2 %   250 ms   302 ms
in a render, run           8   463 ms  132.0 ms   28.5 %   400 ms   802 ms
```

**The bottom row is not data.** A run's steps are about 198 ms apart and the onset detector reports
463 — it is finding roughly every other one, which this lane already knew it does at a running
cadence (`2026-09-25-gait` had to work around exactly this). And the play rows are contaminated too:
the harness re-places him every five seconds so he cannot run out of flagstones, and each
re-placement is a stall that widens the spread.

So the render's walk is the only clean cell — mean 274 ms, which is 3.65 steps a second against a
stride's 3.64, and a 9.2 % spread that is the ±4 % stride jitter doing its job. I cannot say from
this whether play is tighter or looser, and I am not going to claim it either way from a 13.5 % that
has my own re-placements in it.

**What it would take:** an onset detector that works at five steps a second, which is a piece of
signal processing rather than a harness tweak, or a way to read the character system's own contact
times directly (`feetContact` publishes stance flags — a harness could log their edges instead of
inferring them from the audio).

## Two harness traps, recorded so the next person does not pay for them again

**Pacing.** The first version ran `__ZR_PLAY__.step` in a tight loop. The simulation advances by `dt`
per call and the audio's tick is a wall-clock `setInterval`, so running faster than real time means
the audio samples him a handful of times: it counted **five steps where there should have been
thirty-six**. Every frame is paced to real time now.

**Distance.** The second version held W for thirty seconds. At a run that is a hundred and thirty
metres — he left the village, jammed against terrain, and the harness read a gait taking *a step and
a half a second*. He is re-placed on the plaza every five seconds now, at the cost of the stall that
contaminates the spread above.

## Reproduce

```bash
npm run build
node art/audio/2026-09-25-rhythm/rhythm.mjs --dist dist --out /tmp/rhythm
```

**206 / 206 tests**, typecheck clean, build green. Nothing outside `src/audio/` and `art/audio/`.
