# Lane 5 — a bird call is not dark, so the ravine can answer it

Branch `cursor/squad5-ravine-5535`, stacked on `cursor/squad5-pad-5535`
([#203](https://github.com/Leonxlnx/zeldaremake/pull/203)). `src/` changes are `ambience.ts`,
`index.ts` and one test file.

`2026-09-26-ravine` gave the cut its own convolver and put only the **contacts** in it. That is the
hut's pattern — `buses.room` serves the footsteps and the bed handles indoors by filtering — and it
was the right default. It closed by naming what it left out:

> *"The bed and the bird calls do not use the ravine, only the contacts… the bed is dark, and the
> last attempt at the gorge's colour opened the bed's own filter and moved 4–8 kHz by +0.3 dB
> because there is almost nothing up there to return. **A bird call is not dark**, and a call heard
> from the far bank while you stand mid-span is the obvious next thing this space should be under."*

This is that. The bed's *continuous* layers stay out of the ravine for the reason already measured;
the calls go in, because they are the one thing in this bed with a top end and they are transients,
which is what a space with a 29 ms pre-delay has anything to say about.

## How loud, and why it is louder than a footstep's

The geometry gives two different answers for the same space, and the order of them is the point.

- A **boot** is about 1.7 m from the ear. The wall is 5 m off, so its reflection travels ~10 m
  against the direct sound's 1.7 — six times as far, 15.4 dB of spreading. Measured, the ravine
  answers a footstep **12.8 dB under it**.
- A **bird** is 5 to 28 m away. Over that distance the reflected path is barely longer than the
  direct: at 20 m, bouncing off a wall 5 m to the side is 22.4 m against 20, which is **1 dB**.
  The physics of a canyon is that distant sounds come back almost as loud as they arrive.

So a call's answer must be *more* prominent than a boot's, not less. It ships at **7.9 dB under the
call** — well under what the geometry would allow, for the same reason `ROOM_RETURN` sits twenty
decibels under a real hut: the honest number is exhausting to walk around in.

**A first pass got this backwards and is worth recording.** `GORGE_CALL_SEND = 0.55` measured
−14.7 dB — *quieter* relative to its source than the footstep's, which is the wrong order. The
constant's docstring had said "a measured 10 dB down" before anything was measured. It now carries
the measurement instead of the intent, and the send is 1.2.

## After

Two spots, each rendered on a build without the send and one with it, with the leaves and the wind
muted so what is left in the take is birds. The difference between the two takes **is** the ravine
answering them; nothing else in the render can differ.

```
where       calls   the calls   the ravine   under the call
   midspan      14    -25.3 dB     -33.1 dB          -7.9 dB   the ravine
   lawn         24    -26.1 dB    -240.0 dB        -213.9 dB   the render floor: no ravine here
```

`gorgeAt` is 1.00 at mid-span and 0 on the lawn, and the lawn's two takes come out **byte for byte
the same file** — the two `clips/lawn-*.mp3` are identical to the byte as well.

## The always-on figure is the wrong instrument here, deliberately

This lane reaches for the always-on level (the 10th percentile over time) by default, and the goal
says to, because that is what a noise complaint is scored on. It would report a null for this.

Always-on is the level a listener lives with *between* events, and a bird call is an event —
sixteen to twenty-two of them in two minutes cannot move a tenth percentile whatever is done to
them. So the measurement is the calls themselves and the answer against them. Naming that choice
rather than quietly making it, because "measure the always-on" is the right default and this is a
case where following it would have produced a confident wrong answer.

## Where the answer comes from

```
   14 calls, each correlated against the ravine it caused

   median lag     58.0 ms
   quartiles      47.2 to 74.5 ms
```

Timed by cross-correlating each call's envelope against the answer it caused, **not** from a
detected onset. That is how the footsteps were timed and it is wrong here: a boot is an impulse and
its onset is a sample, while a call's attack is rounded by the air (`soft = 1 + distance * 1.6`),
so the detector fires several milliseconds late and reads the lag that much long — the first
version of this file reported 38 ms for a wall that is 29 ms away, entirely from that.

The walls at mid-span are 29 ms off and the floor 51, and the impulse spreads its early reflections
from the wall out past the floor, 29 to 59 ms. A correlation finds where the answer's **energy**
is, not when it starts, and a reverberant tail keeps building past its first reflection — so a
median in the back half of that window is what a working space looks like. When the answer *starts*
is not in question and is not measurable this way: it is the same convolver the footsteps use,
whose first 28 ms were measured to be digital silence on an isolated boot.

## The thing this could have got wrong

A term booked when the voice was built and never moved again — the fault this lane has caught twice
(`2026-09-25-turning`, `2026-09-25-parallax`), where a call kept the facing or the distance it was
scheduled with for its whole two and a half seconds. The ravine send rides the `turning` registry
with the call's pan, reach, top and wet, so a call sounding while he walks off the bridge loses the
ravine as he leaves it. There is a guard: build calls at `gorge: 1`, hold him there and require the
sends not to move, then set the term to 0 and require every one of them to reach zero.

The send is built for **every** call, at zero inland, where a footstep's is not built at all. A
boot is a third of a second and cannot cross the cut's eleven-metre fade while it sounds; a call is
two and a half seconds, which at a walk is three metres of that fade, so one booked on the approach
has to be able to pick the ravine up as he steps out over it.

## Listen

`clips/` — fourteen seconds from the busiest stretch of the take, a common +18 dB because the bed
with the wind muted is quiet. Nothing else normalised.

```
midspan-before.mp3   midspan-after.mp3
lawn-before.mp3      lawn-after.mp3     the control — identical files
```

## Green

`npm run typecheck`, `npm run build`, **251 / 251** tests (two new), and
`playtest.mjs --only walk` at 11/11 routes with no page errors.

## Named, not taken

- **The leaf flutters stay out of the ravine**, and that is geometry rather than an oversight: out
  over the cut there are no leaves. `GORGE_WIND` already says so in the bed — the roll gains with
  the gorge and the hush does not, *"there are no leaves out over the cut"* — so a flutter heard
  mid-span is a leaf on the bank, and giving it the rock would be modelling a tree that is not
  there.
- **The fairy glints stay out too.** No Kokiri stands anywhere near the bridge, and a glint is not
  sounded past 4.33 m; the same survey that found the glint unshadowable
  (`2026-09-26-shadow2`) found no standing point where one sounds within reach of the cut.
- **The flame stays out.** A pod is at half level 1.3 m away and the nearest lantern to the bridge
  is far outside that, so there is nothing arriving to reflect.
- That leaves the bed's continuous layers, which stay out on the measurement `-ravine` quoted.
  Everything in this bed is now either in the ravine or excluded from it for a stated, measured
  reason.

## Reproduce

```bash
npm run build
node art/audio/2026-09-26-calls/calls.mjs --dist dist --out /tmp/calls --tag after
python3 art/audio/2026-09-26-calls/answer.py --takes /tmp/calls
node --test src/audio/ambience.test.mjs
```

The `before` pair needs a build with `GORGE_CALL_SEND` at 0, or with the two lines in `birdVoice`
that build and connect the send removed; the guards in `ambience.test.mjs` fail either way.
