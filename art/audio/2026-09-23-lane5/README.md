# Lane 5 — sound, 2026-09-23

The owner, 06:50: **"the background sound is too buzzy"**, and straight after it **"the steps need to
be like…"**. This folder holds the evidence for both: the shipped mix rendered offline before and
after, the measurements, and the sheets in the PR.

## How to reproduce

```bash
npm run build
node art/audio/2026-09-23-lane5/render-mix.mjs --dist dist --out /tmp/audio-after --seconds 45
python3 art/audio/2026-09-23-lane5/spectra.py sheet  --before /tmp/audio-before --after /tmp/audio-after --stem bed --out bed-before-after.jpg --json bed.json
python3 art/audio/2026-09-23-lane5/spectra.py steps  --before /tmp/audio-before --after /tmp/audio-after --out steps-before-after.jpg --json steps.json
```

`render-mix.mjs` loads the world once (the pod lanterns' positions come from the real scene) and
calls `window.__ZR_AUDIO__.renderOffline(seconds, rate, { stem })`, which builds the same graph the
player hears in an `OfflineAudioContext`. Three stems so each part can be measured without the
other masking it:

| stem | what it is |
| --- | --- |
| `mix` | everything — ambience, footsteps, the music slot |
| `bed` | the ambience alone: wind, leaf flutter, birds, the pod lanterns |
| `steps` | the footsteps alone |

All three follow one scripted walk, `OFFLINE_WALK` in `src/audio/index.ts` — stand 3 s, then grass,
trodden earth, flagstones, a stair flight, deck planks, the log tunnel and the north forest floor at
a walk, a run on stone, stop (45 s). `spectra.py` labels each leg from the same table.

The BEFORE renders come from a worktree at the integration head with **only** the harness plumbing
applied (`src/audio/{ambience,footsteps,graph,music}.ts` byte-identical to `144453ef`), so the two
sides are the same journey through different sound.

## What the numbers mean

- **band levels** — RMS per octave-ish band in dBFS. The bands that carry "buzzy" are 60–125 Hz (a
  held tone) and 1–4 kHz (hiss).
- **strongest held tone** — for every FFT bin, its median level over the whole render against the
  median of its 21-bin neighbourhood; the largest excess, in dB. A sine held under a bed shows up
  here and nowhere else. This is the number for *drone*.
- **breathes** — the difference between the 90th and 10th percentile of the broadband envelope, over
  the whole render and over its last third (by then the walk is well away from the lanterns, so the
  tail figure is the wind bed on its own).
- per footstep: how many **separate transients** it holds, over how many **ms**, its **spectral
  centroid** and its **low/high** ratio (40–300 Hz against 2–10 kHz). A synthetic step is one burst
  with a high centroid and no low end; a real one is a heel, a roll and a toe with the weight low.

## No water

The owner's list said "leaves in wind, birds at a distance, maybe water". There is no water anywhere
in the world yet — no stream, pond or fall in `src/world/layout.ts` or any system — so a brook would
be a sound with no source. When one is built, the bed has the layer shape to hang it on
(`createAmbience` already places, filters and pans a distance-attenuated source for the lanterns).
