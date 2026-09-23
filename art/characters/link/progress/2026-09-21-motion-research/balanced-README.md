# Balanced torso — independent CPU verification

The balanced candidate produces about **±2 degrees of shoulder-line yaw** while preserving the baseline's complete measured hip/leg, root, foot-contact and IK traces. Its authored chest/head loop endpoints close exactly in stored quaternion components. **The existing strict native head-orientation assertion fails:** the 113-sample maximum is 0.001389 degrees, above its 0.0001-degree tolerance. The failure is retained, not hidden by changing the tolerance.

| Input | SHA256 |
| --- | --- |
| Upright-stairs baseline | `e3ef74a02336b5f6952ed340e8191369284dacc92da9b5782dd9f3cb7dceb552` |
| Balanced torso candidate | `053a1536b456a08f2e40adf813724d24c21ee60b80c900eda1d16734416172e6` |
| Actual runtime `src/world/character/glbLink.ts` | `63904e225810b56337bfaecde9fd4aef1e809248ea952e9461dcf771a9272107` |

The runtime hash matched before/after measurement and at the independent follow-up check. This differs from the earlier full-turn study's runtime hash; use each report's pinned source when comparing results.

## Method and preserved data

`balanced-compare.mjs` is the existing `compare.mjs` with only its candidate/output names and invocation comment changed. It uses a blank local page, the actual Three.js mixer and production puppet, and no renderer. `ZR_NATIVE_GPU=0`. The exported animation is sampled at 113 evenly spaced phases including both endpoints. Capture and play each warm for 120 frames and then measure 600 frames at 60 Hz, at 3.9 and 4.6 m/s respectively; head-look and jumping are disabled.

The initial file assertions pass: only `run:chest.rotation` and `run:head.rotation` select changed samplers; the original binary prefix, rest data, other clips and all unselected channels remain exact. Every measured world-matrix element of hips, both thighs, knees, ankles and toes is identical in all three modes, with matching trace hashes. Both production modes also have identical complete root/foot/IK trace hashes. Clip specifications, stride and cadence match exactly.

The original comparator stops at its native head assertion, so its output does not claim `structuralChecksPass`. The remaining assertions were then checked independently against the saved results: all pass. That separate result is recorded in `balanced-checks.json`; the original failure and stdout remain in `balanced-comparison.json` and `balanced-check-output.log`.

## Measured motion

| Measurement | Baseline | Balanced candidate |
| --- | ---: | ---: |
| Play shoulder-line yaw | 0° | −2.016989…+1.987474° |
| Mean torso lean, hips to neck | 5.250245° | 5.248433° |
| Mean chest-segment lean | 7.445472° | 7.442917° |
| Run stride | 1.82 m | exact |
| Native cycle | 0.466666669 s | exact |
| Full-speed cycle / cadence | 0.395652 s / 303.2967 steps per minute | exact |
| Shared flight fraction, both audited foot gaps >1 mm | 56.8333% | exact |
| Root vertical range | 0.975126 mm | exact |
| Minimum audited footprint gap | −0.002729 mm | exact |
| Play reach-clamped frames | 0 | 0 |

Play hand-joint displacement peaks at **10.4014 mm left / 10.3913 mm right**; means are 6.1779 / 6.3080 mm. Head-joint displacement peaks at **1.16928 mm**. These translations are distinct from the compensated head's small orientation residual. Elbow-flexion means remain 81.235427° left / 80.827106° right, within floating-point noise of the baseline. Small projected lean changes do not establish a new authored forward bend.

| Head world-orientation difference | Maximum |
| --- | ---: |
| Exported-native, 113 phases | 0.001389084° |
| Capture, 600 frames | 0.001848269° |
| Play, 600 frames | 0.002767536° |

The play residual corresponds to 5.80 micrometres at a 120 mm head radius. The orientation is closely preserved, not exact. The baseline chest/head curves contain 35 keys; the candidate contains 113 on the intended grid. Because a residual is present even on that grid, it cannot all be described as interpolation solely between the candidate's new keys. The precise import/reauthoring/export contribution was not isolated in this CPU check.

Both variants' zero-dt play redraws have **0° measured head change**, right-hand translation 0 and left-hand translation only 2.24e−16 m.

## Loop evidence and limits

Default `LoopRepeat` can wrap a mixer sample at `clip.duration` to phase zero. The original comparator's endpoint fields therefore describe playback closure, not independent proof that authored last keys match the first. `balanced-endpoints.mjs` separately reads the raw float32 GLB accessors: baseline and candidate chest/head first and last quaternion components are identical. Candidate times span 0…0.466666669 s with all 113 keys. Its raw endpoints are:

| Channel | First quaternion = last quaternion, XYZW |
| --- | --- |
| Chest | `[0.06495050340890884, 0.010690036229789257, -0.0006958323647268116, 0.9978309869766235]` |
| Head | `[-5.5878008886622865e-9, -0.010690037161111832, 0.0006958322483114898, 0.9999426603317261]` |

This proves endpoint pose closure for the selected channels. It does not establish angular-velocity continuity at the seam. Foot figures describe the runtime footprint audit on flat terrain, not full deformed-shoe/terrain collision.

The separate existing native contact audit is a visual tradeoff: total contacts **1452→1503**, below-armpit contacts **235→234**, peak **99→98**. This CPU lane did not run that audit or judge images. No collision-free, universally improved, visual-acceptance, stair-route or phase-exit claim follows from these results.

Reproduce from the worktree root:

```powershell
$env:ZR_NATIVE_GPU='0'
node art/characters/link/progress/2026-09-21-motion-research/balanced-compare.mjs
# Expected exit 1 at the disclosed strict native-head tolerance assertion.
node art/characters/link/progress/2026-09-21-motion-research/balanced-endpoints.mjs
# Passes the independent raw-key endpoint check.
```

Only new `balanced-*` research files were written. No production source, GLB, Blender scene, GPU workload, license or correspondence was changed.
