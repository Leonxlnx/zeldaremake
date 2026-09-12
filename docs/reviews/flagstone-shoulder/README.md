# Near flagstone shoulder-fracture feasibility

**REJECTED after actual gameplay-view review. The two production files are restored to their exact pretrial source.**
Pinned production source: `71843a28538f00bdbbd0005a65a1b588315753b5`.
The original study was scratch-only. Root applied the exact frozen two-file candidate on8714d2a after Fable handoff5647820443 and exact-scope announcement5647902527. Actual e706 A/F images and B/D controls have now been reviewed; see the decision below.

The preceding actual-image diagnosis found that1e A/B/D/F
already show useful warm key / cool shade separation. Original owner boards 02/06 show low,
chipped stones and irregular plane changes, not inflated pillow crowns. No new global light,
exposure, shadow-filter, AO or material correction is supported. The rejected .35 central-canopy
trial produced broad shade; it stays rejected.

## Exact candidate and scope

Two files are required:

- `src/world/hardscape/geometry.ts`: add optional `SlabOptions.topRelief(x,z,edge)` and apply its
  returned height only through the existing top/inner-shoulder `topY` evaluation. When omitted,
  the original expression and arithmetic are unchanged. No other kernel, triangulation, normal
  smoothing, bottom, wall, UV, attribute or material behavior is edited.
- `src/world/hardscape/flagstones.ts`: provide a shallow, directional depression to near laid
  flagstones. It is full strength inside world radius 8 m and fades to zero at 13 m. Discs are
  explicitly excluded. One stable direction and width come from already consumed `uCrown` and
  `uJoint`; there are no new draws or terrain queries. Relief begins partway across the stone,
  fades out toward its centre and lowers the existing outer top/inner shoulder by at most
  `min(0.82 * bevel, 0.009 m, conservative sampled terrain clearance)`.

This keeps the existing low crown. It does **not** make new holes, alter the local x/z outline,
move stones, grow moss, replace the normal map, modify stairs or add a different collision proxy.
It is a cleaved-shoulder/facet experiment, not a promise of a major silhouette overhaul.

## Source and actual geometry proof

`node docs/reviews/flagstone-shoulder/check.mjs` builds the exact pinned hardscape
before/after with the shared source-pinned hardscape fixture. `source.mjs` reconstructs exact before/after source from pinned718 Git objects and small unique-context edits, requiring full source SHA256 equality. Fresh full evidence/RNG streams go to ignored `gauntlet/tmp/flagstone-shoulder-reproduction/`; the checked-in evidence omits per-stone/per-stream tables. `contracts.mjs` additionally checks exact
source boundaries and runs TypeScript against an in-memory compiler-host overlay with no emit.
It never copies/restores a candidate into LIVE.

- All **619 stones** remain. **196** near non-disc stones change, **423** are unchanged, including
  all **8 stepping discs**, whose position/normal bytes remain exact.
- All original outer walls and bottom-contact vertices and their normals remain byte-exact.
  Local x/z coordinates, metadata, footprints and transforms remain exact. Lowering along the
  already tilted local up vector shifts interior top world x/z by at most **0.1863 mm**;
  this is not a moved wall or footprint. Maximum 3D displacement is **9 mm**.
- No new below-terrain top vertex and no worsened pre-existing penetration was found using fresh
  post-build terrain samplers. The pre-existing lowest sampled top clearance is −71.16 mm in both
  builds; this study neither introduces nor fixes that existing condition.
- Every actual top triangle passes positive local and world upward winding; **zero inverted,
  degenerate or outside-cap triangles** before and after. The maximum cap area error is
  **1.78e−15 m²**. The repaired notched visibility-kernel and the complete fallback/fan emission
  code are source-exact; a non-star-shaped U fallback remains area **7 m²**, with no bad face.
- `breakCell` and the complete `emitStone` dry-run prefix through its early return are exact.
  The accepted stone metadata/stats are exact, so the round11 dry-run hole regression is not
  reintroduced. See `contracts.json` for independent source hashes.
- All **2,937,681 raw random draws across 1,134 streams**, plus the subsequent root RNG values,
  match. Placement, sprout spots, flower heads, matrices, colors and all eight other hardscape
  meshes remain exact. Original UV, color, moss and stain attribute bytes match.
- Existing no-option geometry behavior is exercised by those unchanged other hardscape meshes,
  including stair geometry. Default `topY` remains the exact old arithmetic. No new shader hook
  is required; the existing grain and normal/roughness/AO maps remain active and unchanged.
- Candidate overlay TypeScript diagnostics: **0**. This is a type check, not a production build
  or GPU result. Root still performs the required production build and actual capture.

## Size, normals and cost

The merged flagstone mesh remains **258,963 vertices / 86,321 triangles**, with identical
bounding sphere. Additional triangles, draw calls, attributes, materials, programs and textures
are all **zero**. The changed position/normal buffers have identical sizes. Construction adds
bounded scalar/trigonometric work per laid stone and a temporary relief callback on affected
stones; there is no per-frame update or added shader work. No frame-time claim is made.

**11,933 packed vertices** move. The maximum changed normal angle is **20.76 degrees**. Normal
interpolation still follows the original smooth-bevel policy, so this does not manufacture hard
flat-shaded seams. Direct, hemisphere and specular response may all change coherently with the
new surface normal; their actual visible strength has not been rendered here. All lighting stays
fixed. Existing color/normal grain remains credible rather than being repainted to hide form.

Projection through the original actual1e camera states at 1280×720 gives:

| View | Changed stone candidates in frustum | Median / p90 / max vertex motion, px |
| --- | ---: | ---: |
| A stairs | 113 | 0.127 / 0.733 / 1.824 |
| B house (E same camera) | 62 | 0.095 / 0.544 / 2.121 |
| C lookback | 118 | 0.120 / 0.692 / 1.508 |
| D log | 53 | 0.100 / 0.771 / 1.407 |
| F canopy | 46 | 0.288 / 1.249 / 2.026 |

These are geometric projections of changed vertices, **not** visibility/occlusion results,
actual image differences or a prediction that every candidate is visible. The strongest plausible
benefit is the way broader shoulder facets respond to the existing light, with only small edge
movement. A/F are the primary art gates; B/D check shaded and receding path readability.

## Traversability caveat, measured explicitly

The existing character surface sampler learns the actual merged mesh. Its 10 cm grid extent
stays **122,295 cells**. The flatter shoulder admits **177** additional triangles through its
existing `abs(normalY)/length >= .5` test (64,664 → 64,841), and covered cells rise by **5**
(28,873 → 28,878). Grid bytes/coverage therefore are deliberately **not** claimed identical.

Across **43,621** existing character height queries on the 0.1 m grid over x[−8,10], z[−14,10],
blocking and stair membership remain exact. **3,131** sampled heights change. The range is
**−8.99998 mm to +0.051234 mm**, with at most 8.99998 mm change in adjacent-sample differences.
The tiny positive values occur despite all local top vertices moving down: the tilted triangles
and existing max-height rasterizer change which surface sample wins. Example coordinates and
old/new heights are preserved in `evidence.json`. The numerical check permits the intended 9 mm
cut plus 0.1 mm raster/tilt tolerance; it does not assert exact height equality or stand in for an
actual walk/sprint/jump check. No new blocking volume or stair change was added.

## Actual decision gate

Capture this single candidate with the current lights, materials, planting and camera/time controls
unchanged. Keep it only if A/F show a clearer irregular shoulder/plane response without a repetitive
scooped pattern, conspicuous flattened cutouts, new contact gaps, terrain leaks or path-foot issues.
Check B/D so shade retains the existing stone grain and low profile. If the change is barely
visible or worse, reject it rather than raising the whole crown or compensating with exposure.
No broad follow-up or additional foliage is included in this proposal.

Frozen source hashes are in `edits.json`. Original patch SHA256 is0bdd5055fe7e6a91778c7333b54b51ac83e000d681d4d0e6caa7630c3fac6bea; the reproducible small edits generate the same two candidate source hashes. Camera excerpts come from the immutable1e source reports preserved by the distant-cap-bounds review. The preceding diagnosis and this study are separate from any published
quality verdict or phase-exit evidence.

Root applied the frozen hashes exactly and ran production typecheck/build112. The self-contained
reproduction matches the entire original evidence object, including all619stone rows and the
character sampler. Only two production files change against8714; cap/crate/tuft bytes stay exact.


## Actual e706 decision: reject and restore

Published candidate `e7069a456e6bb3e58f4354983446cdb10f4b35fd` completed environment run
34712063386. Root compared the original A/F pairs against 8714 and revisited owner board 02;
two independent reviewers inspected those originals and boards 02/06. The shoulder response
is slightly different, but the paving still reads as the same broad flat polygon slabs.
The declared meaningful gameplay-view gain is not met. No obvious holes or scooped pattern
were seen, but that does not make a barely visible change worth retaining.

The original strict historical actor-XZ assertion also fails. In C, kid 0 moves approximately
+2.942 mm x, +8.901 mm z and -1.688 mm y. In F, Link moves +3.669 mm x, -0.846 mm z and
-2.471 mm y; the fairy and other NPCs have smaller recorded changes. Ground-dependent pose
or contact behavior is plausible but not established. Preserve the failed assertion and raw
reports; do not normalize these fields or claim the earlier CPU sampler study proves runtime
movement. A/B/D/E actor positions remain exact. Runtime sampler triangles are 64,663 → 64,840
(+177), with five added covered cells; its absolute baseline differs by one from the CPU fixture.

All world cameras, controls, non-character audits, resources, draw calls and triangle budgets
remain exact. Source/publication-byte checks pass. All 16 source, original-byte, ZIP and archive-history
receipts are complete, with zero retries, errors or warnings. Detail actor positions remain
exact; S01/L01 JPEG and depth are exact 8714, while S02 changes one depth cell and L02 changes
81. The four detail views reveal no new prop defect or stronger reason to retain the trial.
The art rejection does not depend on finding a technical defect.

Restore only hardscape/geometry.ts and flagstones.ts to exact source
`8714d2af9556105fe867f9e36a1a44c4a99629f0`. The prior crate rollback and retained cap/tuft work
remain unchanged. No crown increase, stronger exposure or unrelated foliage is bundled in.
The frozen source reconstruction and original proof are retained as an explicitly rejected
experiment, so another agent does not repeat it or mistake it for the accepted ground surface.

[Actual world originals](https://github.com/Leonxlnx/zeldaremake/tree/37109912ca5da2eb0ce25151588740bc778221d2/progress/2026-09-12_190308413-e7069a4)
remain available with the failed check's unmodified source state.

Exact two-file rollback passes production typecheck/build (111 modules).
