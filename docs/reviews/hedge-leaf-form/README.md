# Hedge leaf form — source review, actual verdict pending

One proposed source change: `src/world/vegetation/plantgeo.ts`. The existing high-LOD hedge leaves receive varied pitch, shallow transverse cupping and progressive tip droop. Only vertex y changes before actual normals/bounds are computed. Width-to-length and twist variation provide the pose without new random draws. Root handles application and the separate actual capture; this package is CPU evidence, not visual acceptance or a gauntlet verdict.

The original art review used current A/F originals and owner boards 05/08: the hedge looked like regular stacked shelves. This study aims to vary broad-leaf profiles and overlap. It adds no lighting term, shader-normal substitution, leaves, textures or scenery.

## Exact, portable reconstruction

Baseline commit: `ef2100e3d3f885692b10116f89b1a676c83dbdd0`.

| Source | SHA256 |
| --- | --- |
| Published plantgeo baseline | `0f05517365fc89ffe83bdbe50a5c570e40541fb7db2c37845bb5425f6f853256` |
| Frozen candidate | `98ccdc110e23283097b1b9366bec39aabf3d7f914e4419deb5f19a35957a02f9` |

From a repository checkout with that git object and installed project dependencies:

```sh
node docs/reviews/hedge-leaf-form/check.mjs
```

`source.mjs` retrieves the published baseline and applies the two unique-context edits in `edits.json` **in memory**, asserting both source hashes. No full source snapshots, ignored scratch files, images or network requests are needed. The original fixture builds baseline/candidate geometries and actual `buildPlants()` outputs from pinned git objects. The check regenerates and deep-compares the complete report against the unchanged frozen `evidence.json`, then prints a compact result. It writes no source, evidence or other files.

The recorded original full-source TypeScript overlay passed with zero diagnostics; its exact receipt is in `provenance.json`. This geometry check does not repeat that typecheck. Root's current integration typecheck/build and actual renders remain separate gates. Provenance retains the original receipt hashes; those describe the frozen scratch study, not a requirement to possess scratch files.

## Geometry, determinism and placement proof

| Check | Frozen result |
| --- | --- |
| Changed high hedge leaves | 831 of 846; 15 envelope leaves untouched |
| Exact leaf attachments | 846 |
| Exact stem/branch tube ranges, including normals | 108 |
| RNG calls, arguments, values and sequence | 804,346; identical digest |
| UV, color, index and normalized leaf tags | Byte-exact |
| Ordinary bushes, all lower hedge LODs, other generated plant geometries | Byte-exact |
| All authored placements/tints and six-view CPU LOD submissions | Exact matrices, counts, visibility and stats |
| Non-finite values / new degenerates / reversed leaf triangles | 0 / 0 / 0 |
| Minimum new/old face-area ratio | .8046 |
| Minimum old/new face-normal cosine | .8095 |
| Extra vertices / triangles / draws / attributes / materials / textures | 0 / 0 / 0 /0 / 0 / 0 |

The candidate's independent variant and `buildPlants()` geometry builds match. Median maximum displacement per leaf is 35.1 mm in variant space; p90 is 85.7 mm and maximum 130.3 mm. Median face-normal change is 10.25°. Tip slopes change from −14.69…+29.72° (median +8.44°) to −36.57…+35.18° (median −.71°). Horizontal lamina footprint remains exact; the intended shape remains broad rather than ribbon-like.

Leaves holding any original plant-box extremum remain untouched. A coherent per-leaf amount keeps every other deformation within the original vertical box. All three original local boxes, their min/max y and their transformed conservative boxes are exact. This preserves `groundToZero` seating and the `hedgeHeight()` scaling used for authored placements.

**Tight bounds are not all exact.** Terrain tilt mixes local y into world axes: bounds computed directly from actual transformed vertices expand at most **9.241 mm** across 12 authored hedges. Reviewed bank item 10 expands only .422 mm; item 11 does not expand. Bounding-sphere radius is exact for variants 0/1 and grows **1.162 mm** for variant 2. Existing tested placement and six-view submission results still match. These bounds do not prove arbitrary-camera culling or all old leaf/stem overlaps unchanged.

Only three high-LOD variants allocate temporary construction arrays/vectors. There are no new persistent resource owners or disposal changes. Construction time was not benchmarked, and no frame-time improvement is claimed.

## Frozen projection diagnostics and transition risk

`projection-summary.json` retains the original compact projection results, exact A/F camera/ROIs, selected original leaf identities, and all four threshold probes. `provenance.json` pins the original projection script/full report, actual e706 capture metadata and leaf-identity report. Huge per-leaf arrays are omitted. **The portable check does not rerun projection**; these are explicitly frozen CPU diagnostics, not candidate screenshots.

The study replays existing pinned source wind at time 12.5 with actual e706 A/F camera poses, 1280×720 perspective. It includes every leaf projection intersecting each selected rectangle, even hidden leaves. It excludes full-world occlusion and GPU raster/shadow effects.

| View | Leaves in rectangle | Median maximum profile motion | p90 | Maximum |
| --- | ---: | ---: | ---: | ---: |
| A stairs | 372 | 5.65 px | 14.83 px | 21.49 px |
| F canopy | 611 | 4.19 px | 10.74 px | 17.17 px |

Leaves identified at selected occupied pixels in the original images move up to 13.97 px in A and 11.46 px in F; some F crown-edge leaves remain unchanged. This does not guarantee candidate coverage at those pixels. Projected width is not uniformly larger: median 4.20→4.60 px in A and 3.97→3.84 px in F. Brighter or uniformly broader foliage is not predicted.

At the existing **26 m high-to-mid transition**, probes along both A/F bearings show **1.27–1.47 px median additional per-leaf profile change, maximum 5.35 px**. The high-LOD overall projected boundary changes by less than .054 px in those probes. Mid geometry is unchanged and already switches substantially: item 10 is 4,858→938 triangles; item 11 is 4,164→804. That existing difference does not establish that added interior profile motion is harmless. **A real moving-camera threshold check remains required; seamless LOD transitions are not claimed.**

## Actual acceptance still required

Use one isolated actual source comparison with camera, wind, materials, density, color and light retained. Review A/F for less regular shelves and credible broad-leaf form, plus B/C bank silhouettes. Reject wilted or cluttered profiles, or an imperceptible result. Check the 26 m transition in motion. Do not mask a weak geometry result by adding exposure, light or more leaves. No Fable house, limb, placement or shader source is part of this proposal.

## Root application

The exact frozen candidate was applied to published `0d4ae524bb29a64df796e7506e34761498626244`.
Production typecheck/build passes (111 modules), and the installed plantgeo SHA-256 matches
the candidate above. This integrates only the leaf form; global light, material and Fable house
source remain unchanged. The separate CI sweep retains full-scene original PNGs and explicit
forced-rebucketing limitations. Actual appearance and transition decisions remain pending.

## Actual 9ef result: form gain, transition decision still open

Published `9ef903c58c3ee70eccaf919d565a1eb19cd1bef1` completed all twelve world and four detail
captures. Root viewed A/F/B/C and compared the 0d predecessors; two independent reviewers
inspected the same originals and owner boards 05/08. F shows broader visible leaf faces and
less uniform horizontal stacking; A supports that modest gain. B/C show no convincing wilt,
clutter or newly blocked path. The hedge remains dark and regularly branched. Art retention
is provisional until the separate detail-transition observation is useful.

All sixteen source/image/publication contracts pass. Cameras, actors, layout, audits except
construction timing, material/resources and submitted budgets match 0d exactly. Programs stay
75 and textures 70. A/B/C/F change 108/33/48/124 of 3,600 depth samples; D and S01/S02 JPEGs
and depth are byte-exact. L01/L02 depth remains exact with tiny image residuals. All sixteen
have zero retries, errors and warnings. Source inputs hash
`939e8ed36003a28fc9c19d968985bc5dfd00fad57d61f9f6b02eb9a28f67a4ce` over 206 files.

[World originals](https://github.com/Leonxlnx/zeldaremake/tree/6c0888409116600733cc06b5391791a582deb0b1/progress/2026-09-12_200727869-9ef903c)
and [four details](https://github.com/Leonxlnx/zeldaremake/tree/6c0888409116600733cc06b5391791a582deb0b1/details/2026-09-12_200903738-9ef903c).

The first eleven original PNG sweep frames publish successfully and pass their data contract,
but **fail the intended framing requirement**: a foreground birch at approximately 5.7 m
obscures both hedge target centres around x 638–641 / y 340–367, versus their 26–27 m depth.
Sparse probes do not prove every leaf hidden, but the view is insufficient to judge both
transitions. It is inconclusive, not a seamless-LOD pass. The next camera plan must avoid the
identified blocker without altering scene objects.

[First sweep originals and unmodified findings](https://github.com/Leonxlnx/zeldaremake/tree/d34908eb9cd58ccad3c4fba8019144cde35fb49b/motion/2026-09-12_201300924-9ef903c)
remain available. All eleven PNGs have zero retries/errors/warnings; complete archive history
and original-file ZIP verification pass. H01/H11 repeats are exact; the other four pairs differ
in PNG/audit, and H04/H08 has one changed depth cell. These results stay recorded.

The tree inventory sequence is explained by source: trees/index.ts retains a 1.5 m camera
cache in both update and onCameraMove. The 1.608 m sweep rebuckets trees at H01 far, H06 near
and H11 far only; intermediate return pairs inherit different tree buckets. Vegetation's
explicit forced update is separate. This explains inventory counts, not every tiny pixel
residual, and does not establish renderer nondeterminism.

The new free-camera views cost 710–714 calls / 9,078,425–9,127,857 submitted triangles,
above the saved-view 700 / 9M envelope. No matching earlier sweep establishes a regression.
These are supplemental observations; neither performance nor phase-exit approval is claimed.

## Corrected actual view: e2ee5f0

The tooling-only control `e2ee5f076774ab36d1e751b1f1753781795a417d` keeps exact9ef
production and moves the sweep track1 m south. All16 normal JPEG/depth/audit contracts match9ef
exactly, with zero retries/errors/warnings. The corrected11 original PNGs are archived at
`fab1e65fdc2dc5170d5c4551b1fb1327bdaed73b/motion/2026-09-12_205115879-e2ee5f0`.
Their dedicated schema/source/dist/plan/PNG/state/history checks pass, also with zero retries,
errors or warnings. The original failed-framing9ef gallery remains intact.

Root personally inspected H02/H03 and H04/H05. The birch now sits left of both target centres;
bank foliage is visible, with no obvious whole-crown jump across either10 cm bracket. Small,
dark overlapping crowns limit judgment of individual leaf popping. Source-root probes are
approximate visibility aids, not exact leaf/material IDs; sparse depth now finds foliage or
background rather than the former5.7 m birch. This supports provisional retention of the modest
A/F form gain, without claiming a seamless interactive transition or a matched pre9ef/new9ef
comparison on this corrected track. Continuous playback remains unmeasured.

Return pairs H02/H10 and H03/H09 are depth-exact; H04/H08 and H05/H07 each differ at one depth
cell. H01/H11 is fully exact. Tiny return PNG differences and tree-inventory changes preserve
the previously explained1.5 m tree cache; no tree update or equality guard is changed. Actual
free-camera cost is713–717 calls and9,101,218–9,226,004 submitted triangles. The corrected track
has no historical same-track baseline; it is not a fixed-view budget or FPS approval.
