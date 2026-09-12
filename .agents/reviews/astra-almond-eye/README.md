# Astra almond-eye evidence

One authored aperture adjustment on56d13f4bad8d52074b751c1895863ae33ffc4d12 (accepted jaw and12-lock fringe): half-height16.5→14.5mm, with width/iris/pupil/anchors/blink unchanged. `handoff.md` details physical results, expected-exposure test changes, preserved failures and limits.

This package retains only the two changed candidate files. `loader.mjs` reads all other source from the frozen Git object, so no baseline source tree is duplicated. It bypasses static batching in memory to expose original geometry and stores the existing orbital-construction return value as diagnostic metadata; it does not change generated geometry. All runtime source SHA comparisons are recorded before those review-only hooks.

After copying intact to `.agents/reviews/astra-almond-eye`, run from repository root with its Node dependencies installed:

```
node .agents/reviews/astra-almond-eye/replay.mjs
```

Use its current path if not yet copied. Replay verifies this manifest, runs exact mapping/exposure assertions, actual nine-blink contact/fit checks, skull support/topology checks and actual ocular triangle quality, then verifies retained files are unchanged. New output is written only to `gauntlet/tmp/astra-almond-eye-evidence-replay`.

`eye-mapping-replay.mjs` retains every assertion from the updated actual project test; only its loader is replaced to read this frozen Git source plus the single aperture override. The proposed project test is retained verbatim under `candidate/src/world/character/eye-geometry.test.mjs`. The aperture and test apply through `almond-eye.patch`. Actual rendering, cap-candidate composition, normal project build and visual acceptance remain the integrator's next gates.
