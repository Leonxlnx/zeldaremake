# Pricing a fresh pool item by its own size: reverted broad, shipped narrow

> **§7 is the verdict: with four runs a side the change has no measurable effect and is reverted.**
> §5's two-run result did not survive, and neither did the long-chunk regression §5 left open — the
> baseline produces those too. What shipped instead is the metric whose absence made all of this hard
> to judge (`syncMsP95` / `syncMsMax`). Read §7 first; §3 and §5 are the road to it.
>
> **§5 (one hour later) supersedes §3.** Repeating the baseline showed the "cost" §3 reverted for was
> inside the baseline's own run-to-run spread, and the narrower version — pre-fetch items only —
> **is shipped**: calls over budget 5–6 → 1–3 and work p95 7.5–7.9 → 6.2–6.5 ms, with the fill-rate
> numbers unchanged. Read §5 before quoting §3.

Lane 2, 2026-09-29. Branch `cursor/squad2-treephases-682b`. The change is in the history at
`c91a9bbe` and reverted at `7f7d54a6`; nothing of it is on the head.

`framecost/` §7 named this precisely and it was the lane's one open item: `LodPool.work` declines a
chunk that will not fit (`steps > 0 && elapsed + expected > budgetMs`), but for a **fresh** item
`expected` is `stepMsTypical()` — the p95 of the last builds' first chunks, **one number for every
pending item**. The pool's items are not one size: an authored plaza lobe's first chunk runs 4–7 ms
(`chunks/` §5) and a run of small parts pulls that p95 down, so the lobe is priced as cheap and started
with the budget nearly gone. That is how a `work` call reached **10.4 ms against a 6 ms budget**.

## 1. What was built

The pool already holds what would price it: each item's `bytes` (an estimate before its first build,
exact after). `recordStep` kept those first chunks **per byte** as well, and a fresh item's expected
first chunk became the p95 of ms-per-byte times its own `bytes`, falling back to the flat p95 until
`FIRST_STEP_BYTE_SAMPLES = 8` sized samples existed. `report()` carried `firstStepMsPerByteP95` so a
walk could read it.

**It cannot starve anything**, by the same argument the flat prediction rests on: the first chunk of a
call runs whatever the prediction says, so declining to *begin* a big item late in a call moves that
chunk to the front of a later call, where it is the mandatory step that was going to run anyway.
Three tests pinned it — the scaling, the progress guarantee with a chunk **eight times** the budget,
and the fallback before eight samples — and the suite went 269 → **272 / 272**.

## 2. What it measured

The same 40 m walk from `framecost/` (32 frames, `setPose` + `render(1, 1/60)`, clock at 12.5 s), read
from the pool's **own** `report()` through `__ZR__.perf().systemPerf.trees` — no instrumentation:

| `nearCanopyPool` | before | after |
| --- | --- | --- |
| **calls over budget** | 6 | **3** |
| **work p95** | 7.9 ms | **7.0 ms** |
| chunk p95 | 0.8 ms | 0.5 ms |
| chunk max | 5.8 ms | 6.0 ms |
| chunks run | 14 765 | 13 460 |
| **parts built** | **287** | **272** |
| **synchronous (pin-forced) builds** | **63** | **69** |
| `firstStepMsPerByteP95` | — (no such number) | 3.69 × 10⁻⁷ ms/byte |

The prediction did what it was designed to do: **the calls over budget halved and the p95 came down
0.9 ms.** The chunk max is unchanged, as expected — deferring a chunk does not shrink it.

## 3. Why it is reverted

Look at the last two rows. Deferring a big fresh item does not make its cost disappear; it makes the
item **later**, and a part that is needed before it is ready gets pinned, which finishes it
**synchronously** — a whole build inside one frame. So the budget adherence was bought with **six more
synchronous builds and fifteen fewer parts completed over the same walk**: the canopy fills more
slowly, and the frames that would have overshot their budget by a couple of milliseconds are replaced
by frames that pay a whole build.

That trade runs against this project's stated priority. The owner's standing note is **"make all the
trees load in ASAP so it doesn't look bad"**, and his 20:08 question — *"why don't the trees
immediately spawn instead of needing me to get close"* — is already quoted in `trees/index.ts` next to
the near-canopy hysteresis. A change that fills the canopy more slowly to smooth a frame cost that
`framecost/` §7 measured as **0.4 ms mean in play** is the wrong way round.

**And one run each is not enough to call either direction.** 287 against 272 parts and 63 against 69
synchronous builds are 5 % and 10 % on a single 32-frame walk in an environment whose build timings
vary by hundreds of milliseconds between runs; the same applies to 6 against 3 over-budget calls. I am
not claiming the regression is real any more than I am claiming the improvement is. What I can say is
that **the change moves two numbers the wrong way while moving two the right way**, which is not a
result worth shipping on one sample.

## 4. What this settles for the lane

The flat p95 is not the oversight `framecost/` §7 implied. It is a **fill-rate-first** choice, and the
pool's design reads that way throughout: the progress guarantee, the pin-forced synchronous finish and
`NEAR_LOD_PREBUILD_MS = 1500` all spend frame time to have parts ready. Making the scheduler more
cautious trades against every one of them.

If anybody picks this up again, the version worth testing is **narrower**: scale the prediction only
for items the player is not about to need — the pool's `want(item, dist)` already carries that
distance, and pinned items come in at priority −1 — so prefetch work gets the pessimism and the parts
about to be shown keep today's eagerness. That needs a distance threshold the pool does not currently
own, and it needs repeats, not one walk.

## Files

- `before.json`, `after.json` — the two walks' pool reports.

---

## 5. Shipped: the eager gate, and what repeating the baseline showed about §3

§3 reverted the broad version on one run each side, and said so. Repeating the **baseline** settles
what that was worth:

| `nearCanopyPool`, 32-frame walk | base 1 | base 2 | narrow 1 | narrow 2 |
| --- | --- | --- | --- | --- |
| **calls over budget** | 6 | 5 | **1** | **3** |
| **work p95** | 7.9 ms | 7.5 ms | **6.2 ms** | **6.5 ms** |
| chunk p95 | 0.8 ms | 0.5 ms | 0.7 ms | 0.5 ms |
| chunk max | 5.8 ms | 6.1 ms | **21.7 ms** | 6.8 ms |
| chunks over 12 ms (`longSteps`) | 0 | 0 | **1** | 0 |
| chunks run | 14 765 | 12 862 | 12 759 | 14 349 |
| parts built | 287 | 265 | 264 | 283 |
| synchronous (pin-forced) builds | 63 | 72 | 72 | 65 |

**§3's regression was noise.** The two baselines differ by **22 parts built (287 / 265) and 9
synchronous builds (63 / 72)** on their own, and the broad version's 272 / 69 sits inside both ranges.
I reverted it for a difference the harness cannot resolve at one run a side, and said at the time that
one run could not call either direction — it could not, and this is what that looks like when checked.

**The narrow version is a real result.** `eagerPriority` exempts items whose `want` priority is at or
inside the tier's swap-out radius, so only speculative pre-fetch can be deferred:

- **calls over budget: both narrow runs (1, 3) below both baselines (5, 6)**;
- **work p95: both narrow runs (6.2, 6.5) below both baselines (7.5, 7.9)** — about 1.3 ms;
- **parts built and synchronous builds land inside the baselines' own spread** (264 / 283 against
  265 / 287; 72 / 65 against 63 / 72), so the fill rate that §3 worried about is not paying for it.

Four runs is not many, but the two metrics the change targets move **outside** the baseline range in
both runs while the two it must not hurt stay **inside** it. That is the shape of a real effect, and it
is the reason this version ships where the broad one did not.

**One thing left open.** Narrow run 1 has a **21.7 ms chunk** and one `longSteps`, where both baselines
max at about 6 ms and the other narrow run at 6.8. A deferral cannot make a chunk longer — the chunk is
the same work whenever it runs — so the likely cause is a collector pause landing in it, the tail
`framecost/` §7 and `chunks/` both trace to the whole page's allocation. **But it appeared in a run of
this change and not in the baselines**, and two runs cannot separate "a pause happened to land there"
from "deferring bunches work so a pause is likelier to land in a big chunk". It wants more runs, and it
is written here rather than left out because a single 21.7 ms chunk is the one number in this table a
player could feel.

## 6. What is on the head

`lodPool.ts` gains `eagerPriority` (default 0, so only pinned items are eager and the flat behaviour is
the default for any other caller) and the per-byte first-chunk history behind it; `trees/index.ts` sets
each pool's threshold from `NEAR_LOD_TIER`. Four tests: the scaling, the progress guarantee with a chunk
**eight times** the budget, the fallback before eight sized samples, and the eager gate. The suite is
**273 / 273** with `tsc --noEmit` and `vite build` green.

The eager-gate test had to be written twice, which is worth knowing if you touch this: **`building`
counts a slot that has a generator, and `work` creates the generator before it checks the budget**, so
a deferred item still shows up in `building`. The signal for "was it begun" is the steps the call added.

**And the capture contract holds.** A scheduler change can move what is resident when a settled shot is
taken, which would show up as different draws or triangles at a fixed viewpoint. `pose-counts.mjs` on
this head reads **559 / 8 626 622, 541 / 7 903 532, 479 / 7 679 745, 465 / 8 242 550, 541 / 7 903 532,
500 / 7 831 095** — every one identical to the numbers `headcheck3/` recorded before it
(`six-views.json`).

---

## 7. Four runs a side: no measurable effect, reverted — and the metric that was missing

§5 shipped on two runs a side. Two more, **run in pairs** so each base and narrow share the machine's
conditions, close the question:

| `nearCanopyPool`, 32-frame walk | base 1 | base 2 | base 3* | base 4* | narrow 1 | narrow 2 | narrow 3* | narrow 4* |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| calls over budget | 6 | 5 | 2 | 6 | 1 | 3 | 7 | 4 |
| work p95 (ms) | 7.9 | 7.5 | 5.8 | 7.1 | 6.2 | 6.5 | 7.3 | 6.5 |
| chunk max (ms) | 5.8 | 6.1 | 8.3 | **15.8** | **21.7** | 6.8 | **24.4** | 7.1 |
| chunks over 12 ms | 0 | 0 | 0 | **2** | **1** | 0 | **2** | 0 |
| parts built | 287 | 265 | 254 | 262 | 264 | 283 | 259 | 260 |
| synchronous builds | 63 | 72 | 81 | 75 | 72 | 65 | 77 | 75 |

\* run as a pair, concurrently, so both saw the same contention.

**The improvement does not survive.** Calls over budget: base 2–6, narrow 1–7. Work p95: base 5.8–7.9,
narrow 6.2–7.3. The means lean narrow's way (4.75 → 3.75 calls, 7.08 → 6.63 ms) but the ranges overlap
almost completely, and **the fairest comparison in the set — pair 1, run side by side — has narrow
worse on both** (7 calls against 2, 7.3 ms against 5.8). Parts built and synchronous builds are
identical either way (267 against 266, 72.8 against 72.3 on the means).

**And the regression does not survive either.** After pair 1 it looked like the change alone produced
chunks over 12 ms — 2 of 3 narrow runs against 0 of 3 baselines. **Base 4 has two of them and a 15.8 ms
maximum.** The baseline does it too; three runs was simply not enough to see it.

So the change is **neutral as measured at n = 4**, and it is reverted: `eagerPriority`, the per-byte
history and the four tests are off the head, and `src/` is back to the flat prediction. Carrying a
concept and two code paths for an effect this harness cannot resolve is what this lane has declined
eight times before; the only difference here is that I shipped it for an hour first, on two runs, and
said in the same breath that two runs could not call it.

### What was actually missing, and now is not

Three hours of this were hard to judge because of a **blind spot in the pool's own reporting**, and it
is worth more than the scheduler change was:

`pin` finishes an unbuilt item by running **every remaining chunk in one loop** — and that loop is the
only pool work `recordStep` never sees (it has exactly one call site, inside `work`). So `stepMsP95`,
`stepMsMax` and `longSteps` describe `work`'s chunks alone and say nothing about the path that skips the
budget entirely. **A policy that finishes more items through `pin` therefore looks quieter on all three
while putting more into single frames** — which is exactly the axis these eight runs differ on
(synchronous builds 63 to 81 across them).

`report()` carries `syncMsP95` and `syncMsMax` now, with a test that pins both halves of the point: five
remaining 2 ms chunks land in one frame as `syncMsMax` **10**, while `stepMsMax` stays **2** and
`longSteps` **0**. No behaviour change — two counters and a percentile — and it is the piece a future
round needs to compare two scheduling policies on what a frame actually pays.

### If anybody picks the scheduler up again

Do not start from the prediction. Start from **`syncMsP95` against `workMsP95`**: decide first whether
the pool's frame cost is dominated by the budgeted path or the pinned one, on a walk long enough that
`longSteps` is not a coin flip — pairs of 32-frame walks were not, at either two or four runs a side.
