# Keep distant caps from submitting invisible hero roofs

The distant huts add only 1,008 cap triangles, but their shared roof bucket expands from a
7.497 m to 20.295 m bounding sphere. At C/L02 this admits the old 129,596-triangle roof into
the color pass despite unchanged visible content. Actual Three frustum calculations reproduce
all ten measured source deltas exactly; the expanded bound is the established cause.

Source `8714d2af9556105fe867f9e36a1a44c4a99629f0` changes only the consolidation block in
structures/index.ts. Distant capMoss meshes move into an identity group, the unchanged static
consolidator runs on both groups, and the results are reattached with summed audit counters.
All original part data, materials and transforms remain exact. The main roof's merged buffers
recover source 711 exactly. There are no builder, layout, lighting or shared material changes.
Fable approved this narrow overlap in PR2 comment 5647847074 and plans deliberate adoption
after structures 17. His take 69 history is integrated without altering his active work.

[The pinned reproduction](distant-cap-bounds/README.md) preserves source, camera and resource
provenance. Actual-source typecheck/build 112 and the frozen index SHA256 pass. Unique scene
triangles, materials and textures remain unchanged. One mesh/geometry is added; raw geometry
buffers shrink by 6,048 bytes because the small cap index becomes Uint16. Object overhead and
GPU timings are unmeasured. All 56 geometry disposals occur once; existing material/texture
ownership behavior stays exact, including the cap-moss leak pending Fable's fix.

## Actual result: retain, with strict JPEG identity failed

Environment run 34711620329 completed both galleries. All original publication bytes, source
and tree provenance, cameras, controls, 16 depth hashes, resource inventories and predicted
submission changes pass. Historical gallery files remain unchanged.

| View | Submitted triangle change | Draw-call change |
| --- | ---: | ---: |
| C and L02 | -130,604 | 0 |
| F | -1,008 | +1 |
| A, B, D, E, S01 and S02 | 0 | +2 |
| L01 | 0 | +1 |

Actual C is 556 calls / 8,433,793 triangles; L02 is 544 / 8,402,069; F is 625 / 8,533,071.
Textures remain 70 and programs 76 at this historical source, which still contains the later
rejected crate shader. These counts measure submissions, not unique scene geometry or FPS.

The original exact-JPEG assertion failed and remains failed. All 12 world JPEGs have tiny
residuals: worst whole-image channel MAE 0.001518/255, maximum channel difference 5/255,
at most 14 pixels per image exceeding 3/255. S01 and S02 are byte exact. L01 has maximum 2/255
and MAE 0.0000716; L02 maximum 4/255 and MAE 0.0008825, with one pixel exceeding 3/255.
Draw-order or renderer rounding is only an inference; its cause has not been established.

Root personally compared A and viewed both non-identical detail originals. The independent
reviewer inspected all five distinct world views and those details. No visible roof, path,
lighting, foliage or prop deterioration was found. Retain on this separate visual and cost
review, explicitly preserving the failed stricter gate. No appearance or frame-rate improvement
is claimed. D baseline used one unchanged-state blank-buffer retry; the other 15 used zero.
Both reports contain zero final errors and warnings.

[World originals](https://github.com/Leonxlnx/zeldaremake/tree/81e465c8055b989cd8b4a9b91ab4bae6fcb6095d/progress/2026-09-12_185057505-8714d2a)
and [detail originals](https://github.com/Leonxlnx/zeldaremake/tree/fd7a47ef23c277c0abcc18c15c0a064303471c8e/details/2026-09-12_185348674-8714d2a)
remain immutable. The verified source ZIP contains all 409 tracked files at their original bytes.
Original canvas PNG bytes and an independently downloaded dist rehash are not claimed.
