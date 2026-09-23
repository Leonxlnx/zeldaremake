# Stable shadow projection

The world previously rounded the shadow-window target to whole world metres. With a diagonal sun, moving that target changes the fractional texel phase on stationary surfaces. This pass reuses Astra's existing `shadowframe.ts` helper and real Three.js projection test from the earlier environment branch, aligning the target in the light camera's plane instead.

The snapper is rebuilt when Fable's automatic governor changes shadow resolution. Existing filter dynamics, culling, terrain sampling and quality switches remain connected. No geometry, textures or render passes are added; the reviewed blue-sky daylight settings are unchanged.

Validation:

- Build/typecheck pass. The existing projection test now covers 1024, 2048 and 4096 maps: 11,520 projected coordinates under camera/terrain motion. Worst fractional-phase drift is 2.96e-12 texel, versus 0.499 texel with the old world-metre rounding. This checks actual Three.js shadow matrices; it does not establish perfect GPU shadow appearance.
- Seven native views complete without page errors. Matched views retain the daylight composition; per-view SSIM changes range from −.0003 to +.0006. The saved manifest identifies source diff and cameras.
- A 360-frame native automatic-quality trace completes through all six tiers, including 4096 → 2048 → 1024 shadow-map changes. The final governor median is 35.3 ms at its lowest tier under the current shared laptop load. This is compatibility evidence, not a performance improvement claim or recommendation to lower default quality. The trace logs one resource 404 without its URL; it is not labelled console-clean.
- Earlier cloud-colour and wider-wisp experiments were visually too subtle in the available canopy opening and were reverted. Their local captures remain separate studies.

Run `node src/world/lighting/shadowframe.test.mjs` to repeat the projection check. The default quality remains high. Moving foliage, contact bias and canopy shadow quality still need visual refinement.
