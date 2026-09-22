# Native distance-clarity review — 2026-09-22

**Recommend accepting this bounded haze correction for the new owner direction.** In the original A/F images, distant bark columns and yellow/olive foliage separate where the baseline blended them into a grey wall. Near stones, shadows, lantern lighting and the house remain visually stable. Low mist, local shafts and depth separation remain visible. This does not complete the tree-quality work: large blurred cards and dark flat crown masses still dominate the reconstructed upward view.

Source-only candidate **7464eb4405ddcdb69d706ab15727c7914235500a**, based on **664f3418570f51dae5fcc9c2babbd8eb5cd1d0f4**. Only `src/world/atmosphere/heightfog.ts` changes: `hazeDensity` 0.018→0.008/m, `hazeFarDensity` 0.055→0.008/m, and `HEIGHT_FOG_DEFAULTS.farShadeMin` 0.30→0.65. The last value is the atmospheric distance-shade factor, not a tree material floor. Parent independently reviewed original A/F/sky pairs and accepted the exact source as **c241593e**. This agent performed no push; parent owns the combined atlas/fog build and final integrated capture.

## Original evidence and attribution

Original 1280×720 PNGs and manifests are in `before/` and `after/`; `native-pairs.png` is a labelled half-size comparison sheet. All eight original images were inspected. Four views per build used Radeon 780M/D3D11, high quality, pixel ratio/render scale 1, time 12.6 and 14 settled frames. Capture sessions were serialized through capslot with no stale takeover. The final session 39100 exited successfully and released the GPU.

All four pairs have identical cameras, time, lighting, protected atmosphere settings, quality flags, draw/triangle/resource counts, and byte-identical 320×180 native scene-depth maps. Both error arrays are empty. Settings and capture-script hashes match. All served files outside the compiled JS/index match. Each frozen build has 91 hashed files in `builds.json`; the large frozen sites are retained locally and excluded from Git.

| Build | Bundle | SHA256 |
| --- | --- | --- |
| Baseline | index-B1aAZhde.js | e770731c3efef1736545ac0bab146eea225bc0686b4ba2507020966fcda062a6 |
| Candidate | index-DQEncs0e.js | bb077bd2b25f0d3d8dbf454e28ff2b1f3df2643d90c207a6f23eec3819a2eeda |

## Visible and measured result

Masks stay fixed to baseline native depth. The table measures mean absolute adjacent-pixel display-Y difference within each upper-half depth band, at 320×180. This is local image contrast, not recovered geometric detail or scene-linear radiance.

| View / native depth | Pixels | Contrast before → after | Change |
| --- | ---: | ---: | ---: |
| A / 20–50 m | 10,017 | 0.02261 → 0.02865 | +26.7% |
| A / 50–100 m | 5,604 | 0.01390 → 0.01526 | +9.8% |
| F / 20–50 m | 4,147 | 0.02204 → 0.02392 | +8.5% |
| F / 50–100 m | 3,045 | 0.01264 → 0.01813 | +43.4% |

Far display-Y means decrease as the bright veil recedes: A 50–100 m 0.5725→0.4502; F 0.6034→0.4881. This gives visible separation without global exposure or hue changes. The same bands retain substantial atmosphere. The CPU shader trace estimates their average non-emissive surface contribution at A 0.0780→0.4262 and F 0.0620→0.3961; these coefficients are not claims about final pixel brightness.

A/F lower-half 0–5 m mean display-Y deltas are −0.0000080/+0.00000038, respectively. They are stable at displayed precision, not byte-identical; post/edge spill can cross a depth mask. Upper sky mean changes by −0.00067, with the blue openings retained. Left-side shafts still wash some nearby branches because their controls remain unchanged.

About 96% of the reconstructed view's upper half is under 20 m away; sibling ray inspection places the main intervening card around 7 m. It therefore controls near-foliage invariance rather than proving far clarity. Its distant lower-right rows become more distinct, while the dominant blurred cards remain. The original owner's exact live camera was not recovered. Reference-video SSIM changes A −0.0032 / F −0.0039; this is disclosed, since the owner explicitly replaced the older heavy-haze fit with clearer visibility.

## Cost and validation

| View | Submitted triangles, unchanged | Draws, unchanged |
| --- | ---: | ---: |
| Reconstructed upward | 2,039,386 | 131 |
| A | 8,741,301 | 450 |
| F | 7,994,522 | 406 |
| Sky opening | 6,798,034 | 414 |

No sampler, pass, texture, geometry or shader operation was added. Short synchronized static samples (32 after 4 warm frames, including rAF/readback) recorded median/p95: upward 42.4/45.9→35.4/37.8 ms; A 97.5/105.1→61.2/65.5 ms. Separate-session cache/clock effects are uncontrolled; **do not claim a performance gain or gameplay FPS from this sample**.

Passed: CPU fog-profile guards, typecheck, production build, diff whitespace checks, four-view native comparison and anti-cheat (97 checks; historical/absent-official-capture warnings remain). A final integrated project take remains the parent's delivery check; this bounded study is not a gauntlet exit claim.

CPU reproduction:

```powershell
node art/environment/astra-atmosphere-clarity/measure-fog.mjs art/environment/astra-atmosphere-clarity/before
node art/environment/astra-atmosphere-clarity/compare.mjs
```

The capture helper requires the recorded frozen snapshots and refuses to overwrite evidence. It uses `ZR_NATIVE_GPU=1`, `CAPSLOT_STALE_MIN=Infinity`, `CAPTURE_READY_TIMEOUT_MS=900000` and the shared capslot wrapper. Further GPU use requires coordination.

## Exact cameras

Manifests record full-precision position/direction/FOV. The custom reconstructed view uses position `[54.00101693066348,21.992752345655013,-165.33335274009295]`, target `[35.616240619813254,37.51479429090839,-146.9485764292427]`, FOV 60. A uses position `[0.4,1.8,8.6]`, direction `[0.4001487551488514,-0.05779926463261199,-0.9146257260545179]`, FOV 46. F uses position `[-1.96,1.8,4]`, direction `[0.9721254966661625,-0.06836560096623101,-0.22427252024288002]`, FOV 46. Sky uses position `[0,1.8,0.5]`, target `[0,18,-15]`, FOV 72.
