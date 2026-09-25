# Astra's PR #59 applied to the head: the measurement (2026-09-25 19:20 round)

fable-cursor's squad log, 19:10: *"pending integration, Astra's ask (PR #2 19:05): PR #59 … apply PR #59's diff
against main to those four files, check it applies (else rebase on main's versions), run the gait / character tests
and a play-mode run."* This folder is that check, done on the head `60085f03` in a clean worktree; the result is
the branch `agent/fable-3-pr59-applied` (commit `7734f615`: the four paired files together, nothing else).

## What was applied

PR #59 (`codex/walk-arms-sept24`) moved after the 19:10 note: the SHA named there, `ae894d5d`, is the 3.3 m/s run
(GLB `aa0520e0…`, stride 1.82 m); its tip `7b0103fa` adds `8a11e881` *"Replace shuffling run with grounded heel
recovery and smooth hips"* — GLB `8d7efa78…` (54,439,952 bytes), run 2.2 m/s on a 1.2 m stride, and a sole-floor
clamp in the leg solve. CI (`capture · compare · score · anti-cheat`) is green on the tip. **This applies the tip.**
`git diff origin/main 7b0103fa -- animation.ts glbLink.ts SOURCE.md | git apply --3way` on the head: **all three
apply cleanly** (the head's `glbLink.ts` differs from main's, but not where #59 touches it); the GLB is #59's blob,
sha256 `8d7efa783d4bbc97…` = `LINK_GLB_SHA256` = SOURCE.md's current delivery.

| | head `60085f03` | #59 applied |
| --- | --- | --- |
| `PLAYER_SPEED` walk / run (m/s) | 1.6 / 4.6 | 1.2 / 2.2 |
| `GAIT_SPEED` run (clip's authored speed) | 3.9 | 1.2 / (28/60) = 2.571 |
| `CLIP_SPEC.run.strideM` | 1.82 | 1.2 |
| `ARM_SCALE` walk / run, `ARM_TAU` walk / run | 0.7 / 1.15, 0.06 / 0.02 s | 1 / 1, 0 / 0 (the authored arms, unscaled, unfiltered) |
| new in the puppet | — | phase-based pelvis-notch correction (`pelvisCycle`, ≤ 2.5 cm, blended out over a jump's crouch / landing); the leg target enforces the measured sole floor as well as the lift bound |

## Typecheck, build, tests

`tsc --noEmit` green, `vite build` green. `node --test 'src/**/*.test.mjs' 'gauntlet/**/*.test.mjs'`: **218 / 219**.
The one failure is not #59's bug but a consequence the integration has to carry:

- `src/audio/footsteps.test.mjs` › *the step is the animation's own, and still is* — the footsteps audio pins its
  model to the controller and the clip contract by reading `glbLink.ts` / `animation.ts` source, so it fails with
  the new numbers in its message ("the run clip's stride is 1.2 m, so a step is 0.600 — this file says 0.91"; then
  "the walk speed must be the controller's 1.6 !== 1.2"). `src/audio/footsteps.ts` (fable-cursor's) needs
  `WALK_SPEED 1.6 → 1.2`, `RUN_GROUND_SPEED 4.6 → 2.2`, `RUN_STEP_M 1.82/2 → 1.2/2`, and the test's derived
  expectations re-read (walk 1.2 / 0.44 = 2.73 steps/s, run 2.2 / 0.60 = 3.67 steps/s).
- The one that matters in play: `RUN_SPEED = 2.4` is the audio's threshold above which a step gets the run design
  (shorter contact, harder heel). With the controller's run at 2.2 m/s the player never crosses it — **a run would
  sound like a walk** until that threshold drops below 2.2 (e.g. midway, 1.7). At `ae894d5d`'s 3.3 m/s it would
  still cross.

## The gait checks

`art/characters/link/check_run_grounding.mjs` (the real GLB through the production puppet, 240 frames at the run):

| | head | #59 applied |
| --- | --- | --- |
| speed (m/s) | 4.6 | 2.2 |
| root range (m) | 1.8e-5 | 1.8e-5 |
| flight frames / max clearance | — | 28 / 0.0153 m |
| min shoe gap (m) | −1.6e-6 | −1.7e-6 |
| finite / reach clamped | yes / 0 | yes / 0 |

`check_stair_grounding.mjs` fails **on both** with `Zero-dt body height changed` — pre-existing on the head, not
#59's; noted, not chased here.

## The play-mode run (`run-strip.mjs`, this folder)

Link runs on the plaza's flagstones in play mode (`__ZR_PLAY__`, Shift + a movement key, 1/60 s steps, the follow
camera held side-on), the controller's position and both feet's stance flags read every step:

| | head | #59 applied |
| --- | --- | --- |
| ground speed over the strip (m/s) | 4.594 | 2.200 |
| steps / s | 5.00 | 3.67 |
| step length (m) | 0.919 (= 1.82 / 2) | 0.599 (= 1.2 / 2) |
| airborne (neither foot in stance) | **60 %** of frames | 42 % |
| single stance / double stance | 40 % / 0 % | 58 % / 0 % |

The head's run is in the air three frames in five — the bounding, floaty read Astra's PR names "the shuffling run";
#59's is on the ground more than off it, a jog's proportion. Frames: `run-head-vs-59-side.jpg` (every 0.2 s, head
top, #59 bottom).

## Six fixed views

`capture.mjs --quality high --settle 12` on both builds (`dist-head19` = the head `60085f03`, `dist-59` = the head +
`7734f615`), SSIM against `reference/frames` at 256 × 144, changed pixels at 1280 × 720:

| view | head `60085f03` | #59 applied | Δ | SSIM head ↔ #59 | changed px | draws / triangles (both) |
| --- | --- | --- | --- | --- | --- | --- |
| A | 0.1953 | 0.1951 | −0.0002 | 0.9998 | 617 | 614 / 8.967 M |
| B | 0.1768 | 0.1768 | +0.0000 | 1.0000 | 29 | 596 / 8.293 M |
| C | 0.1854 | 0.1853 | −0.0002 | 0.9989 | 2 751 | 533 / 7.959 M |
| D | 0.2512 | 0.2503 | −0.0009 | 0.9964 | 10 201 | 523 / 8.741 M |
| E | 0.1997 | 0.1997 | −0.0000 | 1.0000 | 29 | 596 / 8.293 M |
| F | 0.2192 | 0.2191 | −0.0001 | 0.9996 | 1 420 | 555 / 8.098 M |

Draws and triangles are **identical head ↔ #59 at every view** (A 614 / 8.967 M, B 596 / 8.293 M, C 533 / 7.959 M,
D 523 / 8.741 M, E 596 / 8.293 M, F 555 / 8.098 M): the new GLB changes animation tracks and vertex positions, not
counts. Camera A sits at 8.967 M on the head already — 33 K under the 9.0 M cap, none of it Link's.

Every view is inside the −0.003 band. The change is Link himself: the fixed views pose him at the run clip's
`heroClipTime`, and it is a new clip — D (he runs up the path toward the log, back to camera) changes most, 10 201 px
inside his silhouette's box (546–929 × 436–716), the arms hanging a little differently (`hero-D-log-head-vs-59.jpg`,
head left, #59 right); A's 617 px are his hands: he stands idle on the stairs and #59's four long fingers curl toward the palms (Astra's Blender hand study, ≤ 35°), the rest of him identical (`hero-A-stairs-head-vs-59.jpg`). B and E's 29 px
are the usual fairy flicker. This is a look change by Astra's authorship (PR #2's ask), not a regression — but it is a
change to the sealed frames, so it is fable-cursor's to time.

## Files

- `run-strip.mjs` — the play-mode strip harness (`node run-strip.mjs --dist <dist> --out <dir> --key KeyA --x -2.5
  --z 3 --vyaw -1.5708 --vpitch -0.5 --runup 36 --frames 8`); `gait-stats.mjs` — stance / flight / cadence from its
  `rows.json`; `rows-head.json`, `rows-59.json` — the two strips' rows.
- `run-head-vs-59-side.jpg` — the strips, every 0.2 s, head top / #59 bottom.
- `hero-D-log-head-vs-59.jpg`, `hero-A-stairs-head-vs-59.jpg` — the hero pose in the two fixed views that hold him.

Not done here: a play-mode listen (the footsteps' run design at 2.2 m/s — see the audio note above), the walk's
"vertical shiver" claim in #59's own evidence (Astra's `art/characters/link/progress/2026-09-24-*` folders carry it;
not re-measured), stairs (the stair clip is untouched by #59).

