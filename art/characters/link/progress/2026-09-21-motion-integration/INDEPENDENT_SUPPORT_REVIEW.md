# Independent support-code review — 2026-09-21

Reviewed the unstaged character changes after `59cba21b`, through the real call chain: `index.ts` movement/pose dispatch → `Puppet.pose` → predicted take-off/landing and pinned `footConfig` calls → root support → foot targets → `solveLeg` → hip guard → knee swivel → contact reporting. Also reviewed `ground.attachSurface`, its rasterizer and the diagnostic entry points. No production edits or GPU work by this review.

Snapshot: `glbLink.ts` SHA256 `4c3fb0de6a31647e13c2d3c6609274b6ca1c86b7f7d6db04959a7787199091b9`; `ground.ts` SHA256 `68b85283fc864eb74143fceeece94a0600e3941cc1183bfb472a3bbedf80e27f`. The later swing-support proposal is a separate change until integrated and checked.

## Finding fixed during review

The original `2026-09-21-curved-support/check.mjs` silently applied `patchCurved` when the production dense-scan marker was absent. It could therefore pass after the actual correction was removed. The check's owner replaced that fallback with the raw production source and replaced its 6.8 MB generated-report dependency with the 1,262-byte `plant-fixture.json`: the exact frame-129 planning input and four measured right-boot points, with provenance. The historical Git source is now read only inside explicit `--before`; the positive default no longer requires commit `6c13f70c` locally. The entry point explicitly sets `ZR_NATIVE_GPU=0`.

## Code conclusions and limits

- **Hip guard:** the stored offsets use the final preserved ankle orientation `qTilt * qAnkle`, so translating the rotated hip-to-ankle target is the right endpoint calculation. Seven scratch entries fit the six footprint points plus sole. `lo = 0` starts valid by construction; each accepted midpoint preserves that invariant. Discontinuous/nonmonotone stair heights can make the search conservative, but do not invalidate its retained endpoint. It does not find a guaranteed largest valid rotation or test a swept path. Preserving `min(0, originalGap)` deliberately preserves existing penetration rather than claiming to fix it.
- **Reach remains a separate condition:** `solveLeg` clamps the requested distance without changing `leg.target`. For an unreachable target, a guard checked around that requested target cannot guarantee the final rendered ankle's contact. The retained e3ef replay reports zero reach clamps and corrections up to 0.3321 m, so retaining the old 0.3 m upward cap would cut valid support. Keep reach-clamp reporting and contact checks; removing that cap is not a guarantee for every possible terrain height. Downward correction and root-drop caps remain bounded.
- **Dense planning:** its yaw/pitch signs are consistent: toe-down lowers a point by `along*sin(pitch)`, so adding that term to required marker height is correct. The scan is conditional on detected relief/edge, samples a plane on the 1 cm grid, and runs at planned contact locations. It cannot by itself guarantee full deformed-shoe clearance at the current swing/pin location. The known 327-vertex early-swing residual and ongoing oriented-swing proposal address that separate path. Hip guard coverage still consists of seven points.
- **Ground integration:** optional timber is merged only for rendered foot support; analytic `height`, player step gating and stone-only fallback retain their paths. Existing one-time surface attachment and world-space-mesh assumptions are unchanged. No additional correctness defect was found in the new merge/disposal path.

## Cost and regression scope

The recorded left footprint yields **315 additional surface queries per triggered `footConfig`**. Each active swing clip calls it twice per foot; transition blends multiply this work. The seven-point guard has at most 630 surface queries per tested leg when all nine endpoint/bisection checks read all points. It creates no per-frame arrays, but allocation-free does not mean free.

Previously recorded same-lane replays show median surface-query counts rising from **1901→2535 ascent** and **1905→2556 descent** with dense planning. Those counts are useful; their heavily spiked wall times are not a controlled performance benchmark. No frame-rate conclusion follows. Preserve the relief gate and measure actual CPU frame cost before broadening this to every surface or actor.

Minimal regression files to stage alongside the production changes:

1. `art/characters/link/progress/2026-09-21-curved-support/check.mjs`.
2. `art/characters/link/progress/2026-09-21-curved-support/plant-fixture.json`.

Run from the repository root with `ZR_NATIVE_GPU=0`. The positive check must inspect the current runtime and actual outward-facing stone/timber generators, preserve flat support and pinned placement, and fail if planned support misses the physical crown. `--before` supplies the explicit failing historical control. Neither proposal-transform scripts nor the bulky generated baseline are needed by the positive check. The small before/after JSONs are optional evidence, not runtime fixtures.

This single check covers rendered-log inclusion and dense planted support. It does **not** cover the upward correction cap, final hip-turn path, arbitrary yaw, transitions or all sole vertices. Keep the existing source-pinned end-to-end replay/full-sole evidence for those claims; do not describe the small regression as a universal locomotion pass. The approximately 174.67° knee fold remains an explicit posture problem.

## Oriented swing-support patch review

Read `2026-09-21-curved-support/swing-support.patch` (SHA256 `41b0ab073c1809d11dd0bd32697dff8d5fda84e085fb310284653ba4730ca46e`) and `glbLink.swing-candidate.ts` (SHA256 `7dd583ca957f3b95faa3aa9d117f998f564611c37898a0935e15921e7fb33085`). This was a code and CPU rest-hierarchy inspection, without a duplicate motion replay or production edits. No additional correctness blocker was found in the patch's axes, target origin or scratch flow.

- **Shared helper:** expanding the lateral and forward vectors reproduces the prior `footConfig` yaw/pitch plane. Subtracting each oriented point's vertical offset from sampled ground yields the required sole-marker height. Floating-point operation order changes, so algebraic equivalence is not a bit-identical claim.
- **Current swing origin:** the helper reads the preserved ankle orientation `qTilt * qAnkle` and the sole marker plus existing shift/pin translation. The later ankle target subtracts the rotated `leg.sole` from that same marker origin. Neither the sole offset nor shift/pin is missing or applied twice. Raising this marker before `leg.delta` is assigned feeds the existing reach/IK/guard path. The helper does not mutate `_q`, `_u` or `_v`; no caller was found retaining these scratch values across a helper call, and subsequent ankle construction recomputes its quaternion.
- **Rectangle assumption:** `makeLeg` constructs all six `fpLocal` points from a virtual flat rectangle at the rest-world sole-marker Y, then transforms them to ankle-local space. Actual source sole vertices merely determine its X/Z extents through a 12 mm band; their individual heights are not retained. The new finite-difference vectors exactly parameterize this virtual rectangle and should not be normalized independently. CPU reconstruction errors were at most `3.6e-17 m`. With the current asset's small inherited scale deviations, the lateral/forward vector lengths are approximately `1.000000119` / `0.999984858`, with absolute dot product `1.04e-9`. Treating them as exactly unit vectors would be inaccurate; their few-micrometre effect over this shoe's extent does not explain the millimetre swing residual. A future materially scaled rig still requires review of the existing quaternion-only orientation assumption.
- **Exact gate:** this extra floor query runs only during locomotion, outside any jump object, with a rendered-surface sampler, `swingW > 0.5`, and `abs(swingRise) > STEP_MIN` (0.06 m). The absolute value covers both ascent and descent. Fixed captures, stance, the exact half-weight boundary, rises of at most 6 cm and same-level curved bumps are excluded. Thus this is a targeted stair-swing correction, not proof of general obstacle clearance.
- **Contact and posture limits:** the new support floor may exceed the earlier planned lift/fold limit to preserve contact. It does not resolve the remaining knee posture issue. Reach clamping and the seven-point post-target hip guard are unchanged; that guard does not scan the complete deformed sole. The owner's independent 327-vertex sweep is still needed to establish the measured final-pose result. Hard gate transitions and arbitrary terrain remain outside this bounded review.

The adjacent duplicate function documentation is cosmetic and can be moved before integration. The minimal positive regression staging list above is unchanged.

## Timber-shoulder sampler failure and bounded candidate

After the timber winding was corrected to point outward, the existing `ground-log-contact-check.mjs` exposed a real sampling omission. The check accepts positive-up timber hits with `normal.y >= 0.1`; the rasterizer accepts only `abs(normal.y) >= 0.5`. At step 10, `(11.495, -3.375)`, outward timber face 10881 has `normal.y = 0.4675839654`, exact height `2.9993423244 m`, and sampled height `2.8906295300 m`: **108.712794 mm missing**. Raising the test's normal cutoff to 0.5 would conceal the physical shoulder rather than repair the surface contract.

The read-only `timber-shoulder-review.mjs` experiment uses the actual current production source and generated meshes, with an explicit `--timber-up` virtual-source candidate. It preserves the existing stone filter, raster grid bounds/resolution and analytic height path. Because `concatPositions` appends timber triangles after all stone triangles, the candidate passes that boundary into `buildSurfaceGrid` and admits every nondegenerate upward-facing triangle only in the timber range (`nY > 0`; existing projected-degeneracy rejection retained). Paving and stone-only calls keep the original default. This avoids changing stone-wall acceptance or introducing extra grids or per-query work.

Across the same 540 fixture queries / 491 actual timber hits:

| Measure | Current production | Timber-only candidate |
| --- | ---: | ---: |
| Shoulder hits with `0.1 <= normal.y < 0.5` | 29 | 29 |
| Those shoulder hits missing by more than 0.02 mm | 16 | 0 |
| Maximum timber underestimate | 108.712794 mm | 0.000238 mm |
| Stone-only sampler delta vs prior stone implementation | 0 | 0 |
| Analytic placement-height delta | 0 | 0 |
| Accepted combined-grid triangles | 17,570 | 21,151 |
| Combined-grid covered cells | 400,089 | 401,184 |

Evidence: `timber-shoulder-raw.json` (intentionally failing) and `timber-shoulder-candidate.json` (passing). Raw source SHA256 is `68b85283fc864eb74143fceeece94a0600e3941cc1183bfb472a3bbedf80e27f`; virtual candidate SHA256 is `4be933dad8064035db4f0bf0b89b13831cf13c80ebc1783457e6b19169dcf1e1`. No production file was changed. The candidate relies on the existing documented stone-first append order; that triangle boundary should be named clearly if integrated. Its lower acceptance threshold belongs only to optional timber, with outward winding required.

The strict 0.02 mm check is justified at the selected **grid-cell centres** (Float32 rounding remains); it is not a general error bound at arbitrary points in a 1 cm height cell, especially on steep shoulders. The 540-query fixture is not exhaustive, and the candidate's near-vertical upward faces still inherit the grid's approximation. Its purpose is to repair omitted physical triangles without broadening the stone contract.

The full 327-vertex sweep samples exact FrontSide triangles without the 0.5 normal cutoff. Its owner confirmed that the final dense-guard sweep used outward timber index SHA256 `452caf0d203b51ee61d10228162eac29ed873bc4651f2b55eabbc4ebecb8a29c`, with path-specific minimum clearance +1.187573 mm ascent / +2.065348 mm descent. That is valid evidence for those recorded poses and source inputs; it does not prove global ground-sampler coverage. Integrating the sampler candidate changes planner inputs and therefore requires a refreshed final-pose sweep before carrying those clearance values forward.

### Integrated sampler and portable regression

The root agent applied the supplied `timber-shoulder.patch`; this review did not edit production source. The resulting ground source SHA256 is `4cf786c180e62b8b404d0e3809679d71c1775ea8864d2860aeeea56ec193cc32`.

At the root agent's request, the existing `2026-09-21-stair-clearance/ground-log-contact-check.mjs` was repaired to run against raw production by default. Its only historical-source read is under explicit `--before`. A **593-byte `ground-log-fixture.json`** stores the historical stone-support and placement-height hashes at 1 micrometre precision, together with source provenance, so a positive run does not require the old Git object. Geometry/source hashes are recorded with each result. No diagnostic source-patching fallback remains in this regression.

The expanded fixture samples 1,260 positions, of which 1,046 hit outward timber and 116 hit shoulders with normal Y below 0.5; the steepest sampled normal Y is 0.0676335. It also checks geometric face normals against the authored outward normals (minimum sampled dot product 0.931766), preventing the former inward-winding geometry from silently becoming the physical reference. Current production passes with maximum sampled underestimate `2.3795944e-7 m`, unchanged historical stone/placement hashes and exactly zero analytic-height change from adding timber. Explicit `--before` fails as intended with `0.333024883 m` missing timber support.

Stage the repaired `ground-log-contact-check.mjs` and `ground-log-fixture.json` as the small sampler regression, in addition to the separate curved-foot planning check and its plant fixture listed earlier. The review experiment scripts and generated source snapshots are evidence, not required test dependencies. Run:

```text
node art/characters/link/progress/2026-09-21-stair-clearance/ground-log-contact-check.mjs
```

`--before` is an explicitly failing historical control. Neither test claims arbitrary-position sub-cell accuracy or complete gait correctness.

### Final dense hip-plane guard

Reviewed the later `swing-support.patch` SHA256 `bb4dc254fe5150c8fdcf8539ea70284aa6ed9bd13c2bf317a17733f5174718fe` and applied `glbLink.ts` SHA256 `34681bb92593e3e536234fd33dcd60d0fe404201124a6341d6331a1a2484323c`. This supersedes the earlier seven-point-only description: the final guard adds an oriented interior plane scan after those seven stencil checks.

Its captured `planeGap = min(0, initial marker height - required support)` and candidate endpoint use the same sole-marker offset and preserved ankle orientation. Dedicated lateral/forward scratch vectors remain unchanged through the checks. The original zero-turn endpoint therefore still establishes the bisection invariant, including deliberate preservation of any pre-existing negative gap. No new offset, orientation or scratch alias defect was found. The interior plane uses the raw surface sampler; the separate seven points retain the half-cell stencil. This remains a finite plane sample, not a deformed-mesh or swept-volume collision proof, and the earlier unreachable-target caveat remains applicable.

The extra scan adds one initial plane query plus up to nine candidate plane queries per tested hip turn, after early exits from the seven-point checks. With the recorded 315-sample left footprint, the combined worst case is 3,780 surface reads per tested leg rather than the previous 630; typical measured work is lower. The sweep owner reports roughly 18% additional mean total surface calls versus the first dense stance patch. These are call counts, not an FPS guarantee. The post-sampler-change sweep remains the required final source-matched contact evidence.
