# Proposed near-hedge pack reduction

**Proposed, not integrated. CPU verification only; no GPU acceptance verdict.**

Fable requested this minimal patch on 2026-09-12 at 13:31 UTC. The foreground vegetation agent
must land first; Fable can then apply this one-line change to the updated `PACKS` table. Do not
replace `plants.ts` with an older copy or replay the earlier hedge geometry change. Re-evaluate
counts against that integrated source before claiming the performance limit passes.

The current high-detail hedge draw packs all three geometry variants together. Each instance
submits all three, with the two unwanted variants collapsed by the existing shader. The proposed
line removes that unnecessary near-detail work:

```ts
hedge: [SINGLE(3), ALL(3), ALL(3)],
```

`plants.patch` changes only `src/world/vegetation/plants.ts`. Medium/far detail keep their original
packing. No leaf, stem, placement, RNG, material, shadow, wind or LOD-distance code changes.

## Reproduce

From a repository checkout with dependencies installed and the baseline commit available:

```sh
node docs/proposals/astra-hedge-packs/check.mjs
```

The check reads baseline source using `git show` and applies the exact supplied patch **in memory**.
It embeds the six saved camera positions, so screenshots and ignored capture metadata are not
required. It writes regenerated evidence to
`gauntlet/tmp/hedge-pack-review/reproduced-evidence.json`; production files and Git refs are untouched.

The baseline is `18e19331fb0571daf336b17debc9f146f9fc8cfc`.

| Source | SHA-256 |
| --- | --- |
| Baseline `plants.ts` | `f0137146342984bb2c2ea1cd1cb03418d5e72e21dfe39a437d87ad2a6d7d88af` |
| Proposed `plants.ts` | `01e9d64c4aa67c1a7318d35e478db15a876f33476293c0384bbf954e0f0ffc82` |

The check verifies all 13 plant sets' source geometry and seeded placements, the world RNG
continuation, material program keys, shadow-material bindings, and actual active
LOD/variant/matrix/color identities at A–F plus near/mid/far rebucketing probes. The existing
`node src/world/vegetation/lodset.test.mjs` suite also passed during the initial review.

## Measured CPU cost and limits

All twelve hedges are high detail at each of the six saved 18e1933 camera positions.
`LodInstancedSet.stats()` includes one color and one sun-shadow pass, before frustum culling:

| Hedge cost, each A–F camera | Baseline | Proposed | Change |
| --- | ---: | ---: | ---: |
| Submitted triangles | 299,808 | 97,160 | −202,648 |
| Draw calls | 2 | 6 | +4 |

The observed 18e1933 B/E full-frame count was **9,016,050** triangles. With approximately **54,000**
pending rope triangles and this saving, the conditional estimate is **8,867,402**, leaving
**132,598** below the 9M limit before other pending changes. The observed maximum of 646 draws,
plus four hedge draws and two pending sign draws, estimates 652 before other pending additions.
These are budget calculations, not a fresh capture or a guarantee for Fable's next vegetation pass.

Actual GPU capture must confirm totals and appearance after integration. Separating the packs
changes draw grouping and bounding spheres; it preserves every visible variant's source buffers,
transform and pigment, but this CPU proof does not assert pixel-identical GPU rasterization.
