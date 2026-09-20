# Environment — five native before/after comparisons

Latest verified source: **d9eee5d7**, native27-view `after-bark-linear/` (bundle `index-CUzYDOZs.js`). The bark colour-space correction is accepted: clearer warm grain with identical geometry/draws and byte-identical six hero images versus a9eccd15. The earlier canopy replacement is still under review: Fable-5 correctly found its foliage too sparse to retain C/F's dark crown masses. This branch is not ready for integration as a whole.

| Latest material comparison | Before | Verified mean-only correction |
|---|---|---|
| Tree beside the stairs: visible wood grain instead of unnecessary darkening | ![Before stair bark](after-atlas/sn-bole-stair-bank.png) | ![Corrected stair bark](after-bark-linear/sn-bole-stair-bank.png) |
| Approached distant-tree type, axis3m away: mapped plates and fissures recover | ![Before distant stem](before-stems/distant-stem-v2-3m.png) | ![Corrected distant stem](after-bark-linear/distant-stem-v2-3m.png) |

Reproduce the27 matches using `check.mjs after-atlas after-bark-linear bark-linear-comparison.json` and `check.mjs before-stems after-bark-linear bark-linear-stems-comparison.json`. No page/shader errors; the three bole and three stem images are also byte-identical to the combined study after the deferred chips were removed. Typecheck/build, the linear texture-mean check and source anti-cheat pass. Last formal valid take remains0124 on a9eccd15; it is not relabelled as a take of the new source. See the26m composition caveat below.

The most visible correction replaces the closed dark crown discs beside the stairs with the existing layered branches and leaves. Stone shading is more coherent and exposed bark is slightly warmer; these are modest material improvements, not a claim that the forest has reached the owner references.

Three owner-requested Astra Max agents contributed, alongside Fable's separate geometry/expansion lanes. Character work is deferred. The ten original targets remain in `reference/owner-concepts/` and are comparison-only.

| View | Before | After |
|---|---|---|
| Stair-side canopy: closed cores become leaves and gaps; exposed blunt tips still need work | ![Before canopy](before/F_canopy.png) | ![After canopy](after/F_canopy.png) |
| Gameplay composition: the top-right circular mass is removed | ![Before gameplay](before/A_stairs.png) | ![After gameplay](after/A_stairs.png) |
| Stone close view: shallow crack relief and calmer plate shading | ![Before stone](before/w09-spine-d.png) | ![After stone](after/w09-spine-d.png) |
| Walking-height bark: less olive tint, with existing broad moss still visible | ![Before bark](before/w04-spine-l.png) | ![After bark](after/w04-spine-l.png) |
| Looking upward: comparison of bark/foliage detail, not a new sky or increased tree count | ![Before sky](before/sky-opening.png) | ![After sky](after/sky-opening.png) |

## What changed

- Stone: near AO follows the enlarged colour/normal tile; rotated detail normals point correctly; existing authored cleaves gain shallow recessed shading; worn plate centres are quieter.
- Bark: six existing shade-floor presets retain more bark/moss albedo and less green canopy tint. Geometry, moss placement and leaf lighting are unchanged.
- Distant trees: both detail levels retain the same seeded crown lobes/undersides, and far stems follow near bends. All729 placements and near meshes are unchanged. This repairs the120m switch; it does not disable frustum culling.
- Stair-bank canopy: the existing near-foliage replacement now covers flat lobes at26/30m. No new geometry algorithm, generated mesh change or shadow pass.

## Evidence and limits

Baseline source `ca562e76` (capture HEAD `50ed2466`); combined candidate `3dadc4a3`, bundle `index-BDyGtHka.js`. Both surveys use high quality,1280×720, time12.6, identical19-camera order and no visibility/material overrides. Both manifests completed without page errors. The candidate helper additionally records shader/WebGL console errors. `node art/environment/astra-quality/check.mjs` verifies image hashes, exact camera/time/viewport/override equality and regenerates `comparison.json` using the repository's existing image metrics.

| Main view | Before triangles / calls | After triangles / calls |
|---|---:|---:|
| A_stairs | 8,595,330 / 566 | 8,634,322 / 571 |
| B_house | 7,754,627 / 522 | 7,764,699 / 523 |
| C_lookback | 6,938,215 / 407 | 6,976,959 / 412 |
| D_log | 7,986,347 / 396 | 7,989,171 / 396 |
| E_ground | 7,754,627 / 522 | 7,764,699 / 523 |
| F_canopy | 7,922,992 / 507 | 7,961,736 / 512 |

A rises0.45% in submitted triangles. The existing40-part canopy budget reallocates some other near parts, so a few look-up/control views submit fewer parts; this is a combined gameplay comparison, not isolated per-material attribution. The diagnostic stair view remains above9M triangles (9,934,850); that pre-existing expense is not hidden by the main-view table.

Detail and video-frame similarity are different measurements. Daylight reference SSIM drops by A−0.0013, B−0.0059, C−0.0258, D−0.0099, E−0.0045 and F−0.0289. The largest differences include replacing deliberately uniform closed cores with leaf gaps. These figures are reported unchanged; no rubric/threshold was edited. Formal take-0123 is preserved under `take-0123/`:36/50 overall,31/42 world; W35/W38/determinism pass and anti-cheat is green (97 checks), but the take is INVALID because W24 dropped to1,822 pebbles versus the previous take. Rocks source was unchanged by this iteration. Fable already documented the regression and supplied51fb6b35; that fix and its newer world integration are next. W37/reference matching and other remaining rubric failures are not waived. Independent Fable art review remains pending.

Five additional `after/distance-crown-118m.png` through `122m.png` views inspect an actual placed tree around its switch. They have no corresponding baseline images in this survey and are not presented as matched before/after proof. The CPU geometry check verifies all six crown variants, retained undersides and stem alignment.

Baseline `before-perf.json`:600 identical fixed-step frames from spawn to stair ascent at high720p on the owner's AMD Radeon780M, `perftrace.mjs --finish` (GPU completion included). Median261.9ms/p95354.4ms; a159s cold shader-compilation first frame is retained in the raw data. Other owner browser tabs may remain open, so this is a synchronized local harness result, not an isolated GPU benchmark or a30fps claim. The matching candidate trace (`after-perf.json`) completed at median115.2ms/p95324.9ms; its unchanged vegetation update also fell from14.0 to4.9ms. This large host/load variation prevents attributing the apparent speedup to these changes. No30fps result or isolated fragment-cost conclusion is claimed.

Remaining art work: fuller canopy edges and tapered visible bough ends; less smooth moss coverage; more varied slab/joint/stair geometry; leaf-scale structure in the blurred distant crown atlas. Static stills do not prove temporal stability. The next atlas candidate is separate and is not included in these images.
## Second iteration: distant leaf edges and Fable integration

`after-atlas/` records24 complete native views at `a9eccd15` (bundle `index-Dcw7zlsM.js`). This combines the leaf-shaped far-crown atlas with Fable's newer structures32 world (`69d16c4f`) and its exact W24 pebble fix (`51fb6b35`, cherry-picked as `d459afb3`). It is a separate stage: the five original comparison pairs above remain frozen.

| Target | Previous candidate | Second iteration |
|---|---|---|
| Upward depth-row crowns: blurred margins become leaf edges; oblique planes still show | ![Previous upward](after/w19-spine-u.png) | ![New upward](after-atlas/w19-spine-u.png) |
| Actual distant crowns at121m: sharper contours at the same geometry budget | ![Previous distant crowns](after/distance-crown-121m.png) | ![New distant crowns](after-atlas/distance-crown-121m.png) |

`node art/environment/astra-quality/check.mjs after after-atlas atlas-comparison.json` verifies all24 matched views. Both119m and121m comparisons retain identical submitted triangles, draws and textures. The atlas itself changes no geometry, draw groups or persistent texture size; CPU startup painting adds roughly0.4s on this machine. Native inspection accepts the sharper leaf margins as an incremental improvement, while pale underside planes and close overhead structure remain unfinished. Stills do not establish shimmer or isolated GPU cost.

Fable's pebble correction accounts for the extra20,560 submitted triangles in the six hero views: A now8,654,882/571 calls. The w21 image is chiefly changed by Fable's real log tunnel, so it is not presented as atlas evidence. Formal take-0124 is VALID:37/50 overall,32/42 world, W24 restored, W35/W38 and determinism pass,97 anti-cheat checks green, no new rubric regressions versus take-0122. Evidence is preserved under `take-0124/`; the initial invalid take remains under `take-0123/`. This is still below the phase exit requirement, and W37 remains failing.
## Held bark experiment

The material-only candidate `a2eb130f` has24 matched native views in `moss-study/` against `after-atlas/`; all cameras/time/image hashes match, geometry and draw counts are unchanged, no page/shader errors. `node art/environment/astra-quality/check.mjs after-atlas moss-study moss-study-comparison.json` reproduces the comparison.

Decision: **HOLD / source restored to a9eccd15**. The lantern trunk loses some uniform green but reveals near-black bare patches; north-west is similar, stair-bank and w04 improve too little. It does not reach reference05 warm readable bark. Independent shader review also identified that new near-only coarse moss suppression could amplify an existing LOD colour jump. No NaN, unbounded tint gain, additional texture sample or geometry issue was found. This study is retained honestly and is not part of the owner preview.
## Separated follow-up studies

`chip-and-bark-study/` is the complete27-view native study of ee7de70a. It combined the bark linear-mean correction with sparse chips on11 existing lawn slab rims. All submitted triangle/draw counts match the relevant baselines. The24 original cameras compare to after-atlas; three actual distant-stem controls compare to before-stems (captured at f4a44634, source equivalent to a9eccd15). Reproduce with check.mjs and chip-study-comparison.json / chip-study-stems-comparison.json.

The chip geometry is **deferred**, not accepted: Fable clarified in2d0742a6 that expansion-2 owns flagstones.ts/stairs.ts. The scoped source/test can be recovered from ee7de70a for that owner; d9eee5d7 restores the original geometry. Its independent CPU gates preserved all555 seats, footprints and crowns, all48,969 foot vertices and175,977 triangles. Native w05 differs by0.66% of pixels, so this is a small edge study, not a large stone-quality upgrade.

The bark correction fixes an existing colour-space mismatch: an encoded ffmpeg YAVG value was used as the mean of linear GPU texture samples. The measured high-quality2K mean is0.2554942; the1K version differs by0.67%. The same scalar serves nearby bark detail and distant bark contrast. See the runnable bark-linear-mean-check.mjs and its notes. No moss/floor/light changes or new rendering operations are included. The final mean-only source is d9eee5d7 and its native verification is pending; these combined images are not substituted for that check.
Distance-control caveat: the26m-axis image contains the intended tree only partly. At native y360 it is roughly x586–660 (centre hit24.649m), while the dominant trunk at x662–938 is an intervening variant0 tree about4.7–4.9m from those camera rays. Its improvement is close-range evidence, not26m-fade evidence. The3m/6m controls and partially visible26m target were separately checked. No image was cropped or altered to hide this.
