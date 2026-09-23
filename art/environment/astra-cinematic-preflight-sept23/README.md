# Cinematic camera preflight — 23 September 2026

Fifteen original **1920×1080, DPR 1, high-quality** renderer stills test the start, middle and end of the five world shots in the [36-second proposal](../../../docs/proposals/astra-cinematic-sept23.md). Arrival and log-path framing are usable. Canopy and house need the small camera revisions below; the stair route needs a cost/framing review. This is a successful native 1080p B-roll tool smoke check, not a video, final freeze, gameplay or real-time FPS acceptance.

Captured source: `cd834342e4f72ca194ef1dc119d5b80e0ac402a1`; bundle `index-DwReWLkW.js`. The exporter used a frozen copy of that build, not the moving development server. Its full distribution hash was verified before and after capture. [Inputs and hashes](inputs.json), [exact poses](poses.json), [verified frame mapping](verified.json), [runtime receipt](native/runtime-receipt.json), [terminal log](native/capture.log).

Actual renderer: `ANGLE (AMD, AMD Radeon 780M Graphics (0x00001900) Direct3D11 vs_5_0 ps_5_0, D3D11)`. Capture ran 19:23:33–19:29:02 UTC. All 15 PNG hashes, dimensions, positions, target directions and FOVs match the receipts and inputs; zero retries and zero page/console errors. Character hidden, visible NPC count zero, HUD absent, developer/loading UI invisible. Existing lighting stayed at sun azimuth −128°, elevation 38°, intensity 4.4 and colour `#ffe7bf`.

## Original frames and review

Every linked image is the untouched full-resolution canvas PNG. All 15 were inspected; canopy, house and stairs also received an independent visual review.

| Shot | Start | Middle | End | Result; triangles / draw calls |
| --- | --- | --- | --- | --- |
| Arrival | [f0000](native/f0000.png) | [f0001](native/f0001.png) | [f0002](native/f0002.png) | Keep. Door and stair entrance remain clear; lantern branch frames the path. 8.40–8.62M / 463–464. |
| Canopy | [f0003](native/f0003.png) | [f0004](native/f0004.png) | [f0005](native/f0005.png) | Revise tilt. Middle/end lose village context and expose broad, flat dark foliage layers against sky. 5.78–8.41M / 294–449. |
| House | [f0006](native/f0006.png) | [f0007](native/f0007.png) | [f0008](native/f0008.png) | Shorten approach. Door stays clear, but the endpoint crowds its threshold against the lower edge and crops sign/pots. 8.60–8.94M / 430–436. |
| Stairs | [f0009](native/f0009.png) | [f0010](native/f0010.png) | [f0011](native/f0011.png) | Hold for review. Treads remain readable; final framing loses the right lantern and makes blunt boughs/flat distant crowns prominent. **9,285,991–9,635,277 triangles**, above 9M at all three poses; 441–449 calls. |
| Log path | [f0012](native/f0012.png) | [f0013](native/f0013.png) | [f0014](native/f0014.png) | Keep. Path and arch stay unobstructed with useful depth; foreground objects exit the edge naturally. 7.79–7.98M / 408–420. |

No obvious near-plane clipping or branch across the featured house doorway was observed. The high canopy angles expose flat foliage silhouettes; these images do **not** establish an unmistakable rectangular sky tile. Static samples cannot establish motion continuity, LOD stability, leaf/shadow flicker or clearance everywhere between the checkpoints.

Minimal proposed camera changes, not applied to the original plan or its captured inputs:

- **Canopy:** change only the end target from `[9.7,12,1.31]` to `[9.7,8,1.31]`; retain end position `[-1.4,2.4,3.6]` and FOV 46. This lower tilt is unrendered and needs a new three-pose check.
- **House:** use the captured midpoint as the new end: position `[4.2,2.35,-4.35]`, target `[12,3.9,-11.25]`, FOV 42. That endpoint has been inspected; the shortened route's new midpoint and motion have not.
- **Stairs:** do not accept this route on the strength of fixed-view world evidence. No verified camera-only budget fix was found in these 15 frames; choose/recheck a lower-cost route before recording.

## Executed capture

The existing B-roll `--test` writes one frame per input shot, so [poses.json](poses.json) expands each planned world shot into three fixed poses. Midpoints use the exporter's smoothstep at 0.5. This was one serial GPU slot, released at terminal completion; no user input was taken over.

```powershell
$env:ZR_NATIVE_GPU = '1'
$env:ZR_URL_EXTRA = 'hud=0'
$env:CAPSLOT_STALE_MIN = 'Infinity'
node art/environment/owner-fable-canopy/tools/capslot.mjs astra-cinematic-preflight -- node --import ./art/environment/astra-cinematic-preflight-sept23/observe.mjs gauntlet/scripts/broll.mjs --dist gauntlet/out/cinematic-preflight-cd834342/dist --out art/environment/astra-cinematic-preflight-sept23/native --size 1920x1080 --fps 30 --quality high --time 12.5 --settle 12 --shots art/environment/astra-cinematic-preflight-sept23/poses.json --test 2>&1 | Tee-Object -FilePath art/environment/astra-cinematic-preflight-sept23/native/capture.log
exit $LASTEXITCODE
```

This is the historical command; preserve this evidence directory when making a future take. The [receipt observer](observe.mjs) forwards the existing browser launch/screenshot calls and reads metadata after each PNG. It does not set a camera, step time, render, change visibility or transform pixels. It currently writes its receipt into this take's `native` directory.

For each still the exporter performs 11 warm renders at `dt=0`, then one at `dt=1/30`. Actual simulation time progresses from 12.5333333333 to 13.0 seconds across the batch. These are composition checkpoints close to a common time, **not** snapshots at the proposed edit's elapsed timestamps. Startup was 189.9 seconds and the capture loop reported 128 seconds including cold setup and PNG/receipt work; neither measures real-time FPS.

The actual-input Link insert was deliberately not captured here. Its native 1080p route, the moving world routes, final edit, encoding and audio remain unverified. No world/source tuning or final recording was performed for this preflight.
