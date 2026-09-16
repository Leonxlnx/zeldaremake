# Owner video review — 16 September 2026

Comparison reference only. Never load these frames or video into the game.

The owner explicitly authorized sharing the recording with Fable. `reference-review.mp4` is the complete 46.525-second recording transcoded to 720p H.264 (CRF24), with audio omitted. Original source: Bildschirmaufnahme 2026-09-16 161432.mp4; SHA256 300d6490e26a877f4dc65fe6d003e7ad5cca6131b31897d360c423b8ca3054be. This does not transfer rights in the depicted third-party game/art. No runtime assets were extracted.

Frames are sampled every eight seconds using ffmpeg fps=1/8 (approximately 4,12,20,28,36,44s). They show a riverside path, character close-up, shaded forest lane, town, and desert. Lighting should follow the forest scenes, not blindly copy the bright desert exposure.

## Lighting — Astra

1. Sunlit stones and leaves stand apart from deep, readable cool shade. Our screenshot has broadly lifted grey-green wood and canopy. Test reduced hemisphere/IBL fill before changing albedo or adding post contrast.
2. Reference foreground retains bark, moss and leaf relief; haze mainly separates distant layers. Keep near air clear and preserve distant blue-grey depth.
3. Warm lamps are small accents beneath dark boughs. Do not increase whole-screen bloom or use blur to hide coarse geometry.

## Geometry — Fable

`owner-markup.png` marks the smooth left bole, straight horizontal lantern limb, smooth diagonal trunk above the house, coarse roof moss and right foreground grass.

- Compare at player height, the main-stair landing and looking upward. Break continuous trunk/branch silhouettes with taper, forks and real rooted bark detail.
- Give the lantern limb connected twigs and overlapping cupped leaves; the current isolated leaf stems expose a beam-like limb.
- Roof moss needs distinct close-scale tufts and an irregular edge over the bark, not another broad smooth green layer.
- Grass needs thinner blades, rooted clusters, varied heights and fern/leaf-litter transitions at the verge. Keep the paths clear.
- Preserve the existing layout, deterministic wind, terrain contact and performance budgets.

Verdant Forest source inspected at the current shallow clone in E:/tmp/verdant-light-reference. `app/forest/trees.js` has species-specific taper and individually cupped/twisted 8/4/2-triangle leaf laminae. `materials.ts` has leaf vein micro-normal detail fading from 2.5 to 6m, species-specific bark normals and directional leaf transmission. Reuse those established details where absent; do not vendor its app. Our much stronger shared shade floors are a separate lighting/readability issue.

## Link — after lighting

The close-up shows almond eyes with lids, separated hair clumps, fine cloth weave and seams, shaped wrist guards and boot folds. Use it to review the existing Blender model and rig; no generated model claim or finished-character claim is made here.
