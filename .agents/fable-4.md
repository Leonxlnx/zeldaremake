---
agent: fable-4
runtime: Cursor Cloud Agent (Claude Fable 5.1)
github: Cursor Agent <cursoragent@cursor.com>
status: active
branch: agent/fable-4-r49b
updated: 2026-09-20T13:15:00Z
---

# fable-4 — work log

White-bark tree lane (Verdant Forest port), onboarded 2026-09-19 from
`docs/ONBOARDING_FABLE_CHATS.md` (Chat 3). Base: `origin/cursor/kokiri-world-phase1-f65e` at
`d06e275` (world tree = take-0116's `973a21e`). Draft PR #15 targets that branch; fable-cursor /
the owner merge and seal — I do not merge, do not touch `gauntlet/ledger.json` or
`gauntlet/rubric.json`.

## Current task
**Goal mode** (`docs/GOAL_MODE.md`; timer `goal-mode-fable-4`, hourly). PR #15 (round 47) is merged
(`084d007`). Branch `agent/fable-4-r48` off the head `3d50f6c`; evidence with per-pose verdicts in
`art/environment/round48-whitebark/README.md`.
- Iteration 1 (done): four young white-barks on the north clearing's banks (GOAL_MODE #1 / the
  round-47 handoff) — `a0f55cd` + hook `f9b6c32`.
- Iteration 2 (done): the trunk read at 5–20 m — broad near-black bands + chevron branch scars
  per variant, tonal zones ± 6 % (GOAL_MODE #3) — `e3f50cd`, `9ee2c7c`, `1812a6f`. PASS at 2/8 m,
  soft at 16–25 m; the first cut was a FAIL by the rule (gamma ate a 42 % linear drop) and is
  reported as such in the README.
- Iteration 3 (done, branch `agent/fable-4-crowns` `c46081f`): crowns layered by a per-leaf
  bimodal occlusion draw + structured albedo (GOAL_MODE #2) — IMPROVED, not closed; the
  `materials.ts` one-liner (hemisphere irradiance × mix(0.5, 1, vLeafShade) on white-bark leaves)
  asked of trees-30/31 in the INBOX.
- Iteration 4 (done, same branch, `cfcd4f4`): the marks at texel resolution — two broad
  near-black bands + two chevrons per tile in `bark-texture.ts`, toes confined to the tile's plain
  zone (GOAL_MODE #3 second half, fable-5's 1.9:1 → 3.7:1 at 2 m; PASS at `x-arch-tunnel-n`).
- Tried and reverted (05:30): clumpier lobes (sd 22.3 → 16.1 at `f4-crown-up`, a FAIL) and the
  `materials.ts` hemisphere line (0.7 % px, no leverage — ask withdrawn). GOAL_MODE #2 stands at
  IMPROVED; the darkness at 7 m is bounded by the shafts/haze at that pose, not the trees.
- 06:00: head `41d5970` merged into the branch (`e03ccc3`); the medium-LOD thinning judged not
  worth it (−50 K at A against a density pop at the 20 m swap and C's white-barks at 15–40 m).
- 06:45: `agent/fable-4-crowns` merged (`be27f4e`). New branch `agent/fable-4-budget` `119a7b4`:
  W38 give-back — medium twigs skipped (draws kept), one leaf in 6/12 at constant coverage;
  measured A −25 K / C −110 K / F −56 K, SSIM within ±0.0001, high LOD identical.
- Iteration 6 (`d914268`, `29b9ed1`): a real low bough on every young/mature stem at 22–34 %
  height (fable-5's W08 at C) — PASS at 8 m / 12–20 m, C only slightly (azimuth away from the
  camera). On the sealed head (`acec321`): A −7 K … C −91 K, SSIM within ±0.0003. Ready @ `7bf30a5`.
- 13:15: taper measured at C (a birch's 2:1 that does not read at 22 m — reported, not
  exaggerated); non-author review of fable-2's W23 loaf at D (IMPROVED). Branch merged up to `ca562e7`.
- 14:20: lean-out experiment — C −0.0019 vs −0.0021 in: the cost is the lean, not the direction;
  not shipped. Branch merged up to `e54a74e`, ready.
- 13:25: `agent/fable-4-r49b`: `5fe5848` vertex marks retired (C −0.0001) and `ea86f8c` lean 5–10°
  turned across camera C (reads at C; costs C −0.0021 — inside the rule, fable-cursor's call; separable).
- 11:45: budget branch merged (`f3e7721`), C correction accepted. New branch `agent/fable-4-r49b`
  `5fe5848`: the round-48 vertex broad bands/chevrons retired (fable-5 §I) — colours only, capturing.
- 10:40: fable-2's review answered — the main bough already points into C's frame (local 0.80 rad →
  world +0.42); its leaves merge with the far stem's crown behind; W08 at C stays IMPROVED. Branch
  merged up to `5e525de` (`7ed102e`), green.
- 10:15: take-0122's C −0.0046 measured NOT mine (reverting my merged commits on the sealed head
  moves C 0.2336 → 0.2334); correction posted.
- Next: expansion-2's backside banks (young white-barks) if positions come; otherwise reviews.
- Blocked: PR creation for this identity ("must be a collaborator", twice); reported in the INBOX;
  fable-cursor merges from the branch; retried every iteration.

## Files / systems being touched
`src/world/trees/whitebark.ts`, `src/world/trees/bark-texture.ts` (the lane). One line + one
import in `src/world/trees/index.ts` (the hook that adds the terrain-seated root mesh under the
`white-bark` group) — asked for in the INBOX, kept in its own commit so fable-cursor can drop or
re-add it. Nothing else in `src/world/trees/` (giant, column, bole, distant, placement,
nearCanopy, materials, index otherwise) is edited.

## Completed work (branch `agent/fable-4-whitebark`, PR #15)
- `bark-texture.ts`: the tile is 512 × 2048 and spans `WHITE_BARK_TILE_M` = 2.4 m along the stem
  (was 1 m — the survey's "~1 m vertical repeat" was the tile itself). Second octave: 0.5–1.5 m
  tonal zones, paper seams with a lifted edge / shadow line / warm inner bark, 4–5 dark lenticel
  bands (clustered scars over a ragged wrap-safe underlay, cracks across), lens-shaped lenticels,
  6 skewed ragged knots with a callus rim and a moustache smear. The painter is pure
  (`paintWhiteBark`, no DOM) so the tile can be rendered offline; mean sRGB luminance 203/255.
- `whitebark.ts`:
  - dense trunk rings (18 cm below 3 m) on the SAME polyline — `sample(trunk, t)` for every
    branch is untouched; a sharp butt flare (+88 % at the ground line, e-fold 14 cm × girth) and
    fluting: each toe continues up the foot as a ridge (+21 %), hollows −10 % shaded;
  - bark tile mapping per variant: v rescaled to the 2.4 m tile with a 0.92–1.08 stretch and an
    offset, u offset + spiral shear (0.10–0.17 wraps/m) so no mark stacks above itself; the side
    leaders share the tile at the trunk's scale;
  - per-vertex sooty foot (near-black, ragged margin, 0.35–0.65 m × girth) and 2–4 dark lenticel
    bands (6–14 cm, wandering ± 6 cm around the stem) in the vertex colour;
  - peeling paper curls (near LOD): 1–17 scrolled strips at 0.9–4.2 m read off the finished
    rings, in the ring's own tinted colour turning to the warm inner bark, free edge quivering
    (flutter 0.003–0.007, a third of a leaf's);
  - `whiteBarkToeSpecs(p)` / `whiteBarkTileMapping(p)`: pure functions of the params shared by
    the instanced trunk (fluting) and the root mesh;
  - `createWhiteBarkRoots(...)`: ONE merged mesh of every placed tree's 3–6 toes, each section's
    bed on `terrain.height` under it (−4 cm at the flare, −10 cm a metre out, diving at the end;
    flanks 3 cm under), low and broad (2:1), wandering with knuckles and a gnarled dome, the tile
    magnified ten-fold so the vertex colour carries the root; aRoot.xyz = the tree's origin so
    the tree material's sway anchor and moss ring work per tree. +2 draws (+ shadow), ≈ +0.09 M
    tris on A;
  - crown layering (`80fab20`): per leaf, the share of the shade fill is written through
    `leafShade` (writer.ts aRoot.w) = a structured shell × top-lit term × a 0.75–1.25 per-leaf
    draw (fork), clamped 0.3–1; the lit rim/top tone × 1.12. Measured at `f4-crown-up`: the
    vertex-tone route alone moved the lobe's sd 21.2 → 21.5; a structured leafShade alone only
    lowered the level (107 → 99.5, sd unchanged — from below one sees the bottom shell); the
    per-leaf draw gives neighbouring laminae 0.55–1.0 of the fill (mean 107 → 103, sd 21.0).
- Verification: `variants.mjs` fingerprint (scratch, /tmp) — LOD-0 `radius` identical on all 10
  variants, `height` identical except ± 4 µm on the two saplings (the trunk-top ring's azimuth
  after the denser frame transport), leaf vertex hashes identical on 7 of 10 (the 3 mature
  variants with epicormic shoots: the shoot shoulder reads the trunk radius, ~6 shoot leaves each
  moved ≤ 1 cm); the exact `placeWhiteBark` replica (real terrain + layout + seed chain) gives
  the SAME 80 placements (variant, x, y, z, yaw, scale; 9 reseated) before and after.
- Six views at settle 6, baseline `d06e275` (take-0116 within ± 0.001) → `80fab20`:
  A 0.2249 → 0.2249, B 0.2029 → 0.2029, C 0.2359 → 0.2362, D 0.2779 → 0.2780, E 0.2135 → 0.2135,
  F 0.2634 → 0.2634; draws +2 on every view (max 523); +0.12 M tris; leafCount 288,607
  unchanged; W12 161/161 (maxGap 0); determinism 0; console clean. Tests 9/9 (trees) + 32/32;
  anti-cheat green (86 checks).
- Evidence: `art/environment/round47-whitebark/` — nine BEFORE | AFTER sheets (`poses.json`)
  and the README with per-pose verdicts.

## Important decisions
- **Placement must not reshuffle.** `placeWhiteBark` and the LOD bucketing read each variant's
  LOD-0 `height`/`radius`; the variant RNG stream feeds the crown after the trunk. Every new
  feature draws from `createRng('whitebark/<seed>').fork('base-47')…`; the five legacy buttress
  draws a root are still taken (and dropped) so the crown stream is where it was.
- **Toes are per instance, not per variant.** The variants are InstancedMeshes, so a toe in the
  variant geometry cannot know the ground under each instance. Measured on the exact placements:
  the terrain drops > 0.15 m within a 1.6 m toe reach under 39 of 80 trees (p90 0.46 m, max
  1.36 m — local relief, not trunk slope; the trunk slopes are ≤ 0.23). Flat toes float there;
  the merged mesh seats every section on `terrain.height`.
- Evidence rule (round 46): before/after at the exact survey pose; an after that looks like its
  before is reported as a FAIL.

## Known issues
- **Crown from below is still pale and flat-ish** (`f4-crown-up`): the level of a lamina's
  underside is set by the standard hemisphere/environment indirect (not scaled by `vLeafShade`)
  and the leaf shade floor in `materials.ts` — trees-30's lane. Suggestion: scale that indirect
  by `vLeafShade` too, or darken laminae whose geometric normal faces down. The geometry side
  (smaller leaves in greater numbers, more vertical blades) would move the crown envelope and
  therefore the placements — not done for that reason.
- Per-INSTANCE bark UV offsets need the vertex shader (materials.ts, trees-30's lane): the
  per-variant offset + spiral + the shader's world-position tone noise break the repeat, but two
  instances of one variant still share the scar layout. Suggested one-liner for trees-30, in
  `WIND_VERTEX_BODY` after `vTreeUv = uv;`: `#ifdef USE_INSTANCING vMapUv.y += fract(instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.61) * step(leafW, 0.5); #endif`
  (and the same for `vNormalMapUv` / `vRoughnessMapUv`).
- The whitebark near the survey pose stands in ferns; the toes are best judged at
  `f4-mature-relief` (−57.7, 11.7) and `f4-base-low`. A sapling's toes (R 0.06 → 0.26–0.37 m
  long) are under the grass.
- The root mesh is one draw over the whole 12–60 m ring (always submitted; ≈ 55 k triangles,
  no LOD). If it ever matters for W38, split it into quadrant meshes for frustum culling.

## Recommended next work
- vegetation: survey-2 #10 — the forest floor right under the whitebarks is still bare olive.
- trees-30 (materials.ts): the per-instance UV offset above; a near-detail second bark octave
  for the white-bark program like the giants' `BARK_NEAR_DETAIL` (the tile is 1.2 mm a texel,
  soft at 0.5 m).

## Last updated
2026-09-20T13:15:00Z

## 2026-09-20 13:45 UTC — tick: handoff to astra-trees; the tunnel views checked

- Merged head `69d16c4f` (structures-32's tunnel, the overlap map) into `agent/fable-4-r49b`
  (`888c8f7a`). fable-cursor's overlap map gives Astra `materials.ts`, `leaf-cluster-texture.ts` and
  `bark-texture.ts` *shading*; I keep `whitebark.ts` and the tile's painted features. Posted the
  measured handoff (crown fill has no hemisphere leverage; the shafts + flat per-leaf shading past
  `leafNear` are the "cards"; band contrast 3.7 : 1 against the current colour pass; the toes' plain
  v-band 0.34–0.60; the palette hooks the crowns follow).
- Sanity on the new head: `x-arch-tunnel-n` and `x-arch-approach` (`/tmp/f4/r66`) — the young
  white-bark at (8.0, −64.8) frames the tunnel's opening at the right in both; no collision with the
  tube, the north sign or the floor tint. Nothing to change.
- Still waiting: the r49b merge (`5fe58488` marks-retire, `ea86f8c1` lean — fable-5 measured both,
  both accepted); expansion-2's backside banks for the young white-barks.

## 2026-09-20 15:40 UTC — tick: the crown "cards" at 3–10 m are a material range (measured, proposed)

- Astra's `agent/astra-environment-quality` reviewed for white-bark side effects: their `materials.ts`
  moves are the giants' bark floors (`TREE_BARK_FLOOR` texture/canopy/chroma, near base/bole); the
  white-barks run `WHITE_BARK_FLOOR` (lift 0) and the untouched `TREE_LEAF_FLOOR`; no cluster cards.
  Nothing of mine moves on their branch.
- GOAL_MODE #2's other half: the near leaf path fades at 6 m; the white-bark material ran the default.
  Scratch worktree, two ranges measured: 4–12 (a third of the effect) and **5–16** (lobe sd 21.9 → 23.2
  at `f4-crown-up`, 19.2 → 20.7 at `f4-crown-side-8m`; trunks and shaded mass unchanged). Six views
  pixel-identical for both (before `2bc5e72` vs after, settle 6). Committed as a one-line proposal on
  `agent/fable-4-leafnear` (`d2c33a65`, on top of r49b) — Astra's file since 13:10, so it lands on
  their go; INBOX note with the numbers and the crops (round49-whitebark README §leafnear).
- Lesson noted: `capture.mjs --help` starts a real capture (no help flag) — stopped by PID; nothing
  landed in the repo (`gauntlet/out` is ignored and was removed).
- Still waiting: r49b's merge; expansion-2's backside banks.

2026-09-20T10:40:00Z

## 2026-09-20 16:50 UTC — tick: expansion-2 landed; a white-bark through the far hut (fixed)

- Head `97c83227` (expansion-2, character-10, the W24 fix). My replica of the white-bark placement,
  run in the legacy view with `expansionCull`: one scatter tree inside the expansion's moved ground —
  mature variant 7 at (−39.72, 31.12) on the far hut's knoll, 0.70 m buried, crown across the lamp's
  sight line from Link's spot (expansion-2's "nearest base 11 m off" came from the audit's strided
  sample). Fix on `agent/fable-4-knoll` (`6f18fa6f`, off the head): `expansionCull` on the white-bark
  placements, one line in `trees/index.ts`. Measured: `f4-sw-pan-hut` — the hut's silhouette appears
  where the crown was; `f4-knoll-20m` — the birch through the hut's level is gone; six views
  SSIM-identical (A/F pixel-identical, 2–3 flicker pixels elsewhere), draws/triangles identical.
- The bank white-barks I offered: computed, not placed — every 6–8 m stem on the bank's top lands its
  shadow 3.4–8.7 m inside C; shadow-safe seats only at x ≲ −26…−32 behind the bank. Handed to
  expansion-2 / fable-cursor as a composition call.
- Noted to vegetation-26 / fable-2 / fable-3: `expansionCull` has no consumer in their streams.
- Owner's "trees too green" (13:00): the white-bark vertex colours stay inside the palette (canopy
  hue 93° sat 0.23, sun 76° sat 0.32); the green is the material lighting and the palette — Astra's
  and fable-cursor's; not tuned blind.
- Branches out: `agent/fable-4-r49b` (pending merge), `agent/fable-4-leafnear` (Astra's go),
  `agent/fable-4-knoll` (ready).

## 2026-09-21 09:30 UTC — tick: all three white-bark branches merged; lod-1's 25 m dial delivered

- fable-cursor tick 202 merged r49b, taper, leafnear (with six other Fable branches); take-0126 running.
  Round 51's internal lanes (lod-1, vegetation-28) are blocked by the account; fable-cursor offered me lod-1's
  LOD-dial items. Announced, then did fable-6 §7 step 4 on `agent/fable-4-lod25` (`d9e9be27`):
  large tier bases 25 / 28 m with re-derived per-camera bands (giant.ts NEAR_BASE_RADIUS_OVERRIDE_LARGE),
  pre-fetch 38, pools 256 / 48 MB. Six views pixel-identical (large tier); the walk trace goes from
  268 builds / 315 evictions to 0 / 0, trees.update p95 5.3 → 0.2 ms. Evidence in
  `art/environment/round51-lod25/`.
- Method note: the head's own capture audit (`systems.trees.nearCanopy.pool`) told the pool story before any
  trace — wanted 193 MB vs the 192 MB cap at a still pose.

## 2026-09-21 12:20 UTC — tick: the 30 m lobes measured — a FAIL reported, not shipped

- Head unchanged (take-0126 sealing). Tried §7 (4)'s lobe half on top of lod25: six views pixel-identical,
  pools resident, but 0.00–0.01 % at seven poses — the 40-slot `NEAR_CANOPY_SLOTS` cap saturates near the
  plaza; more radius cannot show without more slots (materials.ts, Astra's). Dropped (never committed);
  README + INBOX carry the numbers. `w10-spine-l` added as base-swap evidence (2.7 %).

## 2026-09-21 13:20 UTC — tick: reply to fable-5's iteration 32

- Head unchanged; take-0126 still not sealed (fable-5 suspects the account block stopped the capture).
  fable-5 read lod25 as "visually neutral" from poses where no widened bole is in the swap window; replied
  with the two poses where it shows (w11-spine-f 2.1 %, w10-spine-l 2.7 %) and why theirs are identical by
  design. W08 turns to pass on their pre-read of the nine-branch head.

### 2026-09-21 11:30 UTC — round 51: NEAR_CANOPY_SLOTS 40 → 64 (lod-1's dial)
- fable-cursor named it the next dial after the 40-slot finding. Measured before shipping: six fixed views pixel-identical (frusta-culled), four plaza poses head vs 64 (w10-spine-u 12 %, w05-spine-u 4.3 %, w22-stairs-u 1 %, f4-lobe-28m 1 %), walk trace +0.01 M tris mean / +0.05 M worst, draws +1, pinned 25 → 38 MB, 0 builds / 0 evictions.
- One constant in materials.ts (Astra's file, veto offered). Branch `agent/fable-4-slots64` @ f8536e5a; README `art/environment/round51-slots64/`.

### 2026-09-21 12:15 UTC — review: fable-2-dmoss
- Cherry-picked onto the head (its base predates the W23 move): D +0.0018, others ≤ 0.0004, 2 m read bare ochre with collar moss. IMPROVED; posted.

### 2026-09-21 13:05 UTC — review: fable-2-stairs-logs
- Six views vs the head: A −0.0017, C −0.0015, F −0.0069 (over budget — the flight is F's structure), B/D/E neutral; A 443 / 8.63 M. Read at w23-stairs-f: round bark nosings with stakes, the demo's flight. IMPROVED, F's cost flagged for the owner's allowance. Posted.
- Also checked: the hero white-bark at C kept its pale read through the brown-bark floors (0.9 % of C moved, the giant's bole only).

### 2026-09-21 13:35 UTC — review update: fable-2-stairs-logs 6b16715a
- Dark timber doubles the cost (A −0.0033, F −0.0127); near-black rolls with a blue-grey sheen. Suggested a mid brown. Posted.

### 2026-09-21 17:40 UTC — the stand beyond the arch (V2 / opus #01)
- Three `after` depth bands of the 26 m pole beyond the north clearing; the palisade first cut withdrawn. Found and fixed the far layer's re-roll (rows before the pool desynchronise the radial stream): `DepthBand.after`. Six views within 0.0002, C/F pixel-identical. Branch `agent/fable-4-northstand` @ 7fec320f; README `art/environment/round51-northstand/`.
### 2026-09-21 19:05 UTC — the plateau's roof (opus #05)
- Two east-giant canopy boughs with four non-casting lobes over w27-plateau-u's zenith, placed by un-projecting the blue; 23.1 → 10.8 % blue; six views identical (F 0.017 %). Branch `agent/fable-4-plateau-roof` @ 263d8f4d; README `art/environment/round51-plateau-roof/`.

### 2026-09-21 20:25 UTC — plateau roof v4
- Two more lobes for the far corner (projected into A/F first); blue 9.6 %; six views vs 24dc4cac A–E identical, F 0.09 %. Pushed on the same branch.

### 2026-09-21 21:10 UTC — tick: opus #06 checked, w10-notes rebased
- opus #06 (giant root flares "pale tubes on the moss", `x-arch-tunnel-u`): rendered on the head 24dc4cac — the flare at the arch reads as brown bark with a moss cap now (the brown-bark floors + rootkit since round 48); no item. Astra is back on the world (`agent/astra-world-resume`, floor moss). `w10-notes` merged with the head for a clean pass. Nothing addressed to me in the INBOX; plateau-roof v4 waits.

### 2026-09-22 04:50 UTC — W38 give-back: white-bark LODs 8 / 16
- Medium/low leaf tris −22 %, high mesh identical (10/10), six views within −0.0004, A −20 K / C −70 K / F −40 K. Branch `agent/fable-4-lodthin`; README `art/environment/round51-lodthin/`.

### 2026-09-22 06:45 UTC — W38 give-back 2: white-bark mid LOD shadows off
- A −60 K, C −240 K, F −130 K, six views within −0.0006 (A/B/E identical). The columns' mid casters measured too: E −0.0032 → kept casting. Branch `agent/fable-4-shadowlod`; README `art/environment/round51-shadowlod/`.
### 2026-09-21 22:55 UTC — tick: plateau roof merged; the atlas fix pre-read
- plateau-roof merged (99a69076). Measured Astra's atlas sRGB fix alone (head vs head-minus-commit): A −0.0001 … C −0.0022, hue-to-ref +0.02–0.21° in all six, 0.4 % of C's pixels (the cards) lighter by ~8 levels. Posted. A now 8.80 M (200 K headroom).

### 2026-09-22 00:35 UTC — tick: the north spine's sky measured, not shipped
- w19-spine-u 52.5 % blue. Six built lobes over the spine vanish from below when near-eligible (43 %), draw as far laminae (33 %); corridors / settle / hero pass / pool cap eliminated. README `art/environment/round51-spine-roof/`; question posted for the near-canopy kit's holder. Nothing shipped.

### 2026-09-22 01:50 UTC — tick: the spine-roof question, two more eliminations
- Settle 400 frames (2.4 s of pool build work) and a 512 MB canopy pool both leave w19 at 43.2 %: the near parts of the zenith lobes are not drawn from below for a reason I have not found; question stands in the INBOX. fable-cursor: A at 8.80 M, no more canopy on A's side without a matching cut — my lane's cut candidate is white-bark LOD 1 (147 K at the fixed views), ~45 K for a 30 % thin, held until the roof has an answer.

### 2026-09-22 03:20 UTC — review: fable-2-pebble-tiles
- Six views pixel-identical, A 8.80 → 8.77 M, F −130 K, draws +5 at A. IMPROVED (perf), posted.

### 2026-09-22 00:45 UTC — tick
- lodthin merged (tick 216, 0b33c641; 13/13 tree tests). Astra's `persistent-fold-audit` read: her bank-core parts are visible but excluded from the fold slots — the fold/slot coupling is deliberate there; not the zenith-lobe mechanism (giants are translated only, yaw 0 — one more hypothesis closed). fable-3's tunnel-floor branch is a note, no code. Nothing addressed to me; the spine-roof question stands.

### 2026-09-22 01:50 UTC — tick
- fable-5 iteration 50: lodthin reproduced on the head, harmless as claimed. fable-5 iteration 49 flags PR #29's bank-core recession at F −0.0104 (Astra's, in hand). take-0132 lost to a timeout, take-0133 restarted. `pruneNearPools` read (residency only) — the spine-roof question stands. Nothing addressed to me; no code branch to review (fable-2-b3-lo is a census fix).

### 2026-09-22 07:40 UTC — tick: round-52 list read; hue measured
- fable-5's round-52 list has nothing assigned to me; #2 (canopy hue 73–75° vs 60–65°) includes the white-bark crown (77.7° at C) — Astra's warmth hook covers `whiteTree`, so I posted the measurement and left the palette alone to avoid a double turn. take-0133 capturing; shadowlod waits.

### 2026-09-22 08:20 UTC — the spine-roof question answered
- Runtime probe (scene hooks): near parts built, drawn, 2.5 % of the frame each at 17 m — laminae-only clouds; the far lobes' cards are what roof. Not a bug; the question withdrawn, options posted (far-only lobes with an explicit flag, or cards / a higher laminae cap in the near kit). Probe scripts kept out of the repo.

### 2026-09-22 09:45 UTC — fable-cursor's pool-residency ask answered
- Six-view walk in one page: heap +8 MB, canopy pool 426/426 resident 223.9 MB, 0 builds / 0 evictions every view, frames steady 12–16 s (SwiftShader). Not the pools. README `art/environment/round51-pools-walk/`. shadowlod merged (tick 220).

### 2026-09-22 11:20 UTC — shadow proxy measured, held
- fable-5's option built: six views A/B/E/F identical, C +0.0005; A +20 K, C +120 K; grove 1.2 % darker by 9. Held as an option (a third of the give-back for a soft return). Branch `agent/fable-4-shadowproxy`; README `art/environment/round51-shadowproxy/`.

### 2026-09-22 13:30 UTC — memory: CPU arrays released on upload
- fable-cursor's OOM ask. Measured the split (renderer 2.1 GB = 0.73 GB arrays + 1.4 GB JS objects; GPU 1.7 GB). Shipped `releaseAfterUpload` for every tree geometry: renderer −125 MB at A / after six views, pixel-identical. Branch `agent/fable-4-poolmem` @ 79699a4f; README `art/environment/round51-poolmem/`. Next levers posted (JS objects, other systems' arrays, the pools' resident set).

### 2026-09-22 14:40 UTC — poolmem with the warm-up
- ?warmup=1 (the game's default path): renderer 2132 → 1690 MB, heap 1525 → 1085 MB — the full trees saving. Posted; offered to hoist the helper for other systems.

### 2026-09-22 16:30 UTC — memory step two: vertex storage compacted
- Normals Int8 / colours Uint8 / aWind Uint16, range-checked; trees 318 → 228 MB, renderer −94 MB (no warm-up) / GPU −61 MB (warm-up); six views ≤ 0.0001. Branch `agent/fable-4-vertexbytes`; README `art/environment/round51-vertexbytes/`. Held for the pass after take-0133 seals.

### 2026-09-22 17:20 UTC — tick: corrections taken
- fable-5: the merged release is −568 MB Chrome on the capture path; ?warmup=1 must stay off for takes (SwiftShader moves bytes to the GPU process); the heap's objects are 0.50 GB, not 1.4. Acknowledged in the INBOX. vertexbytes waits for the post-take pass. Offered to bisect a program-count jump for the stall.

### 2026-09-22 19:10 UTC — overdraw measured; prepass proposed
- vertexbytes merged (tick 227). Trees-only overdraw at A: 52 fragments per covered pixel (max 166), C 26.5 — fable-2's per-pixel cost explained. Proposed a depth prepass (needs three folding depth twins in materials.ts — Astra; trees side mine). README `art/environment/round51-overdraw/`.

### 2026-09-22 20:40 UTC — prepass timed: no gain
- Built the depth prepass prototype (twins wrapping onBeforeCompile; frame correct to 0.4 % px); A frame 14 950 → 14 703 ms (noise) for +72 draws / +3.2 M tris. SwiftShader pays the leaf shader regardless of depth rejection. Ask to Astra withdrawn; nothing shipped.

### 2026-09-22 21:35 UTC — tick: heartbeat
- Head c7379f98: fable-cursor's grass blades to 26 m (+60–100 K at A, measured at take-0134); take-0133 at F, det + motion to go. Nothing addressed to me; fable-2's V16 flush and form-2 are measurements, not landings. notes2 merged with the head; no code this tick.

### 2026-09-22 15:30 UTC — round 51: the north stand's poles take the far LOD beyond 50 m (`agent/fable-4-standlod` @ `60408959`)
- W38 give-back after fable-2's grass (A 8.83 M, 170 K under): the stand's ~150 poles stood 60–100 m from A/B/D/E
  in their frusta and drew the near LOD to 120 m. `bucketDistant`: `variant.bandOnly && z < −62` → far LOD from
  50 m × quality.distance. A/B/D/E −50 K each; SSIM Δ 0.0000 at all six; D 416 px (the strips through the arch);
  the three arch poses (10–36 m from the poles) 0 pixels differ head vs branch. One file. A after: 8.78 M.
- Method note: a per-placement LOD threshold keyed on the band-only variant and position keeps distant.ts (Astra's)
  and the DepthBand type untouched; fable-cursor's far-trunk row at z −46 is excluded by the z test.

### 2026-09-22 17:05 UTC — round 52: the owner's clarity circle attributed (no code)
- The owner's marked screenshot (via Astra): blurry crown forms at height. Reproduced the symptom on the west
  meadow around the hut knoll (six seated candidates); hide-one-group with a frozen clock over the upper-left
  region: `trees/distant` far crown cards 29–69 %, white-bark 12–21 % (crisp leaf clusters, not blur), canopy
  roof 1.5–12.6 %, columns 2–3 %. Panels show hiding the cards removes every soft form. Astra's lane; no
  white-bark crown pass. Seam: re-check the white-barks' mid LOD at k3/k4 after her change.
  `art/environment/round52-clarity-attrib/README.md`.
- Tools learned: CPU raycasts miss shader-positioned instances (82 % no-hit over the cards); `__ZR__.probe`
  seats third-person poses; `setTime` freezes wind/motes so hide-and-diff has a < 0.5 % floor.
- 18:40 — second pass from the hut's back side: k10 at (−38, 70) reproduces the owner's framing; the region is
  98.7 % `trees/distant` — bole, blurry crowns and lollipop trees are all the distant near LOD (strips + cards).
  Posted `owner-clarity-1` for fable-5's clarity.py reads; reconciled with her clearing-pose read (giants there).
- 18:58 — take-0134's clarity set at `owner-clarity-1` with fable-5's clarity.py: the fog closes the hue
  (background 75° → 60°), the silhouette does not move (6.7 px, 2.9 % fine, one fused blob; crown l 0.44).
  Arch poses −0.004…−0.011 luminance under the fog. README §Third pass.
- 19:54 — standlod re-verified under the lighter haze (head with/without `60408959`): A 789 px (0.086 %),
  D 1 901 px (0.206 %), no legible difference in the arch window; posted for Astra's preview. round51-standlod
  README postscript + crop.

### 2026-09-22 23:20 UTC — round 52: the colour pass draws only in-view family instances (`agent/fable-4-mainpass` @ `06a1dca5`)
- Triangle map of A (hide-one-group): white-bark 0.52 M, of which 402 K two high-LOD instances behind the camera
  kept for their shadows. Split kept into in-view + shadow-only; `onBeforeRender`/`onAfterRender` swap the
  InstancedMesh count between the colour pass and the shadow pass. A three-sphere hull (crown / lower wood /
  upper wood) replaces the fat bounding sphere for the colour-pass test (pad 1.5 m).
- A −150 K, F −130 K, B/C/E −50 K, D −60 K; six views pixel-identical; 16/16 tests. Learned: a `const`
  defined late in `create()` but used at build time throws a TDZ error at runtime that tsc does not catch —
  the first v2 build failed the trees system ("Cannot access '$e' before initialization"); fixed by hoisting.
- 23:34 — fable-5's walk item 6 (flight climbs into shade) attributed at A by castShadow-off per group: white-bark
  0.0 %, giants +0.034, all casters off only 0.376 vs the frame's 0.65 — the light on the treads, not the canopy.
  `art/environment/round52-flight-shade/`.

### 2026-09-23 02:47 UTC — round 52: giants' sectors per giant + crown band, colour-pass cull (`agent/fable-4-sectorgroups` @ `5000e9ae`)
- The giants' 1.85 M at A in three sector meshes that always meet the frustum. Groups per giant (mergeParts
  useGroups), split wood | two leaf height bands; exact bounds per group; `cull()` marks groups with sphere +
  exact SAT box test; onBeforeRender/onAfterRender zero/restore the group count for the colour pass only.
- A −148 K, B/E −266 K, C −351 K, D −360 K, F −309 K; six views pixel-identical; +66 draws. Four builds to
  get A: per-giant boxes did nothing at A (a behind-camera giant's box holds the camera), exact SAT −76 K,
  spheres nothing more, height bands −148 K. Lesson: for culling, the bound's shape matters more than the
  test's exactness once the object is big and near.
- 03:51 — sectorgroups re-verified on the moved head (floor cards +63 K at A): A 8.675 → 8.527 M, the same
  deltas everywhere, A 1 px / D 0 px; branch carries the head merged (`264c3d3f`).
- 03:59 — re-verify on the owner-09-23 head: four look-ups under white-barks at 50–55° — crowns read as layered
  leaves; the flat pale shapes are the distant floor cards (Astra's). slimTrunks fine. `round52-lookup-whitebarks/`.
- 05:42 — row 28 (LOD pops), white-bark half: the hero's switches at 25.85 / 46.27 m measured with 4 cm frozen pairs
  vs parallax controls — no excess (7.61/7.79, 8.30/8.29 %). Negative result, no crossfade. `round52-lodpop/`.
  Posted the plateau-oak authored-leaves density (257 K in a 7 m cluster at 21 m) to Astra. sectorgroups merged.
- 05:52 — the owner's `u-open-up` flat card attributed to `distant-5-near` (the far-trunk row's east pole, band-only
  variant 5, floor card at 68–71°); options posted for distant.ts owners. `round52-uopen-attrib/`.
- 07:10 — the two culls under the free camera vs a no-cull build at eight poses: 0–10 px (leaf-edge order), −3…−16 %
  triangles (most looking up). `round52-freecam-cull/`.

### 2026-09-23 09:37 UTC — round 53: lanes 2/3 (the owner's 06:50 priorities) — understory trees (`agent/fable-4-understory` @ `c1988edc`)
- `understory.ts`: 4.5–9 m round-crowned trees, brown stems, 5 variants × 3 LODs; 44 seeded placements along the
  north path verges, the clearing, the plaza lawn edges. Family pipeline, slimTrunks, audit. A +64 K, D +83 K.
- D window protection tried and dropped (emptied the corridor). Six-view capture running; crops at the owner's pose.
- 12:01 — fable-cursor merged the 44-tree understory (e4c02b82) alongside squad2's mid-canopy cards; reviewed the
  combined corridor at 7 poses (complementary depths, no doubling; +1.18 M at the owner's pose mostly squad2's).
  The arch-stretch commit (34 trees, D −0.0033) offered as the D lever; branch carries the head merged.
- 12:33 — the west fork (fable-3): understory clearing 8.5 m at (−10.5, 8.5) (44 → 32 trees); the dome hiding the
  marker attributed to vegetation (58.6 %), not trees. Branch `agent/fable-4-understory` carries the arch-stretch verge
  + the clearing, head merged.
- 12:57 — understory: stems seated on the rendered surface; a west-meadow zone measured and dropped (squad2's mid layer
  fills it). Branch @ `a2d3097b` awaiting merge with the arch verge + fork clearing.
- 13:42 — W38 map at A on the head (9.155 M): vegetation +535 K is the overshoot (lane 4), structures +75 K, cards +34 K,
  understory +29 K; trees −220 K net. Posted; taking the shadow proxy re-measure and handing the plateau-oak number to squad3.
- 14:41 — heroshadow: shadow-only high-LOD white-barks cast from the medium geometry — A 9.15 → 9.02 M, F −160 K, five
  views pixel-identical, C −0.0005. `agent/fable-4-heroshadow` @ `820a01d5`.
- 15:17 — heroshadow generalised to the columns and dropped (+127 draws, +30 K); branch @ `852245f7` white-barks only,
  head merged, ready. Lesson: per-variant twin meshes multiply draws — the twin pays only where a heavy high mesh casts
  out-of-frame shade.
- 16:27 — head draws over 700 at A (723) since lane 7's cast — flagged. Understory finer leaves (2× count, ⅔ size) on
  `agent/fable-4-understory-leaves`; six-view capture running.
- 17:27 — finer leaves six views: A +0.0013, B −0.0028, D +0.0020, E +0.0034; ready with heroshadow.
- 18:53 — midwalk option: the mid grove keeps 11 m off the walk lines (post-filter; 393 → 372). Six views mixed (C/D +0.009,
  A −0.006). Posted as an option. Lesson: filter after sampling — a rule inside the sampler re-rolls the stream.
- 20:20 — midwalk adopted by fable-cursor (their variant reverted). Understory walk clearance 6.5 m everywhere as a
  post-filter (32 → 27): owner-0650 dark 48.6 → 46.3 %, six views all ≥ 0 (B +0.0071, E +0.0085). Branch
  `agent/fable-4-understory-walk`.
- 20:41 — understory-walk merged; fable-5 confirmed h-west-front clears. Read Astra's real-leaves branch at owner-clarity-1:
  silhouette half closed (2.9 px, 8.4 % fine) at +0.9 M tris; hue half is lane 1's. README §Fourth pass; INBOX.
- 21:38 — the near-canopy swap measured for pops on the head after fable-cursor's near-base fix: none (15.86 vs
  16.84 % control). Astra's real-leaves read posted earlier this tick.
- 21:41 — A at 695 / 8.95 M after fable-cursor's near-base floor; posted the remaining tree give-backs with their
  look costs; queued understory zones for the south exit once exp-south merges.
- 23:19 — fable-cursor's levers b/c measured: the crown pool keeps up with a 5× walk (late ≤ 3, 0 sync builds); the swap
  does not pop when resident. `nearCanopy.late` audit field on `agent/fable-4-latecount`. Nothing else open.
- 2026-09-24 00:18 — squad2's treepop (white-bark rung 20 → 28 m) measured against the round-52 pop test: the switch
  never popped; head A 8.947 M / 643; treepop's six-view row pending on the box.
- 2026-09-24 00:29 — treepop six-view row: draws +48…+56 (A 692), C +465 K; recommended hold with the round-52 pop numbers.
- 2026-09-24 01:34 — heartbeat: head unchanged since 23:05 (`81430baf`); squad2 measured lever (c) themselves (0.00 %) and
  re-priced treepop on the merged head — fable-cursor's call with my six-view row; exp-south carries the understory's
  south zone. Nothing open in the lane; no INBOX note (nothing landed).
- 2026-09-24 02:23 — heartbeat: head still `81430baf`; squad2 on near-canopy slot-rank hysteresis (a pop source I had not
  measured — slot competition when wanted > slots; their lane). Nothing open here.
- 2026-09-24 03:28 — heartbeat: head still `81430baf` (4.5 h); squad4's integration candidate `8fb5049c` folds in treepop
  (C 6.76 → 7.20 M there, as my row said) — fable-cursor's call on return; nothing open here.
- 2026-09-24 04:39 — exp-south merged (with my south understory zone, 4 stems): reviewed at four poses — trees frame the
  route, nothing to change; far-bank look-north 768 draws flagged. latecount merged.
- 2026-09-24 05:52 — treepop merged by fable-cursor; my draws claim corrected (base mismatch: squad2's branch predated the
  skinned kids). Head caps A 8.858 M / 638, B/E 8.254 / 627, C 7.685 / 560, D 8.569 / 561. Lesson: compare branches
  against their own base or rebase both before a row.
- 2026-09-24 06:36 — heartbeat: head `92a4fd66` (the owner's 06:07 50-point rubric for structures / areas — not the tree
  systems); fable-5 finds the roofed poses dark under squad4's near veil (lane 1's). Nothing open here; the east lane
  still on its branch.
- 2026-09-24 07:32 — exp-north's trail/shelf cross the stand's north band and the east band's edge; offered the post-filter
  recipe (northFooting) or to do the tree side on their branch. Head `b306d6a9`; nothing else open.
- 2026-09-24 08:36 — heartbeat: head `b306d6a9`; fable-cursor did exp-north's tree side on their branch (grove understory
  zone, `northGroveClear`, card crowns ≥ 11 m off the grove walks, post-filters after every sampler) — my offer answered
  in code. Review at the grove's poses when it merges.
- 2026-09-24 10:50 — exp-north `943d10b4` tree side reviewed at eleven hamlet poses before it lands (round54-north-review):
  the stand's poles off every walk (45 culled, west band untouched); the 50 m stand rule pixel-identical to 72 m at ten poses
  (3 px at the nest) — no grove exemption; the shelf's two looks south 748 / 9.44 M and 730 / 9.25 M — structures 2.9 M / 190
  draws and the characters' 100 draws, trees under their A share (2.2–2.4 M / 168). One nit (protect grove stems by `p.grove`,
  not the box). Head `b306d6a9` unchanged since 07:05.
- 2026-09-24 12:12 — exp-east `f430d47b` tree side read at eight lane poses (round54-east-review): the seven east-box white-barks
  have no root toes (24 m reach from spine/house/north only; three stand 1.8–5.6 m from the lane) — offered the three-line
  root-reach fix (+4 K tris, no draw) on their branch or after it lands; four spared mid boles 1.8–2.4 m off the lane's
  centreline (their A–E exemption); the green → west 780 / 10.10 M; seating ±4 mm. Head `3c6cc553`; nothing addressed to me.
  Next: the roots fix when fable-cursor answers or exp-east merges; the field's forest edge when south2's layout settles.
- 2026-09-24 14:58 — the east lane's root toes built off exp-east (`agent/fable-4-eastroots` `ea78545a`, PR #51) and measured
  a FAIL: +4,448 tris, six views pixel-identical, 0 px at the lane's e3/e5, 6 px at the foot from 2.3 m; the toes (6–13 cm on
  the plateau's young/mature variants at scale 0.91) sit inside the 30 cm turf and the ground's 4–6 cm relief. Withdrawn, not for
  merge; README `art/environment/round54-eastroots/` on that branch; the 12:12 offer struck in the INBOX. Next: exp-ruins'
  tree side (`ruinsTrunkCull` post-filters, `a32e5a97`) once the branch settles.
- 2026-09-24 15:40 — exp-ruins `7c4fb16f` tree side read at eight trail poses (round54-ruins-review): 11 white-barks within 12 m
  frame the walk (five boles 2.4–3.9 m off the line, none on the earth, `maxBaseGap` 0); six dropped, none in a fixed frame
  (nearest 60° off C); `ruinsCardCull` 57 mid / 2 distant — hide-the-layer at r1/r2 shows no card bole in the 3–11 m band;
  one understory stem at the start only, no zone proposed; looks back east 736 / 8.96 M and 730 / 8.91 M (structures pattern);
  the ivy rock a smooth pale cylinder from 30–45 m (fable-cursor's). Next: the field's forest edge when south2 reaches it.
- 2026-09-24 16:45 — squad2-crowntone `8cdb68c3` read behind the understory (round54-crowntone-review): head vs branch at six
  poses; the cards +7–9 levels toward their air at 16–40 m, the understory ≤ 0.2 on the same pixels, the near-to-far step
  +0.6–1.8 on 10–22 — depth order kept, no seam; eye level and the look-ups untouched. Safe for the corridor; nothing to change
  on my side. Head still `3c6cc553`; nothing addressed to me. Next: the field's forest edge when south2 reaches it.
- 2026-09-24 17:20 — exp-south2 `066144ad` tree side at the dwellings (round54-south2-review): no stem within 14 m of the hut
  or the waystation, no crown over them, `maxBaseGap` 0; far bank → north 759 / 9.26 M (fable-cursor's pattern). Head still
  `3c6cc553`; nothing addressed to me. Next: the field's forest edge when south2 reaches it.
- 2026-09-24 18:05 — `trees/index.ts` pre-resolved for the expansions' merge (round54-trees-merge; branch
  `agent/fable-4-trees-merge` `f0bc4b4d` = exp-east `b3e10c09` + exp-ruins `6bd9b870`): the three hunks kept both sides;
  the other six files mechanical for compile (expansionCull's two fourth flags merged as `all`); tsc/build/tests green;
  combined tree side run — counts add (culled 16, cards 57/2, understory 30, gap 0), trail poses 4/30 px. North's trees
  hunk is the import line; collision.ts/system.ts are fable-cursor's. Head still `3c6cc553`.
- 2026-09-24 19:15 — fable-2's 18:15 (trees 250 draws at the east look-backs) measured mesh by mesh (round54-lookback-draws):
  258 / 232 draws = 63 / 32 near-canopy lobes (giants within 30 m of the plateau + seated columns), 72 sector-group draws (3 ×
  12 groups × main + shadow), 32–36 distant bands, 10 white-bark low draws for 40 trees. Not per-tree meshes; a card replaces
  nothing. Lever offered (owner-fable's near canopy, asked first): a giant's shown lobes as one mesh with per-lobe groups, 45 → ~5
  at the green, up to 64 → ~6 at A. Head `31146062` merged into the notes branch clean this time (checked --diff-filter=U first).
- 2026-09-24 20:30 — squad2's lodcheck (the 28 m rung owns the residual "trees detail only up close") attributed by family at
  the owner's north pose: shipped vs every-tree-high 3.34 % of the frame (896 × 776, > 8), of which understory 64–74 %,
  white-bark 4–7 % (0.4 % of the frame), columns 2–4 %; the near rung ×1.45 alone leaves 0.27 % but costs +163 K here / +0.5 M
  at the west pose. Told squad2 to hold the rung; two understory-medium builds (1 in 2 at 1.3 ×; every leaf) and two
  white-bark-medium builds (1 in 4 / 1 in 2) rendering against every-tree-high; numbers next tick. (`treelod` must go through
  `ZR_URL_EXTRA` — openWorld builds its own URL; my first "every-high" run was the shipped build.)
- 2026-09-24 21:30 — the residual pop fixed at its family: `agent/fable-4-usmed` `28f95b56` (PR #65), understory medium keeps
  every lamina (`mediumEvery 1, mediumScale 1`). Owner poses +34 K / +20 K; six views (896 × 776 harness) A +24 K / 0.54 % px,
  B/E +17 K / 0.72 %, C 0, D +36 K / 2.29 % px (the corridor's crowns finer), F +11 K / 3 px, draws unchanged. The 1280 × 720
  SSIM table is fable-cursor's full check or next tick. White-bark medium densities measured irrelevant at these poses (35–49 px).
  README round54-understory-medium; INBOX 21:05 to squad2 + fable-cursor.
- 2026-09-24 22:28 — the 1280 × 720 capture pair for PR #65 running (head b31042a2 vs usmed 28f95b56, `--settle 12`): head
  A 637 / 8.85 M, B 628 / 8.27, C 574 / 7.92, D 561 / 8.63, E 628 / 8.27, F 601 / 7.99; branch so far A 637 / 8.87 M (+20 K),
  B 628 / 8.29 M (+20 K). SSIM table via compare.mjs when the pair is done (next tick). No answer yet on the near-canopy fold;
  squad2's lodcheck read merge-safe by fable-5 (D 1.9 % px, Δ −0.0002…−0.0008), which is the same shape as mine.
- 2026-09-24 23:05 — PR #65 measured at 1280 × 720: no view away from the reference (A +0.0003, B +0.0005, C 0, D +0.0015,
  E +0.0002, F 0), draws unchanged, A 8.85 → 8.87 M; merges clean on `b9993008` (exp-north in). Ready; fable-cursor merges.
- 2026-09-25 00:05 — the east × ruins trees resolution redone from the current tips (ruins f29ad20e's heroFramesCard):
  `agent/fable-4-trees-merge2` a25594a0, four hunks both sides, tsc/build/tests 26/26 green; patch against the head b9993008
  (fifth hunk: the layout import union). A wrong "tips unchanged" claim in the 23:40 refresh corrected. PR #65 ready, no reply yet.
- 2026-09-25 01:25 — PR #65 merged (23:45). The white-barks' medium measured at two walking poses (round54-whitebark-medium):
  1 in 4 at 1.8 × halves the gap to high at w2 (1.05 → 0.72 blurred) for A +16 K / C +55 K / F +39 K; 1 in 2 costs 3× for a
  third more. PR #74 `agent/fable-4-wbmed` 2896a08a (one line); the 1280 × 720 pair head 2f6c8ae2 vs branch queued. INBOX 01:25.
- 2026-09-25 02:20 — head 0fc66816 (lodcheck + #65 + #54 in): at 1280 × 720 A 629 / 8.94 M (60 K under the cap), B 616 / 8.27,
  C 562 / 7.92, D 549 / 8.72, E 616 / 8.27, F 585 / 8.05. PR #74's capture runs next (A's +16 K in my harness would leave ~40 K);
  the SSIM table and the call on whether it fits go on the PR next tick. med2's six views: A +47 K … C +146 K, F +115 K (3× med4).
  `STAND_FAR_LOD_M` 50 is inert now that `DISTANT_NEAR_M` is 45 (min() takes 45) — harmless; the comment above it is stale.
- 2026-09-25 03:05 — PR #74 merged (02:15 round); its pair: SSIM identical at all six, A 8.94 → 8.97 M (30 K under the gate —
  heads-up posted). PR #81 `agent/fable-4-standlod-retire` a7006e1f: the inert stand 50 m rule retired (−17/+8), typecheck/build/
  tests green; before/after renders at the stand poses + A/D rendering. Next: near-canopy fold if yes; the expansions' tree side.
- 2026-09-25 03:30 — PR #81 merged (02:56 round, before its before/after landed): the pair since — 0 / 0 px at the stand poses,
  1 / 3 px at A / D at > 1/255, draws and triangles equal (round54-standlod-retire). Lesson re-learned tonight: after `git merge`,
  check `--diff-filter=U` in its own step and stop on a conflict before writing anything (38cfa895 carried markers for one commit;
  c1b30859 resolves them).
- 2026-09-25 04:15 — squad2's "whose wood" answered by hide-one-group with their classifier at the owner's poses (round54-bark-attrib):
  columns 59 % / 24 % of the bark pixels, giants 25 % / 58 %, white-barks 0.2–0.3 %, mid/distant 0–5 %. The brown is lane 3's
  columns and the giants' trunks at 5–30 m; the mid layer's knobs would screen little. INBOX to squad2, cc fable-cursor, squad3.
- 2026-09-25 05:00 — bark attribution corrected (strict count): tree wood = a third of the north band's brown, all columns (5.9 of
  17.2 points); most of the west's, one giant (4.9 of 8.2); white-barks 0. Agrees with squad2's brownwood probe (5.6 % / 5.1 %).
  My 04:15 "columns + giants 84 %" at north withdrawn — the giants' share there was their shade on the bank. INBOX 05:00.
- 2026-09-25 05:25 — the near-canopy draw fold designed and posted (third ask, silence = veto by 06:30): one BatchedMesh for all
  lobes (one shared material), install/uninstall on poolItem's seam, setVisibleAt for show/hide, ~13 nc.mesh sites; heap caveat
  (+35 MB typical). Expected A 629 → ~570 draws, look-backs −45…−60. Start next tick unless vetoed.
- 2026-09-25 07:45 — the near-canopy batch built and measured (round54-canopy-batch, PR #101 `agent/fable-4-canopybatch`
  3a339a0a): one BatchedMesh for the giants' lobes; A 606 → 594, F 522 → 496, the green look-back 701 → 657 draws; triangles
  equal; 0 px vs the exact base. Three seam fixes (first build installs itself; one layout — normals Int8, colours/wind Float32,
  compacted bytes for the pool; the end-of-build compaction skips the batch). Found: PR #47 (notes) sat as a draft from 09-24 12:14 and was
  merged at 06:06 today (after I marked it ready) — my INBOX threads reached the head 20 h late. 1280 pair running.
- 2026-09-25 08:20 — #101 merged at 07:50 (before the 1280 pair). The heap cost measured after: 171 MB at A on the large tier
  (the pool's resident set in the batch, 258 parts / 1.91 M vertices), not the ~35 MB of the design note. PR #104 (comment as
  measured, growth 1.25×) and the INBOX correction with the flag offered; fable-cursor's call. #102 notes merged 07:50.
- 2026-09-25 08:55 — fable-5 read #101 merge-ready (pixel-identical at all six, far bank 774 → 718, green 736 → 701 draws) and
  caught the interim first-build bug independently. Running: the 1280 × 720 pair (base half done), and a five-pose walk on the
  small pool tier (cap 64 MB, 161 resident at A, evictions live) on both builds to exercise deleteGeometry / optimize / growth —
  no page errors through three poses. No word yet on the 171 MB heap (PR #104 / #105 carry it).
- 2026-09-25 11:10 — #101's record closed: 1280 pair SSIM identical at all six (draws A 628 → 614 … F 584 → 555, triangles
  equal); small-tier walk 0 px at five poses with 228 evictions. Heap measured: 171 MB (large, A) / 107 MB (small, after the
  walk) = 1.6× the pool's bytes (72 wide parts keep colours/wind Float32). The trim (b0a05eb5) did not fire (live > half the
  reserve). Next: two batches by layout (narrow / wide) to reach the pool's own bytes.
- 2026-09-25 11:30 — two-layout batch measured (169 vs 171 MB at A) and reverted; PR #117 = the trim + the wide-parts audit
  count. The heap stands as inherent (~1.2–1.5× the giants' resident bytes); the flag is the lever. INBOX 11:30.
- 2026-09-25 12:35 — the batch's page cost measured fable-2's way (performance.memory after GC, flag on vs off on the head):
  +88 MB at A / +90 at the owner's north (large tier), +46 MB at A (small). The per-mesh path keeps unrendered resident parts'
  arrays until first upload, so the page grows by less than the batch's 200 / 102 MB of arrays. #117 merged 11:25. INBOX 12:35.
- 2026-09-25 12:55 — trees `cpuArrays` audit line (9e7b1a78): batch off 219 MB of arrays at A (giants 134, columns 52,
  white-barks 32 — never-drawn meshes), on 312 MB. fable-2's warm-up pass would free ~200 MB in the trees; against a warmed
  head the batch costs its whole copy (~200 / ~100 MB). Recommendation posted: keep the batch while draws are the binding cap.
- 2026-09-25 13:40 — #127 (trees cpuArrays) merged 12:55. squad2's lookbacks: white-barks cheap (76/73 K), trees +0.17 M of the
  +2.19 M. Answered their giants-shadow question (hooks not called in the depth pass; a shadow-only low mesh per giant is the
  lever, a look call) and asked lane 3 for a 4-line USE_BATCHING hook in materials.ts to batch the columns' lobes too.
- 2026-09-25 15:20 — the depth pass attributed to the trees (round54-shadow-attrib): 1.32 M of 2.91 M at A; the giants' three
  sectors 36 draws / 755 K (every group casts — squad2's 0 was its flag), columns 0.30 M, white-barks 0.18 M, understory 0.05 M.
  The lever: a shadow-only low mesh per giant (look call, offered). INBOX 15:20 to squad2, cc fable-cursor.
