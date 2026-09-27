# Lane 5 — a Fresnel number is not a reason, and `mute` was not muting

Branch `cursor/squad5-ravine-5535`, on top of the ravine work, itself stacked on
`cursor/squad5-pad-5535` ([#203](https://github.com/Leonxlnx/zeldaremake/pull/203)). `src/` changes
are `ambience.ts` and two test files.

Check 45 of `art/audio/RUBRIC_50_SOUND.md` — *anything the player can walk behind or inside changes
what he hears of what is beyond it* — scores 3, and its evidence line names what is left: *"still
level-only for the fairy glints and the flames"*. Measured, it is stronger than that: **neither one
is occluded at all.** `occludeNow` is read in exactly two places in `ambience.ts` and both of them
are birds.

`2026-09-25-occlusion` left a written plan for the rest:

> *"Fairy glints are as shadowable but only audible within about 4.3 m, where you are rarely behind
> a bole from one."*
> *"The flame is still worth having behind the west house specifically: 6.80 m of wall and interior
> gives N = 12.7, a real shadow, and five pods sit where that applies."*
> *"Occlude the birds first, the flame second."*

Both of those are Fresnel numbers. **A Fresnel number says a shadow would be deep. It says nothing
about whether the thing being shadowed is contributing anything**, and these two sources fall off
fast — a pod is at half level 1.3 m away, and a glint is not sounded past 4.33 m.

## The number that should decide it

Not N, but the **shadowed share**: of the level actually arriving at the listener from that source,
how much comes from behind something.

```
share = sum over sources of (attenuation_i * shadow_i) / sum of attenuation_i
```

A share of 0.5 is 6 dB available and worth building. A share of 0.02 is 0.2 dB and is a way to
spend CPU on every tick for ever. `audible.mjs` computes it over 12,638 standing points on real
ground, using the world's own geometry — `podSpots` and `fairySpots` out of `stats()`,
`occlusionAt` out of the shipped module, `surfaceAt` to keep the samples on ground a player can
stand on:

```
source    places it sounds  the most shadowed   top 1%   top 10%   median  over a quarter
flame                12638              0.974    0.587     0.176    0.037      893 places
glint                  196              0.000    0.000     0.000    0.000        0 places
```

**The glint is a null, and a total one.** Of the 196 places in this world where a glint sounds at
all, the shadowed share is 0.000 at **every one of them** — not the smallest sliver anywhere. The
study guessed "rarely"; it is *never*. A glint needs her inside 4.33 m and the occluders are boles
of 1.1–2.2 m radius and huts of 4–7 m: if one were between you and something that close you would
be standing inside it. Check 45's mention of the fairy glints is closed as a non-item, and nothing
shipped for it.

**The flame is real**, and it is where the plan said: 893 standing places where more than a quarter
of the arriving flame is behind something, peaking at 0.974 beside the west house and the giant it
is built around.

## Which turned up the instrument being broken

The first pair of takes rendered the pod flames alone — `mute: ['flutters', 'birds', 'wind']` —
and read like this:

```
   behind-west-house    80-400 Hz mean  -0.3 dB    always-on  -4.0 dB
```

The floor moved four decibels and the mean did not move at all, which no pure gain can do. Chasing
it: the loudest fifty-millisecond windows in the take were **identical between the two renders**,
they were all bunched between 2.8 s and 5 s, and the take swelled 16 dB and fell again over the
first ten seconds of a take where the wind was supposedly off.

**`mute: ['wind']` was not muting the wind.**

```ts
const canopyMod = gain(ctx, 0);
canopyMod.connect(canopyGain.gain);   // summed with the param, not multiplied by it
...
canopyGain.gain.setTargetAtTime(windOff * (...), t, PLACE_TAU);   // gated
canopyMod.gain.setTargetAtTime(sw, t, 0.9);                       // NOT gated
```

A node connected to an `AudioParam` is **summed with that param's automation**, not applied to it.
Zeroing the level left the gust's own depth still driving the same gain, so a take with the wind
"off" still played the wind — swelling and falling with the gust, which is exactly the 16 dB and
exactly why it could not be moved by anything done to the flame. `flutters` and `birds` were never
wrong: those mute by not connecting the voice at all.

This is not a local bug. `mute` is the instrument every *what is this layer worth* measurement on
this lane rests on, and `2026-09-25-layers` used it on the wind. Its wind rows measured the forest
with the wind's floor off and its gust still playing.

Fixed by gating both modulations, and guarded — the new test in `ambience.test.mjs` compares every
gain the bed owns between a muted and an unmuted build and requires each one that moved to land on
exactly zero. Reverted, it fails with *"only 2 gains changed when the wind was muted; the two
levels and both modulations should"*.

## After, with an instrument that works

Same four spots, the flames alone, eight seconds of lead so the gust's own opening swell is out of
the window:

```
where                           80-400 Hz mean   always-on   broadband
   behind-west-house       before        -63.3 dB    -66.1 dB    -59.5 dB
   behind-west-house        after        -67.7 dB    -70.6 dB    -64.0 dB
                            moved         -4.4 dB     -4.4 dB     -4.4 dB   the wall

   behind-west-house-2      moved         -4.4 dB     -4.4 dB     -4.4 dB   the wall
   west-approach            moved         -4.2 dB     -4.2 dB     -4.2 dB   the wall

   open                    before        -55.6 dB    -58.5 dB    -51.4 dB
   open                     after        -55.6 dB    -58.5 dB    -51.4 dB
                            moved         -0.0 dB     -0.0 dB     -0.0 dB   unchanged
```

**−4.4 dB behind the west house and exactly 0.0 dB in the open.** The predicted figure was
0.974 × 0.4 = 0.39, which is −4.3 dB. Mean, floor and broadband now all move by the same amount,
which is what a level duck does and what the broken take could not show.

Note how much quieter the flames read than in the first pass — −63 dB against −54. That difference
is the wind that the old mute was leaving in.

## Why 0.4, and why level only

Both out of the physics rather than out of taste.

**0.4** because the flame is low. Through the median 3.10 m of wood a player can actually get
between himself and a source, the barrier attenuation at the flame's 320 Hz body is 20.6 dB against
a distant bird's 28.1 dB at 1800 Hz. The birds duck 0.5; 20.6 / 28.1 of that is 0.40. The guard in
`occlusion.test.mjs` recomputes that from the barrier formula and fails if the constant drifts off
it, and separately requires it to stay under the birds'.

**Level only** because the colour is not there to take. The flame is a 132 Hz husk and a 320 Hz
body, and the barrier difference between those two is 3.8 dB — which through the flame's existing
one-pole would move its corner from 320 Hz to 271. Under a decibel on a source with almost no
colour to lose. What a wall does to a flame is make it quieter.

The wetness follows for free and was not added: the duck goes into the attenuation `flameWet`
reads, so a shadowed lantern is heard more as the village's own hall and less as itself — which is
what hearing something round a corner is.

The duck is applied **per pod, inside the loop**, not once to the summed voice, because a listener
can be behind the west house from five lanterns while three more are beside him in the open. A
second guard reads the pod loop and fails if the lookup leaves it.

## Listen

`clips/` — the flames alone, twelve seconds, a common +22 dB because a lantern at this distance is
a quiet thing. Nothing else normalised.

```
behind-west-house-before.mp3   behind-west-house-after.mp3
open-before.mp3                open-after.mp3     the control, the same file twice
```

## Green

`npm run typecheck`, `npm run build`, **249 / 249** tests (three new), and
`playtest.mjs --only walk` at 11/11 routes with no page errors.

## Named, not taken

- **`2026-09-25-layers` needs re-running.** Its wind rows were measured through the broken mute.
  Its other rows (flutters, birds) are unaffected, and its method is sound — it is the number for
  the wind layer specifically that is now known to be understated. Not re-run here because it is
  sixteen 150 s takes and belongs to its own report.
- **The flame's occlusion costs a per-pod line test per tick**, skipped once a pod's attenuation is
  under a thousandth, which at a reach of 1.3 m is most of the village most of the time. Worth a
  look if rubric 49 is ever measured properly.
- The glint stays unshadowed, on the measurement above. If a Kokiri is ever placed where a bole
  can stand between her and reachable ground, this number changes and the survey should be re-run
  rather than the conclusion re-used.

## Reproduce

```bash
npm run build
node art/audio/2026-09-26-shadow2/audible.mjs --dist dist --out /tmp/shadow2
node art/audio/2026-09-26-shadow2/flame.mjs --dist dist --out /tmp/shadow2 --tag after
python3 art/audio/2026-09-26-shadow2/wall.py --takes /tmp/shadow2
node --test src/audio/ambience.test.mjs src/audio/occlusion.test.mjs
```
