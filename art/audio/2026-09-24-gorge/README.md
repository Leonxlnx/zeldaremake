# The ravine opens the space

Branch `agent/squad5-gorge`, off `b306d6a9`.

Everything the lane had is merged and there is nothing new from the owner about sound, so this
completes a set. The bed had two terms for where the listener is standing and **both of them close
it**: the log tunnel's bore (`enclosure`, wood over you) and the crowns overhead (`canopy`). There
was nothing that opens it. The world now has an 8.8 m gorge with a rope bridge across it, and
walking out over that sounded exactly like standing in the village.

`gorgeAt(x, z)` reads `EXPANSION_SOUTH.ravine.line` — (x, z, top half width, depth) west → east —
and returns how much of the space around the listener is the cut: full out over it, gone a little
past twice its width, and scaled by how deep the gorge is there so the shallow ends where it closes
to nothing do not open the sound.

Over the gorge, more of the forest comes back as reflection (`GORGE_HALL`, on both the canopy roll's
and the leaf hush's sends) and the wind funnels along it (`GORGE_WIND`, on the roll only — there are
no leaves out over the cut).

## Walked

`walk-audio.json`, the two south routes. Going out onto the bridge it rises and holds; walking off
the far end into the log it falls away:

| route | gorge |
| --- | --- |
| across the rope bridge | `0.57 0.58 0.62 0.65 0.69 0.72 0.75 0.78 0.81 0.84 0.86 0.89 0.91 0.93 0.95 0.96 0.98 0.99 1 1 1 1` |
| into the far hollow log | `0.78 0.77 0.74 0.71 0.68 0.65 0.62 0.59 0.55 0.52 0.49 0.45 0.42 0.39 0.36 0.33 0.30 0.27 0.24 0.21 0.18 0.16` |

No step in either, and every other route reads 0.

## Measured

Forced A/B over the same 40 s (`--stems bed-flat,bed-gorge`), since the offline walk's listener path
never goes near the ravine:

| band | back from it | out over it | |
| --- | ---: | ---: | --- |
| 60–125 Hz | −52.3 | −49.2 | +3.1 |
| 125–250 Hz | −50.3 | −47.3 | +3.0 |
| 250–500 Hz | −46.4 | −44.3 | +2.1 |
| 500–1000 Hz | −50.3 | −46.6 | **+3.7** |
| 1–2 kHz | −54.9 | −52.9 | +2.1 |
| 2–4 kHz | −51.0 | −50.9 | +0.1 |
| RMS | −46.7 | −44.4 | **+2.3** |

`clips/flat.mp3` and `clips/gorge.mp3` are the same 14 s either side of it.

## One term measured and deleted

The first version had a third term: the bed's filter opening past its usual sky over the gorge, on
the reasoning that rock returns the high end leaves absorb. Measured, it moved 4–8 kHz by **+0.3 dB**
and 8–16 kHz by **−0.1** — because this bed has almost nothing up there to return. It is gone rather
than kept as a plausible-sounding no-op, and the ambience test now asserts the opposite: the gorge is
open air, not a lid, and must not touch the bed's top.

The first tuning (`GORGE_HALL` 1.4, `GORGE_WIND` 0.35) gave +1.2 dB across the bed, which did not
read as anywhere in particular; 2.0 / 0.7 gives +2.3 dB and a clear low-mid lift.

## Reproduce

```bash
npm run build
node art/audio/2026-09-23-lane5/render-mix.mjs --dist dist --out /tmp/ab --seconds 40 --stems bed-flat,bed-gorge
node art/audio/2026-09-23-lane5/walk-audio.mjs --dist dist
node --test src/audio/ambience.test.mjs src/audio/footsteps.test.mjs src/audio/music.test.mjs
```
