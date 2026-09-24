# squad2 — the level veil at full share, on a ramp that reaches the crowns

Continuing lane 2's canopy-tone thread after `agent/squad2-softedge` was merged (`cc02a9cf`, and
fable-cursor's full check on the merged head put every hero view under the cap — A 639 draws / 8.87 M).
Two things in this branch:

1. **The two commits that merge missed** — the ramp at 16–38 m and its report, cherry-picked here
   (`2c416592`, `9d888866`). The merged head still had `CROWN_VEIL.m = [14, 52]`.
2. **The colour step named at the end of the last hour**, which turned out not to need the crowns' albedo
   at all.

## The change

`CROWN_VEIL` goes to **share 1.0 on a 16–30 m ramp**. Neither can overshoot, and that is the design:
`lift = [0.55, 0.82]` stops every fragment at the reference's own relation between its foliage and its air
(`r_025`: 0.436 / 0.539 = 0.809), so the share only decides how *fast* a crown reaches that relation and
the ramp only *where*. At 0.85 on the old ramp the arithmetic put the veil 0.27–0.52 of the way on where
hero A's crowns stand, so there was room to give.

The near edge does not move: a crown 17 m off takes 0.02 of the veil. The reference's own trees at that
range are still dark and saturated, and this lane's mid canopy is what made the middle distance read as
trees at all (fable-5, 10:28: "the corridor is populated and warm now").

## What it does

| box | head (0.85, 14–52) | **now (1.0, 16–30)** | `r_025` for scale |
| --- | --- | --- | --- |
| hero A, the crown box (x 0.72–1, y 0.08–0.32) | 77.4 | **81.8** | 124.3 (its canopy band) |
| hero A, the canopy crop (x 0.55–1, y 0.02–0.45) | 80.3 | **82.3** | — |
| hero D, its canopy box | 136.4 | **137.1** | — |
| `owner-0650-north`, top third (the canopy) | 95.8 | **97.1** | — |
| `owner-0650-north`, **middle third (eye level)** | 71.7 | **71.7** | — |
| `rec-r024-plaza-fork`, top third / middle third | 87.4 / 81.3 | **88.2 / 81.3** | — |

The selectivity is the result: at both of the owner's walking poses the **eye-level band does not move at
all** while the canopy above it lifts, and the north band's within-column structure goes 18.80 → 19.55
against the reference's 22.03. Every pose moves 1.3–2.4 % of its pixels, all of it in the canopy.

![hero A's canopy, before and after](hero-A-canopy.jpg)

![the owner's north walking pose, before and after](owner-north.jpg)

The look-ups are untouched by construction — the crown gate is shut above 26°, whatever the share (measured
0.00 % on both look-up poses in the previous round).

## The one figure that moved the wrong way

In hero A's crown box the mean step across a leaf-to-sky boundary goes 6.6 % → 7.8 % (the reference's is
2.6 %). Part of that is the split moving under the metric — a veil lifts pale foliage across a fixed
luminance split, so the class that remains is darker and the step between classes grows — and part is real:
the far crowns are now paler while the near shrubs in the same box are as dark as they were, which is depth
separation, the thing the reference has. It is reported rather than explained away: if a reviewer reads it
as the cut-out failure returning at level views, the share is one constant and 0.85 is measured above.

## Cost

No geometry, no new draw, no new texture: the change is two numbers in a fragment-shader term, on the head
whose counts fable-cursor has already measured under the cap.

## The ramp's last step, a test, and what is no longer this lane's (12:20–12:45)

`m` goes to **16–26 m**, which is where the walking in stops: at 25 m the veil is 0.90 of the way on where
the first ramp gave 0.17, and the step from 16–30 buys only 0.2 of a level at hero A's crown box
(81.8 → 82.0) — the term is saturated where a level view's crowns stand. The near edge has not moved
through any of this: a crown 17 m off takes 0.03 of the veil, and the owner's north pose still reads 71.7
at eye level with its canopy at 97.3.

**`crownVeil.test.mjs` (4 tests)** pins what is otherwise one number inside a string of GLSL:

- the giants' cards take the veil as the eye **climbs** and the crown cards on the **level** — asserted
  both in the emitted source and in the constants, so an edit cannot pass one and fail the other;
- a crown 17 m off keeps its own colour (≤ 0.05 of the veil) while one at 30 m is at least 0.75 veiled;
- neither veil takes a fragment past the reference's own foliage-to-air relation (0.436 / 0.539 = 0.809),
  which is fable-cursor's "only as much as the reference's r_025 band" as a per-fragment rule;
- the mix is toward `kfColor` after the fog chunk, not the `fogColor` uniform, which reads nothing because
  the chunk runs after the colour-space encode.

**The remainder is the air, and here is its size.** In our canopy box the air reads 0.455 where the
reference band's reads 0.539 — 21 levels darker. Because the crowns' cap is a *relation to their air*, a
perfectly veiled crown of ours can only reach 0.809 × 0.455 = 0.368 (94 levels) while the reference's
foliage sits at 0.436 (111 levels). So about 17 levels of the remaining gap cannot be closed from this
lane at all without breaking the rule the review set; it is the air's own level in the 20–40 m band
(lane 1). This is the same finding as the look-up one from the other side — there our sky was too *bright*
(0.672 against 0.518) — so the air is off in both directions depending on where the eye points, which is
worth one measurement pass by whoever owns the sky and the in-scatter.

**Still reported against this thread:** the mean step across a leaf-to-sky boundary in hero A's crown box
has gone 6.6 % → 7.8 % → 8.0 % as the veil strengthened (the reference's is 2.6 %). Part is the fixed split
moving under the metric and part is real depth separation, but if a reviewer judges the level-view contrast
worse, the fallback is one constant: share 0.85 on the 16–38 m ramp, measured in §5 of the softedge report.

## Next

Not the crowns' albedo, which was the plan before the numbers above: raising it would take the foliage past
the relation its own air justifies, which is how the first attempt at this became "a paler card is still a
card". The open items are the air's level in the 20–40 m band (lane 1, sized above) and, in this lane, the
crowns' silhouette — where the main cards' span is the lever and shot D's skyline is what it would move
(recorded at `FAR_CROWN_LOBES` in `distant.ts`).
