# `public/audio/` — the music slot

The game's audio system (`src/audio/`) plays whatever it finds here as the background music,
looped, 12 dB under the forest ambience:

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
deploy. The console logs `[audio] music: file (… s loop)` or `[audio] music: original placeholder`.

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
