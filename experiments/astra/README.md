# Astra experiments

Recovery checkpoints for work that has not passed integration gates. Production source in this branch remains the playable b0799bb checkpoint. Do not copy experiment overlays onto it without resolving their recorded failures.

`movement-viability/` preserves the shared support trajectory experiment and a reproducible numerical runner. From the repository root, run `node experiments/astra/movement-viability/replay.mjs` after installing dependencies. The runner also needs the pinned f11559532805948079aaa0fdcf84b8a293ebab6b commit available locally. It is intentionally a failed checkpoint: standing passes, walking refuses frame 6, running refuses frame 0, with atomic rollback. Newer work is correcting initialization and carried ankle derivatives; this archive preserves the previous exact failure.

The playable character work and actual screenshots remain on `agent/astra-link-movement` / PR #5 and `captures/astra-progress`. This checkpoint is not a movement release or rendered evidence.
