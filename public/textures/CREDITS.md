# Texture credits

Every file under public/textures/** must be listed here with its licence (GAUNTLET.md §4.C4). Each set folder also carries its own LICENSE.txt with the source URL. All sets are Poly Haven CC0 1.0 (public domain), resampled to 1K JPEG for browser delivery (plus a 2K tier of the same maps under `<set>/2k/`, second table below); procedural canvas textures (white bark, leaf clusters, straw, runes, lantern gradients) are original to this project.

| set | files | source | licence |
| --- | --- | --- | --- |
| `aerial_grass_rock` | color.jpg, normal.jpg | https://polyhaven.com/a/aerial_grass_rock | CC0 1.0 |
| `bark_brown_02` | color.jpg, normal.jpg, roughness.jpg | https://polyhaven.com/a/bark_brown_02 | CC0 1.0 |
| `bark_willow_02` | color.jpg, normal.jpg, roughness.jpg | https://polyhaven.com/a/bark_willow_02 | CC0 1.0 |
| `brown_mud_leaves_01` | color.jpg, normal.jpg | https://polyhaven.com/a/brown_mud_leaves_01 | CC0 1.0 |
| `forest_ground_04` | color.jpg, normal.jpg | https://polyhaven.com/a/forest_ground_04 | CC0 1.0 |
| `leafy_grass` | color.jpg, normal.jpg | https://polyhaven.com/a/leafy_grass | CC0 1.0 |
| `rock_boulder_cracked` | color.jpg, normal.jpg, roughness.jpg | https://polyhaven.com/a/rock_boulder_cracked | CC0 1.0 |
| `rock_face_03` | color.jpg, normal.jpg | https://polyhaven.com/a/rock_face_03 | CC0 1.0 |
| `rocky_trail` | color.jpg, normal.jpg | https://polyhaven.com/a/rocky_trail | CC0 1.0 |
| `thatch_roof_angled` | color.jpg, normal.jpg, roughness.jpg | https://polyhaven.com/a/thatch_roof_angled | CC0 1.0 |
| `tree_bark_03` | color.jpg, normal.jpg, roughness.jpg | https://polyhaven.com/a/tree_bark_03 | CC0 1.0 |
| `weathered_planks` | color.jpg, normal.jpg, roughness.jpg | https://polyhaven.com/a/weathered_planks | CC0 1.0 |
| `worn_rock_natural_01` | ao.jpg, color.jpg, normal.jpg, roughness.jpg | https://polyhaven.com/a/worn_rock_natural_01 | CC0 1.0 |

## 2K tier (`<set>/2k/<kind>.jpg`)

The same Poly Haven assets and the same maps as the 1K tier (Diffuse → color, nor_gl → normal, Rough → roughness, AO → ao), downloaded as the 2048×2048 JPEG the Poly Haven API lists for each asset (`https://api.polyhaven.com/files/<set>`), md5-verified against that listing (`source md5`) and re-encoded with sharp/mozjpeg at quality 86 (normal maps 4:4:4 chroma, everything else 4:2:0; `shipped md5`). Loaded by `src/world/materials/textures.ts` from the `high` quality tier up for hero sets and for every set on `ultra`. Licence: CC0 1.0 (https://polyhaven.com/license) for every file.

| set | file | Poly Haven map | size | source md5 | shipped md5 | source URL |
| --- | --- | --- | --- | --- | --- | --- |
| `aerial_grass_rock` | `2k/color.jpg` | Diffuse | 935 KB | `024018554c0002620127749d1f585f3d` | `8134e6906859bb9057bb2e80f7010ddc` | https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/aerial_grass_rock/aerial_grass_rock_diff_2k.jpg |
| `aerial_grass_rock` | `2k/normal.jpg` | nor_gl | 2110 KB | `0c5423ce365169df7c242933b5137696` | `8a984f0118d7d763218f0c06683971b5` | https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/aerial_grass_rock/aerial_grass_rock_nor_gl_2k.jpg |
| `bark_brown_02` | `2k/color.jpg` | Diffuse | 990 KB | `11a2a6039bb5b93f12dcf1689838545b` | `9f5b707c4fbf3f4e454e8d85003694c9` | https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/bark_brown_02/bark_brown_02_diff_2k.jpg |
| `bark_brown_02` | `2k/normal.jpg` | nor_gl | 2157 KB | `39db6c4574fb58de1ad164442e9d6287` | `98e91c55d9238bf53de59a9bd1932d77` | https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/bark_brown_02/bark_brown_02_nor_gl_2k.jpg |
| `bark_brown_02` | `2k/roughness.jpg` | Rough | 417 KB | `1c17004a7262d26d3867198a8fd0e8c1` | `0ed583c7ba57a2f4f17655e7e551e3e3` | https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/bark_brown_02/bark_brown_02_rough_2k.jpg |
| `bark_willow_02` | `2k/color.jpg` | Diffuse | 1039 KB | `c6bc363160c1e91d7af4b579dd0345f4` | `3806237431d83f242627a114259e3274` | https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/bark_willow_02/bark_willow_02_diff_2k.jpg |
| `bark_willow_02` | `2k/normal.jpg` | nor_gl | 2199 KB | `1a1a98d8cf2654326a3f8f45e7508f53` | `e8e4a074398d4df57e06682c9a31c0ad` | https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/bark_willow_02/bark_willow_02_nor_gl_2k.jpg |
| `bark_willow_02` | `2k/roughness.jpg` | Rough | 360 KB | `87beaa7588d0120638b7f3726f968f72` | `faecc0a984fafe542188d82d5f148393` | https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/bark_willow_02/bark_willow_02_rough_2k.jpg |
| `brown_mud_leaves_01` | `2k/color.jpg` | Diffuse | 1263 KB | `e8b45aee8e00a253eb3a2b08cea89776` | `fe3b63f4f868a57206dcfdfa2e88f24c` | https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/brown_mud_leaves_01/brown_mud_leaves_01_diff_2k.jpg |
| `brown_mud_leaves_01` | `2k/normal.jpg` | nor_gl | 2488 KB | `eb2c704d2889e1e5a53148dc6a2ebdf4` | `fffde9999ef30577e1c43182ea545e1d` | https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/brown_mud_leaves_01/brown_mud_leaves_01_nor_gl_2k.jpg |
| `forest_ground_04` | `2k/color.jpg` | Diffuse | 1239 KB | `f6ce9c8af4316c2627a4b3fbab8ad944` | `95e0b165deee5c64f8f51aaf6f0aa061` | https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/forest_ground_04/forest_ground_04_diff_2k.jpg |
| `forest_ground_04` | `2k/normal.jpg` | nor_gl | 2215 KB | `5fa9256955e7bfa40a0269b4965ce646` | `c73152e623980c96f10e0a901600f5fc` | https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/forest_ground_04/forest_ground_04_nor_gl_2k.jpg |
| `leafy_grass` | `2k/color.jpg` | Diffuse | 1291 KB | `8014f4dace676a62ed71b3dd76119dae` | `e5604299d64e293bb0c348a59fe7aa55` | https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/leafy_grass/leafy_grass_diff_2k.jpg |
| `leafy_grass` | `2k/normal.jpg` | nor_gl | 2635 KB | `ea5e91abe01dc5e5d7028c68c3bc9194` | `78be12d6cff82a3c674efd52b388eb82` | https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/leafy_grass/leafy_grass_nor_gl_2k.jpg |
| `rock_boulder_cracked` | `2k/color.jpg` | Diffuse | 939 KB | `91b7d0b3d18b1d7b7705cd493149c969` | `1b03c946e9c66dbcc72c57d22d2f23d0` | https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/rock_boulder_cracked/rock_boulder_cracked_diff_2k.jpg |
| `rock_boulder_cracked` | `2k/normal.jpg` | nor_gl | 1476 KB | `978143a19ebc1a6acea5c4c52e954b9b` | `7abc5973a8e66259023989cbf1b6f544` | https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/rock_boulder_cracked/rock_boulder_cracked_nor_gl_2k.jpg |
| `rock_boulder_cracked` | `2k/roughness.jpg` | Rough | 175 KB | `750c41770beb04180ee936a45c15aecf` | `0fe60413cd5c2965934763fdca7a9549` | https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/rock_boulder_cracked/rock_boulder_cracked_rough_2k.jpg |
| `rock_face_03` | `2k/color.jpg` | Diffuse | 862 KB | `657add9e8a8dffaeed19bdfc58078b59` | `b58e136cefe4b75a44f48f057ac0ad07` | https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/rock_face_03/rock_face_03_diff_2k.jpg |
| `rock_face_03` | `2k/normal.jpg` | nor_gl | 1703 KB | `279b33e71ae6275cafa24e6597024c98` | `27d158c44e7b7075d18e494c558c39b0` | https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/rock_face_03/rock_face_03_nor_gl_2k.jpg |
| `rocky_trail` | `2k/color.jpg` | Diffuse | 1094 KB | `7327bf7d48d33688fb12465222ee3f22` | `a5db42c1ad8a4a0d8884d40a9a8dc852` | https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/rocky_trail/rocky_trail_diff_2k.jpg |
| `rocky_trail` | `2k/normal.jpg` | nor_gl | 2336 KB | `4642b3c833d526b23c96baa84f5bf429` | `be92b8462a2830b036a2dc56880716d2` | https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/rocky_trail/rocky_trail_nor_gl_2k.jpg |
| `thatch_roof_angled` | `2k/color.jpg` | Diffuse | 795 KB | `d043c7e632bb9560138ccb13a036a02f` | `cc9912f78e237b1d6687fef6b5be0a60` | https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/thatch_roof_angled/thatch_roof_angled_diff_2k.jpg |
| `thatch_roof_angled` | `2k/normal.jpg` | nor_gl | 2117 KB | `cda9c9e08f034d725194a7bf49f791be` | `f6bb3feaecf2759805afa1d336c739d4` | https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/thatch_roof_angled/thatch_roof_angled_nor_gl_2k.jpg |
| `thatch_roof_angled` | `2k/roughness.jpg` | Rough | 505 KB | `2bf726b3de6d13efbf9002a7186dbd3c` | `9aa18b4c26511a23fe638ba5c2e499bd` | https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/thatch_roof_angled/thatch_roof_angled_rough_2k.jpg |
| `tree_bark_03` | `2k/color.jpg` | Diffuse | 1017 KB | `5ca9ee65b42be92e1c7800385721ff56` | `fb02878391b89888a16278b51b0d7fc7` | https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/tree_bark_03/tree_bark_03_diff_2k.jpg |
| `tree_bark_03` | `2k/normal.jpg` | nor_gl | 1874 KB | `56bd268c14a3293bddb26bca85f03e89` | `8f59e3e636f5595ad5ab21ff2b45d5d4` | https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/tree_bark_03/tree_bark_03_nor_gl_2k.jpg |
| `tree_bark_03` | `2k/roughness.jpg` | Rough | 290 KB | `8cb3f67a7384350de35c0bc043432027` | `8cf7377d6841a9857f79dad3421eb302` | https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/tree_bark_03/tree_bark_03_rough_2k.jpg |
| `weathered_planks` | `2k/color.jpg` | Diffuse | 425 KB | `dd5f91445812117d216ed962c2607b7d` | `352e034f72262a19bdb060d49ed1b015` | https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/weathered_planks/weathered_planks_diff_2k.jpg |
| `weathered_planks` | `2k/normal.jpg` | nor_gl | 815 KB | `db8ad9ad21c8de018e009f9c27c2a63d` | `557ec7f1117bb8b1e13f1c3caf9a8cc7` | https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/weathered_planks/weathered_planks_nor_gl_2k.jpg |
| `weathered_planks` | `2k/roughness.jpg` | Rough | 71 KB | `8aa6ccbfa605d3d91fae804a7a441db5` | `7013248d1ad405396ba341d2aa17bd3a` | https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/weathered_planks/weathered_planks_rough_2k.jpg |
| `worn_rock_natural_01` | `2k/ao.jpg` | AO | 236 KB | `49a5d995d0648fb1fb493b007798f60b` | `97b11af50a87a7660f3869e68e3cf1c9` | https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/worn_rock_natural_01/worn_rock_natural_01_ao_2k.jpg |
| `worn_rock_natural_01` | `2k/color.jpg` | Diffuse | 726 KB | `7fd6546ffdb78eb3d1a541f6c25a0fcf` | `0c1a1d0bcaf1879c0429c36242ec7e2e` | https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/worn_rock_natural_01/worn_rock_natural_01_diff_2k.jpg |
| `worn_rock_natural_01` | `2k/normal.jpg` | nor_gl | 1105 KB | `ab1fb690207d20d0443199c6b49f05c1` | `5d81be2b8955676a7f25d4d234709edc` | https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/worn_rock_natural_01/worn_rock_natural_01_nor_gl_2k.jpg |
| `worn_rock_natural_01` | `2k/roughness.jpg` | Rough | 404 KB | `02d285642f9291b1a9584f82ba934b90` | `268b9fc9c4287d6462a87423db1c8fd1` | https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/worn_rock_natural_01/worn_rock_natural_01_rough_2k.jpg |
