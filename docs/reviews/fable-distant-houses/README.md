# Fable distant houses — integration review

Pinned source: `871d27b08218f5f10d509e443483f9ad83d0110c`, parent `cee9888d735dfa957007a13af2bc267e6457d452`. Read-only geometry, material ownership and cost review. No production edits. No pinned actual take for this source was present locally; the commit's SSIM/light-point claims are Fable's measurements, not independently reproduced here.

The direction matches the original owner boards `01-village-lighting.png` and `08-gameplay-composition.png`: several warm inhabited structures at different heights and depths. This is a defensible environment addition. The accepted earlier house fixes remain separate outstanding work.

Reproduce from the repo root:

```sh
node docs/reviews/fable-distant-houses/check.mjs
```

The check loads committed TypeScript with installed Three, builds the real complete tree placements/geometries, and executes both structure versions. Materials are inert stubs preserving shared identities and consolidation flags; the new glow's actual color/settings are reproduced. Textures/shading are not rendered. The fixture records the real bole vertex span from the writer without changing any geometry or random draws, so cross-sections exclude roots, branches and leaves. The frozen `evidence.json` contains source hashes, measurements and limitations. Reproduction writes only to `gauntlet/tmp/fable-distant-houses-reproduction/`, preserving committed evidence.

## Integration findings

- **Three hosts exist in the actual built tree system.** Both authored column seats survive all placement exclusions, with their real yaw/scale; the north-east giant is built. Terrain seats and platform elevations agree. The principal boles overlap the platform discs and rise into the caps, so none of these houses is wholly floating.
- **One small actual hull overlap:** the hollow-column's bole protrudes through the tapered/wobbled upper wall, first found at world y≈10.84 m and reaching **2.695 cm** at y=11.50255 m (1 cm below eave). The lower wall contains it. Thirteen measured wall-height sections show no principal-bole protrusion for north-east (≥15.7 cm clearance) or west-column (≥83.2 cm). A narrow future correction is to enlarge only hollow-column radius slightly (e.g. test 1.55→1.59 m) or reduce its offset relative to the *resolved* bole, then recheck; this is a candidate direction, not a verified patch. No image claim about the tiny protrusion.
- Centre rays to all three windows and doors are clear of their respective host and house hull at canonical A/B/D/F. North-east's middle-post pod is hidden by its own host at B; that is ordinary occlusion, not a contact failure. Other scene objects and leaf alpha were not used for a full visibility verdict.
- **Cost verified:** +5,217 scene triangles, including +3,720 caster triangles and 1,497 noncasting glow triangles; +1 consolidated mesh; +0 point lights. The new bark/wood/cap geometry folds into existing material buckets. This measures source geometry and mesh counts, not actual GPU submissions or frame time. Shared buckets can submit the added geometry whenever visible; the glow adds a draw only when its bounds are in view.
- Existing audit changes are only `meshes`, `triangles`, `meshesBeforeMerge`; hero `houses` remains 2 and new `distantHouses` is 3. The 5,217 triangle audit is correct. No nonfinite attributes or normals opposed to triangle winding. Each cap contributes 28 collapsed-pole degenerate triangles (84 total): small avoidable topology cost, not a broad normal inversion.
- The new `distantGlow` material owns no textures. The existing structure teardown disposes the new merged glow geometry and its material once per system disposal. Bark/wood/cap reuse the existing shared materials and cached resources; no extra point-light or loaded texture resource is created.

## Material and ownership details

The actual un-tinted glow peak is **2.2 linear**, matching the audit and material initializer; the distantHouse header's 2.6 is stale. The lime vertices multiply red by .72, reducing their actual maximum to **1.584**. Those lime pods receive only partial exemption from heightfog's 1.3→2.0 far-shade ramp; `distantGlowPeak` describes the shared material, not every tinted element. This is not a request to brighten them without an image comparison.

Both previously accepted fixes are **absent** from this ancestry: `house.ts` is byte-identical to 0f9426c, so Saria's known support-bough/window occlusion persists; `materials.ts` adds distantGlow but still attaches no disposal listener for generated cap-moss normal/albedo textures. Keep these on Fable's active follow-up list. Do not dispose borrowed library maps to address the owned procedural maps.

Host locations remain duplicated constants outside layout/shared data, as Fable already acknowledges. Today's source aligns, but a moved/skipped column or changed giant seat would leave the authored house behind. A later shared contract should publish accepted built hosts and their actual bole geometry/transform, not merely repeat seat coordinates.

Small construction detail visible in source: walkway-post pod hangers begin 12 cm sideways and 2 cm above their 9 cm square post tops, with no connecting hook. This leaves a short unsupported hanger gap; a bounded future detail fix can add a short bracket from the real post top or hang directly from that top. No pixel visibility was established at these distances, so this should not block the first actual depth comparison.
