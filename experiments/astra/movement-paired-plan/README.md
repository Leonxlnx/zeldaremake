# P3 movement checkpoint

This isolated experiment reproduces a passing **288.144550 ms ordinary-running transfer prefix** from frozen accepted frame 59. It is not installed in the game controller. The source subset, compact input, numerical runner, and evidence are included so no large scratch history is required.

From this directory, with Node 20 or newer:

```sh
npm install --ignore-scripts
npm run replay
```

Inside the existing repository, its installed Three 0.186.0 and TypeScript 5.9.3 dependencies also suffice. `replay.mjs` checks the manifest, executes one numerical candidate, and compares hashes of parameters, events, every piece/coefficient, and all 640 samples with the original P3. Timing and corrected diagnostic counters are excluded. Temporary full output is removed; use `node replay.mjs --keep-output` to retain it locally.

An optional `npm run replay:mesh` also reconstructs those samples with the included frozen Link geometry and compares the indexed flat-floor evidence. The publication preparation ran the numerical portability check only; the included mesh evidence comes from the previously completed original P3 mesh check.

## What passed

- 48 pieces and 640 paired samples through the first left touchdown, right touchdown, and 20 ms of outgoing right support.
- Full-piece scalar flex extrema/rate and leg-length checks, with finite world-motion checks spaced at most 0.5 ms apart.
- Original mesh evidence: 640 reconstructed poses and 4,135,680 referenced indexed vertices from six boot-detail meshes per ankle; none below the flat floor.

The next left touchdown at 418.144550 ms is outside this checkpoint. Continuous mesh motion, pairwise BVH clearance, terrain, turning, jump/recovery/restart integration, and rendered quality are unproven. Body-knot derivatives are one-sided; this is not a globally C1 body/joint claim. Amplitude domains are floating-point fixed-sample calculations, not rigorous intervals over time.

## Contents and provenance

`fixture.json` retains only accepted frames 58/59 state, body requests, height and feet, plus the original unprojected target. `source/` is the exact union of 40 frozen dependencies used by the numerical forecast and mesh check. `p3.mjs` includes the final explicit flex-domain guards and corrected work caps/counters. Its trajectory still matches the first passing P3 exactly.

`evidence/original-p3-summary.json` stores the original compact result and semantic hashes. `evidence/guard-verification.json` records equality after the guard/counter corrections. `evidence/portability-verification.json` records the single successful portable replay. `evidence/mesh-floor.json` preserves the original geometry result. `SPECIFICATION.md` explains the family and limits; its original scratch path references describe the original experiment, while the commands here apply to this portable copy.

`provenance/inputs.json` records original hashes and each source origin; `provenance/adaptations.patch` shows path/input-wrapper changes. The physical math and source assets are unchanged. The forecast computation before its convenience fixture wrapper remains byte-identical to frozen module `144812193c4b1232494275e646eef45f7fb40edbd7824081422b39e128250920`.

`manifest.json` lists every publication file's size and SHA-256, excluding the manifest itself. Generated outputs and installed dependencies are outside the publication manifest.
