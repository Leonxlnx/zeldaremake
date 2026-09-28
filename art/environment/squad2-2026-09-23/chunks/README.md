# The near-LOD builder's chunks — the floor under a frame's pool time, and what it was made of

Lane 2, 2026-09-28. Branch `cursor/squad2-treephases-682b`.

`tiers/README.md` §2d–2e left this lane with one open number: on the weakest memory tier (`?pool=small`)
a **walking** player's near-LOD builder runs at `workMsP95` 6.2–6.9 ms against a **3 ms** budget, with
21–26 of 600 frames over it. §2e tried the obvious fix — predict a fresh chunk pessimistically — and it
made the overruns **worse** (42 frames), because of the mechanism it uncovered:

```ts
if (steps > 0 && elapsed + expected > budgetMs) break;   // lodPool.ts work()
```

**The first chunk of every `work` call runs whatever the budget says.** That is the progress guarantee —
without it a build whose chunks all exceed the budget never advances and starves into a synchronous build
at its pin. Its price is that **the longest unsplittable chunk is a floor under the frame's pool time**.
So the lever is not the estimator and not the guarantee: it is the chunks.

## 1. Which chunk, measured without a browser

`chunkcost.mjs` (parent directory) runs the **real** part generators — two giants' and two seated columns'
near bases, and all 61 of their near-canopy lobes and limbs — through the same in-memory TypeScript loader
the unit tests use, timing every chunk between yields. No renderer, so a diagnosis costs seconds instead
of the ten minutes a play-mode probe costs.

    node art/environment/squad2-2026-09-23/chunkcost.mjs --repeat 5 --top 10

Five builds a part, **median per chunk**: one build times the JIT warming up as if it were a chunk (in two
single-build runs the largest single reading moved from one part's chunk 3 to a different part's, 7.9 and
7.4 ms — neither repeatable). With medians the picture is stable, and it is the same for every part:

| chunk | count | p50 | p95 | max | sum | share of the builder |
| --- | --- | --- | --- | --- | --- | --- |
| the parts' own geometry | 2196 | 0.10 | 0.47 | 1.90 | 312.9 ms | 76.1 % |
| `position/color/uv` packed | 65 | 0.22 | 0.71 | 0.85 | 14.9 ms | 3.6 % |
| `aWind/aRoot` + index packed | 65 | 0.31 | 1.02 | 1.28 | 19.8 ms | 4.8 % |
| **`computeVertexNormals`** | **65** | **0.81** | **2.79** | **3.23** | **55.6 ms** | **13.5 %** |
| seams and bounds | 65 | 0.13 | 0.29 | 0.39 | 8.2 ms | 2.0 % |

**three's `computeVertexNormals` was the longest chunk of all 65 parts** — one call, unsplittable, 8× the
median chunk — and it held the top four places in the whole 2456-chunk list:

| ms | what it is | part |
| --- | --- | --- |
| 3.23 | `computeVertexNormals` | `column-1-base` |
| 2.98 | `computeVertexNormals` | `giant-1-base` |
| 2.83 | `computeVertexNormals` | `giant-0-base` |
| 2.79 | `computeVertexNormals` | `column-0-base` |
| 1.90 | the relief bole's 4 rings | `column-1-base` |

This box is ≈ 2.8× the capture box: `tiers/` §2e reported `giant-near-base/north-west` spending 5.5 ms on
its **first** chunk, and the bole's first chunk measures 1.99 ms here — so the 3.23 ms normals chunk is
≈ 9 ms there, on a 3 ms budget.

## 2. The change: the same call, chunked, bit-identical

`writer.ts` `vertexNormalSteps` is `BufferGeometry.computeVertexNormals` split at
`VERTEX_NORMAL_FACES_PER_STEP` (1024) faces and `VERTEX_NORMAL_VERTICES_PER_STEP` (4096) vertices, and
`finishSteps` yields between its chunks.

**Identical, not equivalent.** The same face loop in the same triangle order, the same `Vector3` methods,
and the same accumulate-through-the-`Float32Array` three does — read the running normal, add the face
normal, round back to float32 with `setXYZ`. A float64 accumulator, or `x / len` where three writes
`x * (1 / len)`, would change the bytes. The loops sit in plain functions rather than the generator body,
because a generator's body is slower per iteration and this pass must not cost more in total than the one
call it replaces.

`lodPool.test.mjs` pins it against three's own call on **real** tree geometry — a giant's near base (wood,
no authored normals) and a near-canopy lobe (leaf cards, authored normals) — byte for byte, and checks the
split really happened. A geometry with no index keeps three's own path rather than a second copy of it.

| | before | after |
| --- | --- | --- |
| chunk p95, all parts | 0.63 ms | **0.35 ms** |
| chunk max, all parts | 3.23 ms | **1.99 ms** (the bole's 4 rings) |
| chunks over a 3 ms budget | 1 of 2456 | **0 of 3163** |
| the normals' own cost | 55.6 ms | **38.3 ms** (face 33.9 + normalise 4.5) |
| whole build p50 / max | 6.12 / 30.1 ms | 5.79 / 30.8 ms |

The normals got **cheaper** (−31 %) as well as smaller: a plain loop in a plain function, monomorphic on
one geometry's attributes, beats the shared method. Whole builds are unchanged within run noise.

## 3. The frames: five poses, md5-identical

Every tree geometry in the world goes through `finish()` → `finishSteps()`, so a wrong normal would show
up everywhere. `frozen.mjs` (clock stopped, the protocol in `settle/`) against the recorded baselines of
the same commands on `b9eae120`:

| pose | draws / triangles | md5 |
| --- | --- | --- |
| A_stairs (the binding fixed view) | 575 / 8 631 286 | `a280badd…` **identical** |
| the flight's foot, play-mode follow | 544 / 9 129 709 | `9ce108b2…` **identical** |
| plateau-north | 456 / 6 246 699 | **identical** |
| plateau-back | 702 / 10 895 532 | **identical** |
| ledge-look-south | 635 / 11 046 057 | **identical** |

    node art/environment/squad2-2026-09-23/frozen.mjs dist chunks/frames-A --views A_stairs --poses depthfoot/foot-pose.json
    node art/environment/squad2-2026-09-23/frozen.mjs dist chunks/frames-lookbacks --poses lookbacks/poses.json

## 4. The rest of `finishSteps`, and the walk's verdict — including what did NOT improve

The normals were the longest chunk but not the last one. Instrumenting the pool to keep the worst
chunks **with the item and the chunk's index** (temporary, removed before the commit) and walking the
small tier showed them clustered at the **end** of every near-canopy lobe's build — indices 56–64 of
~64, 2.5–3.5 ms — which is `finishSteps` packing five attributes of 100–300 k floats each in two
chunks. `packSteps` chunks that copy too, at 8192 floats, the same float32 conversion of the same
values in the same order.

`tiers/walkpool.mjs` on `?pool=small` — placed in the plaza, `KeyW` held, 600 frames at 1/30 s, the
pool read every 60 — for all four builds, at 600 frames:

| | before | normals chunked | + first-chunk predictor | + packing chunked (shipped) |
| --- | --- | --- | --- | --- |
| chunks run | 7 925 | 9 743 | 8 692 | 11 221 |
| chunk p50 / p95 | 0.1 / 0.7 | 0.1 / 0.3 | 0.1 / 0.3 | 0.1 / **0.3** |
| **worst chunk in a frame** | 9.0 | 9.8 | 14.2 | **6.9** |
| **a whole build, p50 / p95** | 6.6 / 13.4 | 6.5 / 10.4 | 7.4 / 12.6 | **6.3 / 9.9** |
| `work` p95 | 6.4 | 7.0 | 6.5 | **7.3** |
| calls over the 3 ms budget (of 600) | 19 | 34 | 20 | **35** |
| parts built / still pending | 262 / 144 | 262 / 143 | 240 / 144 | 250 / 143 |
| `syncBuilds` / `pinnedPending` | 63 / 0 | 63 / 0 | 63 / 0 | 63 / 0 |

**What improved.** A whole build's p95 **13.4 → 9.9 ms (−26 %)** and its median 6.6 → 6.3 — that is the
number a **pin** pays synchronously, and the number the reset path pays 63 times at a teleport (~0.19 s
off a ~0.5 s hitch on the weakest device). The worst single chunk inside a frame **9.0 → 6.9 ms**. The
chunk p95 **0.7 → 0.3 ms**. Nothing the frame draws was ever unbuilt: `syncBuilds` sits at 63 and
`pinnedPending` at 0 in every sample of every run.

**What did not, and why.** `workMsP95` **6.4 → 7.3 ms** and the calls over budget **19 → 35**. Smaller
chunks let a call fill its 3 ms budget more completely, so its last chunk starts nearer the edge — and
with `STEP_TOLERANCE_MS` at 1 ms, a 1.5–2 ms chunk starting at 2.9 ms is counted as an overrun. The
pool is doing more of its work inside the budget and overshooting at the end of it rather than
declining early. Parts built also fell 262 → 250 (−4.6 %) with `pending` unchanged, which is the
predictor's price: it will not BEGIN a build at the edge of a budget.

**The middle step was measured and kept for a reason.** Chunking the normals alone took the overruns
**19 → 34**: with most chunks tiny, the median-of-all-chunks estimate under-priced a fresh item's first
chunk by an order of magnitude. Pricing that one case from the last builds' first chunks took it back
to 20. This is not round 48's rejected pessimism (`tiers/` §2e): being pessimistic about every chunk
adds mandatory first steps, while declining to *begin* a build late in a call moves that same first
chunk to the front of a later call, where the progress guarantee was going to pay for it anyway. The
test `work will not BEGIN a build at the edge of its budget` pins the mechanism.

## 5. The answer to §2e's open question: the 3 ms budget is not a scheduling problem

`tiers/` §2e ended "the lever is not the estimator but the progress guarantee". Having now moved both
the estimator and the chunks, the honest answer is **neither**: no estimator can hide a chunk bigger
than the whole budget, because the first chunk of a call runs regardless — and chunks bigger than the
budget are still in there. What remains, from the instrumented walk:

| ms | part | chunk |
| --- | --- | --- |
| 6.9 | `giant-near-canopy/north-east/limb-24` | 8 |
| 6.5 | `giant-near-canopy/north-west/lobe-5` | 73 |
| 6.3 | `column-near-canopy/seat-2/lobe-1` | 19 |
| 6.0 | `giant-near-canopy/north-east/lobe-10` | 76 |
| 5.8 | `giant-near-canopy/plateau-oak/lobe-26` | 72 |
| 4.4 | `giant-near-canopy/south-giant/lobe-19` | 5 |

Two populations, and they want different fixes:

- **Late indices (65–79 of ~81)** are what is left of `finishSteps`: `setIndex`, the one operation in
  it still unchunked (three scans the index for `>= 65535`, then copies into a `Uint16`/`Uint32Array`).
  Node measures it at 0.73 ms, ≈ 2 ms here, and the 2.1–3.7 ms readings at those indices are its shape.
- **Scattered indices (5, 8, 19, 22–36)** are the near-canopy **geometry** generators — a lobe's twig
  sprays, a limb's vine and beard rows — at 4–7 ms, 2× the whole budget. `chunkcost.mjs` cannot see
  these: the authored plaza giants' lobes are bigger than anything its synthetic trees build (its
  largest geometry chunk is 1.74 ms), which is the harness's limit, stated so nobody trusts it too far.

Part of that tail is not work at all: the builds are deterministic, yet the same part's long chunks land
at **different indices between rebuilds** (`plateau-oak/lobe-26` at 22, 24, 29, 31 and 72 in one walk),
so GC and scheduling are in these readings. The reproducible part is the index that recurs.

**Next lever, named:** chunk `setIndex` in `finishSteps`, then the yield granularity inside
`nearCanopy.ts`'s `nearSpray` / `twiglets` / limb rows. Until a chunk's worst case is under the budget,
`workOverBudget` cannot go to zero, and `workMsP95` will sit at budget + one chunk.

## 6. A long chunk or a long pause? (the round after, same day)

§5 named two populations and guessed at each. Both are measured now. Node's GC observer runs over the
same 65 parts (`chunkcost.mjs`, unchanged workload):

**251 collections, 220 ms of pause against 2013 ms of building — 11 % of the builder's wall clock.**

| chunks | count | p50 | p95 | max |
| --- | --- | --- | --- | --- |
| all readings | 19 590 | 0.06 | 0.30 | 2.82 |
| **those a collection landed in** | 186 | **1.08** | **1.94** | **2.82** |
| those with no collection in them | 19 404 | 0.05 | 0.24 | 1.90 |

A chunk a collection lands in reads **20× the median** of one that escapes it, and **every one of the
eight longest readings** had a pause inside it worth 0.8–1.4 ms of its 2.0–2.8. So the scattered
population is not work, no amount of chunking removes it, and that is why §4's finer chunks did not
move `workMsP95`. It agrees with what the browser said from the other side: the builds are
deterministic, yet the same part's long chunks land at different indices between rebuilds.

**What was work, and is now chunked.** `setIndex`, the last operation in `finishSteps` that was still
one call: its chunk goes **0.73 → 0.33 ms** and the whole `aWind/aRoot` + index group 12.4 → 7.3 ms.

**Two allocation cuts**, against `node --trace-gc` over an identical workload (run-to-run spread 2 %):

| | collections | garbage | pause |
| --- | --- | --- | --- |
| before this round (`605b81cf`) | 264 | 4719 MB | 256 ms |
| + `addLeaf` on scratch objects | 247 | 4445 MB | 254 ms |
| + no second typed-array copy | **241** | **4342 MB (−8 %)** | **241 ms (−6 %)** |

`addLeaf` allocated ~15 short-lived objects per lamina — eight points, four colours, three frame
vectors — and a near-canopy lobe carries over a thousand laminae. They are module scratch now, safe
because `writer.vertex` copies the components out, so none is held across a call. `packSteps` and
`indexSteps` return a `BufferAttribute` over the array they just filled instead of a
`Float32BufferAttribute`/`Uint32BufferAttribute` that copies it again (three's own `mergeGeometries`
returns plain `BufferAttribute`s too, and the renderer picks the GL type from `array.constructor`).

**Bit-identity, in seconds instead of ten minutes.** `bitcheck.mjs` builds the same 75 geometries —
the merged far trees and every pooled near part, **741 103 triangles** — from any checkout and md5s
every buffer. A worktree at `605b81cf` and this tree both give `TOTAL 9fc119c64da990ab83caf7625ce98b6d`.
The frames agree: A_stairs **575 / 8 631 286 md5 `a280badd…`** and the flight's foot **544 / 9 129 709
md5 `9ce108b2…`**, both identical.

**And a methodological result worth more than the numbers.** The walk cannot resolve changes of this
size. Its tail metrics move as much between identical-code runs as between builds, because the tail
*is* the pause:

| at 600 frames | before the branch | + packing | + this round |
| --- | --- | --- | --- |
| `work` p95 | 6.4 | 7.3 | 6.9 |
| calls over the 3 ms budget | 19 | 35 | 30 |
| worst chunk in a frame | 9.0 | 6.9 | 10.1 |
| a whole build, p50 / p95 | 6.6 / 13.4 | 6.3 / 9.9 | 6.2 / 11.7 |
| parts built | 262 | 250 | 255 |
| `syncBuilds` / `pinnedPending` | 63 / 0 | 63 / 0 | 63 / 0 |

`stepMsMax` reads 6.9, 9.0, 9.8, 10.1 and 14.2 across five runs of code that differs in ways that
cannot produce a 7 ms chunk. **The instrument for this work is the Node harness** — a fixed workload,
five builds a part, medians, and the collector under observation — with the browser kept for what only
it can answer: that the frame is the same bytes.

**Named for next time, with its blast radius.** The builder's real allocator is `GeometryWriter`'s
growing `number[]`s — `positions`, `colors`, `uvs`, `winds`, `roots`, `indices`, about **14.5 MB a
build**, of which the leaf vectors were only 6 %. A lobe's five attributes hold ~90 000 doubles (720 KB)
and double their way there, then get copied to float32. Writing into typed buffers from the start would
take most of the remaining garbage and halve the bytes. It reaches outside this lane: `writer.ts` has
14 sites, `giant.ts` reads `leaves.positions.length / 3` in four places and `splice`s three values in
one (a plain overwrite), while `whitebark.ts`'s in-place uv and colour rewrites work unchanged on a
typed array. `bitcheck.mjs` makes it verifiable in seconds, but it wants the owning lanes' agreement,
not a unilateral edit.

## 7. Naming the allocators, and an 89 % cut on the path every tree walks

§6 ended with an estimate of where the garbage comes from. `allocprof.mjs` replaces the estimate: V8's
sampling heap profiler, through the inspector session Node already has, attributing every sampled
allocation to the function that made it.

**The flag that makes it useful:** without `includeObjectsCollectedByMajorGC` and
`…MinorGC`, `getSamplingProfile` reports only what **survived** — for a builder that is 0.23 MB against
the 4.3 GB `--trace-gc` sees. With them, 1916 MB over 65 parts × 3 builds:

| MB | share | function |
| --- | --- | --- |
| 557.6 | 29.1 % | `GeometryWriter.vertex` |
| 296.9 | 15.5 % | `Array.push` |
| 187.8 | 9.8 % | `Curve.getPoint` (three) |
| 172.2 | 9.0 % | `addLeaf` |
| 99.0 | 5.2 % | `cordField` (bole.ts) |
| 67.1 | 3.5 % | `reliefBoleSteps` |

The first two are the writer's growing `number[]`s — the cross-lane refactor §6 named, still deferred.
The third is reachable from inside `writer.ts` alone, and it turned out to be worth far more than its
share suggested, because `growthPath` is called for **every stem, secondary, twig and twiglet of every
tree in the world** while this fixture builds only four trees.

**But the profiler's bytes cannot be trusted at this resolution.** After the first fix removed 201
throwaway vectors per call, `getPoint` kept its 9 % share while `init` vanished and two
`BufferAttribute` getters appeared — attribution shifting under inlining. So `pathgarbage.mjs` settles
such questions instead: one code path, 40 000 calls, the same seeds, count the megabytes.

| `growthPath`, 40 000 calls | garbage | per call |
| --- | --- | --- |
| `605b81cf` (before this round) | 3384.4 MB | 86.6 KB |
| `spacedPoints` reuses the table, vectors and curve | 2659.4 MB | 68.1 KB |
| **+ the cubic evaluated in local variables** | **383.9 MB** | **9.8 KB (−89 %)** |

A control path (`addLeaf`, unchanged this round) moved 2.3 % between the same two builds, which is this
measurement's noise floor.

**What the two fixes are.** `getSpacedPoints` re-derives the arc-length table on every call: 201 samples
with no target vector, a fresh cache array, and a new `CatmullRomCurve3`. `spacedPoints` keeps three's
algorithm exactly — the same 200-sample cumulative table summed in the same order, the same binary
search, the same segment interpolation — and reuses all three.

The rest was **boxing**. three's `CubicPoly` holds its four coefficients in closure variables, and V8
heap-allocates a double assigned to a captured variable, so `getPoint` cost ~240 bytes a call — twelve
coefficients and three components — which over 206 samples is **49 KB a path**. `curvePoint` and
`cubicAxis` do the same arithmetic in the same order in local variables, where the doubles stay in
registers.

**Bit-identical** through both: `bitcheck.mjs`'s 75 geometries and 741 103 triangles hash to
`TOTAL 9fc119c64da990ab83caf7625ce98b6d` before and after, and the frames agree on the final code —
A_stairs **575 / 8 631 286 md5 `a280badd…`** and the flight's foot **544 / 9 129 709 md5 `9ce108b2…`**
(`frames-A4/`). `growthPath` is used by every tree builder, so the frame is the check that matters.

**What is left on that path:** 9.8 KB a call, of which `growthPath`'s own six `clone()`s and the
returned points are most. The `_arcLengths` table still churns a little because `length = 0` lets V8
trim the backing store; a fixed `Float64Array` and an inlined `uToT` would take the rest, and are worth
the next five minutes rather than an hour.

### 7a. What it is worth where it matters, and where it is worth nothing

**The runtime builder** — the 65 pooled parts the near-LOD pool builds while the player walks, which is
exactly the workload §6 showed the frame budget losing to the collector:

| the pool's builds (65 parts × 5) | collections | garbage | pause |
| --- | --- | --- | --- |
| before the branch | 264 | 4719.3 MB | 255.9 ms |
| round 2 (leaf scratch, no double copy) | 241 | 4342.5 MB | 241.3 ms |
| + `spacedPoints` reuse | 239 | 4275.2 MB | 274.0 ms |
| **+ the inline cubic** | **205** | **3785.2 MB (−19.8 %)** | **226.6 ms (−11.4 %)** |

**A fifth less garbage and 11 % less pause** in the builder whose pauses are the frame-budget tail.

**The world build: nothing measurable.** Three runs each, one Chrome at a time (in parallel the builds
inflate to 56 s and the noise doubles), reading `__ZR__.perf().buildMs` and the trees' `buildPhases`:

| median of 3 | before | after | runs |
| --- | --- | --- | --- |
| trees | 8395 ms | 8367 ms | 8365–9176 → 8166–8855 |
| the whole build | 44 852 ms | 46 508 ms | 44 217–48 467 → 44 410–47 927 |
| giants | 4955 ms | 5013 ms | — |
| white-barks | 931 ms | 844 ms | — |

**−28 ms on an 8.4 s phase whose runs span 700 ms is not a result**, and the whole build reading +1.7 s
is the same noise from the other side (nothing on this branch touches vegetation or terrain, which moved
+198 and +977 ms in the earlier paired run). The owner's "trees load in ASAP" is not answered by this
change: the allocation it removes is cheap in wall clock next to the arithmetic and the canvas work
around it. What it does buy is the runtime table above.

## 8. The last of that path, and what four rounds of it are actually worth

Three things §7 named and left: the arc-length table was a plain array reset with `length = 0`, which
lets V8 trim the backing store so every path re-grew it (a `Float64Array` with its used length carried
separately now); `uToT` was a closure, an allocation per path (a module function now); and
`growthPath`'s six `clone()`s are scratch, with the three inner control points written straight into the
reused curve. `frame` gained a `frameInto` variant for hot paths — the same two cross products.

| `growthPath`, 40 000 calls | garbage | per call |
| --- | --- | --- |
| `5b5cbed8` (before the curve work) | 3384.4 MB | 86.6 KB |
| `spacedPoints` reuse | 2659.4 MB | 68.1 KB |
| + the inline cubic | 383.9 MB | 9.8 KB |
| **+ this round** | **193.8 MB** | **5.0 KB (−94 %)** |

The harness's own per-iteration floor is ~4 KB, so what is left of `growthPath`'s own allocation is
about **1 KB of the 82** it started with.

### Where that lands, at three scales

**Tree creation** (`chunks/treecost.mjs`, four trees with every lobe, limb, bole and root they register,
five runs) is the phase the branch paths are drawn in:

| | collections | garbage | pause | wall clock (median) |
| --- | --- | --- | --- | --- |
| `5b5cbed8` | 319 | 5648.6 MB | 418.0 ms | 1025.22 ms |
| now | **268** | **4804.1 MB (−15 %)** | 403.5 ms | **1027.36 ms** |

**−15 % of the garbage and −16 % of the collections, and no time at all** — 1025 → 1027 ms inside a run
spread of 890–1310. The allocation was cheap in wall clock. What it costs is pauses.

**The pool's builds** do not move with it (3785 → 3795 MB, noise): a pooled part rebuilds leaves and
bark far more than branch paths. Their own totals across the branch: **4719 → 3785 MB (−20 %)**,
collections 264 → 204, pause 256 → 227 ms.

**The world build** does not move either (§7a: trees 8395 → 8367 ms against a 700 ms run spread).

### The closing measurement: the frame budget, after all of it

The whole arc, on the walk it was aimed at (`?pool=small`, plaza, `KeyW` held, 600 frames at 1/30 s):

| at 600 frames | before | normals | +predictor | +packing | +setIndex/leaf | **+curve (head)** |
| --- | --- | --- | --- | --- | --- | --- |
| **a whole build, p50** | 6.6 | 6.5 | 7.4 | 6.3 | 6.2 | **5.4 (−18 %)** |
| **a whole build, p95** | 13.4 | 10.4 | 12.6 | 9.9 | 11.7 | **10.6 (−21 %)** |
| chunk p95 | 0.7 | 0.3 | 0.3 | 0.3 | 0.2 | **0.2** |
| `work` p95 | 6.4 | 7.0 | 6.5 | 7.3 | 6.9 | 7.0 |
| calls over the 3 ms budget | 19 | 34 | 20 | 35 | 30 | 31 |
| worst chunk in a frame | 9.0 | 9.8 | 14.2 | 6.9 | 10.1 | **16.1** |
| parts built | 262 | 262 | 240 | 250 | 255 | 262 |
| `syncBuilds` / `pinnedPending` | 63 / 0 | 63 / 0 | 63 / 0 | 63 / 0 | 63 / 0 | 63 / 0 |

**What improved is the builder's own cost**: a whole build — what a pin pays synchronously and what the
reset path pays 63 times at a teleport — is **18 % cheaper at the median and 21 % at the p95**, with the
prefetch back to its original 262 parts and nothing the frame draws ever unbuilt.

**What did not improve is the frame budget**, and after four rounds the reason is not in doubt: the
worst chunk in a frame reads 6.9, 9.0, 9.8, 10.1, 14.2 and 16.1 ms across six runs of code that cannot
produce a 7 ms chunk, while the chunks themselves are p95 **0.2 ms**. The tail is a **collector pause**,
its size set by the whole page's allocation rather than the trees' share of it, and this lane removed
20 % of the trees' share without touching that. `workMsP95` is budget + one tail event, so it sits at
6.4–7.3 ms throughout.

That is the honest end of this thread: **the builder got materially cheaper and the frame budget did
not**, and the next thing that could move it is not in `trees/`.

### What is left in the leaf path, and why this lane stops here

`addLeaf` is the other allocator reachable from `writer.ts`. Profiled on its own, 200 000 laminae:

| B per lamina | share | where |
| --- | --- | --- |
| 3261 | 73.7 % | `GeometryWriter.vertex` — the growing `number[]`s |
| 893 | 20.2 % | `addLeaf` itself: three closures per lamina (`localPoint`, `lift`, `V`) |
| 77 | 1.7 % | `V` |

The 893 bytes could go, but not cleanly: **V8 boxes a double assigned to a context slot or an object
field** — that is the same mechanism the `CubicPoly` fix exploited — so hoisting those closures means
keeping the lamina's five scalars in a `Float64Array` with magic indices in a file five other builders
share. For **3.8 % of the pool's garbage**, in a round whose 20 % did not move any frame number above
noise, that trade is not worth taking. It belongs with the writer's arrays (73.7 % here, 44.6 % overall)
in one deliberate change, with the owning lanes' agreement, which is where §6 left it.

## Files

- `chunkcost.mjs` (parent) — the chunk timer; `--repeat`, `--top`, `--json`.
- `before.json` / `after.json` / `after2.json` — every part's chunk list at each step.
- `frames-A/`, `frames-lookbacks/`, `frames-A2/`, `frames-lookbacks2/` — §3's md5 runs, the second pair on the final code (`counts.json` each; the PNGs are regenerable from the commands above and are not committed — the two A_stairs files, rendered ten minutes and three commits apart, were the same bytes).
- `walk-before.json`, `walk-after.json` (normals), `walk-after2.json` (+ predictor), `walk-after3.json` (+ packing), `walk-after4.json` (+ §6) — §4 and §6.
- `bitcheck.mjs` — the same 75 geometries md5'd from any checkout (`--root`), so "changes nothing" is checkable while it is being written.
- `gc-before.log` / `gc-after.log` — `node --trace-gc` over the identical workload, the garbage tables of §6 and §7a.
- `allocprof.mjs` — V8's sampling heap profiler by function (remember the two include flags); `alloc-before.json`.
- `pathgarbage.mjs` — one code path, 40 000 calls, two checkouts: what settles an allocation question.
- `fixture.mjs` — the one copy of the no-browser fixture `chunkcost`, `bitcheck` and `allocprof` share.
- `buildphases.mjs`, `buildphases-{before,after}.json` — the world build per system and per trees phase (§7a).
- `after3.json` — the chunk lists with `setIndex` chunked and the leaf path on scratch.
- `tiers/walkpool.mjs` now takes `--dist` and `--out`, so two builds can be walked in one session.
