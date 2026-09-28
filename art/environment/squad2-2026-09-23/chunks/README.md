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

## Files

- `chunkcost.mjs` (parent) — the chunk timer; `--repeat`, `--top`, `--json`.
- `before.json` / `after.json` / `after2.json` — every part's chunk list at each step.
- `frames-A/`, `frames-lookbacks/`, `frames-A2/`, `frames-lookbacks2/` — §3's md5 runs, the second pair on the final code (`counts.json` each; the PNGs are regenerable from the commands above and are not committed — the two A_stairs files, rendered ten minutes and three commits apart, were the same bytes).
- `walk-before.json`, `walk-after.json` (normals), `walk-after2.json` (+ predictor), `walk-after3.json` (+ packing) — §4.
- `tiers/walkpool.mjs` now takes `--dist` and `--out`, so two builds can be walked in one session.
