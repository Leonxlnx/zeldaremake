# Lane 5 — the step comes from the animation now, not from a copy of it

Branch `agent/squad5-clipspec`, off the head at `b31042a2`.
No new evidence renders: **this is not meant to change the sound and does not.** What it changes is
that a number in this lane can no longer silently stop being true.

## The problem it fixes is one I made

Last iteration found the cadence model was an adult's guess — 2.02 steps a second and a 0.79 m step
against a gait that plants 3.6 and 0.44 — and fixed it by measuring the gait in play. That was the
right diagnosis and the wrong repair: it left **a copy of the animation's number sitting in
`footsteps.ts`**, to go stale the moment anyone re-authors a clip. The test written alongside it
asserted the measurement, so it would have gone stale in silence too.

And PR #59 is re-authoring the walk.

## The number was already in the codebase

`glbLink.ts` publishes Astra's clip contract:

```ts
export const CLIP_SPEC: Record<Gait, ClipSpec> = {
  walk: { strideM: 0.88, cycleS: 0.55, … },
  run:  { strideM: 1.82, cycleS: 28 / 60, … },
};
```

A stride is two steps, so the boot lands every **0.44 m** at a walk and **0.91 m** at a run.
`animation.ts` gives the ground speeds the player controller drives at — `PLAYER_SPEED` 1.6 and 4.6
m/s — and the clips follow the speed actually covered, so there is no foot slide and the rate falls
straight out:

| | step | ground speed | steps / s |
| --- | ---: | ---: | ---: |
| walk | 0.88 / 2 = 0.44 m | 1.6 m/s | **3.64** |
| run | 1.82 / 2 = 0.91 m | 4.6 m/s | **5.05** |

The play-mode probe counted **3.56 and 3.71** walking and **4.85 and 4.99** running off the
character system's own stance edges (`../2026-09-24-cadence/`). That agreement is the check that the
derivation is the right one rather than a coincidence — the run legs start from a standstill, which
is why they read a little low.

## The guard, and proof it bites

`footsteps.test.mjs` reads `CLIP_SPEC` and `PLAYER_SPEED` out of their source files rather than
importing them. `glbLink.ts` is 2,700 lines and pulls in the GLTF loader, which has no business in
the audio's module graph; the layout and terrain are imported here, a rig loader is not.

Pretending Astra widened the walk stride to 0.96 m:

```
not ok 8 - the step is the animation's own, and still is
  error: "the walk clip's stride is 0.96 m, so a step is 0.480 — this file says 0.44"
```

The failure names the new number, so whoever changes the clip is told exactly what to put here.

## And the twin was walking slower than the player

Found on the way. `OFFLINE_WALK` — the scripted route every evidence render uses — travelled at
**1.5 and 4.2 m/s** against a game that walks at 1.6 and runs at 4.6. Close enough to look right,
and enough to put the render's step rate 5 % under the game's: the same class of mistake as the
cadence model being an adult's, one layer further out. It uses the controller's own constants now.

| the 45 s offline walk | walking legs | the run leg | total steps |
| --- | ---: | ---: | ---: |
| the measured calibration (yesterday) | 3.59 /s at 1.5 m/s | 4.75 /s at 4.2 | 152 |
| **the clip contract** | **3.64 /s at 1.6 m/s** | **5.05 /s at 4.6** | 155 |
| what the game plants | 3.64 | 5.05 | — |

## Reported plainly: this measures like its before

152 → 155 steps over the same render, a 2 % change nobody will hear, and that is the intent. The
previous calibration was already right to within a few per cent — what it was not is **durable**.
The evidence for this change is not a spectrogram, it is that the test fails with Astra's new
numbers when her clip moves, which the previous one would not have done.

40 audio tests green, typecheck clean, build green, `playtest --only walk` 10/10 routes with 0 stuck
and no page errors.
