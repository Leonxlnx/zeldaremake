# fable-5 — non-author pre-merge check: `agent/fable-2-tread-tone` @ `2365b63b` (the flight's tops shade per vertex — `buildSlab vertexTone`) — 2026-09-24 20:25–20:58 UTC

The commit: one tone per 0.5 m quad "read as a patchwork of facets at the survey poses on the treads (1.5–2 m)"; the
treads now sample the colour function at each corner and interpolate. Head `31146062` (the branch's base) against the
branch, the same deterministic capture.

## The six views — untouched

| view | SSIM | pixels changed | vs reference | Δ |
| --- | --- | --- | --- | --- |
| A_stairs | 1.0000 | 0.01 % | 0.1730 → 0.1729 | −0.0001 |
| B_house | 1.0000 | 0.01 % | 0.1693 → 0.1694 | 0 |
| C_lookback | 1.0000 | 0.01 % | 0.1776 → 0.1776 | 0 |
| D_log | 0.9999 | 0.07 % | 0.2336 → 0.2333 | −0.0002 |
| E_ground | 1.0000 | 0.00 % | 0.1902 → 0.1902 | 0 |
| F_canopy | 1.0000 | 0.01 % | 0.2030 → 0.2028 | −0.0002 |

Merge-safe by the budget; at A (the flight at 6–10 m) the change is 0.01 % of the pixels.

## The tread poses — measurable, not visible

`survey2` `w23-stairs-d`, `w24-stairs-d` (on the treads, looking down 1.5–2 m ahead) and `w25-stairs-f` (up the run):

| pose | pixels changed > 8 | > 4 | where | |Δ| p95 / max |
| --- | --- | --- | --- | --- |
| w23-stairs-d | 1.3 % | 4.9 % | the nearest tread at the frame's foot (34 % of the bottom-centre quarter) | 12 / 24 |
| w24-stairs-d | 0.1 % | ≈ 1 % | the frame's foot | 9 / — |
| w25-stairs-f | 0.1 % | ≈ 1 % | the frame's foot | 9 / — |

The mechanism works as written — the amplified difference (`fable-5-lane10/tread-tone-nearest-treads-diff.jpg`, |Δ| × 8)
draws the nearest tread's quads as gradients, each triangle now a ramp between its corners — but the amplitude is a p95 of
12 levels: at 1280 × 720 the two frames read the same (`tread-tone-w23-treads-crop.jpg`), and **the rectangular patches on
the upper treads in that crop are in both frames.** So either the facets the commit names are not the colour function's
per-quad sampling (the damp blotches' fbm at 1.7 cycles / m changes by under 12 levels across a 0.5 m quad; the wear,
crack and mottle terms are still per triangle, and the atlas tiles per slab) or they read at a pose other than these three.
**By the loop's rule this is an after that looks like its before — reported, not claimed.** fable-2 has the poses; a
before/after of his own at one of them, with the crop, is what the merge wants.

## `f6fa109e` (23:19 — the slab walls' grime is a foot → shoulder gradient in the vertex colour; found with `?stoneDebug=vcolor`) — 23:33–00:03 UTC

fable-2's answer to the null result: the facets were never the tops' tone — the walls' grime sat on each quad's first triangle
whole while the second went clean, a dark triangle beside a light one on every riser and flank. Same capture, head `31146062`
(the branch's base) against `f6fa109e`:

| pose | pixels changed > 8 | > 16 | max | where |
| --- | --- | --- | --- | --- |
| w23-stairs-d | **7.5 %** (was 1.3 % at `2365b63b`) | 0.1 % | 28 | the risers and flanks — the diagonal split gone (`tread-tone-f6fa109e-w23-treads-crop.jpg`) |
| w24-stairs-d | 5.0 % | 0.0 % | 28 | the risers |
| w25-stairs-f | 2.9 % | 0.0 % | 25 | the risers up the run |

The six views: A 0.9994 (0.29 %, 87 % of it in the flight box, +3.4 luma), B 1.0000, C 0.9999, D 0.9999, E 1.0000, F 0.9993 (0.35 %,
sway); Δ vs the reference 0 … −0.0002. **This time the after is not the before: the top riser reads as one gradient where the head
shows the split.** Merge-safe.
