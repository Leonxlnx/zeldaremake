# Lane 5 — six iterations judged as a mix, and the background got quieter by accident

Branch `cursor/squad5-ravine-5535`, stacked on `cursor/squad5-pad-5535`
([#203](https://github.com/Leonxlnx/zeldaremake/pull/203)). **No `src/` change.**

Yesterday's re-score named check 38 — *stems balance: each is audible when it should be and out of
the way when it should not* — as the thing to take next, for a reason that had nothing to do with
its score: **every number in it predates the steps coming down 4 dB and the compressor coming
out.** This measures it, and finds something the six iterations were not aiming at.

`balance.py` exists for exactly this and has not been run since: *"every other tool here compares
one stem across one change. This one asks the questions that only make sense about the finished
thing, and that a run of separate A/Bs can drift past."*

## The method

The integration head (`2b15f687`) built in a worktree beside this branch, and the same scripted
30 s walk rendered on each as four stems — `mix`, `bed`, `steps`, `music`. Nothing is quoted from
an older report; both sides are rendered today on the same box with the same harness.

## What moved, and what did not

```
stem      LUFS before    after  peak before    after   under the mix (LU)  range before   after
mix             -24.3    -24.3        -11.3    -11.7                    —          11.2    12.2
bed             -33.1    -32.7        -15.1    -15.1            8.8 → 8.4          22.9    24.7
steps           -35.9    -38.7        -16.7    -18.0          11.7 → 14.4           8.0     9.2
music           -24.7    -24.7        -12.4    -12.4            0.4 → 0.3          13.6    13.6

clipped samples after: 0
```

- **The music is untouched to the decimal**, which it should be: every change on this branch was
  on the sfx bus or in the bed, and the standing promise of the pad that replaced the compressor
  is that nothing is ducked or side-chained. Here is that promise as a number.
- **The mix is unchanged at −24.3 LUFS**, inside the −26 to −18 band check 35 asks for, and its
  true peak went *down* 0.4 dB. Six iterations and the thing a player's volume knob answers to did
  not move.
- **The steps are 2.8 LU quieter**, which is the 4 dB pad minus what removing the compressor's
  makeup gave back. Intended, and measured here on the whole walk rather than on one stem.
- **The mix's dynamic range widened**, 11.2 → 12.2 LU, and the bed's by nearly two, 22.9 → 24.7.

## The thing nobody was aiming at

The bed's **always-on** level — the 10th percentile over time, which is the metric this lane's
goal names for noise complaints and the one the owner's *"the background sound is too buzzy"* and
*"LOWER THE WHITE NOISE"* live in — fell across every band:

```
band                before     after    moved
   60-250 Hz         -56.8 dB   -59.6 dB   -2.7 dB
   250-1000 Hz       -61.4 dB   -64.1 dB   -2.7 dB
   1000-2000 Hz      -81.4 dB   -84.8 dB   -3.4 dB
   2000-4000 Hz      -84.6 dB   -89.3 dB   -4.7 dB
   4000-8000 Hz     -101.7 dB  -102.4 dB   -0.7 dB
```

**Two and a half to four and a half decibels off the floor of the background, on an ordinary walk
through the village**, and not one of the six iterations was aimed at it.

It is attributable by elimination. Of everything that landed, only two changes touch the bed at
all on this route: the pod flames became occludable (`2026-09-26-shadow2`) and the village's two
tree-houses joined the occluder list (`2026-09-26-houses`). The ravine and the calls' send need
the bridge, which this thirty-second walk never reaches; the `mute` fix is an offline switch that
is not set here; the rest is the sfx bus. The walk starts on the plaza and crosses the village,
where the pods are and where Saria's house now stands between him and a good many of them — so as
he walks, lanterns behind it duck, and a lantern is the loudest never-stopping thing in this
world.

The bands agree with that reading. The flame is a 132 Hz husk under a 320 Hz body, and 60–250 and
250–1000 are exactly where it lives.

**This is the shape a bed is supposed to have.** The mean went slightly *up* (−33.1 → −32.7 LUFS)
while the floor went down 2.7 dB and the range widened 1.8 LU: the same forest, more swell and
less floor, which is the sentence `GUST_KNEE` was written for and the axis the owner complained
on.

## What check 38 should now say

Its cited numbers — *"bed 10.6 LU under the mix, steps 6.4, music 0.9"* — came from a 200 s
standing take in `-resurvey`, not from this walk, so they are not wrong so much as a different
measurement. On `balance.py`'s own 30 s walk the figures are **8.4, 14.4 and 0.3**, and the score
stays at **3** for a reason the numbers make plain: the music sits a third of a decibel under the
whole mix. Integrated, the mix *is* the tune. The forest is 8 LU beneath it and is heard in the
26 % of the time the tune rests (check 30).

That is a defensible design and it is not a measured fault, which is why this does not move the
score. It is also the last row in the rubric that is about the owner's own complaint, so it is
worth saying plainly what the shape is rather than leaving three stale numbers in the evidence
column.

## Listen

`clips/` — twenty seconds of the same scripted walk, a common +12 dB.

```
bed-before.mp3   bed-after.mp3     the background, where the floor dropped
mix-before.mp3   mix-after.mp3     the finished thing
```

## Green

No `src/` change. `npm run typecheck`, `npm run build`, **252 / 252** tests, and
`playtest.mjs --only walk` at 11/11 routes with no page errors.

## Named, not taken

- **The 200 s standing take has not been re-run**, so `-resurvey`'s numbers and the ones here are
  measuring different things and should not be compared row to row. Re-running it would let
  check 38 carry one set of figures instead of two; it is 200 s per condition and belongs to
  whoever next wants that row to move rather than merely be accurate.
- **The floor drop is attributed by elimination, not isolated.** Proving it directly means a build
  with `FLAME_DUCK` at 0 and the houses out, which is two probe builds for a number that is
  already explained by the bands it appears in. Worth doing if anyone wants to claim a size for
  each of the two changes separately.
- The mix's true peak fell 0.4 dB, so `WORST_CASE_PEAK_DBFS = −16.7` is conservative by a little
  more than it was. Still a valid ceiling; still nobody needs the headroom.

## Reproduce

```bash
git worktree add /tmp/base 2b15f687 && ln -s "$PWD/node_modules" /tmp/base/node_modules
(cd /tmp/base && npx vite build --outDir "$OLDPWD/dist-base")
npm run build
node art/audio/2026-09-23-lane5/render-mix.mjs --dist dist-base --out /tmp/bal-before --seconds 30 --stems mix,bed,steps,music
node art/audio/2026-09-23-lane5/render-mix.mjs --dist dist      --out /tmp/bal-after  --seconds 30 --stems mix,bed,steps,music
python3 art/audio/2026-09-23-lane5/balance.py --before /tmp/bal-before --after /tmp/bal-after
```
