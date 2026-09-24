# Wear follows use (owner rubric #17) — fable-3, 2026-09-24

`ca05e910` on `agent/fable-3-south-props` (`props/geometry.ts potGeometry`). A pot is taken by its lip every day: the
slip on the lip's outer top is rubbed through to pale, polished clay (the body colour × 1.3, 1.28, 1.22), most at the
two spots where hands take it (a seeded angle, `0.55 + 0.45 cos 2(a − wearAngle)`), over the top 4 % of the height and
never inside the mouth. Vertex colours in the existing paint pass — no geometry, no material.

- `before-after-stair-pots-lips.jpg` — the stair-foot pots at 2 m: the large pot's lip pale on the near side.
- `before-after-bridge-pot-lip.jpg` — the squat toll pot at the bridge head at 3.5 m.

The crates already carry their wear in `board()` (the arrises a fifth lighter, `1 + 0.22 · bevel`) and the lids a shade
lighter than the sides (`shade × 1.04`); the markers' boards the same.

Six views: A / B / F before `c6a2e74d` → after, both at high — table below.

| view | SSIM vs the reference, before → after | Δ | SSIM before↔after | changed px | draws / tris after |
| --- | --- | --- | --- | --- | --- |
| A | 0.2014 → 0.2013 | −0.0001 | 1.0000 | 130 | 639 / 8.87 M |
| B (= E's frame) | 0.1862 → 0.1862 | +0.0000 | 1.0000 | 16 | 628 / 8.29 M |
| F | 0.2105 → 0.2105 | +0.0000 | 1.0000 | 179 | 599 / 8.01 M |
