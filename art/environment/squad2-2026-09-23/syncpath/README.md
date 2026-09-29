# The pool's frame cost is the pinned path, not the budgeted one

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
2. **Build faster** — a larger `NEAR_LOD_BUILD_BUDGET_MS`. Raises the budgeted path's honest cost to
   remove an unbudgeted one that is twice as large; this is the cheapest experiment of the three and the
   one I would measure first, with **repeats**, after this branch's lesson about single runs.
3. **Do not finish under a pin at all** — let the crown keep its folded far form until the build
   completes, instead of guaranteeing residency the moment it is pinned. This removes the hitch
   completely and pays for it with a late swap, which is precisely the thing the owner complained about
   (*"why don't the trees immediately spawn instead of needing me to get close"*, quoted in
   `trees/index.ts` beside the hysteresis). **A look call, not an optimisation.**

Whichever is tried, the measurement to run it against is now in the report, and it wants more than one
walk a side.

## Files

- `walk.json` — the run behind §1.
