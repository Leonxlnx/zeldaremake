# Kokiri Forest cinematic — soundtrack (opus-cinematic-sept24)

Final mix: **mix-30s-48k.wav** — 40.000 s, 1,920,000 frames, 48 kHz stereo PCM 24-bit.
Measured (ffmpeg ebur128): **I -14.2 LUFS**, **LRA 9.5 LU**, **true peak -1.8 dBTP**. loudnorm pass 2 ran in `linear` mode.
Both ends are digital silence (de-click fade-in 0.05 s, fade-out 37.5–40 s). Mastering chain is time-aligned (lag 0 samples).
**Mux the WAV with no volume change** (e.g. `-map <n>:a -c:a aac -b:a 256k -ar 48000`); AAC may add ~0.5 dB of true peak, which the -1.5 dBTP target leaves room for.

## Stems (`stems/`, 48 kHz stereo 24-bit, raw render level, unfaded)
| stem | contents | peak |
|---|---|---|
| bed.wav | game wind bed (canopy roll + leaf hush, designed gust) + new high-canopy air, canopy body, near-leaf shimmer, deep room tone, far air, gust-coupled leaf-rustle grains | -17.86 dBFS |
| birds.wav | placed species calls + seeded far chorus in an original forest reverb | -14.32 dBFS |
| detail.wav | pod-lantern flame (breath, husk, crackle/pops) on the lantern shot; macro leaf ticks | -18.42 dBFS |
| steps.wav | game footstep voices (stone walk/run, stair slab + log riser) at the step times + cloth/gear foley on run/stairs | -14.74 dBFS |
| music.wav | "Under the Boughs" (repo original score) trimmed so phrase B's high G lands at 24.4 s, gain/low-pass rise + original harp glissando, swell, low bloom | -8.34 dBFS |

Mix gains (dB, `cues.json` `mixDb`): bed 0, birds 0, detail 0, steps 0, music 0; makeup 13.328 dB; limiter ceiling -2.3 dBFS.

## Loudness per section (final mix, LUFS)
M = momentary (400 ms), S = short-term (3 s, so short sections include the previous shot).

| section | edit s | M mean | M max | S max |
|---|---|---|---|---|
| hero | 0.00–7.00 | -17.4 | -15.2 | -16.7 |
| lantern | 7.00–8.50 | -8.1 | -7.1 | -11.2 |
| macro | 8.50–10.00 | -10.7 | -5.7 | -9.1 |
| canopy | 10.00–17.00 | -16 | -13.9 | -9.4 |
| walk | 17.00–24.40 | -16.1 | -8.2 | -14.5 |
| run | 24.40–29.00 | -11.7 | -8.2 | -9.3 |
| stairs | 29.00–36.00 | -19 | -17.3 | -14.8 |
| reveal | 36.00–40.00 | -12.7 | -8.3 | -11.6 |

## Re-render
From `art/environment/opus-cinematic-sept24/audio` (Node 22, this checkout's node_modules, Chrome at C:/Program Files/Google/Chrome, ffmpeg 8 on PATH):

```
node render-audio.mjs                                   # placeholder steps, cues.json
node render-audio.mjs --steps <capture-log.json>        # real contacts (rising edge of stance per foot)
node render-audio.mjs --cues <locked-cues.json> --steps <capture-log.json>
node finish-audio.mjs [--cues <same cues file>]         # mix + master + verify + provenance + README
node finish-audio.mjs --analyze-stems                   # per-section loudness of the raw stems
```

Step log: a JSON array (or `{rows|samples|ticks|frames:[...]}`) of 60 Hz rows. Time per row from `editTime`/`edit`/`t`/`time`, else `tick`/`frame` ÷ `--log-fps` (60) + `--log-start`. Feet from `feet` / `linkFeetContact` / `feetContact` (`[{foot:'L'|'R', stance}]`) or `stance: [bool,bool]`; gait from `gait`/`linkGait` (walk/run/idle; the stairs section forces stair steps); optional `surface` per row or foot. The first tick of the log and of each new `shot` only arms the detector; edges closer than 0.16 s are dropped. The resolved list is written to `steps-resolved.json`.

Cue file: `sections` (hero, lantern, macro, canopy, walk, run, stairs, reveal) in edit seconds; every gust swell, bird placement, lantern window, tick cluster, music rise and the hit (`musicHit`, default the reveal start) follows them. `levels` and `mixDb` hold the balance; `master` the loudness targets.

## Provenance and policy
All sound is original synthesis in code: no recordings, samples, downloads or voices. The game modules `src/audio/{graph,ambience,footsteps,music}.ts` and `src/world/util/prng.ts` are transpiled unchanged (sha256 in provenance.json; finish-audio re-checks them). New synthesis lives in `synth/cine.js`. Seeds, cue/step-log hashes, stem hashes, per-stem and per-section loudness are in provenance.json; bird placements in birds-calls.json. Spectrograms: `analysis/`.
