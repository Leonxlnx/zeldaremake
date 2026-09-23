# Props lane (fable-3) — iteration 6: pots in two tones, the marker hand-hewn (fable-5's two clearing notes)

BEFORE = `67e1d411` (the branch one commit earlier — the head `de4c71b8` merged in, the measured
string; merged into the world as `dbc1d87e`), AFTER = `48a48978` (merged into the world on fable-4's
non-author review, `.agents/reviews/fable-4-review-fable-3-merge-48a48978.md`). Both built from
clean worktrees on this VM; six views `capture.mjs --quality high --settle 12`, poses `broll.mjs
--size 1280x720 --fps 12 --test --settle 12 --quality high` with `shots.json`, same batch position
each side. Labels burned in.

## What

- **Pot bodies one tone** → the clay colour map gains a broad **firing tone** (a second fbm, periodic
  in both axes): patches where the kiln ran hotter go paler toward orange (r ×1.26, g ×1.18, b ×1.09
  at the extreme), cooler ones darker toward brown-red; five sparse **slip drips** per repeat — dark
  bead runs from a random height, thinning downward; each pot samples the map from its **own UV
  offset** so no two pots carry the same patches; the vertex firing flash widens 0.06 → 0.11.
- **Crossboards clean-edged** → `board()` gains an opt-in `wobble`: each corner cluster of the
  chamfered box moves by its own offset, so no two arrises stay parallel and the ends are not
  square; the marker's post (3.5 mm), crossboards (7.5 mm, deeper chamfer) and tag (3 mm) use it.
  Every other board is byte-identical (no extra PRNG draws unless `wobble` is set).

## Six fixed views (`six-views-after.jpg`)

The clay map is shared by every pot, so the village's pots in A/C/F change too — fable-4's review
measured the clearing poses only and skipped the six views; this is that measurement.

| view | before SSIM | after SSIM | Δ | pHash | draws | triangles (M) | changed px |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A_stairs | 0.2173 | 0.2173 | 0 | same | 562 → 562 | 8.68 → 8.68 | 498 (0.054 %) |
| B_house | 0.2018 | 0.2018 | 0 | same | 518 → 518 | 7.85 → 7.85 | 0 |
| C_lookback | 0.2357 | 0.2357 | 0 | same | 403 → 403 | 7.10 → 7.10 | 1079 (0.117 %) |
| D_log | 0.2781 | 0.2781 | 0 | same | 392 → 392 | 8.10 → 8.10 | 1 |
| E_ground | 0.2135 | 0.2135 | 0 | same | 518 → 518 | 7.85 → 7.85 | 0 |
| F_canopy | 0.2558 | 0.2559 | +0.0001 | same | 503 → 503 | 8.04 → 8.04 | 575 (0.062 %) |

The changed pixels are the stair-foot pots (A, C, F); B/E's door pots at 15 m move no pixel by
more than 8 levels. 0 console errors both sides. (The SSIM levels themselves are the perf-3 head's —
A 8.68 M — not comparable to my earlier tables on `0987e060`.)

## The change at its poses (before | after, with 2× crops)

| pose | read | sheet |
| --- | --- | --- |
| `px-circle-marker` (2.9 m) | the squat pot at the marker's foot: a darker brown-red zone against a paler orange one, drips under the shoulder; the marker's boards hewn | `px-circle-marker.jpg`, `-crop.jpg` |
| `px-plateau` (the storage corner) | the squat pot: paler upper-left, darker right with faint vertical runs | `px-plateau.jpg`, `-crop.jpg` |
| `px-door` (Saria's porch pots) | the belly pot's two tones at 3 m | `px-door.jpg`, `-crop.jpg` |

**Verdict: IMPROVED** (fable-4 concurs at `x-northpath-n` / `x-clearing-stones`: 0.65 % / 0.45 % of
the frame, "broad kiln patches, faint slip drips, before one flat tone"). Subtle in shade at 2 m; a
stronger read would need the drips as relief in the normal map, next if asked.

## Tests

`node src/world/props/geometry.test.mjs`: the clay colour map's luminance spread (sd > 0.05), the
darkest percentile (drips) ≥ 0.12 under the mean, the paler patches lean warm (r/b > 1.03); the
map still reproduces byte-for-byte from the seed. `npm run typecheck && npm run build` green.
