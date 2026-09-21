# Read-only tree attribution, 2026-09-21

The strongest visible defect in the inspected A/C/F raws is the large, smooth, dark-green oval canopy mass. It is an authored **stair-bank-giant opaque core**, not a distant-tree billboard and not evidence of failed culling. The ordinary leaf-atlas colour issue is separate.

Evidence: untouched 1280×720 `native-shaded/after/{A_stairs,C_lookback,F_canopy}.png`, captured at `b266441d1135d3bd0a6eb093dced3c39eb15e2bc`. CPU geometry/LOD attribution uses `24dc4cacb364f20e13052395bfbde3ec58690ed7`, the requested Fable snapshot. Between their common tree base `6c13f70c` and that snapshot, only `trees/distant.ts` and `trees/index.ts` change: additive north depth rows/placement ordering. The giant core, atlas, material and near-canopy source involved below is unchanged. This is not a claim that the raw images were captured at `24dc4cac` or at later Fable heads.

## Exact opaque-core attribution

All rows hit mesh `giants-authored-leaves-stair-bank-giant`, material role `giantTree`, UV `[0,0]`, flat-leaf tagging; root origin `[10.600000,0.019357,9.150000]`.

| Raw image pixel (top-left origin) | World surface point, metres | Root code / core group |
| --- | --- | --- |
| F (840,205) | [9.470885,3.049288,4.036206] | 1024.199951 / 24 |
| F (990,159) | [9.055891,3.507154,5.781558] | 1025.199951 / 25 |
| F (667,70) | [10.065121,5.066014,1.625064] | 1026.25 / 26 |
| C (160,133) | [9.967386,3.711136,2.599515] | 1024.199951 / 24 |
| A (1095,29) | [9.928629,5.302199,0.987567] | 1026.25 / 26 |

High confidence: broad interiors are visibly opaque, geometry is closed, and these are the first surviving tree hits after applying the actual near-canopy/near-bole slot folds. Source: `src/world/trees/index.ts:806–887` explicitly authors low-variance flat lobes with `core:0.97`; the specific groups above are the lobes at lines 861, 862 and 887. `giant.ts:1252` builds their closed 28-segment × 16-ring ellipsoids and rim dressing. `materials.ts:823` removes directional shading for flat leaves; `LEAF_FLAT_MAP_LUM=0.8` and the flat RGB replacement make this a separate problem from the atlas colour encoding.

The continuous oval outlines and almost uniform interior still read as fabricated canopy lumps, despite leaf silhouettes around the edges. That is the most conspicuous remaining tree defect in these views. It is documented as an intentional visual/SSIM tradeoff, not a newly discovered implementation error. `nearCanopy.ts:54–65` retains the hero-camera cut and records why the prior `[14,17]` flat swap was held. CPU audit shows all 420 parts resident, 64 slots, no synchronous builds/evictions or hero-pass drops; no cache/culling failure is demonstrated. Do not revive held `812634e1`/`208e8fee` or the old flat-swap toggle based on this note.

## Ordinary atlas targets, independently distinguished from flat cores

- **F (252,42)**: first tree hit is `giants-canopy-1-plateau-oak+far-plateau+east-giant+stair-bank-giant`, material role `giantCanopy`, specifically **far-plateau** (root `[31,3.642631,-30]`, matching `layout.ts:521`). World `[26.998298,11.679544,-17.863343]`, distance 37.605773 m, face 1462, root code 8, ordinary/non-flat, UV `[0.793415,0.558302]`. Facing cosine 0.724 is above the full-coverage threshold 0.22. Running the exact seeded cluster texture source into a CPU path recorder finds two opaque leaf fills at this UV; one has **17.995 texels** of interior margin. This is the strongest ordinary RGB-atlas target found here.
- **C (837,208)**: first tree hit is `giants-canopy-2-south-giant+plaza-south+south-centre+southwest-giant`, role `giantCanopy`, specifically **south-centre** (root `[-4.5,0.200261,27]`, `layout.ts:523`). World `[-1.792529,6.317323,35.240833]`, distance 43.382320 m, face 1758, code 6, ordinary/non-flat, UV `[0.699127,0.396540]`, facing cosine 0.999. One opaque fill covers it, with **6.460 texels** of interior margin.
- C (1090,51) intersects `distant-2-near`, instance 6, role `distant-crown`, UV `[0.474135,0.740134]`. This is only a geometric candidate: far-atlas alpha was not evaluated and the UV is near the cell's outside edge. **Do not use it as certified visible distant-card attribution.** A (970,59) and C (556,35) ordinary-card intersections likewise have no opaque-fill coverage and should not be promoted to visible atlas evidence.

The ordinary atlas mapping/material call is `trees/materials.ts:1297–1360`; merged card objects are built in `trees/index.ts` at the `giants-canopy-${s}-${label}` call. Confidence is medium-high for those two ordinary targets, not a rendered-fragment certificate: tree-only rays do not include other systems, wind deformation, mip filtering or exact GPU sampling. The opaque-fill recorder executes the actual 110-leaf PRNG stream, approximates each quadratic with 128 segments, and ignores strokes/gradients as a conservative alpha lower bound. No browser or GPU was used.

## Ownership and reproduction

Documented owner: **fable-cursor coordinates the tree geometry lane** (historically trees-30/32); the explicit 2026-09-20 13:10 overlap map assigns `trees/materials.ts`, `leaf-cluster-texture.ts`, bark shading and distant-tree work to **Astra**, while fable-4 retains white-bark geometry. `.agents/owner-fable.md` excludes `trees/**` and refers the flat-lobe decision to trees-30/owner. The logs and stale claims do not establish any agent's present running state. No source or ownership/log edits were made here.

The parent/root is separately recovering the already accepted four-helper encoding correction `d7516294`; this audit proposes no competing implementation and no wholesale file restoration.

Run from this worktree:

```text
node --max-old-space-size=8192 art/environment/astra-atlas-recovery/audit-tree-identity.mjs 24dc4cac
node art/environment/astra-atlas-recovery/audit-tree-alpha.mjs 24dc4cac
```

Outputs: `audit-tree-identity.json` (all ray hits, LOD audit) and `audit-tree-alpha.json` (source alpha lower bounds). The scripts and this note are confined to this art directory.

## Recovery-branch evidence binding

The original camera manifest is retained as `attribution-input.json`; original raws are on the PR25 branch at [astra-world-resume/native-shaded/after](https://github.com/Leonxlnx/zeldaremake/tree/agent/astra-world-resume/art/environment/astra-world-resume/native-shaded/after). The current native baseline in `native-pair/before` is source5f587c7f. All `src/world/trees`, layout, config and heightfield source is identical between24dc4cac and5f587c7f; A/C/F camera states match the original manifest exactly. This binds the attribution to the current native comparison without claiming the older photographs were newly rendered.
