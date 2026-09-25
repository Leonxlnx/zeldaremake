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

## The memory map this leaves (for the next trim) — corrected 2026-09-22 17:20 after fable-5's read

- fable-5's independent read of the merged head (`.agents/reviews/fable-5-r55-branches.md` §G): on the
  capture path Chrome total **4 394 → 3 826 MB (−568 MB)** with the six frames byte-identical — the
  loading screen's frames upload-and-release before `ready`, so more goes than the in-page −125 MB at A
  measured here. The heap's **objects are 0.50 GB**; the typed arrays were 1.02 GB and are ≈ 0.88 GB
  after the trees — the "≈ 1.4 GB of JavaScript objects" first written here read `usedJSHeapSize`
  wrong (it does count the ArrayBuffers).
- **The warm-up is for the game, not the takes:** on SwiftShader "the GPU" is a process in the same RAM,
  so `?warmup=1` uploads every never-seen mesh's copy there (+640 MB GPU process, Chrome +721 MB) —
  keep it off for captures. On a real GPU those uploads go to VRAM and the renderer's −0.44 GB is the win.
- The same `onUpload` recipe now runs in rocks and props (fable-2, fable-3, merged tick 226); the
  remaining typed arrays by owner are the snapshot worth taking next.
