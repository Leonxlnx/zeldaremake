# Read-only F coverage diagnosis — rejected surface candidate

Verdict remains **REJECT** for source `063772a4bfc848733e060ded98614d04a626e3d4`. The native C/F pair closes the haze-bright gaps but restores broad smooth faces. This diagnosis explains the rejected candidate; it makes no current-head or new-render claim for `e88e697a`.

## What was measured

The actual selected bank geometries were rebuilt from exact Git source with inert materials. At native F camera, 1280×720, time 12.6, their actual `aRoot`/`aWind` attributes were displaced using the current giant wind equations (strength 0.85, whole-tree stiffness 0.97, flex 0.3). Double-sided triangles were projected and rasterized at output pixel centres. Three original 896-triangle core masks were partitioned by their nearest core. All three fine-leaf parts then competed together against those cores, original tagged opaque laminae and selected near wood.

All 25 recorded source hashes and both analysis-script hashes match. The native manifest identifies the same source commit and public hash `71f5ab095073d488366c6e84de23a07a22d009065e03fb7289530b5f74bd8b7f`. The after F PNG matches its manifest hash `9243c8d5e913e59befef4e84d8c549e44c601f295e303cf468ff34827d9bd489`.

Independent `Three.Ray.intersectTriangle` checks at 123 pixel centres agree on the frontmost category and each intersected category's depth, within 1e-9 NDC. These use world-space triangle intersections, independently of the screen-space barycentric raster calculation.

## Coverage result

| Nearest core group | Core-mask pixels | Fine leaf frontmost | Fine projection only behind core | No fine-leaf projection |
| --- | ---: | ---: | ---: | ---: |
| 24 | 34,171 | 6,844 (20.03%) | 5,868 (17.17%) | 21,452 (62.78%) |
| 25 | 38,798 | 5,028 (12.96%) | 8,154 (21.02%) | 25,601 (65.99%) |
| 26 | 23,980 | 4,120 (17.18%) | 5,493 (22.91%) | 14,351 (59.85%) |
| Union | **96,949** | **15,992 (16.50%)** | **19,515 (20.13%)** | **61,404 (63.34%)** |

The frontmost core itself occupies 80,384 pixels (82.91%); old opaque laminae and near wood account for the other 573 pixels. Exactly 16,030 mask pixels have a fine leaf in front of the core, of which 38 are hidden by the other included opaque geometry. The table's categories therefore do not sum to 100% without that distinction.

There are **7,051 leaves**, 6,748 with a rasterized pixel in this viewport. Only 2,018 leaves own any unoccluded pixel after the included depth competition; 71.38% own none. This is not evidence that their vertices are buried: almost every centroid passed the earlier radial exterior test. Far-side leaves remain behind the opaque core from F.

- Physical leaf length: median 0.2213 m; p10–p90 0.1815–0.2615 m.
- Clipped projected triangle area per leaf: median 26.76 px²; p10–p90 8.87–66.04 px². These leaves are not generally subpixel geometry.
- Sum of projected triangle areas: 231,260 px². Per-leaf deduplicated footprints sum to 224,674 pixel samples, but their union is only 48,476 pixels: **4.63 overlapping leaf footprints per covered pixel**.
- Inside the core masks, leaf footprints sum to 158,585 samples. Only 57,024 of those samples are in front of the nearest core. Those front samples cover 16,030 unique pixels: **3.56 layers per useful pixel**, including 40,994 duplicate samples.
- Across the viewport, 28,769 unique fine-leaf pixels survive the included opaque geometry. Inside the core masks, 80,957 pixels lack a frontmost fine leaf. This is a measured residual area, not a target requirement that every pixel must become a leaf.

The available raw projected area exceeds the core-mask area, but overlap, outside-mask coverage and back-side occlusion prevent treating it as useful coverage. Even perfectly removing overlap from the **footprints currently in front of the core** could cover at most 57,024 / 96,949 = 58.82% of the core mask without changing their total area. The all-leaf footprint sum is 2.32 times the mask area, but includes the far side and outline. Therefore **the fixed budget's sufficiency is unknown**. These measurements do not establish an additional required leaf count, or prove that any particular redistribution will cover the residual area.

## Exact visible examples

Triangle indices below are zero-based within the named geometry in the exact rebuilt asset `stair-bank-giant`.

| F pixel | First included hit | Nearest selected fine leaf | Diagnosis |
| --- | --- | --- | --- |
| (675,85) | `authoredLeaves`, group 26, triangle 13218, 12.779482 m | `nearCanopy:lobe:26`, triangle 1139, leaf 4882, 16.167365 m | Fine leaf is 3.387883 m behind the core. |
| (1000,155) | `authoredLeaves`, group 25, triangle 10468, 11.318346 m | No intersection | Actual gap in fine-leaf projection. |
| (733,122) | `authoredLeaves`, group 24, triangle 7519, 13.230948 m | No intersection | Actual gap in fine-leaf projection. |

The group 26 core hit at (675,85) is world (10.226480, 4.892362, 1.710423). Source `giant.ts:1344` excludes new anchor sites below floor+0.30 m = 5.05 m for that lobe. Existing leaves can extend down from these sites, but those high anchors are an additional lower-flank coverage constraint. Covering an original horizontal underside exactly at floor 4.75 m with externally placed, fluttering geometry while also keeping every new vertex above that floor is a separate geometric limitation; this measurement does not claim to solve it.

## One minimal proposal, not implemented in this evidence

Keep the original backing and existing per-group caps **2,800 / 2,100 / 2,200**, leaf sizes, materials, wind and draw slots. Replace the current concentration into **40 / 32 / 32** tiny terminal fans with fixed-budget allocation across the actual core surface, using the already recorded, bounds-valid surface sites. The earlier receipt records **102 / 71 / 52** sites before the inset-bound filter. Select separated sites in three-dimensional surface space rather than their random-array order, with no camera, screen coordinate or F-derived exclusion. Allocate fewer leaves to each separated shoot. Reuse the existing spray/rosette construction and attachment to recorded secondary wood; leaf petioles remain attached to botanical shoots rather than an unconnected covering.

The measured median 22.1 cm leaf length gives the physical scale for site separation and shoot support. Neighbouring shoot ends substantially closer than a leaf length can repeatedly occupy the same footprint. Prefer shoot paths that spread petioles over their local surface neighbourhood instead of stacking approximately 64–70 accepted leaves at one short terminal site. The observed 3.56 layers on useful pixels shows why reduced concentration is worth testing. It does **not** prescribe an exact 22 cm spacing or a 3.56-fold increase in area: lamina widths, orientation, local surface curvature and back-side occlusion matter. A future bounded CPU proposal must measure actual site distances and supported patch extents before choosing that spacing. The current diagnosis makes no new site-distribution or coverage claim.

The exact source seams at `063772a4` are `nearCanopy.ts:228–247` (surface-site selection, carrier count and terminal path), `nearCanopy.ts:476–490` (per-patch leaf scale and short twiglets), with existing sites recorded in `giant.ts:1342–1345`. This changes distribution rather than requesting more leaf area. It remains a hypothesis: the unused sites' actual projected coverage has not been measured, and the group 26 floor restriction must be retained and separately assessed.

Maximum physical-leaf triangles stay 7,100×8 = **56,800**. More attachment shoots would add wood; that cost has not been built or measured and must be bounded before a trial. No additional leaf budget is justified by this receipt. The parent-reported earlier W38 headroom of 241,099 triangles is not newly verified here. The parent's later `68b3eb96` update includes a grass-distance increase; no current canonical triangle headroom is inferred.

The authorized next local prototype keeps the current bank's complete **65,440**
near-triangle budget: at most 56,800 leaf triangles plus 8,640 wood triangles. It
must improve CPU surface coverage at both F and C and disclose outside-mask leaf
area before a native pair is considered. It has not been built by this receipt.
For scale only, linear extrapolation of the rejected geometry's current useful
area to the entire mask would require 35,594 extra leaves / 284,752 leaf triangles,
already more than the conservative 241,099 frame headroom before added wood.
That is not a required budget or a coverage prediction: adding leaves at the same
sites would mostly deepen overlaps. The measurement supports redistribution first.

For any future prototype, the parent reports current canonical `giant.ts` and `nearCanopy.ts` still match the `520537e6` baseline, while `writer.ts` now packs attributes and releases arrays after upload. That current writer behavior must be preserved; this exact-063 diagnosis does not authorize restoring older writer or unrelated source files.

## Limits and reproduction

Original alpha cards, unrelated world meshes and other original tree wood are omitted. Thus the unoccluded fine-leaf area is an upper bound before those occluders, and the masks represent projected geometric cores, not their exact visible final-image segmentation. The result models neither shader color/lighting nor GPU float precision, MSAA, FXAA or postprocessing. A single F pose cannot establish all-view coverage. The independent rays validate the geometric raster classification, not a complete GPU image.

For reproduction, create an isolated checkout of this evidence branch, install
the locked dependencies, then apply the included rejected patch there only:

```powershell
git apply art/environment/astra-bank-backing/REJECTED-063772a4.patch
node --max-old-space-size=4096 art/environment/astra-bank-backing/measure-screen.mjs WORKTREE
```

The portable runner reads the included native manifest and asserts all 25 source
hashes against the unchanged frozen receipt before constructing the geometry.
An optional second argument selects another copy of that same manifest. It asserts
exact parity of all coverage, area, overlap and ray results, then writes
`screen-coverage-reproduced.json` separately. The frozen report still records the
original author's script hashes and local manifest path; its SHA-256 remains
`38140f4f9d8ef2e5a1ca7091c63b8e7efd09619f6af0a73dc52b4440db308a61`.
The portable path/output changes are not retroactively attributed to that run.
No production geometry, capture or density change is delivered in this evidence.
