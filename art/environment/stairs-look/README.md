# The hero stairway against the owner's 23:00 reference

The owner, 2026-09-23 23:00: *"the stairs, I don't know if they look that good or not"* — and he
sent the real game's main stairway as the reference for it
(`art/environment/owner-2026-09-23/pass5/owner-2300-reference-stairs.png`, zoomed here as
`owner-2300-reference-zoom.png`). The same climb is `reference/frames-dense/demo61/d_010`–`d_016`
(`demo-d014-flight-zoom.png`).

## Side by side, before anything changed

| | his reference | ours (`81430baf`) |
| --- | --- | --- |
| material | worn grey **stone** slabs | sandy **earth** treads with a round **timber** at every nose |
| treads | 22–24 shallow ones stacked into the mist | 20, each 0.54 m deep — about fourteen read in the frame |
| riser | ≈ 0.2 m | 0.27 m |
| nosing | a thin lit lip that **wanders** several cm along every tread, no two alike | a straight timber, ruled |
| tread surface | dark, recessive; the lip is the bright element | bright sandy earth, the brightest thing in the frame |
| edges | ragged, overgrown, no cheeks | moss at the flanks, similar |

The timber treatment came from lane 6 and is right where it came from — `demo61/d_094` / `d_104`
and the owner's `ref-03` show **log-risered** steps on the raised ledge flight. It was applied to
the hero flight as well, and the hero flight is the one he circled, in stone.

## What changed

- **`logNosings.ts`** — `LOG_FLIGHTS` loses `'main'`. The ledge flight keeps its timbers.
- **`layout.ts`** (shared, minimal) — `main` goes `20 × 0.27 × 0.54` → `26 × 0.2077 × 0.4154`. The
  run (10.8 m), the total rise (5.4 m), the bearing and the width are **unchanged**, so the foot,
  the top tread and the W04 probe at (18, −4) are exactly where they were; only the tread count
  inside that envelope moves. The riser drops further under the player controller's 0.28 m step
  guard (0.27 → 0.21).
- **`stairs.ts`** — the nosing's wander goes from one octave at ±2 cm to two octaves biased toward
  the front (−3.7 … +1.3 cm), so the lit lip moves ~4 cm peak to peak along a tread rather than
  reading as a ruled line, and can never be eaten by its own riser.

## Walkability and cost

`node gauntlet/scripts/playtest.mjs --dist dist --out /tmp/splay --only walk,climb` — **nine of
nine** walk routes reach every waypoint, **no stuck points, no stalls**.

On the main flight the climb ends at (13.739, 4.154, −5.123) after its 255 frames; the recorded
baseline (`owner-2026-09-23/play/playtest-after.json`) ends at (13.739, **4.32**, −5.123) — the
same point along the run to the millimetre, one third of a metre lower because the risers are
shallower. `reachedTop` is `false` on both: the harness does not allot enough frames to top out,
before or after. What did move is the per-frame vertical step on the flight,
`maxRisePerFrameM` **0.27 → 0.208** — the quantity behind the owner's *"it glitches the frames …
every each step"*, now 23 % smaller before the camera easing even sees it.

Triangles, measured off the builds themselves (the stone flight against the earth flight plus its
timbers, same seed, same terrain):

| | triangles |
| --- | --- |
| as shipped — 20 earth treads + 20 timbers | 31 877 |
| now — 26 stone treads | **16 956** |

**−14 921 triangles** and one draw fewer (the flight's timber mesh is gone). In the running build,
`node gauntlet/scripts/pose-counts.mjs --dist dist --out /tmp/counts.json`:

| pose | draws | triangles |
| --- | --- | --- |
| **A_stairs** | **641** | **8 929 809** |
| B_house | 631 | 8 165 509 |
| C_lookback | 498 | 6 737 457 |
| D_log | 561 | 8 491 686 |
| E_ground | 631 | 8 165 509 |
| F_canopy | 594 | 7 871 166 |

Camera A is the flight's own pose and it is the one under the cap with room to spare — 8.93 M of
9.0 M and 641 of 700 draws, against the 8.95 M / 695 it sat at before.

## Tests

`node --test src/world/hardscape/{stairs,logNosings,paving}.test.mjs` — **13/13**.

- The log tests build the **ledge** flight now (the thresholds are per riser, so they mean the same
  on whichever flight carries the timbers) and assert that the hero flight is stone.
- `paving.test.mjs`'s pinned tread-nose chain is re-pinned for the 26-step flight; the old 20-step
  values are named in the comment beside it.
- The riser-setback bands widen for the shallower tread: on a 0.415 m tread the nose and the riser
  sit closer, and a few of the twenty-five risers stand flush with their nose instead of behind it
  (worst −4.8 cm). The band still pins what it is for — no riser ever stands proud of its tread.

`npm run typecheck` and `npm run build` green.
