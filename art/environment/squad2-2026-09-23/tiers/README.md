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

**This is the next thing to fix in this lane** and it is in this lane's own file: `nearLodTierFor`'s
`canopyPrefetchM` for the small tier should be sized so the prefetch demand fits the cap *minus* the
pinned set, instead of competing with it. The measurable target is `syncBuilds` per re-pose (113 → near
63) with the shown set unchanged — the reset path pins every candidate before filtering by residency, so
tightening the prefetch cannot change which parts a capture draws.

## Files

- `quality-tiers.jpg` — the north pose at quality high and low, with each panel's mean and thirds.
- `pool-small.json` — the two poses on the small memory tier, with both pools' reports.
- `bands-tiers.txt` — the metric output behind §1.
