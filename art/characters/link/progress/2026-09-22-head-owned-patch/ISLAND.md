# Read-only strap connectivity result

The native cutaway exposes the six original faces as a small tab on the shoulder-strap edge. The low lateral view preserves the cap and shows the tab on the separate brown strap beneath it. Together these views support a **strap/tab interpretation**, unlike the initially occluded images. This read-only connectivity study preceded the later chest-weight trial and joint-only candidate export described in [EXPORT.md](EXPORT.md).

The head-owned region extends beyond that tab. On pinned asset `4dcf89c5…`, exact-position welded topology gives two precisely distinguished results:

| Traversal from the six seed faces | Distinct positions | UV-split vertices | Extent X / Y / Z |
| --- | ---: | ---: | --- |
| Face adjacency, crossing only shared edges whose two endpoints are rigid head | 63 | 230 | 49.910 / 45.217 / 64.591 mm |
| Connected head/head triangle-edge graph | 66 | 243 | 49.910 / 45.217 / 92.189 mm |

The second rule adds only canonical points `28045, 30818, 30823`, joined through head/head triangle edges but separated from the strict face flood by a single-vertex connection. Both traversals stop at every non-head point; neither uses a positional box or a color threshold to select vertices. Exact UV duplicates are retained in the explicit index lists.

The complete 66-point component lies at glTF rest X `0.084733–0.134643 m`, Y `0.828316–0.873533 m`, Z `−0.084434–0.007756 m`. Its entire immediate boundary comprises **40 rigid chest points and seven rigid shoulderL points** (155 and 28 split vertices respectively). There is no path from it to other rigid-head geometry without crossing that non-head boundary. No other GLB primitive shares one of its selected rest positions. The nearest separate rigid-head point is 6.823 mm away and samples green texture; this is not an unjoined sub-micron UV seam.

All **243 selected UV samples** and all **97 fully head-owned triangle centroids** have the same brown color ordering `R > G > B`, with vertex RGB ranges `60–140 / 31–102 / 17–51`. Two mixed boundary triangle centroids are green, consistent with the strap/tunic boundary. Color supports the native spatial evidence; it did not define the selection and is not semantic proof by itself.

This is an isolated head-weight assignment on the shoulder strap, not a continuous piece of the hat/head. The topology alone did **not** prove that rigid chest weighting was the ideal transition because part of the boundary follows the shoulder. The subsequent native trial tested that boundary explicitly: at run phase 102/112 its maximum rest-length error improves from 28.699 to 27.769 mm; at ordinary −15° gaze it improves from 21.590 to 1.637 mm. The remaining shoulder deformation is still visible in the measurements. Reweighting only the small six-face tab would have left most of the connected head-owned strap region untouched.

`inspect_island.py` reuses the existing GLB reader's pure functions and reads the locally retained hash-pinned shorter-boot asset. `head-island-summary.json` contains the compact receipts and explicit selectors; `head-island.json` retains the full local UV, face and boundary data. This local forensic study changed no geometry, weights, clips or source. The later candidate-only check is portable and is documented separately in [EXPORT.md](EXPORT.md).

The root-authorized `preview_chest_weights.py` made a separate scene copy assigning those 243 head rows to chest. It measured neutral, ordinary ±15° look and original run phase `102/112`; every outside-island body position and weight remained exact. Boundary edge lengths are reported separately for chest and shoulder. It rendered only the baseline/candidate −15° low-angle pair, after proving the candidate island positions and boundary lengths were exactly invariant across the three look poses. That accepted native trial subsequently produced GLB candidate `1873fc17…` through the separate 243-byte joint patch; the original diagnostic did not export or replace the production model.
