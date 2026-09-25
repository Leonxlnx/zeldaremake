# opus-cinematic-b-sept25 — Kokiri Forest cinematic trailer (X)

A 36.0-second, 30 fps, native 1920×1080 cinematic of the phase1 world, rendered headless from the built game on the laptop's native GPU. Link is the real player controller (`PlayerHandle.setInput`, 60 Hz simulation recorded at 30 fps). Every sound is original synthesis in code. No text, HUD, logo, cursor, loading screen or black lead-in: frame 0 is the hero wide and doubles as the thumbnail.

**Film:** `Kokiri-Forest-Cinematic.mp4`. The exact hashes and checks for this delivery are in the "Delivery" table at the end, copied from `delivery.json`.

## The cut (13 shots, 1080 frames)

| # | Shot | Frames | Edit s | What |
|---|---|---|---|---|
| 1 | `01-open` | 0–134 | 0.00–4.50 | Hero wide: Saria's mossy tree house with its glowing pods, the long stone stairway, the lantern bough and upper tree hut, the canopy and sun shafts in the haze. Slow linear push-in. Frame 0 = poster. |
| 2 | `02-pods` | 135–176 | 4.50–5.87 | Close-up: the pod lantern cluster over the lit doorway (lantern crackle) |
| 3 | `03-bark` | 177–209 | 5.90–6.97 | Close-up: moss streaks on a giant's bark, shafts behind |
| 4 | `04-stone` | 210–245 | 7.00–8.17 | Close-up: flagstones grazing into the shafts |
| 5 | `05-canopy` | 246–335 | 8.20–11.17 | Tilt-up past a mossy trunk into the canopy and sun shafts |
| 6 | `06-walk-back` | 336–437 | 11.20–14.57 | Link walks slowly (0.85 stick) toward the house and stairway, from behind |
| 7 | `07-walk-front` | 438–509 | 14.60–16.97 | The same walk (cut on action, `skip` 3.4 s), from the front |
| 8 | `08-run-side` | 510–581 | 17.00–19.37 | Run up the north spine, side track, backlit, lantern post and trunks in parallax |
| 9 | `09-run-rear` | 582–635 | 19.40–21.17 | The same run (`skip` 2.4 s), low rear follow |
| 10 | `10-stairs` | 636–701 | 21.20–23.37 | Link climbs the main stairway: opens wide and high from the three-quarter rear, then follows him in |
| 11 | `11-stairs-front` | 702–755 | 23.40–25.17 | The same climb (`skip` 2.2 s) from above-front, the plaza below |
| 12 | `12-hamlet` | 756–863 | 25.20–28.77 | The new north-grove hamlet: trunk house, stilt house, gangway, rope walk, tree hut |
| 13 | `13-reveal` | 864–1079 | 28.80–36.00 | Rising pull-back from under the lantern bough to a wide of the village, house and full stairway. Already moving on the music hit (`easeOutHermite`), it eases to rest on the last frame. The score's phrase B lands on its first frame |

## Sound (`audio/`)

Original synthesis only (`audio/README.md`, `audio/provenance.json`). The game's own modules (`src/audio/{graph,ambience,footsteps,music}.ts`, `src/world/util/prng.ts`) are transpiled unchanged, and `synth/cine.js` adds the rest:
- **Nature bed:** wind in the canopy (the game's bed plus layered air, body and leaf-shimmer), seeded near and far birds placed with distance, air absorption and an original forest reverb, and leaf rustle grains coupled to the gusts.
- **Lantern:** a soft crackle and breath on the pod close-up.
- **Footsteps:** the game's footstep voices at Link's **real contacts**. There are 40 steps, one per rising edge of a foot's stance in the recorder's `steps-<shot>.json`: 29 stone, 11 stair.
- **Score:** the game's own original score, "Under the Boughs" (`src/audio/music.ts`; not a Nintendo melody). It enters under the canopy shot and rises through the walk, run, stairs and hamlet, and phrase B's high G lands on the reveal at 28.8 s.

Mastered: 48 kHz stereo 24-bit, exactly 1,728,000 frames, integrated −14.1 LUFS, true peak −2.1 dBTP, LRA 9.4 LU, 0 clipped samples in any stem. Both ends are digital silence.

## Review and fixes

- **Metric review.** `review.mjs` measures camera jitter (high-frequency residual in px), acceleration spikes, pop-in and flicker (a 16×9 luma-grid spike detector), blown and crushed pixels, and foot drift per stance interval.
- **Visual review.** `review-sheets.mjs` builds filmstrips, cut pairs and pop crops. A five-lens review then went over them (camera, pop-in, character, edit, image), with a skeptic re-checking each finding against the frames.

Fixed during review:
- **Butterfly at the lens.** A game butterfly fluttered at the flower patch right beside the low walk camera and read as a big flat-shaded shape. For the two walk shots, `butterflies` is hidden (`"hide"` in `shots.json`, via the composer's own `__ATMO_HIDE__`).
- **Camera bump in the side run.** The track camera hit the recorder's ground clamp near the house-west apron, causing a 5.3 px acceleration spike over f0563–0566. The camera was raised 0.15 m; the spike is now 0.
- **Grass bank in the front walk.** The front walk's retreating camera drifted into a grass bank. It is now 0.4 m further to Link's left.
- **Navi over Link's face.** Navi covered Link's face at the end of the front stair shot. The camera is now further to his right.
- **Hazy last frame.** The reveal's last frame was too high and hazy. It now ends lower, at 5.4 m, with the house, the full stairway and the lanterns framed by the bough and a trunk.
- **Foot float on the stairs.** In `10-stairs` the left boot planted against a riser, and the stance lock held it ~10 cm above the tread for 1/3 s before it jumped. That stall also made Link sink in the frame. A search over the start offset found that moving the start 5 cm up the approach (`[7.024, 0.115]`) puts every one of the 11 stair stances on its tread, with stance gaps of 0.0–1.1 mm.
- **09→10 jump cut.** The cut went from a rear follow to a nearly identical rear follow. `10-stairs` now opens wide and high from the three-quarter rear (back 4.2, height 2.2, side 1.6, fov 46) and dollies in.
- **Pods cropped and dark.** `02-pods` pushed in without tilting, so the pods lost their caps at the top edge. It now tilts with the push, and the shot gets a shadow lift in the grade (it sat 2 stops under its neighbours).
- **Faceted stone close-up.** `03` was a close-up of bare stair risers that showed the stair mesh's faceted shading. It is replaced by moss on the bark of an emergent giant (`03-bark`).
- **Canopy crosshair.** `05-canopy` had a centred trunk crossed by a limb. It is now yawed so the trunk sits on the left third, and the tilt ends before the flat sky.
- **Lamp post over the stilt house.** In `12-hamlet` the near lamp post stood in front of the stilt house. The camera moved 0.5 m to its right.
- **Slow reveal start.** `13-reveal` barely moved for its first 0.7 s (`easeInOutCubic`) and read as a replay of the opener. `easeOutQuad` fixed that but started at 2.3 m/s, streaking the near bough's leaves on the cut. The final `easeOutHermite` (f = u + u² − u³) starts at the mean speed of 1.2 m/s, peaks at 1.33× and eases to rest on the last frame. The shot was also yawed 4° so a bright far canopy card leaves the right edge.
- **Signboard lettering.** Saria's signboard carries the game's carved rune script (`structures/glyphs.ts`), which read as garbled Latin capitals in the thumbnail and in `10-stairs`. The lettering decal (`signpost-runes`) is hidden in 01, 10, 11 and 13; the board stays.
- **Grade.** The world renders a milky, low-contrast morning. The trailer grade (`assemble.mjs`) sets the black point with a gentle S-curve, adds 15 % saturation, and applies warm highlights, cool shadows and a soft vignette. No overlays.
- **Sound.** Steps +4 dB, a cleaner downbeat at the hit, the low bloom tamed, and a 30 Hz high-pass on the master.

## Known issues (world assets, not changed here)

- **Stair shading.** The stone stair risers split every side quad into a darker and a lighter triangle (a harlequin facet pattern). This is in `src/world/hardscape`, and filed as a separate task. The film keeps the stairs at a distance where it reads as stone texture.
- **Distant canopy.** Far canopy crowns are smeared vertically at the grove's back, and some far trunks have pale cut-off tops seen through the fog (`12-hamlet`, the edges of `13-reveal`).
- **Navi's core.** Navi's core is a hard-edged disc rather than a soft glow at close range.
- **Hamlet branch.** A dark branch stub hangs in the fog above the hamlet's rope walk.

Checked and fine:
- 0.0–0.1 mm planted-foot drift on every walk and run stance. The stairs have 4.5 mm at the walk→stairs blend.
- No reach clamps.
- Camera residual ≤ 0.27 px on every camera shot and 0 on the follow cameras.
- No black or flat frames.
- ≤ 0.5 % blown pixels, around the lanterns.
- Determinism: every player shot re-simulated IDENTICAL, both sim-only and fully rendered, except `10-stairs`. There, both re-simulations agree with each other but differ from the recorded pass on 14 of 178 ticks. The difference is at most 0.14 mm of posed root height; Link's position, heading, gait and stances are identical. The recorded pass also runs zero-dt output renders between ticks, which nudge a pose filter in the new stair-contact path.
- Stairs: every one of the 11 stair stances lands on its tread (stance gap 0.0–1.1 mm).

Pop candidates in the moving player shots were checked frame by frame. They are grass and flagstones sliding at up to 60 px/frame under the tracking camera, plus pollen motes and Navi's 12 Hz wing sparkle, not LOD swaps.

## Reproduce (PowerShell, from the repo root)

```powershell
git checkout agent/opus-cinematic-b-sept25
npm ci
npm run typecheck
npm run build
# freeze the bundle the take was recorded from (dist/ can be rebuilt at any time)
robocopy dist gauntlet\out\opus-cinematic-b-sept25\dist-rec /MIR

# 1. picture: every GPU job through capslot, native GPU, one job at a time (~25 min for all 1080 frames at 1080p)
$env:ZR_NATIVE_GPU='1'; $env:CAPSLOT_STALE_MIN='Infinity'
node art/environment/owner-fable-canopy/tools/capslot.mjs opus-cinematic-b -- node art/environment/opus-cinematic-b-sept25/record.mjs --shots art/environment/opus-cinematic-b-sept25/shots.json --dist gauntlet/out/opus-cinematic-b-sept25/dist-rec --out gauntlet/out/opus-cinematic-b-sept25/take1 --size 1920x1080 --verify
#    (re-record any subset in place with --only 06-walk-back,07-walk-front; frames keep their global numbers)

# 2. review
node art/environment/opus-cinematic-b-sept25/review.mjs --take gauntlet/out/opus-cinematic-b-sept25/take1
node art/environment/opus-cinematic-b-sept25/review-sheets.mjs --take gauntlet/out/opus-cinematic-b-sept25/take1

# 3. sound (CPU only: a blank headless Chrome with GPU and WebGL disabled; no world page, no capslot)
node art/environment/opus-cinematic-b-sept25/sync-cues.mjs          # section times from shots.json
cd art/environment/opus-cinematic-b-sept25/audio
node render-audio.mjs --cues cues.json --steps-dir ..\..\..\..\gauntlet\out\opus-cinematic-b-sept25\take1
node finish-audio.mjs --cues cues.json                              # → mix-36s-48k.wav
cd ..\..\..\..

# 4. encode, poster (the ENCODED frame 0), contact sheet, verification (ffprobe with frame count, full CPU decode, loudness)
node art/environment/opus-cinematic-b-sept25/assemble.mjs --frames gauntlet/out/opus-cinematic-b-sept25/take1/frames --audio art/environment/opus-cinematic-b-sept25/audio/mix-36s-48k.wav --shots art/environment/opus-cinematic-b-sept25/shots.json
```

Raw frames, step logs, receipts, review sheets and the Chrome shader-cache profile stay in the git-ignored `gauntlet/out/opus-cinematic-b-sept25/`.

## Files

| File | What |
|---|---|
| `Kokiri-Forest-Cinematic.mp4` | The film |
| `poster.png` | Frame 0, decoded from the encoded MP4 |
| `contact-sheet.jpg` | The first and last frame of every cut, decoded from the encoded MP4, labelled |
| `shots.json` | The edit: camera keys and eases, player starts, inputs and cameras, per-shot `hide` |
| `delivery.json`, `verification/` | Hashes, ffprobe, full-decode result, loudness, frame hashes, the ffmpeg command |
| `record.mjs`, `RECORDER.md` | The recorder and its documentation, including this branch's changes |
| `assemble.mjs` | Encode, poster, contact sheet, verification |
| `review.mjs`, `review-sheets.mjs` | Objective review and visual review aids |
| `sync-cues.mjs` | Writes the audio cue sections from `shots.json` |
| `audio/` | Soundtrack pipeline, `cues.json`, `provenance.json`, `steps-resolved.json`, `birds-calls.json`, the mastered `mix-36s-48k.wav` |
| `scout/` | Scouting pose lists and tools: `grid.mjs`, `stills.mjs`, `proj.mjs`, `footslide.mjs` |

## Delivery (from `delivery.json` and `verification/verification.json`)

| Item | Value |
|---|---|
| Film | `Kokiri-Forest-Cinematic.mp4`, 74496678 bytes, sha256 `26d1cc3c28dd584a76275f1dc65bb5f85a1d147d46c70d96cacaa08eef59675b` |
| Video | H.264 High @ L4.2, yuv420p (BT.709), 1920×1080 native (no scaling), 30/1 fps, **1080 frames, 36.000 s**, CRF 16 (≈ 16.6 Mbps), +faststart (moov before mdat) |
| Audio | AAC-LC 256 kb/s, 48 kHz stereo, muxed with no gain change. In the MP4: **-14.1 LUFS integrated, -2 dBTP true peak**, LRA 9.4 LU |
| Verification | ffprobe with `-count_frames`: 1080 read frames, duration 36.000000. Full CPU decode (`-xerror -err_detect explode`): no errors. Every check in `verification.json` true |
| Poster | `poster.png` = frame 0 decoded from the encoded MP4, sha256 `3f56ae796201daaa7412b6942437c34fe0d206463000e21b376c45e4b0a0302f` |
| Frames | `gauntlet/out/opus-cinematic-b-sept25/take1/frames/f0000–f1079.png` (git-ignored). Frame sequence sha256 `8aeacefbbe6b6ab6f417c55618848ffad9316ef3026f9801f3fedde2b2eaab43`; per-frame hashes in `verification/frame-hashes.txt` |
| Mastered WAV | `audio/mix-36s-48k.wav`, sha256 `768e05bf1e338f009eb54b15becf29a76ce1a8ef3115f65ec0c2fa14369d98d4` (I -14.1 LUFS, TP -2.1 dBTP) |
| Source | Branch `agent/opus-cinematic-b-sept25`. The world is `cursor/kokiri-world-phase1-f65e` @ `b9993008`, plus Link's motion commit `2ef05b06` (glbLink.ts / animation.ts / link-runtime.glb / SOURCE.md from `agent/opus-cinematic-sept24` @ `991de9bb`, unchanged, and its Navi hover change). All frames were recorded at src HEAD `2ef05b06` |
| Bundle | `dist-rec/assets/index-Bn7t0nvG.js` sha256 `01b6506fc0a7dc23b14bceb69e6bd2f3f056c28485b9a36da89b81f0f4378079`; `index.html` `6e76af69d2a3481686600cd58bd2538cf3aa1dd42c85dc49df698079a08c2983` (`npm run build` of `2ef05b06`) |
| Link model | `public/models/link/link-runtime.glb` sha256 `8d7efa783d4bbc97d053c0a627a28c3c163351d7828124e1bf10c8232f06cedd`, the same bytes as served to the recorder (receipt `linkGlb`) |
| Renderer | ANGLE (AMD, AMD Radeon 780M Graphics (0x00001900) Direct3D11 vs_5_0 ps_5_0, D3D11), Chrome/153.0.8010.53, drawing buffer 1920×1080 at pixel ratio 1, `?capture=1&dev=0&quality=high&hud=0&warmup=1` |
