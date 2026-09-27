# Lane 5 — a roof works, and it works on the events rather than on the bed

Branch `cursor/squad5-ravine-5535`, stacked on `cursor/squad5-pad-5535`
([#203](https://github.com/Leonxlnx/zeldaremake/pull/203)). **No `src/` change.**

Check 10 — *a roof over him changes the sound (level, colour, or both) and the change is
measurable* — was the last row on this rubric that is genuinely open, in this lane, and had not
been looked at. It scores 3 on "+2.9 dB between gusts, reproduced at a second spot", which is a
**level**, and `2026-09-25-places` established that level is the axis check 9 was mis-scored on
the first time round: **colour is what tells one place from another.**

The canopy is also the most widespread place term in the world. Most of this forest is under
crowns.

## What the term actually does

Five things, of which four were known and one had never been measured:

- `CANOPY_SHARE` on the roll's level
- `CANOPY_HALL` on the send
- `CANOPY_FLUTTER` on the leaf rate
- `flutterPan` on their width
- **`CANOPY_CLOSE` on `enclosureLp`** — and `out.connect(enclosureLp).connect(outBus)`, so
  **every voice in the bed passes through it**, the birds and the leaves included. At a closed
  canopy it sits at `18000 · (900/18000)^0.5 = 4025 Hz` against 18 kHz in the open.

Whether that last one does anything depends on what there is up there to lose, and there was
reason to think nothing: an earlier attempt at a canopy filter was reverted with *"a filter
cannot take away what is not there"*.

## Measured, at one spot with the term forced

```
the always-on level (the 10th percentile over time)

          band    canopy 0  canopy 0.5    canopy 1   open to closed
   60-250 Hz        -57.5 dB    -57.2 dB    -57.0 dB       +0.5 dB
   250-1000 Hz      -61.2 dB    -60.7 dB    -60.4 dB       +0.7 dB
   1000-2000 Hz     -79.5 dB    -76.5 dB    -72.7 dB       +6.8 dB
   2000-4000 Hz     -83.3 dB    -83.5 dB    -80.5 dB       +2.8 dB
   4000-8000 Hz    -100.0 dB    -97.0 dB    -98.2 dB       +1.8 dB
   8000-16000 Hz   -107.3 dB   -107.0 dB   -108.1 dB       -0.7 dB
   A-weighted        -63.8 dB    -63.2 dB    -62.6 dB       +1.2 dB

the loud moments (the 99th — where the birds are)

   60-250 Hz        -43.5 dB    -41.2 dB    -39.3 dB       +4.2 dB
   250-1000 Hz      -29.1 dB    -29.5 dB    -26.3 dB       +2.9 dB
   1000-2000 Hz     -37.3 dB    -39.6 dB    -32.9 dB       +4.4 dB
   2000-4000 Hz     -37.1 dB    -36.9 dB    -35.8 dB       +1.3 dB
   4000-8000 Hz     -62.6 dB    -61.0 dB    -62.9 dB       -0.3 dB
   8000-16000 Hz    -79.5 dB    -79.6 dB    -93.7 dB      -14.2 dB
   A-weighted        -29.7 dB    -30.3 dB    -26.8 dB       +2.9 dB
```

The +2.9 dB the check already cites is there, on the loud moments. The rest of it is new.

**The filter is doing real work, and only on the events.** At 8–16 kHz the loud moments lose
**14.2 dB** under a closed canopy while the always-on floor moves **−0.7** — which is the same
sentence this branch has now measured four times over: **the bed is dark and its events are not.**
It is why the gorge got a convolver for the contacts and then for the calls, why an earlier
attempt at the gorge's colour on the bed's own filter measured +0.3 dB, and it is why the reverted
canopy filter was reverted while the shipped one earns its keep. A filter cannot take away what is
not there — and a bird call is there.

## Colour, on the axis check 9 was re-scored on

Each take normalised to its own broadband level, so only shape is left:

```
   canopy 0:   0.00 dB of shape away from the open sky
   canopy 0.5: 1.53 dB
   canopy 1:   2.75 dB
```

`2026-09-25-places` measured the thirteen surveyed spots **0.2 to 10.2 dB apart in shape, median
4.3** — and the pairs it called "the same place twice" were 0.2 to 1.2 apart. **A roof is 2.75 dB
of shape**, which is well clear of the pairs that sound alike and two thirds of the median
difference between two named places.

## Check 10

**3 → 4.** The check asks for *level, colour, or both*, measurable. It is both, and now measured:
+1.2 dB A-weighted on the always-on floor, +2.9 on the loud moments, −14.2 dB off the top octave
of the events, and 2.75 dB of shape on the axis that distinguishes places.

## Listen

`clips/canopy-0.mp3` and `clips/canopy-1.mp3` — forty seconds of the same spot, the same seed and
the same weather, with the roof forced off and on. +16 dB, nothing else normalised.

## Green

No `src/` change. `npm run typecheck`, `npm run build`, **260 / 260** tests, and
`playtest.mjs --only walk` at 11/11 routes with no page errors.

## Named, not taken

- **The 1–2 kHz band goes UP 6.8 dB under a roof**, which is the largest single movement in the
  table and is the leaf hush plus `CANOPY_FLUTTER`'s extra leaves plus `CANOPY_HALL`'s extra
  send. It is the right direction — a roof of leaves is where leaf sound comes from — but three
  terms all pushing one band is worth separating if anyone wants to tune it, and `mute` can do
  that now that it works.
- **The measurement is one spot.** `2026-09-25-facing` reproduced the level figure at a second,
  and the colour figure has not been. A term forced at one place is isolated but not surveyed.

## Reproduce

```bash
npm run build
node art/audio/2026-09-24-standing/term.mjs --dist dist --at 1.5,-6 --term canopy \
    --values 0,0.5,1 --seconds 150 --out /tmp/canopy
python3 art/audio/2026-09-26-roof/roof.py --takes /tmp/canopy
```
