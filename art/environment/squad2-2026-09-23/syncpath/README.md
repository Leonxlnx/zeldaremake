# The pinned path, attributed properly: it is the world BUILD, not the frame

> **§6 corrects §1–§5.** The 76 pin-forced finishes are not a per-frame cost: **63 of them have already
> happened when the world finishes loading, before a single frame is rendered.** They are the build's own
> first `rebucket`, which `framecost/` §1 already priced at 550 ms. Walking adds **single digits**. The
> headline below — "the pool's frame cost is the pinned path" — is withdrawn; read §6 first.

Lane 2, 2026-09-29, head `3961630f`. **No code changed** — this is the first reading of the metric
`poolpredict/` §7 added, and it answers the question that round ended on.

`poolpredict/` §7 closed by saying: *"decide first whether the pool's frame cost is dominated by the
budgeted path or the pinned one"*, because `recordStep` has exactly one call site — inside `work` — so
three rounds of scheduler measurement had been reading the budgeted half and calling it the total. The
metric went in (`syncMsP95`, `syncMsMax`). This is what it says.

## 1. One walk, both paths

The same 32-frame walk, `perf().systemPerf.trees.nearCanopyPool`:

| the budgeted path (`work`, `NEAR_LOD_BUILD_BUDGET_MS = 6`) | |
| --- | --- |
| work p95 | **6.6 ms** |
| calls over budget | 2 |
| worst chunk | 7.6 ms |
| chunks over 12 ms | 0 |

| the pinned path (`pin`, no budget at all) | |
| --- | --- |
| **`syncMsP95`** | **13.0 ms** |
| **`syncMsMax`** | **25.3 ms** |
| **pin-forced finishes** | **76** |

And the whole-build numbers corroborate it: `buildMsP95` **11.8 ms**, `buildMsMax` **25.3 ms** — the worst
build and the worst pinned finish are the same 25.3 ms, i.e. that build ran start to finish inside one
frame under a pin.

**The budgeted path behaves.** 6.6 ms against a 6 ms budget, two calls over it, nothing long. Every
scheduler round on this branch was tuning *that*.

**The pinned path is twice the whole budget at the p95 and four times it at the worst**, and it ran 76
times in 32 frames. `pin` finishes an unbuilt item by running every remaining chunk in one loop — there is
no budget on that path, by design: the part is needed *now*, so it is built now.

## 2. What that means, and the caveat it needs

Multiplied out, 76 finishes at a 13 ms p95 is about **1 000 ms of synchronous building across 32 frames**
— of the order of **31 ms a frame**, against 6 ms of budgeted work. Even allowing generously for
overlap and for the p95 overstating the median, **the unbudgeted path is the pool's frame cost and the
budgeted one is a rounding error beside it.**

**The caveat, stated up front because it is large.** This walk moves the camera with `setPose`, about
1.2 m a frame, and `framecost/` §3 established that every `setPose` fires `onCameraMove`, which runs
`nearCanopyUpdate` with `reset = true` and pins the newly shown parts immediately. A player moving
continuously brings parts into the shown set gradually, with `work(6)` running every frame in between,
so **76 is an upper bound on the count.**

What is *not* a harness artefact is the **size** of one pinned finish. 13 ms at the p95 and 25.3 ms at the
worst is what a near-canopy part costs when it is wanted before it is ready, and it lands whole in one
frame however the camera got there. At 30 fps that is 40 % to 76 % of the frame.

## 3. Why this was invisible, and what it supersedes

`stepMsP95`, `stepMsMax` and `longSteps` describe `work`'s chunks only. On this walk they read
**0.5 / 7.6 / 0** — a tidy picture of a pool comfortably inside its budget — while the same walk put a
25.3 ms build into a single frame. Three rounds of `poolpredict/` argued about whether a 10.4 ms `work`
call could be scheduled down to 7; the pinned path was doing worse than that 76 times and no metric
reported it.

It also supersedes this lane's own summary line. The PR's §12 says the pool's budgeted work "peaks at
10.4 ms against its 6 ms budget" and offers that as the per-frame cost of the trees' LOD machinery. That
is the smaller half. **The honest sentence is: the budgeted path runs a 6–7 ms p95, and the pinned path
runs a 13 ms p95 with a 25 ms worst.**

## 4. The three ways out, sized but not built

All three trade against each other, and none is a one-line change, so they are written down:

1. **Build sooner** — a larger `NEAR_CANOPY_PREFETCH_M`, so fewer parts are still unbuilt when they are
   pinned. Costs pool memory and moves CPU earlier; `outlook/` §7 already found the tier saturated at 79
   parts with 77–100 % outside the frame, so a wider prefetch buys the fix by building even more that is
   never seen.
2. **Build faster** — a larger `NEAR_LOD_BUILD_BUDGET_MS`. The cheapest of the three, so **§5 measured
   it**: it relabels the cost rather than removing it.
3. **Do not finish under a pin at all** — let the crown keep its folded far form until the build
   completes, instead of guaranteeing residency the moment it is pinned. This removes the hitch
   completely and pays for it with a late swap, which is precisely the thing the owner complained about
   (*"why don't the trees immediately spawn instead of needing me to get close"*, quoted in
   `trees/index.ts` beside the hysteresis). **A look call, not an optimisation.**

Whichever is tried, the measurement to run it against is now in the report, and it wants more than one
walk a side.

---

## 5. Option 2 measured: a bigger budget moves the cost, it does not remove it

`NEAR_LOD_BUILD_BUDGET_MS` **6 → 12**, one constant in `trees/index.ts`, three head walks against two
variant walks with the last two pairs run **concurrently** so each pair shared the machine:

| run | work p95 | `syncMsP95` | `syncMsMax` | `buildMsMax` | sync finishes | parts built |
| --- | --- | --- | --- | --- | --- | --- |
| head 1 | 6.6 ms | 13.0 | 25.3 | 25.3 | 76 | 266 |
| head 2 (pair 1) | 7.0 ms | 16.1 | 20.7 | 34.2 | 77 | 261 |
| head 3 (pair 2) | 8.8 ms | 16.6 | 27.3 | 36.9 | 77 | 262 |
| **budget 12 a** (pair 1) | **13.4 ms** | 8.7 | 15.2 | 19.2 | **64** | **270** |
| **budget 12 b** (pair 2) | **16.8 ms** | 14.1 | 24.0 | **51.5** | **69** | **272** |

**Two things repeat.** Every variant run finishes **fewer parts under a pin** (64, 69 against 76, 77, 77)
and **completes more parts** over the same walk (270, 272 against 261, 262, 266): with twice the budget the
pool keeps up better, which is the **"trees load in ASAP"** axis. And every variant run pays for it on the
budgeted path, p95 **13.4–16.8 ms against 6.6–8.8 ms** — which is not a surprise, it is the budget.

**And the thing that matters most does not improve.** The pinned path's magnitude overlaps (`syncMsP95`
8.7–14.1 against 13.0–16.6) and the **worst single build landing in one frame is noisy in both
directions**: 19.2 ms in one variant run and **51.5 ms** in the other, against 25.3–36.9 on the head. So
raising the budget **converts unbudgeted hitches into budgeted ones of similar size** — a 13–17 ms
budgeted p95 where there was a 13–17 ms unbudgeted one — while the tail stays where it was.

**Not shipped.** What it buys is fill rate, which is real and which the owner has asked for twice; what it
costs is a routine per-frame cost that doubles. That is a look-and-feel trade for the owner, not a free
optimisation, and it is the second time this branch has found that the pool's scheduling levers move cost
around rather than reducing it (`poolpredict/` was the first).

**Which leaves option 3 as the only one that removes the hitch instead of moving it**: do not finish under
a pin — let the crown hold its folded far form until the build completes. It pays with a late swap, which
is the owner's own complaint, so it needs his eye rather than another measurement.

## 6. Correction: 63 of the 76 are gone before the first frame

§1 read 76 pin-forced finishes over a 32-frame walk and called the pinned path the pool's frame cost. Two
checks say otherwise.

**First, the count barely depends on the walk.** The same 32 renders with **4** pose jumps instead of 32 —
`setPose` is the only thing that fires `onCameraMove`, and `nearCanopyUpdate`'s `if (reset)` block is the
only place that pins *unbuilt* candidates — gives **69 finishes against 76**. If the jumps caused them, four
jumps could not produce nine tenths of the count.

**Second, and decisively: read the counter with zero renders.** Straight after `__ZR__.ready()`, before any
frame at all:

| | `syncBuilds` | `syncMsP95` | `syncMsMax` | `built` | `workMsP95` |
| --- | --- | --- | --- | --- | --- |
| **after load, 0 renders** | **63** | 7.6 ms | 8.0 ms | 265 | 0.1 (no `work` call yet) |
| after 1 render | 63 | 7.6 | 8.0 | 265 | 8.3 |
| **after 31 renders, no pose jump** | **63** | 7.6 | 8.0 | **269** | 8.7 |

That third row is the cleanest statement of it: **thirty-one frames of rendering added not one synchronous
build** — the counter sits at 63 throughout — while the budgeted path quietly finished four more parts.

**All 63 happen inside `trees.create()`**, in the build's own `rebucket(ctx.camera, true)` → `nearCanopyUpdate(reset = true)`, which pins every candidate so an explicit pose draws the same parts whether the pool was cold or warm. That call is `framecost/` §1's **550 ms**, and 550 / 63 ≈ 8.7 ms a part matches the 7.6 ms p95 above. The pool is already full at load: `built` **265**.

So the walk adds **6 to 14** pin-forced finishes over 32 frames, not 76 — and `chunks/`'s constant
`syncBuilds` of **63** across four different columns was telling anyone who looked that this number is a
property of startup, not of walking.

### What this means for §1 and §5

- **§1's headline is withdrawn.** The pool's *per-frame* cost in play is the budgeted path at a
  **6.6–8.8 ms p95**, plus a handful of pin-forced finishes when the player outruns the prefetch. The
  13–17 ms `syncMsP95` figures are dominated by the load-time fill.
- **§5's "fewer parts finished under a pin" shrinks accordingly.** 64 and 69 against 76, 77, 77 is mostly
  the same 63-part fill plus a different handful, so the budget's effect there is a few finishes, not a
  dozen. What survives from §5 is what was repeatable for another reason: **more parts completed** (270,
  272 against 261, 262, 266) and a **doubled budgeted p95** (13.4–16.8 against 6.6–8.8).
- **Option 3 in §4 was already the shipped behaviour** and I should have read the code before proposing
  it: `nearCanopyUpdate` builds its shown set with `.filter(resident)`, and only *shown* lobes fold their
  far laminae, under the comment *"A walking camera keeps far foliage for parts still queued through
  work()'s frame budget."* A walking player already keeps the far form until the near part is ready. The
  synchronous finish exists **only** on the reset path, and it is there on purpose, for the capture
  contract.

### The pattern, stated so it stops repeating

Three times on this branch a pool or bucketing number has been read as a play cost when it belonged to the
reset path: `framecost/` §2's 22.1 ms frame (corrected in §7), §1 here, and §5's reading of the budget. The
reset path runs on the build's first call and on every explicit pose jump, which is exactly what a probe
does every frame. **Before attributing any pool number to play, read it with zero renders first** — that
one call would have caught all three.

## Files

- `walk.json` — §1's run. `jump4.json` — the four-jump control. `at-load.json` — §6's zero-render reading.
- `h2.json`, `h3.json`, `b12a.json`, `b12b.json` — §5's runs.

---
