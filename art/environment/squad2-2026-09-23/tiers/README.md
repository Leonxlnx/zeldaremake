# The trees on the weak-device tiers — the picture holds, the small pool thrashes

Lane 2, 2026-09-28. Branch `cursor/squad2-treephases-682b`, PR #210.

Every measurement this lane has taken was at `quality=high` with the default memory pool. The owner's
09-27 change to Link's model was a memory-limited-device fix ("a 4096² map that fails to decode on a
memory-limited device leaves glTF's white base colour"), which is a reminder that the weak tiers are
real. This checks the two that scale this lane's work: the **low quality tier** (`density 0.35,
distance 0.6`) and the **small memory tier** (`?pool=small`).

## 1. Quality low: the same picture, cheaper — no defect

The owner's 06:50 north pose, 960×540, `--settle 6`, at both tiers:

| | mist % | brown % | dark % | leaf % | band mean l | far-centre box |
| --- | --- | --- | --- | --- | --- | --- |
| high | 14.7 | 26.5 | 21.2 | 20.9 | 0.321 | s 0.06 / l 0.466 |
| **low** | 16.4 | 29.0 | 21.3 | **15.4** | 0.330 | s 0.06 / **l 0.478** |
| the owner's r_024 | — | — | 12 | — | 0.394 | s 0.05 / l 0.474 |

And this lane's own structure metric (`band.mjs`, rows 0.12–0.50) — the one that answers "is the middle
distance trees or haze":

| | band mean | across-column sd | within-column sd |
| --- | --- | --- | --- |
| high | 86.5 | 28.93 | 18.12 |
| **low** | 88.5 | **29.63** | **19.38** |

**The low tier keeps the structure** — if anything slightly more of it — and its crown tone lands on the
owner's reference (l 0.478 against his 0.474) closer than high does. Leaf coverage falls 20.9 → 15.4 %,
which is the tier doing its job: fewer, coarser crowns and thinner ground cover. `quality-tiers.jpg` is
the pair side by side; the corridor, the path, the trunks and the mist read the same, the banks are
sparser. No haze wash, no missing layer, no hole.

## 2. Small memory pool: the contract holds, but a re-pose costs ~50 synchronous builds

`?pool=small` takes the near-canopy pool to a **64 MiB** cap and the near-base pool to 12 MiB. Two poses,
frozen clock:

| pose | draws / triangles | canopy pool | resident | pinned | `pinnedPending` | evicted | **syncBuilds** |
| --- | --- | --- | --- | --- | --- | --- | --- |
| flight's foot | 540 / 8 974 623 | 63 of 64 MiB | 161 | 79 | **0** | 74 | **63** |
| owner-north | 449 / 8 247 038 | 63 of 64 MiB | 160 | 79 | **0** | 131 | **113** |

The good news first: **the tier still shows all 79 slots and `pinnedPending` is 0 at both poses**, so
nothing the frame draws is unbuilt and the capture contract holds on the smallest pool — which is what
the 64 MiB minimum was sized for (the authored maximum pinned set is 41.03 MiB).

The problem is the other 23 MiB. The pool sits at **63 of 64 MiB** with 74–131 evictions, and
`syncBuilds` — a build the pool had to do *synchronously* because a pinned part was not resident — runs
**113 at the north pose against 63 on the default tier at the same pose**. Fifty extra synchronous
geometry builds on a re-pose, each one a frame hitch, on the device that can least afford them. The
cause is arithmetic rather than a bug: the pinned set needs 41 MiB, the prefetch radius wants far more
than the remaining 23, so pins evict prefetched parts and the prefetch evicts what the next pose pins.

### 2b. …and it is not prefetch thrash. Correcting that

I called this "the next thing to fix" and named the prefetch radius as the lever. **Both halves were
wrong, and the measurement that shows it is the fix itself.** Setting the small tier's
`canopyPrefetchM` from 34 m to 28 m (the 26 m out-radius plus a walker's margin, which is what the
tier's own comment says 64 MB can hold) changes nothing that matters:

| small tier, owner-north | evicted | **syncBuilds** | shown / in frame | draws / triangles |
| --- | --- | --- | --- | --- |
| prefetch 34 m (shipped) | 131 | **113** | 79 / 5 | 449 / 8 247 038 |
| prefetch 28 m | 127 | **113** | 79 / 5 | 449 / 8 247 038 |

So the synchronous builds do not come from the prefetch competing with the pins. They come from the
**reset path**, which is this lane's own capture contract: on an explicit re-pose it pins every
candidate before filtering by residency, and `LodPool.pin` runs the whole build generator inline when
the part is not resident (`lodPool.ts`, `syncCount++`). On a 64 MB pool that holds ~140 of 364 parts, a
jump to a different part of the world therefore builds most of what the new frame pins, right there.

Sized properly: the counters are cumulative, so the *second* re-pose in that run cost 113 − 63 = **50
inline builds**, at `buildMsP50` 10.9 ms and P95 24.3 ms — about **0.5 s of freeze on this VM** (less on
hardware, where these CPU geometry builds are not running under SwiftShader). It happens **at a
teleport and nowhere else**: a walking camera takes the non-reset path, whose builds go through
`work(budgetMs)` a chunk at a time, which is exactly what the code comment at that branch says.

Is it worth removing? Not by tightening the prefetch, and not by pinning less — the reset already pins
only the candidates it will show (64 lobe slots, 12 limbs, plus the persistent set ≈ the 79 shown). The
honest statement is that **the small tier trades a ~0.5 s hitch at a teleport for a capture that draws
the same parts warm or cold**, and this lane wrote that trade deliberately. What would test the other
half — whether a *walking* camera on the small tier ever stalls — is `canopy-walk.mjs` on this tier with
`syncBuilds` read per step, which no round has done yet.

The prefetch change was reverted: a parameter change with no measured effect is not worth shipping.

### 2c. And a walk on the small tier is clean — as far as the harness can see

`playtest.mjs --only walk` with `?pool=small` (`walk-small.json`): **11 routes, every one reached, 0
stuck, no page errors**, including the long ones — `north-clearing-ledge` 15/15 over 82.1 m,
`south-bridge-to-log` 21/21 over 51.7 m, `north-grove` 28/28 over 61.7 m. Frame counts and camera speed
percentiles come out **identical to the default tier's run** (714 / 381 / 138 / 159 / 678 / 351 / 234 /
516 / 2061 / 1296 / 1569 frames), which is what you would expect: the memory tier decides geometry
residency, not the simulation.

So the small tier neither breaks nor slows a walk at the level that harness can see.

### 2d. And the pool's own counters during the walk: no synchronous builds at all

`walkpool.mjs` (this directory) drives play mode directly — place the player in the plaza, hold `KeyW`,
step 600 frames at 1/30 s without drawing, and read the pool every 60 — on `?pool=small`:

| sim frames | syncBuilds | built | evicted | pending | resident | pinned / pinnedPending | shown | `work` P95 | over budget |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 180 | **63** | 155 | 98 | 181 | 167 | 79 / **0** | 79 | 6.5 ms | 8 |
| 300 | **63** | 175 | 120 | 197 | 165 | 79 / **0** | 79 | 6.5 ms | 12 |
| 420 | **63** | 196 | 140 | 185 | 166 | 79 / **0** | 79 | 6.9 ms | 20 |
| 600 | **63** | 243 | 183 | 144 | 170 | 79 / **0** | 79 | 6.7 ms | 26 |

**`syncBuilds` never moves.** It sits at the 63 the initial placement cost and does not increment once
over twenty seconds of walking, while `built` climbs 155 → 243 and `evicted` 98 → 183: the pool is busy,
and every build of it goes through the chunked `work()` path. `pinnedPending` is 0 at every sample, so
nothing the frame draws is ever unbuilt, and `shown` holds at 79 throughout.

What the walk does cost is inside that chunked builder: `workMsP95` 6.5–6.9 ms against its 3 ms budget,
with **26 of 600 frames (4 %) over budget** and three individual long steps. That is a builder overrun,
not a stall — an order of magnitude below the 10.9 ms median of a whole inline build — and it is the
honest shape of the answer: **the small tier does not stall a walking camera; it spends about 7 ms in the
geometry builder on 4 % of frames.**

**The trap that cost me a round**, recorded for whoever writes the next play-mode probe: `__ZR_PLAY__` is
installed only when the page does not look automated (`main.ts`: `playTest = !headless && test=1`, and
`isHeadlessCapture()` returns true when `navigator.webdriver` is true). Under puppeteer that means the
hook never appears unless the probe masks it first —
`page.evaluateOnNewDocument(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true }))`
— which `playtest.mjs`, `pool-check.mjs` and `normal-run.mjs` all do. Without it the probe sits waiting
with `ready()` resolved and nothing else happening, which is exactly how mine idled.

## Files

- `quality-tiers.jpg` — the north pose at quality high and low, with each panel's mean and thirds.
- `pool-small.json` — the two poses on the small memory tier, with both pools' reports.
- `bands-tiers.txt` — the metric output behind §1.

### 2e. Tried: predicting a fresh chunk pessimistically. It made the overruns worse

§2d left one number unexplained — the chunked builder runs at `workMsP95` 6.2–6.7 ms against a 3 ms
budget, with 21–26 of 600 frames over it. `work()` declines to *start* a step it expects to overrun,
using the slot's own worst chunk when it has one and the **median** of recent chunks when it does not,
so the obvious suspicion was that the median under-predicts: instrumenting which parts produce the long
chunks showed them scattered and heterogeneous — `giant-near-canopy/plateau-oak/lobe-20` 6.5 ms at its
16th step, `giant-near-base/north-west` 5.5 ms at its **first**, `column-near-canopy/seat-1/lobe-3` 5 ms
at its second — so a fresh slot's first chunk is exactly the case the median misses.

Replacing that estimate with the p95 of recent chunks, same walk, same tier:

| estimate for a fresh chunk | `work` P95 | frames over the 3 ms budget (of 600) | steps over 12 ms | parts built |
| --- | --- | --- | --- | --- |
| median (shipped) | 6.2–6.7 ms | **21–26** | 3 | 243 |
| p95 | 7.1–7.6 ms | **42** | 0 | 257 |

**Worse on the number it aimed at**, and the mechanism is instructive: the budget check is
`if (steps > 0 && …) break`, so the **first** step of every `work()` call runs whatever the budget says —
that is the progress guarantee. A pessimistic estimate ends each call sooner, so the same work is spread
over more calls, and each of those calls pays one unbudgeted first step. More calls, more mandatory
steps, more overruns: 42 instead of 24. (It did remove the three steps over 12 ms, and it built 14 more
parts in the same 600 frames, which is the same effect seen from the other side.)

Reverted. What this says for anyone who wants the overruns gone: the lever is not the estimator but the
**progress guarantee** — a call that has already spent its budget must be allowed to do nothing — and the
cost of that change is a pool that can stall behind a single expensive part. The overrun as it stands is
~7 ms on 4 % of frames while walking, an order of magnitude under a whole inline build, so this lane is
not spending that trade without being asked.

## 3. Re-read on the head, after the change that moves pixels

§1 measured this tier before `outlook/` §5 set `forceSinglePass` on the distant crown material. That change
moves 0.09–0.58 % of the pixels at `quality=high`, and the crown material is the **same factory** at every
tier — so the low tier had to be re-read rather than assumed. `frozen.mjs --quality low` (the flag added for
this), clock frozen, same pose and the same `bands.py`:

| | mist % | brown % | dark % | leaf % | band mean l | far-centre box |
| --- | --- | --- | --- | --- | --- | --- |
| §1, before the change | 16.4 | 29.0 | 21.3 | **15.4** | 0.330 | s 0.06 / **l 0.478** |
| **the head** | 16.5 | 28.8 | 21.6 | **15.4** | 0.330 | s 0.06 / **l 0.478** |
| the owner's r_024 | — | — | 12 | — | 0.394 | s 0.05 / l 0.474 |

**Unchanged within a rounding step on every column**, and the charter number is exactly the same — the low
tier's crown tone still lands closer to the owner's reference than the high tier's does.

Its counts on the head, for the record: **A_stairs 495 / 6 441 178**, F_canopy 449 / 5 493 128, the owner's
north pose 392 / 5 637 435 — 64 fewer draws than `quality=high` at A_stairs, which is the tier doing its job.

## 4. And the branch from a clean checkout

A worktree at the head (`f64c5e53`), nothing carried over from the working tree: `tsc --noEmit` clean,
`vite build` clean, `node --test` **269 / 269**. So nothing this branch needs is sitting uncommitted.
