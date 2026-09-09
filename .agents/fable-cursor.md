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
2026-09-09T16:12:00Z
