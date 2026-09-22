---
agent: fable-2
runtime: Cursor Cloud Agent (Claude Fable 5.1)
github: Cursor Agent <cursoragent@cursor.com>
status: active
branch: agent/fable-2-ledge (+ agent/fable-2-w23-loaf for the D composition change)
updated: 2026-09-20T17:25:00Z
---

# fable-2 — work log

Lane: `src/world/rocks/**` ONLY (rockgen.ts, dressing.ts, material.ts, index.ts, ledge.ts, tests,
plus new rock modules under the same directory). Onboarded from `docs/ONBOARDING_FABLE_CHATS.md`
(Chat 1). Goal mode since 2026-09-20 00:00 UTC (`docs/GOAL_MODE.md`; timer `goal-mode-fable-2`,
cron `20 * * * *`). Each iteration branches afresh from `origin/cursor/kokiri-world-phase1-f65e`
as `agent/fable-2-<topic>`; `fable-cursor` merges. I do not touch `layout.ts`, the ledger or the rubric.

## Current task (goal mode, iterations 2–3 on `agent/fable-2-ledge`)
- Iteration 2 — opus #03 / GOAL_MODE fable-2 #1, the north-terrace ledge as ref-04's damp
  rock-and-root wall: DONE (`ccd9a22a`), evidence `art/environment/fable-2-rocks/README.md`
  §Iteration 2.
- Iteration 3 — opus #10 / GOAL_MODE fable-2 #2, the shot-D boulder's value at 2 m: DONE
  (`20513c24`), §Iteration 3. Probes put the whole gap in the stone's value (the normal map,
  roughness and the near colour terms each changed nothing measurable; a white rock renders 0.47
  there). Near path only: stone ×1.35 and warmer, wet band / grime lighter, the D skin's cleave
  darkening 0.4 → 0.12, shaded moss rim +25 %. Face 0.166 → 0.205 at fern parity (0.213), as
  the reference's frame D has it. The spot's absolute level (ferns 0.21 vs the reference's 0.32)
  is the lighting's (opus #13).
- Iteration 4 — fable-5's non-author review of the wall at 3 m (`x-ledge-wall`: "one smooth
  boulder, no strata, no damp band, roots the rock's own tone, the cut above the crest"): DONE
  (`2f741068`), §Iteration 4. Ends sink into the bank (lip stays on the terrace top), beds
  0.3–0.45 m stepped hard, damp band in the vertex colour + `LEDGE_DAMP` 1.6 on the material,
  bark roots, slab crest.
- Iteration 5 — GOAL_MODE fable-2 #3, the north clearing's rock dressing (`clearing.ts`): DONE
  (`e070771d` + `7bf69c21`), §Iteration 5. The pale boulder pair on the west bank (V20's motif),
  scree at the flight's flanks 0.6–1.4 m off the treads (the first band sat inside the
  hardscape's edging cheeks and was invisible — a real FAIL caught at the pose), slabs on the east
  bank and at the wall's foot; one mesh, drawn within 45 m (the first build cost the fixed
  cameras +2 draws / +0.14 M tris for stones behind the north rise).
- Iteration 6 — GOAL_MODE fable-2 #4, the pebble scatter per cell (`pebbles.ts`): DONE
  (`113f59b6` + `4d363760`), §Iteration 6. Stateless per-cell draws (0.1 m lattice on the paving's
  fringe, 0.5 m for the scatter within 4 m); a paving edit moves only the pebbles within ~6 m
  (tested); the north paving's ≈ 1 000 pebbles as `pebbles-north` under the north toggle. The
  one-time re-roll: six views within −0.0019 of the head, A 8.99 M.
- Iteration 7 — fable-5's second pass on the wall (§I of their review): DONE (`71b64670`),
  §Iteration 7. Beds thin toward the lip (55 %) with less block relief; bark a warm mid brown,
  matte, stronger ridge; the foot slabs / scree damp-seated. A and D byte-identical before/after.
- Iteration 8 — fable-5's round-49 #7, W23 at frame D, the "7 m value" half: the D boulder's far
  look lifted and warmed (`a683a4c1`) — **FAIL as a visible change at D**: the ferns hide the rock,
  the visible cap edge moved 0.238 → 0.246 and D −0.0002. Kept (harmless, toward the reference);
  the item is vegetation-26's exclusion disc first. §Iteration 8.
- Iteration 57 — fable-5 accepted §54's correction and re-scoped V16 (04:48): visible line length × the
  hard-groove share, the shadow map ruled out, the lever the recess coming and going along the joint —
  routed to the module holder. Read the sites (`rimDrop` / `spallAt` in flagstones.ts) and posted a one-tick
  plan (a low-frequency flush-stretch term on the spall channel, ≈ 40 % of each outline, depth = rim over
  fill) asking fable-cursor for the go or the module; nothing built without it. Rocks' list empty.
- Iteration 56 — the clearing's and backside's dressing take a near-capable material with a 7–13 m fade
  (`DRESSING_NEAR_FADE_M`, `agent/fable-2-dressing-fade` @ `0d86abbb`): the stones a walker sees at 5–20 m
  (the backside pair 6.8 m from `x-southbank-toe`) were the smooth far skin past the hero fade's 6.3 m; now
  fine σ +18 % there, the 4 m pose unchanged; E / C / D identical to 4 decimals (both sets off the six frusta
  by construction). README §56.
- Iteration 55 — non-author check of fable-4's `agent/fable-4-shadowlod` @ `c938a862` (the white-barks' mid
  LOD stops casting, from my shadow-pass map): A byte-identical −60 K / −6 draws, C −0.0006 (0.53 % px, the
  grove's dapple on the hazed bank) −240 K, D −0.0002 −100 K — their table reproduced; safe to merge.
  `.agents/reviews/fable-2-review-fable-4-shadowlod-c938a862.md`.
- Iteration 54 — round-52 #3 (fable-5: V16 "a seam value, one commit", hardscape / fable-2): five knobs measured
  with fable-5's read at E / C / D — fill albedo × 1.3 (−0.3 pt), painted crevice off (−0.7 pt, the most), slabs
  half as proud (worse, +0.8 pt, SSIM −0.002), joint sprouts hidden (0), §45's flank tint (0) — against a frame
  at 3.1 / 1.8 / 2.5 vs our 8.1 / 6.2 / 6.3. The mask shows the frame's counted pixels are Link's shadow, ours
  every joint's full length: the lever is the joints' edge length (1.6 × the frame's), a hardscape rebuild.
  **FAIL to land, mapped**; all reverted (`agent/fable-2-seam-value`). README §54.
- Iteration 53 — B3 follow-up (fable-cursor 01:40: the merged tiles tripped the census; their
  `mergedInstances` fix on the head): the LOD's far meshes declared the same pebbles again (4 084 for
  2 042; rocks instances 5 402) — the far mesh declares 0 (`agent/fable-2-b3-lo` @ `85c22c71`): rocks
  instances 3 380, B3 claimed 3 151 ≤ 3 380 on the honest margin. Measured via `audit().scene` on both builds.
- Iteration 52 — the map completed: six views per system + the shadow pass split at A and C (`isolate()` with
  `shadowMap.enabled` off). The shadow pass is a third of every frame (A 2.97 M of 8.74 M, C 2.44 M of 6.93 M),
  the same per system whichever way the camera looks (a fixed sun frustum: trees 1.3 M, structures 0.68 M,
  terrain 0.35 M); hardscape / vegetation / structures-at-A draw 75–95 % of their scene totals where trees
  and rocks cull to 15–31 %. Posted as the W38 map (same review file).
- Iteration 51 — no ranked rocks item (round-50 #1's two halves are lighting questions, #8 closed; the
  tunnel floor is fable-3's, claimed): the per-system triangle map of A / F / C on head `110453d4` via
  `isolate()` — trees 35 %, vegetation 22 %, structures 22 %, hardscape 9 %, terrain 7 %, rocks 2.8 % after
  §49–50 — posted for the next W38 cut (`.agents/reviews/fable-2-triangle-budget-110453d4.md`).
- Iteration 50 — the pebble tiles' distance LOD (`PEBBLE_LOD_M` 10 m ± 1, 20-tri far looks swapped in
  `nearUpdate`; `agent/fable-2-pebble-lod` @ `15fd5128`, stacked on 49): six views unchanged to 4 decimals
  (E −0.0001; ≤ 184 changed px, ≤ 3 strong), draws as 49; triangles with 49: A 8.80 → 8.69 M (−110 K),
  B/E −90 K, C −120 K, D −90 K, F −130 K. README §50.
- Iteration 49 — the path pebbles merged per 10 m tile (`PEBBLE_TILE_M`, `agent/fable-2-pebble-tiles` @
  `1e2777be`), fable-cursor's tick-213 "A at 8.80 M, nothing more without a matching cut": one InstancedMesh
  per look spanned the whole scatter, so every camera drew all 2 042 × 80 tris. Six views pixel-identical
  (F 2 px), SSIM equal; triangles A −30 K, B/E −30 K, C −100 K, D −40 K, F −130 K; draws +5/+4/+1/+3/+4/−4.
  Next lever for A itself: a per-tile distance LOD in `nearUpdate`. README §49.
- Iteration 48 — non-author review of fable-3's `agent/fable-3-arch-rim` @ `c48d6a6e` (the 4 cm tuck) at
  `x-arch-approach` / `x-arch-tunnel-s` / D: the wall-through at the roll's end 72 → 25 px, D byte-identical,
  a residual where the `s²` falloff is smallest; safe to merge. `.agents/reviews/fable-2-review-fable-3-arch-rim-c48d6a6e.md`.
- Iteration 47 — fable-5's r53 §B "13–16 cm timber", measured outward on the tinted head: fable-5's box
  39.4 → 41.6 % dark / 13.0 → 12.1 % pale / mean l 0.302 → 0.296, A −0.0016, F −0.0007 — **FAIL, reverted**
  (`agent/fable-2-logs-thin` @ `de1d607f`). With the crown pale, a thinner log shows more dark stone behind
  it; the remaining dark share is V17's (the treads' light). README §47.
- Iteration 46 — the stair timbers re-tinted on outward faces (`agent/fable-2-logs-tint` @ `c1e7d115`):
  Astra's winding fix (`27c2e3c8`) showed the logs' crowns for the first time — every §39 tint take had
  been tuned against the tubes' inner walls, at an effective albedo ≈ 2 % (`bark_brown_02` linear mean
  0.113 × the arch's `0x6e6258`). A's flight box: reference lips 100 / troughs 85; ours 68 / 63 (the dark
  logs where the lit lips belong). Seven tints at A + the 2 m pose → `LOG_TINT` 1.35 / 1.5 / 2.3 and the
  shade floor toward the frames' bark `#746d5d` (the arch's brown floor tint held the saturation at 0.36):
  lips 94 / troughs 71, saturation 0.32 (ref 0.29). Six views: **A +0.0087, F +0.0044** vs the head, C
  +0.0002, B / D / E cannot see the flight; vs the flight without logs A +0.0074, F +0.0005 — take-0129's
  F −0.0104 was the inward faces. README §46.
- Iterations 18–45 (README §18–§45, INBOX): conservative backside casters from the bodies' spheres +
  test (18); the D boulder's form planes with the beds re-carved (19–20); the backside pair's value and
  size (21); V21's anchor rock at the C-frame bank, three modes measured, the layout move left to
  fable-cursor (24–26); W05's stone tier along the stair-bank contour with prop keep-outs + test (27–29);
  near relief on the hero / strata skins (30–34); the D loaf's moss off the camera face (35); W23's layout
  move in `layout.ts` on fable-cursor's go, the vegetation contracts' failures reported and fixed on
  their side, W23 → pass at take-0128 (36–38, 40); the hero flight's log nosings + end stakes for
  hardscape on fable-cursor's offer, W02 → pass at take-0129 (39, 44 test); the stairs' pitch projected
  into A and closed as a framing difference, not a tread-depth one (42); V16's seams measured: tone and
  rim are the frame's, the lever is the count of dark features — reverted, reported (43, 45).
- Iteration 17 — GOAL_MODE item 0 (round-49 handoff): `expansionCull` after placement on strata / rubble /
  pebbles (`3ac0a8a1`; 3 strata culled, streams and draws unchanged) + expansion-2's listed positions in
  `backside.ts` (`9d1fc102`: west-skirt boulder, kerb stones, brace scree, disc pebble rings). A byte-identical,
  C 5 px. §Iteration 17.
- Iteration 16 — the plaza's backside (expansion-2, V20): `backside.ts` — pale boulder pair, low stone step
  and flight scree at the fenced south bank, live-terrain seated, expansionVisible-toggled with per-piece
  casters (`06f2a781` + `294bc94c`). A / C the head's draws and tris; landed at three poses. §Iteration 16.
- Iteration 15 — W23's value half per fable-5's loaf review: `bareToward` + `faceLift` on the D boulder
  (`39568e37` on `agent/fable-2-w23-loaf`): the face toward D bare and up to 30 % paler; D +0.0005, the
  branch nets D −0.0002 vs the head. IMPROVED; the fronds stay vegetation's. §Iteration 15.
- Iteration 14 — a 9–30 m detail band for the boulders (owner's "stones under-detailed"): **FAIL,
  reverted** (`d4bfed58` → `f433b104`) — ≤ 0.02 % of pixels in the six views, Δ 0; the hero boulders are
  hidden by vegetation at every 8–20 m pose I could find. §Iteration 14.
- Iteration 13 — W24 regression (mine): the envelope left `systems.rocks.pebbles` at 1 822 < 2 000. Fixed
  (`51fb6b35`): the audit counts every instanced pebble (main + north, breakdown kept) and the fringe
  acceptance 0.42 puts the plaza-side set at 2 079. Six views within ±0.0006, +20 K tris. §Iteration 13.
- Iteration 12 — W23 at D, the loaf 0.2 m prouder (fable-5's reviewer yes; fable-cursor's call): on its
  own branch `agent/fable-2-w23-loaf` @ `e5867d7e`. D shows the boulder above the fronds now (IMPROVED,
  dark; not closed), D −0.0007, the rest ≤ 0.0003. §Iteration 12.
- Iteration 11 — take-0122's C −0.0022 (fable-5's bisect: my per-cell scatter): a path-proximity
  envelope on the scatter (`12dbc604`) — 935 far pebbles go, seats identical; SSIM neutral (A −0.0004,
  F +0.0005), ≈ −70 K tris per frame. C not recovered (the re-roll itself); reported. §Iteration 11.
- Iteration 10 — opus #16 (unclaimed, plaza at 1–2 m): eight pebble looks at 80 tris each, one
  instanced draw per look, per-cell pick (`a3c644b2`). Six views within +0.0005 / −0.0003, +4 draws,
  triangles identical. §Iteration 10.
- Iteration 9 — the review route (list empty, no ranked item yet): non-author before | after of
  fable-4's `agent/fable-4-budget` @ `29b9ed19` (low boughs, W08 at C) — A/C fixed views + two
  poses; safe to merge, IMPROVED not closed; +20 K tris where they estimated +7 K.
  `.agents/reviews/fable-2-review-fable-4-budget-29b9ed19.md`.
PR creation from this chat is refused by GitHub ("must be a collaborator" for the agent account);
fable-cursor merges from the branch (iterations 3–7 landed as `b204778d`, `d5ff5547`). My GOAL_MODE list is empty: next I take the highest
open rocks defect no one has claimed (fable-5's V20 / V21 at the plaza and stair bank are
six-view-exposed and need fable-cursor's word on the budget; opus #16's joint pebbles likewise)
or a review of another lane's branch at its poses.

## Iteration 1 (PR #12, merged `f092a094`)
Rocks pass from survey-2 and the owner's 2026-09-19 references (rubric W23 / W24, W37 held). Items were:
1. Survey-2 #32 / #19 — the shot-D hero boulder at `sn-boulder-shotd` reads as polka-dot lichen
   with a black hole on top: lichen as clustered crust patches that follow the plates, the hole
   closed, the crack furrows kept.
2. Survey-2 #17 / #25 — the stair-foot shard skirt at `sn-boulder-stairfoot` is angular low-poly:
   more, smaller, smooth-shaded shards half-buried in the moss, each seated on `ctx.terrain.height`.
3. ref-04 (`art/environment/owner-review-2026-09-19/`) — the tall rock/root ledge right of the
   north path: damp dark stone, moss sheets, a wet foot. I own the material + face builder; the
   position comes from fable-cursor's expansion-1 lane (`layout.ts`) — coordinating in the INBOX.
4. Wet band, moss and lichen must read at player height (2–6 m), not only at touching distance.

## Files / systems being touched
- `src/world/rocks/index.ts` — near-kit skirt stones, lichen dressing parameters, ledge hook.
- `src/world/rocks/rockgen.ts`, `dressing.ts`, `material.ts` — crust patches, hole fix, near fade.
- `src/world/rocks/ledge.ts` (new) — the ref-04 ledge face builder + material variant.
- `src/world/rocks/rockgen.test.mjs` (+ new tests beside it).
Nothing outside `src/world/rocks/` except this log, the INBOX and my evidence under
`art/environment/fable-2-rocks/`.

## Completed work
(newest first)
- `3ac0a8a1` + `9d1fc102` (`agent/fable-2-ledge`): the expansion cull (pebbles filtered; rubble / strata
  scale 0 in place, adoption loops guarded; `expansionCulled` audit) and the listed backside positions
  (per-piece casters; discs within 1.6 m of C's edge skipped).
- `06f2a781` + `294bc94c` (`agent/fable-2-ledge`): `rocks/backside.ts` — reads `EXPANSION.southBank`,
  `EXPANSION_STAIRS`, `southBankPoint`; seats on `getTerrain()` (live); returns per-piece `Caster`s for
  `casterSpheres` / `expansionVisible` in `update` / `onCameraMove`. Lesson: group casters over-reach —
  one per piece.
- `39568e37` (`agent/fable-2-w23-loaf`): rockgen `bareToward` (moss off the faces toward a local xz
  direction, cap spared) and `faceLift` (vertex colour × (1 + amount·smoothstep(dot))); index.ts derives
  `towardD` from `layout.viewpoints` D_log and the D boulder. Six views all ≥ 0.
- `51fb6b35` (`agent/fable-2-ledge`): W24 — audit `pebbles` = main + north (`pebblesMain`, `northPebbles`),
  `PEBBLE_DEFAULTS` 0.42 / 0.43. Lesson logged: re-read the rubric's auto checks before a count-changing
  scatter change.
- `e5867d7e` (`agent/fable-2-w23-loaf`, off `e54a74ed`): the D boulder squash 0.72, sinkFrac 0 (the
  others keep 0.74 / 0.15). Six views A −0.0001 B −0.0001 C 0 D −0.0007 E +0.0003 F 0; draws / tris
  identical.
- `12dbc604` (`agent/fable-2-ledge`): `PebbleScatterOptions.envelope` — acceptance × (1 − smoothstep(full,
  far, dist to the nearest path point)), index.ts passes `pathPtsAll` with 3.5 / 5.5 m; north cells ignore
  it. Test: the envelope removes only beyond-`far` pebbles and moves none inside `full`.
- `a3c644b2` (`agent/fable-2-ledge`): `PEBBLE_LOOKS` — eight pebble variants (cuts 1–4, cutDepth,
  squash 0.45–0.85, crease 30–55, moss 0–0.4, four tints) replacing four near-identical ellipsoids;
  `PEBBLE_VARIANTS` drives the per-cell pick. +4 draws, +0 tris.
- `a683a4c1` (`agent/fable-2-ledge`): the D boulder's far look for W23 — cutDark 0.4 → 0.25 (the
  path-facing cleave is what D sees), collarBand [0.1, 0.45], dirt 0.7, tint 0.9/0.85/0.64. Six views
  Δ ≤ 0.0002; invisible at D behind the ferns (reported as a FAIL, not a claim).
- `71b64670` (`agent/fable-2-ledge`): the wall at 3–7 m per fable-5 §I — `bedding(uu, y, vf)` thins
  the beds with height (thick × (1 − 0.45·vf)), block offsets / ridged skin shrink with them; bark
  0.36/0.25/0.14, `wet ×= 1 − 0.9·bark`, R 0.1–0.16, ridge ×1.2; clearing.ts foot slabs tint 0.27 +
  collar (0.1/0.1/0.08) dirt 0.9 band to 0.7, east slabs 0.36, scree dirt 0.85.
- `113f59b6` + `4d363760` (`agent/fable-2-ledge`): `rocks/pebbles.ts` — per-cell pebble scatter
  (hash2 of the cell for jitter / acceptance / size / yaw / variant; fine 0.1 m lattice on the
  fringe inside coarse 0.5 m cells touching paving; coarse cells for the scatter within 4 m of
  paving via a dilated 1 m paving grid); stair-foot pebbles hashed per (flight, index); the north
  set toggled with the north locality. Calibrated 0.36 / 0.37 → the old ≈ 2 600. Tests 4/4.
- `6946ad17`…: merged the head (fable-cursor's north-locality util); the clearing dressing joined
  `ledgeMeshes` under `northVisible`, `CLEARING_DRAW_M` dropped.
- `e070771d` + `7bf69c21` (`agent/fable-2-ledge`): `rocks/clearing.ts` — the north clearing's
  dressing from the layout's `northClearing` / `stairs.ledge` / `ledgeTerrace`: the pale boulder
  pair (r 0.52 + 0.33, half-buried at the west bank's foot), 11–14 scree blocks per flight flank
  in a 0.6–1.4 m band off the treads, 6–7 bedded slabs on the east bank + 3 at the wall's foot;
  one merged mesh, hero material, ~49 k tris, `CLEARING_DRAW_M` 45 m toggle in `nearUpdate`.
  Tests `clearing.test.mjs` 3/3. Six views: the head's numbers exactly.
- `2f741068` (`agent/fable-2-ledge`): the north-terrace wall at 3 m per fable-5's review. The
  end taper is a SINK into the bank (columns move along n, re-seated on the higher ground; the
  lip stays on the terrace top — the height taper had left the terrace's pale cut visible over
  the crest); beds 0.3–0.45 m, ±0.2 m steps, 0.12 m partings 90 % dark; damp band baked into the
  vertex colour + `createRockMaterial(opts.damp)` (ledge 1.6); roots as bark with a rib tone,
  slimmer over the shoulder; the shoulder as joint-broken slabs under a moss sheet, lip 0.2 m
  proud. `contacts` report the standing part only.
- `20513c24` (`agent/fable-2-ledge`): the shot-D boulder's value at 2 m (opus #10). Probe method
  (kept in `/tmp`): at the pose, swap the near mesh's material for (a) a white lit rock without
  maps, (b) the real material writing `diffuseColor` / `vColor` to `gl_FragColor` after
  dithering, (c) the real material with the normal map / roughness / near path each disabled.
  (a) 0.47, ours 0.17, (c) all 0.17 → the value, not the shading. Fix in the near path (nearW):
  stone ×1.35 + warm, wet 0.7/0.72/0.78, grime 0.55, D near skin `cutDark` 0.12, shaded moss
  rim ×1.25. Six views Δ ≤ 0.0001, draws unchanged.
- `ccd9a22a` (`agent/fable-2-ledge`, off `3d50f6c8`): the north-terrace ledge. Root cause: the
  layout authors the line at the terrace LIP (ground 5.5–5.7 m; the clearing floor is 4.0 m and
  the step is a ~40° slope z −74 … −76), the builder read it as the foot and, with `height:
  1.62`, stood a wall on top of the lip facing the bank. `ledge.ts` now: a line point above a
  drop on the path side walks down the slope to the base (0.1 m steps, a 1.2 m flat crest
  tolerated, stops off the paving) — that is the foot, the point is the top's ground point and
  the step's rise is the height; the bank side is read 1–3 m out; the face climbs steeply over
  a slope (top edge at 30 % of the inset); the authored line is extended by the taper at both
  ends so the authored span stands at full height; stair / structure columns dropped; root ridges
  (`RockLedgeDef.roots`, default 0.7 per 3 m). Six views byte-identical; test added (14/14).
- PR #12 (`agent/fable-2-rocks`, merged `f092a094`):
- `73708d4` + follow-up: the stair-foot "shard skirt" root-caused by draw-range probes (rock
  body only / kit only / far geometry swapped in at `sn-boulder-stairfoot`): it is the rock's own
  moss blanket — the 12 cm `mossSide` swell switched on/off at every micro-relief ridge (the
  cap's `n.y` gate) and at every crack line, a stack of hard-edged slabs. Near builds evaluate
  the swell on a low-frequency normal without the crack term (`mossSwellSmooth`; far byte-
  identical; differential test: blanket cliff edges 1728 → 608). Near kits also adopt the
  embankment strata slabs within reach (collapsed far, rebuilt smaller / smooth-shaded /
  half-buried with companions).
- `033ccc3` the "black holes" root-caused by probes (unlit material → solid, so no gaps; rock
  body only → no holes; dressing only → black domes): the moss cushions' vertex colours were
  palette greens as linear values (≈ 0.05) multiplied into the moss path. Pale neutral vertex
  colour now; regression test.
- `a092203`, `3682d5f`, `c4aa274`: lichen crust field `aLichen` (colonies inside the plates,
  stopped at joints, painted by the near material; the flecks fade out over the same nearW);
  disc plates removed; plate colour joints narrowed (the "slate seams"); crown parting pit damped
  (`strataCrown`); near fade 2.5–6 → 4–6.3 m; collar no longer grimed black, glossier blue-grey
  wet band with a tide line; skirt stones as weathered cobbles + near-only half-buried shards on
  the heightfield; stair-foot near skin smooth-shaded (34°, quarter chips, half plate steps).
- `b6b310a`: `rocks/ledge.ts` — the ref-04 ledge face builder + `layout.rockLedges` hook +
  `?rockLedgePreview=1` dev preview on the north path's east bank; tests.
- `6a7676c`: onboarding (log, INBOX announcement, ledge hook proposal).

## Important decisions
- Acceptance per the onboarding block: a before/after pair at the exact survey pose; the six
  fixed views A–F within −0.003 SSIM each of take-0116; draws ≤ 700; deterministic PRNG only.
- The near-LOD kit is the surface the survey poses see (the live camera stands 2 m from the
  rocks); the six hero cameras render the far meshes (hero margin), so near-only changes are
  the safe place for relief, and material fade limits are bounded by camera D's 7.22 m to the
  shot-D boulder's centre (≥ 6.4 m to its lumps → fade ends at 6.3 m).
- Every new rockgen option defaults to the old behaviour and the far build is asserted
  byte-identical in the tests (`strataCrown`, `mossSwellSmooth`, `lichen`).
- Probe method that worked (kept in `/tmp`, not the repo): render the survey pose with the near
  mesh's material swapped for emissive magenta (gap vs shading), then `geometry.setDrawRange`
  to split the kit (rock body first, then cushions, fragments, skirt), then the far geometry on
  the near mesh. Two of my first three hypotheses were wrong; the probes were not.

## Known issues
- The north-terrace face runs x −4.2 … −0.5 (the authored line plus the west extension; the east
  extension lands on the `ledge` flight's stairs mask and is dropped). The terrace lip east of the
  flight (x 2.1 … 3.5) is still the terrain's mound — a second `rockLedges` entry there is the
  layout's call (asked in the INBOX). Ferns at the foot: vegetation-26's.
- Camera A renders 9.09 M triangles on the world head `3d50f6c8` (before this change; the loop's
  ceiling is 9.0 M) — not mine to fix, flagged to fable-cursor.
- Survey-2 #25 (bank boulders smooth dark domes at 8–15 m) and #34 (plaza joint pebbles as
  smooth ellipsoids) are far-material instanced geometry in the six views — not attempted.

## Recommended next work
- GOAL_MODE fable-2 #2: opus #10, the shot-D boulder's tonal read at 2 m (`sn-boulder-shotd`).
- #3: scree at the ledge flight's flanks, a boulder pair on the clearing's west bank, half-buried
  strata along the terrace face (positions: `art/environment/round47-review/README.md`).
- #4: `pathEdgePebble` per-candidate draws.

## Last updated
2026-09-22T05:50:00Z
