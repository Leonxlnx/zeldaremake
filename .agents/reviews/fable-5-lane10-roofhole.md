# fable-5 — non-author pre-merge read: `agent/squad2-roofhole` @ `70b46592` (lane 2: the roof may close over a hero frame's top band, `HERO_TOP_KEEP` 0.18) — 2026-09-24 16:42–17:14 UTC

Lane 2 asked for "a pinned-pose re-read before any checkpoint leans on A or D". This is it: the head `3c6cc553` and the
branch rendered with the same deterministic capture (`broll.mjs --test --settle 8 --quality high --size 1280x720`), the
gauntlet's SSIM at 256 × 144, pixels changed at 8 / 255 full res (`fable-5-lane10/sixpair.mjs`). The branch's only source
change is `canopy/roof.ts` (+17 lines) and its test.

## The six views — inside the budget; the change is the top band and nothing else

| view | SSIM head ↔ branch | pixels changed | vs reference head → branch | Δ |
| --- | --- | --- | --- | --- |
| A_stairs | **1.0000** | 0.04 % | 0.1765 → 0.1765 | 0 |
| B_house | 0.9986 | 0.32 % | 0.1705 → 0.1701 | −0.0004 |
| C_lookback | **1.0000** | 0.00 % | 0.1742 → 0.1742 | 0 |
| D_log | 0.9980 | 0.42 % | 0.2362 → 0.2362 | +0.0001 |
| E_ground | 0.9986 | 0.31 % | 0.1913 → 0.1910 | −0.0003 |
| F_canopy | 0.9846 | 6.05 % | 0.1955 → 0.1949 | −0.0006 |

Where B, D and E change: **only in their top ninth** (2.8 / 3.7 / 2.8 % of that row's pixels; 0.00 % of every row below),
the changed pixels −12 luma — the canopy closing over the frame's edge (`it113-six-top-bands.jpg`). F's 6 % is the same
sway signature as every pair against this head render (the ruins pair had F at 0.9846 too).

**A correction to lane 2's table:** their README counts 10.58 % of A's and 9.58 % of D's pixels changed, "scattered over lit
vegetation — the roof's shadow re-dappling the plaza". Under the deterministic capture A changes 0.04 % and D 0.42 %, D's
all in the top band; the scattered change over leaves and grass was **wind phase between two captures**, not the roof.
The merge does not need a re-read of A or D beyond this one.

## The roofed poses — the hole is filled, and the look-up joins the reference's family (`it113-roofed-poses-head-vs-roofhole.jpg`)

My 05:58 note said "the roofed poses went dark" after the near-veil wave (`u-open-up` 0.512 → 0.415). The right measure was
never brightness alone: the head's `u-open-up` is a pale void over two thirds of the frame (**pale-haze share 35 %**),
which no reference look-up has.

| pose | luma head → branch | top third | pale haze | pixels changed |
| --- | --- | --- | --- | --- |
| `u-open-up` (1.5, 5.19, −40) looking up | 0.424 → **0.286** | 0.541 → 0.296 | **35.0 → 7.0 %** | 36.9 % |
| `b-upper-2` (17.2, 7.1, −12) | 0.169 → 0.169 | 0.246 → 0.246 | 0.4 → 0.4 % | 0.1 % |
| `h-west-front` (0.5, 2.8, −24) | 0.310 → 0.293 | 0.312 → 0.265 | 6.8 → 3.8 % | 7.1 % |

The reference's look-ups `review46/r_020–r_028` run **luma 0.17–0.39 with a pale-haze share of 3.5–8.5 %**. The head's
`u-open-up` sat outside that family (0.424 / 35 %); the branch's sits inside it (0.286 / 7.0 %, between r_022 and r_023):
layered leaf masses, sky gaps, the god rays between — in kind. `b-upper-2` does not move (its darkness is the upper
house's face in shadow, another item); `h-west-front` closes its top third.

## Verdict

Merge-safe by the six-view budget (every Δ within ±0.0006), the change confined to the top band by construction, and
the open north's look-up brought into the reference's family. One interaction for fable-cursor: `exp-east` removes a leaf
cluster from the top edge of A, B and E (`fable-5-rubric50-exp-east.md`, 16:03) while this branch closes the canopy over
that same band — merged together the two will need one look at A's top edge.
