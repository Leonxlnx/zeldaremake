# Props lane (fable-3) — iteration 2: the lookout railing on the dais hook + `propFootprints`

BEFORE = the world head `eec1ce09` (PR #13 merged + round 47/48 merges), AFTER = `agent/fable-3-lookout`
@ `393d4337`, both built and rendered on this VM with the same commands: six views
`capture.mjs --quality high --settle 12`, poses `broll.mjs --size 1280x720 --fps 12 --test --settle 12
--quality high` with `shots.json` here. Labels burned into each tile. Our own renders only.

## Six fixed views (`six-views-after.jpg`, `F-canopy-before-after.jpg`)

| view | before SSIM | after SSIM | Δ | pHash | draws | triangles (M) | changed px |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A_stairs | 0.2195 | 0.2195 | 0 | same | 568 → 568 | 9.09 → 9.09 | 0.00 % |
| B_house | 0.2042 | 0.2042 | 0 | same | 526 → 526 | 8.31 → 8.31 | 0.00 % |
| C_lookback | 0.2393 | 0.2393 | 0 | same | 393 → 393 | 7.59 → 7.59 | 0.00 % |
| D_log | 0.2792 | 0.2792 | 0 | same | 394 → 394 | 8.51 → 8.51 | 0.00 % |
| E_ground | 0.2144 | 0.2144 | 0 | same | 526 → 526 | 8.31 → 8.31 | 0.00 % |
| F_canopy | 0.2601 | 0.2601 | 0 | same | 511 → 511 | 8.53 → 8.53 | 0.00 % |

All six frames are pixel-identical (|Δ| > 8 on no pixel): the lookout projects into F at
x 0.56–0.65, y 0.21–0.23, where the stair-bank giant's crown fills the frame in front of it
(`F-canopy-before-after.jpg`, bottom row is that crop), and A–E do not hold the plateau lip. Camera
A is 9.09 M triangles before and after (the world head is already over the 9.0 M mark; props add
nothing to A). 0 console errors both sides. The after build is a different build (dist hash
`6a8b21cf…` vs `44a2b132…`; its props audit lists `lookout-railing` at (21.6, 2.2) and 16 footprints).

## The change at its poses

| pose | before | after | sheet |
| --- | --- | --- | --- |
| `px-lookout` (from the fence end, looking south-west at the hook) | my #13 deck at (23.5, 2.65) stands 1.9 m from the dais hook as a second platform, in the foreground | the deck is gone; the railing stands at `LAYOUT.plateauLookout`: four posts 0.88 m over the slab top, two rope courses with lashings on the plaza side and both short sides, a step block on the fence side | `px-lookout.jpg` |
| `px-lookout-side` (from the plateau, the fence behind) | the deck's corner post and boards | the railing in profile against the plaza; the plateau-west fence's last posts behind it | `px-lookout-side.jpg` |
| `px-lip` (the #13 pose) | the deck with its railing | lawn; the new railing at the left edge | `px-lip.jpg` |

**Verdict: the railing is at the hook and built as specified; the composition is not yet "one
built thing" — for a reason outside this lane.** Hardscape draws its `flagstones-north` mesh (the
north paving AND the lookout dais, merged in one geometry) only within 45 m of the north clearing's
bounding box (`NORTH_PAVING_VISIBLE_M`, `hardscape/index.ts`); the dais at (21.6, 2.2) is 55–58 m
from that box from camera F and from every plateau pose, so **the stone dais is never drawn where
a player or a fixed camera can see it** while `character/ground.ts` still learns its top (the
player stands 0.35 m up on invisible stone). Both BEFORE frames show it: no slab at the frame
centre where `LAYOUT.lookout` is. The railing therefore stands in the lawn for now; its posts were
made to run from the turf up through the slab so they read set into the stone once it draws and
never float while it does not. Reported to fable-cursor / hardscape-31 in the INBOX with these frames.

## Also in this branch

`ctx.shared.propFootprints` is now published from `props/index.ts` (the field and the props-before-
vegetation order landed at merge; the writer did not) — `{ x, z, r }` per placed prop, 16 entries,
also in the props audit as `footprints`. The lawn under the railing in the AFTER frames is what
vegetation-26 will clear when it reads the list (the lookout's disc is r 1.46 m at the hook).

## Commands

```
node src/world/props/geometry.test.mjs   # 16 meshes, 43 484 triangles, skipped: []
npm run typecheck && npm run build
node gauntlet/scripts/capture.mjs --dist <dist> --out <dir> --quality high --settle 12
node gauntlet/scripts/broll.mjs --dist <dist> --out <dir> --size 1280x720 --fps 12 --test --settle 12 --quality high --shots shots.json
node gauntlet/scripts/compare.mjs --in <dir> --ref reference/frames
```
