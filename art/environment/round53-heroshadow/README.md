# Round 53 — fable-4: the high-LOD white-barks behind the camera cast from their medium geometry (W38)

**Branch** `agent/fable-4-heroshadow` (one file: `src/world/trees/index.ts`).

## Why
fable-2's flag: A on the head `be123deb` renders 9.155 M / 597 — over the 9.0 M ceiling since the squad's
layers (the map: vegetation +535 K, structures +75 K, distant cards +34 K, understory +29 K; the trees as
a whole −220 K since round 52's culls). Inside white-bark at A, the two hero instances of variant 7 and
the variant 4 behind the camera had their colour pass culled in `mainpass`, but still cast their high
meshes (100.6 K + 100.6 K + 53 K) in the shadow pass — 254 K for shade that, measured here, does not even
reach A's frame.

## What
`FamilyVariant.shadowProxy` for the white-barks' high LOD: an InstancedMesh on the **medium** geometry
with a colour-pass material that writes neither colour nor depth (`MeshBasicMaterial({ colorWrite:
false, depthWrite: false })`) and the family's depth twin for the shadow pass. `submitFamily` fills the
high mesh with the in-view instances only (both passes) and the proxy with the shadow-only instances.
Three draws the proxy in the colour pass too (a layer only the shadow camera enables is skipped in the
shadow pass as well in r0.186), so its cost is the medium mesh twice — 10–20 K where the high mesh was
100 K.

## Six views — head `be123deb` vs branch, same box, `--settle 6`
| view | head draws / tris | branch draws / tris | Δ tris | SSIM Δ | pixels > 6 |
|---|---|---|---|---|---|
| A | 597 / 9.15 M | 598 / **9.02 M** | **−130 K** | +0.0000 | 0.00 % |
| B | 589 / 8.30 M | 589 / 8.21 M | −90 K | +0.0000 | 0.00 % |
| C | 472 / 6.77 M | 473 / 6.74 M | −30 K | −0.0005 | 0.21 % |
| D | 557 / 8.53 M | 557 / 8.44 M | −90 K | +0.0000 | 0.00 % |
| E | 589 / 8.30 M | 589 / 8.21 M | −90 K | +0.0000 | 0.00 % |
| F | 547 / 7.99 M | 548 / 7.83 M | −160 K | +0.0000 | 0.00 % |

Five views pixel-identical: the behind-camera heroes' shade does not land in those frames (the
`shadowReaches` sweep is conservative). At C one white-bark behind the camera throws its dapple into the
frame at one lamina in 8 instead of every lamina — 0.21 % of pixels, −0.0005.

## Verification
`npm run typecheck` green, build green, 19/19 tree tests.
