# Curved stair support: CPU diagnosis and regression

This study measures Link’s rendered boot soles against the actual outward-facing stone and timber meshes. It is a contact correction, not acceptance of the stair animation’s posture.

The final **raw-production** replay passes all **327 production sole vertices × 940 steady poses**, with minimum clearance **+1.188 mm uphill / +2.066 mm downhill**. This includes outward-facing timbers, dense planned/current sole support, the dense hip endpoint guard, and the independently reviewed fix that includes steep upward timber shoulders in the ground rasterizer. Exact source, asset and geometry hashes are recorded in `verification.json`. This is a finite path result; the actual-player transition capture is separate.

## Root causes

1. At uphill frame 129 the pinned marker’s SINK envelope selected 1.368457 m, while the crown beneath an interior boot point requires substantially more support. The center plus four corners missed the round crown. Pitch and ground tilt were both zero; the planted position was not drifting. The first patch samples the planned sole plane at the existing 1 cm support-grid spacing before pelvis support and IK.
2. At downhill frame 522 the correct support was calculated but the arbitrary 0.3 m upward correction cap truncated the foot through the surface. The patch retains the downward/root bound and the solver’s actual two-bone reach check, and removes the upward truncation.
3. The moving foot can pass over a crown between the planned take-off and landing points. After tilt is known, the extension reuses the same support scan at the current oriented sole before creating the IK target. There is no constant clearance padding or post-IK lift.
4. The later hip-posture adjustment could translate an otherwise clear sole into the crown interior. A seven-point guard still missed uphill frame 184. The same oriented plane now participates in the existing endpoint bisection, alongside the seven original point tests. At that frame it rejects the 0.02190 rad hip correction; the full-sole minimum changes from −1.948 mm to +1.189 mm.

`footprintSupport` samples a virtual flat rectangle in measured foot coordinates. The basis lengths are retained, including the asset’s inherited scale. The hip guard preserves an existing negative plane gap rather than inventing a positive clearance margin. This is an endpoint test, not continuous swept collision detection.

## Evidence and boundaries

- Asset: frozen `e3ef74a0…` stair/upright candidate, fixed phase references and X/Z/yaw traces from the existing motion diagnostic. Root’s later baked `305603e9…` default preserves this geometry and motion, but its final native run remains a separate check.
- Timbers: outward index-buffer SHA-256 `452caf0d203b51ee61d10228162eac29ed873bc4651f2b55eabbc4ebecb8a29c`. The former inward-winding result is invalid because FrontSide rays missed the crown.
- Sole set: the same 12 mm rest-height band and dominant-ankle selection used by production `measureFootprint`, including mixed-weight vertices: 163 left + 164 right. An earlier 194-vertex strong-weight subset missed real penetrations and is not the final criterion.
- Per direction: frames 120–589 inclusive, warmed from frame 80, 470 poses at 60 Hz. This does not establish clearance on arbitrary routes, clip blends, or all boot/leg geometry.
- 307,380 exact triangle queries cover every selected sole vertex; 7,520 independent native `THREE.Raycaster` marker comparisons agree within 1.78e−15 m. Another 3,924 native rays check all 327 vertices at 12 critical poses. All queried vertices hit real stair geometry.
- Flat idle/walk/run skeleton traces match the original hashes exactly. No two-bone reach clamp occurs.
- The native run before the swing extension had its eight-marker minima at uphill frame 96 and downhill frame 80. Those poses are outside this measurement interval and depend on earlier pin history; this replay must not be presented as reconstruction of those exact native poses.

The swing/hip extension alone leaves every pelvis-Y sample identical to the first dense-stance patch. Relative to the original undersampled baseline, that first patch raises root support by up to 44.155 mm uphill / 29.543 mm downhill. **The later timber-shoulder fix changes the ascent support sequence:** pelvis Y differs by up to 270 mm from the previous sampler, with differences above 1 mm over frames 298–355, 386–443. This is an earlier full-riser support choice, not an instantaneous 270 mm jump: peak frame-to-frame root steps remain 31.105 / 23.890 mm (original 30.946 / 23.446 mm). Descent pelvis Y is unchanged to floating-point precision. The new ascent sequence must be inspected in the native capture.

The shoulder fix reduces peak knee folds from 174.670° / 166.820° to **168.264° uphill / 166.702° downhill**. It also removes the old 9.135 mm ascent planted drift from this trace; the final maxima are approximately **0.00164 / 0.00125 mm**. These are still extreme knee poses, so contact correctness is not natural-animation acceptance. The independent future-landing study remains held because its candidates introduced new contact failures.

## Cost

Measured surface-sampler calls per pose, including the same diagnostic instrumentation:

| Fixture | Uphill mean / max | Downhill mean / max |
| --- | ---: | ---: |
| Original, outward timbers | 1,925 / 2,430 | 1,934 / 2,709 |
| Dense stance + physical reach | 2,629 / 3,362 | 2,628 / 3,559 |
| Swing + dense hip-plane guard, previous sampler | 3,101 / 5,466 | 3,095 / 5,831 |
| Final production, including timber shoulders | 3,108 / 5,448 | 3,148 / 6,124 |

Final production adds **18.21% uphill / 19.76% downhill** average sampler work over dense stance, or **61.43% / 62.79%** over the original undersampled baseline, with larger rare bisection peaks. These counts are reproducible operation counts, not a GPU or uninstrumented production frame-time benchmark. The terrain branch still uses the previous support path unless rendered relief or a tread edge triggers the dense planner; the swing scan requires locomotion, a distinct rendered sampler, swing weight above 0.5, and a take-off/landing rise above `STEP_MIN`.

## Reproduction

Run from the repository root with its installed dependencies. Both scripts use an empty browser page and CPU Three.js math; they do not create a WebGL renderer.

Small production regression, with no historical Git dependency:

```powershell
node art/characters/link/progress/2026-09-21-curved-support/check.mjs
```

Explicit negative control, requiring historical commit `6c13f70c`; expected to exit nonzero with 9.284 mm missing support under the corrected current ground sampler (35.996 mm with the earlier shoulder-omitting sampler):

```powershell
node art/characters/link/progress/2026-09-21-curved-support/check.mjs --before
```

Full current-production proof after root applies both patches:

```powershell
$env:ZR_NATIVE_GPU='0'
node art/characters/link/progress/2026-09-21-curved-support/replay.mjs --working-source --with-logs --assert-curved --asset=art/characters/link/progress/2026-09-21-motion-integration/stairs-upright-candidate.glb --asset-sha=e3ef74a02336b5f6952ed340e8191369284dacc92da9b5782dd9f3cb7dceb552 --phase-reference=art/characters/link/progress/2026-09-21-stair-clearance/phase-reference.json --manifest=art/characters/link/progress/2026-09-21-stair-clearance/motion-input.json --output-dir=art/characters/link/progress/2026-09-21-curved-support/production-shoulder-all-sole
```

`--working-source` tests current production without applying a fix in memory. The explicit proposal flags in the diagnostic exist only to reproduce older study stages; they must not be supplied after production has the patch. `check.mjs` never applies a proposal implicitly. Its compact `plant-fixture.json` contains only the frame-129 trace and actual right-boot contact offsets.

## Files

- `verification.json`: compact successful raw-production metrics, before/after stages, exact source/asset/geometry provenance, and the material root-sequence change after the timber-shoulder fix.
- `check.mjs`, `plant-fixture.json`: minimal production regression to commit.
- `baseline-summary.json`: original constraint metrics and flat hashes, so assertions do not depend on a bulky historical trace.
- `replay.mjs`: full CPU experiment. It uses the shared exact-triangle helper under `../2026-09-21-stair-clearance/knee-peaks/exact-mesh-height.mjs` and the existing phase/input fixtures; keep those alongside it when retaining a portable full replay.
- `swing-support.patch`, `swing-support-proposal.mjs`: final review patch and explicit historical in-memory transform. Root owns production application. The final helper/JSDoc relocation was checked to emit identical comment-free TypeScript to the passing candidate.
- `curved-support.patch`, `curved-support-proposal.mjs`: earlier stance/cap patch, already applied by root. Do not apply again.
- Full local traces in `baseline/`, `dense-plan/`, `dense-plan-cap/`, `dense-detail/`, `production-full-sole/`, `swing-support/`, `swing-support-all-sole/`, `swing-and-hip-all-sole/`, and `production-shoulder-all-sole/` preserve rejected and accepted stages. They need not all be committed. Full source snapshots are review conveniences, not separate runtime implementations.
