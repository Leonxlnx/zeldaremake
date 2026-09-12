# Astra experiments

Recovery checkpoints for work that has not passed integration gates. Production source in this branch remains the playable b0799bb checkpoint. Do not copy experiment overlays onto it without resolving their recorded failures.

`movement-viability/` preserves the shared support trajectory experiment and a reproducible numerical runner. From the repository root, run `node experiments/astra/movement-viability/replay.mjs` after installing dependencies. The runner also needs the pinned f11559532805948079aaa0fdcf84b8a293ebab6b commit available locally. It is intentionally a failed checkpoint: standing passes, walking refuses frame 6, running refuses frame 0, with atomic rollback. Newer work is correcting initialization and carried ankle derivatives; this archive preserves the previous exact failure.

The playable character work and actual screenshots remain on `agent/astra-link-movement` / PR #5 and `captures/astra-progress`. This checkpoint is not a movement release or rendered evidence.

[`movement-timing/`](movement-timing/README.md) preserves the later contact-timing checkpoint. Its pinned replay passes standing 204 and walking 240 samples, then refuses running 60 with atomic rollback. Run `node experiments/astra/movement-timing/replay.mjs` from the repository root; the earlier viability experiment remains intact.

[`movement-paired-plan/`](movement-paired-plan/README.md) preserves the first passing paired-plan numerical prefix from frozen running frame59. Its self-contained replay checks48 stored pieces and640 samples through288ms, with original sampled boot-floor evidence. It is not installed in the controller; the next left touchdown, actual path-clearance and input changes are outside this checkpoint. Run `node experiments/astra/movement-paired-plan/replay.mjs` from the repository root. Earlier failed checkpoints remain intact.
