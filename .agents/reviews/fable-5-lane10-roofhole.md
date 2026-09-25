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

## The tip `9af8f36d` (17:30 — three south bands: the far bank, the log's mouth, the ravine's airspace; lane 2 measured C at 0.55 %) — 17:33–17:56 UTC

Same capture, the head and the tip; and the tip against `70b46592` to isolate the south bands (`it114-C-top-band.jpg`):

| view | head ↔ tip | pixels changed | vs reference head → tip | Δ | `70b46592` ↔ tip |
| --- | --- | --- | --- | --- | --- |
| A_stairs | 1.0000 | 0.04 % | 0.1765 → 0.1765 | 0 | 1.0000 / 0.00 % |
| B_house | 0.9986 | 0.32 % | 0.1705 → 0.1701 | −0.0004 | 1.0000 / 0.00 % |
| **C_lookback** | **0.9978** | **0.54 %** | 0.1742 → **0.1757** | **+0.0015** | **0.9978 / 0.54 %** |
| D_log | 0.9980 | 0.42 % | 0.2362 → 0.2362 | +0.0001 | 1.0000 / 0.00 % |
| E_ground | 0.9986 | 0.31 % | 0.1913 → 0.1910 | −0.0003 | 1.0000 / 0.00 % |
| F_canopy | 0.9846 | 6.05 % | 0.1955 → 0.1949 | −0.0006 | 1.0000 / 0.00 % |

The south bands touch **C only** — 0.54 % of its pixels, 4.67 % of the top ninth and 0.17 % of the second, nothing below,
−22 luma: lane 2's "0.55 %, y 0–0.13, Δ 22 levels" to the decimal — and C ends **closer** to the reference (+0.0015). A, B, D,
E and F are pixel-identical to `70b46592`. Every Δ against the reference across the six is within +0.0015 … −0.0006.

**At player height on the far bank** (`it114-south-lookups-head-vs-tip.jpg`; the follow camera, Link at the south sill
(4.06, −0.17, 42.8)): looking up 60° the head's frame is a pale void over its top two thirds — **pale-haze share 65.9 %,
luma 0.573**; the tip closes it to canopy with a god ray and sky gaps — **20.3 %, 0.340**. Still more open than the
reference's look-ups (3.5–8.5 %), which lane 2 names as the pale opening high over the mouth and the next measurement.
The look-back over the village from the same sill and the bridge's north end do not move (0.1 % / 0.0 % of pixels;
the roof adds +1 draw and 1.4–4 k triangles there; the look-back stays at the head's own 855 draws / 10.19 M).

**Verdict for `9af8f36d`: merge-safe by the six-view budget**; the south exit's look-up joins the north's in kind, the
mouth's opening the next band.

## `c012ca34` (22:47 — the roof reaches the north grove, `ROOF_GROVE_BOUNDS`; based on the head `b9993008` with the grove in it) — 23:33–00:03 UTC

Play-mode poses on the head and on the tip (`it120-grove-eye-level-head-vs-roof.jpg`, `it120-grove-lookups-head-vs-roof.jpg`):

| pose | luma head → tip | under 0.25 | pale haze | pixels changed |
| --- | --- | --- | --- | --- |
| the trunk house's door, the gangway's head, the stilt house from the yard, the rope walk (eye level) | **identical to the third decimal** (0.257 / 0.307 / 0.373 / 0.329) | 56 / 43 / 19 / 37 % → the same | the same | 1.4–4.8 % (sway) |
| **the yard looking up 60°** | **0.336 → 0.143** | 59 → **92 %** | **39.5 → 3.8 %** | 56.6 % |
| the veranda looking up 60° | 0.327 → 0.198 | 57 → 79 % | 32.4 → 8.5 % | 47.3 % |

Two findings for lane 2. **The hamlet at eye level does not move** — the number their one render lacked: the roof's clumps put no
shade on the yard, the gangway or the veranda (luma identical to the third decimal at four poses). **The look-ups close hard:**
the yard's pale void (39.5 %) becomes a ceiling of leaf mass at luma 0.143 with 92 % of the frame under 0.25 — one flat dark sheet
with a god ray and a few small holes, against the north's closed look-up at 0.286 with layered masses and bright gaps (`70b46592`,
17:14) and the reference's darkest at 0.170. The veranda's (0.198, 79 %) is in range. The grove's band sits lower over its
shelf than the north's over the approach, and reads as a lid; a thinner or higher band over the hamlet — or the north's
gap share — is the note. The six views cannot see the grove (the stand pass's 50 m hero drop; the grove is out of A–F on the
head at 0.9997 … 1.0000), so no re-pair here.
