# Astra movement recovery checkpoint — NOT INTEGRATED

This is a recoverable scratch solver experiment. **It is not playable movement and must not replace the current playable branch.** The latest complete gate accepts standing frames0–203, refuses walking frame6, and refuses running frame0. Both refusals preserve the actual graph, coordinator and geometry bytes. The new ordinary knee-rate feasibility gate exposes startup and carried-trajectory problems that remain to be corrected.

## Contents and pin

The `source/` overlay contains only21 changed/new movement files in the recursive play-pose dependency graph relative to base `f11559532805948079aaa0fdcf84b8a293ebab6b`. There is no copied repository, node_modules, asset geometry, visual-design change or physics change. `manifest.json` records every changed file hash and hashes of unchanged movement dependencies. This is the full runnable movement dependency overlay; superseded unused experiments are omitted.

The frozen visual snapshot used for the original gate included contemporaneous uncommitted non-limb visuals. These are intentionally not bundled. The original rig, boot geometry/articulation, outfit details, batching and UV source are byte-identical to the pinned base. The replay below loads baseline character assets directly from git, so it checks the same movement/lower-body contract with the pinned asset set. Per-instance geometry digests may differ from the original visual snapshot; the required comparison is equality before/after each rejection, not matching another actor's digest.

## Reproduce

Keep this folder inside a checkout of zeldaremake with its npm dependencies installed and the base commit available. From that repository root:

```sh
npm ci
node gauntlet/tmp/astra-movement-checkpoint-viability/replay.mjs > gauntlet/tmp/astra-movement-checkpoint-viability/replay.log
```

If the folder is moved, substitute its new repository-relative path in that command. The runner verifies movement source hashes, loads changed modules from the overlay, and reads all other source from the pinned git commit without editing the checkout. It runs the original standing0–203 and moving0–33 prefixes, stopping each fixture on its first refusal. It writes `reproduced-prefix.json` with full diagnostics and actual graph/geometry rollback evidence. This is geometry construction and numerical replay, not a renderer or screenshot stand-in.

To inspect/typecheck the overlay separately, create a disposable checkout of the pinned base, copy `source/` over it, install dependencies, and run `npx tsc --noEmit`. Do not copy it onto the playable branch.

## Current interpretation

Running0 initializes contacts at the current physical timestamp and then immediately advances a swing by one dt; the root interval is zero and the blend-rate estimate has no previous input. Walking6 refuses at the start of a new tick because carried motion exceeds the newly evaluated dynamic reference-derived rate envelope. These failures require causal initialization and trajectory/envelope planning, not per-pose clamps or a suppressed guard.

The prior frame27/30 witnesses prove that final endpoint reach alone is insufficient: both starts were exactly at453mm reach with an outward derivative. The retained lace216/217 witnesses prove calf-rigid details need a separate ground-envelope gate; boot assets must not be changed to conceal deep recovery tilt. The old turn/reversal cuff crossings and stair issues have not been revalidated by this experiment.

No432-frame sweep, final performance acceptance, renderer capture or production integration is claimed. The pure shared-height fitter passes15 focused cases; the candidate TypeScript check passes. The root agent owns preservation on an isolated checkpoint branch.

The included replay was actually run against baseline git assets: all three stop frames, complete failure objects, final accepted requests and audit results reproduce exactly. See `reproduction-verified.json`.
