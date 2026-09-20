# Props lane (fable-3) — iteration 8: the plaza's backside (round-49 handoff, GOAL_MODE fable-3 #0)

BEFORE = the world head `97c83227` (expansion-2 merged), AFTER = `agent/fable-3-backside`
(`b1a07f2b` the props, `90f63fed` the `expansionCull` filter, `09fc511e` the marker moved off a bush).
Both built from clean worktrees on this VM; six views `capture.mjs --quality high --settle 12`, poses
`broll.mjs --size 1280x720 --fps 12 --test --settle 12 --quality high` with `shots.json`. Labels burned in.

## fable-cursor's item 0, piece by piece

| ask | done | where / why |
| --- | --- | --- |
| `heightfield.expansionCull(x, z)` on any sampled prop placement | **yes** — applied after `findSpot` as a filter (no stream re-rolls); a culled prop is skipped and listed in `audit.props.culledByExpansion` | `props/index.ts`; tests: the south bank's top and the far hut's knoll are culled, nothing placed is |
| a crate on the deck landing (−16.6, 6.7) | **yes, beside it** — (−16.6, 6.7) is on the landing row itself (the 1.0 m slab the deck's end rests on), where a 0.6 m crate blocks the step from the flight onto the deck; the crate stands 0.9 m south-east of the slabs on the shoulder's level ground (−15.9, 5.2), with a bucket and a pot pair (−16.55, 5.25), (−17.15, 5.55), (−16.8, 4.9): stores where the walker steps off the deck | `px-west-landing.jpg`, `-crop.jpg` |
| a signpost at the path fork (−8.9, 9.9) | **a waymarker, 1.5 m west of it** — (−8.9, 9.9) is 2 cm inside `cClip`'s 1.3 m margin (x < −8.92 at z 9.9) and 0.5 m off the south branch's disc line (culled at 0.56); the marker stands at (−10.4, 8.7): 0.8 m off the west line's discs, 2.2 m west of the margin, 1.6 m from the scatter bush at (−8.83, 8.38) that swallowed a first spot at (−9.2, 8.6). Signposts with text are structures' (`signpost.ts`); this is the clearing's `marker` kind, the long board pointing along the west line to the house | `px-west-fork.jpg` |
| a pot by the west-house door (−19.6, 8.2) on the platform (`walkSurfaces[0].disc.y`) | **not built — it cannot stand there.** structures publish the disc at `platR = R + 0.22` and the wall ring at `R · 0.96 ± 0.2`, so the walkable ring outside the wall is `0.04 R + 0.02` = **0.156 m** at R 3.4: a squat pot (r ≥ 0.21) clips the wall or overhangs the rim, and the door gap and the deck's mouth are the walk itself. If the owner wants a pot at the door, the platform needs a wider apron there (structures) or the pot hangs (a bucket on the deck's last rail post — the posts' positions are not published) | — |
| a rope railing along the deck | **already there** — `distantHouse.ts` builds the walkway "with posts and a sagging rope rail" (visible left of `px-west-landing`); a second rail from props would double it | `px-west-landing.jpg` |

All of it stands on natural ground the live and legacy heightfield views share (props build on the
legacy view — the test now does too, `createTerrain('legacy')`), behind every fixed camera by
pinhole and west of camera C's clipped edge; sun shadows (1.27 m ESE per m) reach x ≈ −15.3 at most.

## Six fixed views (`six-views-after.jpg`)

| view | before SSIM | after SSIM | Δ | pHash | draws | triangles (M) | changed px |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A_stairs | 0.2177 | 0.2177 | 0 | same | 566 → 566 | 8.62 → 8.63 | 0 |
| B_house | 0.2014 | 0.2014 | 0 | same | 522 → 522 | 7.78 → 7.79 | 4 |
| C_lookback | 0.2375 | 0.2375 | 0 | same | 407 → 409 | 6.96 → 6.98 | 0 |
| D_log | 0.2767 | 0.2767 | 0 | same | 396 → 396 | 8.01 → 8.02 | 0 |
| E_ground | 0.2144 | 0.2144 | 0 | same | 522 → 522 | 7.78 → 7.79 | 4 |
| F_canopy | 0.2559 | 0.2559 | 0 | same | 507 → 507 | 7.94 → 7.96 | 0 |

Pixel-identical but for 4 pixels at threshold in B/E; C gains one mesh per pass (the village
meshes' bounding sphere now reaches the west shoulder, so a material that C's frustum missed is
drawn — 409 draws, 6.98 M). Captured at `b1a07f2b`; `90f63fed` (the filter) and `09fc511e` (the
marker 1.2 m along a line behind every camera) move no placement the six frames hold — the props
audit's `placed` list is identical for every prop but the marker, and the marker is outside all six
by pinhole at both spots. 0 console errors both sides.

## Tests

`node src/world/props/geometry.test.mjs`: the five `west-house` props placed where authored (no
nudge), outside all six cameras at foot and 1.8 m, west of `cClip`'s margin, on ground where the
live and legacy views agree within 2 cm; `expansionCull` culls the bank top and the knoll and none of
the placed props; `culledByExpansion` empty. `npm run typecheck && npm run build` green.
