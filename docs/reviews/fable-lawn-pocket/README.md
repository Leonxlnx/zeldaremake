# Fable lawn-pocket review — pinned source, CPU evidence

Baseline `0f9426c7267d06f13cc96be4591821fce795cb84`; candidate `612872691c51949655102bf9e60361ec33039fb2` (reported by Fable tick 52 / `87d3f31`). Exact file hashes are in `evidence.json`. Reviewed scope is hardscape/index.ts, joints.ts and new flowers.ts. Owner boards 02/05 support small flowers, planted joints and a soft grass edge; this review does not award image quality or reproduce Fable's image scores.

## Established scope exception

**Positions are stable; appearance variations are not.** All 3,899 old instances outside lawnPocket retain exact placement records and variants. However, **3,365 change both their rotation/scale matrix and tint**: 1,263 tufts, 1,686 grit pieces and 416 cushions. The scene remains deterministic across identical builds; this is an unintended before/after source-scope change, not nondeterminism or a measured visual regression.

The new placement loops have independent streams, but final `buildSproutMeshes` consumes one shared RNG in pack/variant order. Capping 58 old pocket sizes at .69 moves them from TUFT_B to TUFT_A; the additional 1,467 spots further change later random consumption. Merely forking new placement or reseeding all existing instances would not preserve the authoritative old transforms.

Least invasive preservation approach: retain the original legacy spot list and original variant order **before** the size clamp, precompute/cache its per-instance random variations in that exact order, and reuse them when constructing the final packs. Generate variations for added instances from an independent fork. The 58 capped legacy instances can retain their existing random tuples while selecting their new local geometry; unaffected instances keep exact matrices/tints. This avoids global reseeding, extra shader attributes or extra draw calls. Do not implement this silently in the shared helper: Fable should coordinate that bounded optional path, leaving other callers unchanged. No RNG correction is included here.

## Flower follow-ups confirmed at 6128726

- Heads squash Y by .72 but keep spherical normals: up to **8.925°** from the inverse-transpose-correct normal. Stems all use `(0,.7,.7)` despite randomized quad direction: **40.61–132.92°** from their geometric normal. Heads project roughly 4.0–8.8 pixels wide in canonical B/E; actual lighting impact remains unmeasured.
- The merged flower owns one geometry and material. hardscape exposes no dispose hook, and world.dispose only invokes optional system disposers. Invoking that path emits zero flower geometry/material disposal events. These add **123,984 bytes of vertex attributes**, without textures, to an existing broader hardscape cleanup omission.
- The temporary Icosahedron is already nonindexed in installed Three, so `.toNonIndexed()` emits a warning. It never reaches the renderer; this temporary's omission is CPU cleanup rather than a demonstrated GPU allocation leak.

Fable released completed geometry in [PR #2 comment 5647232830](https://github.com/Leonxlnx/zeldaremake/pull/2#issuecomment-5647232830). Root announced the narrow flower normal / exactly-once cleanup scope in [5647299378](https://github.com/Leonxlnx/zeldaremake/pull/2#issuecomment-5647299378), then clarified the single index disposal-hook overlap with Fable's newly active RNG pass in [5647304378](https://github.com/Leonxlnx/zeldaremake/pull/2#issuecomment-5647304378). This pinned review describes the uncorrected source; the correction is separate and must preserve positions, colors, RNG, material parameters and shadow policy.

## Preserved behavior and cost

- Both stair meshes and the complete flagstone buffers are byte-exact. Stepping stones, sample positions, mask clipping, fill topology/UV/normals/soil/rim attributes and related audits are unchanged.
- Fill colors change at 355 vertices, all where lawnPocket is nonzero; zero changes outside it.
- New spot origins sit +2 mm over terrain for tufts/clover or +8 mm for moss pads, using the inherited planting offsets. Flower stem corners are **+7.91–8.09 mm**, matching the +8 mm fill; the 14 heads are at least **0.382 m** apart.
- New pocket planting totals 1,467 instances. Including legacy pocket scatter, audit reports 1,687 pocket sprouts, a 10.752 m² patch and approximately 157 sprouts/m²; height/footprint audit quantiles are authored scale estimates, not measured blade-envelope bounds.
- Hardscape submitted geometry **369,178 → 444,174 triangles**: **+74,996**, including 1,148 flower triangles. Mesh count **8 → 9**; additional casting triangles **0**. This is the full hardscape scene submission at high density, not a measured full-frame GPU budget. Frustum visibility and the actual render pipeline still determine per-view totals.
- Existing sprouts keep shared wind and their existing no-cast / receive-shadow policy. Flower geometry is deliberately static, FrontSide, receives shadows and does not cast them. No new animation or wind-shadow parity claim is made.

## Reproduce

With normal project dependencies installed and pinned commits present, from repository root:

```sh
node docs/reviews/fable-lawn-pocket/check.mjs
```

The focused check loads pinned source through TypeScript, builds real Three geometry/instance buffers and uses the real terrain and RNG. Texture-library inputs are inert cached 1-pixel textures; no browser, shader compilation, game render, ledger edit or production mutation occurs. It writes compact evidence beside the script. The expected upstream `toNonIndexed` warning is reproduced; no new broad test suite or production fix is added.
