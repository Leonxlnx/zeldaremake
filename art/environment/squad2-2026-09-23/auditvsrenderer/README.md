# The trees' audit against the renderer's own count — 36 draws low, 820 K triangles high

*squad lane 2 — 2026-09-30 10:00 UTC — `vsrenderer.mjs`*

Lane 2's list was empty, so this round took the thread `lookspots/` left lying in the open. That
directory published two numbers for the same poses and never set them side by side:

| | the trees' audit | `isolate('trees')` |
| --- | --- | --- |
| `stairs2-top` | 95 draws / 3 579 312 | **129 / 3 004 341** |
| `stairs1-top` | 114 / 3 969 181 | **151 / 3 625 772** |

`isolate(name)` (`src/capture/api.ts`) hides every scene child but that system and `lighting`, resets
`renderer.info`, and calls `renderer.render` directly — no composer, so no post-processing quads, and the
lighting group holds only lights and a target, so it adds nothing. What it returns **is** the renderer's own
colour + shadow draw count for that system's share of the frame. It is the number a hand-assembled tally has
to match, and this branch's tally was wrong in both directions at once.

Measured fresh on the current build at three poses, the audit against the renderer:

| | audit | renderer | gap |
| --- | --- | --- | --- |
| **A_stairs** | 104 / 3 476 935 | 140 / 2 656 488 | **+36 calls / −820 447 tris** |
| `stairs1-top` | 110 / 3 892 755 | 147 / 3 549 346 | +37 / −343 409 |
| `stairs2-top` | 92 / 3 483 414 | 129 / 3 004 341 | +37 / −479 073 |

The published tree triangle figure was **31 % too high** at hero A and the draw figure a quarter too low, by
the same two mechanisms at every pose.

## What three does that the tally did not

| mechanism | where | effect on the tally |
| --- | --- | --- |
| **One draw per visible material group, in both passes** | `WebGLRenderer`'s render list and `WebGLShadowMap.renderObject` run the identical loop over `geometry.groups`, each draw over that group's own range | `distant.ts` gives its near and far meshes two groups (wood, then foliage) and `writeRanges` adds one per range, so those families were tallied at **about half** their cost — the whole 36-draw gap |
| `frustumCulled === false` | the `BatchedMesh` pattern, two places in `index.ts` | three submits the object whatever the frustum says, so those draws are not optional and a tally that frustum-tests them reports fewer than the renderer makes |
| A batch is one multi-draw over the lobes that survive `perObjectFrustumCulled` | `BatchedMesh.onBeforeRender`, per instance against the camera's frustum; `renderMultiDraw` returns before `info.render` when none survive | summing every *visible* range overstated the batches by everything off-screen — **825 211 triangles at hero A**, the bulk of the 820 K overcount |
| The colour pass draws `mainCount`, the depth pass all of them | the shadow pass runs first and calls `onBeforeShadow`, never `onBeforeRender` | a bucket's shadow-only instances were charged twice over |
| Either pass skips a mesh with no visible material | same two loops | — |

## After

| | audit | renderer | gap |
| --- | --- | --- | --- |
| **A_stairs** | 139 draws (91 colour + 48 depth) / 2 423 420 | 140 / 2 656 488 | **+1 call** / +233 068 tris (8.8 %) |
| **`stairs1-top`** | 147 (98 + 49) / 3 409 010 | 147 / 3 549 346 | **0 calls** / +140 336 (4.0 %) |
| **`stairs2-top`** | 129 (84 + 45) / 2 883 410 | 129 / 3 004 341 | **0 calls** / +120 931 (4.0 %) |

**Draws now agree**: exact at two poses and +1 of 140 at the third, from +36 and +37. Triangles are
**4.0–8.8 % low**, having been 31 % high at hero A, so the direction flipped and the size fell by three
quarters.

**Nothing in the world moved**, which two independent controls say. The renderer's own column is *identical*
before and after at all three poses — 140 / 2 656 488, 147 / 3 549 346, 129 / 3 004 341 — because a read-only
tally cannot change what is drawn. And `stairs1-top` re-rendered whole comes back at **661 draws / 9 799 283
triangles, md5 `c2d51f15a4b0cf58bc0bb9b340efa1d9`**, the same three values `proxydraw/` recorded, while the
trees' row inside it moved from 110 / 3 892 755 to 147 / 3 409 010. The reporting changed; the frame did not.

## The residual is entirely in the depth pass — the colour model is exact

*2026-09-30 11:40 UTC.* `perfFlags.ts` takes `?shadow=<size>,<taps>`, and `shadow=0` makes
`lighting/index.ts` set `sun.castShadow = false`. That removes the depth pass from **both** sides at once —
the audit's `shadow` frustum is `null`, so it gates every depth call off, and the renderer has no shadow map
to draw — which turns `vsrenderer.mjs` into a **colour-only** comparison:

| `ZR_URL_EXTRA='shadow=0'` | audit | renderer | gap |
| --- | --- | --- | --- |
| `stairs1-top` | 98 calls / 2 045 012 | 98 / 2 045 012 | **0 and 0 — exact** |
| A_stairs | 91 / 1 379 495 | 91 / 1 379 291 | 0 calls / **204 triangles in 1.38 M** (0.015 %) |

**The colour-pass model is right**, to the triangle at one pose and to one part in 6 800 at the other (a
borderline sphere against a frustum plane, which is also the +1 call in the full run). So the whole residual
is the **depth** pass:

| | depth triangles modelled | the renderer's | low by |
| --- | --- | --- | --- |
| A_stairs | 1 043 925 | 1 277 197 | **233 272 (22.4 %)** |
| `stairs1-top` | 1 363 998 | 1 504 334 | **140 336 (9.3 %)** |

Two candidate depth models, computed beside the one in use and both **insufficient**:

- **`depthTrisNoFrustum`** — every caster, no shadow-frustum test — comes out **exactly equal** to the gated
  total, at 49 calls against my 48 at A and 49 against 49 at `stairs1-top`. So the shadow frustum rejects
  nothing that carries triangles, and the renderer's depth **call** count equals the ungated one. The *set* of
  depth draws is right; the triangles per draw are not.
- **`depthTrisBatchFull`** — every batch lobe in depth rather than the camera-culled set — closes **159 760 of
  the 233 272** and **73 040 of the 140 336**. Directionally right, less than half the size. Adopting it would
  fit one number and miss the other, so it is reported rather than adopted.

### The shortfall is in six authored families and in nothing the LOD gates touch

*2026-09-30 13:30 UTC.* `?treelod=<scale>` multiplies every rung gate, so `0.01` empties the high rung
entirely and `10` puts every tree on it. Run at hero A against the renderer, all three configurations:

| | audit | renderer | gap |
| --- | --- | --- | --- |
| shipped | 139 / 2 423 420 (91 colour + 48 depth) | 140 / 2 656 488 | **+1 call / +233 068** |
| `treelod=0.01` — high rung empty | 95 / 1 500 198 (71 + 24) | 96 / 1 733 266 | **+1 call / +233 068** |
| `treelod=10` — everything high | 123 / 4 421 500 (70 + 53) | 124 / 4 654 568 | **+1 call / +233 068** |

**Identical to the digit** while the trees' own triangles run from 1.5 M to 4.4 M and the depth calls from 24
to 53. A shortfall that survives emptying the rung families is not a per-family modelling error in them. And it
is *pose*-dependent (233 068 at hero A, 140 336 at `stairs1-top`, 120 931 at `stairs2-top`), so it is not a
constant overhead either.

`byFamily` says exactly which families survive `treelod=0.01` — the authored and pool-built ones, which no gate
moves:

| family | shipped depth | `treelod=0.01` |
| --- | --- | --- |
| `giant-wood` | 270 625 | **270 625** |
| `giant-far-foliage-batch` | 124 240 | **124 240** |
| `giant-near-base` | 67 507 | **67 507** |
| `column-near-base` | 59 228 | **59 228** |
| `giant-cards` | 11 618 | **11 618** |
| `whitebark-roots` | 9 664 | **9 664** |
| `column-lod0` · `column-lod1` · `whitebark-lod0` · `understory-lod0/1` · `whitebark-shadow` | 230 360 · 47 500 · 100 578 · 34 998 · 17 479 · 70 128 | **0** |
| **total** | 1 043 925 | **542 882** |

Those six sum to 542 882 — the whole `treelod=0.01` depth total — so the **233 272 shortfall is 43 % of six
named families**, and their *colour* submission is exact (the `shadow=0` run above). The search is now six
meshes' depth submission rather than the whole system, and the two candidates already refused stay refused: the
batch's full lobe set would owe 159 760, which is 68 % of the shortfall at hero A but **more than all of it**
at `stairs2-top` (169 480 against 120 931).

**Where the next hour goes.** The `shadow=0` run validates `perInstance` only for meshes that appear in the
**colour** pass, so the families that appear *only* in depth are untested by it. `byFamily` now carries
`colourTriangles` and `depthTriangles` apart, which names them — hero A, every family with a depth draw:

| family | depth calls | depth triangles | colour triangles |
| --- | --- | --- | --- |
| `giant-wood` | 14 | 270 625 | 270 625 |
| `column-lod0` | 6 | 230 360 | 160 934 |
| `giant-far-foliage-batch` | 2 | 124 240 | 124 240 |
| `whitebark-lod0` | 1 | 100 578 | 100 578 |
| **`whitebark-shadow`** | 5 | **70 128** | **0** |
| **`giant-near-base`** | 2 | **67 507** | **0** |
| `column-near-base` | 2 | 59 228 | 26 439 |
| `column-lod1` | 4 | 47 500 | 47 500 |
| `understory-lod0` | 4 | 34 998 | 28 430 |
| `understory-lod1` | 4 | 17 479 | 17 479 |
| `giant-cards` | 3 | 11 618 | 11 618 |
| `whitebark-roots` | 1 | 9 664 | 9 664 |
| **total** | **48** | **1 043 925** | against the renderer's **1 277 197** |

The two rows with no colour triangles are the ones a colour-only run cannot test: `whitebark-shadow` (the
`proxydraw/` proxies) and `giant-near-base`. **The `treelod` bracket above narrows it further and retires half
of that guess**: `whitebark-shadow` is gone at `treelod=0.01` and the shortfall did not move, so the proxies
are **not** in it. `giant-near-base` survives and stays a suspect, at 67 507 of the 233 272.

Pricing them needs per-family truth, which `isolate()` cannot give — it matches `scene.children` by name. The
instrument that would is a debug switch in this lane's own file turning `castShadow` off one family at a time
and watching the renderer's depth total fall by that family's real cost. Named, not built: it is temporary
instrumentation, and this round's result stands without it.

## The hypothesis that explained 28 % of it and was wrong anyway

The residual is 28 % and 29 % of `batchCulledTris` at the two poses — near-equal ratios, which is exactly the
shape that invites a mechanism. The candidate: three gives `BatchedMesh` no `onBeforeShadow`, so if its
**shadow** pass drew the full visible set rather than the set the camera cull left behind, the renderer's
extra triangles would equal the *depth half* of that number. Splitting it says no: **159 760 against a
233 068 residual** at hero A, **73 040 against 140 336** at `stairs1-top`. Refused, and the ratio was a
coincidence.

Refused before that, by reading `node_modules/three` rather than guessing: shadow cascades (the sun is one
`DirectionalLight`, `cascades: 1`), the two-pass `transparent` + `DoubleSide` rule (only `distant.ts`'s
material is transparent and it already sets `forceSinglePass`; `materials.ts`'s `DoubleSide` materials are
not transparent), a constant `isolate()` overhead (no composer, and the lighting group has no meshes),
non-`Mesh` drawables under the trees group (there are none), **VSM shadows** (which would draw every
`receiveShadow` mesh in the depth pass — `lighting/index.ts` sets `BasicShadowMap`), a **reversed depth
buffer** (`Frustum
.setFromProjectionMatrix` takes `coordinateSystem` and `reversedDepth`, which `postfx/shadowcull.ts` passes and
this tally does not — but `main.ts` builds the renderer without `reversedDepthBuffer`, so the defaults are
right), and a **second shadow-casting light** (`house.ts`'s five `PointLight`s never set `castShadow`; no light
but the sun casts).

Refused by measurement: **non-indexed batch lobes.** `BatchedMesh.addGeometry` sets `geometryInfo.count` — the
number `renderMultiDraw` sums into `info.render.triangles` — to `indexCount` for an indexed part and to
`vertexCount` for one without an index, leaving `indexCount` at its initial **−1**. This tally read
`indexCount`, so a non-indexed lobe was charged `floor(-1/3) = −1` triangle, taking triangles *off* the total
in exactly the residual's direction. It reads the draw range's `count` now, and `nonIndexedLobes` is **0** at
all three poses with the totals byte-identical: every part in these batches is indexed, so the change is
hardening and explains none of the gap.

So the residual is now **localised rather than unexplained**: the colour pass is exact, the depth pass is
9.3–22.4 % low, its draw *set* is right, and the two families that only ever appear in depth are the next
thing to price. What ships with it is the means to continue: the tally reports `colourCalls` / `depthCalls`
apart, plus `cullExempt`, `mainZero`, `noCullCalls`, `nonIndexedLobes`, `batchCulledTris` split by pass, and
the two candidate depth totals; `vsrenderer.mjs` prints all of it beside the renderer's own number and honours
`ZR_URL_EXTRA='shadow=0'` for the colour-only split.

## What this retires

Every "trees N M triangles" figure this branch published from the audit was high — at hero A by 820 K of a
3.48 M claim. Whole-frame numbers and every W38 figure come from `__ZR__.stats()` / `pose-counts.mjs` and
were **never** affected; what moves is the *attribution*. `sceneshade/` priced each system's shade from these
rows, so its tree share is overstated in the same direction; its conclusion (structures, terrain and
vegetation spend 1.34 M for under 0.6 % of pixels) rests on the other systems' rows and on pixel
measurements, and is not disturbed.

## The rule this produced

A second total that cannot be assembled wrongly beats a careful one that can. `auditgap/` shipped
`unaccounted` for exactly this reason — but `unaccounted` walks the scene graph with **the same** `add()`, so
it can only catch a *forgotten family*, never a wrong rule. It read ZERO through every hour of this. The
renderer's own count is the only check that catches a wrong rule, and it was available all along.

While fixing this the same class of bug appeared a third time: `total` was summed field by field over four
names and silently dropped `colourCalls` and `depthCalls` the hour they were added. It now sums over the
tally's own keys.

## Files

- `before.json` — the three poses on the buggy tally.
- `after.json` — the same on the fixed one, with both candidate depth totals.
- `colour-only.json` — the `shadow=0` run that localised the residual to the depth pass.

## Reproducing

```bash
node art/environment/squad2-2026-09-23/auditvsrenderer/vsrenderer.mjs dist /tmp/vs.json \
  --views 'A_stairs;-20.368,3.7,20.588:-17.327,3.45,17.547' --quality high --settle 8

# the colour pass alone, on both sides
ZR_URL_EXTRA='shadow=0' node art/environment/squad2-2026-09-23/auditvsrenderer/vsrenderer.mjs \
  dist /tmp/vs-colour.json --views 'A_stairs' --quality high --settle 8
```
