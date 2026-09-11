---
agent: fable-cursor
runtime: Cursor Cloud Agent (Claude Fable 5.1, 1M context) + parallel sub-agents
github: Cursor Agent <cursoragent@cursor.com>
status: active
branch: cursor/kokiri-world-phase1-f65e
updated: 2026-09-09T16:12:00Z
---

# fable-cursor — work log

## Current task
Bootstrapping the whole Phase 1 foundation in one branch so the second agent can join safely:

1. Vite + Three.js r186 + TypeScript scaffold with frozen module contracts
   (`src/world/system.ts`, `layout.ts`, `terrain/heightfield.ts`, `wind/wind.ts`, `capture/api.ts`).
2. Collaboration protocol (`AGENTS.md`, `.agents/`, `PROJECT_STATE.md`, `INBOX.md`).
3. The Gauntlet: 50-item rubric (`gauntlet/rubric.json`, hash-locked), loop (`GAUNTLET.md`),
   anti-cheat + capture/compare/score/take tooling, CI workflows.
4. The Director's Monitor live site (`site/`) — hourly before/after takes on GitHub Pages.
5. First real content passes on every world system via parallel sub-agents (terrain+hardscape,
   trees, vegetation, structures, atmosphere+lighting), then integration + reference-comparison
   loop iterations.

Rubric targets this session: W01–W42 first passes; hard focus on W02 (stairs), W03 (flagstones),
W08/W09 (trees), W15 (grass), W25/W26 (house + lanterns), W30–W32 (light + haze), W37 (shot match).

## Files / systems being touched
Everything under `src/`, `gauntlet/`, `site/`, `reference/`, `.github/`, root docs — this is the
bootstrap. Once this branch is up, ownership follows the map in `AGENTS.md`. Sub-agents each own
one `src/world/<system>/` directory and do not touch the others.

## Completed work
- Scaffold renders all 6 saved viewpoints headlessly (SwiftShader) in ~20 s; capture API + audit
  rollup working (`gauntlet/scripts/capture.mjs`).
- Reference clip analysed frame by frame; layout authored to the four hero shots
  (`src/world/layout.ts`, `reference/manifest.json`, `reference/frames/`).
- 50-item rubric written and locked; `rubric-lock.mjs --check` passes.
- (commits listed in PR once pushed)

## Important decisions
- **Units/axes:** metres, +Y up, +X east, −Z north. Plaza = origin. Camera eye ≈ 1.75–1.9 m.
- **Sun:** azimuth −128°, elevation 34° (light from WNW-high, i.e. behind-left of shot A) — measured
  from shadow direction on the plaza in frames 1/14/24. Match before "improving".
- **Fog:** cool blue-grey `#c5d1cf`, near 28 / far 190, plus a separate ground-mist layer. Fog is
  NOT allowed to hide unfinished terrain (rubric W32 + depth-histogram check).
- **Determinism:** `createRng` everywhere; capture mode fixes sim time at 12.5 s before each shot.
- **Stairs:** 18 steps, rise 0.30, tread 0.42, width 2.7 (counted on frame 1 / crop). Direction
  (1, −0.35) from base (7.5, 0, −1.5).
- **Textures:** CC0 only, `public/textures/<set>/{color,normal,roughness,ao,height}.jpg`, 1K–2K,
  credited in `public/textures/CREDITS.md`.
- **Takes** live on the orphan `monitor` branch (append-only), never in feature branches, so two
  agents cannot conflict on take data.

## Hourly gauntlet log
### 10:30 UTC — tick 1 (pre-tooling)
Integrated WIP capture (quality=low, B/D, commit 5bf083e) — sub-agent passes are landing but
not yet committed. Biggest gaps vs reference right now:
1. **Trees**: giants are still untextured pale cylinders/blobs in B/D backgrounds; canopy roof
   absent → sky too bright/open behind the house (ref B has dense dark canopy, dappled light).
2. **Lantern bough in B**: the lantern-tree limb crosses the top of frame B as a thick plain
   green cylinder ~4 m over the camera — needs bark, taper and foliage, or the B camera nudged
   so it frames like the reference (branches high, not a beam across the top).
3. **Colour/atmosphere**: whole frame reads cool-grey and washed; reference is warm gold-green
   light on a cool blue haze with much deeper shadows. Mist volume currently flattens the mid
   ground; terrain material still grey vertex colour in places.
Also: codex's terrain review findings (cache order-dependence, sampler ≠ mesh) go to the terrain
sub-agent before its pass lands; props integrated (`src/world/props`, codex).

### 11:10 UTC — tick 2 (tooling still landing; capture only)
Integrated WIP capture with codex props iteration 2 (quality=low, B/D; monitor
`data/reviews/props-d3c1086/`). Purple flowers, embankment grass, mist, shafts, thatch house
with vines and pod lanterns, sign, doorway prop cluster all present. Biggest gaps vs reference:
1. **Canopy/trees**: backgrounds are pale untextured trunks + bright grey wash — no dark canopy
   roof, so B/D lack the reference's enclosed, dappled feel (W09/W10/W11 open).
2. **Grade/contrast**: image is low-contrast beige-grey; reference is olive/khaki with deep cool
   shadows and warm highlights. Apply the ANALYSIS palette + height-fog density at integration
   (W34).
3. **Hardscape tone**: stairs and flagstones are uniform light grey slabs; reference stone is
   warmer, darker in the joints, with moss and wear gradients (W02/W03/W20).
Also: lantern bough still a thick plain beam across the top of B (trees pass pending).

## Queued for the atmosphere pass (from codex review of checkpoint 4820e52, verified)
- GLSL `smoothstep(edge0 > edge1)` is undefined: `heightfog.ts` north weight
  `smoothstep(KF_NORTH_START=-4, KF_NORTH_FULL=-24, z)` (also `postfx/shaders.ts:153`), and
  `smoothstep(0.5, 0.05, r)` in `motes.ts:69`, `fairy.ts:88` → use `1.0 - smoothstep(lo, hi, x)`.
- `kfHeightFogAmount`: `startDensity * t` multiplies exp(−(camY−base)·k) (→ 0 for a high camera)
  by (1 − exp(−dist·ry·k))/(ry·k) (→ ∞ looking down) → 0·∞ = NaN at e.g. camY = 220 (correct
  optical depth ≈ 0.0945). Rewrite as a difference of endpoint densities with the horizontal-ray
  limit handled separately.

### 13:55 UTC — ticks 3–4: first real takes published
- `take.mjs` pipeline works end to end (build → capture 6 views + det/motion + depth → compare →
  score → anti-cheat → hash-chained ledger → publish). take-0001 = placeholder baseline backfill
  (struck by B4, correctly); **take-0002 = first integrated world: 19/50, phase 1 19/42, anti-cheat
  green (20 checks)**. Live: https://rawcdn.githack.com/Leonxlnx/zeldaremake/monitor/index.html
- Monitor branch layout changed: it IS the deployable site (site static at root, data under
  `data/`); `take.mjs --publish` syncs `site/` static files each publish (`lib/monitor.mjs`).
- Config: palette moved halfway to measured olive/khaki; sun elevation 38° → W34 (palette) passes
  (max hue Δ 7.35°, was 30–70°).
- Take cost: settle 8 → 490 s locally; settle 30 was 1774 s. Use `--settle 8` for hourly takes.
- Biggest gaps now (A/B/D vs reference): lantern bough is a thick plain beam across the top of
  A/B (needs the lower/thinner ANALYSIS placement + bark + foliage); SSIM 0.12–0.18 vs 0.42 —
  composition still differs (house in A centre, log arch hidden in D, B camera too high); far
  hills untextured grey; stone too uniformly light.
- Anti-cheat caught two real things today: fireflies as `Points` were not counted by the scene
  audit (fixed in api.ts), and MONITOR_REMOTE left in the shared shell env pointed a publish at a
  local test remote (unset; publish re-run).

### 14:30 UTC — tick 5: take-0003, all first-round passes landed, round two running
- take-0003 (19/50, anti-cheat green, 21 checks) with the final passes + the re-laid bough.
  B's SSIM dipped (0.12 → 0.09): the bough now crosses B's upper band and the B camera was too far
  from the house → **B camera moved** to (0, 1.6, 2) → (5, 1.8, −12): house 0.68–0.88 with the door
  at (0.78, 0.48) ≈ reference (0.80, 0.50).
- Shot A's centre shows Saria's glowing door where the reference has a hedge → asked codex
  (vegetation owner) for a tall shrub hedge along the terrace lip (4,0,−6)→(9.5,1.2,−10.5).
- Round two in flight: terrain lattice sampler (codex's proof script), atmosphere GLSL/NaN fixes +
  reference haze, trees canopy cards/limbs over the roof/far layers/canopy gaps for shafts.
- CI: gauntlet.yml runs on every push; earlier "capture failed" PR comment was a cancelled run
  (fixed: no comment on cancel).
- Biggest gaps: W37 shot similarity (composition A centre, D log arch visibility), W32 far layers,
  W10 F sky fraction under haze, grade contrast, canopy cards near camera.

### 16:10 UTC — tick 7: round two measured (take-0005)
- take-0005: A SSIM 0.179 (best), D farLayerCount 3, hue Δ ≤ 7° everywhere, anti-cheat green (21).
  Score stays 19/50 — the remaining 24 are visual items awaiting codex's cross-review (D7).
- Biggest gaps now: (1) A centre: lit doorway where the reference has a hedge (asked codex;
  fallback: I take it at 17:30); (2) D/A: head-sized heart-leaf vine leaves from the lantern
  branch near the camera (structures follow-up running), roof cap rounder than the reference's
  mushroom cap; (3) canopy roof reads pale grey under the haze from F — the reference crowns
  stay dark and crisp (atmosphere: thin haze along upward rays / darker crown albedo).
- CI: intermediate queued runs are cancelled by the concurrency group (expected); the latest
  commit's run proceeds. No completed CI score yet.

### 17:25 UTC — tick 8: shot-A composition, first completed CI score, take-0006 running
- First CI run that completed end to end (`2f0df25`): 19/50, metrics identical to the local
  take (A 0.179 / D 0.189) — the capture pipeline is deterministic across machines.
- W01 flipped: the lantern limb's `from` waypoint now marks where the visible, pod-bearing span
  begins (`giant.ts` grows the trunk→from reach with the same wiggle); projection 2/3 inside.
- Took the shot-A hedge myself at 17:00 (codex idle since ~12:30 UTC, deadline was 17:30):
  `src/world/vegetation/plants.ts` gains a `hedge` LodInstancedSet on the bank at
  x ≈ 8–9.5, z ≈ −6…−4 — east of camera B's sight line to the door, on camera A's. A's centre
  luminance 0.373 vs reference 0.357; the door stays clear in B with a shrub at its right, as in
  the reference. Audit adds `vegetation.hedge` (8); `bushes` contract untouched.
- Integrated the structures round-three pass (`d14faec`): 7.5 cm vine leaves, pods on short
  cords, mushroom-cap roof, carved sign.
- Remaining A gaps against the reference: our stairs sit further left and wider (x 0.5–0.72 vs
  0.62–0.8), the upper third is darker than the reference's bright haze (0.39 vs 0.46), the left
  bank is brighter (0.52 vs 0.44). D: log arch still veiled.

### 18:35 UTC — tick 9: shot A re-laid to the reference geometry (take-0007 published)
- Measured reference frame 1: stair run almost radial from a **level** camera (bottom centre
  x 0.71, top 0.74, base ≈ 17 m). Ours ran due east 12 m away, 39° off axis, camera pitched
  up 4.4°. Re-laid (`01a91a9`, `2ded0e8`): stairs base (9,−2) bearing 55°, 3.2 m wide; camera A
  level at bearing 23.5°; flagstone spur, both fence runs, stair-foot boulder (now at the
  reference's 0.9, 0.7) and the upper house (moved east of the lip, out of frame) follow.
  Projected stairs (0.61–0.77, 0.66)→(0.70–0.82, 0.28) vs reference (0.62–0.80, 0.62)→(0.70–0.78,
  0.27). W04's locked probe at (18,−4) reads 5.05 m — the base cannot move further east without
  a rubric change, which I did not make.
- Bough rides 0.7 m higher with two pods on 1.2/1.0 m cords: measured glow centroids
  (0.095, 0.441) and (0.248, 0.453) vs reference (0.08, 0.45) and (0.26, 0.45).
- Camera D moved 2 m north past the bough tip (pods were at its top edge); the house stair now
  sits at D's right edge like the reference. D SSIM 0.19 → 0.22 (with atmosphere WIP).
- Hedge row re-centred 1.1–1.45 m east of camera B's sight line: doorway hidden from A, clear
  from B.
- take-0007 published (monitor `b406d10`): 19/50; A 0.166, D 0.193. take-0006 stayed local
  (forgot `--publish`).
- Running: atmosphere sub-agent (contrast/grade, F canopy haze 0.58→0.33 target, far haze
  luminance) and hardscape sub-agent (warm stone albedo R−B 30→45, stairs verification).
- Codex: still idle since ~12:30 UTC; 26 auto-passing items wait on cross-review (D7).

### 19:40 UTC — tick 10: take-0008 published (monitor `c2a701e`), round three landed
- Landed: hardscape round three (`c56807d`: flat slab tops — the 6 cm path undulation had
  buried a quarter of every slab under joint fill —, warm stone R−B 34→43, banks hug the
  re-laid stairway), atmosphere round three (`9b4db0f`: altitude-aware haze, F crowns dark
  against gaps, chroma-preserving grade), signpost at x 0.58 in B.
- take-0008: 19/50; D SSIM 0.221, B 0.165, E 0.184 (all best so far); hue Δ ≤ 5.9° everywhere.
- Measured (lighting sub-agent, percentiles): the tone curve and sun/shade ratio already match
  the reference's stone; the region gaps are **what is lit** and **albedo**.
- Three biggest remaining gaps → (1) the whole A plaza sits in the lantern tree's crown shadow
  under the pinned sun; the reference plaza is dappled sunlit (p50 0.55, p90 0.66) — trees
  pass running: sun corridors over the plaza, thinner low crown in A's upper-left (darkest
  quartile 0.27 vs 0.38), giant bark #a8a89a → ~#6c604a; (2) vegetation albedo: lit grass 0.50
  vs 0.34–0.37, shaded 0.40 vs 0.235 — vegetation-tone pass running (config palette +
  materials only; codex offline 7 h, noted in INBOX); (3) 26 auto-passing items still wait on
  codex's cross-review; W37 (SSIM ≥ 0.42) stays the hard metric — best view D 0.22.

### 21:50 UTC — tick 11: takes 0009/0010 published, round four landed, regressions fixed
- Landed: trees round three (`99b6c2b`: porous sun corridors put dappled sun on the plaza —
  A plaza p90 0.62→0.77 vs ref 0.66; thinner bough in A's upper-left; giant bark #9b7e62),
  vegetation albedo (`8ade808`: grass/moss/fern ≈ 0.6×, lit meadow 0.374 vs ref 0.37).
- take-0009 (monitor `009b818`): A SSIM 0.189, hue Δ 0.02° in A. take-0010 (`503772b`): A 0.186,
  D 0.214, B 0.171. CI green on `2063ed7` with the same numbers.
- Regressions from those passes caught by the auto checks and fixed (`63dc27e`): W11 leaf count
  195 k → 209 k, W14 third bough pod restored out of frame, W18 D purple 0.0024 → 0.0061.
- Verification capture with the lighting rebalance WIP: A 0.196, D 0.240 (best so far).
- Three biggest remaining gaps → (1) exposure after the sunlit plaza: lit slabs 0.70–0.80 vs
  ref 0.60–0.70, shaded 0.50–0.60 vs 0.30–0.50, and F lifted by the exposed sun halo (top/mid
  0.56/0.58 vs 0.42/0.33) — atmosphere rebalance running; (2) W37 SSIM ≥ 0.42 remains far
  (best 0.24): the metric now responds mostly to texture/tone, composition is on; (3) 24 items
  wait on codex's cross-review (offline 9 h).

### 23:55 UTC — tick 12: takes 0011/0012 published, round four complete
- Landed: atmosphere rebalance (`eb390b7`: rays-off decomposition showed the god rays alone
  lifted F's mid-band darkest quartile 0.22→0.43; ray march follows the haze altitude profile,
  smear weighted by marched length; sun 3.0, hemi 0.95; A plaza p10/p50/p90 0.37/0.48/0.68 vs ref
  0.33/0.55/0.66, B path 0.488 vs 0.483, D arch 0.430 vs 0.427), trees round four (`bbc5413`:
  porous corridors over the D path, gap glare over the hollow, calmer lantern lobes → A upper-left
  darkest quartile 0.378 vs ref 0.385), camera D on the spine axis (`D SSIM 0.240→0.253`).
  Vegetation re-measured under the new key: within ±0.02 of the reference, no change.
- take-0011 (`6cc8279`) and take-0012 (`81d5d09`): A 0.207, B 0.182, C 0.180, D 0.240, E 0.207,
  F 0.157 — every view but F at its best; hue Δ ≤ 6.6°. Session start was A 0.179 / D 0.189.
- CI green on `eb390b7` and `3a27da2` (5 fail = W37 + the four Phase-2 character items).
- Three biggest remaining gaps → (1) W37 SSIM ≥ 0.42: composition and tone are now on the
  reference in A/B/D; what remains is texture statistics (our slabs/leaves are sharper and more
  contrasty than the reference's soft video frames — sharpness ratio 0.87–1.9) and the reference's
  characters/HUD occupying 10–15 % of every frame (Phase 2/3); (2) B path over-lit under the new
  key (p50 0.636 vs 0.492) while A's plaza is slightly under (0.483 vs 0.553) — dapple pattern,
  lever `PLAZA_SUN_POROSITY`; (3) 26 auto-passing items still wait on codex's cross-review
  (offline 11 h) — the score cannot move past 19 without it.

### 01:45 UTC — tick 13: takes 0013/0014 published; colour statistics pass
- take-0013 (`2d385f0`): A 0.210, D 0.253 (camera D on the spine axis). take-0014 (`f1dc871`):
  after the plaza corridor moved south (B path p50 0.63→0.54 vs ref 0.49) and the grade
  (saturation 1.12, green desat 0.08, exposure 0.94): saturation within 0.02 of the reference
  in A/B/D/E, luminance within 0.01–0.06, F 0.155→0.173, A 0.197 (dapple re-roll), D 0.244.
- Hue by luminance band (`gauntlet/tmp/hue-split.mjs`): our soil/joints were orange-brown
  (34–37°) where the reference's dark ground is olive (52–57°); palette soil → 0x69613c /
  0x423b26 and stone tint (1.58,1.49,1.02): hue Δ B 1.6→0.8, D 3.3→2.7, E 5.9→5.1 (`b340e8e`).
  A warm shadow tint only added saturation (reverted).
- Three biggest remaining gaps → (1) C look-back: lum 0.419 vs 0.353, sat 0.117 vs 0.170 — our
  airlight ignores view direction; the reference's haze is far darker looking away from the sun
  (atmosphere pass running: sun-angle-dependent airlight; F glare warmer); (2) E sunlit slabs
  R/G 1.13 vs 1.08 and shaded stone hue 46° vs 54° — set in the hardscape GLSL warmth targets
  (hardscape pass running, plus shorter joint sprouts); (3) 26 auto-passing items await codex
  (offline 13 h); W37 needs Phase 2/3 content in frame before SSIM can approach 0.42.

### 02:45 UTC — tick 14: take-0015 published, round five colour passes landed
- Landed: hardscape stone hue (`132288f`: the slab hue lived in the GLSL desat/lift targets, not
  the base colour — simulated albedo R/G 1.166→1.083; bright-band hue E 45.5 / A 47.9 / B 46.9 /
  D 49.1 vs ref 47.6 / 47.4 / 44.7 / 47.2; joint sprouts 6–9 cm khaki), directional airlight
  (`019d291`: Mie-like lobe shared by haze, rays, dome and mist; C lum 0.419→0.365 vs ref 0.353,
  sat 0.117→0.154, SSIM 0.178→0.186; F hue Δ 1.6→0.2°).
- take-0015: hue Δ B 0.04°, F 0.22°, D 2.0°, E 2.5°, A 3.6°, C 5.2° (mean 2.3°, was 3.0°); SSIM
  A 0.198, B 0.182, C 0.187, D 0.245, E 0.208, F 0.173. CI green through `132288f`.
- Three biggest remaining gaps → (1) A/C sit 3.5–4.5° yellow of the reference: their dark band
  (shaded grass/canopy) reads 58° vs the reference's 51° while stone is now on target — a
  shade-hue question for vegetation/canopy under the neutral fill; (2) D's shaded slabs carry
  more blue than the reference's warm shade (B/R 0.80 vs 0.71) — fill/IBL colour (lighting);
  (3) codex offline 14 h: 26 auto-passing items cannot convert without cross-review, and W37
  needs Phase-2/3 content in frame.

### 03:40 UTC — tick 15: take-0016 published (`74ee…`), fill/airlight colour tests
- take-0016 (first clean-tree take with stone hue + directional airlight): A 0.198 (hue Δ 3.5°),
  B 0.182 (0.06°), C 0.187 (4.5°), D 0.244 (2.0°), E 0.208 (2.5°), F 0.173 (0.22°).
- Tested a warm hemisphere fill (0xd0c6a6): traded A/C hue (−0.8°/−0.5°) for D/E (+0.5°/+0.8°)
  and over-saturated E — reverted. Warmed the airlight instead (`ffc3e1f`, linear B/R
  0.89→0.84): D 2.0→1.75°, E 2.5→2.35°, saturation on the reference in A/C/D.
- Side-by-side after the colour passes: A sat Δ 0.004 / lum Δ 0.018, D sat Δ 0.000 / lum Δ 0.008.
- Three biggest remaining gaps → (1) A/C dark band (shaded vegetation) 57° vs the reference's
  51°: the deep-grass albedo hue (87°) is the remaining lever, but it is codex's vegetation and
  the lit grass is on target — leave for the owner or a measured palette-only pass; (2) W37: the
  reference frames carry Link, a Kokiri kid and the HUD over 10–15 % of every frame — SSIM cannot
  approach 0.42 before Phase 2/3; (3) 26 auto-passing items await codex's cross-review (offline
  15 h).

### 05:45 UTC — tick 16: takes 0017/0018 published; walkable build live
- Walkable build now published under `play/` on the monitor branch with every take
  (`0546e19`, `syncPlayBuild`) and linked from the site header; verified booting from the CDN in
  headless Chrome (13 s, 0 errors). URL: raw.githack.com/Leonxlnx/zeldaremake/monitor/play/
  (one-time githack notice). GitHub Pages is not enabled on the repo (owner action for a clean URL).
- Shaded grass palette warmer (`34e752e`): A hue Δ 3.6→3.1°, C 4.5→4.1°.
- take-0017 (`b7ca…`): A 0.198 / B 0.182 / C 0.187 / D 0.245 / E 0.208 / F 0.173.
- Three biggest remaining gaps → (1) A/C frame hue 3–4° yellow of the reference — what is left is
  shaded canopy/bark in the dark band, not grass; (2) W37: Phase 2/3 content (Link, Kokiri kid,
  HUD) occupies 10–15 % of every reference frame; (3) 26 auto-passing items await codex's
  cross-review (offline 17 h) — score frozen at 19/50 until then.

### 07:35 UTC — tick 17: take-0019 published (monitor `4eb9bc9`); round five (compositions) started
- Eye-level comparison of every reference frame against take-0018 showed E and F never matched
  their frames: 24 s is the held B camera, 8 s is eye level dead up the stair axis with canopy in
  the top half. Both re-aimed, `diagnostic` dropped (all six views are matched compositions now):
  F foot/top (0.42, 0.59)/(0.42, 0.21) vs reference (0.42, 0.60)/(0.42, 0.22), fence posts at
  y ≈ 0.19, upper house top-left; C stair foot at (0.12, 0.67) with the new `plaza-south` giant at
  x ≈ 0.55 (`d058c08`).
- Frame 56 s re-laid: log arch 47 m out on a 5.6 m rise (screen span now 0.35–0.7 × 0.28–0.48 vs
  reference 0.40–0.75 × 0.27–0.45; it filled half the frame at 31 m before); spine level through
  the misty hollow then climbing; north steps off the path onto a 2.6 m boulder bank; spine bears
  east so B's path recedes at x ≈ 0.35; `north-west-near` giant cuts the left edge of B/D/A
  (`788f41a`). W04 probes 5.09 / 2.97 / 1.08 / 0.00. First rubric proposal filed (W04 house
  terrace → path level, per frames B/E).
- take-0019 (clean worktree build of `788f41a`, imported): A 0.210 / B 0.168 / C 0.180 / D 0.223 /
  E 0.182 / F 0.182; score 19/50. SSIM is flat while the compositions moved — the remaining
  differences are tonal (D lum Δ 0.073: the far arch and rise sit in pale haze; F sat Δ 0.075).
- Running (five sub-agents, disjoint ownership): trees (F canopy mass, C/D giant silhouettes),
  structures (dark ridged arch, leafy roof, upper house, fences), atmosphere (visible shafts, plaza
  dapple contrast, darker off-sun haze), vegetation (hedge ≤ 1.2 m so the door shows in B/E, D
  verges, lavender to the reference's two patches, C sight-line), hardscape/rocks (irregular greyer
  slabs, stratified mossy boulders).
- Three biggest remaining gaps → (1) tone: our haze is a flat pale wash where the reference has
  dark shaded masses cut by 3–5 bright shafts (A upper band, D far band lum Δ 0.07, F top band
  p10 0.19 vs 0.25 / p90 0.49 vs 0.57) and the plaza lacks the reference's lit/shadow split
  (A plaza p90 0.56 vs 0.61); (2) the house dome reads as a bright smooth cap in A's centre and
  B's right where the reference has a dark leafy crown, and the arch as a pale tube; (3) 26
  auto-passing items still await codex's cross-review (offline 19 h) — score frozen at 19/50.

### 08:50 UTC — tick 18: take-0020 published (monitor `af26147`); trees + structures landed
- `2c2fb58`: plaza-south as the hazed Y-fork centre tree of frame 46 s at 30 m (trunk box 0.359 vs
  ref 0.388), north-west-near slimmed to ≈ 0.12 of D's width, east-giant limbs give F's top-right
  canopy (0.38 → 0.31 vs ref 0.35) with the top-centre gap kept (0.497 vs 0.483); Saria's roof is a
  leaf-shrouded crown with a broken limb and vines (B roof box 0.388 vs ref 0.384, was 0.273; A
  centre box 0.400 vs 0.396, was 0.317); log arch ridged/fissured with a moss cap and a near-black
  hollow; weathered two-rail fences.
- take-0020 (clean build of `2c2fb58`): A 0.203 / B 0.172 / C 0.185 / D 0.202 / E 0.186 / F 0.180;
  score 19/50. D hue Δ 0.7 → 5.3° — to be re-read after the atmosphere/vegetation passes land.
- Three biggest remaining gaps → (1) the far arch is a pale ghost in our haze where the
  reference's is a dark silhouette: airlight away from the sun is too bright (atmosphere pass
  running); (2) the hedge still hides Saria's door threshold in B/E and D's right verge is a bush
  wall (vegetation pass running); (3) 26 items await codex's cross-review (offline 20 h).

### 09:45 UTC — tick 19: take-0021 published (monitor `c089870`); vegetation + terrain landed
- `ca263ff`: hedge crown ≤ 0.92 m (door line visible in B/E), D right verge ≤ 0.55 m, lavender →
  four clumps at the reference boxes (purple 2.0 % → 0.42 %), fern ring on the shot-D boulder on a
  new 0.5 m bank, bank bushes, B right-edge ferns + purple clump, C sight-line grass-only, second
  paved disc (5.0, 2.4) r 4 (frames 1 s / 8 s show flagstone in the right foreground).
- take-0021 (clean build of `ca263ff`): A 0.197 / B 0.171 / C 0.194 / D 0.201 / E 0.186 / F 0.173;
  hue Δ A 0.4°, F 0.1°, D 1.9° (was 5.3°); score 19/50.
- Regression caught in the strips: with the hedge shadow gone Saria's doorway reads as a bright
  pale interior (B door box mean 0.404 vs ref 0.299) — structures follow-up running (dark
  receding interior, warm lamp glint, lime/orange/lime pods as in frame 14 s).
- Three biggest remaining gaps → (1) tone/haze: the far arch is a pale ghost and the plaza lacks
  the reference's lit/shadow split — atmosphere pass still running; (2) the doorway regression
  above; (3) 26 items await codex's cross-review (offline 21 h).

### 10:55 UTC — tick 20: take-0022 published (monitor `afb7f08`) — INVALID (W35), round five integrated
- `7d41e40` hardscape + rocks (anisotropic Voronoi slabs, albedo matched to the sunlit stone,
  stratified boulders), `264a70c` doorway vestibule (B door box 0.252 vs ref 0.299, was 0.404),
  `2d40a2d` atmosphere (single-scattering rays through a canopy-gap mask, darker anti-sun haze:
  C mid band 0.329 vs 0.359, D far band 0.434 vs 0.437; dapple p10/p50/p90 0.280/0.448/0.601 vs
  0.235/0.455/0.612). `274f8b6` PROJECT_STATE for round five.
- take-0022 (clean build of `2d40a2d`): best SSIM on every view — A 0.225 / B 0.211 / C 0.253 /
  D 0.247 / E 0.214 / F 0.208 (session start A 0.179 / D 0.189) — but **W35 regressed**:
  sharpnessRatio fell ≈ 0.25 on every view with the atmosphere pass (A 1.05 → 0.795 < 0.8), so the
  take is recorded invalid (D2) and the score 18/50. The drop is uniform → post chain (exposure
  0.94 → 1.0 into the ACES shoulder / lift / ray smear), not scene detail; atmosphere follow-up
  must restore ≥ 0.85 before the next take.
- Round six running: trees (F shaft corridors, non-porous plaza cores, D path light), atmosphere
  (far-arch silhouette — body/haze ratio 1.0 vs ref 0.84 — crisper beams, W35), vegetation (C
  foreground ferns hiding the stair foot, F flank grass 0.21 → 0.30).
- Three biggest remaining gaps → (1) W35 sharpness regression (binding); (2) the far arch and
  distant trunks do not silhouette through our haze; (3) 26 items await codex's cross-review
  (offline 22 h).

### 12:35 UTC — tick 21: take-0023 published (monitor `0c89d2b`), valid again; round six integrated
- `4f568e2` vegetation (C frustum wedge: stair foot visible, F flank olive 0.264 vs 0.297),
  `e9eeff3` trees (six shaft columns exported, open plaza cores p90 0.641 vs 0.612, D path corridors,
  rng-stable leaf rejection), `ca18216` atmosphere (thin hollow air + far luminous wall: arch
  body/haze 0.94 → 0.88 vs 0.75, far trunks silhouette; W35 sharpness A 0.795 → 1.11; shafts.ts
  imports the trees' columns).
- take-0023 (clean build of `ca18216`): A 0.188 / B 0.171 / C 0.206 / D 0.212 / E 0.185 / F 0.184;
  pHash best on five views (D 26); hue Δ F 0.5°, C 1.3°, A 1.7°; score 19/50 (W35 back).
  SSIM gave back 0.03–0.04 for the silhouettes: the thinner air adds structure the soft video lacks
  — our sharpness ratio is now 1.0–1.5, i.e. sharper than the reference everywhere.
- Three biggest remaining gaps → (1) W37 needs the reference's Link / Kokiri kid / HUD (10–15 % of
  every frame) — Phase 2/3 content starts now in parallel, world work continues; (2) F still shows
  no beams and a pale top band where the reference has dark canopy + bright gap + four shafts; the
  arch carries ray-mask stripes; the render is sharper than the video (ratio 1.0–1.5, gate ≥ 0.8) —
  a reference-matched softening is legitimate; (3) 26 items await codex's cross-review (offline 24 h).

### 15:40 UTC — tick 22: take-0024 published (monitor `5bfa11d`), valid; atmosphere round three
- `2318958` F beams (per-column gain ×7.5, columns exempt from the far-air blend; F top band 0.33 →
  0.35 vs 0.39), reference-matched softening, smooth far arch (stripe spread 0.043 → 0.020);
  `9c747d0` softening dialled back after the world-only frame measured A sharpness 0.773 (< 0.8 —
  the agent's 0.905 had Link + HUD WIP in frame): now 0.838 world-only.
- take-0024 (clean build of `9c747d0`): A 0.195 / B 0.178 / C 0.219 / D 0.219 / E 0.193 / F 0.190
  — up on every view vs take-0023; sharpness 0.84–1.31; score 19/50. 24 entries in the ledger
  (D4 needs ≥ 24 valid — take-0022 was invalid, so 23 valid so far).
- Phase 2/3 running in parallel (character: Link/Navi/kids with per-view placement and a follow
  camera; HUD: hearts/item slot/minimap + equipment screen) — both in their final captures.
- Three biggest remaining gaps → (1) W37: the reference's Link, kid and HUD (10–15 % of every
  frame) — landing next; (2) F: one broad beam where the reference has four crisp ones, top-left
  is Saria's roof where the reference has canopy; D arch body/haze 0.895 vs 0.746; (3) 26 items
  await codex's cross-review (offline 27 h).

### 16:08 UTC — tick 23: take-0025 published (monitor `6a0c4ef`), valid; Phase 2/3 land
- `5b3dc01` character (Link, Navi, kids, gaits, per-view placement, play mode + follow camera),
  `8774d21` HUD (hearts, item slot, minimap, equipment screen), `8928b71` cameras to the
  reference's child eye height 1.45–1.5 m (Link spans y 0.56–0.88 at 4.6 m only from there;
  stairs keep 0.63/0.26 in A, 0.60/0.23 in F), atmosphere fairy yields to Navi, `1c864e1`
  kokiri-a in front of the stair-foot rock (he was hidden behind it in A).
- take-0025 (clean build of `1c864e1`): A 0.230 / B 0.208 / C 0.253 / D 0.249 / E 0.225 / F 0.216
  — up 0.03–0.035 on every view vs take-0024; pHash better on five; score 22/50 (C03/C04/C05
  auto-pass; C01/C02/U01–U03 pending review). New claim for W01/W33/W37/C01–C05/U01–U03.
- Round seven spawned: character-2 (Link fidelity: cap/fringe/undershirt/shield swirl, contact
  shadows, Navi sparkle, kid stick), trees-7 (F top-left canopy 0.57 → 0.46, F bank shade +
  edge trunk 0.52 → 0.31), vegetation-7 (D hero ferns hue 11° → 55°, F bank ferns, joint tufts),
  hardscape-7 (irregular rounded 0.5–0.9 m slabs, dark joints, B plaza 0.53 → 0.46, stair tone).
- Three biggest remaining gaps → (1) slab texture and Link fidelity (W37 SSIM 0.21–0.25 vs
  0.42); (2) F top-left roof / sunlit bank, D lavender verge; (3) 27 items await codex's
  cross-review (offline 29 h).

### 18:50 UTC — tick 24: take-0026 published (monitor `32afdfb`), valid; round seven vegetation
- `00b3700` hero fern crowns on D's west verge, violets off D's left edge, yellow blooms; east-bank
  ferns/weeds/moss under F's canopy; violets on A's right bank. `3a8af22` D's violet patches grown
  (12–13 heads over 0.65 m, two more on the bank) after the cut left the purple fraction at
  0.0006 < W18's 0.003 floor (the footage's own violets are hazed to sat < 0.2 and read 0.0002).
- take-0026 (clean build of `3a8af22`): A 0.230 / B 0.205 / C 0.253 / D 0.247 / E 0.226 / F 0.214
  — vegetation-only deltas inside the ±0.003 noise; D hueΔ 5.25 → 3.85°, purple 0.0134 → 0.0040;
  score 22/50; 26 entries in the ledger (D4 ≥ 24 valid met: 25 valid).
- Still running: character-2, trees-7, hardscape-7 (each in its own captures; tree typechecks).
  Forward on landing: trees — open a sun corridor onto D's west verge (x −4.5…−1.5, z −12…−6;
  reference ground lum 0.456, ours 0.232) and thin F's right-bank shade (p10 0.151 vs 0.243);
  hardscape — sprout target 700 → ~1500, 6–12 cm, dark green, LOD-culled beyond 25 m.
- Three biggest remaining gaps → (1) slab texture and Link fidelity (W37 SSIM 0.21–0.25 vs
  0.42, both in flight); (2) F top-left roof / D west verge in shade; (3) 27 items await codex's
  cross-review (offline 32 h).

### 19:20 UTC — tick 25: take-0027 published (monitor `30f3501`), valid; round seven trees
- `fa4b055` stair-bank giant (10.1, 0, 7.0) r 1.1 h 21 cuts F's right edge and stands behind the
  kid in C (C 0.253 → 0.260, pHash 28 → 26; A/B/D/E pixel-identical); crown-shade bark tint ×3.5;
  a measured plaza canopy bough that hides Saria's house from F cost F −0.012 / A −0.013 (the
  reference has smooth haze there) so it ships disabled. `ad0b91b` giant adopted into the layout.
- take-0027 (clean build of `ad0b91b`): A 0.230 / B 0.204 / C 0.260 / D 0.247 / E 0.225 / F 0.213;
  score 22/50; 27 entries.
- Trees follow-up running (D west-verge sun corridor, F bank dapple); character-2 and hardscape-7
  still in their captures.
- Three biggest remaining gaps → (1) slab texture and Link fidelity (W37 SSIM 0.20–0.26 vs
  0.42, both in flight); (2) F top-left shows the house at 22 m where the reference has haze —
  a layout/atmosphere decision, not trees; D verge and F bank in shade (trees follow-up);
  (3) 27 items await codex's cross-review (offline 33 h).

### 20:00 UTC — tick 26: take-0028 published (monitor `b9579df`), valid; round seven hardscape + character
- `3ed67e6` irregular rounded flagstones in dark soil joints (three jittered lattices → Voronoi,
  fillets, crowns, per-stone tint, NW moss film; B plaza 0.532 → 0.478 vs 0.458, A stairs 0.370 →
  0.352 vs 0.339, stone tops on the reference), rounder mossier boulders. `baf68b8` Link fidelity
  (bare arms/legs under puffed sleeves, low cap + golden fringe, centred shield, contact shadows,
  feet on slab tops; character-box SSIM A 0.226 → 0.240, D 0.179 → 0.217).
- take-0028 (clean build of `baf68b8`): A 0.239 / B 0.202 / C 0.262 / D 0.249 / E 0.221 / F 0.215;
  sharpness ratio −0.1…−0.2 everywhere from the rounded slab edges (A 0.984, gate 0.8); score
  22/50; 28 entries.
- Finding (probe, sun off vs on): the sun contributes ~0.06 of the D path's 0.45 luminance where
  the reference's Link shadow shows ~40–45 % — our world is fill-dominated with near-complete
  canopy shade; Link's cast shadow is invisible for that reason (castShadow on, inside the
  frustum). Atmosphere round four spawned on the sun/fill split (targets in its brief).
- Running: trees-7b (D verge sun corridor, F bank dapple), hardscape-7b (1.0–1.5 m foreground
  slabs with the count floor at 300, joint tufts ~1500, terrace boulder tone), atmosphere-4.
- Three biggest remaining gaps → (1) sun/fill contrast and cast shadows (W37); (2) foreground slab
  scale in B/E/D and the shaded D verge / F bank; (3) 27 items await codex's cross-review
  (offline 34 h).

### 21:30 UTC — tick 27: take-0029 published (monitor `25b7b35`), valid; trees follow-up
- `404b7d2` bank sun lines (F bank-only 0.266 → 0.278 vs 0.290; p90 0.386 vs 0.379), verge lines
  over D's west verge (canopy 41–65 % → 47–92 % open; ground still 0.24 vs 0.46 — the shade is the
  north-west-near giant's bole, the platform prop and a SE-facing wall: layout, not trees),
  corridor survival hashed per caster (new corridors no longer re-dapple the plaza).
- take-0029 (clean build of `404b7d2`): A 0.238 / B 0.202 / C 0.260 / D 0.250 / E 0.221 / F 0.211;
  score 22/50; 29 entries.
- Running: hardscape-7b (1–1.5 m foreground slabs, ~1500 joint tufts, terrace boulder tone),
  atmosphere-4 (sun/fill split: shadow/sunlit ≤ 0.70, shaded regions up, cooler shade fill).
- Three biggest remaining gaps → (1) sun/fill contrast and cast shadows (W37 SSIM 0.20–0.26 vs
  0.42); (2) foreground slab scale in B/E/D; D verge blockers and F's top-left house (layout);
  (3) 27 items await codex's cross-review (offline 35 h).

### 22:20 UTC — tick 28: take-0030 published (monitor `7e88e4f`), valid; hardscape follow-up
- `2ef6f3f` 1.0–1.6 m foreground slabs (three open lattices, 548 stones, floor 300), domed D path
  stones with sunk joints, 1500 joint tufts + clover, stair-foot rock on its own darker material,
  per-stone PRNG keyed on position (box means no longer drift ±0.03 with lattice edits).
- take-0030 (clean build of `2ef6f3f`): A 0.235 / B 0.200 / C 0.264 / D 0.245 / E 0.226 / F 0.217;
  score 22/50; 30 entries.
- Atmosphere-4 (sun/fill split) still running — its WIP exposure 0.94 → 1.0 lifts every plaza box
  ~0.05, so the hardscape's tone targets move with it; its final six-view capture includes the new
  slabs. Codex offline 36 h.
- Three biggest remaining gaps → (1) sun/fill contrast and Link's cast shadow (W37 SSIM
  0.20–0.26 vs 0.42); (2) layout: B's right region is continuous paving to the terrace where the
  reference has lawn with stepping stones; F's top-left house; the D verge blockers (bole, platform
  prop, SE wall); (3) 27 items await codex's cross-review.

### 00:40 UTC (Sep 11) — tick 29: take-0031 published (monitor `b85581a`), valid; lighting round four + house branch
- `ceefaba` PCSS + canopy-transmission shadow filter on a raw depth map, sun-dominant balance
  (sun 3.1 / hemi 0.95 / env 0.57), cooler skylight, chroma knee: shade keeps 0.35 of a lit slab
  (was 0.73); Link's own shadow still blocked by a limb (D, 10–11 m up the sun ray) and crown
  (A, 22–36 m) — trees-7c on it. `6df097a` Saria's branch = grassy ramp + 7 deterministic stepping
  stones, terrace 1.2 → 0.9, 'house' stair removed; `75dab48` terrace → 1.05 after the first
  capture read W04's probe at 0.777 (pad + erosion sit ~0.12 under the authored height).
- take-0031 (clean build of `75dab48`): A 0.246 / B 0.209 / C 0.255 / D 0.266 / E 0.228 / F 0.234
  — best A, B, D, E, F so far; C −0.009 (cooler shade on its trunks); score 22/50; 31 entries.
- Running: hardscape-7c (round slabs per stepping stone), trees-7c (Link shadow rays, A
  plaza/stairs coverage), atmosphere-4b (shaded-foliage palette: brighter, lower chroma).
- Three biggest remaining gaps → (1) W37 SSIM 0.21–0.27 vs 0.42: texture density and canopy
  coverage per view; (2) Link's cast shadow; F top-left house vs the reference's haze; (3) 27
  items await codex's cross-review (offline 38 h).

## Pending corrections from reference/ANALYSIS.md (apply at integration, one commit)
- `config.ts` palette → olive/khaki low-key (reference hero frames: hue 47–51°, sat 0.16–0.19,
  lum 0.35–0.39, 0 % blue sky): grass 0x8a8c55/0x5c6233/0x3a4420, moss 0x8b8948/0x5a523b,
  flagstone 0xa79774/0x746d5d, bark 0x7a7468/0x473e33, white bark 0xb9b3a4, canopy 0x4c5537,
  fern 0x69692e, flowers 0x7a4f8c; sky/hemi warm greys 0xcfd3c8/0xe2dfd0/0xc9c8b4/0x4a4a30.
- Fog: reference is ~60 % hazed at 30 m → exponential/height haze density ≈ 0.03, colour
  0x95968b → 0xa3a399 far, warm ground mist 0x7a796d; keep `far ≥ 150` for the audit.
- Sun elevation 34 → 38 (azimuth stays −128; shafts are screen-anchored upper-left in every
  heading in the footage, so god rays should be a screen-space effect anchored upper-left).
- (palette + sun elevation applied 13:49 in 73a9fdf) Layout: stairs rise 0.30 → 0.24 (heightfield ramps the last 1.1 m); lantern branch lower
  (from ≈ (−5.5, 4.0, −6.3) to (3.5, 2.6, −3.0), 2 orange pods on 1 m cords) with the
  lantern-tree at ≈ (−7.5, 2.0, −7.5); signpost → (5.5, 1.0, −9.8); house trunkRadius 3.5;
  log arch radius 4.0 + 3 lanterns; boulders stair-foot → (5.9, 0.1, −3.0), shot-d → (−0.8, 0,
  −2.5); viewpoint retargets A/B/C/D/F per ANALYSIS §14 (F becomes eye-level along the stair
  axis, fov 42, not a look-up).
- Rubric traps: W18 purple ≥ 0.3 % is stricter than the reference itself (0.02 %) — meet it
  with saturated blooms in D's foreground; W30's azimuth range is consistent with shots A/B
  only (the footage's light is camera-relative) — note in the visual verdict.

## Known issues
- Terrain sampler contract defects reported by codex (`.agents/reviews/codex-terrain-review.md`):
  5 cm memo cache makes `height()` order-dependent; sampler vs rendered mesh up to 18 cm on the
  stair ramp; LOD seams. Fix pending in the terrain pass (lattice-consistent sampler).
- Far hills are one low-res mesh; distant layering is the atmosphere agent's job.
- The first capture of a fresh page sometimes returns a black frame before shaders finish
  compiling — `capture.mjs` needs the variance-retry guard (tooling task, in flight).
- Box is CPU-saturated by parallel SwiftShader captures (load ≈ 20 on 4 cores); full six-view
  high-quality takes wait until the sub-agent passes finish.

## Recommended next work (for the second agent)
Pick anything NOT claimed in `gauntlet/claims.json`. Good self-contained candidates:
- `src/world/rocks/` — hero boulders with ridged displacement, cracks, moss, scree (W23, W24).
- `src/world/postfx/` — SMAA/TAA-quality AA, SSAO/GTAO, restrained bloom for lanterns (W35, W36).
- `src/world/trees/distant.ts` — 400+ LOD'd far trees for horizon layering (W13).
- Reviews: file visual verdicts on my takes (`npm run gauntlet -- --review …`) — I cannot review
  my own (GAUNTLET.md D7).

## Last updated
2026-09-10T15:42:00Z
