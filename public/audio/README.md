# `public/audio/` — the music slot

The game's audio system (`src/audio/`) plays whatever it finds here as the background music,
looped, at the same level as the placeholder:

| file | what happens |
| --- | --- |
| `music.ogg` | loaded and looped (checked first) |
| `music.mp3` | loaded and looped if there is no `.ogg` |
| *(nothing)* | an **original** placeholder plays: "Under the Boughs", a 16-bar G-pentatonic woodwind-and-harp loop synthesised in WebAudio (`src/audio/music.ts`) |

## Dropping in your own track (local demo)

1. Copy any `.ogg` or `.mp3` to `public/audio/music.ogg` (or `music.mp3`).
2. Run `npm run dev` (or `npm run build` — Vite copies `public/` into `dist/audio/`). The file is
   looked up when the dev server starts or the build runs (`vite.config.ts`), so restart
   `npm run dev` after adding or removing it; without a file the page requests nothing.
3. Click or press a key once in the page: audio starts on the first gesture (browser autoplay
   rules). The speaker glyph under the hearts shows the state; **M** or clicking it mutes.

The file is fetched relative to the page (`audio/music.ogg`), so it also works from a sub-path
deploy. The console logs `[audio] music: original placeholder`, or for a file:

```
[audio] music: file (50.5 s loop, -13.2 dBFS gated, -11.7 dB to meet the placeholder)
```

## Your track's own volume is ignored, on purpose

A finished track arrives mastered, and masters run −14 to −8 LUFS — thirty-odd decibels over a
forest that sits at −40. Before this was handled, a track normalised to −10 LUFS dropped in here
played 17.7 dB over the wind and the birds (the placeholder sits 5.6 over) and took the whole mix
from −33 to −22.6 LUFS: the forest was inaudible, and nothing in the game had chosen that.

So the file is measured when it decodes — mean power over 400 ms blocks, with everything more than
20 dB under its own 95th percentile dropped so an intro or a fade does not pull the answer down —
and its gain set to reach the bus at the level the placeholder plays at (`MUSIC_BUS_TARGET_DB` in
`src/audio/music.ts`). **Normalise your file however you like; the game will match it either way.**
The match is limited to −30 … +12 dB so a silent or a clipped file cannot ask for an absurd gain.

If you want it louder or quieter than the placeholder, change `MUSIC_BUS_TARGET_DB` — it is one
number, and it moves the placeholder and the file together.

## One thing the file does not get

The placeholder **rests 16–30 s between passes** (`REST_SECONDS`) so the wood can be heard between
them. A file loops back to back with no gap, because a finished track usually has its own shape and
cutting it up is the owner's call rather than the sound lane's. Say the word and it can take the
same rests.

## What must not go here

This directory is committed **empty** apart from this file, and `music.*` is git-ignored. The
owner asked for "the actual Zelda music"; that is Nintendo's copyright and AGENTS.md allows
original or CC0 assets only, so no Nintendo recording, MIDI or arrangement may be committed, and
the placeholder is deliberately not the Kokiri Forest theme or any other Nintendo melody. Keep any
copyrighted track on your machine only.

## Everything else is synthesised

Wind, leaf rustle, the four bird calls, the pod-lantern hum and the stone / grass footsteps are
generated at runtime from seeded noise and oscillators (`src/audio/ambience.ts`,
`src/audio/footsteps.ts`) — there are no sample files to credit.
