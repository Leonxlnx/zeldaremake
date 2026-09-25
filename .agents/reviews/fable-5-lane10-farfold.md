# `agent/fable-4-farfold` — the giants' tagged far laminae as one static batch, out of the colour pass where the slots fold them — non-author read (fable-5, lane 10)

## `98d86252` (21:28) — FAIL: did not render (22:00–22:10 UTC)

`broll --test` at the six views: `[page:error] TypeError: Cannot read properties of null (reading 'BYTES_PER_ELEMENT')` during load
and the same out of `render` on the first captured frame — no frame; the play path never resolved `ready()`. The cause was in the
commit's own words — "its CPU arrays released after the first upload like every other tree buffer": `releaseAfterUpload(mesh.geometry)`
nulls `index.array` via `onUpload`, and three r186's `BatchedMesh.onBeforeRender` reads `index.array.BYTES_PER_ELEMENT` **every frame**
(`three/src/objects/BatchedMesh.js:1536`, the multi-draw byte offsets). Plain meshes survive the release because the renderer never reads
the array again; a `BatchedMesh` does. Posted to fable-4 at 22:10 (INBOX).

## `5392cb5d` (22:31 `5ccb23cd` one batch per sector in the sector's own attribute layout, the depth list built directly; 22:40 the lodPool tests) — 22:45–23:30 UTC

**Renders; pixel-identical at the six views; the trees row −0.1 M and −40 draws in play.** The release pass now skips batched meshes
(`if ((o as BatchedMesh).isBatchedMesh) return;` in the compaction walk) and the batch's own `releaseAfterUpload` call is gone.

Six views against the head `e438c6e5` (the branch's merge base `af644f01` differs from it by the audio ambience only):

| view | head → branch | vs reference |
| --- | --- | --- |
| A_stairs | 1.0000 / 0.00 % | 0.1732 → 0.1732 |
| B_house | 1.0000 / 0.00 % | 0.1690 → 0.1690 |
| C_lookback | 1.0000 / 0.00 % | 0.1791 → 0.1791 |
| D_log | 1.0000 / 0.00 % | 0.2334 → 0.2334 |
| E_ground | 1.0000 / 0.00 % | 0.1899 → 0.1899 |
| F_canopy | 1.0000 / 0.00 % | 0.2029 → 0.2029 |

By construction: the far laminae the batch hides in the colour pass are the ones the shader already folded to a point when a lobe's
near canopy is shown; the depth pass still draws them all, so the shadows are the far foliage's at every distance, as before.

In play (`isolate`, the trees row, the head `e438c6e5` beside it):

| pose | head | branch (`columnbatch` `6e09bc1c` under it) |
| --- | --- | --- |
| the east green (43, 4) → W | 218 draws / 3.83 M | **164 / 3.74 M** |
| the far bank (4.06, 42.8) → N | 200 / 3.51 M | **162 / 3.38 M** |

`columnbatch` (#151, not yet in the head) is −12 draws of that at the green; the rest — ≈ −40 draws / −0.09 to −0.13 M — is this branch's:
the giants' far laminae drawn as one multi-draw batch instead of per-lobe groups in the sector meshes, and the slotted lobes' laminae
out of the colour pass. Headless Chrome here has `WEBGL_multi_draw` (checked), so the batched path is the one measured.

At the fixed views (capture mode as `broll --test`, 8 settle frames, the character visible, `__ZR__.stats()`), the head `bed93a19` → the branch:

| view | head | branch | Δ |
| --- | --- | --- | --- |
| A_stairs | 614 draws / 8.967 M | **575 / 8.756 M** | −39 / −0.211 M |
| B_house | 596 / 8.293 M | 557 / 8.131 M | −39 / −0.162 M |
| C_lookback | 533 / 7.959 M | 494 / 7.847 M | −39 / −0.112 M |
| D_log | 523 / 8.741 M | 484 / 8.563 M | −39 / −0.178 M |
| E_ground | 596 / 8.293 M | 557 / 8.131 M | −39 / −0.162 M |
| F_canopy | 555 / 8.098 M | 516 / 7.940 M | −39 / −0.158 M |

The same −39 draws at every view is the batching (the lobe groups' per-group draws in the sector meshes become one multi-draw call,
with `columnbatch`'s share inside it); the triangles are the folded laminae leaving the colour pass — −0.21 M at A against the
commit's −119 K, the difference `columnbatch`'s near-canopy lobes and the depth list's own accounting. **Camera A: 8.967 → 8.756 M,
0.24 M under the 9.0 M cap with Link in frame** — the first build I have measured under it at A with the character visible.

## Verdict

**PASS for merge on `5392cb5d`** (the `98d86252` FAIL is fixed): pixel-identical at the six views by construction and by measurement,
−39 draws and −0.11 to −0.21 M at every fixed view, the trees row −40 draws / −0.1 M at the play look-backs, the shadows unchanged. What
I did not test: a WebGL context without `WEBGL_multi_draw` (the gate falls back to the sector path; the extension is universal in
Chrome and Firefox, absent in some Safari builds) — worth one run with the extension blocked if the gauntlet can do it.
