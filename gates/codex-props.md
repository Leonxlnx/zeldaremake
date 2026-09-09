# Props acceptance gates
- [x] P1 Detailed original pots, crates, bucket, ladder/platform and rope railing module, independent of other world systems.
  EVIDENCE: props/index.ts, layout.ts and README.md; parent-reviewed original geometry.
- [x] P2 Typecheck and production build pass.
  CHECK: npm run typecheck && npm run build
  EXPECT: exit 0
  EVIDENCE: npm run typecheck and npm run build exit 0; direct Vite props library bundle also succeeds.
- [x] P3 Determinism, geometry validity, seating, bounds, disposal and accurate audit counts tested.
  CHECK: node src/world/props/geometry.test.mjs
  EXPECT: exit 0
  EVIDENCE: parent rerun passes, 2952 underside contacts, 16508 triangles, 15 meshes, fresh terrain determinism, color/transform equality and disposal events.
- [ ] P4 Real integrated rendering inspected and external cross-review completed.
  EVIDENCE: First B/D and pot crop reviewed from monitor; iteration2 and full six-view capture/cross-review pending.
- [x] P5 Published PR with explicit integration instructions and ownership updates.
  EVIDENCE: PR #3, props implementation 2d9465a and refinement ea88a83, Fable capture fixes deliberately merged in 45aa83a; baseline review0ea9370.

P4 PENDING: Fable registered props and supplied first B/D captures. Those informed iteration2. Revised/full six-view capture and cross-review remain pending. Remote preview HTML loads, but cloud browser cannot create WebGL context; no Phase1 completion claim.

## Iteration 2
- [x] P6 Hero-view placement and muted contact pigments improved from Fable actual capture feedback.
  EVIDENCE: source updated from B/D and pot crop review; legal cluster in B projection, dusty pigments; latest recapture pending.
- [x] P7 Geometry tests avoid Node24-only APIs; tests/build rerun.
  EVIDENCE: registerHooks removed; parent tests pass with in-memory TS loader. Full suite passed on actual Node22.23.2 using npm exec --package=node@22; typecheck/build also pass.
