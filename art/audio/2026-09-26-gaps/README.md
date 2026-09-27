# Lane 5 — the cap on the leaves was a metronome

Branch `cursor/squad5-ravine-5535`, stacked on `cursor/squad5-pad-5535`
([#203](https://github.com/Leonxlnx/zeldaremake/pull/203)). `src/` changes are `ambience.ts` and
`ambience.test.mjs`.

Rubric check 5 is *its events (birds, leaves) are sparse and irregular, with gaps long enough to
notice*, scored 3 on "flutter gap capped at 2.2 s, bird gaps measured". The cap is the part nobody
had looked at:

```ts
nextFlutter += Math.min(QUIET_GAP_MAX, (0.5 + rng() * 3.2) / ((0.3 + g * 1.1) * (1 + canopy * CANOPY_FLUTTER)));
```

**A `Math.min` against a draw whose range is much wider than the cap does not shorten the long
gaps. It replaces them all with the same number.**

## Measured on the schedule

No render: the schedule is a pure function of the seeded stream, so it is driven directly.

```
weather                      gaps     mean  shortest  longest   spread  at the cap
   still air, open sky        422   2.13 s    1.20 s   2.20 s   0.20 s        88 %
   still air, closed crowns   469   1.92 s    0.70 s   2.20 s   1.10 s        63 %
   a half gust, open sky      479   1.87 s    0.57 s   2.20 s   1.13 s        61 %
   a full gust, closed crowns 1021   0.88 s    0.10 s   1.57 s   1.07 s         0 %
```

**In still air under open sky, 88 % of the gaps between leaf flutters were exactly 2.2 seconds**,
with a tenth-to-ninetieth spread of 0.20 s. A metronome at 0.45 Hz — and in the one condition
where it matters most, because that is where the wind layers are gated silent by `GUST_KNEE` and
the leaves are the only thing there is to hear.

Only a full gust escaped it, and only because a gust divides the draw down until the whole range
fits under the cap.

## Why it could not simply be softened

The constraint is arithmetic. **A gap bounded above by `C` whose mean is 97 % of `C` has nowhere
to vary.** Being irregular under the old 2.2 s ceiling would have meant a mean well below it —
more leaves, in the sparsest weather the game has, which is the opposite of what check 5 asks for.

So the ceiling moves out and the mean goes with it, and the tail is folded toward the ceiling
instead of onto it:

```ts
export function flutterGap(u: number, rate: number): number {
  const raw = (0.5 + u * 3.2) / Math.max(1e-6, rate);
  return QUIET_GAP_MAX * (1 - Math.exp(-raw / QUIET_GAP_MAX));
}
```

`C·(1 − e^(−raw/C))` is the same curve as `raw` while `raw ≪ C` and asymptotic to `C` above it.
Nothing about the weather's own shaping changes — the gust and the canopy still set `rate`, and
the draw over it is still uniform.

**3.2 s, not 2.2 and not five.** The sentence the constant was written for is *"the wood could
otherwise fall to nothing for five seconds at a time, which reads as the sound having broken"*.
And it is a schedule bound, not an audibility one: `2026-09-25-layers` measured the longest
stretch with nothing **audible** below the knee at 3.25 s already, with the leaves running at the
old 2.2.

## After

```
weather                      gaps     mean  shortest  longest   spread  at the cap
   still air, open sky        386   2.33 s    1.00 s   3.00 s   1.50 s         0 %
   still air, closed crowns   497   1.81 s    0.63 s   2.57 s   1.50 s         0 %
   a half gust, open sky      561   1.60 s    0.40 s   2.37 s   1.47 s         0 %
   a full gust, closed crowns 1192   0.75 s    0.20 s   1.23 s   0.80 s         0 %
```

**Nothing at the ceiling anywhere**, and in still air under open sky the spread goes **0.20 s to
1.50** — seven and a half times the variation — while the mean gets slightly *longer*, 2.13 to
2.33, which is the direction check 5 wants.

## And the wood is not left silent for longer

That is the thing this could have broken, so it is rendered rather than argued — the same sixteen
takes `2026-09-25-layers` uses, on the build before and the build after, through its own
measurement:

```
condition                            all   no leaves   no birds   no wind
   open, gusty            before    9.45        9.45      11.81     27.21
   open, gusty             after    8.00        8.00      15.73     17.13
   open, still-air        before    4.60        4.60       5.60      4.60
   open, still-air         after    3.75        3.75       4.45      3.75
   crowns, gusty          before   14.73       14.86      33.47     17.76
   crowns, gusty           after   15.83       17.08      33.42     30.61
   crowns, still-air      before    3.25        8.43       4.23      3.58
   crowns, still-air       after    3.85        7.95       3.85      3.88
```

**In the open the longest stretch with nothing audible gets shorter** — 4.60 → 3.75 s in still
air, 9.45 → 8.00 in a gust — *despite* the mean gap between leaves getting longer. That is what
irregularity buys: a metronome at 2.2 s leaves a run of 2.2 s holes, and a varied schedule puts
short gaps inside the long ones.

Under crowns it goes the other way by a little, 3.25 → 3.85 s and 14.73 → 15.83, both still well
inside the five seconds the constant was written against.

## What it costs

**More leaves in some weather.** The exponential is below the identity everywhere, by about 8 % at
the short end, so conditions whose gaps were already under the old cap get slightly crowded — the
still-air-under-crowns take went from 87 flutters in 150 s to 105. A flutter is 0.004 to 0.013 in
level and `2026-09-25-layers` measured that above the gust knee they are worth nothing measurable
at all, so this is a change to the sparsest weather and to nothing else. It is the price of the
same curve doing both ends, and it is in the direction "gusts bring leaves" (check 7) already
claims.

## A test that was passing on luck

Changing the flutter schedule shifts every later draw of the shared `eventRng`, and that broke
`walk past a tree and the bird in it goes past you`:

```
the whistle at 92.3 s came from 0.341 and its tree is at -0.160 from where he is standing
```

Not a regression. The test walks him twelve metres at t = 90 and checks every call after 91; with
the new stream a call is now *booked* at 89 s and *sounds* at 92.3, straddling the move — and
`birdSpots` was publishing the bearing the call was **booked** with, while its own docstring says
*"`birdSpots` says where a call was heard FROM"*. The audio was never wrong: the `turning`
registry re-aims the pan every tick. The diagnostic lagged, and the test had only ever passed
because no call happened to straddle the move.

Fixed: the entry is now kept and re-written alongside the pan, the reach, the top and the wet it
already tracks. A named-not-taken from `2026-09-25-turning` closed by accident.

## Listen

`clips/` — fifty seconds of the bed standing still, +16 dB, at the two conditions where the
leaves are audible.

```
open-still-air-before.mp3     open-still-air-after.mp3      the metronome, and not
crowns-still-air-before.mp3   crowns-still-air-after.mp3
```

## Green

`npm run typecheck`, `npm run build`, **260 / 260** tests (one new), and
`playtest.mjs --only walk` at 11/11 routes with no page errors.

The new guard drives 600 s of the schedule in still air and requires **nothing at the ceiling**
and a tenth-to-ninetieth spread over a second. Put the `Math.min` back and it says *"74 % of the
gaps sit at the ceiling — the cap is clipping again, not saturating"*.

## The other two streams, measured the same way

The leaves were one of three. `gaps.mjs` now drives all of them, and reports the **coefficient of
variation** — the standard deviation of the gaps over their mean, which has the reference point
that matters here: a **Poisson process**, which is what "independent sparse events" means, has a
CV of exactly **1**, and a metronome has **0**.

```
flutters   still air, open sky        2.38 s mean   spread 1.47 s   variation 0.23
           a full gust, closed crowns 0.74 s        spread 0.80     variation 0.40
birds      still air, open sky        6.79 s        spread 5.93     variation 0.33
           a full gust, closed crowns 15.68 s       spread 13.97    variation 0.31
glints     any weather                ~2.7 s        spread ~2.1     variation 0.28
```

Neither of the other two is clipped and neither could have had the flutters' fault. What they do
have in common with each other, and with the leaves, is that **every gap in this bed is a uniform
draw over a bounded range** — which is why they all land near 0.3 and none near 1. A uniform draw
over `[a, b]` has a CV of `(b − a) / (√3 (a + b))`, and the bird's 3.5–11.5 gives 0.31 to the
second decimal.

**Nothing shipped for it.** The bed is three times more regular than independent events would be,
and there is no evidence that a CV of 0.3 is heard as regular — the case that plainly was, CV near
zero at a clipped cap, is the one this iteration fixed. Making all three exponential is a texture
decision across the whole bed, it would break the ceiling `QUIET_GAP_MAX` promises and the guards
around it, and it is not a measurement away. Named with its number.

## And the weather's clock does not reach the events

`2026-09-26-gust` found `uGust` deterministic and repeating every 26.4 s, and left the question of
whether that reaches anything an ear notices. The bed answers the wind dropping away with a call —
`BIRD_ANSWERS_LULL` pulls the next one forward to 0.5–1.8 s after the lull's edge — so the calls
had every opportunity to inherit the cycle.

Driven on the world's own gust for an hour and folded modulo the cycle:

```
       cycle   calls  concentration
      26.4 s     594          0.031   <- the gust's own
      13.2 s     594          0.033
      52.8 s     594          0.012
      17.0 s     594          0.040
      60.0 s     594          0.017

   for 594 calls scattered at random the concentration is 0.034 typically and
   0.096 at the 99th percentile — that is the line a real pile-up has to clear.
```

**The calls are no more clustered on the gust's cycle than random times are** — 0.031 against a
null of 0.034, and inside the null at every period tried. Two reasons, both measurable: the lull
*crossings* come every 29.9 s rather than the autocorrelation's 26.4, and only a fifth of the
calls are lull-answers, each with 1.3 s of jitter of its own.

So the wind's period stays in the level, where it is worth r = 0.126, and does not get into the
events. A null, and the one that closes the question `-gust` opened.

## Check 5

**3 → 4** at the next re-score. Its three clauses are now measured true across all three streams:
**sparse** (mean gaps 0.7 s to 15.7 s depending on the weather), **irregular** (nothing at any
ceiling, CV 0.23–0.40, and no clustering on the weather's own clock), and **gaps long enough to
notice** (up to 23.5 s between calls in a full gust) without the wood falling silent for longer
than it did.

## Named, not taken

- **Every gap in the bed is a uniform draw, CV ≈ 0.3 against nature's 1.** Measured above. An
  exponential draw is the physically right model and a one-line change per scheduler; it is not
  made here because it is a texture decision for the whole bed, it breaks the ceiling promise,
  and nothing measured says 0.3 is heard as regular.
- **The 8 % shortening at the short end** could be removed with a piecewise curve that is exact
  below half the ceiling. Measured, it is worth 18 more flutters in 150 s of the quietest weather
  in the game, so it is named rather than built.

## Reproduce

```bash
node art/audio/2026-09-26-gaps/gaps.mjs --out /tmp/gaps
node art/audio/2026-09-26-gaps/phase.mjs --out /tmp/gaps
node --test src/audio/ambience.test.mjs
npm run build
node art/audio/2026-09-25-layers/layers.mjs --dist dist --out /tmp/layers-gaps --seconds 150
python3 art/audio/2026-09-26-relayers/relayers.py --before /tmp/layers-after --after /tmp/layers-gaps
```
