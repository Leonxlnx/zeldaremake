# Lane 5 — the score rests, so the forest can be heard

Branch `agent/squad5-music-rests`, off `81430baf`. A draft PR cannot be opened from this agent (its
token is not a collaborator on the repository), so this file is the report.

## Why

Nothing new from the owner about sound since 20:08, so this is the next item on the lane's standing
list — and it is one my own last change created. Once the wind bed became a gust-gated swell
(`71e3b247`), the forest measured **15–16 dB under the music** and the music never stopped: the
placeholder loop ran back to back for ever at one level, playing **100 % of a 120 s render with a
longest gap of 0.1 s**. So between gusts, the wood the owner is walking around in could not be heard
at all under a 50 s tune on repeat. That is also the most tiring thing in a world you are asked to
walk around for a long time.

The demo's own forest does not work that way: the theme comes and goes over the wind and the birds.

## What changed

**The placeholder rests.** After each pass it stops for a seeded 16–30 s and lets the wood be heard;
the pad and the last note ring out into the rest, so the piece ends rather than being cut off. Over
a long session the tune plays about 69 % of the time.

**Passes vary.** The first is always the full arrangement; after that about 45 % drop the pad and
half the harp and take the lead down, so the loop does not return identical every time.

**−3.2 dB on the placeholder bus.** The forest sat 15–16 dB under it; now 13.6 dB, and during a rest
it is the only thing playing.

**The wood is never left with nothing in it for more than 2.2 s** (`QUIET_GAP_MAX`). With the bed
gated below the gust knee *and* the tune resting, the mix fell to −72 dBFS for five seconds at a
stretch — which reads as the audio having broken rather than as a quiet forest. The answer is a leaf
turning over, not a floor put back under everything: the leaf-flutter scheduler's gap is capped, so
in dead calm something still happens every couple of seconds. The mix's longest hole went 5.3 s →
4.2 s (cap 3.2) → **3.1 s** (cap 2.2), and the bed's own deepest lull from 3.8 s to 2.4 s.

## Result

120 s of the same walk, the merged head against this branch:

| | before | after |
| --- | ---: | ---: |
| the tune plays | 99 % of the time | **82 %** (≈ 69 % over a long session) |
| its longest rest | 0.8 s | **19.4 s** |
| the whole mix plays | 100 % | 96 % |
| the mix breathes | 6.4 dB | **17.5 dB** |
| mix RMS | −32.8 | −37.9 |
| the forest under the tune while it plays | 16.2 dB | 13.6 dB |
| the mix during a rest | — | −48 dBFS, and it is the forest |

`mix-rests.jpg` is the picture: before is a flat block for two solid minutes, after is a pass, a
rest with the wood alone in it, then the next pass voiced down. `music-rests.jpg` is the same for
the music stem alone. `clips/` has 40 s across the rest to listen to.

The bed's own lulls over 120 s: below −65 dBFS, 30 of them, longest 2.4 s, 11 s in total — the
forest goes still between gusts and then a leaf moves.

## Tests

`src/audio/music.test.mjs` is new: the rests fall inside `REST_SECONDS`, the duty cycle lands
between 55 and 78 %, the first pass is never the voiced-down one, the voicing share is what
`QUIET_PASS_SHARE` says, the schedule is a pure function of its seed, and — since this is the file
that most invites it — the melody table is asserted to stay inside G major pentatonic with the
provenance note intact. Nothing of Nintendo's ships.

## Reproduce

```bash
npm run build
node art/audio/2026-09-23-lane5/render-mix.mjs --dist dist --out /tmp/after --seconds 120 --stems mix,music,bed
python3 art/audio/2026-09-23-lane5/spectra.py levels --before /tmp/before --after /tmp/after --stem mix --out mix-rests.jpg
node --test src/audio/footsteps.test.mjs src/audio/music.test.mjs
```

`spectra.py` gained a `levels` command (level over time on one scale — the picture for a score that
rests) and two metrics used throughout this report: `duty_pct` and `longest_quiet_s`.
