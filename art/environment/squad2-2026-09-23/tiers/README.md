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

So the small tier neither breaks nor slows a walk at the level this harness can see. What is still
unanswered is the pool's own counters *during* a walk — `syncBuilds` per step on the non-reset path — and
I could not get it this round: the walking path only exists in play mode, and my own play-mode probe
(`walkpool.mjs` pattern: `place()`, hold `KeyW`, `step(n, dt, false)`, read the audit every 60 frames)
never got past the `__ZR_PLAY__` / `ready()` handshake, idling instead of stepping. The harness that does
know that handshake is `playtest.mjs`, and it does not read the trees' audit. Closing that gap means
either teaching a probe the handshake properly or asking the harness's owner for a pool read in the walk
scenario; the question itself is now the only open one on this tier.

## Files

- `quality-tiers.jpg` — the north pose at quality high and low, with each panel's mean and thirds.
- `pool-small.json` — the two poses on the small memory tier, with both pools' reports.
- `bands-tiers.txt` — the metric output behind §1.
