# Opus handoff — 30-second cinematic, September 24

## Owner's request

Create a new, exceptionally cinematic **30-second** social-media-ready film of the game. The **very first frame must already be a beautiful, fully rendered hero composition**. Pure experience: **no text, titles, captions, HUD, debug overlays, logos, loading screen or cursor**. Show several places, wide compositions, detailed close-ups, Link walking slowly forward **from behind**, running/sprinting, and actually climbing the stairs. Deliver the finished recording, not just a plan. The owner assigned this recording to **their Opus agent in Claude Code**; Astra prepared this handoff and pushed the character work.

## Start from the repaired character

Repository: https://github.com/Leonxlnx/zeldaremake

- Current motion branch: **`codex/walk-arms-sept24`**, [PR59](https://github.com/Leonxlnx/zeldaremake/pull/59).
- Implementation: **`8a11e881`**; final gameplay evidence: **`b6e2060d`**. This handoff is a later commit on the same branch.
- Existing local checkout: **`E:/zeldaremake-astra-motion-sept21`**.
- Use your own clean worktree, suggested **`E:/zeldaremake-opus-cinematic-sept24`**, branch **`agent/opus-cinematic-sept24`**.
- `E:/zeldaremake` has unrelated local work. Leave that checkout intact.
- At handoff, `origin/main` is `67b801db`, the old cinematic delivery. Simply pulling main does **not** obtain the new animation. Inspect fresh remote heads and PRs before selecting your capture source.

For a new worktree, from the existing motion checkout:

```powershell
git fetch --all --prune
git worktree add -b agent/opus-cinematic-sept24 E:/zeldaremake-opus-cinematic-sept24 origin/codex/walk-arms-sept24
Set-Location E:/zeldaremake-opus-cinematic-sept24
npm ci
```

If that worktree or branch already exists, inspect and reuse the appropriate clean checkout. Read `AGENTS.md`, `PROJECT_STATE.md`, `.agents/`, `GAUNTLET.md`, current claims and open PRs. Register `opus-cinematic` and coordinate capture/source ownership with the Fable/Opus environment agents through the existing logs/PRs. Astra's latest character handoff is [PR2 comment5821437768](https://github.com/Leonxlnx/zeldaremake/pull/2#issuecomment-5821437768).

You may integrate an agreed newer environment before freezing the recording, but preserve the repaired character and verify the combined build. Record the exact commit, model and bundle hashes. Other agents can continue on their branches while this capture stays frozen.

**Required character contract:**

- `public/models/link/link-runtime.glb` SHA256: **`8d7efa783d4bbc97d053c0a627a28c3c163351d7828124e1bf10c8232f06cedd`**.
- `src/world/character/glbLink.ts`: run stride **1.20m**, stored cycle **28/60s**, matching model hash, and the final measured-boot floor bound before IK.
- `src/world/character/animation.ts`: run player speed **2.2m/s**, native speed **`1.2/(28/60)`**, walk speed **1.2m/s**. The actual run cadence is220steps/min. Keep speed and stride paired.
- [Source, reference, tests and current motion videos](../art/characters/link/progress/2026-09-24-natural-legs/README.md).
- [Exact-source final forest walk/run/stop recording](../art/characters/link/progress/2026-09-24T19-58-05-058Z-play-motion/walk-run-idle.mp4).

The repaired run has rear heel recovery and smooth hips; its start/stop boot-floor correction is tested. **Stair locomotion still needs shot-specific inspection**, especially deep knee folds on steep risers. Downhill clearance around9.7mm and the bulky boot silhouette remain known limits. Preflight actual stair movement early and fix any capture-blocking issue with the character owner before freezing.

## New edit: exactly30 seconds

Use this as the initial cut; improve framing after inspecting the actual scene. Keep the required actions and total duration.

| Time | Shot | Direction |
| --- | --- | --- |
| 00–04 | **Hero opening** | Start immediately on the strongest wide village composition: warm shafts of sunlight, dimensional foreground leaves, mossy house, stone path and long stairway readable together. Begin a restrained low dolly/parallax move. Frame0 itself must work as the poster. |
| 04–07 | **Craft/detail** | Close moving view of genuinely detailed moss, bark, stone and a warm hanging lantern. Select a surface that holds up close; preserve texture clarity. |
| 07–10 | **Forest scale** | A controlled canopy/sky reveal with layered trunks and lit leaves. Make the upper forest and distant depth visible. |
| 10–15 | **Rear-view walk** | Follow Link from behind as he walks forward along a clear path. Calm camera, readable full body and feet, believable weight transfer; show Navi if it composes well. |
| 15–19 | **Run** | Actual run input, retaining the fixed animation and distance-based cadence. Give it energy with a lower rear/three-quarter tracking camera and foreground parallax. Keep feet and arm movement readable. |
| 19–24 | **Stair ascent** | Show Link really walking up the long stairway through the player controller and terrain IK. Choose a route and framing that visibly demonstrate sound contact and posture. |
| 24–30 | **Final reveal** | Pull back/rise into an expansive, beautiful village/forest composition. Finish with a short, settled view that feels deliberate and complements the opening. |

Aim for a cohesive cinematic progression: intimate details → exploration → motion → scale. Keep sunlight/grade consistent, highlights controlled, shadows grounded and textures sharp. Smooth, restrained camera acceleration and clean cuts; avoid abrupt orbit spins or excessive camera bob. Hold a strong image at both ends. Choose the opening from at least three actual renderer compositions before spending time on the full export. This is your own review step, not a request for another owner approval.

## Reuse the working capture pipeline

1. **World camera moves:** `gauntlet/scripts/broll.mjs`. Supports `--shots`, `--size`, `--fps`, `--quality high`, `--time`, `--settle` and `--test`. `--test` renders only each shot's start; expand the preflight list to include start/middle/end. Its `--character` flag preserves visibility but does not drive Link. Omit `--hud`.
2. **Real character movement:** `art/characters/link/capture_play_motion.mjs` already uses the actual player handle, `setInput`, `__ZR__.setPose` and `__ZR__.render`. Reuse that code in a small cinematic recorder for the new rear-follow path and real stair ascent. The existing `--flat-video` is only a five-second side-view walk/run/stop diagnostic; the owner wants the new sequence above.
3. **Existing final cinematic:** `art/environment/astra-cinematic-final-sept23/{CUT.md,shots.json,preflight-poses.json,delivery.json}` provides proven framing, export/assembly commands and receipt examples. The old opening/canopy/house/path shots are useful starting points. `docs/proposals/astra-cinematic-sept23.md` is an earlier36-second draft; the new30-second brief above takes precedence.
4. **Audio:** existing original game ambience/score and the documented pipeline under `art/environment/astra-cinematic-final-sept23/audio/`. Use forest ambience with a restrained musical rise if it supports the edit. No voiceover or captions. Audio source/provenance must remain clear.
5. **GPU coordination:** `art/environment/owner-fable-canopy/tools/capslot.mjs`; one render job at a time. Use headless Chrome so the owner can keep using the laptop. Blender is unnecessary for recording unless you diagnose an actual asset issue.

Preflight example in the new worktree after creating your new shot JSON:

```powershell
npm run typecheck
npm run build
node art/characters/link/progress/2026-09-24-natural-legs/check.mjs
node gauntlet/scripts/broll.mjs --check-timing
$env:ZR_NATIVE_GPU = '1'
$env:CAPSLOT_STALE_MIN = 'Infinity'
node art/environment/owner-fable-canopy/tools/capslot.mjs opus-cinematic -- node gauntlet/scripts/broll.mjs --dist dist --out gauntlet/out/opus-cinematic-preflight --size 1920x1080 --fps 30 --quality high --time 12.5 --settle 12 --shots YOUR_SHOTS_JSON --test
```

Warm the renderer/shadows/textures before saving frame0. Existing B-roll warmup/retries use `render(n,0)` so time does not advance accidentally. Character motion is simulated at60Hz and recorded every second tick for30fps; maintain that clock in the adapted recorder. Capture at native resolution, with natural animation speed. The old B-roll header includes an optical-interpolation example; use the actual sampled frames for this delivery.

## Delivery and checks

- **Exactly30.000s /900frames at30fps**, native **1920×1080 minimum**, 16:9. Higher native resolution is welcome if preflight proves useful detail and reliable capture. Preserve one delivery size across all shots.
- MP4: H.264, yuv420p, good quality, `+faststart`; AAC48kHz stereo if using audio. Check actual file size and retain a high-quality master.
- New folder: `art/environment/opus-cinematic-sept24/`. Include the finished MP4, **poster.png extracted from the actual first encoded frame**, shot plan, concise README, frame/cut contact sheet and source/asset/bundle/encode receipts. Keep bulky raw frames in ignored capture output.
- Inspect frame0 at full resolution and every cut, check start/middle/end of each camera move, and review walking, running and stairs as motion. Look for clipping foliage, pop-in, temporal flicker, ghosting, camera jumps, sliding boots or knee/arm defects. Iterate before final delivery.
- Verify duration, frame count, dimensions, pixel format and audio with FFprobe; run a complete FFmpeg decode. Verify the encoded film has zero visible text/UI/loading/black lead-in and includes every requested action. Report actual renderer/timing honestly; offline output fps is not a realtime performance benchmark.
- Commit and push the new recorder/shot configuration, final media and evidence on your branch; update your log and post the handoff to the collaborating agents. Preserve the old `cinematic-2026-09-23` tag and its artifacts.

Finish by showing the owner the playable final video and opening poster with the delivery path and commit. Continue through capture, review and export autonomously; the owner has already requested the finished movie.
