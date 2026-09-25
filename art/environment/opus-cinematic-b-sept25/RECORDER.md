# opus-cinematic-b-sept25 — the recorder

`record.mjs` renders the whole film from the built game, headless, on the native GPU. It handles both camera-only shots (Link hidden, broll-style) and shots of the real character: the actual game's `PlayerHandle`, driven by input at 60 Hz.

## Run it (always through capslot, from the repo root, PowerShell)

```powershell
# freeze a dist snapshot first (dist/ can be rebuilt by others at any time)
robocopy E:\zeldaremake-cinematic-b\dist E:\zeldaremake-cinematic-b\gauntlet\out\opus-cinematic-b-sept25\dist-rec /MIR

$env:ZR_NATIVE_GPU='1'; $env:CAPSLOT_STALE_MIN='Infinity'; node art/environment/owner-fable-canopy/tools/capslot.mjs opus-cinematic-b -- node art/environment/opus-cinematic-b-sept25/record.mjs --shots art/environment/opus-cinematic-b-sept25/shots.json --dist gauntlet/out/opus-cinematic-b-sept25/dist-rec --out gauntlet/out/opus-cinematic-b-sept25/take1 --size 1920x1080 --only 01-open,06-walk-back
```

- **Check the shots file without a GPU:** add `--dry`. It validates the file, prints the edit plan (frame ranges, world times, and rough Link positions), then exits.
- **Quick look:** `--test` renders only u = 0, 0.5 and 1 of each shot into `<out>/test/<name>-u0.png`, `-u0.5.png` and `-u1.png`. `--test-u 0.5` renders a single frame.
- **Keep each capslot job under 45 min, boot included** (about 5 min). Another agent's capslot takes over a lock older than 45 min. Split the film with `--only`. Frames are written in place at `<out>/frames/f%04d.png`, numbered by the shot's global frame index in the edit, so any subset can be re-recorded without renumbering. The script prints per-frame ms and an ETA.
- **`--verify`:** after each player shot, the recorder re-simulates the shot twice and compares every tick: (1) the same sim-only ticks again, for determinism; (2) fully rendered ticks, to check that skipping the post-fx on unrecorded ticks changes nothing. The results go in the receipt under `shots.<name>.determinism` and `.equivalence`.
- **Other flags:**

  | Flag | Default | Meaning |
  |---|---|---|
  | `--fps` | 30 | Must divide 60 |
  | `--settle N` | 12 | Default for shots without their own `settle` |
  | `--url-extra` | `hud=0&warmup=1` | |
  | `--time` | 12.5 | World time of the first shot when it has no `time` |
  | `--quality` | high | |
  | `--full-ticks` | off | Render every 60 Hz tick |

## Outputs (`--out`, keep it under `gauntlet/out/opus-cinematic-b-sept25/`, git-ignored)

- **`frames/f%04d.png`:** the frames.
- **`receipt.json`:** merged across runs.
  - Per run:
    - Git HEAD and `status --porcelain`
    - Recorder, broll and browser-lib sha256
    - Shots-file sha256
    - Every `dist/assets` file with its sha256
    - `link-runtime.glb` sha256, fetched from the static server as served
    - Browser version, Chrome launch args, and the WebGL renderer string
    - Drawing-buffer size, boot seconds, and ms/frame for camera and player shots
  - Per frame:
    - `{file, sha256, bytes, shot, i, u, editTime, simTime, cameraPose{set,actual}, triangles, calls, retries}`
    - Player shots add `root, pos, smoothedRoot, gait, stance[{foot,stance,gapM,minShoeGapM}], reachClamped, cameraClamped`.
  - `sequenceHash` = sha256 of the lines `"file sha\n"`.
- **`steps-<shot>.json`:** one row for every 60 Hz tick, from the start of the preroll to the last recorded frame.
  - `edit` is the time in the cut: `shotStartEdit + (k − firstRecordedTick)/60`.
  - `rec` is true inside the recorded frames.
  - `stance`, `gapM` and `minShoeGapM` come from `PlayerHandle.feetContact()`. Foot names come from the character audit.
  - Each row also has `gait`, `chain`, `root`, `pos`, `heading`, `speed` and `jump`.
  - `events[]` lists the stance rising edges (footfalls) as `{edit, k, foot, gait, rec}`. Sound design syncs footsteps to these.

The recorder asserts all of the following and aborts if any fails:
- `ZR_NATIVE_GPU=1` is set, and the renderer is not SwiftShader.
- The drawing buffer and canvas equal `--size`.
- No `webglcontextlost` event fires.
- `npcsVisible === 0`, and the character is visible in player shots.
- simTime equals the planned world time for every frame.
- No frame is uniform (blank). A uniform frame gets up to 3 retries with `render(2,0)`.

The HUD, `#dev`, `#loading` and the cursor are hidden.

## Shot file

The file is an array, or `{"total": 30, "shots": [...]}` (the frame sum is checked against `total`). Shots are listed in edit order, and `s*fps` must be an integer.

**Camera shot.** Link and Navi are hidden.
```json
{"name":"01-hero","kind":"camera","s":4,"time":12.5,"settle":24,"ease":"smoothstep",
 "keys":[{"u":0,"p":[x,y,z],"t":[x,y,z],"fov":46},{"u":0.6,"p":[...],"t":[...],"fov":44},{"u":1,"p":[...],"t":[...],"fov":42}]}
```
- broll's `{"from":{p,t,fov},"to":{p,t,fov}}` is also accepted.
- Keys use centripetal Catmull-Rom on `p` and `t` (two keys give a straight lerp) and a lerp on `fov`. `u` is eased with `smoothstep`, `linear`, `easeInOutCubic`, `easeOut` or `easeIn`.
- Frame i is rendered at world time `time + i/fps`, exactly as broll does: warm renders at dt 0, then `render(1, 1/fps)`.
- Without `time`, the world clock continues from the previous shot. It is resolved in the plan, so `--only` reproduces the same times.

**Player shot.** This is the real game character.
```json
{"name":"02-walk","kind":"player","s":5,"time":20,"settle":24,"skip":0,
 "player":{"start":[x,z],"anchor":"preroll|record","face":[dx,dz],"preroll":1.0,
           "input":[{"at":0,"dir":[dx,dz],"mag":1,"run":false,"jump":false},{"at":3.2,"dir":[0,0]}]},
 "camera":{"mode":"follow","back":3.2,"side":0.4,"height":1.45,"aim":0.9,"lead":0.6,"fov":40,"tau":0.4,
           "dolly":{"to":{"back":2.4},"ease":"smoothstep"}}}
```
- **Action clock:** 0 is the first recorded frame of the unskipped action, and its world time is `time`. Frame j is at action time j/fps and world time `time + j/fps`.
- **`input[].at`** is in seconds on the action clock. Negative values are allowed and apply during the preroll. Before the first entry, the first entry applies. `dir: [0,0]` means stand still (the gait brakes and blends to idle).
- **Preroll:** `preroll` seconds are simulated before action 0 and not recorded, so Link has turned and reached a steady gait.
  - `setPlayMode(true)` always resets Link to yaw π, and there is no yaw setter.
  - `face` spends the first ticks turning in place: input magnitude 0.06 for |Δyaw|/9 rad/s. Use it for shots that start idle.
- **`start` and `anchor`:**
  - `anchor: "preroll"` (the default): `start` is Link's position at the start of the preroll.
  - `anchor: "record"`: `start` is his position at action 0. The recorder solves for the preroll start in up to 4 sim-only passes.
- **`skip: N` seconds:** simulates, without saving, the first N·fps frames of the action. Two shots with the same `time` and `player` block therefore show the same deterministic action from two cameras: shot A has `s: 2.8`, and shot B has `skip: 2.8` with a different camera. This lets you cut on action.
- **Camera modes:** all positions are relative to a smoothed Link root, built as follows:
  - Link's world root goes through a critically damped low-pass (SmoothDamp) with time constant `tau` (default 0.4). The y axis uses `tauY` (default max(0.6, tau)). This removes the hip bob and the stair steps.
  - The lag is compensated using the kinematic velocity (`comp`, `compY`, both default 1; set 0 for a plain lagging low-pass).
  - The heading is smoothed with `tauH` (default 1.5·tau).
  - The camera is kept at least `clearance` (default 0.25 m) above the terrain and the analytic stair treads.

  | Mode | Parameters | Behaviour |
  |---|---|---|
  | `follow` | `back`, `side` (+ = Link's right), `height`, `aim`, `lead`, `fov` | Behind Link, looking at a point `lead` m ahead of him and `aim` m above his root. |
  | `track` | `side`, `back`, `height`, `aim`, `lead`, `fov`, `axis` | Moves parallel to his path. The axis is frozen at the first recorded frame unless `axis:[dx,dz]` is given. |
  | `lead` | `ahead`, `side`, `height`, `aim`, `fov` | In front of him, facing him, retreating as he advances. |
  | `fixed` | `p`, and `t` or `aimAtLink: true` (+`aim`), `fov` | Static, and pans to follow him. |
- **`dolly`:** lerps any numeric parameter, or array parameter such as `p`, to `dolly.to` over the recorded frames, with easing.
- **Clock:** one `page.evaluate` per output frame.
  - It runs 2 sim ticks of 1/60 with the input for each tick. The post-fx render is skipped on those ticks: `composer.render` is a no-op, and the simulation never reads the GPU.
  - It then sets the camera from the updated root, runs the warm renders at dt 0 (first frame only), and makes the output render at dt 0.
  - The simulation is identical to rendering every tick; `--verify` checks this.
- **Time jumps:** `setTime` is followed by a forced clock-jump reset (`isTimeJump` → `resetLocomotion`), so a shot does not depend on what ran before it.

## Changes in opus-cinematic-b-sept25 (on the phase1 world)

The recorder was copied from `agent/opus-cinematic-sept24` (991de9bb), where it had never finished a run. Here it was verified on phase1 (`--test --verify`: determinism and sim-only/fully-rendered equivalence IDENTICAL on every player shot) and changed as follows:

- **Yaw setter.** Phase1's `PlayerHandle.place(x, z, yaw)` places Link facing `player.face`, or else the first moving input's direction. The old turn-in-place input (magnitude 0.06, which engaged the walk and crept him ≈ 0.07 m/s) is gone; `face` is now only an initial heading.
- **Hiding without recompiles.** Camera shots hide Link and Navi, and every shot hides the kids, by hiding their drawables and dimming their lights to 0 **for the one render call** (a wrapper around `scene.userData.composer.render`), then restoring them. Toggling the groups' `visible` took Navi's and the fairies' PointLights out of the scene, changed `NUM_POINT_LIGHTS` and recompiled every lit program (≈ 4–5 min per switch on the Radeon 780M). Now every shot uses the programs compiled at boot (`warmup=1`).
- **Persistent Chrome profile** (`--profile`, default `gauntlet/out/opus-cinematic-b-sept25/chrome-profile`): Chrome's GPU program cache survives between runs (boot 264 s → ≈ 170–190 s, first frame 295 s → ≈ 100 s). It changes compile time only, never pixels.
- **Camera floor clamp** uses the live terrain, `PlayerHandle.groundHeight` / `surfaceHeight` (decks, the grove flight, spans) and the analytic main-village treads. Camera shots record `clearanceM` per frame and log `CAMERA … m over the ground` under 0.3 m.
- **Per-shot composer overrides:** `"atmo": {"fanMix": 0.4}` sets `window.__ATMO_SETTINGS__` for that shot (composer.ts reads it every frame); `null` otherwise.
- **`"drive": "direct"`** (per shot, default `"pose"`): after the first frame (which always goes through `__ZR__.setPose`, the forced LOD reset), the camera is moved directly on `__H.camera`, so the systems' own per-frame camera checks run with their hysteresis and travel gates instead of re-ranking every LOD pool from scratch each frame.

## Known limits

- **Stair treads under the camera clamp** for the main village come from the layout audit's stair boxes; other walk surfaces come from `PlayerHandle.groundHeight` / `surfaceHeight`.
- The screen-anchored god-ray fan (`shafts.ts`) does not move with the world in pans; use `atmo.fanMix` on shots where that reads.

