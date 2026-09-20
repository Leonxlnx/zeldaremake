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

## G. Iteration 4 (03:00–04:00 UTC) — fable-2's shot-D value, fable-3's cluster cull

Both lane branches are still based on `3d50f6c8`, so a branch rendered against the merged head
differs wherever the *other* lanes' merges show (at `x-northpath-n` fable-2's branch lacks the
waymarker, the pots and the white-bark crown — 15.7 % of pixels — none of it fable-2's). For a
clean read of one commit I cherry-picked it onto the head in its own worktree and rendered head |
head + commit with the same shot list. Builds and tests green (`rockgen` + `ledge` tests, props
geometry test).

### fable-2 — `20513c24`, "the shot-D boulder reads as pale stone at 2 m" (opus #10, GOAL_MODE fable-2 #2)

| pose | before (head `0987e060`) → after (head + `20513c24`) | verdict |
| --- | --- | --- |
| `sn-boulder-shotd` (2 m) | boulder face l **0.156 → 0.201 (+29 %)**; the ferns beside it 0.169 (shade) / 0.329 (lit fronds) unchanged to three decimals; the stone is warm tan with cleave lines and lichen, the moss cap a lighter green | **IMPROVED** — the "unreadable dark mass" now reads as stone; it is still three-quarters under ferns (the exclusion disc is vegetation-26's), and the top silhouette is flat |
| `D_log` (the boulder at 7.2 m in the frame's left foreground, V9) | **pixel-identical** at the gauntlet's 256×144 (46 px of 921 600 differ at full resolution, all in the boulder's area); boulder region l 0.297 → 0.297 | the near-only path fades by 6.3 m as fable-2 states; nothing spent |
| `A_stairs` | pixDiff 0.01 % (wind) | — |

fable-2's own numbers (face 0.166 → 0.205 at fern parity 0.213, Δ SSIM ≤ 0.0001 ×6) are consistent
with mine from a different region set. Sheet: `fable-5-r48-f2-shotd-value-sn-boulder-shotd.jpg`.

### fable-3 — `0b46deb7`, the per-cluster distance cull (45 m)

| check | result |
| --- | --- |
| the clearing's props still draw where a player sees them | present at `x-northpath-n` (5.6 m) and `x-arch-tunnel-n` (11 m) on the cull branch |
| the six frames | `A_stairs` head → branch pixDiff 0.01 %; `D_log` differs only by the head's fable-4 trees the branch lacks (0.08 %, same as §D) — the cull itself moves nothing visible, which is its point (fable-3 measures the saving as A −8 draws / −8 k tris; I have no draw counter in `broll.mjs` to confirm the number) |

No merge risk seen in either; both are additive to what fable-cursor already merged.

## H. Iteration 5 (03:35–04:30 UTC) — fable-3's per-locality merge, fable-4's crown albedo

Both new branches are based on the current head (`3813fa6f`, `src` = `0987e060`), so branch vs
head is a clean read this time. One 8-shot list rendered on head, `agent/fable-3-merge` `f37968ba`
and `agent/fable-4-crowns` `c46081f6` (builds + tests green: props geometry, lodPool 9/9).

### fable-3 — `38aa5bfd`, props merged per locality (8 meshes for the system, was 20)

| pose | head → branch |
| --- | --- |
| `B_house` (door pots), `C_lookback`, `E_ground` | **pixel-identical** (pixDiff 0, Δ SSIM 0) |
| `w28-plateau-d` (crate, barrel, bucket, pot), `x-northpath-n` (marker + pots), `x-arch-tunnel-n`, `x-clearing-stones`, `wb-grove-10m` | **pixel-identical** |

A pure batching change: nothing a camera sees moves. The draw saving is fable-3's number (no draw
counter here). Safe to merge.

### fable-4 — `c46081f6`, the crowns' albedo carries the layering (GOAL_MODE fable-4 #2; my "lime cards brighter than the haze")

Leaf pixels = the pixels that changed inside the crown region; l = sRGB grey.

| pose | leaf l before → after | spread (sd) | read |
| --- | --- | --- | --- |
| `wb-grove-10m`, mature crowns at 8–12 m | 0.464 → 0.392 (−16 %) | 0.066 → 0.073 | lime cards → olive leaves; neighbouring leaves now differ (some shaded, some lit) |
| `x-arch-tunnel-n`, the two young crowns at 10–17 m | 0.429 → 0.330 (−23 %) | 0.064 → 0.068 | the crowns sit under the haze instead of glowing over it (region mean 0.449 → 0.438) |
| `x-clearing-stones`, young crown at 6 m | 0.371 → 0.265 (−29 %) | 0.076 → 0.072 | darker, reads as foliage in shade |
| `C_lookback`, the white-bark crown at the right edge | 0.392 → 0.329 | 0.048 → 0.045 | C pixDiff 0.18 %, SSIM vs reference 0.2324 → 0.2325 (+0.0001) |
| `B_house`, `E_ground`, `w28-plateau-d`, `x-northpath-n` | — | — | B/E pixel-identical; the others 0–1.3 % (crowns at the frame edges) |

**IMPROVED** — the complaint (crowns brighter than everything around them in the haze) is answered:
−16…−29 % on the leaves with B/E untouched and C at +0.0001. What it is not yet: a layered
silhouette — the leaves are still uniform flat cards, and the "lit rim" is a brighter card rather
than an edge; the spread gain is modest (+11 % at 10 m, none at 6 m). Safe to merge; the next step
for #2 is shape (lobed lamina outlines, a drooping lower shell), not tone.

## I. Iteration 6 (04:20–05:15 UTC) — fable-2's wall at 3 m and clearing rocks; fable-4's texture bands

Both branches carry the head's `src` (fable-2 merged `0987e060` at 03:45; fable-4-crowns is off it),
so head → branch is clean. One 8-shot list on head, `agent/fable-2-ledge` `e070771d`,
`agent/fable-4-crowns` `cfcd4f4d`; builds + tests green (rockgen + ledge, lodPool).

### fable-2 — `2f741068` (the wall at 3 m, answering §fable-2's notes) + `e070771d` (GOAL_MODE #3 / V20: scree, strata slabs, the west-bank boulder pair)

| pose | before → after | verdict |
| --- | --- | --- |
| `x-ledge-wall` (3 m) | one smooth humped boulder → a **squared slab crest** with a lit top plane, **stepped beds** on the face, a **damp gradient** (upper face l 0.170 → 0.203, lower face 0.120 → 0.121: the lower half now reads a third darker than the upper), a moss sheet on the shoulder, **pale strata slabs at the foot**; 31.5 % of pixels | **IMPROVED** — a built rock terrace now, not a boulder |
| `x-clearing-n` (7 m) | the wall's west end sinks into the bank (the pale cut is gone from this bearing), crest and beds read, scree at the flight's flank; 12.8 % | IMPROVED |
| `x-ledge-foot` | scree and half-buried strata slabs on **both flanks of the flight**; 9.4 % | landed (GOAL_MODE #3) |
| `x-northpath-n` (15 m) | the block reads squared and stratified at the far end, one pale slab at the right flank; 1.4 % | consistent |
| `C_lookback`, `D_log`, `wb-grove-5m` | **pixel-identical**; `x-arch-tunnel-n` 0.3 % (the wall at the far end) | nothing spent |

Still open for fable-2, none blocking: (1) the beds read as chunky angular facets more than thin
strata — a finer bedding frequency on the upper face would help; (2) the bark roots are still not
readable as roots at 3 or 7 m; (3) the new strata slabs are very pale (l ≈ 0.6 against the wall's
0.2) — clean limestone next to damp stone; a damp/dirt tint on their buried halves would seat them;
(4) the pale terrain patch far west at `x-ledge-wall` is, as fable-2 says, terrain beyond the
authored line (x < −4.5) — fable-cursor's layout ask (carry `north-terrace` west to x ≈ −4.8). I did
not have a pose on the west bank for the boulder pair — not verified here.

### fable-4 — `cfcd4f4d`, "the large octave at texel resolution" (GOAL_MODE #3, answering §E's "1.9 : 1 and soft")

| pose | before → after | verdict |
| --- | --- | --- |
| `wb-grove-5m`, a mature trunk at 5 m | the two soft vertex zones → **three near-black torn-edged bands and two chevron scars with a callus rim**, crisp, on the same trunk; 6.5 % of pixels | **PASS at 5 m** — this is the birch read; the marks the vertex colour could not carry, the texture does |
| `x-arch-tunnel-n`, the two young stems at 10–17 m | the texture octave is a tile, not gated on age: both saplings now carry a dark band at mid-height, soft in the haze; 3.9 % | the §E finding (saplings unmarked) is closed |
| `C_lookback` | 0.39 % of pixels, SSIM vs reference **0.2335 → 0.2338 (+0.0003)** | toward the reference |
| `D_log` | pixDiff 0 at the compare size, SSIM +0.0002 | — |
| `x-ledge-wall`, `x-clearing-n`, `x-ledge-foot` | pixel-identical | — |

Two notes, not blockers: at 5 m three bands plus two chevrons on the visible 6 m of stem is on the
busy side — ref-04's tree beside the ledge carries one or two — and the texture bands sit on top of
`1812a6f0`'s soft vertex zones, so some stems now show both (a soft zone above a crisp band); the
vertex marks could retire. fable-4's `materials.ts` ask (the `indirectDiffuse *= mix(0.5, 1, vLeafShade)`
line for the crowns' occlusion) is for trees-30/31 — the crowns' shape work stands as the next item.

## J. Iteration 7 (05:20–06:10 UTC) — fable-3's light strings, fable-2's clearing cull; V18 re-filed as V18′

Base for both = `0987e060`'s src (the branches' merge bases `cffe97a5` / `6c4415f8` carry it; the
head has since gained fable-cursor's `19e0489a` north-locality util and `f68da42a` root-flare
range, which neither branch has — so branch vs base, not vs head). One 6-shot list; builds + tests
green.

### fable-3 — `b8034a7c`, the demo's light strings (pegged cords with small glowing pods at the hero flight)

| pose | base → branch | read |
| --- | --- | --- |
| `A_stairs` | 1 054 px changed: the **left string at x 0.49–0.59, y 0.54–0.61** (reference 0.50–0.60 / 0.55–0.62) and the **right string at x 0.88–0.93, y 0.26–0.38** (reference 0.90–0.95 / 0.35–0.40); pod colour rgb (190, 188, 145), hue 57°, l 0.66 against the reference pods' (172, 178, 136), hue 68°, l 0.62 | **landed at the reference's positions and value**; SSIM vs reference 0.1979 → 0.1980 (+0.0001) |
| `F_canopy` | 0.27 % of pixels — the left string runs up the stair axis | SSIM 0.2486 → 0.2477 (**−0.0009**, inside the −0.003 budget; the only cost of the night so far) |
| `w23-stairs-f`, `w22-stairs-r` | 0.02 % / 0.05 % | the string is not in these frames' view (bank side) |
| `x-ledge-foot`, `D_log` | pixel-identical | — |

Read at 1280 px: a row of small pale-yellow dots along the flight's foot and the right bank — the
motif is there, the reference's soft halo (≈ 1.5× the pod) is not, by fable-3's own choice (glow
stays Astra's / structures'). Worth the halo when lanterns take it. Sheet:
`fable-5-r48-f3-lightstring-A_stairs.jpg`.

### fable-2 — `7bf69c21`, clearing rocks drawn only within 45 m

`A_stairs`, `F_canopy` pixel-identical; `D_log` 0.01 %; the dressing still draws at `x-ledge-foot`
(9.4 % vs the base, which has no clearing rocks — the same content as §I). Harmless; safe to merge.

### V18 re-filed — fable-3 was right, and the flight is not stone

fable-3 read `d_105` (52 s, the top-down at the foot) as log nosings pegged with short stakes and
asked me to re-file V18. Checked at three ranges (`ANALYSIS_VIDEO2.md` §6.6b, sheet
`fable-5-walk/fable-5-v18-log-risered-flight.jpg`): every riser of the hero flight is a **round
log** ≈ 0.15–0.20 m thick with **end stakes** on roughly every second log; the treads behind them
are packed earth / flat stone; `d_013` (6 s) shows the same rolls and the light string on the
flank; the A frame's wavy nosings are these logs at 10–18 m. **V18 withdrawn; V18′ filed at
severity 3**: our flight is cut blue-grey slabs with square nosings where the reference's is
log-risered — the largest available change at frame A after the giants, for hardscape-31 — and the
rubric's W02 wording ("18 worn stone steps… each tread a distinct slab") reads the 1 s frame as
stone. Proposal for `RUBRIC_PROPOSALS.md` (fable-cursor's file): keep the counts and audit checks,
change the visual criterion to "log-risered: round timber nosings with bark and moss, packed
treads, end stakes, no two logs alike".

## K. Iteration 8 (06:25–07:40 UTC) — fable-4-budget (W38), visually

`agent/fable-4-budget` `119a7b4f` off the merged head `89473888`: the medium white-bark mesh builds
no wood for twigs under 12 mm and the distance meshes keep one leaf in 6 / 12 at constant covered
area (the W38 margin — A 9.11 M on take-0121). Same 8-shot list on head and branch, same positions;
build + lodPool 9/9 green.

| pose | head → branch | SSIM vs reference |
| --- | --- | --- |
| A_stairs, B_house, E_ground, F_canopy | **pixel-identical** | Δ 0 (B +0.0001) |
| D_log | pixDiff 0 at the compare size | −0.0001 |
| C_lookback | 0.72 % of pixels (the white-bark crown at the right edge re-sampled) | 0.2226 → 0.2226 |
| `wb-grove-10m` | 3.9 % — the medium-LOD crowns' leaf pattern re-drawn at the coarser keep-rate, same covered area; reads the same at 1280 px | — |
| `x-arch-tunnel-n` | 0.06 % | — |

Visually neutral; whether it brings A under 9.0 M is fable-4's counter (no triangle count in
`broll.mjs`). Safe to merge on the visual side.

## Summary for fable-cursor

| branch | does what its INBOX/commit says | at the defect's pose | merge risk seen |
| --- | --- | --- | --- |
| `agent/fable-2-ledge` `19224e04` | yes — and fixes a real bug (the wall faced away) | opus #03 IMPROVED, not closed (smooth boulder, bare foot, cut visible above the crest) | none seen; `rocks/ledge.ts` + its test only |
| `agent/fable-4-r48` `b61e0ff8` | iteration 1 yes; iteration 2 **no** — the marks are in the data at −8 %, invisible in the frame, absent on saplings | four trees present, seated, crowned; the 5–20 m trunk read unchanged | none for the six views (Δ ≤ +0.0002); merging `e3f50cd`/`9ee2c7c` ships no visible change |
| `agent/fable-3-lookout` `7b88f85d` | yes, both items | the deck is gone, the railing is on the hook; the waymarker and pots stand at the clearing's entrance | none seen; `props/**` only |

All three are safe to merge from the branch on this evidence; fable-4's iteration 2 should be
re-done at strength rather than reverted (it is harmless as shipped). The open notes above are
their next items, not conditions.
