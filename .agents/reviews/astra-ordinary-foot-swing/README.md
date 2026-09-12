# Ordinary foot touchdown — candidate 10

Integration-ready for root's source review and actual rendered capture. The delegated task supplied the patch; root has now integrated the exact three source files alongside the almond aperture and completed the composed build and motion checks. Actual rendered review remains pending.

This patch replaces the root-carried free-foot target during ordinary walking/running with a stored world curve. Its endpoint is stationary in world space. The physical controller's numeric source and arithmetic remain unchanged; a copied, frozen held-input snapshot and original surface association are exposed through a WeakMap keyed by the actual controller state.

The scope is deliberately small: three source files, with no recovered coordinator or fixture-specific runtime. Stair/cliff/blocked forecasting, unknown copied states, jumping/landing and stop-recovery transitions retain the existing gait. A changed-input forecast outside the ordinary domain immediately releases the old curve. Interrupted stopping steps finish their existing recovery until the next actual lift-off; they do not become flat sliding curves.

## Apply and replay

The patch was built against `9a317b873eae4a036e0ad179027201fdfdb217c1`; only the two preexisting movement source files must still match its baseline hashes. Character face/fringe changes are independent. Root should check/apply this patch on its own branch, then capture the composed current character.

```sh
node .agents/reviews/astra-ordinary-foot-swing/tools/verify.mjs . tmp/ordinary-foot-swing-review
python .agents/reviews/astra-ordinary-foot-swing/tools/curve-rates.py tmp/ordinary-foot-swing-review/curves.json tmp/ordinary-foot-swing-review/curve-rates.json
node .agents/reviews/astra-ordinary-foot-swing/tools/motion-context.mjs . tmp/ordinary-foot-swing-review
node .agents/reviews/astra-ordinary-foot-swing/tools/mesh-motion.mjs . tmp/ordinary-foot-swing-review
node .agents/reviews/astra-ordinary-foot-swing/tools/ownership-witness.mjs . tmp/ordinary-foot-swing-review
npm run build
```

Run these from the target repository after its existing npm dependencies are installed. The tools resolve dependencies from that repository. `verify.mjs` first checks all three candidate hashes and the unchanged assertion-file hash, then runs every original assertion with read-only curve observations. It writes its instrumented temporary module and evidence under the requested output directory. Frozen author evidence is in `evidence/`; root's actual composed-current-source curve and mesh replay is in `composed/`. The production files contain the exact candidate source, without duplicated frozen source files in this package.

## Frozen source

| Source | SHA256 |
| --- | --- |
| locomotion.ts | ba2eea6619545a4d08f037dc75ecb07e63a2f78dc75cd5709fa9ffa11f208194 |
| play-pose.ts | fe1b6c4555ae4bb0537967799d4e07ebcdd7bb10860b02fc67573cce42f6946e |
| foot-swing.ts | dc12637baa16f4a55cee19c2f06ecc376b9ed818695ccb51b7f1843464975d7e |

## Evidence

- Full original locomotion assertions pass, including fixed-step 30/60/120/144 Hz, turns, analogue movement, stairs, stopping/restarting, jump support/tuck/arm recovery and current sole geometry checks. Assertions and thresholds were not changed.
- 439 emitted curves: analytic maximum planar speed 7.144596 m/s; maximum vertical speed 2.997 m/s. Minimum scalar Y is -5.55e-17 m from arithmetic roundoff. The preexisting 8/3 m/s limits are unchanged. No accepted stored-curve sample differs from the evaluator by more than 1 nm across that full suite.
- 2,400 exact baseline/candidate numeric controller snapshots, plus byte-exact original physical source after removing only accessor bookkeeping. The context/input snapshots are frozen; caller input mutation cannot rewrite history; copied states return null. Input values remain the raw actual command, with sanitization in the original controller.
- Actual `createLink` geometry, synchronized every fixed tick: 1,080 live initialized walk/run/stop/restart/jump ticks, 6,978,960 referenced boot/detail vertices. Zero raw negative floor vertices; minimum Y 2.3841855e-9 m. Six indexed boot/detail meshes per foot were checked. This is sampled floor evidence, not continuous whole-body collision certification.
- Independent reviewer: ten ownership/context cases, 8,400 foot observations and 2,445 active-curve observations. Zero unsupported-context samples, after-clock samples, retired unfinished curves or stale completions. The prior stair-turn drag and unknown-state carryover witnesses now pass. The original independent review script and reports are preserved under `evidence/`.
- Build/typecheck passes. Timing in the original measured geometry run: 27 actual planning events, median 0.139 ms / p95 0.344 ms / maximum 0.594 ms; 674 curve evaluations, median 0.00153 ms / p95 0.00590 ms / maximum 0.0902 ms. These timings exclude rig construction, geometry synchronization and rendering; they are not a worst-case complete game-frame bound.
- Matched actual rig translation evidence: the final precontact running secant speed was 4.581283 m/s before stopping in the baseline. Candidate10 decelerates through 3.655471 → 1.218490 → 0 m/s. Walking changes from 1.959168 → 0 to 1.640526 → 0.546842 → 0 m/s. Secant measurements are discrete observations; the stored endpoint derivative itself is analytically zero.

## Limits and next gate

The continuous-velocity claim applies to uninterrupted stored sole translation. Legacy mode interruption still uses the existing 8 m/s planar / 3 m/s grounded vertical / pitch / reach guards; the independent right-turn stair-entry witness reaches those old travel bounds on the interruption tick. There is no blanket C1 claim for mode handoffs, pelvis, orientation or whole-body motion. Dynamic changes in collision/surface callbacks and arbitrary untested input/terrain combinations are outside the measured domain. Runtime does not contain a new general trajectory admission solver.

The visual-quality gate remains root's composed current-source render/capture: compare side and three-quarter ordinary touchdown, the first restarted step, and jump/landing. This package supplies actual movement and mesh evidence, but no newly rendered screenshots or a claim that Link is visually finished.

Rejected candidates and first failures remain in the parent scratch review area, including07 stale-mode ownership,08 flat pitched-recovery mismatch, and09 two fast-restart reach corrections. Candidate10 resolves those measured failures with explicit transition ownership, preserved legacy stop recovery, and a shorter optional horizontal acceleration/deceleration ramp (10% of swing duration).

## Root composed check

Applied to56d13f4 plus the29mm almond aperture. Exact-source full assertions,439 analytic curves and1,080 actual current-mesh ticks passed again; curve corrections remain zero and no raw boot floor penetration was found. Eye physical mapping and typecheck/build147 passed. These reports retain complete source hashes; timings are observations on this machine, not a game-frame performance guarantee.
