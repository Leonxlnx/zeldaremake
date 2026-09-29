# Pricing a fresh pool item by its own size: built, measured, reverted

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
