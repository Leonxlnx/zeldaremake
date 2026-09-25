# Lane 5 — the owner's own music would have set the game's mix

Branch `agent/squad5-music-file`, stacked on `agent/squad5-music-shape`.
Sheet: `file-before-after.jpg`. Listen: `clips/mix-{before,after}.mp3` (46 s of the same walk).

The owner's item 19 is "the actual Zelda music". That cannot ship — it is Nintendo's — so the game
has a **file slot**: drop `music.ogg` or `music.mp3` into `public/audio/` and it plays instead of
the placeholder. It is the one path in this lane nobody had ever exercised, and the owner is the
only person who will ever use it.

## What it did

Nothing between the fetch and the bus looked at the track. The decoded buffer went through a
`gain(ctx, 1)` into a bus trimmed a fixed 12 dB, so **whatever level the track was mastered at
became the game's mix**.

That is not a small difference. A finished track arrives mastered, and masters run −14 to −8 LUFS;
this forest sits at −40. Measured with an original track normalised to −10 LUFS (the placeholder's
own score, `loudnorm=I=-10`, so nothing copyrighted was used to test it), 120 s of the scripted
walk:

| | the placeholder | a dropped-in track |
| --- | ---: | ---: |
| the music stem, integrated | −34.2 LUFS | **−22.7** |
| over the forest bed | 5.6 dB | **17.7 dB** |
| the whole mix, integrated | −33.0 LUFS | **−22.6** |
| the whole mix, true peak | −16.8 dBFS | **−11.0** |

And what that does to the wood, per 400 ms block over the blocks where the track is sounding:

| while the track plays | before | after |
| --- | ---: | ---: |
| the forest is **louder** than the track | 0.9 % | **5.8 %** |
| within 6 dB of it | **2.0 %** | **31.7 %** |
| within 12 dB | 7.4 % | **65.8 %** |
| the forest sits under it (median) | 20.8 dB | **9.1 dB** |

Two per cent. Everything this lane has built — the gust-gated swell, the birds at a distance, the
leaf flutters, the surfaces under his boots, the gorge opening the bed — was inaudible the moment
the owner did the thing the slot exists for.

## The fix

The file is measured when it decodes and its gain set so the bus receives the level the
**placeholder** plays at, which is the level every balance on this lane was measured against.

`gatedRmsDb(buffer)` — mean power over 400 ms blocks, dropping every block more than 20 dB under
the take's own 95th percentile, so a quiet intro, a fade, or the gap between two movements does not
pull the answer down. That gate is the part of ITU-R BS.1770 that matters for this; leaving out the
K-weighting costs a decibel or two on music, which is well inside what a gain match needs and keeps
it one pass over the samples at load time. Checked against the Python BS.1770 reference in
`../2026-09-24-headroom/levels.py` on the same file: **−13.23 dBFS both ways**.

`MUSIC_BUS_TARGET_DB = −24.9` — the placeholder's own bus level. Its rendered stem measures −36.9
dBFS gated over the blocks where it is sounding, and the bus is 12 dB down (`graph.ts`).

`fileGain(rms)` clamps the match to −30 … +12 dB, so a silent or a clipped file cannot ask for an
absurd gain.

The console says what it did:

```
[audio] music: file (50.5 s loop, -13.2 dBFS gated, -11.7 dB to meet the placeholder)
```

## Result

The same track, the same walk, the same seed:

| with a dropped-in track | before | after | the placeholder, for reference |
| --- | ---: | ---: | ---: |
| the music stem, integrated | −22.7 LUFS | **−34.5** | −34.2 |
| over the forest bed | 17.7 dB | **5.9 dB** | 5.6 dB |
| the whole mix, integrated | −22.6 LUFS | **−32.6** | −33.0 |
| the whole mix, true peak | −11.0 dBFS | **−16.5** | −16.8 |
| the music stem, gated rms | −25.3 dBFS | **−36.9** | −36.9 |

The file lands within 0.3 dB of the placeholder on every measure. `file-before-after.jpg` draws
both takes on one scale with the (identical) forest bed under each: in the before column the bed
never reaches the track, in the after it repeatedly does.

## What the file still does not get

The placeholder **rests 16–30 s between passes** so the wood can be heard between them. A file
loops back to back with no gap. A finished track usually has its own shape and cutting it up is the
owner's call rather than this lane's, so it is written up in `public/audio/README.md` as a thing he
can ask for rather than done to his music unasked. `REST_SECONDS` already exists; wiring the file
to it is four lines.

## Reproduce

Nothing copyrighted is needed, and nothing is committed — `public/audio/music.*` is git-ignored.

```bash
# an original test track at a commercial mastering level: this game's own placeholder, normalised
node art/audio/2026-09-23-lane5/render-mix.mjs --dist dist --out /tmp/p --seconds 120 --stems music
ffmpeg -ss 0.3 -t 50.5 -i /tmp/p/music.wav -af loudnorm=I=-10:TP=-1.0:LRA=11 /tmp/track.wav
ffmpeg -i /tmp/track.wav -c:a libvorbis -q:a 6 public/audio/music.ogg

npm run build      # vite copies public/ into dist/, and the slot is looked up at build time
node art/audio/2026-09-23-lane5/render-mix.mjs --dist dist --out /tmp/after --seconds 120 --stems mix,bed,music
python3 art/audio/2026-09-24-headroom/levels.py /tmp/after/{mix,music,bed}.wav

rm public/audio/music.ogg && npm run build     # back to the placeholder
```

`node --test src/audio/music.test.mjs` — 8 tests, three of them new: that a track is measured while
it is sounding rather than averaged over its gaps, that a silent half does not move the answer,
and that tracks mastered anywhere from −8 to −30 dBFS all reach the bus at the same level.
