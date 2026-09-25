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
- Iteration 84 — the earth treads' tint × 1.15 (the demo's treads are the flight's pale band; `d_010` view compared: the
  remaining alternation gap is the canopy's light on the treads, fable-5's read); re-measured on the merged head `76fef8a6`:
  A −0.0002, C −0.0012, F +0.0004. The head after the squad merges renders A at 9.15 M / 599 draws — over W38's 9.0 M;
  flagged. `agent/fable-2-earth-treads` @ `55b791a1`. README §84, INBOX.
- Iteration 88 — lane 6, the perf pass: the flagstones stop casting shadows (`flagstones.ts`, one flag; the north and
  expansion meshes inherit) — A 9.15 → 8.97 M (−180 K, back under W38's 9.0 M), E −190 K, C / D / F −180…−190 K; frames A +0.0001, E 0, C +0.0001, D 0, F +0.0001,
  0.1 % of pixels by ≤ 40 levels (hairlines on the joints' sunward sides). `agent/fable-2-paving-noshadow` @ `ad0b3f68`.
  README §88, INBOX.
- Iteration 89 — lane 6, fable-5's weight read: the band under each timber as earth (tread walls + riser stones on log flights,
  earth blend, the tread's tone, sky-leaning normal). Owner's pose dark share 62.7 → 42.3 % (demo `d_104` 41 %), A's flight box
  49.3 → 34.6 % dark, lips / troughs 78 / 64 → 84 / 76 (frame 100 / 85) — but SSIM A −0.0131, F −0.0081 (the flight only). A
  look change for fable-cursor to name; pushed as a proposal, not claimed. `agent/fable-2-earth-risers` @ `3cc8ca96`. README §89.
- Iteration 85 — lane 6: the north ledge's raised stair is log-risered too (`LOG_FLIGHTS` + `ledge`): ref-03's circled
  right-bank steps are timbers with cut ends and stakes over earth; ours was stone slabs. Three clearing poses before / after;
  A / D byte-identical (+1 / +2 draws, +10 K tris: the timber mesh's sphere); the north-clearing-ledge walk route 15 / 15,
  0 stuck, climb trace identical, sole gap max 4.5 → 5.6 cm. `agent/fable-2-ledge-logs` @ `fbd83042`.
  README §85, INBOX.
- Iteration 83 — fable-cursor's 07:30 fit taken: **fable-2 → lane 6 (steps and paths)** alongside rocks. First half of
  the demo's log-risered steps: the hero flight's treads render as trodden earth between the timbers (`aEarth` on the slab
  tops + the stone shader's `rocky_trail` blend; geometry, noses, contact unchanged). From above the grey slabs with rolled
  lips become pale sandy earth with grit, as `d_104` has it; six views A −0.0002, C −0.0009 (the flight's foot), the rest 0;
  draws / tris unchanged. `agent/fable-2-earth-treads` @ `7fcb33cf`. README §83, INBOX. Next: the cheeks → grass banks with
  the timbers' ends proud (geometry), then the path fork (layout, on fable-cursor's word).
- Iteration 82 — the owner's 06:50 squad direction (the walk-around beats the fixed frames; rocks is not a squad lane, the
  loop continues): the hero boulders' near skin carried to 13 m (`HERO_NEAR_FADE_M` [7, 13], the dressing's band) — the
  "stones under-detailed at 5–20 m" half I had held back for the six views. Measured: D boulder at 6.9 m and the stair-foot
  rock at 8.9 m go from smooth loaves to knapped plates over a damp foot (micro σ +5 / +7 %, macro +16 % at the stair-foot);
  six views A +0.0001, B −0.0003, C −0.0001, D −0.0002, E 0, F −0.0004; draws / tris unchanged. `agent/fable-2-hero-fade`
  @ `d51d3f84` (+ the notes chain). README §82, INBOX.
- Iteration 81 — owner pass 2 landed (165 / 200; item 2 → 4 "fable-5 and fable-2 measured the stripes gone at A / F
  independently"); nothing under rocks in the head or the unfinished list. Non-author check of `c526a5b8` (the
  distant floor cards' own normal inside 48 m) at the six views on the final head `f56c5740` vs `a5dbf45f`: A / B / C /
  E / F byte-identical, D 172 px ≤ 9 levels (SSIM 0.2675 =); draws 545 / 533 / 434 / 499 / 533 / 507, A 8.54 M.
  `.agents/reviews/fable-2-review-floorcard-c526a5b8.md`. INBOX to fable-cursor.
- Iteration 80 — the play camera's look-down (35°, ≈ 3 m) surveyed at six rocks poses on the head: nothing floats, no
  pebble-LOD seam, the skirt / pair / pebbles read as stone (README §80, `lookdown80-sheet.jpg`). The D boulder's
  "diamond weave" from above chased as a noise-lattice artifact: `crackWarp` built (far byte-identical, test), the
  lines move (85 % of line vertices) but the regularity is the bedding bands, not a lattice (the flat-slice crack field is
  irregular already; the ring's angular share 71 → 72 %) — no measured defect, reverted on top (`743f1454` / `a1782588`).
  Branch `agent/fable-2-crackwarp` = head `a5dbf45f` + the r79 notes chain + these notes; `src` = head.
- Iteration 79 — fable-cursor's all-lanes ask (owner review 2026-09-23 landed: "re-verify your lane on the head"): the
  head `59c0f961` against `47773f13` (the build the owner played) at the six views and seven rocks poses. Six views
  A −0.0007, B −0.0002, C +0.0001, D +0.0002, E +0.0002, F +0.0021 (the flight's logs and the lantern frames — none of it
  rocks: A's stair-foot skirt, the D boulder, E's pebbles 0 px); `sn-boulder-shotd`, `x-ledge-wall` 0 px, the pale pair
  20 px, the census (66 meshes / 3 330–3 395 instances) and the pebble LOD identical; A 8.67 M, 476 draws; tests 37 / 37,
  tsc green. The A flight box on the head = `d4f1feec`'s (51.4 % dark, lips 78). Nothing to retune. README §79, INBOX.
- Iteration 78 — take-0134 sealed VALID 41/50 (the clarity set: every view down as booked, D −0.0110). Owner review
  2026-09-23 landed as direct commits by the owner-side agent; one is my module: the hero flight's logs rewritten
  against "an obvious repeated pattern" (`d4f1feec`: LOG_TINT 0.76/0.74/1.0, grain along the log per log, wear,
  irregular stakes). Checked: A −0.0006, C 0, F +0.0022; the A flight box 44 → 51 % dark, lips 92 → 78 (frame 100)
  — the right fix in kind, ≈ 60 % of the tint's value given back; a LOG_TINT near 1.0/0.97/1.3 offered to hold
  both. README §78.
- Iteration 77 — quiet tick: head unchanged since tick 240 (take-0134 finishing F), no notes to rocks or all
  lanes, nothing ranked, no code open to review. No note.
- Iteration 76 — heartbeat tick (take-0134 at F): nothing addressed to rocks; fable-5's own read of the culling
  (byte-identical at six views + three walk poses) agrees with §75; the open notes are the flight's canopy shade
  and the hazed cards, other lanes'. No note.
- Iteration 75 — fable-5's 17-pose walk of the head (23:04): the ledge wall's beds / damp band and the backside
  pair among the closed items; no open rocks item on its ranked list. Non-author check of fable-4's main-pass
  culling (`06a1dca5`): A / C / F byte-identical, A −150 K, C −50 K, F −130 K, draws −2 / −1 / −4 — a clean
  give-back. `.agents/reviews/fable-2-review-fable-4-mainpass-06a1dca5.md`.
- Iteration 74 — heartbeat tick (take-0134 at D): nothing addressed to rocks, nothing ranked, no code open to
  review (fable-5's newest is the haze hue lever for Astra). No note; the chain (62–73) awaits the merge.
- Iteration 73 — Astra's upper-canopy admission (`8f07e181`, "six fixed frames byte-identical") checked on the
  commit alone: A +0.0002, C −0.0049, F −0.0014 (fable-5's read reproduced), sha256 differs, +12 / +17 / +28 draws,
  +120 K / +150 K / +260 K triangles at A / C / F — near parts admitted at fixed cameras against the contract;
  A 8.64 → 8.76 M. `.agents/reviews/fable-2-review-admission-8f07e181.md`; INBOX to fable-cursor / Astra.
- Iteration 72 — fable-5's corrected fog pair (their after frames had `--character` on): A −0.0029, B −0.0030,
  C −0.0081, D −0.0143, E −0.0024, F −0.0040 — mine to within 0.001; the reading shared (the slice costs on all
  six, D the largest single-step loss of the rounds); their expected take-0134 row's "roof unknown" is the 20:45
  pair. Head: Astra's admission + far packs imported (tick 236), take-0134 A in. Nothing ranked; no code open to
  review; no INBOX note (nothing to add).
- Iteration 71 — owner-fable's roof (PR #31) isolated at the six views (`bacdd46b^` vs `bacdd46b`): A +0.0003,
  B +0.0015, C 0, D +0.0020, E +0.0006, F 0; +1 draw, ≤ 10 K tris — nothing to hold; the +0.013 gap between the
  two fog reads at A is not the roof. take-0133 sealed 41/50 (dressing fade + memory branches neutral).
  `.agents/reviews/fable-2-review-clearing-roof-sixviews-bacdd46b.md`.
- Iteration 70 — fable-5's fog read (17:53) reconciled with mine: same SHAs; B and D agree, A/C/E/F differ by
  0.004–0.013 and the split is in the before frames (my A before 0.2263 matches every head A of the day; their
  +0.0102 needs an A before near 0.216). Their conclusion stands (clears by darkening; far bands below the frames).
  Roof (PR #31) six views still unisolated — offered the pair `bacdd46b^` vs `bacdd46b`.
- Iteration 69 — Astra's height-fog clarity slice (`ae880cf2`, haze 7× thinner) isolated at the six views before
  take-0134 seals it with three other changes: D −0.0142, C −0.0070, F −0.0044, A −0.0029, B −0.0025, E −0.0016;
  every frame 0.025 darker and further from the hazy reference in luminance, saturation toward it — the owner's
  direction against the reference-anchored metric; a look change to name in the ledger. `skyFraction` → 0 in
  every view (the classifier keys on haze). `.agents/reviews/fable-2-review-fog-slice-ae880cf2.md`. No lane claimed.
- Iteration 68 — the owner's clarity direction landed (fog / distant crowns: Astra; white-bark crowns: fable-4;
  nobody else starts a fog or crown pass — rocks has no part). Non-author check of owner-fable's clearing roof
  (`ffff47b5`) from the clearing floor: four ground poses byte-identical (the cards never cast — the stones keep
  their light), `x-clearing-up` blue sky 25.2 → 2.4 %, `x-stand-up` 38.3 → 34.5 %; nothing to hold.
  `.agents/reviews/fable-2-review-owner-fable-clearing-roof-ffff47b5.md`.
- Iteration 67 — take-0132 sealed 41/50 (A +0.0056 with the timber tint, F −0.0062); fable-5 attributed the
  D boulder's shade to the trees system entirely (`nocast=trees` gives 93 % of the shadow-off gain) — a sun
  corridor in `trees/index.ts` at the boulder's spot; a sun-cone probe from the crown against mesh bounds
  found nothing usable (the trees are merged per sector, 30 m spheres) — the trees lane's own sun-probe is
  the tool, the point (−2.0, 0, −7.6) and the 2 m pose are posted. No code; rocks' list empty; no reviewable
  branches open (Astra's are character imports or evidence).
- Iteration 66 — V16's two numbers (fable-5 14:03) built across flagstones / joints / index (flush rim + a flush
  channel in the gap field + the fill to dry dirt at the slab's value + seam soil × 2) and read with their script:
  E 86.1 → 90.7 px/kpx, hard groove 27 → 21.5 %, regions 14 → 15 (acceptance ≤ 60 / ≤ 15 % / ≤ 6); C +0.0016,
  D −0.0016. **Not met**: the E box is the lawn slabs (flush skipped by the spall rule; the frame's lawn joints
  close under grass — vegetation's turf), and the shoulder roll still reads as an edge. Implementation kept on
  `agent/fable-2-v16-fill` (`2a3932df`), reverted on top. Four passes; done with V16. README §66.
- Iteration 65 — fable-5's shadow-map-off switch closed the D boulder (a sun corridor onto it: the canopy's
  lane; the planes stay unmerged); a 2 m pose that frames the moved boulder proposed for the survey manifest;
  non-author check of fable-cursor's grass blades to 26 m (`f9c58007`): A 0 / E +0.0005 / C −0.0005, but
  **A +150 K triangles (8.68 → 8.83 M, 170 K under W38)** and +7–9 draws — flagged
  (`.agents/reviews/fable-2-review-grass-26m-f9c58007.md`).
- Iteration 64 — V16's flush stretches (fable-5's re-scope) built on the rim-drop channel and read with their
  `seam-lines.py`: E line 86.1 → 86.1 px/kpx, hard-groove share 27 → 27 %, regions 14 → 14 (frame 55 / 12 % / 5)
  though 4–15 K px changed per view — the line is the fill strip's tone along the joint, not the recess. **FAIL,
  reverted** (`agent/fable-2-v16-flush`); the lever left is the fill's tone varying along the seam with the flush
  rim (`joints.ts`, the module's). This lane stops at V16 unless the module comes over. README §64.
- Iteration 63 — round-52 #12's "one plane" at D: the §19 planes rebased onto the head where W23 moved the
  boulder (`agent/fable-2-form-2` @ `f5ab2f28`): D box macro σ 0.023 → 0.026 (frame 0.097), p10/p90 0.26/0.39
  (frame 0.18/0.50) even with a hard bake, D −0.0013 — **the light on the spot, not the geometry; FAIL to land**;
  the planes read as form at 2.5 m from the south. README §63.
- Iteration 62 — tick 226's "the frame time is all SwiftShader": the raster-time map by system from the page
  (`render()` + a 1-px `readPixels` sync per configuration): A 14.3 s / C 10.5 s a frame — trees 40 %, vegetation
  15 %, terrain a constant 1.6 s (fill-rate on the ground shader), the shadow pass 17 %, rocks 1.4 %; 300 programs
  live. `.agents/reviews/fable-2-raster-time-map-722fecde.md`, posted in the stall thread. No lane claimed.
- Iteration 61 — the rock meshes' CPU arrays released on GPU upload (`onUpload`, fable-4's tick-225 pattern;
  nothing reads them after the build): at E 115 attributes released, live rock arrays 66.2 → 33.2 MB with §60;
  pixels unchanged by construction (`agent/fable-2-rock-upload` @ `a1ed0427`). Rocks' part of the memory ask
  is done: 40 MB on the GPU, ≈ 0 resident once seen. README §61.
- Iteration 60 — every rock mesh's vertex storage compacted once after the build-time reads
  (`compactRockGeometry`: uv off, Int8 normals, Uint8 for any 0–1 attribute, floats kept beyond the range):
  **rocks 85.5 → 40.3 MB, JS heap −45 MB**; D 0.2785 = , E +0.0001, 0.24 / 0.04 % px > 8, none > 40; the 2 m
  and 6.8 m poses 0.02 / 0.13 % (`agent/fable-2-rock-bytes` @ `59c68f32`). Rocks' bytes are done; the rest is
  vertex count. README §60.
- Iteration 59 — fable-cursor's 07:15 memory root cause (OOM kills, the tab at 3.6 GB): the per-system
  geometry-bytes map from the page (trees 440 of 773 MB, rocks 86, textures ≈ 618 MB est.; heap 1 537 MB) —
  `.agents/reviews/fable-2-memory-map-4f22e7ec.md` — and rocks' own cut: the §49 pebble tiles held 30.5 MB
  (52 B/vertex float32 where the InstancedMeshes held 0.3); the far material reads position/normal/colour/aMoss
  only, so the tiles drop uv/aWet and store normal Int8, colour and aMoss Uint8 → **30.5 → 11.2 MB, rocks 85.5
  → 66.2, heap −19 MB**; E 0.23 % px moved by 2.3 levels, none > 40 (`agent/fable-2-pebble-bytes` @ `20b72fdf`).
- Iteration 58 — fable-5's outer-edge knob on the dressing fade (13 → 20 m) measured along V20's bearing at
  6.8 / 11 / 16 / 20 m: 9 / 384 / 29 / 2 changed px, the pair's fine σ +2 % at 11 m — **FAIL as a visible
  change, reverted**: past 10 m the pair is behind the bank's ferns, and the skin's 5–12 cm terms are
  sub-pixel there; the range past 10 m wants 20–40 cm form (geometry). README §58.
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
- `agent/fable-2-cliff-scale` (PROPOSED): `RockLedgeDef.scale` for the ruins' cliffs (opt-in; terrace byte-identical),
  `?rockLedgePreview=cliff` 9 m sample. README §103.
- `36d722fa` (`agent/fable-2-w02-treads`, PROPOSED on fable-cursor's 11:05 ask): the hero flight 20 × 0.27 × 0.54
  again (W02 16–20; 18 × 0.30 breaks the 0.28 m step guard), stone kept; stairs/climb clean; A −0.0069 / F +0.0063
  vs the 26-step head. README §102.
- `7649f308` (`agent/fable-2-riser-shade`, PROPOSED): lane 6 — the hero flight's risers' shade / warmth (fable-5
  §26): s2-owner sat 0.333 → 0.310, dark 29.9 → 27.8 %; A −0.0003, F +0.0002; the remaining dark is the upper
  flight's shade, not stone. README §100.
- `7bd4df13` review: the head `b306d6a9` at the six views and A by system (shadow a third; vegetation +0.5 M;
  characters 63 draws). `.agents/reviews/fable-2-triangle-budget-b306d6a9.md`.
- `02586843` (`agent/fable-2-ravine-rock`, PROPOSED): lane 2 for the south area — `rocks/ravine.ts`, bedded
  shelves half-sunk into the gorge's walls + floor boulders, one mesh gated to 26 m of the gorge; C pixel-identical.
  README §98; ravine.test (5).
- `f90821e8` (`agent/fable-2-stone-value`, on `agent/stairs-look`; PROPOSED with squad4's candidate): lane 6 —
  the hero stone flight's value up into the owner's 23:00 reference band (fable-5 §24): s2-owner box dark
  59 → 33 %, mean l 0.25 → 0.32; A −0.0043 vs stairs-look, F +0.0014. README §96.
- `78d18fe1` (`agent/fable-2-log-joint`): lane 6 — the log flight's angular dark joins closed by geometry
  (fable-cursor 18:10 / Astra's `s2-join-close`): split treads laid as one earth tread (outlines joined,
  draws kept), the riser 3 cm behind the nose (was 7.5–10.5), no rolled lip and no `LOG_SHADED_LIP` on
  log flights; `stairs.test.mjs` (4). Six views A −0.0008, F −0.0007, rest 0. README §92.
- `3cc8ca96` (merged 17:20 as a look change): lane 6 — the band under each timber as lit earth; the
  owner's pose flight box 63 → 42 % dark. README §89 (§90's cooler tint measured, not needed).
- `23464406` / `3cc8ca96` (`agent/fable-2-earth-risers`, PROPOSED, not merged): lane 6 — the band under
  each timber as lit earth (cooler / warm cut); the owner's pose flight box 63 → 42–44 % dark, but
  A −0.012 / F −0.008 six-view (structural, not tonal) — a look call for fable-cursor. README §89–90.
- `15217f64` merge of `agent/fable-2-paving-noshadow`: flagstones stop casting shadows — camera A
  9.15 → 8.97 M tris (back under W38's 9.0 M), C/E −180/−190 K; six views within tolerance. §88.
- `agent/fable-2-ledge-logs` (merged 12:55): the raised stair to the north ledge log-risered like the
  hero flight (`LOG_FLIGHTS` + 'ledge'); A/D byte-identical; walk route climb trace identical. §85–86.
- `agent/fable-2-earth-treads` (merged): lane 6 — earth-textured treads on log flights (`aEarth`
  vertex weight, `rocky_trail` CC0 set, `uEarthTint`); A −0.0002, C −0.0012, F +0.0004. §83–84.
- `agent/fable-2-herofade` (merged): hero / stair-foot near skin 7–13 m (`HERO_NEAR_FADE_M`); six
  views within ±0.0004. §82. Negative result §80 (crack warp on D: lattice was the strata, reverted).
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
- Camera A: 8.67 M triangles on `59c0f961` (476 draws); fable-4's sector groups take another
  −148 K on `a5dbf45f`. Rocks' share ≈ 0.75 M (§51's map).
- Survey-2 #25 (bank boulders smooth dark domes at 8–15 m) and #34 (plaza joint pebbles as
  smooth ellipsoids) are far-material geometry inside the six views — a named look change (C / D,
  E) before anyone builds them; not attempted.
- The D boulder's shade at frame D is the canopy's (fable-5's `nocast=trees` switch, §65–§67): a sun
  corridor onto (−2.0, 0, −7.6) is the trees lane's; the 2 m pose for it is in §65.
- V16 (the joints as lines): the E box is the lawn slabs, whose joints close under grass — vegetation
  / hardscape-32's; the flush-stretch implementation waits on `agent/fable-2-v16-fill` (`2a3932df`).
- `logNosings.ts` is the owner-side agent's since `d4f1feec`: the timbers dark and individual; the
  flight's remaining weight at A (51 % dark vs the frame's 16 %) is the treads' light and albedo per
  fable-5, not the logs. fable-cursor (05:00): the pattern fix keeps its tint — the §78 `LOG_TINT` offer
  is closed; the lever, if W02 wants value back, is the treads (hardscape `stairs.ts` tint / dryK + the
  canopy's light on the flight), not this module.

## Recommended next work
- Each new head: re-verify rocks at the six views and the seven poses of §79 (`/tmp/f2/rv79-poses.json`
  pattern: `sn-boulder-shotd`, `sn-boulder-stairfoot`, `x-ledge-wall`, `x-southbank-toe`,
  `x-clearing-n`, `w23-stairs-f`, `x-stairs-3rd-tread`), census and pebble LOD from `--audit`.
- Non-author checks of other lanes' branches at the six views (before / after on the commit alone).
- If fable-cursor names a look change for rocks: #25's bank boulders' far form (planes, an undercut,
  a bright top — the §63 method with the light first), #34's pebble far skin at E.

## Last updated
2026-09-24T13:00:00Z
2026-09-24T12:10:00Z
2026-09-24T10:20:00Z
2026-09-24T07:35:00Z
2026-09-24T05:45:00Z
2026-09-23T22:30:00Z
2026-09-23T17:45:00Z
2026-09-23T11:35:00Z
2026-09-23T09:00:00Z

### Iteration 105 (15:57) — the ruins' cliff: bedded relief tried on fable-cursor's surface — negative result
- Branch `agent/fable-2-ruins-cliffbeds` (3fd08256) off exp-ruins 2c47fc66: `rocks/cliffBeds.ts`
  (bed stack profile, pure) + hooks in `terrain/ruins.ts` / `ruins/rock.ts` (their files — proposal
  only, not for merge). Typecheck + ruins.test.mjs green.
- At the fall pose the face barely changes (σ 0.031 → 0.026); the face is in its own shade under the
  WNW sun, in the fall's air, at ≈ 50/255 — relief cannot shade and ±20 % albedo is ±10 levels.
  Sheet: `art/environment/rocks-lane/rocks105-ruins-cliffbeds-negative.jpg`. Reported to fable-cursor
  with what would read (hard-edged shelves + moss/lichen, or a paler set); offer closed.

### Iteration 106 (18:15) — the pebble tiles' far gate (#57, merged eb8b727e) and the look-back isolate table
- fable-5: the head is over both caps at the east plateau's look-backs (833 / 9.94 M at the green).
  Per-system isolate on 3c6cc553 at that pose: trees 250 / structures 175 / vegetation 124 /
  character 107 / terrain 50 / rocks 45 / props 26 / hardscape 16 draws.
- `PEBBLE_FAR_M = 34` (rocks/index.ts, 551878ae): a pebble tile past 34 m (nearest point) draws
  neither look; rocks 45 → 27 / 26 at the two look-backs for 0 changed pixels; six views SSIM
  1.0000, A 576 → 572 draws. Sheet `art/environment/rocks-lane/rocks106-pebble-far.jpg`.
- Tooling: `/tmp/f2/pose.mjs` gained `"viewpoint"` (setViewpoint) and `"isolate": true` (per-system
  draws / triangles via `__ZR__.isolate`) — the six views in ~26 min a run at quality high.

### Iteration 107 (20:25) — the flight's tops shade per vertex (#61) and the lane re-verified on 31146062
- Re-verify: seven poses on the new head vs the 10:00 head — SSIM 0.965–0.982, all from the merges
  around them (20 treads, crown tone, south props); `rocks107-head-reverify.jpg`.
- Found at `x-stairs-3rd-tread`: the tread tops as a patchwork of per-quad tones (CPU probe: 8,224 /
  14,717 coincident top vertices differ in colour, none in normal). `geometry.ts buildSlab
  vertexTone` (+ `MeshBuilder.tri` with three colours), on for the flights in `stairs.ts`. Six views
  vs head A/B/C/E/F 1.0000, D 0.9999; draws unchanged; tests 13 green. PR #61, sheet
  `hs107-tread-tone.jpg`.
- Method note: A must be the first pose of a run to compare across dists — a later pose sits at a
  later sim time (wind, lanterns, Navi) and reads 0.979 against itself.

### Iteration 108 (20:40) — exp-ruins re-read at 4469755c; the desert / red-rock question
- Head unchanged but a squad log; #61 unmerged; no note to me. Re-rendered the ruins' cliff and
  hero poses on 4469755c: the cliff l 0.204 → 0.235, σ 0.029 (tone, not relief — right for a face in
  shade); closed the cliff item from my side. Asked whether to prepare the desert's sandstone canyon
  walls (scaled ledge builder + sandstone palette + preview flag).

### Iteration 109 (21:20) — the sandstone palette (groundwork for the desert / red-rock town)
- `ledge.ts` `palette: 'sandstone'` (bed ramp by bed index, varnish streaks, sand drift, bleached
  brow; no moss / damp / roots) + `?rockLedgePreview=canyon` (16 m scale-4 wall at x 61) on
  `agent/fable-2-cliff-scale` (ba41514c). Ledges outside the north locality left to the frustum
  (the gate hid the preview). Forest palette byte-identical by probe. Tests 33 green.
- First look in forest shade only (`rocks109-sandstone-first-look.jpg`) — colour tuning waits for
  the desert's sky. Two preview poses landed inside canopies; the village has no open sunlit spot
  for a 16 m wall.

### Iteration 110 (22:20) — the tread facets: fable-5's challenge holds; the elimination so far
- Not the vertex colour (#61), not the shadow map (`?shadow=0`), not the normal map (build without
  it), not the vertex normals (rim / wall directions smoothed along the outline + top noise at
  1.6 c/m — 19,649 normals changed, render unchanged; reverted, not committed). Sheet
  `hs110-facets-elimination.jpg`. Left: the texture side (near / detail tiles, AO, roughness, the
  per-triangle mip level). Next: a `?stoneDebug=` switch in `material.ts` to isolate per render.
- PR #66 opened for this notes branch — 21 INBOX notes were not on the head (no PR existed).
- Method: a `map: null` diagnostic build does not compile (the fine-grain sample reads `map` outside
  its `#ifdef USE_MAP`), so the debug switch must keep the map bound and neutralise it in GLSL.

### Iteration 111 (23:55) — the facets found: the slab walls' grime, one dark triangle per quad → a gradient (in #61, merged 23:39)
- `?stoneDebug=` switch in `material.ts` (flat / noao / norough / nofine / nonear / uvgrid / vcolor /
  texonly / moss): `flat` removed the facets (albedo), `nofine` / `nonear` / `noao` did not, `texonly`
  continuous, `vcolor` the patchwork → the vertex colour of the WALLS (the risers fill the tread
  poses). `buildSlab` side walls: tri 1 shaded × sideGrime, tri 2 clean → now foot → shoulder
  gradient (`f6fa109e`). Six views vs head: A 0.9994 / B 1.0000 / C 0.9999 / D 0.9999 / E 1.0000 /
  F 0.9993. Sheet `hs111-riser-grime.jpg`.
- Method: at a pose looking up a flight, name the surface first — the "tread facets" were risers.
- North grove merged (b9993008): my north poses re-rendered, no regression (`rocks111-north-grove-poses.jpg`).

### Iteration 112 (00:10) — riser-shade re-measured on the merged head and withdrawn
- s2-owner flight box: head 36.0 % dark / l 0.319 / sat 0.235; + riser-shade 34.8 / 0.323 / 0.225;
  the 09:38 head 35.0 / 0.319 / 0.230. A point of dark share is not a merge → withdrawn (branch kept).
  The wall-grime gradient did not move the flight's dark share (the average tone of a riser is the
  same 0.875); the dark is the upper run's shade. Sheet `hs112-riser-shade-withdrawn.jpg`.
- Queue for fable-cursor now one branch: `cliff-scale` (scale + sandstone palette + previews).

### Iteration 113 (00:50) — D's move across the 23:45 merges attributed (canopy / understory, not mine)
- D_log 31146062 → 2f6c8ae2, both first-pose renders: SSIM 0.9855, 2.78 % pixels; the diff is the
  trees over the path and the house's side; paving / pebbles / log stones unchanged.
  `rocks113-D-move-canopy.jpg`. Notes #69 merged (4d9f766e); a fresh PR for the branch follows.

### Iteration 114 (01:35) — cliff-scale gets its PR (#75)
- The branch had no PR since 13:00; the merge rounds work from PRs. Rebased on 0fc66816, green, the
  north terrace ledge byte-identical head vs branch (sha1 f19ab29c2867dac8). Lesson: every branch
  meant for a merge gets a PR the moment it is pushed.

### Iteration 115 (02:40) — all lane branches on the head; the field's rock offered
- #75 merged 02:06 (fable-5: pixel-identical at the six views). Nothing waiting. r_019 read: crags
  and mountains, no near boulders — offered the scaled ledge with a grey-blue palette for the crags
  once exp-south2's field has a landform. Checked the split-tread "slot" at x-stairs-3rd-tread: the
  joint gap (2–4 cm) and a 2 cm nose offset between halves — realistic, not a defect (topY / ts are
  per tread, both halves flush).

### Iteration 116 (04:50) — the 02:55 merge round re-verified at the seven poses (all 1.0000)
- VM reset at 03:35: /tmp gone (tools, baselines), node_modules gone; `npm ci`, tools rebuilt under
  `/cursor/stores/self/tools` (pose.mjs over the gauntlet's browser lib, ssim-dirs.mjs, the pose files).
- 5f8a6738 → 7468bb38 at rv79's seven poses: SSIM 1.0000 each; ≤ 235 px over 8. Sheet
  `rocks116-reverify-0255-round.jpg`.

### Iteration 117 (05:05) — the trailer's known issue "stair shading" is #61's fix; told opus-cinematic-b
- `agent/opus-cinematic-b-sept25` (a 36 s trailer for X, recorded from b9993008) lists the risers'
  harlequin facets as a known world issue; frame 660 confirms. The fix (f6fa109e) has been on the
  head since 23:39 — asked for a re-record of the four shots that see the flight from the current
  head. Sheet `hs117-cinematic-risers-before-61.jpg`.

### Iteration 118 (05:45) — the rocks row at the look-backs decomposed: half shadow pass
- Head cfeefd11 at the east green: rocks 27 / 0.477 M = hero far 46 K + dressing 48 K + clearing 48.6 K
  + backside 49.7 K + ledge 1.4 K ≈ 0.24 M, doubled by the shadow pass. Suggested the composer's
  small-caster distance rule at the plateau look-backs (≈ −0.2 M, no pixel) instead of a far tier
  (≈ −30 K). Trailer frames of the flagstone close-up and the wides checked: the stone reads well;
  only the risers (fixed) were wrong.

### Iteration 119 (06:45) — the grove flight reviewed at player height (fine)
- exp-north's `grove` flight (9 × 0.27 × 0.42, log-nosed) at three poses on 41939301: reads as the
  ledge flight; no change. Sheet `hs119-grove-flight-player-height.jpg`. Tool: `hud=0` now default in
  pose.mjs (the HUD's corners are a known part of captures — capture.mjs excludes them).

### Iteration 120 (08:00) — the ravine rock from the bridge deck reviewed (fine)
- Three deck poses on 3556b945: floor boulders seated, moss caps read, wall shelves subtle under the
  roots and mist; no change. Sheet `rocks120-gorge-from-deck.jpg`. Note: `groundEye` at the bridge
  lands on the gorge floor — use absolute y for deck poses.

### Iteration 121 (08:45) — the canopy-batch round re-verified at three lane poses (0 pixels)
- 24dc489f → cd9400b2: x-clearing-n / x-southbank-toe / w23-stairs-f SSIM 1.0000, 0 px over 8.

### Iteration 122 (11:15) — #115: the hardscape's shading arrays released after upload (≈ −46 MB)
- `onUpload → array = null` on every static hardscape mesh's non-position attributes (the rocks / trees
  pattern); position + index kept for ground.ts grids and raycasts; instanced sprouts and dynamic
  attributes excluded (the first cut nulled the sprouts' per-instance arrays → `setViewpoint` crash
  on the second view; fixed in 97d78408). performance.memory −43…−49 MB at the six views; six views
  0 pixels; tests green. Tool: `--heap` in pose.mjs (CDP GC + page.metrics + performance.memory).

### Iteration 123 (11:50) — #119 cpuArrays audit; the gated meshes' arrays and a warm-up suggestion
- #115 merged 11:19. Added `cpuArrays` to both audits: at A hardscape 29.7 MB (10.6 position), rocks
  39.9 MB (20.4 position) — the rest is meshes never drawn at a fixed camera (upload happens on first
  draw). Suggested a one-frame warm-up at load to fable-cursor (≈ 50 MB and the first-appearance hitch).

### Iteration 124 (12:50) — the warm-up correction; #126 the rocks' build time by phase
- `?warmup=1` (play's path): rocks cpuArrays 0.0 MB, performance.memory 1271 MB (vs 1415 headless) —
  my 11:50 warm-up suggestion was already implemented; corrected in the INBOX.
- `buildPhaseMs`: rocks 9.3 s = hero kits 4.9 / ravine 1.7 / clearing 0.8 / backside 0.7 / pebbles
  0.5 s. Offered to defer the three gated groups (3.2 s) if the world supports post-ready builds.
- Tool: `--perf` in pose.mjs (buildMs per system).

### Iteration 125 (14:35) — #132: rockgen welds on integer keys, the rocks' build 9.3 → 6.6 s
- CPU profile: `computeCreaseNormals` 91 % self time (string keys × 3–5 passes). `positionGroups`
  shared by displacement / swell / crease passes. Small rocks hash-identical; hero rocks differ by the
  welds across the axis planes (the old '-0.0000' vs '0.0000' seam) — 4 of 6,626 welds. Six views
  0 pixels. Tool: `rockgen-hash.mjs` in the store.
