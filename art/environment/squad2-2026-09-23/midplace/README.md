# The mid-grove sampler tested its most expensive rule first: 630 → 119 ms, frames byte-identical

Lane 2, 2026-09-29. Branch `cursor/squad2-treephases-682b`. Continues `atlascost/` — the owner's
**"make all the trees load in ASAP so it doesn't look bad"**, taken at the serial world build the
first frame waits on.

## 1. Where the trees' build stands after `atlascost/`

Re-read on this session's VM (`chunks/buildphases.mjs --runs 2`; the machine is slower today than on
09-28, so these are not comparable with the numbers recorded there — only with each other):

| trees phase | ms | | the giants' steps | ms |
| --- | --- | --- | --- | --- |
| giants | 5 045 | | giants-tail-total | 2 664 |
| columns | 1 648 | | giants-loop-total | 2 377 |
| white-barks | 1 050 | | crown-materials | 1 504 |
| distant-mid-and-publish | 722 | | **tail-mid-place** | **630** |
| understory | 77 | | tail-sectors | 420 |
| | | | near-pool-register | 169 |

`tail-mid-place` is one call: `placeMidTrees` (`distant.ts`), the rejection sampler that fills the
14–58 m grove the owner's "the trees do not populate" note asked for. 630 ms to place 400 trees is a
lot, so it got the same treatment as the atlas — instrumented, then read.

## 2. One of its six tests costs seventy times the others

Timed per predicate over one world build:

| test | ms | calls | per call |
| --- | --- | --- | --- |
| **`o.blocked`** | **544** | 11 850 | **46 µs** |
| `o.occupied` (184 circles) | 31 | 8 097 | 3.8 µs |
| `tooCloseIn` (grid) | 20 | 5 883 | 3.4 µs |
| `terrain.slope` | 6 | 8 113 | 0.7 µs |
| `shadesCorridor` | 5 | 8 113 | 0.6 µs |
| `terrain.height` | 3 | 8 113 | 0.4 µs |
| the whole sampler | 635 | 28 818 attempts | — |

`o.blocked` is `treeGroundBlocked` (`placement.ts`) — **seven terrain mask probes** (the centre and a
six-point ring, so the root flare never touches pavement), then `vegetationAllowed`, the slope, then
every house, giant, boulder, npc spot, signpost, viewpoint, fence segment, stair run, the lantern
branch, the log arch and the three authored path polylines. 46 µs is the honest price of that rule;
it is the white-barks' rule and correct as written.

**And it ran first, on every candidate.**

## 3. The fix is the order, and it cannot change the result

All six tests are **pure** and **none of them draws from the sampler's `r`** — every `r()` call
(angle, radius, the density reject, the variant, the scale) happens before them, and the accepted
tree's `shift`/`tint`/`yaw` are drawn after all six. So the order cannot change *which* candidates
are accepted, only how often each test runs.

The counts above say what the order should be: of the 8 113 candidates `o.blocked` let through, the
spacing test rejected **5 483 (93 % of what reached it)** and the occupancy test **2 214 (27 %)** —
so those two were re-deciding, at 3.4 and 3.8 µs, what 46 µs had just paid to consider. Running them
first takes `o.blocked` from 11 850 calls to about 600.

| | head | reordered | delta |
| --- | --- | --- | --- |
| **`tail-mid-place`** | **630** | **119** | **−511 ms (−81 %)** |
| `giants-tail-total` | 2 664 | 2 118 | −546 |
| the giants phase | 5 045 | 4 527 | −518 |
| `crown-materials` | 1 504 | 1 489 | −15 (unchanged, as it should be) |
| trees | 9 233 | 8 518 | −715 (one build's spread is ±700, so read the phase, not this) |

## 4. Identical, not merely equivalent

A placement change would move instances, not geometry, so `chunks/bitcheck.mjs` cannot see it — the
frame can. Same two poses, clock frozen, `frozen.mjs`:

| pose | draws | triangles | md5 head | md5 reordered |
| --- | --- | --- | --- | --- |
| hero-A | 559 → 559 | 8 626 622 → same | `56a1cdb9bab32da691ec9e41afa21830` | **the same** |
| plateau-back | 687 → 687 | 10 888 866 → same | `bbebc65dbd5ee5cab50d9b4d39cd2c40` | **the same** |

**Byte-identical frames**, so every one of the 400 mid trees is where it was. 269 / 269 tests, `tsc`
and `vite build` green.

## 5. The same shape, one sampler along: the white-barks

`placeWhiteBark`'s `fill()` (`placement.ts`) calls the same `blocked` at 46 µs **before**
`shadesCorridor`, `closesGap` and its clash loop over the accepted trees, and I have checked that
those three are pure and draw no randomness, so the same reorder is available and would be
output-identical by the same argument. **It is not shipped here because it is not measured yet** —
the white-barks phase is 1 050 ms in total and most of that is building the trees themselves, so the
sampler's share is unknown, and this lane does not ship a number it has not read. The measurement is
one `buildphases.mjs --runs 2` on a variant plus one `frozen.mjs` md5 check, exactly as above.

**Answered, 2026-09-29 — there is nothing there** (`headcheck3/` §5). That sampler is **20 ms** in
total, with `blocked` running **165** times rather than 11 850, because it accepts **80 of 211**
candidates where this one accepted 400 of 28 818: a small target in a large annulus barely rejects
anything. The reorder would be correct and would buy about **10 ms of the 1 050 ms phase**, whose cost
is building the trees rather than placing them. **Not shipped**, and the question is closed.

## Files

- `phases.json` — the three `buildphases.mjs` runs (head, reordered, and the leaflet pricing below).
- `predicates.json` — the per-test timings of §2.
- `counts-head.json`, `counts-reordered.json` — the two poses' draws, triangles and md5s.

## 6. Also measured: the atlas's leaflets are a look call, not a free win

`atlascost/` §5 listed the leaflet paths as the next candidate. Priced the same way — a build with
the leaflet loop skipped, which leaves every clump position and every blit identical because the
clumps are generated before the paint loop:

| | `crown-materials` |
| --- | --- |
| head | 1 504 ms |
| leaflet loop skipped | **990 ms** |

So the ~10 000 blades cost **514 ms**. Then the question is whether any of it can be had without
changing the picture, and the answer measured out as **no**:

- Hoisting the per-clump fill colour out of the loop and applying each blade's frame to its five
  points in JS instead of through `save`/`translate`/`rotate`/`restore` — ~8 500 fewer context state
  changes and colour conversions — gave **1 504 → 1 419 ms**, −85 ms, inside the ±80 ms spread of
  this measurement and at the cost of markedly worse code. **Reverted.**
- Merging a clump's blades into one path and filling once would be a real saving, but the blades
  overlap and each fill applies its own alpha, so the union would lose the darker crossings. That is
  a look change, not an optimisation.

The 514 ms is the rasterisation of the blades themselves. Cutting their count, their size or the
atlas's own resolution would all buy load time by removing leaf detail the mid layer shows at 12 m —
a **look call for the owner**, with the price now known.
