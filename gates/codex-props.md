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
  EVIDENCE: parent rerun passes, 2502 underside contacts, 15884 triangles, 13 meshes, fresh terrain determinism, color/transform equality and disposal events.
- [ ] P4 Real integrated rendering inspected and external cross-review completed.
  EVIDENCE: pending; requested Fable capture because current browser is blocked.
- [ ] P5 Published PR with explicit integration instructions and ownership updates.
  EVIDENCE: pending
