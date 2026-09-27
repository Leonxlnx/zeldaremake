# the flame's two halves are the same noise, so they interfere

Yesterday's report closed with a line I was confident about:

> **The flame's peak is at 43 Hz.** Pink noise through a lowpass at 320 Hz has most of its energy
> at the bottom, and a pod-sized flame does not radiate below 60 Hz at all. Removing it would
> free headroom and lower the unweighted floor a long way, and change what anyone hears almost
> not at all. **Worth doing for the headroom.**

It is not worth doing, and the reason is the report. **Predicting the change on the rendered stem
and then making it in the graph gave different answers**, and chasing that difference turned up
something structural about how the flame is built: its two halves come from one noise source, so
they are coherent, and filtering either one changes how they add.

**Reverted.** `git diff` on `src/` is empty against the commit before it.

---

## Predicted, then measured

The sweep was done first, the honest way — the candidate filter applied to the already-rendered
flame stem, where nothing else can move:

|  | A-weighted floor | unweighted floor | peak | 20–60 Hz |
| --- | ---: | ---: | ---: | ---: |
| 40 Hz | −0.07 dB | −2.66 dB | −3.43 | −6.9 dB |
| **80 Hz** | **−0.26** | **−3.98** | **−3.73** | **−21.4** |
| 100 Hz | −0.46 | −4.63 | −5.28 | −28.2 |
| 140 Hz | −1.15 | −6.22 | −7.24 | −39.3 |

80 Hz was chosen from that table: the last column has done its work, the first has barely
started, and 140 would eat the husk resonance at 132 Hz. Then the same filter in the graph, on
the body only:

```
  predicted   A-weighted floor  -0.26 dB    unweighted floor  -3.98 dB    peak  -3.73 dB
  measured    A-weighted floor  +0.36 dB    unweighted floor  -1.80 dB    peak  -1.49 dB
```

**The A-weighted floor went the wrong way**, the other two came in at less than half. A high-pass
cannot add energy, so something else was going on.

## What was going on

Band by band, what the graph actually did:

```
    20-40      -14.85 dB   <- what it was meant to remove
    40-60       -5.17
    60-80       -0.08
    80-100      +2.25
   100-140      +2.06      <- the husk sits here
   140-200      +0.33
   200-320      +0.34
   320-500      +0.24
   500-1000     +0.16
  1000-4000     +0.11
```

It removed what it was aimed at and **gained two decibels where the husk is**. The A-weighted
level lives in that band, which is the whole of the +0.36.

The flame is two voices: a **body** (the noise through a lowpass at 320) and a **husk** (a narrow
band of resonance at 132 Hz, Q 5), summed at one gain. They are **the same `flameSrc`** — one
pink tap, read twice. So they are coherent, and where their bands overlap their sum depends on
the phase between them. A two-pole high-pass shifts phase well above its own cutoff; putting one
in front of the body re-phased it against the husk, and 100–140 Hz went from partly cancelling to
partly adding.

Two things confirm that rather than leave it as a story:

- **Above 500 Hz the power is unchanged (+0.16 dB) while the waveform differs by −15.5 dB
  relative.** Two signals with the same power and a different waveform differ in phase and in
  nothing else. The render floor between two identical takes on this lane is −108 dB, so −15.5 is
  a real change.
- **The gain is concentrated at 100–140 Hz**, which is the husk's band and nowhere near the
  filter's cutoff, where a high-pass's own resonance would put it.

## Why it matters beyond the flame

This is not a quirk of one voice. Anywhere in the bed where two taps of the same buffer overlap
in frequency, **the level of the sum is a function of the filters' phase**, and nobody choosing a
cutoff has been thinking about that. The bed's three continuous taps (`bedSrc`, `leafSrc`,
`flameSrc`) are separate buffers or separate rates, which is what keeps them apart; the body and
the husk are neither. They are one tap at one rate, split by two filters.

The comment on the husk says it was built this way on purpose — *"a narrow band of the SAME
noise, not an oscillator: the hum this replaced was two sines, and a sine is the drone the owner
heard"* — and that reasoning is sound. The cost of it had just never been named: the two halves
cannot be tuned independently, because changing either one moves the other's contribution.

## What that leaves

The flame still has no bottom, and a pod-sized flame still cannot radiate at 43 Hz. Removing it
is still right. Doing so needs either

- the husk fed from **a different tap** of the pink buffer, so the two stop being coherent and
  can be filtered independently — which is a real change to a voice the owner has already been
  bothered by once, and wants its own before/after; or
- the body's phase compensated, which means an all-pass and a measurement of the sum, for a
  change whose whole benefit is inaudible by the lane's own weighting.

Named, not taken. The third thing tried on this flame in two days and the third to be reverted,
and the only one that failed for a reason worth keeping.

## Gates

    npm run typecheck                                        clean
    node --test src/audio/*.test.mjs                        107 / 107

No net `src/` change: the high-pass was committed, measured, and reverted in the commit after it.

## Named, not taken

- **The husk on its own tap**, above.
- **`filter(ctx, type, hz, Q)` passes `Q` straight to WebAudio**, and for `lowpass` and `highpass`
  the spec says that value *"is not a traditional Q, but is a resonance value in decibels"*. The
  lane uses values from 0.5 to 5 across dozens of filters on the assumption that they are quality
  factors. Nothing here measured it — it is not what caused this, since the gain landed at the
  husk and not at the cutoff — but a lane that has just been caught by one filter convention
  should check the other.
- **The three rejections on this flame** (a flutter on the husk, a slow gutter, and this) are all
  in `art/audio/2026-09-27-flame/` and here. What remains untried is its level, which needs an
  owner.

## Reproduce

```bash
# the prediction, on the committed stems from 2026-09-27-flame
python3 - <<'EOF'
# the sweep in that report's README, applied with ffmpeg highpass to pod-flame.wav
EOF
# the measurement needs the reverted commit; see b751fc77 and its revert
```
