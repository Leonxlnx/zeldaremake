# the flame is the drone, and two ways of fixing it both failed

The world-floor survey named the loudest never-stopping place in the game — **a metre from a pod
lantern** — and the owner's standing complaint, twice, is noise that never stops. What nobody had
been able to ask is how much of that is the flame, because until the day before yesterday `mute`
could not switch a flame off (`art/audio/2026-09-27-fairies/`).

Asked now, and the answer is worse than "some of it":

**The flame does not breathe on any timescale a listener could call breathing.** Its swing is
9.8 dB through a 5 ms window and **1.0 dB through a four-second one**, against 25 and 14 for the
bed around it. All of its variation is texture. Standing a metre from a pod it **cuts the place's
own breathing from 25.5 dB to 18.7 and lifts its always-on level by 6.9**.

**And two fixes for that both failed, measured, and are reverted.** The reason they failed is the
useful part and it is in the report below.

**No `src/` change.** One constant's comment is vindicated by measurement for the first time and
one voice is characterised; nothing about the game moves.

---

## What the flame is worth

Three takes in each of three places — the whole bed, the flame alone, everything except the
flame. A-weighted, the tenth percentile over time, both channels with their powers averaged.

```
  place   take         always-on    median    swing   the flame adds
  pod     bed              -57.9     -49.5     18.7
  pod     flame            -60.7     -59.2      2.6       +6.85 dB
  pod     without          -64.8     -50.0     25.5

  bough   bed              -61.1     -49.8     21.5
  bough   flame            -65.3     -63.7      2.6       +3.72 dB
  bough   without          -64.8     -50.0     25.2

  lawn    bed              -59.0     -48.4     21.6
  lawn    flame            -65.0     -63.5      2.6       +2.04 dB
  lawn    without          -61.0     -48.6     23.6
```

Per band, what it adds to the floor at the pod: **+24.9 dB at 20–60 Hz, +20.4 at 60–250, +10.2 at
250–1000**, and essentially nothing above 1 kHz. It is a low thing, and A-weighting is why 25 dB
down there comes to 6.9 overall.

The line that matters is `pod / without`: **the place breathes 25.5 dB with the lantern muted and
18.7 with it lit.** The flame is not making the place loud, it is filling in its quiet.

### A constant vindicated

`LANTERN_CROWD_SHARE = 0.2` carries the comment *"a village of pods must not sum to a drone"* and
has never been measured. It holds: the flame alone under the lantern bough — the densest cluster
in the world, 62 pods in the scene — has an always-on level **4.5 dB below** the same flame a
metre from a single pod. Sixty-two do not sum to more than one.

## Why it is a drone, exactly

The swing depends entirely on how long you look:

| window | the flame | the bed without it |
| ---: | ---: | ---: |
| 5 ms | 9.8 dB | 25.2 dB |
| 50 ms | 5.4 | 24.7 |
| 250 ms | 3.3 | 24.3 |
| 1 s | 1.7 | 20.5 |
| 2 s | 1.3 | 17.4 |
| 4 s | **1.0** | **14.2** |

The bed keeps breathing as the window grows because its events are seconds apart. The flame does
not, because **everything in it is noise**: a pink tap through a lowpass, a narrow band of the
same tap for the husk, and a 2.6 Hz flutter. Noise is loud and quiet many times a second and the
same from one second to the next, and "never stops" is a complaint about seconds.

## Two fixes, both measured, both reverted

### The husk had no flutter at all

`flameBody` rides a 2.6 Hz wander at depth 0.9 on a base of 0.35. `huskGain` — the narrow 132 Hz
resonance that *"gives a lit pod a pitch"* — sat at a flat 0.55, **larger than the body**, with
only its centre frequency wandering. So the bigger half of the flame never moved at all.

Fanning one wander to both halves is the physically right thing (a husk rings because a flame
burns in it, so they cannot flicker independently) and it **did nothing**: the swing went 2.6 dB
to 2.8 A-weighted and was identical at every window from 5 ms to 4 s. Because 2.6 Hz is fast, and
the flame already had all the fast it could use. The only thing that moved was the level, up
0.4 dB.

### A slow gutter moved the number and bought nothing

What was missing is slow — a flame is not the same size from one breath to the next. A gain in
**series** with the flame (in series, so it scales rather than adds: `flameGain` carries the
distance term, and a node connected to an AudioParam is summed with its automation, which is the
fault `canopyMod` was gated to avoid) riding a twelve-second wander at depth 0.5:

| window | before | with the gutter | and the median |
| ---: | ---: | ---: | ---: |
| 250 ms | 3.3 dB | 3.8 | **+1.30 dB** |
| 1 s | 1.7 | 2.3 | +1.28 |
| 2 s | 1.3 | **2.1** | +1.29 |
| 4 s | 1.0 | 1.3 | +1.24 |

Real movement — the two-second swing goes up 0.8 dB — bought at **+1.3 dB of level**, which is
the wrong trade for a complaint about level. And it is not an accident of this depth:
**multiplying a signal by `1 + w` raises its mean power by `E[w²]` for any zero-mean `w`**, so
deepening the breathing always makes the thing louder, as the square of the depth. Compensating
the base would give back the level and leave a two-second swing of 2.1 dB against the bed's 17.4.
Still a drone.

## What that leaves

**The flame cannot be made to breathe without turning it off**, and a lit lantern does not go
out. Getting to the ten decibels rubric check 1 asks of a band would mean the gain reaching near
zero periodically, which is a different object than a flame.

So the honest conclusion is that the flame is *legitimately* a steady source, and the thing to
reconsider is not its variation but **whether it should be as present as it is** — +6.9 dB on the
floor at a pod, +2.0 on a lawn nineteen metres from anything. That is a level decision with an
owner in it and not one this lane should take on a number nobody has complained about; it is
written down here with the measurement beside it so it can be taken by someone who wants to.

## Gates

    npm run typecheck                                        clean
    node --test src/audio/*.test.mjs                        107 / 107

No `src/` change: both attempts are reverted and `git diff` on `src/` is empty. The build and the
playtest are the ones from `2026-09-27-fairies` on the same commit of `src/` — build clean, 11/11
walk routes, no page errors.

## Named, not taken

- **The level decision above.** It is the only lever left on the loudest never-stopping thing in
  the world, and it needs an owner.
- **The flame's peak is at 43 Hz.** Pink noise through a lowpass at 320 Hz has most of its energy
  at the bottom, and a pod-sized flame does not radiate below 60 Hz at all. Removing it would
  free headroom and lower the unweighted floor a long way, and change what anyone hears almost
  not at all — A-weighting is 50 dB down there. Worth doing for the headroom, not for the
  complaint, and not measured here.
- **The 0.25 s window is the lane's, everywhere.** `floor.py`, `spectra.py` and this all use it,
  and the table above is the first time anything here has asked what the choice costs. A voice
  can be a drone at 4 s and look lively at 5 ms, and only one of those is the complaint.
- **`FLAME_RATE` and `LEAF_RATE` share one pink buffer at different playback rates.** The flame's
  0.71 and the leaves' 0.84 are chosen clear of simple ratios so the two taps do not re-align.
  Nothing has measured whether they do.

## Reproduce

```bash
npm run build
node art/audio/2026-09-27-flame/flame.mjs --dist dist --out /tmp/flame --seconds 120
python3 art/audio/2026-09-27-flame/flame.py /tmp/flame
```
