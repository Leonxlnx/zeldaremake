# Lane 5 — sound, 2026-09-23

The owner, 06:50: **"the background sound is too buzzy"**, and straight after it **"the steps need to
be like…"**. This folder is lane 5's report (a draft PR could not be opened from this agent — the
token is not a collaborator on the repository — so the report lives here, on the branch
`agent/squad5-forest-sound`, and the branch is pushed).

Sheets: `bed-before-after.jpg`, `steps-before-after.jpg`, `mix-before-after.jpg`.
Listen: `clips/{bed,steps,mix}-{before,after}.mp3`.
Numbers: `bed.json`, `steps.json`, `mix.json`.

---

## 1. What was buzzy, measured

The offline bed rendered from the integration head (`144453ef`), 45 s of the scripted walk:

| | before | after | |
| --- | ---: | ---: | --- |
| 60–125 Hz | **−36.5** | −46.7 | the loudest band in the whole forest was the lantern hum |
| 1–2 kHz | **−38.4** | −46.1 | the hiss |
| 2–4 kHz | −46.1 | −47.7 | |
| 8–16 kHz | −61.5 | −68.2 | |
| strongest held tone | **+4.4 dB at 86 Hz** | +0.7 dB at 1830 Hz | a sine under the bed; now nothing stands over its neighbourhood |
| whole bed, RMS | −36.4 | −41.7 | |

**The hum was the drone.** `ambience.ts` attenuated the pod lanterns by distance and then *summed*
every pod's attenuation, `min(1, sum)`. The play-mode probe counts **39 pod lanterns** in the scene
(`__ZR_AUDIO__.stats()`), on houses, posts and boughs, so anywhere in the village that sum saturated
and a 96 Hz + 192 Hz sine pair sat at the top of the mix permanently.

The other four sources of "buzz", all gone:

- white noise through a `Q 0.5` band at 420 Hz — a paper-like mid;
- a `Q 9` resonance at 1750 Hz inside the lantern voice — a whistle;
- six sine LFOs modulating gains and filter cutoffs at fixed rates — a wobble the ear locks onto;
- a continuous 1.4–3.8 kHz hush that was there whether or not the air was moving.

## 2. What the bed is now

- **Pink noise** (`graph.ts pinkNoiseBuffer`, −3 dB/octave, loop seam crossfaded), not white through
  one filter.
- **Two wind layers**: a far canopy roll (62–620 Hz, half of it into the hall) and a near leaf hush
  (0.9–4.2 kHz) whose level is mostly `gust^1.6`. The world's gust (`wind.ts`) has a median of 0.50
  and a 10th percentile of 0.17, so between gusts the hush is effectively silent and the wood is
  quiet.
- **No sine LFO anywhere.** Every continuous level rides a seeded irregular envelope
  (`controlNoiseBuffer`, a smoothed random walk stored at 120 Hz and resampled by the buffer source).
- **Discrete leaf flutters** scheduled like the birds — short shaped grains, in clusters during a
  gust — so the top of the bed reads as leaves rather than a band of noise.
- **Birds mostly far**: each call is low-passed and sent to the hall by its distance (0 overhead,
  1 deep in the wood), the gaps run 3.5–11.5 s, and two quiet distant voices join the four near ones
  (a dove's coo, a woodpecker's drum).
- **The lanterns are a flame**: low-passed pink noise fluttering on an irregular envelope with a
  `Q 5` husk resonance — no oscillator in it at all — and the **nearest** pod sets the level (the
  rest of the village adds a fifth each), so walking through the village is no longer walking
  through a tone.
- The hall went from 2.6 s / damp 0.9 to **1.5 s / damp 0.96**: a wood is short and dark, and every
  footstep used to grow an indoor tail.

## 3. The steps

`designStep` (`footsteps.ts`) builds a step as plain data — heel, roll, the surface's own grains,
toe — and `footsteps.test.mjs` asserts the shape, the balance and the cadence without WebAudio.
Measured on the offline steps stem (means over each leg of the scripted walk):

| leg | steps / 5 s | peak dBFS | centroid Hz | low/high |
| --- | --- | --- | --- | --- |
| grass | 11 → 10 | −31.7 → −28.2 | 1826 → 1449 | 0.44 → 2.19 |
| dirt | 11 → 9 | −29.0 → −27.1 | 2077 → 1131 | 0.29 → 6.21 |
| stone | 11 → 9 | −26.2 → −25.0 | 2927 → 1004 | 0.24 → 6.05 |
| stairs | 12 → 10 | −27.6 → −26.6 | 4251 → 928 | 0.09 → 6.90 |
| wood | 8 → 7 | −30.7 → −29.4 | 4453 → 446 | 0.05 → 47.5 |
| hollow (log) | 9 → 12 | −28.2 → −31.9 | 4177 → 839 | 0.12 → 48.3 |
| leaves | 11 → 9 | −41.6 → −34.8 | 3979 → 4609 | 0.07 → 0.72 |
| run on stone | **22 → 13** | −22.2 → −27.4 | 2972 → 2466 | 0.81 → 2.64 |

- **Low body.** Every surface but leaf litter drops its spectral centroid by a factor of two to ten
  and multiplies its 40–300 Hz against 2–10 kHz ratio by five to four hundred. Leaf litter stays
  bright on purpose: it is crinkle.
- **Levels.** Loudest leg against quietest: 19.4 dB before, 9.8 dB after; A-weighted over the design
  the seven surfaces sit inside 6 dB (asserted in the test).
- **The run was a drum roll.** 4.4 steps a second; a runner's cadence is 2.9.
- **A stair tread** now knocks on its log riser (`hardscape/logNosings.ts` puts round timbers on the
  risers) over the slab's tock, and the **north forest floor** is leaf litter, not lawn — the
  terrain's own `forestFloorZone(x, z)` decides.

### A step now fires when a boot plants

The character system publishes the gait's stance flags (`PlayerHandle.feetContact`). `drive()` fires
on a swing→stance edge and the distance-integrated stride stands down while that is happening. In
play mode (`walk-audio.mjs`, six routes, `walk-audio.json`) **126 of 128 steps landed on a boot
plant** — the two exceptions are a route's first step, before any edge has been seen — and the
per-foot plant counts add up exactly to the steps heard:

| route | steps | on a boot plant | plants per boot | heard as |
| --- | --- | --- | --- | --- |
| plaza north over the flagstones | 23 | 22 | 11 + 11 | stone |
| the north path | 25 | 25 | 13 + 12 | stone |
| off the path, the north forest floor | 21 | 21 | 10 + 11 | **leaf** |
| the lawn west of the spine | 22 | 22 | 11 + 11 | grass |
| up the main flight | 7 | 7 | 4 + 3 | 1 stone, 6 **stair** |
| running the plaza | 30 | 29 | 14 + 15 | stone |

That exposed something for **lane 8**, not for me to fix: sampled at 60 Hz while walking forward, the
gait is clean and alternating (about 18 frames of stance, 17 of swing, no flicker, no overlap), but
it plants **3.4 boots a second at 1.58 m/s** — a step length of 0.46 m — and **4.8 a second at
4.41 m/s** (0.91 m). A person walking 1.58 m/s takes 0.79 m steps at 2.0 a second. The steps now
follow the boots exactly, so if the cadence reads hurried it is the animation's, not the audio's.
The old stride timer was firing 2.3 times a second at that speed, so the sound and the legs were out
of step by a factor of 1.5.

## 4. A gate that never closed

An exponential ramp cannot reach zero, so `adEnvelope` left every gate at its `0.0005` floor — and
each of those gates is a tap on one shared looping noise source, held open for ever. Live the voice
cleanup timer bounded it; in a long offline render it accumulated, and a 45 s steps stem had lifted
its own noise floor by about 15 dB by the end. `adEnvelope` now closes to zero, and so does music's
breath gate.

## 5. How to reproduce

```bash
npm run build
node art/audio/2026-09-23-lane5/render-mix.mjs --dist dist --out /tmp/audio-after --seconds 45
python3 art/audio/2026-09-23-lane5/spectra.py sheet --before /tmp/audio-before --after /tmp/audio-after --stem bed --out bed-before-after.jpg --json bed.json
python3 art/audio/2026-09-23-lane5/spectra.py steps --before /tmp/audio-before --after /tmp/audio-after --out steps-before-after.jpg --json steps.json
node art/audio/2026-09-23-lane5/walk-audio.mjs --dist dist --out /tmp/walk-audio.json
node --test src/audio/footsteps.test.mjs
```

`render-mix.mjs` loads the world once (the pod positions come from the real scene) and calls
`window.__ZR_AUDIO__.renderOffline(seconds, rate, { stem })`, which builds the same graph the player
hears in an `OfflineAudioContext`. Three stems so each part can be measured without the other
masking it: `mix` (everything, music included), `bed` (the ambience alone), `steps` (the footsteps
alone). All three follow `OFFLINE_WALK` in `src/audio/index.ts` — stand, then grass, trodden earth,
flagstones, a stair flight, deck planks, the log tunnel and the north forest floor at a walk, a run
on stone, stop (45 s) — and `spectra.py` labels each leg from the same table.

The BEFORE renders come from a worktree at the integration head with **only** the harness plumbing
applied (`src/audio/{ambience,footsteps,graph,music}.ts` byte-identical to `144453ef`), so the two
sides are the same journey through different sound.

**Determinism:** two separate world loads of the same build differ by at most one 16-bit LSB
(−90 dBFS) on 0.01 % of samples, i.e. rounding at the WAV quantisation boundary. Seeded PRNG only
(`src/world/util/prng.ts`); the test greps the three audio sources for `Math.random(`.

### What the numbers mean

- **band levels** — RMS per octave-ish band in dBFS.
- **strongest held tone** — for every FFT bin, its median level over the whole render against the
  median of its 21-bin neighbourhood; the largest excess, in dB. A sine held under a bed shows up
  here and nowhere else. This is the number for *drone*.
- **breathes** — the 90th minus the 10th percentile of the broadband envelope.
- per footstep — how many **separate transients** it holds, over how many **ms**, its **spectral
  centroid** and its **low/high** ratio (40–300 Hz against 2–10 kHz).

## 6. No water

The owner's list said "leaves in wind, birds at a distance, maybe water". There is no water anywhere
in the world yet — no stream, pond or fall in `src/world/layout.ts` or any system — so a brook would
be a sound with no source. When one is built, the bed already has the shape to hang it on
(`createAmbience` places, filters, attenuates and pans a positioned source for the lanterns).
