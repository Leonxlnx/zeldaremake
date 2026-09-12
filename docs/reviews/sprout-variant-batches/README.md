# Sprout variant batches: reproducible source proof

The frozen hardscape-only candidate removes **120,322 submitted triangles / 360,966 vertex
submissions for 2 additional draw calls** in all ten saved camera states. This is about 1.38%
of an 8.7M-triangle frame, with no FPS claim. The 30 boulder plants stay packed; splitting them
would save only another 3,360 triangles for two more calls.

Run from the repository root with dependencies installed and the published source history present:

```sh
node docs/reviews/sprout-variant-batches/check.mjs
```

The proof pins published `e6d6ac06dc8706b8b41f13b0518077f7d8c1d242`. `source.mjs` reconstructs
both candidate files from Git objects and unique-context `edits.json`, requiring full before/after
SHA-256 equality. It imports the existing tracked hardscape-disposal fixture and checks its hash.
There are no duplicated full production snapshots and no dependency on local scratch inputs.

Full fresh evidence and raw RNG stream hashes are written to ignored
`gauntlet/tmp/sprout-variant-batches-reproduction/`. The checked-in `evidence.json` is the compact
numeric contract and must match the reproduced result. Original full local evidence remains in
`gauntlet/tmp/sprout-batch-feasibility/`; `provenance.json` records its hashes and reproduction.
No source is copied into LIVE, and no source restore, browser, render or production build occurs.

## Candidate and preserved behavior

The only proposed production files are `materials/sprouts.ts` and `hardscape/index.ts` under
`src/world/`. The factory gains optional `splitVariants`; hardscape opts in and reports the actual
emitted `packs` and dedicated `gritDrawCalls`. Its original traversal packs remain
`[1], [0], [2,6], [3,4]`; emitted batches become `[1], [0], [2], [6], [3], [4]`.

The complete original pack/variant/list jitter traversal runs first. Selected variants then copy
its exact instance buffers and selected geometry attributes into separate batches. The slot IDs
become zero on both sides of the unchanged keep expression. Each result retains the original
complete pack's exact object bounding sphere, preserving frustum admission, depth-sort centre
and the existing wind/LOD visibility envelope. Temporary packed scaffolding is disposed before
entering the scene. Boulder caller/default behavior is unchanged.

| Shared-factory scope | Before triangles | After triangles | Draws before → after |
| --- | ---: | ---: | ---: |
| Hardscape TUFT_B | 26,082 | 26,082 | 1 → 1 |
| Hardscape TUFT_A | 60,690 | 60,690 | 1 → 1 |
| Hardscape TUFT_C / GRIT | 139,600 | 66,810 | 1 → 2 |
| Hardscape CLOVER / CUSHION | 94,024 | 46,492 | 1 → 2 |
| Boulder TUFT_A / TUFT_B / FERN | 5,040 | 5,040 | 1 → 1 |
| **Total** | **325,436** | **205,114** | **5 → 7** |

The hardscape selected geometry remains 200,074 triangles. All off-screen members of admitted
batches and distance-LOD-collapsed triangles remain counted. Installed Three submits these
non-indexed meshes through `drawArraysInstanced`; the original discarded variants consumed
vertex work despite rasterizing zero area. Sprouts cast no shadow, and the ordinary composer
renders them once into HDR. This saves real forward geometry, with no density or scoring discount.

The proof checks 3,179,761 raw draws across 1,211 streams plus subsequent root values; every
source spot, matrix/color slice and selected position/normal/color/UV/wind/tuft-mask byte; complete
shader and traversal source; all original culling spheres/flags; and twenty other hardscape/rock
meshes. The semantic mask still excludes clover, cushion, grit and fern. TypeScript uses an
in-memory compiler overlay with no emit and has zero diagnostics.

Final attribute payloads remain 69,426 static vertex bytes + 461,760 instance bytes. There are
2 additional mesh/geometry objects and 20 more buffer objects (50 → 70), dividing the same bytes.
Materials remain two; no new texture, shader instruction, uniform, varying or program feature is
introduced. Construction adds temporary arrays/copies; there is no per-frame update. Two extra
draws and driver allocations may matter on a CPU-bound device, so no timing gain is asserted.
Existing hardscape double-dispose releases six mesh handles/geometries and the shared material
once, with zero borrowed-texture disposals. Rocks retain their existing ownership behavior.

## Actual camera provenance and pending appearance gate

`captured-cameras.json` contains compact exact excerpts for A–F, S01/S02 and L01/L02, including
original report hashes, image hashes and immutable archive commits/paths. B/E share a pose.
The world report is from source8714 and details from source7184; their sprout factory, callers
and camera source are independently checked against the published fixture pin. Full-frame
statistics in the excerpts are historical context, not a new candidate capture.

All ten installed-Three frustum checks yield the same reduction: 120,322 triangles / 360,966
vertices, +2 draws. Distance-collapsed instances remain counted and unchanged: A829, B503, C318,
D383, E503, F577, S01 332, S02 333, L01 523, L02 343. No screenshot or GPU execution is needed
to reproduce these submission counts.

The final patch needs root's usual production build and actual image/depth/budget
comparison. Selected data and render order are deliberately retained, but actual pixel equality
is still a required gate: draw boundaries and opaque equal-depth ties must be checked in the real
renderer. Keep all planting, lighting and camera/time controls fixed for that trial. Reject if any
plant, LOD transition, material response or image content changes unexpectedly. Root can then use
the verified headroom for richer details; this study adds none itself.

Frozen candidate SHA-256 values are unchanged:

| File | SHA-256 |
| --- | --- |
| `src/world/materials/sprouts.ts` | `8c9ce23ef725b43c994498ad488e69a3e903e01fc179c0c6c7085186d27ff1a7` |
| `src/world/hardscape/index.ts` | `33bc3cdca5240301c86a89a25101ebb98f1b67efc32d959ec4d0b2a55df30968` |

The original frozen patch hash is
`fb6780bdc2147653563a27345a3ccca51e07d851d36b97e91671256b0375dafb`.
This package changes no appearance gates and proposes no spatial culling, indexing, multi-draw,
new shader or broader benchmarking.


## Root integration checkpoint

Root applied the exact frozen two-file patch on `ef2100e3d3f885692b10116f89b1a676c83dbdd0`,
after the rejected stone and crate experiments were reverted. The proof's published e6d pin
still contains the rejected stone geometry in both sides of its isolated comparison; neither
sprout candidate touches those geometry files. The actual comparison will use the restored
ground surface on both sides, and will check actor state without discarding differences.

Both candidate source hashes match the table. Exactly two production files change; restored
geometry.ts and flagstones.ts remain byte-exact 8714. Production typecheck/build (111 modules)
and the existing shared semantic-mask test pass. No extra broad test suite or shader change
is bundled into this optimization. The actual gate is now complete below.

## Actual result: retained

Published source `7bafeb0dbfadb5fd2d0830ef8fde7a690ca7b9b7`, tree
`218fc34cf18e69d67e1e55990e19b1dad43e1e49`, passed the strict gate in environment run
34713904603. All sixteen actual JPEG bytes and measured depth hashes are exact against
`ef2100e3d3f885692b10116f89b1a676c83dbdd0`. Actor/control/sampler state and unrelated audits
are exact. No image tolerance, diagnostic relaxation or duplicate visual review was needed.

Every view removes exactly 120,322 submitted triangles for two additional calls. Scene mesh,
instanced mesh and unique geometry counts increase by two; total instances are unchanged.
Programs remain 75 and textures 70. Intended hardscape audit changes match the source proof:
packs `[[1],[0],[2],[6],[3],[4]]`, joint calls 4 to 6, grit calls 0 to 1 and submitted triangles
320,396 to 200,074. B/E now reports 656 calls / 8,604,739 triangles; L02 is 546 / 8,281,747.

One B candidate used a same-state blank-buffer retry; the other fifteen used zero. No final
errors or warnings. Original archive bytes, complete source identity, ZIP entries/CRC,
historical folders and all eight inline preview targets pass verification. The 202 source
inputs hash `05eb5c662a11382d24a327fd73e72b27b3537955c17eb599638dd9cefeff0440`.

Actual originals: [twelve world comparisons](https://github.com/Leonxlnx/zeldaremake/tree/403cf381dfcc58bcd4bba09091940f066e26b73b/progress/2026-09-12_194122798-7bafeb0)
and [four details](https://github.com/Leonxlnx/zeldaremake/tree/eb691093d5c8b2d456ce928ac4a648a9f9ff459e/details/2026-09-12_194416836-7bafeb0).
These older captures retain JPEG originals; original PNGs and an independently downloaded
dist build rehash are not claimed. Paired gallery columns are same-source gain 1/3 controls;
the strict optimization comparison uses matching historical ef variants.

Retained because content is unchanged and the real submission reduction is verified. This
adds no visual detail itself and establishes no FPS or interactive LOD timing improvement.
