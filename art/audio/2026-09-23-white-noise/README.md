# Lane 5 — "LOWER THE WHITE NOISE" (owner 20:08)

Branch `agent/squad5-white-noise`, off `6d145e90`. A draft PR could not be opened from this agent
(its token is not a collaborator on the repository), so this file is the report.

The morning's cut (`b99166cd`) took the wind bed down 11–12 dB. Before cutting it again I decomposed
the head's mix into stems and asked a different question: **not what is loudest, but what never
stops.** For every FFT bin, the level present in nine frames out of ten:

| always-on (10th percentile over time) | 1–2 kHz | 2–6 kHz |
| --- | ---: | ---: |
| whole mix | −70.5 | −78.5 |
| the wind bed alone | **−73.3** | **−81.1** |
| the music alone | −93.6 | −96.3 |
| the footsteps alone | −140 | −140 |

The music is 15 dB louder than the bed on average and is **not** the thing that never stops — it has
gaps. The bed was the entire floor of the mix, and a sound that never stops is the one a listener
ends up calling white noise however quiet it is. Another level cut would have made the forest
disappear without removing the percept.

## What changed

**The wind bed is a swell now, not a floor.** `ambience.ts` gets `GUST_KNEE = 0.22` and
`swell(gust)`: below the knee the canopy roll and the leaf hush are *silent*, not faint. Above it the
swell is bigger than the old constant bed, so a gust is actually wind. The floors are −70 dBFS
(canopy) and −82 (hush) — placeholders, not a bed.

**The canopy's irregular envelope was its own always-on floor.** `rides(canopyGain.gain, …, 0.03)`
added up to 0.03 of gain whatever the wind was doing — as much again as the whole gust term
(`CANOPY_GUST` was 0.032). It is now gated by the swell like the hush's already was. This single line
was most of the bed's floor.

**The hall returns nothing above 3 kHz.** The impulse is generated from noise, so its early part
handed a little broadband hiss back to everything using it — the music most of all, which sends 0.55
of a continuous bus. Trunks scatter and leaves absorb; a wood has no bright reflections.

Leaf flutters went back up (0.0028–0.009 → 0.004–0.013): they are *events*, not a bed, and they are
what carries the wood between gusts.

## Result

30 s of the same walk, head against this branch:

| the bed alone | before | after |
| --- | ---: | ---: |
| never stops, 1–2 kHz | −73.3 | **−87.2** |
| never stops, 2–4 kHz | −81.4 | **−96.6** |
| never stops, 4–8 kHz | −93.1 | −105.5 |
| never stops, 500–1000 Hz | −65.7 | −78.2 |
| mean RMS | −48.6 | −47.9 |
| how much it breathes | 13.0 dB | **22.7 dB** |

| the whole mix | before | after |
| --- | ---: | ---: |
| never stops, 1–2 kHz | −70.5 | −78.0 |
| never stops, 2–4 kHz | −78.8 | −84.8 |
| never stops, 4–8 kHz | −91.0 | −98.7 |
| mean RMS | −32.88 | −32.85 |

The continuous part of the forest is 12–15 dB quieter and the average level is unchanged: the wood
is as present as it was, but only when something is happening in it.

`bed-before-after.jpg` shows it — the before is a wall, the after is two swells with clear air
between them and only leaf flutters and birds in the gaps. `clips/` has 28 s of each to listen to.

## Two things the world did not answer

**Link now lands with a sound.** Coming down off the ledge, the stair flight or a jump was silent.
`designLanding` folds the toe into the heel (both boots arrive together), adds a body an octave
under the step's own that rings two and a half times longer, and settles the belt and straps after
it; how hard it lands follows the drop (`landingStrength`, driven by the jump arc's highest point
through `PlayerHandle.airHeight`). Play-mode probe: **5 landings over 7 s of jumping, 0 on any of
the six walking routes** — it never fires on a stride.

**The log tunnel closes over the forest.** Walking through the arch used to change nothing except
what was under the boots. The whole bed — wind, leaves, birds, the lanterns — now passes through one
filter that shuts from 18 kHz to 900 Hz and ducks to 45 % as the wood closes over the listener
(`surfaceAt` returns a smooth `enclosure`, 0 at the mouth and 1 a metre and a half in). Walking the
north path through the bore, the probe records the boots going `stone` → `hollow` at the same time
as the enclosure ramps and releases with no step in it:

```
0 0 0 0 0 0 0 0 0 0 0 0.1 0.41 0.72 1 1 1 … 1 1 0.94 0.63 0.32 0.01 0 0 0 0
```

## Reproduce

```bash
npm run build
node art/audio/2026-09-23-lane5/render-mix.mjs --dist dist --out /tmp/after-stems --seconds 30 --stems mix,bed,music
python3 art/audio/2026-09-23-lane5/spectra.py sheet --before /tmp/head-stems --after /tmp/after-stems --stem bed --out bed-before-after.jpg
node --test src/audio/footsteps.test.mjs
```

`renderOffline` gained a `music` stem and a `reverb: false` option this round, so the hall's own
contribution and the music's can each be measured on their own (`--stems mix-dry,music,music-dry`).
