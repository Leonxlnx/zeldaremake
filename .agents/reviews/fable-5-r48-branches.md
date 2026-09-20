# fable-5 — independent before | after of the round-48 lane branches (goal-mode iteration 2)

The three Fable chats' goal-mode branches cannot open PRs tonight (GitHub "must be a collaborator"
for the agent identity — fable-4 and fable-3 report the same), so their reports live in the INBOX and
their PR bodies do not exist. This is the non-author check fable-cursor would otherwise get from a
PR: each branch built and rendered by me at the poses where its defect was recorded, against the
world head `3d50f6c8` rendered the same way. Sheets in `fable-5-r48/` (BEFORE | AFTER, full frame).

## Provenance

- before = `3d50f6c8` (= `3a07fc87` for `src/`; the docs commit on top changes nothing rendered),
  worktree `/tmp/f5/wt2`.
- after = each branch's head in its own detached worktree: `agent/fable-2-ledge` `ccd9a22a`,
  `agent/fable-3-lookout` `393d4337`, `agent/fable-4-r48` `d2ba4fca` (src at `f9b6c327`).
  `npm run build` (tsc + vite) green on all three; `node --test src/world/rocks/ledge.test.mjs`
  5/5, `src/world/props/geometry.test.mjs` pass, `src/world/trees/lodPool.test.mjs` 9/9 on fable-4's.
- renderer: `broll.mjs --size 1280x720 --fps 12 --test --settle 8`, no character. Poses: opus-walk
  ids seated by hand (clearing floor y 4.0 → eye 5.45; north path y ≈ 4.1; tunnel floor ≈ 4.25),
  survey-2 ids as authored, plus `x-ledge-wall` p (−1.2, 5.45, −73.6) → t (−1.2, 5.4, −76.7) (3 m
  square to the wall's middle) and `x-lookout` on the dais p (21.6, 6.75, 2.2) → t (6, 1.5, −4).
- six-view exposure, by geometry: the ledge wall (z −76.7) and fable-4's trees (z −65…−75) are
  1–7° off D_log's axis — **inside D's window through the arch at 60–75 m**; the lookout
  (21.6, 2.2) is 8.6° right of F_canopy's axis at 23.6 m, and 50–70° outside A, B/E, C, D. So D and
  F are the frames that can move. I rendered D and F on the head and on each branch with the same
  renderer (`broll.mjs`, character hidden — not byte-comparable to a take, but the before→after
  delta against `reference/frames/*.jpg` at the gauntlet's 256×144 SSIM is); the numbers are in §D.

## fable-2 — `agent/fable-2-ledge` (`ccd9a22a`): opus #03, the raised ledge

The commit's own finding matters: the layout authors `rockLedges.north-terrace` at the terrace
**lip**, and the builder on the head raised its 1.62 m wall on top of the lip facing north — away
from the clearing. That is why my iteration-1 before/after (`a0e06cf4` → `3d50f6c8`) saw no wall at
all. The branch walks the line down the slope to its foot and dresses the terrain's own 1.7 m rise.

| pose | before | after | verdict |
| --- | --- | --- | --- |
| `x-clearing-n` (7 m) | a flat dark-olive rise with a hard edge left of the flight — "the olive mound" | a dark grey rock wall the width of the clearing's north rim, humped crest with a lit rim and a moss tint on top, two vertical bulges that are the root ridges, a dark foot band | **IMPROVED — the mound is gone** |
| `x-ledge-wall` (3 m) | pebbled olive slope, a moss cushion, the terrace's pale flat cut as a lip | one large smooth humped grey rock with fine grain and faint layering; the pale cut of the terrace still shows above the crest at the west end; the flight's flank block at the right is still a flat pale box | IMPROVED |
| `x-ledge-foot` | flight + olive slope | flight + the rock mass at its left | IMPROVED (small at this bearing) |
| `x-northpath-n` (15 m) | — | a slightly darker mass left of the flight; otherwise identical | marginal at 15 m |
| `x-clearing-stones` | — | identical (looks east) | no change, as expected |

Still open after this branch, for fable-2 (not blockers for the merge):
1. At 3 m the face reads as **one smooth boulder**, not a stratified wall: no strata lines, no
   damp band, and the root ridges are the rock's own tone — ref-04's roots are bark, darker and
   ribbed, with moss on their crests.
2. **Nothing at the foot**: ref-04 has ferns and litter only at the foot; the branch's foot band is
   bare dark ground. (fern exclusion / vegetation-26 half.)
3. The **crest is a row of humps below the terrace top**, so the terrace's pale flat cut remains
   visible above the rock at the west end — the wall should carry the lip (an overhang) and hide
   the cut.
4. Height is the layout's 1.7 m rise; ref-04's wall is 3–3.5 m. That is a layout decision for
   fable-cursor (raise `ledgeTerrace` or accept the lower wall), not a rocks defect.

## fable-4 — `agent/fable-4-r48` (`f9b6c327`): four young white-barks on the clearing's banks

| pose | before | after | verdict |
| --- | --- | --- | --- |
| `x-arch-tunnel-n` (the view through the arch) | grey cones on the plain | two pale banded trunks with root toes and lime leaf crowns stand right of the path at 10–17 m, in front of the cones | **landed; the first vertical life in the tunnel view** |
| `x-northpath-n` | — | the west trunk beside the ledge, a crown overhead at the left | landed |
| `x-clearing-stones` | one thin white-bark far left | a young white-bark left of centre, its crown shadow across the bank; a second slim trunk at centre | landed |
| `x-clearing-back` | — | a trunk at the left edge, crown top-left | landed |

Notes for fable-4 / trees-31: (a) at 10–17 m the trunks are very pale and the banding is fine —
exactly the "trunk read at 5–20 m" that is fable-4's next item; (b) the crowns are lime card
clusters, brighter and yellower than everything around them in the haze (the same note as opus #05
for crowns from below); (c) not fable-4's: at `x-arch-tunnel-n` the far tree at the right edge
(x 0.85–0.98, y 0.05–0.30) has a dark blob crown with a **light-blue rim** — the same family as
opus #07's blue quads, worth a look by trees-31 / distant-1; (d) the grey cones and the flat plain
behind the new trees are unchanged — the white-barks soften opus #01, they do not close it.

## fable-3 — `agent/fable-3-lookout` (`393d4337`): the lookout railing on hardscape's dais

| pose | before | after | verdict |
| --- | --- | --- | --- |
| `w27-plateau-f` (6 m) | a pale wooden frame standing in the grass (the #13 "lip deck", 1.9 m off the dais) | four posts, two twisted rope courses, a step block at the fence side, at `LAYOUT.plateauLookout`; the deck is gone | **FIXED** (the platform is bound to the hook) |
| `w27-plateau-r` | no railing in frame | the railing at the left edge — the dais bearing | consistent |
| `x-lookout` (standing on the dais) | no railing | the plaza-side railing in the foreground: grained post, rope wraps and sag; the plaza's slabs and lantern posts below through the haze | landed; a good composition |

Notes: the stone dais itself is not readable at any of the three poses (grass and a bush hide it at
6 m; standing on it, it is under the camera) — I could not verify "posts run from the turf through
the dais" visually, only that nothing floats. The plateau-west fence rail crossing the top of both
`w27` frames is pre-existing.

## D. The two fixed frames that could move (D_log, F_canopy) — head vs each branch

Same renderer, same settle, character hidden; SSIM at the gauntlet's 256×144 against
`reference/frames/D_log.jpg` / `F_canopy.jpg`; `pixDiff` = fraction of pixels differing by > 8/255
between the head's frame and the branch's.

| branch | D_log head→branch | D vs reference (head → branch) | F_canopy head→branch | F vs reference |
| --- | --- | --- | --- | --- |
| `agent/fable-2-ledge` | SSIM 1.0000, pixDiff 0 | 0.2638 → 0.2638 (Δ 0) | SSIM 1.0000, pixDiff 0 | 0.2486 → 0.2486 |
| `agent/fable-3-lookout` | SSIM 1.0000, pixDiff 0 | 0.2638 → 0.2638 (Δ 0) | SSIM 1.0000, pixDiff 0 | 0.2486 → 0.2486 |
| `agent/fable-4-r48` | SSIM 0.9997, pixDiff **0.0008** | 0.2638 → 0.2639 (Δ +0.0001) | SSIM 1.0000, pixDiff 0 | 0.2486 → 0.2486 |

The ledge wall and the lookout railing do not reach D or F at all (pixel-identical frames — the wall
sits under the arch's belly in D's window and the railing is behind the stair bank in F). fable-4's
four trees are the only change in any fixed frame: 0.08 % of D's pixels inside the arch's window at
60–75 m, invisible at 1280 px (`fable-5-r48-f4-D_log-window.jpg`), +0.0001 SSIM. A, B/E and C do
not see any of the three by geometry. All three branches are inside the −0.003 budget with nothing
to spend.

## Summary for fable-cursor

| branch | does what its INBOX/commit says | at the defect's pose | merge risk seen |
| --- | --- | --- | --- |
| `agent/fable-2-ledge` | yes — and fixes a real bug (the wall faced away) | opus #03 IMPROVED, not closed (smooth boulder, bare foot, cut visible above the crest) | none seen; `rocks/ledge.ts` + its test only |
| `agent/fable-4-r48` | yes | four trees present at the authored spots, seated, crowned | none seen; one-line `trees/index.ts` hook |
| `agent/fable-3-lookout` | yes | the deck is gone, the railing is on the hook | none seen; `props/**` only |

All three are safe to merge from the branch on this evidence; the open notes above are their next
items, not conditions.
