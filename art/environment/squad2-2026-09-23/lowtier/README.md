# The weak-device tier re-read, and the gauntlet job is timing out

> **§2 is the one that matters beyond this lane: the gauntlet is not failing, it is exceeding its
> `timeout-minutes: 45`** — which shows up as `cancelled` and so reads like an interruption. The capture
> reloads the world for **every** viewpoint, ~140 s each, and was still loading the sixth when the clock
> ran out. One page load for all six would save about 12 minutes, and this lane's `frozen.mjs` has been
> doing it all day with md5 agreement against the capture's own frames.

Lane 2, 2026-09-29, head `ecffbcae`. **No code changed.** Two gaps closed, both about verification
rather than the world.

## 1. `quality=low` had not been re-read since the atlas stamp change

The far-crown atlas is shared by **both** tiers, and the 64 px stamp (`atlascost/`) was proved at four
poses **at `quality=high` only**. The low tier's own crown-band figures in the PR came from an earlier
round, before that change. So the weak-device experience was carrying an unverified change.

Same protocol as `atlascost/`: two builds differing only in `STAMP`, the same views, clock frozen,
`frozen.mjs --quality low`.

| view, `quality=low` | draws | triangles | SSIM | pixels > 2/255 | mean Δ | max Δ |
| --- | --- | --- | --- | --- | --- | --- |
| A_stairs | 495 → 495 | 6 441 178 → same | **1.00000** | 0.031 % (163 px) | 5.4/255 | 21 |
| F_canopy | 449 → 449 | 5 493 128 → same | **1.00000** | 0.068 % (351 px) | 5.4/255 | 28 |

And the crown band is **identical to two decimals** at both (`band.mjs`, y 0.10–0.45):

| view | mean | across-columns sd | within-column sd |
| --- | --- | --- | --- |
| A_stairs, before **and** after | 95.3 | 24.35 | 26.90 |
| F_canopy, before **and** after | 71.6 | 15.67 | 21.59 |

**So the change is as invisible on a weak device as on a strong one** — and slightly *more* invisible at
F_canopy, 0.068 % against the 0.090 % the same view moved at high quality, which is what lower-resolution
textures should do to a texture change. A_stairs at low also confirms the tier's recorded cost to the
triangle: **495 / 6 441 178**, the number the PR has carried since `tiers/`.

## 2. The gauntlet job is timing out — and the capture rebuilds the world six times

I looked at this branch's CI history for the first time today and found almost every run marked
**`cancelled`**. My first reading was that my own pushes were cancelling them. **That was wrong**, and the
workflow says so in two lines: `concurrency.cancel-in-progress: **false**` — a push never cancels a run in
flight — and `timeout-minutes: **45**`.

The latest run's job ran **17:01:25 → 17:46:48**: forty-five minutes and twenty-three seconds. GitHub
killed it, and the log's cleanup names what it killed — `Terminate orphan process: pid (2511) (npm run
capture)`. **The gauntlet is not failing; it is running out of time**, which shows up as `cancelled` and so
reads like somebody's interruption rather than a blocker. Runs that fit did pass (`3961630f`, `faafac9b`,
`c91a9bbe`).

### Where the 45 minutes go

The steps before the capture take 2.5 minutes (checkout, `npm ci`, typecheck, build, source-only
anti-cheat). The capture starts at 17:03:47 with **`--settle 8`** — so this is not the settle cost
`capturetime/` measured; CI already uses a small warm-up. From the log:

| per viewpoint | |
| --- | --- |
| page load | 113–118 s |
| then `__ZR__.ready()` | **138–144 s** from the start of the load |
| 8 settle frames | 22–51 s a frame, 177–276 s |
| **total** | **286–343 s — five to six minutes each** |

It captured B_house in 308.9 s, C_lookback in 286.4 s, D_log in 342.7 s, E_ground in 311.6 s, and was
**loading F_canopy when the timeout fired**. Six viewpoints at that rate cannot fit 45 minutes, and the
world only grows.

### The saving that is already proven byte-identical

**`capture.mjs` reloads the page for every viewpoint**, so it pays that **~140 s world build six times —
about 14 minutes of the run.** One load with the camera moved between shots would pay it once.

This lane has been doing exactly that all day. `frozen.mjs` renders a pose list in **one** page load, and
its header records that it was verified against the capture's own output: *"A_stairs 575 / 8 631 286 at md5
`a280badd…`, the same bytes as the run behind the PR's table."* The mechanism that makes it safe is in
`trees/index.ts` and deliberate — `nearCanopyUpdate`'s `if (reset)` block pins every candidate on an
explicit pose jump *"so an explicit pose draws the same parts whether the pool was cold or warm"*, which is
the capture contract holding a warm pool to a cold pool's result.

So the proposal for the gauntlet's owner is small, and it is the difference between a job that finishes and
one that does not: **capture the six viewpoints in a single page load**, saving roughly **12 minutes** and
bringing the run back inside its own timeout, with `frozen.mjs`'s md5 agreement as the evidence that the
frames do not move. Raising `timeout-minutes` works too, and buys less each week as the world grows.

Nothing here is in this lane's files — `gauntlet/` and `.github/` are not mine to change, so this is a
report with the timings attached.

## Files

- `low-before/`, `low-after/` — the two builds' frames and counts at `quality=low`.
