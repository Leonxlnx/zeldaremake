# The weak-device tier re-read, and the gauntlet job is timing out

> **§2 is the one that matters beyond this lane: the gauntlet is not failing, it is exceeding its
> `timeout-minutes: 45`** — which shows up as `cancelled` and so reads like an interruption. The capture
> reloads the world for **every** viewpoint, ~140 s each, and was still loading the sixth when the clock
> ran out.
>
> **§3 withdraws the fix §2 proposed.** I suggested capturing all six in one page load to save ~12 minutes.
> `capture.mjs` explains in its own comments that this was tried and abandoned: one long session **degraded
> from 12 s a frame to a single CDP call taking over 20 minutes** by the second or third view. The reload is
> deliberate. Read §3 before acting on §2.

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

That suggested a fix, and **§3 is why it is wrong.**

Nothing here is in this lane's files — `gauntlet/` and `.github/` are not mine to change, so this is a
report with the timings attached.


## 3. Withdrawn: the single-load capture was already tried and abandoned

§2 proposed capturing the six viewpoints in one page load, on the grounds that `frozen.mjs` renders pose
lists in a single load and matches the capture's own md5s. **Before proposing that I should have read
`capture.mjs`, which explains itself in two comments dated 2026-09-22:**

> *a fresh page for every viewpoint after the first — one long session degraded from 12 s/frame to a
> single CDP call over 20 min by the second or third view (takes 0132/0133, the near-LOD pools +
> persistent lobes resident across views); the seed is fixed, so a reloaded page renders the same frames*

> *a whole new browser, not just a page: a second page in the same Chrome never returned its first render
> call (the shared SwiftShader GPU process after the first page closed — 20 min timeout on the B view with
> a fresh page, fourth take-0133 start); a new process starts clean*

So the reload is not an oversight, it is the result of the exact experiment I was proposing, and it cost
somebody two takes to learn. Following §2 would reintroduce a twenty-minute stall in place of a
fourteen-minute cost. **Withdrawn.**

Why `frozen.mjs` gets away with it: it renders **two to five** poses a load, which is inside the range
where nothing has degraded yet. The comment puts the cliff at the *second or third* full viewpoint with
its settle cycle, and this lane has never asked it for six.

### What that leaves, honestly

The capture's cost is **~140 s of world build plus 177–276 s of settle frames per viewpoint**, and neither
half is reducible from inside this lane:

- the **world build** is every system's `create()` — trees are 8.4 s of it in this VM and this lane has
  taken 1.25 s out (§10, §11 of the PR); the rest belongs to the other lanes and to `world/index.ts`'s
  serial loop;
- the **settle frames** are GPU-bound at 1280×716 under SwiftShader, and their count is fixed by every
  recorded reference image (`capturetime/`: `--settle` also sets the world time the shot is taken at, so
  lowering it moves every reference).

Which means the honest recommendation is the boring one I skipped past: **raise `timeout-minutes`**. The job
needs more than 45 minutes today and will need more as the world grows, and no reorganisation of the capture
loop is available to buy that back. The alternative worth measuring — not proposing, measuring — is whether
the runner can be given a real GPU, because 22–51 s a frame at 1280×716 is SwiftShader's number, not a
graphics card's.

## Files

- `low-before/`, `low-after/` — the two builds' frames and counts at `quality=low`.
