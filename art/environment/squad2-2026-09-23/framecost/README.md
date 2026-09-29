# What the trees' bucketing costs — at load (550 ms) and per frame (0.9 ms median, 22.1 ms worst)

Lane 2, 2026-09-29. Branch `cursor/squad2-treephases-682b`, head `3a467c2d`. **No world code changed
this round** — this is the measurement that has to come first, and it did not hand me a win.

**§7, written an hour after §1–§6, withdraws §2's headline and renames §4's fix — read it before
quoting anything below.**

`midplace/` left `distant-mid-and-publish` as the largest unpriced line in the trees' build at 722 ms.
This prices it, and then prices the same machinery **per frame**, which matters more than load time
and had never been read in this lane.

## 1. The build's 722 ms is one call

Sub-timers inside the phase, one world build:

| part | ms |
| --- | --- |
| **the first `rebucket(ctx.camera, true)`** | **550** |
| the end-of-build sweep (`compactAttributes` + `releaseAfterUpload` over 139 geometries) | 139 |
| everything else in the phase | ≈ 33 |

So the phase is not "publishing" — it is the build's **first bucketing and culling pass**, which has to
decide what the first frame submits. The sweep behind it is a memory pass (normals → `Int8Array`,
colour → `Uint8Array`, `aWind` → `Uint16Array`, then every CPU array dropped on upload), and 139 ms is
its honest price for what it saves.

## 2. Per frame, walking

The same machinery runs every frame from the system's `update()`. Driven along a 45 m walk down the
north path and back across the plaza (48 frames, ~0.95 m a frame, clock at 12.5 s):

| part | total | calls | mean | max |
| --- | --- | --- | --- | --- |
| **`rebucket`** | 148.7 ms | 96 | **1.549 ms** | **22.100 ms** |
| `nearCanopyUpdate` | 90.8 ms | 96 | 0.946 ms | **21.300 ms** |
| `cull` (frustum + hull + SAT) | 42.2 ms | 96 | 0.440 ms | 2.800 ms |
| `bucketWhite` | 4.9 ms | 48 | 0.102 ms | 0.300 ms |
| `bucketDistant` | 4.8 ms | 48 | 0.100 ms | 0.500 ms |
| `nearBoleUpdate` | 3.6 ms | 96 | 0.038 ms | 0.400 ms |
| `detachedVisible` | 0.7 ms | 96 | 0.007 ms | 0.100 ms |

**Per frame: median 0.900 ms, p95 3.500 ms, max 22.100 ms.**

Three things that says:

- **The bucketing proper is not the cost.** Re-sorting every white-bark and distant instance into LOD
  buckets is **0.1 ms** each, and only on frames where the camera has moved 1.5 m.
- **The culling is affordable**: 0.44 ms mean, 2.8 ms worst, for the per-instance padded-sphere and
  hull tests plus the sectors' SAT.
- **The tail is the near-canopy pool**, not the geometry maths: `nearCanopyUpdate` is 61 % of the
  total and **21.3 of the 22.1 ms worst frame**. That call ends in `nearCanopyPool.work(0)`, and
  `LodPool.work` always runs the first chunk of a call whatever the budget (the progress guarantee
  `chunks/` documented), so one unsplittable chunk — or a collector pause landing inside it, which
  `chunks/` measured as the real shape of this tail — still lands whole in a frame. 22 ms of a 33 ms
  frame at 30 fps is a visible stutter, and it is the same tail the builder round chased: **chunking
  and de-allocating moved the median, not the worst case.**

## 3. A harness asymmetry worth knowing

`rebucket` ran **96 times over 48 frames**. That is not a redundancy in play: `main.ts` calls every
system's `onCameraMove` on an **explicit pose jump** (the capture harness, the viewpoint keys) so a
capture cannot render the previous pose's buckets, and this probe moves the camera with `setPose`
every frame. In play the camera moves continuously and `update()` is the only caller.

The consequence for anybody reading cost numbers here: **a `setPose`-driven capture does about twice
the bucketing work of play**, with `force = true`, so `bucketWhite`/`bucketDistant` run on frames a
walking player would skip. Frame-cost claims from a capture harness are an upper bound, not play.

## 4. Why no change shipped

- The 550 ms at load is the first frame's own culling decision. It is not waste; the pool fill inside
  it is the same "trees load in ASAP" work that `atlascost/` and `midplace/` took 1.25 s out of by
  other means.
- The 139 ms sweep buys memory that the round-51 work put there deliberately.
- The per-frame tail is `LodPool.work(0)`'s first-chunk guarantee, and the honest fix is either a
  smaller maximum chunk (already done for the normals, the packing and `setIndex`) or dropping the
  progress guarantee, which would let a pool starve. Both were measured in `chunks/`; neither moved
  the worst case, because the worst case is dominated by collector pauses sized by the **whole
  page's** allocation, not this system's.

What would move it is a budget that can refuse to start a chunk it cannot finish — which needs a
reliable estimate of the *next* chunk rather than the last ones, the thing `firstStepMsP95` only
approximates. That is a real proposal, and it is not a one-line change, so it is written down rather
than half-built.

## 5. A probe bug, recorded so the next one avoids it

The first run of this measurement read **zero samples**. The instrumentation captures its accumulator
once, at system-creation time (`const _R = (globalThis.__ZR_RB__ ??= {})`), and the probe "reset" it
between the build and the walk by assigning a **new** object to the global — which orphaned the
reference the instrumentation still held, so every timer went into the old object and the probe read
an empty new one. **Clear an accumulator in place** (`for (const k of Object.keys(o)) delete o[k]`).

This is the same shape as the motes false zero in `airlife/`: a probe's write that looked like it had
taken effect and had not. Both times the tell was a suspiciously perfect zero.

## Files

- `phase.json` — §1's three sub-timers.
- `frame.json` — §2's timers, the 96 per-call samples and the quantiles.

## Reproducing

Both need temporary timers (never committed): §1 three `performance.now()` pairs inside
`distant-mid-and-publish`, §2 one pair per part inside `rebucket`. §2's walk is 48 frames of
`setPose` + `render(1, 1/60)` driven **one frame per `page.evaluate`** — a single evaluate for the
whole walk exceeds puppeteer's `protocolTimeout` and the run dies after the last frame.

---

## 7. Correction, one hour later: §2's worst frame was the harness, and §4 named the wrong fix

§2 made **21.3 of a 22.1 ms worst frame** in `nearCanopyUpdate` its headline and §4 proposed "a budget
that can refuse a chunk it cannot finish". One more measurement revises both.

**The two call paths, timed apart** (same walk, 40 frames; `reset` is the forced `onCameraMove` path a
`setPose` probe fires every frame, `play` is what `update()` calls):

| `nearCanopyUpdate` | total | calls | mean | max |
| --- | --- | --- | --- | --- |
| **play** (`update()`, `force = false`) | 15.9 ms | 40 | 0.398 ms | **0.700 ms** |
| reset (a capture's pose jump) | 31.7 ms | 40 | 0.792 ms | 4.700 ms |

**In play that call never exceeded 0.7 ms.** §2 accumulated both paths under one key, and the reset
path — the only one that reaches `nearCanopyPool.work(0)`, behind `if (reset)` — carried the tail. §3
warned that a harness does about twice the bucketing of play; this is that asymmetry landing squarely
on the number §2 led with, so **§2's 22.1 ms is not a play figure** and the "visible stutter" reading
of it is withdrawn.

**Inside the pool**, over 120 `work` calls in those frames:

| part of `LodPool.work` | total | max in one call |
| --- | --- | --- |
| the unwanted-generator sweep | 0.5 ms | 0.100 ms |
| `evictToCap` | 0.3 ms | 0.100 ms |
| **the chunk loop** | **249.1 ms** | **10.400 ms** |

The sweep and the eviction are nothing — the guess that arriving somewhere new pays for disposing what
you left behind is wrong — and the cost is the chunk loop against `NEAR_LOD_BUILD_BUDGET_MS = 6`.

**Where 10.4 ms comes from, and why §4 named the wrong fix.** `chunkcost.mjs` over **12 291 chunk
readings** of its 65 parts gives p50 **0.05 ms**, p95 **0.26 ms**, max **2.63 ms**, and every one of the
eight largest is a chunk a collection landed in (that 2.63 ms carries 1.48 ms of GC pause; the largest
with no collection in it is 2.05 ms). On those numbers alone there is nothing big enough to explain a
10.4 ms call, which is what made §4 reach for a scheduler change.

But this lane already knows better, in its own notes: `chunks/` §5 records that **the authored plaza
giants' lobe chunks run 4–7 ms — twice the whole budget of the day — and that `chunkcost.mjs`'s
synthetic parts cannot see them**. I had to be reminded of it by my own README after the census's
2.63 ms nearly talked me into the wrong conclusion. Six milliseconds of budget plus one authored lobe chunk is the 10.4 ms, exactly.
So the overshoot is real and it is not a collector artefact.

**The fix is narrower than §4 said.** `work` already refuses a chunk that will not fit — `if (steps > 0
&& elapsed + expected > budgetMs) break` — but for a *fresh* item `expected` is `stepMsTypical()`, the
p95 of **recent** first chunks, which is a global figure. A 4–7 ms authored lobe starting after a run of
small parts is therefore mis-predicted as small, runs, and takes the call to budget-plus-chunk. The pool
already carries what would predict it: each item's `estimatedBytes`. Scaling the expected first chunk by
the item's own size, instead of by whatever was built recently, would let the loop defer a big fresh
lobe to a frame with a whole budget — capping a call nearer `max(budget, chunk)` than `budget + chunk`,
so about 10.4 → 7 ms, without touching the progress guarantee that keeps a pool from starving.

That is a scheduler change with a starvation risk to test, it needs `lodPool.test.mjs` cases for both
the prediction and the guarantee, and it needs the walk re-measured to show the p95 actually moves.
**Written down rather than half-built**, and with the right target named this time: not "refuse
expensive chunks" but "predict a fresh chunk from the item, not from the last ones".
