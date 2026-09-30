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

## The residual, and the hypothesis that explained 28 % of it and was wrong anyway

The residual is 28 % and 29 % of `batchCulledTris` at the two poses — near-equal ratios, which is exactly the
shape that invites a mechanism. The candidate: three gives `BatchedMesh` no `onBeforeShadow`, so if its
**shadow** pass drew the full visible set rather than the set the camera cull left behind, the renderer's
extra triangles would equal the *depth half* of that number. Splitting it says no: **159 760 against a
233 068 residual** at hero A, **73 040 against 140 336** at `stairs1-top`. Refused, and the ratio was a
coincidence.

Also refused before that, by reading `node_modules/three` rather than guessing: shadow cascades (the sun is
one `DirectionalLight`, `cascades: 1`), the two-pass `transparent` + `DoubleSide` rule (only `distant.ts`'s
material is transparent and it already sets `forceSinglePass`; `materials.ts`'s `DoubleSide` materials are
not transparent), a constant `isolate()` overhead (no composer, and the lighting group has no meshes), and
non-`Mesh` drawables under the trees group (there are none).

So the last 4–8 % is **unexplained and published as unexplained**. What ships with it is the means to
continue: the tally reports `colourCalls` / `depthCalls` apart, plus `cullExempt`, `mainZero`, `noCullCalls`
(the no-frustum-test ceiling) and `batchCulledTris` split by pass, and `vsrenderer.mjs` prints all of it
beside the renderer's own total.

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

## Reproducing

```bash
node art/environment/squad2-2026-09-23/auditvsrenderer/vsrenderer.mjs dist /tmp/vs.json \
  --views 'A_stairs;-20.368,3.7,20.588:-17.327,3.45,17.547' --quality high --settle 8
```
