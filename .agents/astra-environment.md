---
agent: astra-environment
runtime: Codex desktop coordinator with three owner-requested Astra Max subagents
github: Leonxlnx
status: active
branch: agent/astra-environment-quality
updated: 2026-09-20T14:38:00Z
---

# Astra environment quality pass

## Current task
The owner reprioritized environment quality over Link: detailed stones, less uniformly
green trees, convincing distant trees and a larger useful render distance. The original
ten target images are in `reference/owner-concepts/`; video frames remain composition
references. Coordinate complementary changes with Fable's active lanes and demonstrate
the integrated result with actual renderer captures and performance measurements.

## Files / systems being touched
Coordinator: evidence under `art/environment/astra-quality/`, integration and W35/W37/W38 review.
Three isolated Astra Max worktrees begin at `ca562e76`:
- `astra-stones`: stone material/relief, complementary to hardscape-31 geometry and Fable-2 rocks.
- `astra-trees`: bark/foliage/moss material separation, complementary to Fable-4 geometry.
- `astra-distance`: distant-tree representation and LOD continuity, complementary to the above.
Exact source scopes are coordinated before edits. Other agents' work is retained.

## Completed work
- Located and inspected the owner's original concept previews 01, 02, 05 and 07.
- Created isolated coordinator worktree and dispatched three Astra Max agents.
- Character candidate bfc3c08d remains on PR21 at07d24465. Further native hand studies
  are deferred at the owner's request; neither grip trial was exported or adopted.

## Important decisions
One local GPU capture at a time through the shared capslot wrapper; no visible UI control.
Preserve deterministic systems, terrain/contact contracts, layout and original/CC0 assets.
Larger visible forest means useful LOD and continuous silhouettes, not all full-detail trees
rendered indiscriminately. Keep the performance gate and report actual measured cost.

## Known issues
Three source candidates integrated locally; actual quality remains unverified. Complete19-view baseline atca562e76 is preserved in art/environment/astra-quality/before. Baseline performance trace running; native candidate comparison is next. New Fable structures32 at69d16c4f will be integrated after the matched comparison.

## Recommended next work
Fable keeps its existing geometry, expansion, structures and vegetation lanes. Notify this
coordinator of overlap with stone materials, tree materials, distant trees or LOD changes.

## September20 native baseline and integration
Three Astra Max lanes delivered91c15407, a3aec477 and1ed75aaa. Imported only their scoped source/checks/evidence; individual logs and claims remain in their branches. Combined material/tree checks12/12 pass. Full19-view high720p baseline is complete with no page errors, A8,595,330 triangles/566 calls. PR23 remains draft. Fable's13:10UTC overlap acknowledgement is read and replied to on PR2 comment5750113979. Native performance and candidate visual checks remain pending. The tree lane is investigating the baseline's closed crown discs with existing pooled leaf geometry.

## Native comparison completed14:08UTC
Source3dadc4a3 and evidence55e67c0b:19 exact-camera before/after pairs,24 candidate views, zero page/shader errors. Five pairs in art/environment/astra-quality/README.md. Flat discs visibly removed; bark/stone gains are modest. A8,634,322 triangles/571 calls (+38,992/+5). Daylight reference SSIM lower, largest C-0.0258/F-0.0289, fully disclosed. Both600-frame synchronized GPU traces complete: before median261.9ms/p95354.4ms, after115.2ms/p95324.9ms. Host/load variation is substantial (unmodified vegetation CPU also fell), so do not attribute the apparent speedup to our patch or claim30fps. Formal take next. Fable review requested on PR2 comment5750300746. Separate far-crown atlas candidate is being prepared by astra-distance; not part of accepted evidence or parent build.

## Second iteration verified14:29UTC
Merged Fable69d16c4f as69325371, exact W24fix51fb6b35 asd459afb3, atlas candidate6252deef as sourcea9eccd15. Native24-view capture after-atlas is complete with no errors; leaf edges sharper while oblique planes remain. All24 camera/time/hash comparisons pass. A8,654,882 triangles/571 calls; +20,560 from Fable pebble fix. Formal take0123 was invalid (inherited W24=1822), retained honestly; take0124 is VALID,37/50 overall and32/42 world, no new rubric regression vs0122, anti-cheat97 green, W24/W35/W38/determinism pass. No phase exit or30fps claim. Fable review requested; d4bfed58 is HELD after astra-stones found reversed-edge smoothstep in its new rock shader (PR2 comment5750384523). Separate astra-trees moss/lichen candidate underway on its own branch, no integration yet. GPU slot free.

## Bark material candidate — 2026-09-20 14:38 UTC
Importing tree-agent 5d9de615 material-only patch for matched native review against a9eccd15. Reduces overlapping green moss and preserves mapped bark under lichen; no geometry or new texture samples. CPU shader contract/typecheck/build pass. Frozen accepted owner preview on61020 stays unchanged until visual review.

14:53 UTC: a2eb130f native24-view study completed with no errors and equal geometry/draw counts. HOLD: exposed bark near-black; additional near/far moss mismatch identified independently. Restored materials.ts to accepted a9eccd15 in ee2dfe2a. Evidence moss-study and comparison retained; next revision must address albedo root cause and distance continuity before acceptance. Hardscape agent preparing isolated existing edge-spall reuse; scope extension communicated on PR2comment5750537728.