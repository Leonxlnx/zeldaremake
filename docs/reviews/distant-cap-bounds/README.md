# Distant cap bounds — pinned reproduction

Scope: **only `src/world/structures/index.ts`**. The patch separates the three distant `mats.capMoss` meshes into one static bucket before main consolidation. It uses `Group.attach`, shares the same material, consolidates both groups with the unchanged helper, then adds their audit counts. It does not change distant-house source, shaders, textures, vertices, normals, indices of original parts, transforms, colors, RNG, placement, lights, or generic consolidation behavior.

Pinned baseline: `711758d8bda00458c0ae7339eb9ec55654a1e23b`.

Pinned integrated distant houses: `1e97463582c6479e3624fa9c963b0aff2685fc85`.

Original scratch patch SHA256 (the reproduction uses the exact consolidation block and verifies the resulting full index hash): `79f178f64d0c6eab7e0791ffc4ed1cbbdc76758c272a556da559f120f6236fc7`.

Candidate index SHA256: `75927a8fe415da484d40ff4448624dccdcea4e0924e2e8259e048a84270a2dee`.

## Cause and measured scope

Adding 1,008 cap triangles to the existing 129,596-triangle `merged:roof` expands its computed sphere radius from **7.49698 m to 20.29485 m**. The sphere now contains the C and L02 cameras; the former roof sphere fails their frusta by 4.22215 m and 6.50632 m. That admits the entire old roof bucket. This is genuine consolidation/frustum cost, not additional visible roof pixels.

Using installed Three's real mesh/frustum intersection and the captured cameras plus the real snapped sun-shadow camera reproduces **all ten actual old→new capture draw/triangle deltas exactly**. F's +7,440 is +3,720 color submissions and +3,720 shadow submissions; it is not two shadow passes. The candidate restores the old near roof's merged attribute/index hashes exactly and keeps the far caps in a separate 1,008-triangle bucket.

| Camera | Actual 711→1e calls / triangles | Candidate vs 1e predicted calls / triangles |
| --- | ---: | ---: |
| A_stairs | +1 / +8,937 | +2 / +0 |
| B_house | +1 / +8,937 | +2 / +0 |
| C_lookback | +1 / +137,036 | +0 / -130,604 |
| D_log | +1 / +8,937 | +2 / +0 |
| E_ground | +1 / +8,937 | +2 / +0 |
| F_canopy | +0 / +7,440 | +1 / -1,008 |
| S01-sign-front | +1 / +8,937 | +2 / +0 |
| S02-sign-oblique | +1 / +8,937 | +2 / +0 |
| L01-stair-foot-bindings | +0 / +6,432 | +1 / +0 |
| L02-fork-west-lantern | +1 / +137,036 | +0 / -130,604 |

Candidate totals: 56 meshes (+1), **445,063 unique source triangles unchanged**, 36 unique final materials unchanged, 25 inspected material texture objects unchanged. Raw final geometry buffers are **20,284,806 bytes**, 6,048 bytes less than current1e: the detached small cap index becomes Uint16. New mesh/geometry object overhead is not included; no GPU memory or FPS claim. Maximum recorded draw count would become 663 from 661; the B/E maximum 8,725,061 submitted triangles is unchanged.

## Preservation and lifetime

The fixture hashes every original part's attributes/index, matrix, material name/type, and cast/receive flags before consolidation: identical as an unordered complete set. The near roof's final merged buffers match pre-distant711 byte for byte. The only changed structure audit fields are `meshes` and `mergedMeshes`, each +1. All other audits, unique triangle counts and material programs remain source-identical.

Existing `structures.dispose()` releases every final unique geometry once (55 current, 56 candidate), including the new far-cap bucket once, and every one of 36 final materials once. All 25 inspected texture dispose-event counts remain identical. This preserves existing ownership behavior, **including inherited generated-map leaks such as cap-moss albedo/normal**; this is not a whole-system disposal fix. The proof calls the system's existing disposal once, not a newly promised idempotent contract.

## Reproduction and boundaries

From the repository root, with installed Three, TypeScript and @napi-rs/canvas plus the pinned Git objects:

```sh
node docs/reviews/distant-cap-bounds/check.mjs
```

The script writes fresh evidence to ignored `gauntlet/tmp/distant-cap-bounds-reproduction/`, reads pinned committed source and the frozen consolidation-only overlay, creates real procedural material canvases, and uses inert 1-pixel cached library-map fixtures. `captured-cameras.json` contains exact camera/counter excerpts from the four original reports and their full-byte SHA256 provenance. The original reports remain in the immutable archives linked below. The overlay must produce the frozen candidate index hash. No browser/GPU render or production mutation occurs. The checked-in evidence records the passing source proof. A virtual-overlay TypeScript check and `git apply --check` against a scratch copy of pinned1e also pass; applying the patch to that scratch copy produces the frozen candidate hash exactly.

**Actual candidate GPU capture remains required**, particularly JPEG/depth equivalence, shadow appearance, and observed call counts. Source/buffer/frustum evidence does not award visual quality. Root controls application and capture; Fable's active structure work remains untouched. This index-only boundary is compatible with shaping/material tuning while distant caps keep sharing `mats.capMoss`; rereview if that identity or the distant group architecture changes. Do not overwrite newer source with the full candidate snapshot. The earlier broad split experiment was not selected or applied.


Original reports: [711 world](https://github.com/Leonxlnx/zeldaremake/blob/a94b4e94e9e1d8fc6f3d1c0ce53c9416d86293eb/progress/2026-09-12_175329916-711758d/environment.json),
[711 details](https://github.com/Leonxlnx/zeldaremake/blob/6a6fdbe816f3951d14a98912ed0d6ca26120359d/details/2026-09-12_175613539-711758d/details.json),
[1e world](https://github.com/Leonxlnx/zeldaremake/blob/f2f22acfd99f1873c1491af8ab7d58334cbef565/progress/2026-09-12_180621994-1e97463/environment.json),
[1e details](https://github.com/Leonxlnx/zeldaremake/blob/4ee2f9c5b0b10ed31618136d79e4675f0d783a7e/details/2026-09-12_180910927-1e97463/details.json).
