# September 23 cinematic preparation

**Proposed cut: 36 seconds, six shots, 16:9.** Freeze an accepted build after the current polish; use its existing warm sun, cool forest depth, lanterns, wind and leaves. Keep the grade consistent and cut on movement. This document prepares a recording; no capture, video render or upload was run for it.

Inspected base: `agent/astra-motion-sept21` at `4ad2fb50`, plus the local exporter timing and viewport changes described below. Its latest six-view evidence is [the integrated forest at 105a61d5](../../art/environment/astra-canopy-packed-integration/README.md); the intervening commits add evidence. Reviewed original A/B/D/F PNGs. They establish framing and appearance, not the proposed moving routes or real-time FPS. The new native 1080p route has not been rendered. Recheck the final frozen source before recording.

## The cut

Coordinates are metres, `[x,y,z]`, with north toward negative Z. `P` is camera position, `T` its target; FOV is vertical degrees. Proposed moving endpoints below are **unrendered** and need start/middle/end review. A/B/D/F anchors come from [layout.ts](../../src/world/layout.ts); the house/stair moves reuse the existing [B-roll teaser](../../gauntlet/scripts/broll.mjs).

| Time | Shot and direction | Camera / action |
| --- | --- | --- |
| 00–06 | **Arrival.** Low, slow advance through the warm flagstone pool; house and stairs reveal the village immediately. | A anchor: `P [0.4,1.8,8.6] → [0.7,1.8,7.8]`, `T [6.7,0.89,-5.8] → [6.9,1.2,-5.8]`, FOV 46. |
| 06–11 | **Canopy breath.** Gentle upward tilt from the stair-bank foliage into lit branches; retain trunks as depth cues. | F-derived: `P [-1.96,1.8,4] → [-1.4,2.4,3.6]`, `T [9.7,6,1.31] → [9.7,12,1.31]`, FOV 46. If the upper leaves fail review, hold F and shorten the tilt. |
| 11–16 | **The inhabited house.** Short approach past moss and the warm pods; finish on the open doorway. | Existing teaser: `P [3.2,2.2,-3.5] → [5.2,2.5,-5.2]`, `T [11.8,3.6,-11] → [12.2,4.2,-11.5]`, FOV 42. House centre is `[12.5,1.05,-11.5]`. |
| 16–21 | **Link moves.** Actual walk → run → idle, one uninterrupted side/three-quarter tracking shot. | Existing `--flat-video` replay starts player at `[0,0,0.5]`, moves north for 4 s (walk 2 s, run 2 s), then idles 1 s. At each tick: `P [player.x+2.1,rootY+1.4,player.z-1.2]`, `T [player.x,rootY+0.65,player.z]`, FOV 39. Uses the actual player/controller/GLB, not posed B-roll locomotion. |
| 21–27 | **The ascent.** Camera advances toward the long stairway, lifting its aim toward the upper ledge; no staged stair-running claim. | Existing teaser: `P [2.8,1.9,2.6] → [5.4,2.1,0.6]`, `T [12,3.4,-4] → [14,5,-5.6]`, FOV 44. Main stairs start `[7.3,0,-0.1]`, rise 5.4 m over 20 treads. |
| 27–36 | **Into the forest.** Slow push down the flagstone spine toward the distant log arch; let the last eased stop breathe, then cut out. | D anchor: `P [0.2,1.45,-3] → [0.4,1.5,-4.2]`, `T [4.5,2.75,-42] → [4.7,2.9,-44]`, FOV 48. Keeps the arch in its established composition. |

Use hard cuts; the exporter already eases each move to rest. No generated scenery, added lens flare, invented gameplay, or synthetic intermediate frames are needed. World-only B-roll hides the character group; Link/Navi belong in the actual-input insert. Preserve the owner's currently hidden background cast.

## Existing tools and later commands

[broll.mjs](../../gauntlet/scripts/broll.mjs) already interpolates position, target and FOV with smoothstep, captures renderer PNGs, and accepts arbitrary shot JSON. There is no `npm run broll` and the header's example `gauntlet/broll/teaser.json` does not exist. Chrome, FFmpeg and FFprobe 8.0.1 are available on this machine. Use the existing shared GPU slot; one capture process at a time.

When recording is requested, save this array to `gauntlet/out/cinematic-plan/shots.json`. It renders **31 seconds / 930 frames at 30 fps**; insert Link after the first 16 seconds.

```json
[
  {"name":"01-arrival","s":6,"from":{"p":[0.4,1.8,8.6],"t":[6.7,0.89,-5.8],"fov":46},"to":{"p":[0.7,1.8,7.8],"t":[6.9,1.2,-5.8],"fov":46}},
  {"name":"02-canopy","s":5,"from":{"p":[-1.96,1.8,4],"t":[9.7,6,1.31],"fov":46},"to":{"p":[-1.4,2.4,3.6],"t":[9.7,12,1.31],"fov":46}},
  {"name":"03-house","s":5,"from":{"p":[3.2,2.2,-3.5],"t":[11.8,3.6,-11],"fov":42},"to":{"p":[5.2,2.5,-5.2],"t":[12.2,4.2,-11.5],"fov":42}},
  {"name":"05-stairs","s":6,"from":{"p":[2.8,1.9,2.6],"t":[12,3.4,-4],"fov":44},"to":{"p":[5.4,2.1,0.6],"t":[14,5,-5.6],"fov":44}},
  {"name":"06-log","s":9,"from":{"p":[0.2,1.45,-3],"t":[4.5,2.75,-42],"fov":48},"to":{"p":[0.4,1.5,-4.2],"t":[4.7,2.9,-44],"fov":48}}
]
```

PowerShell, from this checkout; these are future commands, not executed preparation:

```powershell
npm run typecheck
npm run build
$env:ZR_NATIVE_GPU = '1'
$env:CAPSLOT_STALE_MIN = 'Infinity'
node art/environment/owner-fable-canopy/tools/capslot.mjs astra-cinematic -- node gauntlet/scripts/broll.mjs --dist dist --out gauntlet/out/cinematic-smoke --size 1920x1080 --fps 30 --quality high --time 12.5 --settle 12 --shots gauntlet/out/cinematic-plan/shots.json --test
```

`--test` renders only each start. Before the moving export, make a temporary test array with each shot's start, midpoint and end as fixed poses; inspect all 15 for terrain/branch clearance and leaf detail, then review a short moving sample. `setPose` bypasses the free camera's ground clamp. The test array needs no production changes.

After that review, run the same B-roll command without `--test`, into a fresh `gauntlet/out/cinematic-world` directory. Then record the five-second actual-input insert at the matching native size:

```powershell
$env:LINK_WORLD_ROOT = (Get-Location).Path
$env:LINK_REVIEW_ASSET = 'link-runtime.glb'
node art/environment/owner-fable-canopy/tools/capslot.mjs astra-cinematic-link -- node art/characters/link/capture_play_motion.mjs --flat-video --size 1920x1080
```

The Link harness writes a timestamped `art/characters/link/progress/*-play-motion/` folder, `manifest.json` and `walk-run-idle.mp4`. It checks the encoded frame count, 30 fps and requested dimensions; the commands above should yield 150 native 1920×1080 frames. It simulates 300 ticks at 60 Hz and records every second tick. It uses the accepted default asset and high defaults; do not substitute an older comparison video or `--balanced-render`. Native 1080p appearance and capture cost still need that first real run.

For assembly, set `$linkClip` to that newly printed output's `walk-run-idle.mp4`, then:

```powershell
ffmpeg -framerate 30 -i gauntlet/out/cinematic-world/f%04d.png -i $linkClip -filter_complex "[0:v]setsar=1,split=2[a][b];[a]trim=end=16,setpts=PTS-STARTPTS[a0];[b]trim=start=16,setpts=PTS-STARTPTS[b0];[1:v]setsar=1,setpts=PTS-STARTPTS[l];[a0][l][b0]concat=n=3:v=1:a=0[v]" -map "[v]" -r 30 -c:v libx264 -threads 2 -crf 17 -pix_fmt yuv420p -movflags +faststart gauntlet/out/cinematic-36s.mp4
ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=width,height,nb_read_frames,r_frame_rate -show_entries format=duration -of json gauntlet/out/cinematic-36s.mp4
```

Expected assembly: 1920×1080, `30/1`, 1080 frames, 36 s. Watch the encoded file, including every cut, and retain the frozen commit, bundle/asset hashes, JSON and capture logs beside it. B-roll's `shots.json` alone is not a source receipt.

## Limits to resolve at freeze

- **Timing — implemented:** B-roll now warms and retries with `render(n,0)`, advances once per output frame, and fails before saving a frame that remains uniform after three retries. `node gauntlet/scripts/broll.mjs --check-timing` passes without Chrome: it exercises the real helper with shot warm-up, successful retries and a persistent blank, checking screenshot times and simulation deltas. Existing `--test` callers still get one image per shot, but old captures that advanced time during settling are not pixel-equivalent baselines.
- **Quality and format — implemented, native review pending:** both exporters now accept `--size 1920x1080`; Link retains its 1280×720 default and 30 fps output. Its size parser passes CPU checks and the encoder asserts the requested dimensions. No native 1080p frame has been captured for this preparation. B-roll also accepts 4K and `--fps 60`; 60 fps delivery needs matching real samples from the Link exporter too. Avoid optical interpolation. No platform upload-limit claim is made here.
- **Performance:** six fixed views at high quality submit 7.11–8.87 M triangles / 379–479 calls. These are source-matched render-budget receipts, not measured moving-shot FPS or a promise of recording speed. Output frame rate is an offline sampling rate. Allow the test sample to establish render time and storage before scheduling the full export.
- **Character:** verify the world shots actually hide the cast: B-roll currently only warns if its scene-hook lookup fails. `--character` only preserves visibility; it does not drive the player, and capture-view placement may change with the camera. Use the actual-input harness for shot 4. Hands, clothing contacts and extreme stair knee folding remain unfinished; the flat insert does not validate stairs. A live-control alternative already exists at `?mode=play&hud=0&dev=0`: WASD/arrows, Shift run, Space jump, drag/right stick orbit; P toggles the free camera, whose 1–6 keys recall A–F.
- **Audio:** the shared headless browser is muted and the PNG/video tools produce no audio. This plan is a silent picture edit until a separate original/licensed soundtrack or an actual game-audio recording is selected.

Next is the shot JSON and 15-pose native 1080p visual preflight after the freeze, followed by a short moving sample before full export. The narrow exporter changes are implemented and CPU-checked; no spline editor, new renderer, public gameplay change or social posting is required.
