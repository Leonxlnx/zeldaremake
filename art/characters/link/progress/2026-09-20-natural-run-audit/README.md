# Natural-run diagnosis and same-time arm stability

CPU measurements use the real GLB loader, animation mixer and production IK without a renderer.
Asset `382ec9ecab9f77062b61c77192ada4df860abc33666284d8971abe1e577492eb` is the currently adopted runtime.
Each scenario advances 420 frames at 60 Hz; the last 300 are measured. This is a diagnosis, not visual acceptance.

| Existing run, play mode | Left | Right |
| --- | --- | --- |
| Upper-arm pitch, degrees (+forward) | −31.94 to +24.75 | −34.81 to +22.12 |
| Elbow flex, degrees | 79.19 to 94.78 | 78.56 to 94.84 |
| Hand forward from shoulder, metres | −0.0018 to +0.1497 | −0.0135 to +0.1411 |
| Knee lateral offset from hip, metres | 0.00084 to 0.00170 | 0.00084 to 0.00170 |
| Ankle lateral offset from hip, metres | 0.002997 to 0.003002 | 0.002997 to 0.003002 |

Chest-to-neck forward lean is 6.99–7.90° (mean 7.44°). The upper arms already swing farther backward
than forward; the hand carriage also reflects the roughly 88° elbow bend. Runtime run amplitude is
scaled by 1.15 around its cycle mean, then filtered with a 0.02-second time constant. Their combined
effect at 60 Hz slightly reduces the baked upper-arm excursion; the 1.15 constant alone does not prove
an amplified visible swing. The flat-ground knee-out overlay is zero, so a bowed calf silhouette needs
mesh/skinning inspection rather than removal of the stair swivel.

The verified runtime defect was zero-dt filtering: its old ternary selected `alpha=1`, snapping the
filtered arm onto the current target when the same simulation time was posed again. The correction
uses `1 - exp(-max(0, dt) / tau)` for a nonzero time constant, preserving the filter at dt=0.
In the recorded run re-pose at 6.9833 seconds, hand displacement falls from 20.20/22.74 mm to zero;
shoulder/elbow/hand orientation stays unchanged. All six advancing motion trace digests are identical
before/after: idle, walk and run, each with capture and play mode. The asset and motion curves are unchanged.

```powershell
node art/characters/link/progress/2026-09-20-natural-run-audit/audit.mjs link-runtime.glb art/characters/link/progress/2026-09-20-natural-run-audit/zero-dt-fixed.json --assert-zero-dt --baseline=art/characters/link/progress/2026-09-20-natural-run-audit/baseline.json
```

`--assert-zero-dt` fails on the old runtime and passes with the one-line correction. Angular comparisons
normalize world quaternions first; comparing identical non-unit quaternions with `angleTo()` otherwise
produces false angular changes. The audit deliberately checks arm stability rather than declaring all
terrain/IK behavior correct.

Existing `check_run_grounding.mjs link-runtime.glb --shift-takeoff` also passes: 0.709 mm steady flat
root-height range, 68 flight frames, no reach clamps. Existing synthetic-stair checks pass their continuity
assertions but still expose 99.05 mm descent shoe penetration and peak knee flexion 165.30° ascending /
160.84° descending. Those synthetic stairs are distinct from the actual rendered stair meshes; they
remain limitations, not passing art criteria.
