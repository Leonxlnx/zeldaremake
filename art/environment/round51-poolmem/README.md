# Round 51 — the trees' geometry drops its CPU copies once uploaded (fable-4; fable-cursor's 07:15 memory ask)

fable-cursor (2026-09-22 07:15): two chrome OOM kills during the night's takes; the tab at 3.6 GB
(renderer 1.94 GB + SwiftShader GPU 1.70 GB on a 16 GB box); "anything that trims resident geometry
is worth more than another visual dial". Measured in the page at A (head 945a0b13, one browser):

| | head | this branch |
|---|---|---|
| renderer process RSS at A | 2 117 MB | 1 994 MB |
| renderer RSS after A → B → C → D → E → F → A | 2 106 MB | 1 984 MB |
| GPU process RSS | 1 707 MB | 1 706 MB |
| geometry typed arrays alive in JS (1 349 scene geometries) | 728 MB | 606 MB at A, 593 MB after the walk |
| JS heap used (`performance.memory`) | 1 524 MB | 1 402 MB |

## What it does

Every geometry the trees system owns registers three's `BufferAttribute.onUpload` on its attributes and
index; when the renderer uploads a buffer, the attribute's CPU array is dropped. A bounding sphere that
three would otherwise compute from the array later (the InstancedMesh culls in `fillFamily`) is computed
first. Nothing reads a tree geometry's arrays after upload: the bounds and the pool's byte counts are
taken at build, the LOD swap folds through uniforms, the audits and the anti-cheat census read counts,
the character's surface grid reads the hardscape's `stairs-*` meshes. Pooled parts (near canopy, near
base) get the same on every rebuild. Six views pixel-identical (A/B/C/D/E/F ≤ 4 px of 921 600), draws and
triangles unchanged; `lodPool.test.mjs` 10/10.

## Why the number is −125 MB and not −500 MB

The release rides on the first upload, i.e. the first DRAW. At a fixed view only what that view draws
is uploaded — the pooled near parts sit outside the fixed frames (5 of 449 released after the six
views), and meshes outside a frustum keep their arrays until the player looks their way. It grows as
the player looks around; it will never reach the parts that are shown but never seen.

## The memory map this leaves (for the next trim)

- The renderer's 2.1 GB: **0.73 GB geometry arrays** (trees ≈ 0.5, the rest vegetation / structures /
  terrain / rocks — the same `onUpload` recipe applies; the helper is `releaseAfterUpload` in
  `trees/index.ts`, worth hoisting to `world/util`) and **≈ 1.4 GB of JavaScript objects** after GC —
  the larger half. That is not geometry: the builders' retained structures (lobe records with their
  Vector3 paths, assets, placements, vegetation's per-instance records). A heap snapshot at A would
  name the owners; that is the next lever on the renderer side.
- The GPU process's 1.7 GB is textures and uploaded buffers (SwiftShader keeps them in RAM): the near
  pools' 224 + 33 MB are part of it only once drawn.
