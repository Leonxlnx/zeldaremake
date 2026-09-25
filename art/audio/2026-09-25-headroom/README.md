# Lane 5 — the mix is still where the level work left it, and now something says so

Branch `agent/squad5-headroom-recheck`, off the integration head at `5072b792`. **No `src/` change.**

Six changes to `src/audio/` landed today: a hut became a room, the room answered, birds got shadows,
the bed stopped repeating, a run stopped being a louder walk, one step in fifteen stopped being
dropped, and the renderer stopped hoarding nodes. Two of those push directly on level — **the run's
steps are brighter and there are 5 % more of them** — and the game's gain staging was sized in PR #63
against a worst case measured before any of it.

Nothing had re-checked it. It is also the one number on this lane the owner feels directly: he sets
his volume by ear, and a mix that drifts out of the normal band puts him back to cranking his system,
which is where this started.

## It holds

The same worst case #63 was sized against — running and jumping continuously on the flagstones under
the densest cluster of lanterns in the world, with the score playing — captured off the live master
on today's head:

| | the level work, 2026-09-24 | today | |
| --- | ---: | ---: | --- |
| integrated loudness | −23.6 LUFS | **−23.9 LUFS** | inside the −26 to −17 band |
| true peak (4× oversampled) | −7.3 dBFS | **−7.0 dBFS** | 7 dB of room left |
| clipped samples | 0 | **0** | |
| the take itself | 168 steps, 51 landings, 30 shoves, **45 pods** | 177 steps, 51 landings, 26 shoves, **62 pods** | |

Everything today cost **0.3 dB** of headroom and moved the loudness by **0.3 dB**. Worth noting that
the worst case is genuinely worse than it was: the world has gained seventeen pod lanterns since #63
measured it, and the step count is up 5 % from this morning's tick-rate fix. It still holds.

## The gate

A measurement nobody re-runs is a measurement that goes stale, and this one went stale for a day
without anybody noticing. So it is a gate now rather than a report —
`art/audio/2026-09-25-headroom/verdict.py` measures a capture and **exits non-zero** if the mix has
moved:

```
integrated loudness    -23.9 LUFS   ok   (wants -26 to -17)
true peak (4x)          -7.0 dBFS   ok   (wants under -3)
clipped samples                 0   ok   (wants none)
short-term p10 / p50 / p99  -30.0 / -25.5 / -19.1 LUFS

the mix is where the level work left it
```

The thresholds are #63's own reasoning rather than new ones: the band it argued for, and half the
headroom it left. Checked in both directions — fed the same take with 8 dB on it, it fails all three
and exits 1:

```
integrated loudness    -15.9 LUFS   FAIL
true peak (4x)           0.0 dBFS   FAIL
clipped samples                36   FAIL

THE MIX HAS MOVED — re-size the trim or find what pushed it
```

It measures the **worst case** and not a walk, because headroom is sized against the worst case and
an average cannot fail.

## Why this is not a unit test

It cannot be. The number is a property of the whole live mix under load — the sfx compressor's
behaviour on stacked landings, the pod count in the scene, the score's own lift — and none of that
exists outside a browser running the game. What a unit test could check is the constants, and the
constants were never the risk: `MASTER_TRIM_DB` has not moved, and the mix drifted anyway, because
what moved was how often and how brightly the boots hit the ground.

## Reproduce

```bash
npm run build
node art/audio/2026-09-24-level/worstcase.mjs --dist dist --out /tmp/worst --seconds 70
ffmpeg -y -i /tmp/worst/worst.webm -ar 44100 -ac 2 /tmp/worst/worst.wav
python3 art/audio/2026-09-25-headroom/verdict.py --take /tmp/worst/worst.wav
```

**202 / 202 tests**, typecheck clean, build green. Nothing in `src/` changes on this branch.
