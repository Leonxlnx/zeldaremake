# Props lane (fable-3) — iteration 8: the plaza's backside (round-49 handoff, GOAL_MODE fable-3 #0)

BEFORE = the world head `6d6d80f8` (expansion-2 and fable-2's W23 loaf merged), AFTER =
`agent/fable-3-backside` @ `3227a358` (`b1a07f2b` the props, `90f63fed` the `expansionCull` filter,
`09fc511e` / `3227a358` the marker moved off a bush and then west of C's shadow reach, the
backside as its own merge locality culled by `util/expansionLocality.ts`, `52e2a745` the deck pot).
Both built from clean worktrees on this VM; six views `capture.mjs --quality high --settle 12`, poses
`broll.mjs --size 1280x720 --fps 12 --test --settle 12 --quality high` with `shots.json`. Labels burned in.

## fable-cursor's item 0, piece by piece

| ask | done | where / why |
| --- | --- | --- |
| `heightfield.expansionCull(x, z)` on any sampled prop placement | **yes** — applied after `findSpot` as a filter (no stream re-rolls); a culled prop is skipped and listed in `audit.props.culledByExpansion` | `props/index.ts`; tests: the south bank's top and the far hut's knoll are culled, nothing placed is |
| a crate on the deck landing (−16.6, 6.7) | **yes, beside it** — (−16.6, 6.7) is on the landing row itself (the 1.0 m slab the deck's end rests on), where a 0.6 m crate blocks the step from the flight onto the deck; the crate stands 0.9 m south-east of the slabs on the shoulder's level ground (−15.9, 5.2), with a bucket and a pot pair (−16.55, 5.25), (−17.15, 5.55), (−16.8, 4.9): stores where the walker steps off the deck | `px-west-landing.jpg`, `-crop.jpg` |
| a signpost at the path fork (−8.9, 9.9) | **a waymarker, 2.1 m west of it** — (−8.9, 9.9) is 2 cm inside `cClip`'s 1.3 m margin (x < −8.92 at z 9.9) and 0.5 m off the south branch's disc line (culled at 0.56); the marker stands at (−11.0, 8.4): 0.9 m off the west line's discs, 2.5 m west of the margin, 2.2 m from the scatter bush at (−8.83, 8.38) that swallowed a first spot at (−9.2, 8.6), and far enough that even its padded sun-shadow footprint (2.4 m ESE) stays outside camera C's frustum — at (−10.4, 8.7) the `expansionLocality` sphere test had C drawing the whole backside for a 4 cm overlap. Signposts with text are structures' (`signpost.ts`); this is the clearing's `marker` kind, the long board pointing along the west line to the house | `px-west-fork.jpg` |
| a pot by the west-house door (−19.6, 8.2) on the platform (`walkSurfaces[0].disc.y`) | **built on the deck's mouth instead** (`52e2a745`, `onDeck`) — on the platform it cannot stand: structures publish the disc at `platR = R + 0.22` and the wall ring at `R · 0.96 ± 0.2`, so the walkable ring outside the wall is `0.04 R + 0.02` = **0.156 m** at R 3.4, and the door gap is the walk itself. The walkway's rail posts are at its middle and end (the rail anchors to the wall at the rim), so a squat pot (0.42 m) stands on the deck's top 0.55 m from the rim on the door's side (the door at bearing 103° is 0.46 m off the deck's 111° line), 0.23 m in from the edge — 0.7 m from the door point, leaving 0.5 m of the 0.95 m deck to walk. Position and height come from `walkSurfaces[0].deck` at build time; no terrain base is audited for it (it meets a built surface). Your call whether a pot on the walkway is wanted — it is one line to drop | `px-west-door.jpg` |
| a rope railing along the deck | **already there** — `distantHouse.ts` builds the walkway "with posts and a sagging rope rail" (visible left of `px-west-landing`); a second rail from props would double it | `px-west-landing.jpg` |

All of it stands on natural ground the live and legacy heightfield views share (props build on the
legacy view — the test now does too, `createTerrain('legacy')`), behind every fixed camera by
pinhole and west of camera C's clipped edge; sun shadows (1.27 m ESE per m) reach x ≈ −15.3 at most.

## Culling: the backside as its own locality

The five props first joined the `village` merge locality; its meshes' bounding sphere then reached
the west shoulder, camera C's frustum caught one more material (407 → 409 draws) and every frame
carried the new triangles through both passes (+0.01–0.02 M). They now merge as a third locality,
`backside`, shown by `util/expansionLocality.ts`'s rule — hidden beyond 60 m of the expansion box,
or when neither the props' sphere stacks nor their sun-shadow footprints swept 1.27 m ESE per metre
of height meet the camera's frustum — the same test the house, its flights and discs use, so they
appear and vanish together. 13 meshes for the system (village 5, clearing 4, backside 4; the deck pot joins the backside's clay mesh).

## Six fixed views (`six-views-after.jpg`)

| view | before SSIM | after SSIM | Δ | pHash | draws | triangles (M) | changed px |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A_stairs | 0.2179 | 0.2179 | 0 | same | 566 → 566 | 8.616 → 8.616 | 0 |
| B_house | 0.2015 | 0.2015 | 0 | same | 522 → 522 | 7.775 → 7.775 | 4 |
| C_lookback | 0.2375 | 0.2375 | 0 | same | 407 → 407 | 6.959 → 6.959 | 0 |
| D_log | 0.2765 | 0.2765 | 0 | same | 396 → 396 | 8.007 → 8.007 | 0 |
| E_ground | 0.2149 | 0.2149 | 0 | same | 522 → 522 | 7.775 → 7.775 | 4 |
| F_canopy | 0.2560 | 0.2560 | 0 | same | 507 → 507 | 7.944 → 7.944 | 0 |

Pixel-identical but for 4 pixels at threshold in B/E; draws and triangles equal the head's to the
third decimal — the six frames draw none of the backside in either pass. Re-captured at `52e2a745`
with the deck pot: the same table to the pixel. 0 console errors both sides. (An earlier table against the older head `97c83227` showed D changing 9917 px: that was
fable-2's W23 loaf, merged between the two heads, not the props.)

## Tests

`node src/world/props/geometry.test.mjs`: the five `west-house` props placed where authored (no
nudge), outside all six cameras at foot and 1.8 m, west of `cClip`'s margin, on ground where the
live and legacy views agree within 2 cm; `expansionCull` culls the bank top and the knoll and none of
the placed props; `culledByExpansion` empty; three localities, and with real cameras at the six
viewpoints the backside and the clearing are hidden and the village drawn, from the deck landing the
backside draws, far north everything is culled. `npm run typecheck && npm run build` green.
