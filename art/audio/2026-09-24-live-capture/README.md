# Recording what the player actually hears

Branch `agent/squad5-live-capture`, off `b306d6a9`.

Every measurement this lane has made — nine reports, every before/after, every band table — comes
from `renderOffline`: the same audio graph rebuilt in an `OfflineAudioContext`, driven by a scripted
walk against a perfect clock. That is exact, fast and reproducible, and it is a **twin**. It is not
the thing the owner hears. The live graph differs in ways that could matter: its parameters are
driven from an animation frame at whatever rate the browser gives it, its gust comes from the world
rather than a formula, its footsteps fire on the gait's real boot plants rather than an integrated
stride, and its voices are built and torn down against a wall clock.

Nobody had ever checked that the twin tells the truth. This closes that.

`AudioHandle.record(seconds)` taps the live master into a `MediaStreamDestination` and records it
with `MediaRecorder` (WebM/Opus). The tap is additive and torn down afterwards, so the player's
output is untouched. `capture.mjs` drives the real build in play mode, stands Link on the plaza,
walks him north over the flagstones, and records the master while he goes — then renders the offline
mix **from the same page load**, so the two cannot differ by build or by scene.

## The twin is faithful

18 s of live walking on flagstones against the offline stone leg:

| | rms | peak | 125–250 | 500–1k | 1–2 kHz | 2–4 kHz | 4–8 kHz |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **live, walking stone** | −32.6 | −17.4 | −35.5 | −33.5 | −43.7 | −50.9 | −68.0 |
| **offline, stone leg** | −32.9 | −19.7 | −35.8 | −34.9 | −42.4 | −51.9 | −73.1 |
| difference | 0.3 | 2.3 | 0.3 | 1.4 | 1.3 | 1.0 | 5.1 |

Every band within about 1.5 dB except 4–8 kHz, where the two are not comparable: Opus is lossy up
there, and the live take is 18 s of a real route against 5 s of a scripted one, so their bird and
leaf-flutter draws differ. The peak differs because the live take contains more steps.

**So the lane's evidence chain holds.** The offline renders that every earlier report is built on do
represent what the game sounds like.

## Two things the live take showed that the twin cannot

**1. Nothing sounds in a headless page until something asks for an animation frame.** The audio
system runs its parameter update and its music scheduler on `requestAnimationFrame`, and a headless
page that never composites never fires one unless the harness requests it. The first capture was
digital silence until the walk loop started. This is the harness, not the game — a visible browser
animates continuously — but it means *any* probe on this lane that measures "standing still" is only
measuring anything because it happens to be pumping frames. `capture.mjs` now steps frames for the
whole take, bounded by the **wall clock** rather than a frame count, because this page does not run
at 60 Hz and a fixed number of frames does not take a known number of seconds.

**2. The live graph takes about 5 s to come up to level; the offline twin is at full level at t = 0.**
Measured on the same page load, half-second frames in dBFS:

```
live:     −92 −92 −92 −92 −92 −92 −92 −92 −92 −92 −33 −34 −32 −33 −31 −30 −31 …
offline:  full level from the first frame (0.5–3 s measures −32.5 rms)
```

This is **not explained** and is left as the next thing to chase rather than guessed at. It is not
the frame pump (the fixed capture steps throughout and still shows it). Candidates, in the order I
would check them: the bed's `setTargetAtTime` time constants ramping from zero at start-up (0.55–0.9 s
each, which should give 2–3 s, not 5); the music's first pass starting at `startAt + 0.3` where
`startAt` is `currentTime + 0.5`; the gust the world reports before its clock has advanced; or
`MediaRecorder`'s own lead-in. It matters because a player who starts the game and stands still may
hear nothing for the first few seconds.

## Reproduce

```bash
npm run build
node art/audio/2026-09-24-live-capture/capture.mjs --dist dist --out /tmp/live --seconds 22
ffmpeg -i /tmp/live/live.webm -ar 44100 -ac 2 -c:a pcm_s16le /tmp/live/live.wav
```

`clips/live-walk.mp3` is the walking portion of that take: the real graph, the real gait, the real
wind — the only artefact on this lane that is not a reconstruction.
