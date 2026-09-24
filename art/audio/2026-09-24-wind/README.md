# Lane 5 — how often the wind actually drops, and what is in the gap when it does

Branch `agent/squad5-birds`, stacked on `agent/squad5-standing`.
Run it: `probe.mjs` (the world's wind), `schedule.mjs` (the bed's own scheduler, exactly).

## The assumption nobody had checked

This lane's answer to the owner's "LOWER THE WHITE NOISE" was to stop the wind bed being a bed:
below `GUST_KNEE` the canopy roll and the leaf hush are *silent*, not faint, and above it the swell
is bigger than the constant bed it replaced. The forest is only heard when something moves in it.

That rests on one thing nobody had ever measured: **that the world's wind spends a real share of
its time under the knee.** If it does not, the gate never fires and the fix was a reshaping rather
than a removal.

`probe.mjs` samples what `ambience.update` is actually handed — the world's own `uGust`, through
`stats().gust` — for minutes at a time in play mode. 235 s standing on the plaza:

```
min 0.014   p10 0.221   p50 0.467   p90 0.974   max 1.000
below 0.10   2.4 %      below 0.22   9.9 %      below 0.30  18.8 %      below 0.40  37.4 %
```

| | under the knee | lulls | median | longest | ≥ 1.5 s |
| --- | ---: | ---: | ---: | ---: | ---: |
| the world's wind | 9.9 % | 1.8 /min | 3.2 s | 5.1 s | 6 of 7 |

**The gate holds up.** About twice a minute the wind drops away and the bed goes quiet for some
three seconds — six of the seven lulls in that take lasted a second and a half or more, which is
long enough to hear as a breath rather than a dropout. The bed sounds for 90 % of the time the
player is listening, and rests audibly for the rest. That is how a wood behaves.

### And the offline curve is a fair stand-in

Nearly every number this lane has published comes from `renderOffline`, whose gust is a formula
written here rather than the world's. Worth checking, since if it were unrepresentative the whole
evidence chain would be:

| | p10 | p50 | p90 | under the knee | lulls | median |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| the world (235 s) | 0.22 | 0.47 | 0.97 | 9.9 % | 1.8 /min | 3.2 s |
| the offline curve (600 s) | 0.17 | 0.50 | 0.92 | 13.7 % | 2.0 /min | 4.2 s |

Slightly more generous lulls offline, the same shape everywhere else. It holds.

## What was in the gap: often nothing

The birds were on a flat 3.5–11.5 s timer that took no notice of the weather, while the leaf
flutters speed up in a gust. So in the one moment the forest is deliberately silent, the wood
frequently had nothing at all to say.

`schedule.mjs` measures this exactly instead of detecting calls in a render. The bed is
deterministic, so driving the real `createAmbience` against a fake audio context with the offline
gust curve gives every call's time to the sample — including the part that matters most, that the
scheduler runs **four seconds ahead of the clock**, so a call decided during a lull can sound after
it. Each call is attributed to the wind at the moment it *sounds*.

## The change

Birds shelter and stop calling in a blow and sing the moment it drops, which is both what a wood
does and what this bed needs — it puts something in the gap without putting anything back under
everything.

- `BIRD_LULL_GAP = 0.55` — the gap is 0.55 of its usual in still air and 1.45 of it in a full gust.
- `BIRD_ANSWERS_LULL = [0.5, 1.8]` — one call is brought forward that long after the wind crosses
  down through the knee. On the **edge** only; inside a long lull the rate above already carries it.
- `BIRD_GAP_TRIM = 1.42` — see below.

## The mistake, and the correction

The first version claimed the total rate was preserved and "only the timing moves". Measured, it
had gone **10.5 → 13.3 calls a minute** — one every four and a half seconds, which is an aviary,
not a wood. Two things push a rate up once the gap follows the wind:

1. a rate is one over a gap, so a gap that swings either side of its old value gives *more* calls
   per minute than the old fixed one did (Jensen's inequality), and
2. the lull trigger pulls the next call forward, which brings every call after it forward too.

`BIRD_GAP_TRIM` lengthens the base gap to put the total back, and a test now guards it, because the
failure mode is an aviary and it creeps.

## Result

7200 s of the same wind, 240 lulls, counting the scheduler's own output:

| | before | after |
| --- | ---: | ---: |
| all birds | 10.3 /min | **10.2 /min** |
| in the lulls | 11.0 /min | **17.5 /min** |
| while it blows | 10.2 /min | **9.0 /min** |
| lulls with a call in them | 147 / 240 (**61 %**) | 184 / 240 (**77 %**) |

The same number of birds, in different places: 59 % more of them in the quiet, 12 % fewer in the
blow, and four lulls in five now have something in them instead of under two in three. Stable across
900, 1800, 3600 and 7200 s windows (10.6 / 10.4 / 10.2 / 10.2 a minute).

Nothing here raises a floor. A bird call is 1.6–2.6 s inside a three-second lull, so the quiet is
still quiet; what changed is that it now has a wood in it.

## Reproduce

```bash
npm run build
node art/audio/2026-09-24-wind/probe.mjs --dist dist --minutes 4     # the world's own wind
node art/audio/2026-09-24-wind/schedule.mjs --seconds 7200           # the bed's scheduler, exactly
```

`node --test src/audio/ambience.test.mjs` — 11 tests, two new: that the wind dropping brings a call
forward and that the trigger is the edge rather than the level, and that a wind which comes and goes
does not *make* birds, only move them.
