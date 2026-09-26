# the boots were reading the wrong clock

**Link's speed reaches the audio as a quotient it works out itself, and it was dividing by the
wall clock. He does not walk on the wall clock.** Under the play-test harness every script in this
repo uses, that made **49 % of his steps run steps**; under a 300 ms blocking frame once a second
it made 18 % of his boots land more than 3 dB above the same boot on the same flagstone. Fixed by
dividing by the simulation clock, which is the clock the distance was generated on. Recorded
either side: the same pacing over the same ground now differs by a median of 0.0 dB, and every
plant that moved by more than 3 dB got **quieter** (4 of 4 hitched, 2 of 2 burst, 0 of 57 smooth).

    src/audio/footsteps.ts   paceFrom()
    src/audio/index.ts       the live tick
    src/audio/cadence.test.mjs   four new tests, four regression probes

---

## what the number is

Nothing tells the audio how fast Link is going. `mountAudio`'s tick differences his position
between two of its own ticks and divides by a time:

    const dt = lastT ? Math.min(0.1, (now - lastT) / 1000) : 1 / 60;
    const speed = Math.hypot(p.x - lastPos.x, p.z - lastPos.z) / Math.max(dt, 1e-3);

That quotient is not only the stride. `strengthFor` reads it for how hard the boot lands,
`speed > RUN_SPEED` swaps the entire step design for a run's, and under 0.25 m/s `drive` returns
before it even looks at the gait's stance flags — so a tick that calls him stopped sounds nothing
and resets the stride he had banked.

He moves inside `world.update(dt, simTime)`, and `main.ts` hands that a dt **clamped at 0.1 s**:

    const rawDt = getDelta();
    const dt = Math.min(rawDt, 0.1);      // src/main.ts
    ...
    world.update(dt, simTime);

So over a frame that runs longer than a tenth of a second he covers a tenth of a second of ground
however long the frame really was. The world slows down; it does not skip. The wall clock and the
ground he covered stop agreeing exactly when it matters.

## what I got wrong first

I opened this iteration having "found" the fault in `Math.min(0.1, …)` — a clamp on a drawn
quantity, the fault class that has come up four times in this lane — and wrote the fix and the
tests before measuring. **Both were wrong**, and the measurement is what said so:

- **The clamp is not the fault.** The audio ticks at `TICK_MS` (33 ms) and a long frame is usually
  a *blocked main thread*, which holds that timer up by the same amount it holds up the renderer.
  Measured side by side, the clamped wall clock and the true wall clock produce **the same column
  in every pacing** (below). Removing the clamp fixes nothing.
- **A clamp is not always wrong.** The audio's clamp was *mirroring* `main.ts`'s, and in the one
  case where the audio tick itself stretches past 100 ms it was the more nearly right of the two.

The fault class was a good prior and a bad diagnosis. What settled it was building the estimators
side by side and running the real thing.

## the three estimators, measured

`pace.mjs` runs `main.ts`'s loop verbatim in the real build with a hitch injected, samples at the
audio's own 30 Hz, and computes all three candidates against the truth. Nothing in `src/` is
instrumented: it reads `__ZR_PLAY__.state().link` and counts the simulation time it is itself
asking for. Level error is in the unit a step is heard in — `strengthFor` against what the true
speed would have given. Walking at 1.2 m/s throughout (`pace.txt` for all five in full):

| pacing | estimator | median | p95 | median level err | worst | reads as a run | silent |
|---|---|---|---|---|---|---|---|
| smooth | wall (both) | 1.21 | 1.41 | 0.7 dB | +4.0 dB | 0 % | 0 % |
| | **sim** | **1.20** | **1.20** | **0.0 dB** | **0.0 dB** | **0 %** | **0 %** |
| blocking, 300 ms/s | wall (both) | 1.20 | 1.40 | 1.1 dB | −11.5 dB | 4 % | 5 % |
| | **sim** | **1.20** | **1.20** | **0.0 dB** | **0.0 dB** | **0 %** | **0 %** |
| starved (rAF stalled, thread free) | wall (both) | 1.19 | 1.39 | 1.5 dB | −11.5 dB | 3 % | **25 %** |
| | **sim** | **1.20** | **1.20** | **0.0 dB** | **0.0 dB** | **0 %** | **0 %** |
| burst (the repo's harness) | wall (both) | **1.67** | **2.18** | **4.0 dB** | **+6.9 dB** | **49 %** | 0 % |
| | **sim** | **1.20** | **1.20** | **0.0 dB** | **0.0 dB** | **0 %** | **0 %** |

Three things to read out of it.

**The two wall columns are identical everywhere.** That is the "remove the clamp" fix measuring
exactly like the thing it was supposed to repair, which is a FAIL and is why it is not what
shipped.

**The simulation clock is exact, by construction.** `moved / Δsim` is his speed because Δsim is
the interval the distance was generated over. It is not a better estimate; it is the definition.

**`burst` is not a hitch.** It is `playtest.mjs`, `live.mjs` and every other harness here:
`__ZR_PLAY__.step(n, dt)` advances the world several frames inside one call, so more world happens
between two audio ticks than wall time passed. At a mild 2× the audio was told 1.67 m/s for a
1.2 m/s walk and **called it a run on half its ticks**. Every play-mode recording this lane has
published was made through that.

## what did not happen

`steps.mjs` was written expecting to find dropped steps — a tick under 0.25 m/s returns before the
stance flags, so a boot planting on one should make no sound at all. **It does not happen**, and
the negative result is worth as much as the rest: steps per metre came out 2.24–2.36 in every
pacing on both builds against the 2.27 the clips predict (`WALK_STEP_M`, 0.44 m a boot). The
reason is that the flags cannot flip on a tick the simulation did not advance either, so the plant
is still waiting on the next live tick — and gets sounded there, at that tick's wrong speed. The
damage is mis-levelling, not absence.

## the fix

    export function paceFrom(moved: number, simElapsed: number, held: number) {
      if (!(simElapsed > 0)) return { speed: held, dt: 0 };
      return { speed: moved / simElapsed, dt: simElapsed };
    }

and the tick reads the clock from the wind, which is already in this lane's hands —
`wind.update(dt, t)` is handed the same `simTime` `world.update` is and writes it straight into
`uTime`, so **no file outside `src/audio/` is touched**:

    const simNow = o.wind?.uniforms.uTime.value;
    const simElapsed = simNow === undefined ? wallElapsed : lastSim === null ? 0 : simNow - lastSim;

`held` is for the ticks where the simulation did not advance at all — the audio runs on a timer,
which keeps going when animation frames do not, so these are normal rather than exceptional. There
is no new speed to read on them and zero is not the answer: he has not stopped, he has not been
stepped. The last speed stands and `dt` is zero, which hands the stride integrator the nothing he
actually travelled. The old code called those a standstill and reset the stride; on a starved
frame pattern that was **a quarter of them**.

## recorded, either side

`hitched.mjs` records the live master over the same 24.5 m of plaza flagstone under four pacings,
on the build before the change and the build after. Getting two takes comparable took three goes
and each failure would have produced a confident number that meant nothing:

1. **Walk for a fixed time and they cover different ground.** The hitched walk loses simulation
   time and ends 3.4 m short, and the far end of the plaza does not sound like the near end. Fixed
   by walking to a fixed *distance*.
2. **Take both in one page and the score has moved on.** The music runs off `ctx.currentTime`,
   which does not rewind between takes, so a sustained low note sat under one take and not the
   other — 20 dB in the 40–250 Hz band, nothing to do with the boots. Fixed with a page per take.
3. **Onset detection cannot tell a boot from a bird.** It found 59 and 66 events in two takes
   containing 37 steps each. Fixed by using the answer key the system already publishes:
   `FootstepStats.scheduledAt` is the context time a contact was scheduled *for*, polled per frame,
   so each take arrives with the exact time of all 57 plants and the ground he had covered at each.

Loudness is the peak of the 40–250 Hz envelope in the 60 ms after each plant — the band chosen by
measurement, not by ear: 17.0–17.8 dB of crest across that band's halves against 7.6 dB at
700–2000 Hz, and its envelope autocorrelates at 0.82–0.86 on a 0.367 s lag — 2.72 steps a second,
against the 2.73 `WALK_STEP_M` predicts. Both takes walk the same ground, so plant *k* is the same boot on the same flagstone.

**The headline comparison holds the pacing fixed and changes only the build**, because a take
against a differently-paced take carries its own confound: `burst` compresses the walk in context
time so its steps overlap more whatever their level, and `blocking` stretches it so they overlap
less.

| same pacing, after − before | plants | median | p90 | worst | moved > 3 dB |
|---|---|---|---|---|---|
| smooth — *the control, nothing should move* | 57 | −0.0 | +1.0 | +2.0 | **0 / 57** |
| a 300 ms blocking frame a second | 57 | −0.2 | +1.4 | −6.0 | 4 / 57, **4 of 4 quieter** |
| the world at twice the audio's clock | 57 | −0.4 | +1.1 | −3.9 | 2 / 57, **2 of 2 quieter** |

Nothing moved on a smoothly-paced walk, and every plant that moved at all got quieter. That is the
shape the fix predicts: most steps were never wrong, and the ones that fell on a hitch came back
down.

Read the other way — each build's hitched take against its own smooth twin, which is the confounded
view but the one that says how far out of line the hitched walk was:

| | plants | median | p90 | worst | over 3 dB |
|---|---|---|---|---|---|
| before, smooth twice *(the instrument)* | 57 | +0.4 | +2.0 | +2.8 | 0 / 57 |
| after, smooth twice *(the instrument)* | 57 | +0.1 | +1.5 | +2.3 | 0 / 57 |
| **before**, hitched against smooth | 57 | +0.8 | +3.6 | +5.5 | **10 / 57 (18 %)** |
| **after**, hitched against smooth | 57 | +0.5 | +2.1 | +6.0 | **3 / 57 (5 %)** |
| **before**, burst against smooth | 57 | +0.8 | +5.2 | +8.2 | 7 / 57 (12 %) |
| **after**, burst against smooth | 57 | +0.1 | +3.0 | +7.4 | 6 / 57 (11 %) |

The instrument's own repeatability is 0 / 57 over 3 dB on both builds, so the hitched take's 18 %
was real and its 5 % is most of the way back to it. **The burst row barely moves and that is not
the fix failing** — a burst take fits the same 57 plants into two-thirds of the context time, so
its steps sit closer together and sum into each other in the recording. The same-pacing table
above is the one with nothing else moving in it, and the burst row there is −0.4 dB median with
both changed plants quieter.

## clips

`clips/` — the same eight strides cut out of both builds around the plant that differs most, by
the *contact schedule* rather than by wall time (the hitched take needs a quarter more wall seconds
for the same flagstones, so cutting both at "12.0 s" would not be the same walk).

    blocking-before.mp3 / blocking-after.mp3     the worst plant, −6.0 dB at 8.6 m
    burst-before.mp3    / burst-after.mp3        the worst plant, −3.9 dB at 12.2 m
    smooth-before.mp3   / smooth-after.mp3       the control: +2.0 dB, and it should not be audible
    walk-hitched-before.mp3 / -after.mp3         the whole 41 s hitched walk, either side

## tests

`cadence.test.mjs` 10 → 14 tests (`node --test src/audio/cadence.test.mjs`, 14/14). Each was put
back as a fault and each is caught:

| the fault put back | caught by |
|---|---|
| `Math.min(0.1, simElapsed)` inside `paceFrom` | *the same ground covered reports the same speed* — off by 4.8 m/s |
| a zero-sim tick reports a standstill | *a tick the simulation did not move under is not a standstill* |
| the wall clock at the call site | *the tick hands it the simulation clock, not the wall* |
| a cap where the interval is computed | *the tick hands it the simulation clock, not the wall* |

The last two are a **source-level** guard: `paceFrom` is pure, so the three behavioural tests
cannot see which clock the live tick feeds it — put the wall clock back at the call site and all
of them still pass. That half of the fault is wiring, and the only other thing that catches it is
a recording, which `node --test` cannot run. It reads the call site the way `footsteps.test.mjs`
reads `CLIP_SPEC` out of `glbLink.ts`.

## gates

    npm run typecheck                                        clean
    npm run build                                            clean
    node --test src/audio/*.test.mjs                        101 / 101
    node gauntlet/scripts/playtest.mjs --only walk           11 / 11 routes, no page errors

## named, not taken

- **Every recording this lane has published in play mode was made through the burst path**, and
  the `raf`-paced ones (`live.mjs`) through a mild starve in the other direction (−3.5 dB worst,
  0 % run). The evidence is not void — the level work was all done on `renderOffline`, which does
  not use this tick at all — but any play-mode *step* level published before today was rendered
  from a speed Link was not travelling at. Not re-measured here.
- **`burst` overlap.** The burst take's steps sit 0.18 s apart in context time against the smooth
  take's 0.37, close enough that tails sum. It is why the burst-against-smooth row does not clear.
  Separating the overlap from the level would need a stem, and `record()` only gives the master.
- **The `held` speed has no staleness bound.** If the world stopped for a minute and then resumed
  with Link somewhere else, the first tick after would carry the speed he had a minute ago. It
  cannot sound anything — `dt` is zero, so the integrator banks nothing and no plant can flip while
  the flags are frozen — but it is a value with no expiry and I have not proved there is no path
  that reads it.
- **`uTime` is the wind's, not the world's.** It is the right number today because `world.update`
  hands the same `simTime` to both, and the audio falls back to the wall clock when there is no
  wind. A `ZRApi.getTime()` would be the honest source, and it is three lines in
  `src/capture/api.ts` and `src/main.ts` — outside this lane, so not taken.
