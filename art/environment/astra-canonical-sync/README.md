# Selected canonical source integration

Source-only commit **ee00f2ff38d9ee536e913741e2d344f773b1a04d** applies the six chosen slices from canonical **7a7a3502** to root **83ebbc63**. It also applies cleanly to root **be0e22f7**; that check used a temporary Git index and changed no root files. [Source patch](source-only.patch) and [exact blob parity](source-parity.json) are included.

| Slice | Files under `src/` | Accepted origin |
| --- | --- | --- |
| Tree memory | `world/trees/index.ts` | 79699a4f, 58c39fc4 |
| Rock dressing and memory | `world/rocks/index.ts` | 0d86abbb, 20b72fdf, 59c68f32, a1ed0427 |
| Prop upload release | `world/props/index.ts`, `geometry.test.mjs`, `README.md` | a7739410 |
| Grass blades to 26 m | `world/vegetation/grass.ts`, `plants.test.mjs` | f9c58007 |
| Final north-stand roof | `world/canopy/index.ts`, `roof.ts`, `roof.test.mjs` | final PR31 source through ffff47b5 |
| Softer ambience and surface footsteps | `audio/ambience.ts`, `footsteps.ts`, `index.ts` | c2c38485, 38823a67 |

Twelve files match canonical exactly. The tree index equals root83 plus **only** the two accepted memory commits: independently applying those forward patches to a temporary index produces blob `bc861d31` matching the candidate prepared from canonical minus the two visual reductions. Root's additional `world/rocks/tiers.test.mjs` remains byte-identical. Character/models, bank geometry, warmth, atlas, fog, structures, terrain, hardscape and capture API are unchanged.

Root deliberately holds **c938a862** (white-bark mid shadows off) and **60408959** (north-stand poles switch to far geometry at 50 m). The local preview retains mid shadows and the existing 120 m threshold. The owner's distance-clarity request and lighter haze postdate those reductions' original visual proof. This choice supersedes the earlier [inventory's](https://github.com/Leonxlnx/zeldaremake/blob/1073fa46/art/environment/astra-canonical-inventory/README.md) recommendation to include both. Both active tree lanes were told to preserve this choice when merging their later index changes.

## Validation

All checks passed against this exact source on the pinned83 model:

```sh
node --test --test-concurrency=1 src/world/trees/lodPool.test.mjs src/world/rocks/tiers.test.mjs
node src/world/canopy/roof.test.mjs
node src/world/props/geometry.test.mjs
node src/world/vegetation/plants.test.mjs
npm run typecheck
npm run build
```

The pool and retained B3 tests pass **13/13**. Roof: 644 total clumps, 2,825 cards, 5,650 triangles, seven sectors; original-plaza invariants pass. Props: 62,644 triangles, 11,030 checked contacts, upload callbacks/bounds pass. Plants: 278,734 vertices and 28,325 bases checked. [Test receipt](tests.json) and the corresponding logs preserve the actual output. [Build receipt](build.json) invokes the same local TypeScript and Vite entry points as the npm scripts, including both required type checks; output is **index-DDYITxda.js**. Whitespace checks pass.

No GPU capture or new audio listening test was performed for this integration. Existing accepted evidence is linked in the inventory. The final roof was originally reviewed under older haze, and its PR CI was cancelled at merge. Grass adds submitted geometry; retaining shadows and the 120 m threshold also retains their cost. Earlier separate measurements cannot establish this combined scene's current W38 headroom. Root will validate the actual integrated preview with its current character asset.

[Fable coordination](https://github.com/Leonxlnx/zeldaremake/pull/2#issuecomment-5781491230) also hands off root's reviewed be0 / 7f character, while keeping that asset out of this source patch. The stored API text matches the submitted UTF-8 body after trimming outer whitespace, with no replacement characters. No PR, merge, ledger edit or modification to another agent's log was made.
