# Kokiri Forest cinematic — soundtrack (opus-cinematic-b-sept25)

Final mix: **mix-36s-48k.wav** — 36.000 s, 1,728,000 frames, 48 kHz stereo PCM 24-bit.
Measured (ffmpeg ebur128): **I -14.1 LUFS**, **LRA 9.4 LU**, **true peak -2.1 dBTP**. loudnorm pass 2 ran in `linear` mode.
Both ends are digital silence (de-click fade-in 0.05 s, fade-out 33.5–36 s). Mastering chain is time-aligned (lag 0 samples).
**Mux the WAV with no volume change** (e.g. `-map <n>:a -c:a aac -b:a 256k -ar 48000`); AAC may add ~0.5 dB of true peak, which the -1.5 dBTP target leaves room for.

## Stems (`stems/`, 48 kHz stereo 24-bit, raw render level, unfaded)
| stem | contents | peak |
|---|---|---|
| bed.wav | game wind bed (canopy roll + leaf hush, designed gust) + new high-canopy air, canopy body, near-leaf shimmer, deep room tone, far air, gust-coupled leaf-rustle grains | -17.63 dBFS |
| birds.wav | placed species calls + seeded far chorus in an original forest reverb | -21.79 dBFS |
| detail.wav | pod-lantern flame (breath, husk, crackle/pops) on the lantern shot; macro leaf ticks; 2 distant timber creaks in the hamlet | -20.06 dBFS |
| steps.wav | game footstep voices (stone walk/run, stair slab + log riser) at 40 step times (6 recorder log(s)) + cloth/gear foley on run/stairs; per-section gain after the game's sfx compressor | -19.88 dBFS |
| music.wav | "Under the Boughs" (repo original score, procedural, tryFiles=false) started so phrase B's high G lands at 28.8 s (its first note at 3.53684 s, silent until the canopy shot), gain/low-pass rise + original harp glissando (28.011–28.8 s), swell (26.2–28.8 s), low D3/D4 bloom | -13 dBFS |

Mix gains (dB, `cues.json` `mixDb`): bed 0, birds 0, detail 0, steps 4, music 0; makeup 14.525 dB; limiter ceiling -2.3 dBFS. Clipped samples per stem at render: bed 0, birds 0, detail 0, steps 0, music 0.

## Loudness per section (final mix, LUFS)
M = momentary (400 ms), S = short-term (3 s, so short sections include the previous shot).

| section | edit s | M mean | M max | S max |
|---|---|---|---|---|
| hero | 0.00–4.50 | -17.1 | -14.6 | -16.5 |
| lantern | 4.50–5.90 | -16.6 | -16.2 | -18 |
| macro | 5.90–8.20 | -24.5 | -18.9 | -17.9 |
| canopy | 8.20–11.20 | -14.9 | -13.1 | -15.3 |
| walk | 11.20–17.00 | -16.7 | -12.9 | -14.4 |
| run | 17.00–21.20 | -15.5 | -12 | -15.2 |
| stairs | 21.20–25.20 | -16.3 | -15.1 | -15.4 |
| hamlet | 25.20–28.80 | -15 | -9.7 | -14.3 |
| reveal | 28.80–36.00 | -10.4 | -8.2 | -9 |

## Re-render
From `art/environment/opus-cinematic-b-sept25/audio` (Node 22, this checkout's node_modules, Chrome at C:/Program Files/Google/Chrome, ffmpeg 8 on PATH):

Final render against a recorded take (the recorder's `gauntlet/out/opus-cinematic-b-sept25/<take>/` holds one `steps-<shot>.json` per player shot):

```
node render-audio.mjs --cues cues.json --steps-dir <take dir> && node finish-audio.mjs --cues cues.json
```

Other forms:

```
node render-audio.mjs                                   # placeholder steps (cues.json placeholderSteps)
node render-audio.mjs --steps a.json,b.json             # explicit step logs (combinable with --steps-dir)
node render-audio.mjs --steps-dir <take dir> --steps-only   # parse + print the steps only (analysis/steps-parse-check.json)
node finish-audio.mjs [--cues <same cues file>]         # mix + master + verify + provenance + README
node finish-audio.mjs --analyze-stems                   # per-section loudness of the raw stems
```

Step logs (record.mjs): `{shot, fps, simHz, shotStartEdit, events, rows:[{edit, rec, k, gait, stance:[bool,bool], feet:['L','R'], pos:[x,z], speed, …}]}`; `edit` is seconds in the final cut. A step is the rising edge of a foot's `stance` inside the recorded rows; rows with `rec: false` (preroll and skip ticks) never sound, and the first recorded row of each shot only arms the detector (`steps.armFromPreroll: true` primes it from the last preroll tick instead, which also counts a boot landing on the shot's first frame — the recorder's own `events` list does that; the render prints both counts). Edges closer than 0.16 s are dropped. Gait: the row's (idle/walk/run/stairs) wins; `steps.sectionGait` is the fallback. Surface: `steps.surfaceOverride[section]` > a surface in the log > `steps.surface[section]` > stone, then the game's rule (stone + stairs gait → `stair`); names are validated against footsteps.ts (aliases: stairs→stair, earth→dirt, litter→leaf, plank/deck→wood, log→hollow …) so nothing silently becomes the hollow-log voice. Each logged step is also checked against the world (`src/audio/index.ts` surfaceAt at its `pos`, read-only; `--no-map-check` skips it; `steps.surfaceFrom: "map"` uses it). Old capture-log shapes (`feet:[{foot, stance}]`, `linkFeetContact`) still parse. The resolved list is written to `steps-resolved.json`.

Cue file: `sections` in edit seconds (required: hero, lantern, macro, canopy, walk, run, stairs, reveal; optional: hamlet). Every gust swell, canopy term, bird placement, chorus/rustle density, lantern window, tick cluster, hamlet creak, music rise and the hit (`musicHit`, default the reveal start) is a per-section table in synth/cine.js, so retiming after picture lock is an edit of `cues.json` only (`sections`, `musicHit`, `fadeOut`); `curves` overrides any section's table, `music` the score's rise, `levels` / `mixDb` the balance, `master` the loudness targets. The score's timing is read from music.ts itself (beat, phrase B, first-note lead-in), so the hit may sit anywhere: a late hit just starts the score later.

## Provenance and policy
All sound is original synthesis in code: no recordings, samples, downloads or voices. The game modules `src/audio/{graph,ambience,footsteps,music}.ts` and `src/world/util/prng.ts` are transpiled unchanged (sha256 in provenance.json; finish-audio re-checks them). New synthesis lives in `synth/cine.js`. Seeds, cue/step-log hashes, stem hashes, per-stem and per-section loudness are in provenance.json; bird placements in birds-calls.json. Spectrograms: `analysis/`.
