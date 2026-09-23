# Kokiri Forest remake — 50-item rubric

> Generated from `gauntlet/rubric.json` (sha256 `96467cfa0ee47774…`). Do not edit by hand — see GAUNTLET.md §4.A.

Reference: https://x.com/DiscussingFilm/status/2097327973351272627

| Phase | Items | Required for phase exit |
| --- | --- | --- |
| 1 World | W01–W42 | all 42 |
| 2 Character | C01–C05 | all 5 |
| 3 UI | U01–U03 | all 3 |

## Composition, terrain, ground

### W01 — Shot A composition matches the reference  `both` · weight 2

Reference frame: `reference/frames/A_stairs.jpg` (t ≈ 1 s)

Long stairway climbs to the upper-right toward a fenced ledge; flagstone plaza fills the lower third; a lantern-hung branch reaches over the path on the left; trees + mist + light shafts fill the upper-left.

Automated checks:
- layout `stairs.main` projects into region {"xMin":0.45,"xMax":1,"yMin":0.1,"yMax":0.95} of A_stairs (≥ 80 %)
- layout `lanternBranch` projects into region {"xMin":0,"xMax":0.45,"yMin":0.1,"yMax":0.75} of A_stairs (≥ 60 %)

Visual criterion (cross-reviewed): Side by side with reference/frames/A_stairs.jpg the stairs, ledge, branch and plaza occupy the same screen regions and the eye reads the same composition.

### W02 — Hero stairway: 18 worn stone steps  `both` · weight 3

Reference frame: `reference/frames/A_stairs.jpg` (t ≈ 1 s)

16–20 irregular stone steps ~2.7 m wide, each tread a distinct slab with chipped/worn edges, dark risers, moss and grass in the joints, grassy embankments on both flanks, no repeated identical slabs.

Automated checks:
- audit `systems.hardscape.stairways[id=main].steps` between [16,20]
- audit `systems.hardscape.stairGeometry` != "placeholder-boxes"
- audit `systems.hardscape.uniqueStepShapes` >= 12
- audit `systems.hardscape.mossJoints` truthy

Visual criterion (cross-reviewed): Steps read as individually cut, weathered stone with soft mossy edges like the reference, not extruded boxes.

### W03 — Flagstone paths are real stones  `both` · weight 3

Reference frame: `reference/frames/B_house.jpg` (t ≈ 14 s)

Paths are built from ≥ 300 individually shaped flat stones (varying size 0.4–1.6 m, bevelled edges, height jitter ≤ 4 cm) with soil/moss/grass joints — not a tiled texture on a plane.

Automated checks:
- audit `systems.hardscape.flagstones` >= 300
- audit `systems.hardscape.flagstoneShapes` >= 24

Visual criterion (cross-reviewed): At viewpoint E the stones have visible thickness, edge bevels and joints with greenery, matching the plaza in the reference.

### W04 — Terraces and plateaus at authored heights  `auto` · weight 1

Reference frame: `reference/frames/A_stairs.jpg` (t ≈ 1 s)

East plateau (top of stairs) ≈ 5.4 m, west ledge ≈ 2.6 m, house terrace ≈ 1.2 m, plaza ≈ 0 m; all within 0.35 m.

Automated checks:
- terrain height at (18, -4) = 5.4 ± 0.45
- terrain height at (-11, 0) = 2.6 ± 0.45
- terrain height at (9, -12.5) = 1.2 ± 0.35
- terrain height at (0, 0) = 0 ± 0.25

### W05 — Terrain is authored at four scales  `both` · weight 2

Reference frame: `reference/frames/C_lookback.jpg` (t ≈ 46 s)

Macro forms (plateaus, valleys), medium (embankments, ledges, erosion channels), small (depressions, stones, roots) and micro (soil roughness) are all present; the detail zone has ≥ 250k terrain vertices; no visible grid or displaced-plane look.

Automated checks:
- audit `systems.terrain.vertices` >= 250000
- audit `systems.terrain.detailPasses` >= 3

Visual criterion (cross-reviewed): Embankments beside the stairs and the ledge edges show natural terracing and erosion, not smooth noise blobs.

### W06 — Layered ground materials  `both` · weight 3

Reference frame: `reference/frames/E_ground.jpg` (t ≈ 24 s)

Terrain material blends ≥ 4 physically based layers (soil, grass, moss, leaf litter, path stone) by slope/mask/noise with detail normal maps and macro colour variation; no obvious tiling at 1280 px.

Automated checks:
- audit `systems.terrain.textured` truthy
- audit `systems.terrain.layers.length` >= 4
- audit `systems.terrain.detailNormal` truthy

Visual criterion (cross-reviewed): Ground at viewpoint E shows soil/moss/grass transitions with fine roughness like the reference plaza edges.

### W07 — Ground litter is geometry  `auto` · weight 2

Reference frame: `reference/frames/E_ground.jpg` (t ≈ 24 s)

≥ 5,000 instanced litter pieces (fallen leaves, twigs, pebbles, small roots) within the detail radius, seated on the terrain.

Automated checks:
- audit `systems.vegetation.litter` >= 5000
- placement `systems.vegetation.samplePositions.litter`: gap ≤ 0.05 m for ≥ 97 %

## Trees

### W08 — White-bark trees: ≥ 8 real variants  `both` · weight 3

Reference frame: `reference/frames/C_lookback.jpg` (t ≈ 46 s)

Verdant Forest white-bark trees ported and improved: ≥ 8 geometry variants with different taper, lean, branching hierarchy and crown shape; bark shows white/grey variation with dark scars.

Automated checks:
- audit `systems.trees.whiteBarkVariants` >= 8
- audit `systems.trees.whiteBarkInstances` >= 60
- audit `systems.trees.geometry` != "placeholder-massing"

Visual criterion (cross-reviewed): Trunks are irregular, tapered, leaning, with hierarchical branches — recognisably the Verdant white trees, better.

### W09 — Giant Kokiri trees with roots and limbs  `both` · weight 3

Reference frame: `reference/frames/B_house.jpg` (t ≈ 14 s)

≥ 6 giant trees (trunk radius ≥ 1.2 m) with flared buttress roots entering the terrain, gnarled bark, at least 2 large near-horizontal limbs each.

Automated checks:
- audit `systems.trees.giants` >= 6
- audit `systems.trees.giantRoots` truthy
- audit `systems.trees.giantLimbsMin` >= 2

Visual criterion (cross-reviewed): Giant trunks read like the massive old trees framing the house in the reference.

### W10 — Canopy roofs the clearing  `both` · weight 2

Reference frame: `reference/frames/F_canopy.jpg` (t ≈ 8 s)

From viewpoint F the canopy covers most of the sky: sky pixels ≤ 45 % of the frame; dappled shafts pass through gaps.

Automated checks:
- pixels[F_canopy].skyFraction <= 0.45

Visual criterion (cross-reviewed): Overhead reads as a dense, layered canopy with light breaking through like the top of the reference frames.

### W11 — Foliage is 3D leaf clusters  `both` · weight 2

Reference frame: `reference/frames/B_house.jpg` (t ≈ 14 s)

Leaves are individually placed curved laminae (or multi-leaf cards with normal-mapped depth), grouped in asymmetric clusters — no smooth spheres/blobs; leaves flutter with wind.

Automated checks:
- audit `systems.trees.leafGeometry` includes "laminae"
- audit `systems.trees.leafCount` >= 200000

Visual criterion (cross-reviewed): Crown edges are broken and leafy against the sky; no ball-shaped canopies.

### W12 — Tree bases contact the ground  `auto` · weight 1

Reference frame: `reference/frames/C_lookback.jpg` (t ≈ 46 s)

Every tree base vertex sits within 3 cm of the terrain (no floating trunks, no buried crowns).

Automated checks:
- audit `systems.trees.maxBaseGap` <= 0.03
- placement `systems.trees.samplePositions.bases`: gap ≤ 0.03 m for ≥ 99 %

### W13 — Distant tree layers  `auto` · weight 1

Reference frame: `reference/frames/D_log.jpg` (t ≈ 56 s)

≥ 400 mid/far trees with ≥ 2 LOD levels form layered silhouettes in the haze beyond the detail radius.

Automated checks:
- audit `systems.trees.distantTrees` >= 400
- audit `systems.trees.lodLevels` >= 2

### W14 — Lantern branch over the path  `both` · weight 2

Reference frame: `reference/frames/A_stairs.jpg` (t ≈ 1 s)

A large near-horizontal limb from the west-ledge giant crosses above the path on the left of shot A, carrying 3 glowing pod lanterns on cords, with leaf clusters.

Automated checks:
- audit `systems.structures.lanternBranch` truthy
- audit `systems.structures.branchLanterns` >= 3

Visual criterion (cross-reviewed): Matches the branch + lanterns at the left of the reference stairs shot.

## Vegetation & wind

### W15 — Grass density  `both` · weight 3

Reference frame: `reference/frames/A_stairs.jpg` (t ≈ 1 s)

≥ 400,000 GPU-instanced grass blades/clumps within the detail radius, ≥ 3 grass types (short, tall, weeds), zero on flagstones and stairs.

Automated checks:
- audit `systems.vegetation.grassInstances` >= 400000
- audit `systems.vegetation.grassTypes` >= 3
- placement `systems.vegetation.samplePositions.grass`:  mask {"path":0.5,"stairs":0.5} for ≥ 99 %

Visual criterion (cross-reviewed): Embankments and verges are thick with grass like the reference; bare ground is rare except on paths.

### W16 — Grass variation  `auto` · weight 1

Reference frame: `reference/frames/A_stairs.jpg` (t ≈ 1 s)

Per-instance variation in height (CV ≥ 0.2), width, yaw, colour (≥ 3 tints) and clustering (density noise), not a uniform carpet.

Automated checks:
- audit `systems.vegetation.grassHeightCV` >= 0.2
- audit `systems.vegetation.grassTints` >= 3
- audit `systems.vegetation.grassClustered` truthy

### W17 — Ferns  `auto` · weight 1

Reference frame: `reference/frames/A_stairs.jpg` (t ≈ 1 s)

≥ 300 ferns with pinnate frond geometry on embankments and around tree bases.

Automated checks:
- audit `systems.vegetation.ferns` >= 300

### W18 — Purple flowers and weeds  `both` · weight 1

Reference frame: `reference/frames/D_log.jpg` (t ≈ 56 s)

≥ 150 purple flower clusters (as in the left foreground of shots A and D) plus yellow-green weeds; purple pixels ≥ 0.3 % of shot D.

Automated checks:
- audit `systems.vegetation.flowers` >= 150
- pixels[D_log].purpleFraction >= 0.003

Visual criterion (cross-reviewed): Purple blooms sit in the left foreground of shot D similar to the reference.

### W19 — Bushes and shrubs  `auto` · weight 1

Reference frame: `reference/frames/C_lookback.jpg` (t ≈ 46 s)

≥ 80 bushes with 3D leaf geometry along embankments, ledges and house bases.

Automated checks:
- audit `systems.vegetation.bushes` >= 80

### W20 — Moss everywhere it should be  `both` · weight 2

Reference frame: `reference/frames/B_house.jpg` (t ≈ 14 s)

Moss on boulders, stair edges, roots, the house roof and the log arch, as surface-bound geometry or blended material.

Automated checks:
- audit `systems.rocks.mossCoverage` truthy
- audit `systems.hardscape.mossJoints` truthy
- audit `systems.structures.mossRoof` truthy

Visual criterion (cross-reviewed): Mossy greens soften every hard edge as in the reference house roof and boulders.

### W21 — Sprouts in stone joints  `auto` · weight 1

Reference frame: `reference/frames/E_ground.jpg` (t ≈ 24 s)

≥ 500 grass/weed sprouts growing from flagstone and stair joints.

Automated checks:
- audit `systems.hardscape.jointSprouts` >= 500

### W22 — Layered wind  `both` · weight 2

Reference frame: `reference/frames/A_stairs.jpg` (t ≈ 1 s)

≥ 4 distinct wind responses (grass fast, small plants light, leaves flutter, branches slow); motion between t and t+0.5 s is present but spatially varied (motion variance across 16 regions > 0).

Automated checks:
- audit `systems.vegetation.windLayers` >= 3
- audit `systems.trees.windLayers` >= 2
- compare[A_stairs].motionRegionsMoving >= 6

Visual criterion (cross-reviewed): Grass ripples independently of the canopy sway; no lock-step motion.

## Rocks

### W23 — Hero mossy boulders  `both` · weight 2

Reference frame: `reference/frames/D_log.jpg` (t ≈ 56 s)

≥ 3 hero boulders at the layout positions with fractured, faceted silhouettes (ridged displacement, cracks), moss on top faces, seated with contact darkening.

Automated checks:
- audit `systems.rocks.heroBoulders` >= 3
- audit `systems.rocks.geometry` != "placeholder"
- audit `systems.rocks.mossCoverage` truthy

Visual criterion (cross-reviewed): Boulder at the left of shot D reads as layered, mossy rock like the reference, not a smooth blob.

### W24 — Scree and pebbles  `auto` · weight 1

Reference frame: `reference/frames/E_ground.jpg` (t ≈ 24 s)

≥ 2,000 instanced small stones/pebbles near path edges, stair feet and boulder bases.

Automated checks:
- audit `systems.rocks.pebbles` >= 2000

## Structures

### W25 — Kokiri tree-trunk houses  `both` · weight 3

Reference frame: `reference/frames/B_house.jpg` (t ≈ 14 s)

≥ 2 houses: hollow trunk walls with bark ridges, dark arched doorway with warm interior light, mossy thatched dome roof grown over by living branches and heart-leaf vines.

Automated checks:
- audit `systems.structures.houses` >= 2
- audit `systems.structures.geometry` != "placeholder-massing"
- audit `systems.structures.mossRoof` truthy
- audit `systems.structures.doorLight` truthy

Visual criterion (cross-reviewed): The house on the right of shot B matches the reference: proportions, dome roof, glowing doorway.

### W26 — Glowing pod lanterns  `both` · weight 2

Reference frame: `reference/frames/B_house.jpg` (t ≈ 14 s)

≥ 6 yellow-orange pod lanterns (Deku-nut shaped, emissive + point light, hanging on cords) across the houses, branch and log arch; glow restrained (no blown-out bloom).

Automated checks:
- audit `systems.structures.lanterns` >= 6
- pixels[B_house].overexposedFraction <= 0.01

Visual criterion (cross-reviewed): Lanterns read as warm glowing pods like the reference, with soft local light on the bark.

### W27 — Wooden signpost  `auto` · weight 1

Reference frame: `reference/frames/B_house.jpg` (t ≈ 14 s)

A wooden signpost (post + carved plank with rune-like marks) in front of the house terrace.

Automated checks:
- audit `systems.structures.signposts` >= 1

### W28 — Fences on the upper ledge  `auto` · weight 1

Reference frame: `reference/frames/A_stairs.jpg` (t ≈ 1 s)

≥ 2 post-and-rail wooden fence runs along the plateau edge at the top of the stairs.

Automated checks:
- audit `systems.structures.fences` >= 2

### W29 — Giant hollow log arch  `both` · weight 2

Reference frame: `reference/frames/D_log.jpg` (t ≈ 56 s)

A huge fallen hollow log (radius ≈ 3.4 m) lying across the northern path in the mist with bark ridges, moss, and 2 lanterns — the far landmark of shot D.

Automated checks:
- audit `systems.structures.logArch` truthy
- audit `systems.structures.geometry` != "placeholder-massing"

Visual criterion (cross-reviewed): Shot D shows the log arch silhouette in haze like the reference.

## Lighting, atmosphere, image match

### W30 — Sun matches the reference  `both` · weight 2

Reference frame: `reference/frames/A_stairs.jpg` (t ≈ 1 s)

Sun from behind-left of shot A at ~30–40° elevation: shadows on the plaza fall toward camera-right/front; azimuth within ±25° and elevation within ±10° of the reference estimate.

Automated checks:
- audit `systems.lighting.sunAzimuthDeg` between [-155,-105]
- audit `systems.lighting.sunElevationDeg` between [24,44]
- audit `systems.lighting.shadows` truthy

Visual criterion (cross-reviewed): Shadow direction and softness on the plaza match the reference.

### W31 — God rays through the canopy  `both` · weight 2

Reference frame: `reference/frames/A_stairs.jpg` (t ≈ 1 s)

Volumetric light shafts (screen-space or geometric) enter from the upper-left in shots A, B and F, occluded by the canopy.

Automated checks:
- audit `systems.atmosphere.godRays` truthy

Visual criterion (cross-reviewed): Shafts are visible, soft, and directional as in the reference; they do not wash the whole frame.

### W32 — Layered atmospheric perspective  `both` · weight 2

Reference frame: `reference/frames/D_log.jpg` (t ≈ 56 s)

Cool blue-grey haze increases with depth; low ground mist in the north hollow; distant trees still silhouette through it; fog far ≥ 150 m and the horizon is not a flat fog wall.

Automated checks:
- audit `systems.atmosphere.fogFar` >= 150
- audit `systems.atmosphere.groundMist` truthy
- depth[D_log].farLayerCount >= 3

Visual criterion (cross-reviewed): Shot D depth reads in 3+ planes (foreground stones, mid boulders/trees, far log in mist) like the reference.

### W33 — Falling leaves, motes and the fairy  `auto` · weight 1

Reference frame: `reference/frames/D_log.jpg` (t ≈ 56 s)

≥ 60 falling leaf particles and ≥ 100 drifting motes/fireflies in the detail zone, plus a glowing fairy orb with wings hovering near the player spawn.

Automated checks:
- audit `systems.atmosphere.fallingLeaves` >= 60
- audit `systems.atmosphere.fireflies` >= 100
- audit `systems.atmosphere.fairy` truthy

### W34 — Palette matches the reference  `auto` · weight 2

Reference frame: `reference/frames/B_house.jpg` (t ≈ 14 s)

For each hero viewpoint: mean hue within 14°, mean saturation within ±0.10 and mean luminance within ±0.12 of its reference frame (computed on 64×36 downscales, sky masked).

Automated checks:
- compare[*hero].hueDiffDeg <= 14
- compare[*hero].satDiff <= 0.1
- compare[*hero].lumDiff <= 0.12

### W35 — Rendering clarity  `auto` · weight 2

Reference frame: `reference/frames/A_stairs.jpg` (t ≈ 1 s)

Image sharpness (Laplacian variance) of each hero capture ≥ 0.8× its reference frame; over-exposed pixels ≤ 1 %; no full-frame blur or bloom.

Automated checks:
- compare[*hero].sharpnessRatio >= 0.8
- pixels[*hero].overexposedFraction <= 0.01

### W36 — Contact: nothing floats  `both` · weight 2

Reference frame: `reference/frames/E_ground.jpg` (t ≈ 24 s)

Ambient occlusion / contact darkening under rocks, roots, stairs and house bases; all sampled placements within 3 cm of the terrain.

Automated checks:
- audit `systems.atmosphere.ambientOcclusion` truthy
- placement `systems.rocks.samplePositions.boulders`: gap ≤ 0.03 m for ≥ 100 %
- placement `systems.structures.samplePositions.bases`: gap ≤ 0.03 m for ≥ 100 %

Visual criterion (cross-reviewed): Every asset in viewpoint E looks physically seated with a soft contact shadow.

### W37 — Shot similarity to the reference  `auto` · weight 3

Reference frame: `reference/frames/A_stairs.jpg` (t ≈ 1 s)

Structural similarity (SSIM on 256×144 luminance) between each hero viewpoint and its reference frame ≥ 0.42, and pHash Hamming distance ≤ 26.

Automated checks:
- compare[*hero].ssim >= 0.42
- compare[*hero].phashDistance <= 26

## Performance & engineering

### W38 — Real-time budget  `auto` · weight 2

Reference frame: `reference/frames/A_stairs.jpg` (t ≈ 1 s)

≤ 700 draw calls and ≤ 9 M triangles per hero viewpoint at quality=high; PROJECT_STATE documents ≥ 30 fps at 1080p on a mid-range GPU.

Automated checks:
- stats[*hero].drawCalls <= 700
- stats[*hero].triangles <= 9000000

### W39 — GPU instancing  `auto` · weight 1

Reference frame: `reference/frames/A_stairs.jpg` (t ≈ 1 s)

Vegetation, litter, pebbles and distant trees use InstancedMesh (≥ 20 instanced meshes in the scene).

Automated checks:
- audit `scene.instancedMeshes` >= 20

### W40 — LOD and culling  `auto` · weight 1

Reference frame: `reference/frames/D_log.jpg` (t ≈ 56 s)

Trees and grass have ≥ 2 LOD levels; vegetation is chunked with distance culling.

Automated checks:
- audit `systems.trees.lodLevels` >= 2
- audit `systems.vegetation.lodLevels` >= 2
- audit `systems.vegetation.chunked` truthy

### W41 — Deterministic captures  `auto` · weight 1

Reference frame: `reference/frames/A_stairs.jpg` (t ≈ 1 s)

Two captures of the same build at the same viewpoint differ in < 0.5 % of pixels.

Automated checks:
- compare[A_stairs].determinismDiff <= 0.005

### W42 — Dev camera, viewpoints, clean console  `auto` · weight 1

Reference frame: `reference/frames/A_stairs.jpg` (t ≈ 1 s)

Free dev camera with ≥ 6 saved viewpoints; zero console errors or page errors during capture.

Automated checks:
- audit `layout.viewpoints.length` >= 6
- console errors ≤ 0

## Character (Phase 2)

### C01 — Young Link  `both` · weight 3

Reference frame: `reference/frames/B_house.jpg` (t ≈ 14 s)

Original child-proportioned model (~1.25 m): green tunic, long green cap, blond hair, pointed ears, brown boots, belt, white undershirt.

Automated checks:
- audit `systems.character.link` truthy

Visual criterion (cross-reviewed): Silhouette and colours match the reference Link without using any Nintendo asset.

### C02 — Deku Shield and Kokiri Sword  `visual` · weight 2

Reference frame: `reference/frames/A_stairs.jpg` (t ≈ 34 s)

Wooden Deku Shield with red swirl on the back; Kokiri Sword in a scabbard; both original models.

Visual criterion (cross-reviewed): Matches the equipment screen renders in the reference.

### C03 — Locomotion  `auto` · weight 2

Reference frame: `reference/frames/A_stairs.jpg` (t ≈ 5 s)

Idle, walk, run and stair-climb animations with foot planting on the heightfield; third-person follow camera at reference height.

Automated checks:
- audit `systems.character.animations` >= 3

### C04 — Navi companion  `auto` · weight 1

Reference frame: `reference/frames/A_stairs.jpg` (t ≈ 1 s)

Glowing fairy with wings orbiting the player with a sparkle trail.

Automated checks:
- audit `systems.character.fairy` truthy

### C05 — Kokiri kids  `auto` · weight 1

Reference frame: `reference/frames/C_lookback.jpg` (t ≈ 46 s)

≥ 2 Kokiri NPCs in dark-green outfits at the layout NPC spots with idle animation.

Automated checks:
- audit `systems.character.npcs` >= 2

## UI (Phase 3)

### U01 — HUD  `visual` · weight 2

Reference frame: `reference/frames/A_stairs.jpg` (t ≈ 1 s)

Three red hearts top-left, item slot top-right (Deku Stick ×4 with ZR label), hand-drawn Kokiri Forest minimap bottom-right.

Visual criterion (cross-reviewed): Positions, sizes and style match the reference HUD.

### U02 — Pause / equipment screen  `visual` · weight 2

Reference frame: `reference/frames/A_stairs.jpg` (t ≈ 34 s)

Tabs Collection / Equipment / Items / System, rupee counter 16/200, hexagonal slot grid, character in an oval vignette, item name + description, Rotate/Set/Back button hints.

Visual criterion (cross-reviewed): Layout and styling match the reference inventory frame.

### U03 — UI art style  `visual` · weight 1

Reference frame: `reference/frames/A_stairs.jpg` (t ≈ 34 s)

Dark wood/parchment frame with ornate corner scrollwork, warm gold accents, crisp text at 1080p.

Visual criterion (cross-reviewed): Reads as the same visual family as the reference menus.

