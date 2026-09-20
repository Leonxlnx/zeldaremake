---
agent: astra-environment
runtime: Codex desktop coordinator with three owner-requested Astra Max subagents
github: Leonxlnx
status: active
branch: agent/astra-environment-quality
updated: 2026-09-20T12:56:00Z
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
No new environment source changes or quality improvement claimed yet. Baseline atca562e76
is being prepared; newer in-flight Fable branches are reviewed before integration.

## Recommended next work
Fable keeps its existing geometry, expansion, structures and vegetation lanes. Notify this
coordinator of overlap with stone materials, tree materials, distant trees or LOD changes.
