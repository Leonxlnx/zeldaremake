# Codex vegetation review: e528348

Updated: 2026-09-09T11:46:00Z. Reviewer: Codex vegetation review sub-agent, under the existing `codex` identity. Scope: read-only review of `src/world/vegetation/**` at Fable's `e5283486b71153812bac81e379bb871e00d1935d`. Fable retains source ownership. Only this report and the adjacent one-plant CPU diagnostic are authored here. No world build, GPU performance measurement, visual verdict, or gauntlet pass is claimed.

## 1. Wind-deformed shadow casters keep an undeformed shadow silhouette

`plants.ts` enables first-LOD shadows for ferns, bushes and saplings. `lodset.ts` assigns the resulting `castShadow` property but does not attach `customDepthMaterial`. `materials.ts` injects `PLANT_PROJECT_VERTEX` only into the color material: it shifts `vegWorld` through `windBranch` and `windLeaf` before projection. The installed Three.js r186 shadow renderer (`WebGLShadowMap.js`, `getDepthMaterial`) selects its unmodified `MeshDepthMaterial` when no custom depth material exists. Therefore the color pass and sun-shadow pass use different vertex positions whenever the injected wind offset is nonzero.

This is a concrete pass mismatch, not a claimed severity measured in captures. Ground contact and subtle swaying leaf shadows should be checked in a close, animated view once trees and lighting settle. Static ground litter and grass tiles are not implicated: the former does not sway and the latter does not cast shadows.

Suggested owner fix: share the plant deformation injection and uniforms between the standard material and a matching shadow depth material for the three shadow-casting plant sets. Preserve each mesh's instancing and current LOD. Add a matching distance material only if these plants later cast point-light shadows. The existing tree depth-material implementation already demonstrates this pattern; integrate deliberately instead of inventing a second wind response.

## 2. Small camera moves leave capture geometry dependent on camera history

`lodset.ts:115-119` skips rebucketing until the camera is at least 0.6 m from the last processed camera position. A one-plant reproduction at the fern threshold (11 m) returns:

| Camera sequence | Final camera | Near/far instance counts |
| --- | --- | --- |
| 10.8 m, then 11.2 m | (11.2,0,0) | [1,0] |
| Directly 11.2 m | (11.2,0,0) | [0,1] |

Run `node .agents/reviews/codex-vegetation-lod-review.mjs`. It loads the actual class and creates only two single-plant sets. No terrain or full world is generated. This establishes geometry state dependence, not that the fixed six-view capture sequence fails the pixel-based W41 threshold. Those six widely separated camera jumps normally trigger a refresh.

The movement gate is a reasonable interactive CPU optimization. Keep it for free-camera motion, but provide an unconditional refresh when capturing an explicit pose, or use exact rebucketing in headless capture mode. Otherwise a pair of nearby probe poses can produce different detail at the same final pose depending on how the camera arrived there. Repeated rendering while stationary never resolves the stale selection.

## Lower-priority audit precision

`LodInstancedSet.stats()` counts two draw calls for a shadow-casting mesh but only one copy of its triangles. Thus `drawableEstimate` mixes color-plus-shadow draws with color-only triangles despite documenting an upper bound. Keep this advisory estimate clearly labeled as color-pass geometry, or account for the corresponding shadow triangles and actual number of shadow passes. Renderer statistics remain authoritative for W38; no budget violation is inferred from this source-only estimate.

## Checks and limits

- The grass color assignment is compatible with the installed r186 shader chunk: `vColor` is `vec4`. It is not a shader compile finding.
- LOD rebucketing conserves each set's instance count; there is no duplicate instance count across active LOD meshes after refresh.
- The field does perform exact terrain checks in transition bands. Previously assigned height-cache and sampler/rendered-mesh issues remain upstream terrain work, not a reason to replace the vegetation scatterer.
- Geometry disposal is incomplete, but world recreation is not currently exposed as a user flow. It is not promoted here to a demonstrated recurring live-memory leak.
- New flower geometry and density require visual comparison against the reference. This review does not judge that art-direction change from code alone.

No source changes requested from another agent are silently applied. Parent Codex can send these bounded findings to Fable in PR #3; Fable should prioritize them relative to the integrated scene's more visible remaining gaps.
