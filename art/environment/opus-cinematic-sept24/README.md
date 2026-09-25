# opus-cinematic-sept24

## Delivered (2026-09-25 ~02:15 local): the 40-second reference-angle cinematic

**[final/Kokiri-Forest-Opus-X-1080p.mp4](final/Kokiri-Forest-Opus-X-1080p.mp4)**, with
[poster.png](final/poster.png) taken from the encoded first frame and a
[contact sheet](final/contact-sheet.jpg) of every cut.

- **Format:** 40.000 s, 1200 frames, 30 fps, native 1920×1080, H.264 High, yuv420p, `+faststart`,
  AAC 48 kHz stereo, 81.5 MB. Integrated loudness −14.3 LUFS, true peak −1.7 dBTP.
- **Verified** ([verification.json](final/verification/verification.json)): ffprobe frame count, a full
  CPU decode and loudness all pass.
- **Content:** no HUD, text, cursor or black lead-in. The CRF-14 master is kept locally only (210 MB,
  over GitHub's 100 MB file limit).

The owner asked for exactly the camera angles of the reference gameplay clip (the first-look video
this repo recreates), made cinematic and clean, with the inventory left out. The six fixed reference
viewpoints in `src/world/layout.ts` are those angles. Link moves on the real player controller
throughout: 60 Hz simulation, recorded at 30 fps. The plan is in [reference-shots.json](reference-shots.json).

| Edit | Shot | Reference |
| --- | --- | --- |
| 0–7 s | A: Link from behind on the plaza facing the stairway, idle then a slow walk; slow push-in. **Frame 0 is the thumbnail.** | 1 s |
| 7–10 s | F: up the stair axis; Link walks to the stair foot | 8 s |
| 10–17 s | B: Saria's house; Link walks toward the camera and stops, idle, looking at Navi | 14 / 24 s |
| 17–21 s | C: the look-back | 46 s |
| 21–29 s | D: the game's follow camera behind Link up the misty path to the log arch; walk, then run | 56 s |
| 29–36 s | The new north-grove hamlet (exp-north): the follow camera along the stepping-stone trail past the trunk house | new |
| 36–40 s | The log arch in mist, telephoto drift, end frame | 56 s |

- **Source:** branch `agent/opus-cinematic-film-sept25` @ `74fe5376`. That is the integrated world
  `cursor/kokiri-world-phase1-f65e` @ `b9993008` (the north-grove hamlet merged) plus Link's repaired
  motion and head fix from this branch (the four paired character files and the Navi hunk). The bundle
  is `index-Bn7t0nvG.js` and the GLB `8d7efa78…`. Per-job receipts (frame hashes, renderer, camera
  poses, Link root / gait / stance) are in the ignored `gauntlet/out/opus-cinematic-sept24/ref-final/`.
- **Sound:** original synthesized forest (wind, birds, leaves) and the game's own score rising at
  24.4 s. Footsteps come from Link's recorded foot contacts (`audio/steps-ref.json`). See `audio/`
  and `audio/cues-ref.json`.
- **Review:** seven parallel per-shot reviewers, each using contact sheets and a frame-difference
  motion scan. They found no blocker and no major issue. Minor notes:
  - a one-frame arm change as Link starts walking in A
  - the end of C has Link's boots at the frame edge
  - small tree LOD swaps in D and the grove
  - the fogged log arch reads soft
- **Reproduce** (PowerShell, from the repo root; see [RECORDER.md](RECORDER.md)):
  1. Build `agent/opus-cinematic-film-sept25` to a dist folder.
  2. `node art/environment/opus-cinematic-sept24/record.mjs --shots art/environment/opus-cinematic-sept24/reference-shots.json --dist <dist> --out <out> --size 1920x1080 [--only …]`
     through `capslot.mjs`, with `ZR_NATIVE_GPU=1`.
  3. `art/environment/opus-cinematic-sept24/finalize-ref.ps1`, which merges the frames and step
     logs, renders the footsteps, masters the audio, then encodes, extracts the poster and verifies.

## Earlier status (2026-09-25 ~00:30 local)

The first 30-second 4K plan from `docs/OPUS_CINEMATIC_HANDOFF.md` was parked when the owner changed
plan. The notes below describe the Link motion work and the tooling from that stage.

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
