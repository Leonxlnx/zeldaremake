# Looking out from the plateau: which tree family the frame is actually paying for

Lane 2, 2026-09-28. Branch `cursor/squad2-treephases-682b`.

The look-backs are the two views the triangle and draw lines are worst at, and until now the trees' share
of them was only ever split by the audit's **submitted** counters — what the systems hand to the
renderer, not what survives culling. `isolate()` stops at the top-level system, so "trees 3.3 M" was as
far as it went.

`familycost.mjs` splits the drawn frame by family the way `depthfoot/depthprobe.mjs` split the depth
pass: pose, settle with time, **freeze the clock**, then hide one family, re-render the same frame and
read both the triangle delta and the share of pixels that moved. A control frame with nothing touched
comes first and read **0.00 %** at both poses. `--shadow` drops `castShadow` instead of visibility, so
"what does this family cost to draw" and "what does it cost to cast" separate.

    node art/environment/squad2-2026-09-23/outlook/familycost.mjs dist outlook/poses.json outlook
    node … --shadow --only "distant ring,mid layer,white-barks"

It needs a handle on the trees group, which the shipped build does not expose — the same temporary line
`depthprobe.mjs` documents, added next to `phase('distant-mid-and-publish')` and **taken out again**.

## 1. plateau-north — 456 draws / 6 246 699 triangles

| family | meshes | submitted | drawn triangles | draws | pixels moved |
| --- | --- | --- | --- | --- | --- |
| giants: wood and leaves | 13 | 3 393 774 | 552 932 | 26 | 6.78 % |
| columns | 8 | 738 567 | 513 233 | 14 | 2.45 % |
| giants: far foliage batches | 3 | 483 860 | 227 652 | 3 | 1.38 % |
| white-barks | 12 | 117 519 | 157 743 | 15 | 0.34 % |
| understory | 14 | 75 350 | 143 818 | 23 | 0.31 % |
| **mid layer** | 10 | 22 869 | 25 181 | **30** | 0.38 % |
| **distant ring** | 7 | 7 346 | 9 338 | **21** | **0.00 %** |
| near bases | 6 | 195 792 | **0** | 0 | 0.00 % |

## 2. plateau-back — 702 draws / 10 895 532 triangles

| family | meshes | submitted | drawn triangles | draws | pixels moved |
| --- | --- | --- | --- | --- | --- |
| giants: wood and leaves | 16 | 3 400 474 | 1 175 651 | 44 | 35.21 % |
| giants: far foliage batches | 3 | 483 860 | 655 676 | 6 | 9.78 % |
| columns | 11 | 830 082 | 498 590 | 14 | 1.84 % |
| white-barks | 15 | 159 174 | 168 838 | 16 | 2.29 % |
| understory | 8 | 49 602 | 63 638 | 10 | 5.47 % |
| **mid layer** | 10 | 39 782 | 44 848 | **30** | 6.03 % |
| **distant ring** | 5 | 4 800 | 6 400 | **15** | 1.78 % |
| near bases | 6 | 200 335 | **0** | 0 | 0.00 % |

"Drawn" is the delta across **both passes**, which is why a family can draw more than it submits
(white-barks submit 117 519 and draw 157 743: most of that geometry is drawn twice, once for the sun).

## 3. What this says

**The near bases cost nothing at either pose.** Six meshes, 0.2 M submitted, 0 drawn: the batch's
per-object frustum culling already does the whole job there, which is the same reason the slot-cap
direction priced out at 4–37 K (`slots/`).

**The two layers this lane owns are a draw-call problem, not a triangle problem.** The mid layer and the
distant ring together spend **45–51 draws** — a third of the trees' 135 at plateau-back — to draw **32–51 K
triangles**, about **1.3 % of the trees' drawn triangles**. Every other family draws 15–40 K triangles per
draw call; these two draw 400–1500. The cause is structural: `distant.ts` splits each layer into sector
meshes for culling and gives each mesh two material groups (`addGroup`), so seven resident sectors are
twenty-one draws.

**And neither of them casts a shadow at all** — `--shadow` found **0 meshes** with `castShadow` in either
family at either pose, so all of those draws are colour-pass draws and there is no depth-side saving to
take.

**At plateau-north the distant ring draws 21 calls and 9 338 triangles for 0.00 % of the pixels.** It is
behind the nearer forest, so this is occlusion, not something a distance rule can see; at plateau-back
the same family is worth 1.78 % of the frame, so it cannot simply be dropped at range either. The
recoverable part is the **granularity**: fewer, larger sector meshes cut draws and raise triangles, and
with 400–1500 triangles a draw there is a lot of room before that trade turns bad. That is the next
piece of work in this lane, and it is `distant.ts`, which lane 2 owns outright.

**One finding for fable-4:** dropping `castShadow` on the white-barks moves **0.00 % of the pixels** at
both poses while saving 40 224 triangles and 3 draws at plateau-north and 9 664 / 1 at plateau-back. It
is the same free-shade case `depthfoot/` found in the giants, in `whitebark.ts` rather than here — 21
meshes, so the per-mesh test `util/shadowReach.ts` offers would likely take it.

## 4. A correction to `depthfoot/` §9

That section claimed the depth culls took the plateau look-back "back under W38's 700-draw ceiling"
(707 → 702). **702 is two over 700, not under it.** The −5 draws narrow the gap and the frame stays
byte-identical, but the gate is not closed; W38's checks are written for the six `*hero` viewpoints, so
the line does not formally bind at this pose either way. The arithmetic was mine and both that section
and `lookbacks.log` now carry the correction.

## Files

- `familycost.mjs` — the probe; `--shadow`, `--only`, and a control frame first.
- `familycost.json`, `shadowcost.json` — the tables above.
- `poses.json` — the two look-backs.
- `plateau-north.jpg`, `plateau-back.jpg` — the baselines, and a frame without any family whose removal
  moved under 0.05 % while saving more than 4 draws.

## 5. The third draw call, found and removed: 15–17 draws a frame

`--per-mesh distant-` measured every distant and mid tree mesh at **three draw calls for two material
groups**, at both poses, without exception:

| mesh | instances | groups | materials | draws | drawn triangles | pixels moved |
| --- | --- | --- | --- | --- | --- | --- |
| `distant-0-far` | 58 | 2 | 2 | **3** | 1 856 | 0.00 % |
| `distant-1-far` | 52 | 2 | 2 | **3** | 1 664 | 0.00 % |
| `distant-2-far` | 47 | 2 | 2 | **3** | 1 504 | 0.00 % |
| `distant-3-far` | 18 | 2 | 2 | **3** | 576 | 0.00 % |
| `distant-4-far` | 24 | 2 | 2 | **3** | 768 | 0.00 % |
| `distant-5-near` | 2 | 2 | 2 | **3** | 1 466 | 0.00 % |
| `distant-5-far` | 47 | 2 | 2 | **3** | 1 504 | 0.00 % |

Two groups cannot be three draws, and the reason is in three's renderer: a material with `transparent`
**and** `side: DoubleSide` is rendered **twice** — back faces, then front faces — unless
`forceSinglePass` is set (`WebGLRenderer.renderObject`, and again in `getProgram`). The wood group is one
draw; the crown group is two. `forceSinglePass` appears nowhere in this repository.

These cards do not blend: `alphaTest` makes every fragment opaque or discarded and `depthWrite` is on, so
the depth test resolves the ordering inside one pass. `distant.ts` sets `forceSinglePass = true` on the
crown material (both the far layer's and the mid layer's, one factory).

`singlepass.mjs` measures the two states **against each other in one page load** — same pose, clock
frozen, the flag toggled at runtime with `needsUpdate` — so nothing but the flag differs:

| view | single pass | two passes | draws | triangles | pixels > 2/255 | > 8/255 | max Δ | SSIM |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **A_stairs** | **559** / 8 626 622 | 575 / 8 631 286 | **−16** | −4 664 | 0.213 % | 0.036 % | 28/255 | 0.99746 |
| F_canopy | 500 / 7 831 095 | 515 / 7 836 917 | **−15** | −5 822 | 0.526 % | 0.125 % | 39/255 | 0.99789 |
| plateau-north | 439 / 6 242 395 | 456 / 6 246 699 | **−17** | −4 304 | 0.092 % | 0.038 % | 46/255 | 0.99936 |
| **plateau-back** | **687** / 10 888 866 | 702 / 10 895 532 | **−15** | −6 666 | 0.578 % | 0.072 % | 37/255 | 0.99904 |

**This is not pixel-identical, and it is inside the lane's budget.** 0.09–0.58 % of pixels move by more
than 2/255 and a tenth of that by more than 8/255, all of it on the crowns' card edges where two faces of
the same card overlap; SSIM **0.9975–0.9994** against the −0.003 the six fixed views are held to. Side by
side the two frames are indistinguishable and the amplified difference is nearly black.

**What it buys:** 15–17 draws at every view measured. **A_stairs 575 → 559**, which is the binding fixed
view, and **plateau-back 702 → 687 — under 700 this time**, which is the correction in §4 turned into the
thing it claimed.

**For the other lanes, the same one line:** nothing else in the repository sets `forceSinglePass`, and
`transparent` + `DoubleSide` also describes `atmosphere/mist.ts`, `atmosphere/fairy.ts`,
`structures/expansionSouth.ts`'s haze, `structures/expansionNorth.ts`'s pool, `structures/materials.ts`,
`props/index.ts`'s AO decals and `ui/items/dekuStick.ts`. Each of those is drawing twice per frame. Where
the material blends (additive glows, the mist) the second pass is doing real work and the flag would
change the picture more than it did here — but it is worth measuring one at a time, and `singlepass.mjs`
does exactly that measurement for any of them.

## 6. The two-pass sweep, closed: the crowns were the only one that mattered

§5 fixed the distant crowns and noted that `forceSinglePass` appears nowhere else in the repository, with
seven other `transparent` + `DoubleSide` materials in the source. `twopass.mjs` asks the **whole scene**
instead of the grep: walk up from the trees group to the root, find every material actually in that state,
then flip them one at a time and together, on the shipped build.

**Two material/system pairs, both in `structures`** — `structures:lantern-halo` and an unnamed
`MeshBasicMaterial` — and that is all:

| view | material | draws saved | triangles saved | pixels moved | SSIM |
| --- | --- | --- | --- | --- | --- |
| A_stairs (559 draws) | `structures:lantern-halo` | **1** | 10 | 0.00 % | 1.00000 |
| A_stairs | `MeshBasicMaterial` (2 meshes) | 0 | 0 | 0.00 % | 1.00000 |
| A_stairs | both together | **1** | 10 | 0.00 % | 1.00000 |
| plateau-back (687 draws) | `structures:lantern-halo` | 0 | 0 | 0.00 % | 1.00000 |
| plateau-back | `MeshBasicMaterial` | **1** | 560 | 0.00 % | 1.00000 |
| plateau-back | both together | **1** | 560 | 0.00 % | 1.00000 |

**So the question is closed rather than open.** The rest of the world already avoids the rule — the leaf
and foliage materials are `alphaTest` **without** `transparent`, which is the correct pattern and costs one
pass — and the seven other source matches are either single-sided, sprites, or not in this scene. What is
left is **one draw call**, free (SSIM 1.00000 at both poses, 0.00 % of pixels), in `structures/`: worth a
line when that lane next touches those materials, not worth a branch.

Recorded so nobody re-runs it: the distant crowns were the only material in the world where three's
two-pass rule was costing anything, and §5 took it.

**The baselines here are also a cross-check on §5.** `twopass.mjs` is a different harness and it reads the
shipped head at **A_stairs 559 / 8 626 622** and **plateau-back 687 / 10 888 866** — the same numbers
`singlepass.mjs` produced, control 0.00 % at both.

## 7. What is left in these two layers, sized

After §5 each distant and mid mesh is **two draws** (wood, crown). The layers are split by tree **variant**,
not by sector: `distantVariants.map(...)` makes a near and a far `InstancedMesh` per variant, so the draws
scale with how many shapes have instances in a bucket rather than with what is on screen.

| pose | distant meshes | mid meshes | draws now | a `BatchedMesh` per layer per material |
| --- | --- | --- | --- | --- |
| plateau-north | 7 | 10 | 34 | 4 |
| plateau-back | 5 | 10 | 30 | 4 |

**That is −26 to −30 draws**, and it is the same shape as the giants' far foliage (`FarFoliageBatch`,
fable-4's round 54) which already proves the approach works here: those three batches carry 100–105
instances each and measure **2 draws apiece** (colour + depth), so `WEBGL_multi_draw` is present on this
box and a batch really is one call.

What it needs: each variant's geometry split at the existing group boundary into wood and crown (the split
`extractTaggedFoliage` already does for the giants), two `BatchedMesh`es per layer, `setGeometryIdAt` for
the near/far LOD swap instead of two meshes, per-instance colour through `setColorAt`, and the audit's
counters moved across. The risk is the capture contract — the same pose must draw the same instances warm
or cold — which `bitcheck.mjs` cannot check (it hashes geometry, not the draw list) but `frozen.mjs` can.

## 8. Batching the two layers: the win at the views W38 measures, and the reason it is not lane 2's call alone

§7 sized this at the look-backs. `familycost.mjs --only "distant ring,mid layer"` now prices it at the six
fixed views — the ones W38 is written for — on the shipped head:

| view | draws | distant ring | mid layer | the two layers | share of the frame | batched (4 draws) |
| --- | --- | --- | --- | --- | --- | --- |
| **A_stairs** | 559 | 12 (6 meshes) | 20 (10) | **32** | **5.7 %** | **531** |
| B_house | 541 | 12 | 20 | 32 | 5.9 % | 513 |
| C_lookback | 479 | 10 | 20 | 30 | 6.3 % | 453 |
| **D_log** | 465 | 14 (7) | 20 | **34** | **7.3 %** | 435 |
| E_ground | 541 | 12 | 20 | 32 | 5.9 % | 513 |
| F_canopy | 500 | 10 | 20 | 30 | 6.0 % | 474 |

Two draws a mesh now (§5 took the third), and **the mid layer is a flat 20 at every view**: all ten of its
meshes always have instances, so it never culls at the mesh level. The two layers are **5.7–7.3 % of every
hero view's draw calls** for 29–44 K triangles, and both are real content — 0.4–4.5 % of the pixels for the
ring, 2.1–10.1 % for the mid layer. This is a submission-cost change, not a look one.

### What it takes, read out of the code

- **Geometry:** each variant's `near` and `far` already carry exactly two groups — wood (material 0) and
  crown (material 1) — so the split into two geometries is an index-range subset, the same shape as
  `extractTaggedFoliage`'s. Two `BatchedMesh`es per layer (wood, crown), `setGeometryIdAt` for the near/far
  swap where there are two meshes today.
- **Per-instance colour needs nothing:** three routes a `BatchedMesh`'s `setColorAt` through
  `USE_BATCHING_COLOR` in the standard `<color_vertex>` chunk, which these materials already use.
- **The drawing half is small:** `bucketDistant` splits placements by distance into two lists and
  `fillDistant` writes matrices, colours, a count and a padded bounding sphere. In a batch that becomes
  `setVisibleAt` plus `setMatrixAt`, with `perObjectFrustumCulled = false` so this lane's own padded test
  (wind sway and the shadow margin) keeps deciding rather than three's unpadded one.

### And the blocker, which is the reason this is a proposal and not a commit

**The trees' shared vertex shader multiplies by `instanceMatrix` by hand**, in four places in
`materials.ts` (`WIND_VERTEX_BODY`'s root, position and the inverse-rotation of the wind displacement, plus
`vDistPhase`) and four in this file's crown shader. Each is guarded by `#ifdef USE_INSTANCING` — and a
`BatchedMesh` does **not** define it. Under `USE_BATCHING` those branches would be skipped and every
instance would render at the origin, so a `#elif defined( USE_BATCHING )` branch using three's
`batchingMatrix` is **mandatory**, not optional.

The good news is that it fits: `<batching_vertex>` declares `batchingMatrix` at line 31 of the standard
vertex shader and these materials inject at `#include <begin_vertex>`, line 40 — so it is in scope at the
injection point, and the added branch is provably inert for every current user (nothing defines
`USE_BATCHING` today).

**But `materials.ts` is the shader every tree family shares** — giants, columns, white-barks and both these
layers. That is not a "minimal declared touch" to another lane's file; it is the hot path of lane 3's and
fable-4's work. So the numbers above are a proposal for whoever holds that file, not something this lane
should land on its own.

**One risk to carry with it:** `batchingMatrix` is indexed by `gl_DrawID`, which needs `WEBGL_multi_draw`.
It is present on this box — the giants' far-foliage batches carry 100–105 instances each and measure two
draws apiece, which only multi-draw explains — but fable-4's round-54 note says the same thing their
batches were never exercised on: a context without the extension.

## 9. A correction to §8: the shared shader is avoidable, and the win still is not needed

§8 said the world-space route "collides with `aRoot`'s meaning" and left the shared-shader change as the
practical option. On a closer read of the crown shader that is too pessimistic, and the correction matters
because it moves the work back inside this lane's own files.

The collision is real but local. Baked to world space, `aRoot.xyz` is the crown centre in world space —
which is what `crownC` wants — but `aRoot.y` is also the **height above the tree's root** that the sway
amplitude uses, and in world space that becomes world Y (terrain runs −2 to +8 m here, so the amplitude
would be wrong by most of a crown's height). Keeping `aRoot.y` local instead breaks `vCrownOff`, which is
`(crownP − crownC) / radius` and needs a true world centre for the spherical shading. Neither slot is free:
`aRoot.w` already carries the radius.

**But one more float attribute settles it, and it is this lane's geometry.** `crownCards` in `distant.ts`
writes these vertices; adding `aCrownH` (the local crown height) for the batched geometry only, behind a
define this material already controls through `customProgramCacheKey`, gives the shader all three numbers:
the world centre from `aRoot.xyz`, the radius from `aRoot.w`, the height from `aCrownH`. The wood group
needs nothing at all — `materials.ts` computes its wind height from positions (`treeP.y − treeRoot.y`)
rather than from a local constant, which is exactly why the giants' merged world-space sectors already work.

So the honest shape of this proposal is now: **it can be done entirely in `distant.ts` and `index.ts`**, at
the cost of one attribute on the crown geometry, ~250 baked far geometries (≈ 8 000 triangles — the far LOD
is 32 triangles an instance), and a rewrite of the layers' drawing half.

**And it is still not worth doing yet.** The binding fixed view has **141 draws of headroom** under W38
(559 of 700) after §5, every hero view passes on both lines, and the play-mode draws came down with them.
Batching buys 26–30 draws against a budget nothing is pressing on, while risking a wrong sway amplitude on
the distant crowns — the exact thing the owner's original "the trees do not populate" note was about.
**The lane's recommendation is to hold it** until something actually needs those draws (a heavier scene, a
weaker device, or another lane's growth), and to take it then in `distant.ts` rather than in the shared
shader.

## 10. The understory: the family I expected to be waste, and it is the opposite

§2's table showed the understory at plateau-north spending **23 draws and 143 818 triangles for 0.31 % of
the pixels** — the second-worst value in the frame after the distant ring — and there is no cull distance
for it anywhere: `bucketFamily` sorts its five variants into three LOD buckets by camera distance and never
drops one. That looked like an easy 143 K.

It is not. Priced at the views the player actually stands in (`familycost.mjs --only understory`):

| view | drawn triangles | draws | pixels moved |
| --- | --- | --- | --- |
| **A_stairs** | 93 204 | 20 | **12.96 %** |
| **B_house** | 99 910 | 18 | **11.17 %** |
| C_lookback | 22 200 | 7 | 2.12 % |
| **D_log** | 125 757 | 21 | **22.66 %** |
| E_ground | 99 910 | 18 | **11.17 %** |
| F_canopy | 55 319 | 7 | 2.51 % |
| plateau-back | 63 638 | 10 | 5.47 % |
| plateau-north | 143 818 | 23 | **0.31 %** |

(All six fixed views now. E_ground reads identically to B_house because the two viewpoints share a camera —
the counts table has both at 541 / 7 903 532.)

**The understory is one of the best-value families in the frame** — at D_log it is 22.66 % of the pixels for
1.5 % of the frame's triangles, and at A_stairs and B_house 11–13 %. It is the forest floor and the saplings
the player walks past, which is exactly what fable-4's round-53 placement work was for.

**plateau-north is the exception, not the rule**, and it is the only pose measured where the family is
nearly invisible: a look *out over* the forest from the plateau, where the understory is under the canopy and
behind the nearer trunks. A plain distance cull tuned for that pose would take triangles out of the four
poses where the family earns its keep, because at those poses the earning instances and the wasted ones are
at similar distances — the difference is occlusion and elevation, not range.

**So the recommendation is to leave it alone.** The 143 K at plateau-north is real but it needs a
view-dependent rule (elevation, or occlusion the engine does not have) rather than a range gate, and its own
shadow casting is already culled per instance by `shadowReach` (`submitFamily`: an instance outside the
frustum is drawn depth-only when its sweep reaches the frame, and not at all when it does not). Recorded so
the next person who sees that 0.31 % does not spend an afternoon on it.
