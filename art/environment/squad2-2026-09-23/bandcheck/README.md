# The lane's open review ask, measured on today's head — and two levers that both move away from it

Lane 2, 2026-09-27. No lane-2 item was open in the inbox (newest lane-2 thread 09-26 03:30,
answered) and the integration head has not moved since 09-27 01:24, so this round took the lane's
oldest *unclosed* item: the review note in `docs/SQUAD_2026-09-23.md` under "Review notes for the
lanes", from fable-5 (lane 10) at 09-23 10:28 on `6664f739`:

> **Lane 2:** the 14–58 m crowns keep their local colour (green s 0.15 / l 0.29 vs his 0.05 / 0.42)
> — his distant crowns are pale warm silhouettes most of the way to the mist with light between
> them; and they roof the path's top band (0.335 → 0.232, his 0.418) where his recording keeps
> bright canopy gaps over the path. Give the mid crowns more of the veil with distance and keep the
> sky over the path open.

**This round is a measurement, not a pixel change.** The ask measures as met, and the two levers
still available in this lane both move the frame *away* from the owner's numbers. Both results are
below with the runs behind them, because a negative result that protects a tuned value is worth as
much as a change.

## 1. The ask, on today's head

The owner's 06:50 north pose (`owner-0650-north`), 960×540, `--settle 6`, measured with fable-5's
own metric (`.agents/reviews/fable-5-lane10/bands.py`, band rows 0.12–0.50, far-centre box x
0.30–0.70 × y 0.15–0.40):

| | mist % | brown % | dark % | leaf % | band mean l | far-centre box |
| --- | --- | --- | --- | --- | --- | --- |
| at the note (09-23) | — | — | 49 | — | 0.230 | s 0.15 / l 0.29 |
| **today** | 14.7 | 26.5 | **21.2** | 20.9 | **0.321** | **s 0.06 / l 0.466** |
| the owner's r_024 | — | — | 12 | — | 0.394 | s 0.05 / l 0.474 |

**The lane-2 half is met.** The far-centre box — the 14–58 m crowns the note is about — is s 0.06 /
l 0.466 against his s 0.05 / l 0.474: within 0.01 saturation and 0.008 lightness. It was s 0.15 /
l 0.29 when the note was written.

The sky over the path is open too. By horizontal strip:

| rows | mean l | dark < 0.20 | mist | leaf | brown |
| --- | --- | --- | --- | --- | --- |
| 0.00–0.08 | 0.377 | 16.0 % | 34.8 % | 7.5 % | 18.0 % |
| 0.08–0.16 | 0.384 | 10.3 % | 29.7 % | 7.0 % | 22.9 % |
| 0.16–0.24 | 0.346 | 12.7 % | 12.0 % | 6.0 % | 27.2 % |
| 0.24–0.32 | 0.352 | 13.9 % | 22.4 % | 7.0 % | 25.3 % |
| 0.32–0.40 | 0.317 | 22.4 % | 19.8 % | 26.5 % | 27.6 % |
| 0.40–0.50 | 0.254 | 37.0 % | 1.3 % | 44.6 % | 27.2 % |
| 0.50–0.62 | 0.234 | 36.1 % | 0.2 % | 67.3 % | 18.6 % |

The top four strips — the canopy gaps and the crowns against the mist — sit at 0.346–0.384 against
the owner's band figure of 0.394, with 10–16 % near-black against his 12 %. **The band's remaining
gap is entirely in its bottom third**, rows 0.32–0.62, where leaf coverage goes 26 % → 67 % and
lightness falls to 0.234: that is ground cover and the near verges, not the middle-distance crowns.

## 2. Which of this lane's layers owns what

Same pose, frozen clock, one tree family hidden at a time (`bandprobe.mjs` pattern; the handle is a
one-line temporary hook, documented in `depthfoot/depthprobe.mjs`):

| frame | mist % | dark % | band mean l | far-centre box l |
| --- | --- | --- | --- | --- |
| base | 14.8 | 21.6 | 0.321 | 0.466 |
| understory hidden (13 meshes) | 20.4 | **18.4** | 0.341 | **0.495** |
| mid layer hidden (10 meshes) | 13.4 | 21.6 | 0.320 | 0.465 |
| distant ring hidden (7 meshes) | 16.2 | 21.6 | 0.324 | 0.469 |

- The **understory** is this lane's only material contributor to the band's darkness: 3.2 of the
  21.6 points, 0.020 of the band's lightness, 0.029 of the far-centre box.
- The **mid layer** darkens nothing (0.001 l) and yet hiding it *lowers* the mist count by 1.4
  points, which is the ask restated as a measurement: its crowns are already pale enough that the
  metric counts them as mist while they still fill the middle distance.
- The **distant ring** is 0.003 l.
- Removing this lane's whole understory still leaves 18.4 % near-black against the owner's 12 %, so
  the rest of the gap is outside lane 2's layers.

**And the understory's darkness is load-bearing.** Hiding it takes the far-centre box from 0.466 to
0.495 — past the owner's 0.474. Lightening the understory to chase the band's mean would overshoot
the very number the note asked for, so it stays.

## 3. The medium→low rung, bracketed from both sides

Round 53 measured this gate outward (44 → 59 m: +45–54 K triangles, no frame change) and left it at
44 m. That invites the inverse guess — if it is neutral outward it can be pulled in for free — and
that guess is wrong. At the owner's north pose, `?treelod=1,<k>,1` with `diffmap.mjs` (> 8 levels):

| gate | frame changed |
| --- | --- |
| 70 m (k 1.6) | **0.01 %** |
| 44 m (shipped) | — |
| 35 m (k 0.8) | **0.71 %** |

44 m is the edge itself: the medium rung's extra laminae still read at 35–44 m and stop reading past
it. Moving this gate costs either triangles for no frame or frame for a few triangles. The rationale
comment on `TREE_LOD_MID_M` now carries both sides so the next round does not re-litigate it.

## 4. The pole with confetti at ~55 m — and the correction that it is not a tree

At (0.46, 0.13) of this pose something reads as a bare pale pole with a scatter of small dark specks
where a crown would be (`pole-confetti.jpg`, 7×). My first note here flagged it as white-bark crown
authoring. **That was wrong, and the follow-up is worth more than the flag:**

- Forcing every tree to its highest LOD (`?treelod=10`) leaves that region **pixel for pixel the
  same**, so no rung of any instanced family draws it.
- Hiding, one at a time, the white-barks (13 meshes), the columns (12), the giants (21), the
  far-foliage batches (3) and the understory (13) — screenshotting while each set is hidden — leaves
  the pole in place every time. It is not in the trees group at all.

So it belongs to another system (the north grove's trunk house and the vegetation there are the
candidates) and this lane has nothing to fix. Whoever picks it up should know it reads as a pole
with confetti at this range.

**The instrument that misled me, for everyone's benefit:** `__ZR__.isolate(system)` renders one
frame internally and then **restores every child's visibility before it returns**, so a
`page.screenshot()` taken after it shows the *full* frame, not the isolated system. Itscounts are
real (it reads `renderer.info` while the scene is isolated — `playcost.mjs` is unaffected), but it
cannot be used to capture a picture of one system. To attribute a pixel to a system you have to hide
the meshes yourself and screenshot while they are hidden, which is what the probes above do.

## Files

- `north-today.jpg` — the pose as it renders on today's head, and the frame every number above is measured on.
- `strips.py` — the per-strip breakdown in §1 (fable-5's `hls` with the same thresholds).
- `bands-runs.txt` — the raw metric output for every frame in §1–§3.
- `pole-confetti.jpg` — §4, the region at 7×, base / distant hidden / mid hidden.
- `pole-not-a-tree.jpg` — §4's correction: the same region with, in turn, nothing hidden, the
  white-barks, the columns, the giants, the far-foliage batches and the understory hidden. The pole
  is in all six.
