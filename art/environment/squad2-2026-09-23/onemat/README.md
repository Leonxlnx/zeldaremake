# Sixteen draws for two material groups, and the distant trunks pay for them

*squad lane 2 — 2026-09-30 18:30 UTC — measured, **not shipped***

`roofdraws/` merged seven canopy meshes into one because draws are the scarce resource where this world is
tight. The same question, asked of the thinnest remaining row in the trees: at hero A `distant-far` is **12 draws
for 5 832 triangles — 486 a draw**, thinner than the roof was, and `mid-near` and `mid-far` are 10 draws each
for ~12 000. Thirty-two draws for 29 184 triangles across the three.

Half of those draws are a **second material group**. `distant.ts` gives each near and far geometry two:

```ts
farGeometry.addGroup(0, farWood, 0);                              // the trunk
farGeometry.addGroup(farWood, far.indices.length - farWood, 1);   // the crown cards
…
new InstancedMesh(geometry, [mats.distant, mid ? midCrown : distantCrown], n)
```

and three draws one call per visible material group in every pass (`auditvsrenderer/`), so **every one of those
meshes is two draws.** The file reads as though one material would do: `solidUv` exists so that *"solid
(non-card) vertices of a geometry **sharing the cluster-card material** sample the opaque patch"*, and the crown
material's own design note says its layer already contains solid geometry — *"every vertex tagged `w ≤ 0` — the
lobe cores at 0 and the near LOD's bark at −0.45"*.

## The saving is exactly what it looks like

One material instead of the array, nothing else — the groups stay on the geometry and three ignores them when
the material is not an array:

| | shipped | one material |
| --- | --- | --- |
| **A_stairs** | **555** draws / 8 724 803 triangles | **539** / 8 724 803 |
| trees' own row | 140 / 2 656 692 | **124** / 2 656 692 |

**−16 draws, triangles identical to the digit.** At `stairs1-top`, where 45 draws are spare under W38's 700,
that would be over a third of the headroom.

## What it costs: the distant trunks

0.52 % of the frame changes at >2 levels — **an order of magnitude below the two shade experiments**
(`colshadow/` 7.65 %, `farshade/` 18.00 %) — and at 1× the two frames are indistinguishable. The change is one
cell, x 0.75–0.88 y 0.13–0.25: **14.3 % of its pixels, mean Δ 37.9 levels.** Magnified six times, with the
moved pixels in red:

![two distant trunks, gone](worst-cell-6x.png)

**Two trunks are simply not there.** `mats.distant` is a plain `MeshStandardMaterial` over the cluster atlas;
the crown material carries the foliage treatments — the distance-keyed haze and under-shade that `CROWN_SHADE_M`
and the height-fog chunks apply — and a solid trunk drawn through them washes into the mist. The trunk row in
the middle distance is exactly what `ownerlook/` valued when it checked the owner's north pose: *"resolves at
2.5× into white-bark trunks and crowns at two or three depths"*.

Not shipped. `src/` is unchanged; `git diff` says so.

## The uncomfortable part: this lane's own metric missed it

`band.mjs` exists for one question — *"the middle distance shows trees, not haze"* — and it does not see this:

| `--band 0.05,0.30` | mean | across-columns sd | within-column sd |
| --- | --- | --- | --- |
| `x 0.70–0.95`, shipped | 83.8 | 19.55 | 23.70 |
| `x 0.70–0.95`, one material | 85.7 | **20.17** | 23.92 |
| `x 0.10–0.90`, shipped | 110.1 | 26.00 | 22.96 |
| `x 0.10–0.90`, one material | 110.6 | 25.66 | 23.05 |

Two trunks vanish and the across-columns structure in the window they stood in goes **up**, 19.55 → 20.17.
It is not that the metric is wrong; it is insensitive at this scale. A trunk is ~4 px wide, two of them are a
fraction of a 250-px window, and their tone sits close to the local mist mean, so column statistics have almost
nothing to register. The band metric was built to catch a *whole* middle distance collapsing into a veil, and it
does that.

**The rule this adds**: a small changed-share is not a small change. 0.52 % of a frame deleted two trees.
Magnify the worst diff cell and look at it before believing an aggregate, and do not let a purpose-built metric
that disagrees with the picture settle it — here the order was eye, then metric (which said no), then the
focused diff of the worst cell (which said yes, and was right).

## The path, priced

The 16 draws are still there for whoever wants them, and the shape of the fix is narrow: the crown shader
**already tags wood as `w ≤ 0`**, so a branch that skips the foliage-specific haze and under-shade for those
vertices would let one material draw both and make the 16 draws free. That is a change inside
`createDistantCrownMaterial`'s injected fragment, not a rewrite — but it is a shader change to a material tuned
across several owner reviews (`CROWN_SHADE_M`, `CROWN_UNDER_M`, the leaf-warmth and floor terms), so it wants
its own round and its own before/after at the poses those reviews used. Alongside `batching/` §4's ~26 draws
this is the second-largest draw prize this lane has priced.

## Reproducing

```bash
# the one-line experiment: single material instead of the array in index.ts's `make`
node art/environment/squad2-2026-09-23/frozen.mjs <dist> /tmp/out --poses <poses> --settle 8
node art/environment/squad2-2026-09-23/diffmap.mjs --a … --b … --out sheet.png --tol 2 --grid 8
node art/environment/squad2-2026-09-23/band.mjs --band 0.05,0.30 --x 0.70,0.95 before.png after.png
```
