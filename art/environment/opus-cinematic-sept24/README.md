# opus-cinematic-sept24

**Status (2026-09-25 ~00:30 local): parked by the owner's change of plan.** The 30-second 4K cinematic
from `docs/OPUS_CINEMATIC_HANDOFF.md` was **not recorded**. This folder holds the Link motion work that
was finished, plus the capture, scouting and sound tooling as far as it got, so the film can be resumed
from here.

## Finished: Link's play-mode motion (commit on this branch, `src/world/character/`)

- **Head snap fixed.** `glbLink.ts` lookAt measured Navi's bearing with `atan2`, whose ±π cut is
  directly behind Link. Her play-mode orbit (`index.ts`) crossed it every 12.6 s, and the clamp
  flipped the head by 0.80 rad in one frame.
  - In play mode the look now fades out toward his back and is low-passed.
  - Navi's orbit stays on his front-left, and her lead eases in instead of jumping 0.7 m.
- **Body overlays** (play mode only; no GLB or clip-contract change — `8d7efa78…`, run 1.20 m / 28/60 s / 2.2 m/s):
  - chest counter-rotation and a lateral weight shift, both timed from each clip's own swing table
  - the trunk leans over the stance foot
  - walk carriage and breathing
  - idle weight shift and soft knees (the idle no longer stands 27 mm taller than the walk)
  - arms brought in from the stiff A-pose, with softened elbows
  - the body leans into starts and turns, with the neck keeping the head steady
  - jump follow-through in the chest, elbows and arms
- **Checks.** Both are CPU-only.
  - `motion/check-body.mjs`: PASSED. The largest head step drops from 0.80 to 0.0065 rad. Walk and
    run have no reach clamps and planted-foot slide stays under 0.1 mm/s. Overlay bones are exact on
    a zero-dt re-pose. `BASELINE=7b0103fa node motion/check-body.mjs` reproduces the original.
  - Astra's `art/characters/link/progress/2026-09-24-natural-legs/check.mjs`: still PASSED.
- **Not yet done.** The motion has **not been reviewed as rendered video**: the GPU walk/run/idle
  capture was queued when the plan changed. Before relying on it, record one with:
  `art/characters/link/capture_play_motion.mjs --flat-video` (through capslot, `ZR_NATIVE_GPU=1`).

## Partial tooling (untested or unfinished — review before use)

| Path | State |
| --- | --- |
| `record.mjs`, `RECORDER.md`, `test-shots.json` | One recorder for camera-only and real-player shots: 60 Hz sim, 30 fps out, a follow/track/lead/fixed camera, footstep log and receipts. Its first 1080p `--test --verify` run was interrupted, so it is **unverified**. |
| `assemble.mjs` | Frames + mix → 4K master and X-ready 1080p H.264 (yuv420p, `+faststart`), a poster from the encoded frame 0, a contact sheet, ffprobe / full-decode / loudness verification, `delivery.json`. Never run. |
| `scout/` | Camera candidates for the opening, detail, canopy and final reveal (`r1`, `r2` shot lists) and the scouting tools. Test stills were rendered to the ignored `gauntlet/out/opus-cinematic-sept24/scout/` but **not yet reviewed or ranked**. |
| `audio/` | Original synthesized forest soundtrack: `render-audio.mjs` and `synth/cine.js` (birds, wind, lantern, footsteps, score rise), `cues.json`, `provenance.json`. The five stems rendered cleanly. `finish-audio.mjs` (mix, limiter, −14 LUFS master) was **not run**. Stems and transpiled sources are git-ignored and regenerable. |
