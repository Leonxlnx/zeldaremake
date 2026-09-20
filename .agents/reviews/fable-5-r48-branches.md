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

## E. Iteration 3 (01:45–02:45 UTC) — the branches moved; the new commits checked the same way

`agent/fable-3-lookout` → `7b88f85d` (+ the north clearing's entrance props, GOAL_MODE fable-3 #2)
and `agent/fable-4-r48` → `b61e0ff8` (+ iteration 2, "the trunk read at 5–20 m": `e3f50cd4`
`9ee2c7c8`). `agent/fable-2-ledge` only added evidence and its INBOX note (its six-view claim —
byte-identical — matches §D). Builds and tests green again on both (props geometry test pass,
lodPool 9/9). A renderer note first, because it changes how the numbers below were taken:

> **Frames only compare across builds at the same batch position.** `broll.mjs --test` advances
> the world clock across the shots of one run, so the same pose rendered 4th in one batch and 5th
> in another differs by the wind phase alone (E_ground head vs head: 2.9 % of pixels, SSIM 0.985).
> Every before | after pair below was rendered with identical shot lists, same order.

### fable-3 — the north clearing's entrance (`eaf4b930`, `7b88f85d`)

`circle-marker` (0.4, −64.4) with `circle-pot-right` / `-squat` at its foot on the disc's north-east
rim, `circle-pot-left` / `-squat` on the flight-side corner (4.75, −68.45) / (4.15, −68.7).

| pose | after | verdict |
| --- | --- | --- |
| `x-northpath-n` (5.6 m) | a vertical post with a diamond cap, two crossboards and a hanging tag, a pot at its foot at the left of the entrance; the low pot pair at the right | **landed** — reads as a Kokiri waymarker, seated, off the paving |
| `x-clearing-back` (5.7 m) | marker + two pots on the verge beside the slabs | landed |
| `x-clearing-stones` (8–9 m) | marker at the right, pots either side of the entrance | landed |
| `x-clearing-n` | identical (looks north) | — |
| `D_log` | pixel-identical head → branch (pixDiff 0) | nothing in the fixed frames |

Notes for fable-3: the pot bodies are still one smooth tone (iteration-1 note stands); the marker's
crossboards are clean-edged planks — a chamfer or a split end would age them; at 5 m the hanging
tag is the only small-scale detail and it reads. Also confirmed from fable-3's INBOX: the stone
dais is never drawn where a camera can see it (`flagstones-north` culled beyond 45 m of the north
box) — that is the hardscape bug behind my "could not see the dais" in §fable-3 above.

### fable-4 — iteration 2, the trunk read at 5–20 m (`e3f50cd4`, `9ee2c7c8`) — **FAIL as an after that looks like its before**

Six fixed views, same-order batches, head `3d50f6c8` → `b61e0ff8` (this is *both* fable-4
iterations together, since the head has neither):

| view | pixDiff | SSIM vs reference head → branch |
| --- | --- | --- |
| A_stairs | 0.0001 | 0.1979 → 0.1979 |
| B_house | 0.0003 | 0.1974 → 0.1974 |
| C_lookback | 0.0005 | 0.2314 → 0.2314 |
| D_log | 0.0008 | 0.2637 → 0.2638 (+0.0001) |
| E_ground | 0.0003 | 0.2016 → 0.2018 (+0.0002) |
| F_canopy | 0 | 0.2484 → 0.2484 |

Inside the budget with nothing spent — which is also the finding: B, C and E hold mature
white-barks at 5–15 m and the trunk-read change moves 0.03–0.05 % of their pixels.

| pose | before → after | measured |
| --- | --- | --- |
| `wb-grove-5m` p (−2.6, 1.45, 13.5) → (−7.4, 2.0, 12.9), a mature white-bark at 5 m | the two broad bands are present in the data (`fable-5-r48-f4-it2-trunk-5m-diff.jpg`, diff panel) but invisible in the frame | band zones l 0.339 → 0.312 (−8 %) and 0.327 → 0.301 (−8 %); "near-black" in this light would be l ≤ 0.12 — the bands are at a quarter of the strength they need |
| `wb-grove-10m` p (1.5, 1.45, 15.5) → (−7.4, 2.2, 12.9) | pixDiff 0.5 %; nothing readable | — |
| `x-arch-tunnel-n`, the two young clearing white-barks at 10–17 m (iteration 1 → 2) | **identical** (`fable-5-r48-f4-it2-tunnel-young-stems.jpg`) | by design: `whitebark.ts` gives `p.age === 'sapling'` no broad bands and no scars — and these are the trunks the owner sees through the arch |

What would make it pass: bands and chevrons dark enough to survive the material's lighting and
haze (−60…−70 % in the frame at 5 m, not −8 %: a vertex-colour multiplier is being washed out by
the lit albedo), and at least the chevrons on the young stems. The rule the round set applies
here: this is a FAIL to report, not a claim — the geometry/placement work of iteration 1 stands.

**Checked again on the merged head `0987e060`** (tick 181 — fable-4 had found the same and pushed
`1812a6f0` "the range-48 marks go to near-black" before fable-cursor merged `d158d10c`): same pose,
same batch position, `3d50f6c8` → `0987e060`. Band cores (the 30 % of trunk pixels that changed
most, 3–4 k px each) go **l 0.281 → 0.177 (−37 %) and 0.296 → 0.175 (−41 %)** against pale bark
between them at 0.33; region means −15 %. In the frame that is two broad soft dark zones on the
upper trunk — readable at 5 m now, **IMPROVED**, not yet the crisp near-black marks of a birch (a
1.9 : 1 contrast where the reference's is 3–6 : 1, and the edges are soft, so they read as dirt or
shade as much as bark). `whitebark.ts` on the head still gives `p.age === 'sapling'` no bands and
no scars, so the two young stems in the view through the arch are unchanged (see §F for the
same-position tunnel measurement).

## F. The merged head `0987e060` (tick 181) — the union of the four merges, measured once

Same 7-shot list at the same positions, `3d50f6c8` (before any goal-mode merge) → `0987e060`
(fable-2 ledge, fable-3 lookout + clearing props, fable-4 trees + near-black marks, the dais fix):

| view | pixDiff | SSIM vs reference before → after |
| --- | --- | --- |
| A_stairs | 0.0001 | 0.1979 → 0.1979 |
| B_house | 0.0003 | 0.1974 → 0.1974 |
| C_lookback | 0.0008 | 0.2314 → 0.2315 (+0.0001) |
| D_log | 0.0008 | 0.2637 → 0.2638 (+0.0001) |
| E_ground | 0.0003 | 0.2016 → 0.2018 (+0.0002) |
| F_canopy | 0 | 0.2484 → 0.2484 |

The whole night's merges cost the six frames nothing (≤ 0.08 % of pixels, Δ SSIM ≥ 0). Where they
show is the walk: at `x-arch-tunnel-n` the merged head differs from fable-4's branch alone by 1.6 %
of pixels — the waymarker and pots at the path's entrance (11 m, left of the slabs), the pot pair
on the far corner, the ledge wall darkening the far end — while the two young stems are unchanged
(607 of 48 000 px in the near stem's box, wind in the crown; 9 px in the far one).

## Summary for fable-cursor

| branch | does what its INBOX/commit says | at the defect's pose | merge risk seen |
| --- | --- | --- | --- |
| `agent/fable-2-ledge` `19224e04` | yes — and fixes a real bug (the wall faced away) | opus #03 IMPROVED, not closed (smooth boulder, bare foot, cut visible above the crest) | none seen; `rocks/ledge.ts` + its test only |
| `agent/fable-4-r48` `b61e0ff8` | iteration 1 yes; iteration 2 **no** — the marks are in the data at −8 %, invisible in the frame, absent on saplings | four trees present, seated, crowned; the 5–20 m trunk read unchanged | none for the six views (Δ ≤ +0.0002); merging `e3f50cd`/`9ee2c7c` ships no visible change |
| `agent/fable-3-lookout` `7b88f85d` | yes, both items | the deck is gone, the railing is on the hook; the waymarker and pots stand at the clearing's entrance | none seen; `props/**` only |

All three are safe to merge from the branch on this evidence; fable-4's iteration 2 should be
re-done at strength rather than reverted (it is harmless as shipped). The open notes above are
their next items, not conditions.
