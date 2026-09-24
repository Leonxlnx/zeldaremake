# Lane 5 — the tune had no shape, and its pad never stopped

Branch `agent/squad5-music-shape`, off `4b882d71`. Sheet: `shape-before-after.jpg`.
Listen: `clips/{mix,music}-{before,after}.mp3` (56 s, one full pass).
Numbers: `levels.py` (loudness and band holes), `shape.py` (the sheet), `music.json`.

This started as the level question left open in `2026-09-23-lane5` — the mix measured well under
everything else on the owner's machine, and whether to use the headroom was a decision I had passed
to him. Measuring it properly found something else, and the level question is still open at the
bottom of this file.

---

## The measurement that found it

`levels.py` reports three things per stem: ITU-R BS.1770 integrated loudness (the number every
other application on the owner's machine is normalised to), true peak, and the spread of 400 ms
block loudness from its 10th to its 99th percentile — **how far a mix moves between doing something
and doing nothing**.

45 s of the scripted walk on the head `4b882d71`:

| | LUFS | true peak | p10 | p50 | p99 | **p99 − p10** |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| the whole mix | −30.2 | −16.8 | −33.0 | −30.3 | −27.2 | **5.8** |
| the music alone | −30.8 | −19.5 | −33.7 | −31.0 | −27.9 | **5.8** |
| the forest bed alone | −40.6 | −22.0 | −62.5 | −48.5 | −33.9 | **28.5** |
| the footsteps alone | −41.0 | −20.2 | −51.2 | −42.3 | −36.6 | 14.6 |

The mix's span *is* the music's span, to a tenth of a decibel. The bed the owner asked for in the
morning — the one that took a week to get breathing over 28 dB, gust-gated so the wood is only
heard when something moves in it — contributed none of its range to what he actually hears.

## Why: a 50-second block with a sine under it

Two faults, both inside `music.ts`.

**The pad never stopped.** `pad()` fired on every even bar for eight beats with a 1.1 s release,
and a bar is four beats — so each pad overlapped the next by more than a second. The result is a
73–110 Hz sine with no holes in it. Percentiles hide this once a sound has long rests (the 10th
percentile just lands inside a rest), so `levels.py --band 60 125` measures the holes instead:
everything within 20 dB of the band's own 95th percentile counts as sounding, and the runs are
reported in seconds.

| 60–125 Hz, 180 s of the walk | on | longest unbroken | longest hole |
| --- | ---: | ---: | ---: |
| the music alone, before | 48 % | **50.9 s** | 93.1 s |
| the music alone, after | 23 % | **9.1 s** | 100.1 s |
| the whole mix, before | 82 % | **51.0 s** | 0.4 s |
| the whole mix, after | 72 % | **11.5 s** | 0.6 s |

50.9 seconds is one entire pass. This is the same fault as the pod lanterns' 96 Hz hum that this
lane removed on the morning of the 23rd after the owner called the forest buzzy — a held low tone
under everything — and it survived that cut because it was written into the music rather than the
bed, and nobody measures the music for drone.

**The score had no dynamics.** Every note went out at one velocity. The only variation written into
the piece was `0.85 + 0.15 * Math.sin(beat * 0.7 + loop)`: ±1.4 dB, at a fixed rate, which is a
wobble rather than a phrase. A tune with no shape is the thing a wood cannot be heard under
whatever its level — and lowering it would only have made a flat quiet tune out of a flat loud one,
which is the trap the −3.2 dB trim fell into on the 23rd (it made the owner's job 8 worse and was
reverted).

## What changed

`PHRASE_LEVEL = [0.82, 0.55, 1, 0.7]` — the four 4-bar phrases are the statement, the answer under
it, the lift and the descent home, and they are now written at different levels. `phraseGain(beat)`
arches each one: up over its first two fifths, then down past the peak so a phrase **ends softer
than it began**. Across the melody's own beats that is 8.6 dB of written dynamics where there was
1.4, and bar to bar it runs −8.3 dB (the answer) to −0.5 (the lift).

`PHRASE_PAD_BEATS = [11, 0, 11, 7]` — one pad per phrase, stopping before the cadence, and none at
all under the answer. Through a pass the low end is now:

```
pad 0.0–9.8 s │ 15.5 s of nothing │ pad 25.3–35.0 │ 2.8 s │ pad 37.9–44.5 │ 6.0 s │ then the 16–30 s rest
```

The harp keeps time on two beats a bar under the answer instead of running eighths, and rests
completely in the last bar so the lead's final G finishes the piece on its own. The note-to-note
variation is a small seeded jitter now rather than a sine over the beat.

Nothing in `ambience.ts` or `footsteps.ts` was touched, and the bed stem renders **byte-identical**
before and after from the same seed — so every number below is the tune changing over a fixed
forest.

## Result: the wood is audible under the tune

180 s of the same walk, comparing the bed's and the music's 400 ms blocks over the 75 % of the take
where the tune is actually sounding (the rests were already this lane's answer and are not the
claim here):

| while the tune plays | before | after |
| --- | ---: | ---: |
| the wood is **louder** than the tune | 6.0 % | **13.7 %** |
| the wood is within 6 dB of it | 26.0 % | **39.4 %** |
| the wood is within 12 dB | 60.2 % | **69.7 %** |
| the wood sits under the tune (median) | 9.5 dB | **7.6 dB** |

| 180 s of the walk | before | after |
| --- | ---: | ---: |
| the music's span, p99 − p10 | 10.9 dB | **15.3 dB** |
| the mix's span | 9.3 dB | 10.4 dB |
| the music, integrated | −32.1 LUFS | −34.2 |
| the mix, integrated | −31.6 LUFS | −33.0 |
| 20–60 Hz, mean | −61.8 | **−74.6** |
| 60–125 Hz, mean | −36.9 | **−40.0** |

`shape-before-after.jpg` is the picture: the same short-term level trace, the same forest bed drawn
in grey under both. In the before column the 60–125 Hz panel is a plateau for fifty seconds; in the
after it falls into the bed twice inside one pass. In the top panel the mix now dips to −36 through
the answering phrase where it used to sit flat at −29.

## Still open: the master level, unchanged and deliberately so

The mix measures −33.0 LUFS with a true peak of −16.8 dBFS. Games normally run −18 to −23, so the
owner has to put his system roughly 12 dB hotter for this than for anything else on his desktop,
and there are 14 dB of headroom sitting unused.

Worth being precise about what raising it would and would not do: **a master gain changes no ratio
in the mix.** The owner sets his volume by ear, so every relative level he hears — the bed against
the tune, a footstep against a gust — is identical either way. It cannot bring back the white noise
he asked twice to lower, because that percept lives in a ratio. What it would buy is only that he
stops having to crank the system, which lowers his own hardware's noise floor under everything.

I have not done it, because level is the one axis he has twice asked to move the other way and this
is his call, not mine. `levels.py --gain-db 11` prints the whole table at any gain; +11 dB puts the
mix at −22 LUFS with peaks still under −6 dBFS.

## Reproduce

```bash
npm run build
node art/audio/2026-09-23-lane5/render-mix.mjs --dist dist --out /tmp/after --seconds 180 --stems mix,bed,music
python3 art/audio/2026-09-24-headroom/levels.py /tmp/after/{mix,music,bed}.wav --band 60 125
python3 art/audio/2026-09-24-headroom/shape.py --before /tmp/before --after /tmp/after \
    --out art/audio/2026-09-24-headroom/shape-before-after.jpg --seconds 120
```

`node --test src/audio/music.test.mjs` — 6 tests. Two are new and lock in what this fixed: that no
pad overlaps the next one's release, that the low end is off for more than a third of a pass with a
hole longer than the bed's own gusts, and that the melody is written across more than 8 dB with
every phrase peaking away from its edges and ending under its own start.
